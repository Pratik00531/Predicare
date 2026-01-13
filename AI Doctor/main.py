"""
PrediCare AI Doctor Backend API
FastAPI server integrating all AI doctor components
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn
import os
import tempfile
import base64
from typing import Optional
import logging
import asyncio
from functools import lru_cache
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

# Import our AI doctor components
from brain_of_the_doctor import analyze_image_with_query, encode_image
from voice_of_the_doctor import text_to_speech_with_gtts, text_to_speech_with_elevenlabs
from voice_of_the_patient import transcribe_with_groq, record_audio
from auth_service import OTPService, EmailService, FirebaseAuthService

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Email Service for OTP
email_service = EmailService()

# Initialize Firebase Admin
try:
    firebase_creds_path = os.getenv('FIREBASE_CREDENTIALS_PATH', './firebase-credentials.json')
    if os.path.exists(firebase_creds_path):
        # Check if Firebase app already exists (prevents double initialization on reload)
        try:
            firebase_admin.get_app()
            db = firestore.client()
            logger.info("✅ Firebase Firestore already initialized")
        except ValueError:
            # App doesn't exist, initialize it
            cred = credentials.Certificate(firebase_creds_path)
            firebase_admin.initialize_app(cred, {
                'projectId': os.getenv('FIREBASE_PROJECT_ID'),
            })
            db = firestore.client()
            logger.info("✅ Firebase Firestore initialized successfully")
    else:
        db = None
        logger.warning("⚠️ Firebase credentials not found - running without database persistence")
except Exception as e:
    db = None
    logger.warning(f"⚠️ Firebase initialization failed: {e} - running without database")

# CONVERSATION STATE MANAGEMENT (Critical for clinical safety)
# Stores case context to prevent context collapse
conversation_state = {}


class CaseContext:
    """
    Locks clinical context once a case begins.
    Prevents context collapse and symptom drift.
    Implements THREE-TIER urgency system: EMERGENCY, URGENT, ROUTINE
    """
    def __init__(self, session_id: str, initial_symptoms: str):
        self.session_id = session_id
        self.initial_symptoms = initial_symptoms
        self.urgency_tier = "routine"  # Changed from emergency_level
        self.organ_system = None
        self.symptom_history = [initial_symptoms]
        self.locked = True
        
        # NEW: Severity scoring system
        self.severity_score = 0
        self.severity_factors = {}
        
        # NEW: Question tracking to prevent repeats
        self.asked_questions = set()
        
        # NEW: Risk weights for differential diagnosis
        self.risk_weights = {}
        self.diagnostic_certainty = 0.0
        
        # NEW: Emergency response tracking
        self.emergency_shown = False  # Track if full emergency message shown
        self.emergency_repeat_count = 0  # Count how many times user ignored
        
        # Calculate initial severity
        self._calculate_severity(initial_symptoms)
    
    def is_emergency(self):
        """True only for RED tier emergencies (call 911)"""
        return self.urgency_tier == "emergency"
    
    def is_urgent(self):
        """True for AMBER tier (same-day evaluation needed)"""
        return self.urgency_tier == "urgent"
    
    def is_routine(self):
        """True for GREEN tier (monitor or schedule)"""
        return self.urgency_tier == "routine"
    
    def set_urgency(self, tier: str):
        """Urgency can only escalate: routine → urgent → emergency"""
        tier_priority = {"routine": 0, "urgent": 1, "emergency": 2}
        current_priority = tier_priority.get(self.urgency_tier, 0)
        new_priority = tier_priority.get(tier, 0)
        
        if new_priority > current_priority:
            old_tier = self.urgency_tier
            self.urgency_tier = tier
            logger.warning(f"⚠️ Urgency escalated: {old_tier.upper()} → {tier.upper()}")
        # Intentionally no way to go back to "none"
    
    def is_user_acknowledging(self, text: str) -> bool:
        """Detect if user is acknowledging they will seek help"""
        text_lower = text.lower().strip()
        acknowledgments = [
            "ok", "okay", "yes", "going", "i'm going", "im going",
            "will go", "on my way", "heading there", "understood",
            "got it", "thank you", "thanks"
        ]
        return any(ack in text_lower for ack in acknowledgments)
    
    def is_unrelated_chat(self, text: str) -> bool:
        """Detect if user is sending unrelated/casual messages during emergency"""
        text_lower = text.lower().strip()
        unrelated_patterns = [
            "hello", "hi", "hey", "how are you", "what's up",
            "lol", "haha", "joke", "kidding"
        ]
        # Short messages or casual greetings are likely unrelated
        if len(text_lower) < 10 and any(pattern in text_lower for pattern in unrelated_patterns):
            return True
        return False
    
    def add_follow_up(self, follow_up: str):
        """Add follow-up response - should only confirm/deny/clarify"""
        self.symptom_history.append(follow_up)
        # Re-calculate severity with new information
        self._update_severity(follow_up)
        # Update risk weights (dynamic re-prioritization)
        self._update_risk_weights(follow_up)
    
    def _calculate_severity(self, text: str):
        """
        PATTERN-BASED SEVERITY ASSESSMENT with THREE-TIER URGENCY
        
        EMERGENCY (RED) = Immediate life threat - Call 911
        URGENT (AMBER) = Same-day evaluation needed - ER or urgent care
        ROUTINE (GREEN) = Monitor or schedule appointment
        """
        text_lower = text.lower()
        self.severity_score = 0
        self.severity_factors = {}
        
        # ===== EMERGENCY TIER (RED) - Immediate life threat =====
        # Severe cardiac symptoms
        if any(kw in text_lower for kw in ["chest pain", "chest pressure", "crushing", "tight chest"]) and \
           any(kw in text_lower for kw in ["arm", "jaw", "shoulder", "radiating", "sweating", "dizzy"]):
            self.severity_score += 7
            self.severity_factors["cardiac_emergency"] = 7
            self.set_urgency("emergency")
            logger.critical("🚨 EMERGENCY: Cardiac symptoms detected")
        
        # Severe breathing distress
        if any(kw in text_lower for kw in ["can't breathe", "gasping", "suffocating", "turning blue", "lips blue"]):
            self.severity_score += 7
            self.severity_factors["respiratory_emergency"] = 7
            self.set_urgency("emergency")
            logger.critical("🚨 EMERGENCY: Severe respiratory distress")
        
        # Severe trauma
        if any(kw in text_lower for kw in ["car accident", "fell from height", "hit by car", "stabbed", "shot", "severe bleeding"]):
            self.severity_score += 7
            self.severity_factors["severe_trauma"] = 7
            self.set_urgency("emergency")
            logger.critical("🚨 EMERGENCY: Severe trauma detected")
        
        # Stroke symptoms
        if any(kw in text_lower for kw in ["face drooping", "arm weakness", "slurred speech", "sudden confusion"]):
            self.severity_score += 7
            self.severity_factors["stroke_symptoms"] = 7
            self.set_urgency("emergency")
            logger.critical("🚨 EMERGENCY: Possible stroke")
        
        # ===== URGENT TIER (AMBER) - Same-day evaluation =====
        # Appendicitis pattern: RLQ pain + anorexia + nausea ± fever
        if any(kw in text_lower for kw in ["right lower", "rlq", "right side abdomen", "right abdomen"]):
            if any(kw in text_lower for kw in ["nausea", "nauseous", "feel sick"]) and \
               any(kw in text_lower for kw in ["appetite", "don't want to eat", "can't eat", "not hungry", "anorexia"]):
                self.severity_score += 5
                self.severity_factors["appendicitis_pattern"] = 5
                self.set_urgency("urgent")
                logger.warning("⚠️ URGENT: Appendicitis pattern detected - same-day evaluation needed")
        
        # Peritonitis signs
        if any(kw in text_lower for kw in ["abdom", "stomach", "belly"]) and \
           any(kw in text_lower for kw in ["guard", "rigid", "hard", "board-like", "rebound"]):
            self.severity_score += 6
            self.severity_factors["peritonitis_signs"] = 6
            self.set_urgency("urgent")
            logger.warning("⚠️ URGENT: Peritonitis signs")
        
        # Sudden severe localized pain
        if ("sudden" in text_lower or "abrupt" in text_lower) and \
           ("severe" in text_lower or "worst" in text_lower) and \
           any(kw in text_lower for kw in ["right", "left", "upper", "lower", "quadrant"]):
            self.severity_score += 4
            self.severity_factors["acute_localized_pain"] = 4
            self.set_urgency("urgent")
        
        # Neurological deficits (not stroke-level)
        neuro_keywords = ["weakness", "numbness", "tingling", "vision changes", "seizure", "neck stiff"]
        if any(kw in text_lower for kw in neuro_keywords):
            self.severity_score += 4
            self.severity_factors["neurological_symptoms"] = 4
            self.set_urgency("urgent")
        
        # Persistent vomiting
        if any(kw in text_lower for kw in ["vomiting", "throwing up", "can't keep"]) and \
           any(kw in text_lower for kw in ["hours", "all day", "constant", "won't stop"]):
            self.severity_score += 3
            self.severity_factors["persistent_vomiting"] = 3
            self.set_urgency("urgent")
        
        # ===== ROUTINE TIER (GREEN) - Monitor or schedule =====
        # Fever (alone, not high)
        if "fever" in text_lower or "temperature" in text_lower:
            if any(kw in text_lower for kw in ["104", "105", "very high", "103"]):
                self.severity_score += 2
                self.severity_factors["high_fever"] = 2
                self.set_urgency("urgent")
            else:
                self.severity_score += 1
                self.severity_factors["fever"] = 1
        
        # Vomiting (not persistent)
        if ("vomit" in text_lower or "throwing up" in text_lower) and self.severity_score == 0:
            self.severity_score += 1
            self.severity_factors["vomiting"] = 1
        
        logger.info(f"Severity: {self.severity_score} | Urgency tier: {self.urgency_tier.upper()} | Factors: {self.severity_factors}")
    
    def _update_severity(self, text: str):
        """Update severity score with new information"""
        old_score = self.severity_score
        self._calculate_severity(" ".join(self.symptom_history))
        
        if self.severity_score > old_score:
            logger.info(f"Severity escalated: {old_score} → {self.severity_score}")
    
    def _update_risk_weights(self, text: str):
        """
        DYNAMIC RE-PRIORITIZATION ENGINE
        Updates differential diagnosis probabilities based on new information
        """
        text_lower = text.lower()
        weight_changes = {}
        
        # Trauma information added
        if any(kw in text_lower for kw in ["trauma", "injury", "accident", "fall", "hit"]):
            # Increase hemorrhage/bleeding risk
            weight_changes["intracranial_hemorrhage"] = weight_changes.get("intracranial_hemorrhage", 0) + 0.3
            weight_changes["subdural_hematoma"] = weight_changes.get("subdural_hematoma", 0) + 0.3
            weight_changes["epidural_hematoma"] = weight_changes.get("epidural_hematoma", 0) + 0.2
            
            # Decrease infection-only causes
            weight_changes["meningitis"] = weight_changes.get("meningitis", 0) - 0.2
            weight_changes["viral_infection"] = weight_changes.get("viral_infection", 0) - 0.2
            
        # Fever + neurological = infection more likely
        if "fever" in self.severity_factors and "neurological" in self.severity_factors:
            weight_changes["meningitis"] = weight_changes.get("meningitis", 0) + 0.4
            weight_changes["encephalitis"] = weight_changes.get("encephalitis", 0) + 0.3
            
        # Sudden onset + headache = vascular events
        if "sudden_onset" in self.severity_factors and "neurological" in self.severity_factors:
            weight_changes["subarachnoid_hemorrhage"] = weight_changes.get("subarachnoid_hemorrhage", 0) + 0.3
            weight_changes["stroke"] = weight_changes.get("stroke", 0) + 0.2
            
        # Update weights
        for condition, change in weight_changes.items():
            self.risk_weights[condition] = self.risk_weights.get(condition, 0.5) + change
            # Clamp between 0 and 1
            self.risk_weights[condition] = max(0.0, min(1.0, self.risk_weights[condition]))
            
        if weight_changes:
            logger.info(f"Risk weights updated: {weight_changes}")
    
    def get_risk_weight_explanation(self) -> str:
        """Generate explanation of why differential ranking changed"""
        if not self.risk_weights:
            return ""
            
        explanations = []
        
        if "trauma" in self.severity_factors:
            explanations.append("With the addition of recent trauma, conditions involving bleeding (intracranial hemorrhage, subdural hematoma) rise in priority, while infection-only causes become less likely.")
            
        if "fever" in self.severity_factors and "neurological" in self.severity_factors:
            explanations.append("The combination of fever and neurological symptoms significantly increases the probability of infectious causes such as meningitis or encephalitis.")
            
        if "sudden_onset" in self.severity_factors and "neurological" in self.severity_factors:
            explanations.append("Sudden onset neurological symptoms shift priority toward acute vascular events (subarachnoid hemorrhage, stroke).")
            
        return " ".join(explanations)
    
    def should_suppress_questions(self) -> bool:
        """
        QUESTION SUPPRESSION LOGIC
        Stop asking questions when emergency locked and certainty high
        """
        if self.is_emergency() and self.diagnostic_certainty > 0.7:
            return True
        if self.urgency_tier == "emergency":
            return True
        return False
    
    def track_question(self, question: str):
        """Track asked questions to prevent repeats"""
        # Normalize question (lowercase, remove punctuation)
        normalized = question.lower().strip("? ").replace(".", "").replace(",", "")
        self.asked_questions.add(normalized)
    
    def is_question_asked(self, question: str) -> bool:
        """Check if similar question was already asked"""
        normalized = question.lower().strip("? ").replace(".", "").replace(",", "")
        
        # Check exact match
        if normalized in self.asked_questions:
            return True
            
        # Check semantic similarity (basic keyword matching)
        for asked in self.asked_questions:
            # If 70% of keywords match, consider it a repeat
            asked_words = set(asked.split())
            new_words = set(normalized.split())
            if len(asked_words & new_words) / len(new_words) > 0.7:
                return True
                
        return False
    
    def detect_organ_system(self, text: str) -> str:
        """Detect primary organ system from initial symptoms"""
        text_lower = text.lower()
        if any(kw in text_lower for kw in ["headache", "confusion", "weakness", "numbness", "seizure", "stroke", "brain", "neck stiffness"]):
            return "neurological"
        elif any(kw in text_lower for kw in ["chest pain", "heart", "palpitation", "cardiac"]):
            return "cardiovascular"
        elif any(kw in text_lower for kw in ["breathing", "cough", "lung", "respiratory"]):
            return "respiratory"
        elif any(kw in text_lower for kw in ["stomach", "abdomen", "nausea", "vomit", "diarrhea"]):
            return "gastrointestinal"
        return "unspecified"
    
    def validate_organ_system_consistency(self, new_system: str) -> bool:
        """Prevent organ system switching - HARD RULE"""
        if self.organ_system is None:
            self.organ_system = new_system
            return True
        return self.organ_system == new_system
    
    def to_dict(self) -> dict:
        """Convert CaseContext to dictionary for Firestore storage"""
        return {
            "sessionId": self.session_id,
            "initialSymptoms": self.initial_symptoms,
            "emergencyLevel": self.urgency_tier,
            "urgencyTier": self.urgency_tier,
            "organSystem": self.organ_system,
            "symptomHistory": self.symptom_history,
            "severityScore": self.severity_score,
            "severityFactors": self.severity_factors,
            "riskWeights": self.risk_weights,
            "diagnosticCertainty": self.diagnostic_certainty,
            "emergencyShown": self.emergency_shown,
            "emergencyRepeatCount": self.emergency_repeat_count,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP
        }
    
    def save_to_firestore(self, user_id: str = "anonymous"):
        """Persist conversation state to Firestore"""
        if db is None:
            return  # Skip if Firestore not initialized
        
        try:
            doc_ref = db.collection('users').document(user_id).collection('conversations').document(self.session_id)
            doc_ref.set(self.to_dict(), merge=True)
            logger.info(f"💾 Saved conversation {self.session_id} to Firestore")
        except Exception as e:
            logger.error(f"❌ Failed to save to Firestore: {e}")
    
    def save_message_to_firestore(self, user_id: str, role: str, content: str):
        """Save individual message to Firestore"""
        if db is None:
            return
        
        try:
            message_ref = (db.collection('users').document(user_id)
                          .collection('conversations').document(self.session_id)
                          .collection('messages').document())
            
            message_ref.set({
                "role": role,
                "content": content,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "emergencyLevel": self.urgency_tier,
                "urgencyTier": self.urgency_tier,
                "severityScore": self.severity_score
            })
            logger.info(f"💬 Saved message to Firestore")
        except Exception as e:
            logger.error(f"❌ Failed to save message: {e}")

# Rule-based emergency detection (override AI response)
EMERGENCY_KEYWORDS = {
    "critical": [
        # Cardiovascular emergencies
        ("chest pain", "shortness of breath"),
        ("chest pain", "dyspnea"),
        ("chest pain", "radiating"),
        ("crushing chest", ""),
        
        # Neurological emergencies  
        ("sudden weakness", "one side"),
        ("facial drooping", ""),
        ("slurred speech", "sudden"),
        ("severe headache", "worst ever"),
        ("neck stiffness", "high fever"),
        ("confusion", "sudden"),
        
        # Respiratory emergencies
        ("difficulty breathing", "severe"),
        ("cannot breathe", ""),
        ("choking", ""),
        
        # Bleeding/Trauma
        ("severe bleeding", ""),
        ("uncontrolled bleeding", ""),
        ("heavy bleeding", ""),
        
        # Other critical
        ("loss of consciousness", ""),
        ("seizure", ""),
        ("severe allergic", ""),
        ("anaphylaxis", ""),
    ],
    "urgent": [
        ("chest pain", ""),
        ("difficulty breathing", ""),
        ("high fever", "rash"),
        ("severe pain", "abdomen"),
        ("persistent vomiting", ""),
    ]
}

def detect_emergency(message: str) -> dict:
    """
    Rule-based emergency detection - no AI interpretation needed.
    Returns: {\"level\": \"critical\"|\"urgent\"|\"none\", \"reason\": str}
    """
    message_lower = message.lower()
    
    # Check critical emergencies
    for keyword_pair in EMERGENCY_KEYWORDS["critical"]:
        primary, secondary = keyword_pair
        if primary in message_lower:
            if not secondary or secondary in message_lower:
                return {
                    "level": "critical",
                    "reason": f"Detected potential emergency: {primary}" + (f" with {secondary}" if secondary else ""),
                    "action": "CALL 911 OR GO TO EMERGENCY ROOM IMMEDIATELY"
                }
    
    # Check urgent conditions
    for keyword_pair in EMERGENCY_KEYWORDS["urgent"]:
        primary, secondary = keyword_pair
        if primary in message_lower:
            if not secondary or secondary in message_lower:
                return {
                    "level": "urgent",
                    "reason": f"Detected urgent condition: {primary}",
                    "action": "Seek medical attention within 24 hours"
                }
    
    return {"level": "none", "reason": "", "action": ""}

# Initialize FastAPI app
app = FastAPI(
    title="PrediCare AI Doctor API",
    description="Advanced AI-powered medical analysis and voice assistant",
    version="1.0.0"
)

# Environment-based CORS configuration
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:3000,http://localhost:8081,http://localhost:5173"
).split(",")

# Add CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Cache for common responses (simple in-memory cache)
response_cache = {}

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "PrediCare AI Doctor API is running!",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.post("/api/analyze-image")
async def analyze_medical_image(
    image: UploadFile = File(...),
    query: str = Form(default="Please analyze this medical image and provide a detailed assessment.")
):
    """
    Analyze medical images using AI vision
    """
    try:
        # Validate image file
        if not image.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Save uploaded image temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp_file:
            content = await image.read()
            temp_file.write(content)
            temp_image_path = temp_file.name
        
        # Encode image for AI analysis
        encoded_image = encode_image(temp_image_path)
        
        # Analyze with AI using the best available vision model
        try:
            analysis_result = analyze_image_with_query(query, None, encoded_image)
        except Exception as e:
            logger.error(f"Image analysis failed: {e}")
            # Fallback to text-only analysis
            analysis_result = "I can see an image has been uploaded, but I'm currently unable to analyze it due to technical issues. Please describe what you're seeing in the image, and I'll provide medical guidance based on your description."
        
        # Clean up temporary file
        os.unlink(temp_image_path)
        
        return {
            "success": True,
            "analysis": analysis_result,
            "query_used": query,
            "model": model
        }
        
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/api/text-to-speech")
async def convert_text_to_speech(
    text: str = Form(...),
    voice_provider: str = Form(default="gtts")  # "gtts" or "elevenlabs"
):
    """
    Convert text to speech audio
    """
    try:
        # Create temporary audio file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            audio_path = temp_file.name
        
        # Generate audio based on provider
        if voice_provider == "elevenlabs":
            text_to_speech_with_elevenlabs(text, audio_path)
        else:
            text_to_speech_with_gtts(text, audio_path)
        
        # Return audio file
        return FileResponse(
            audio_path,
            media_type="audio/mpeg",
            filename="doctor_voice.mp3"
        )
        
    except Exception as e:
        logger.error(f"Error generating speech: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")

@app.post("/api/speech-to-text")
async def convert_speech_to_text(
    audio: UploadFile = File(...)
):
    """
    Convert speech audio to text
    """
    try:
        # Validate audio file
        if not audio.content_type.startswith('audio/'):
            raise HTTPException(status_code=400, detail="File must be an audio file")
        
        # Save uploaded audio temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
            content = await audio.read()
            temp_file.write(content)
            temp_audio_path = temp_file.name
        
        # Transcribe with GROQ
        stt_model = "whisper-large-v3"
        groq_api_key = os.environ.get("GROQ_API_KEY")
        transcription = transcribe_with_groq(stt_model, temp_audio_path, groq_api_key)
        
        # Clean up temporary file
        os.unlink(temp_audio_path)
        
        return {
            "success": True,
            "transcription": transcription,
            "model": stt_model
        }
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

def detect_symptoms_in_message(text: str) -> bool:
    """
    INTENT DETECTION: Simple heuristics to detect if message contains symptoms
    No ML needed - pattern matching is sufficient and safer
    """
    text_lower = text.lower().strip()
    
    # BODY PARTS (strong symptom indicator)
    body_parts = [
        "head", "chest", "stomach", "abdomen", "back", "neck", "throat", "arm", "leg",
        "eye", "ear", "nose", "mouth", "skin", "heart", "lung", "kidney", "liver",
        "brain", "foot", "hand", "shoulder", "knee", "ankle", "joint", "muscle"
    ]
    
    # SYMPTOM KEYWORDS (direct symptom language)
    symptoms = [
        "pain", "ache", "hurt", "sore", "fever", "temperature", "bleeding", "blood",
        "swelling", "swollen", "rash", "itch", "cough", "vomit", "nausea", "dizzy",
        "weak", "tired", "fatigue", "breathe", "breathing", "shortness", "numb",
        "tingling", "burning", "sharp", "dull", "throbbing", "cramping", "stiff"
    ]
    
    # TIME INDICATORS (symptom duration/onset)
    time_words = [
        "since", "for", "started", "began", "sudden", "suddenly", "days", "hours",
        "weeks", "ago", "yesterday", "morning", "night", "continuous", "intermittent"
    ]
    
    # SEVERITY INDICATORS (symptom intensity)
    severity_words = [
        "severe", "mild", "moderate", "intense", "extreme", "unbearable", "sharp",
        "crushing", "radiating", "constant", "worse", "better", "spreading"
    ]
    
    # Check if message contains symptom indicators
    has_body_part = any(bp in text_lower for bp in body_parts)
    has_symptom = any(sym in text_lower for sym in symptoms)
    has_time = any(tw in text_lower for tw in time_words)
    has_severity = any(sw in text_lower for sw in severity_words)
    
    # Scoring: Higher confidence = more indicators present
    symptom_score = sum([has_body_part, has_symptom, has_time, has_severity])
    
    # Symptoms detected if score >= 2 OR has explicit symptom word
    return symptom_score >= 2 or has_symptom


def is_greeting_message(text: str) -> bool:
    """Detect if message is just a greeting (no symptoms)"""
    text_lower = text.lower().strip()
    greetings = [
        "hi", "hello", "hey", "greetings", "good morning", "good afternoon",
        "good evening", "what's up", "sup", "yo"
    ]
    # Pure greeting if it's ONLY a greeting phrase (short message)
    return text_lower in greetings or (len(text_lower) < 20 and any(g in text_lower for g in greetings))


def is_vague_message(text: str) -> bool:
    """Detect vague/unclear messages that need clarification"""
    text_lower = text.lower().strip()
    vague_phrases = [
        "not feeling well", "feeling bad", "feeling sick", "something wrong",
        "need help", "i'm sick", "im sick", "don't feel good", "something feels off"
    ]
    return any(vp in text_lower for vp in vague_phrases)


@app.post("/api/chat")
async def chat_with_ai_doctor(
    message: str = Form(...),
    session_id: str = Form(default="default"),
    user_id: str = Form(default="anonymous"),
    include_voice: bool = Form(default=False),
    # User profile data (optional)
    age: int = Form(default=None),
    gender: str = Form(default=None),
    height: int = Form(default=None),  # cm
    weight: int = Form(default=None),  # kg
    medical_conditions: str = Form(default=None),
    medications: str = Form(default=None),
    allergies: str = Form(default=None)
):
    """
    Medical consultation with ADAPTIVE SYMPTOM INTAKE + conversation state management
    Now includes user profile data for personalized assessment
    """
    try:
        # CASE LOCKING: Check if this is a new case or continuation
        is_new_case = session_id not in conversation_state
        
        if is_new_case:
            # INTENT DETECTION: Determine user's message type
            has_symptoms = detect_symptoms_in_message(message)
            is_greeting = is_greeting_message(message)
            is_vague = is_vague_message(message)
            
            # 🟢 STATE A: ORIENTATION (Greeting or vague, no symptoms)
            if is_greeting and not has_symptoms:
                orientation_response = """Hello.
I can help you understand your symptoms and guide you on next steps.

Please describe what you're experiencing in your own words. You don't need to be medical — just explain what feels wrong."""
                
                return {
                    "success": True,
                    "response": orientation_response,
                    "emergency": False,
                    "session_id": session_id,
                    "state": "orientation",
                    "symptoms_detected": False
                }
            
            # 🟠 STATE C: VAGUE SYMPTOMS (Needs clarification)
            elif is_vague and not has_symptoms:
                clarification_response = """I understand.
To help you better, could you tell me what symptoms you're noticing? For example, pain, fever, breathing issues, or anything else concerning."""
                
                return {
                    "success": True,
                    "response": clarification_response,
                    "emergency": False,
                    "session_id": session_id,
                    "state": "clarification",
                    "symptoms_detected": False
                }
            
            # 🟡 STATE B: DIRECT SYMPTOM INTAKE (Symptoms detected)
            # Initialize case context ONLY if symptoms are present
            case_context = CaseContext(session_id, message)
            case_context.organ_system = case_context.detect_organ_system(message)
            case_context.symptoms_detected = True  # Flag to track symptom presence
            conversation_state[session_id] = case_context
            logger.info(f"New case started: {session_id}, Organ system: {case_context.organ_system}, Symptoms: YES")
            
            # Save initial state to Firestore
            case_context.save_to_firestore(user_id)
        else:
            # Continuing existing case
            case_context = conversation_state[session_id]
            
            # Check if this is the FIRST message with symptoms (user clarified after greeting)
            if not hasattr(case_context, 'symptoms_detected') or not case_context.symptoms_detected:
                has_symptoms_now = detect_symptoms_in_message(message)
                
                if has_symptoms_now:
                    # User just provided symptoms - initialize properly
                    case_context.initial_symptoms = message
                    case_context.symptom_history = [message]
                    case_context.organ_system = case_context.detect_organ_system(message)
                    case_context.symptoms_detected = True
                    case_context._calculate_severity(message)
                    logger.info(f"Symptoms now detected in session {session_id}")
                else:
                    # Still no symptoms - keep asking for clarification
                    clarification_response = """I'd like to help, but I need more information about your symptoms.

Could you describe what you're feeling? For example:
• What hurts or feels wrong?
• Where in your body is it?
• When did it start?"""
                    
                    return {
                        "success": True,
                        "response": clarification_response,
                        "emergency": False,
                        "session_id": session_id,
                        "state": "awaiting_symptoms",
                        "symptoms_detected": False
                    }
            
            case_context.add_follow_up(message)
            logger.info(f"Continuing case: {session_id}, Urgency tier: {case_context.urgency_tier}")
        
        # Save user message to Firestore
        case_context.save_message_to_firestore(user_id, "user", message)
        
        # TIERED EMERGENCY RESPONSE SYSTEM (only for true emergencies)
        if case_context.is_emergency():
            # 🟥 FIRST EMERGENCY MESSAGE (Full detailed response)
            if not case_context.emergency_shown:
                case_context.emergency_shown = True
                emergency_response = f"""🚨 EMERGENCY - CALL 911 IMMEDIATELY 🚨

**ORIGINAL SYMPTOMS:** {case_context.initial_symptoms}

**IMMEDIATE ACTION REQUIRED:**
Call 911 or go to the nearest emergency room immediately.

This situation requires immediate professional medical evaluation. Follow-up questions or additional information do NOT change the emergency status. Only a healthcare professional can clear this status after in-person evaluation.

**BOUNDARY STATEMENT**
This is a medical information assistant. This assessment does not replace emergency medical services."""
            
            # 🟨 USER ACKNOWLEDGES ("I'm going", "Ok")
            elif case_context.is_user_acknowledging(message):
                emergency_response = """Understood. Please call 911 or go to the nearest emergency room immediately.

This situation should not be delayed."""
            
            # 🟧 SUBSEQUENT UNRELATED MESSAGES (Short & firm)
            elif case_context.is_unrelated_chat(message):
                case_context.emergency_repeat_count += 1
                
                # After 3 repetitions, minimal response
                if case_context.emergency_repeat_count >= 3:
                    emergency_response = "🚨 This remains a medical emergency. Seek immediate in-person medical care now."
                else:
                    emergency_response = """🚨 This remains a medical emergency.

Please seek immediate in-person medical care now.

I cannot assist further until you are evaluated by a healthcare professional."""
            
            # 🟧 ANY OTHER SUBSEQUENT MESSAGE (Short reminder)
            else:
                case_context.emergency_repeat_count += 1
                emergency_response = """🚨 This remains a medical emergency.

Please seek immediate in-person medical care now.

I cannot assist further until you are evaluated by a healthcare professional."""
            
            # Save emergency response to Firestore
            case_context.save_message_to_firestore(user_id, "assistant", emergency_response)
            case_context.save_to_firestore(user_id)
            
            return {
                "success": True,
                "response": emergency_response,
                "emergency": True,
                "urgency_tier": "emergency",
                "emergency_level": "emergency",
                "session_id": session_id,
                "message_received": message
            }
        
        # For non-emergency consultations with context locking
        from groq import Groq
        
        client = Groq()
        
        # Professional medical consultation prompt with CONTEXT LOCKING
        risk_weight_explanation = case_context.get_risk_weight_explanation()
        suppress_questions = case_context.should_suppress_questions()
        
        # Determine if this is first response to symptoms (affects greeting)
        is_first_symptom_response = len(case_context.symptom_history) == 1
        
        # Build patient profile context
        patient_context = ""
        if age or gender or height or weight:
            patient_context = "\n**PATIENT PROFILE:**"
            if age:
                patient_context += f"\n• Age: {age} years"
            if gender:
                patient_context += f"\n• Gender: {gender.capitalize()}"
            if height and weight:
                bmi = weight / ((height/100) ** 2)
                patient_context += f"\n• BMI: {bmi:.1f} (Height: {height}cm, Weight: {weight}kg)"
            if medical_conditions:
                patient_context += f"\n• Medical History: {medical_conditions}"
            if medications:
                patient_context += f"\n• Current Medications: {medications}"
            if allergies:
                patient_context += f"\n• Allergies: {allergies}"
            patient_context += "\n\nIMPORTANT: Use this patient data to refine differential diagnosis and assess risk factors."
        
        system_prompt = f"""You are a medical symptom assessment assistant.
Your primary responsibility is patient safety and correct clinical prioritization.

You do NOT diagnose.
You do NOT provide probability percentages.
You do NOT provide reassurance when surgical or time-sensitive conditions are possible.

––––––––––––––––––––
CORE CLINICAL RULES
––––––––––––––––––––

1. NEVER assign numeric probabilities (e.g., 80%, 5%).
   Use only qualitative ranking:
   - Most likely
   - Possible
   - Must be ruled out urgently

2. NEVER classify a case as "low severity" if it matches a known high-risk clinical pattern,
   even if individual symptoms appear mild.

3. SEVERITY SCORE MUST NOT OVERRIDE PATTERN-BASED RISK.
   Pattern recognition always has higher priority than symptom scoring.

––––––––––––––––––––
APPENDICITIS OVERRIDE RULE (MANDATORY)
––––––––––––––––––––

If ALL of the following are present:
- Abdominal pain localized to the right lower quadrant (RLQ)
- Loss of appetite (anorexia)
- Nausea or vomiting

AND ANY of the following:
- Fever (even low-grade)
- Pain progression or localization
- Worsening pain over time

THEN:
- Appendicitis MUST be ranked as a HIGH-PRIORITY concern
- Case MUST be classified as URGENT
- User MUST be advised to seek prompt in-person medical evaluation
- Reassuring language is PROHIBITED

Under these conditions:
- Gastroenteritis MUST NOT be ranked higher than appendicitis
- "Low severity" labels are NOT allowed

––––––––––––––––––––
SURGICAL RED FLAG RULES (GLOBAL)
––––––––––––––––––––

The following findings automatically increase urgency,
regardless of overall severity score:

- Localized abdominal pain (especially RLQ)
- Loss of appetite with abdominal pain
- Pain that localizes or migrates
- Abdominal pain with fever
- Abdominal pain with nausea or vomiting

If any surgical red flag is present:
- Do NOT provide home-care reassurance
- Do NOT minimize the condition
- Do NOT delay evaluation

––––––––––––––––––––
DIFFERENTIAL DIAGNOSIS ORDERING
––––––––––––––––––––

When generating differentials:
1. Rank conditions by clinical danger and time sensitivity first
2. Rank common but less dangerous conditions second
3. Explicitly state when a serious condition must be ruled out

Example ordering:
- Primary concern: condition that must be ruled out urgently
- Other possible causes: less dangerous explanations
- Do NOT bury serious conditions at the bottom

––––––––––––––––––––
USER-FACING RESPONSE STRUCTURE
––––––––––––––––––––

All responses MUST follow this structure:

1. SUMMARY (1–2 lines)
   - State concern level clearly
   - Avoid reassurance if red flags exist

2. PRIMARY CONCERN
   - Name the condition that must be ruled out
   - Briefly explain why, using symptom pattern

3. OTHER POSSIBILITIES
   - Mention alternatives without minimizing the primary concern

4. ACTION
   - Clear guidance on urgency based on tier:
     * EMERGENCY tier: "Call 911 immediately" or "Go to emergency room now"
     * URGENT tier: "Seek medical evaluation today" (not "within 24 hours")
     * ROUTINE tier: "Monitor symptoms" or "Schedule appointment if worsening"
   - No probabilities
   - No "wait and see" if red flags are present

––––––––––––––––––––
PROHIBITED BEHAVIOR
––––––––––––––––––––

- Do NOT say "low severity" in the presence of surgical patterns
- Do NOT provide percentage likelihoods
- Do NOT speculate about BMI, lifestyle, or irrelevant demographics
- Do NOT provide false reassurance
- Do NOT overwhelm with internal reasoning or scoring details

––––––––––––––––––––
SAFETY PRINCIPLE
––––––––––––––––––––

If uncertain between a benign explanation and a potentially serious one:
ALWAYS prioritize ruling out the serious condition.

––––––––––––––––––––
CLINICAL CONTEXT
––––––––––––––––––––
{patient_context}

Original symptoms: {case_context.initial_symptoms}
Organ system: {case_context.organ_system}
Severity score: {case_context.severity_score} ({', '.join([f'{k}={v}' for k, v in case_context.severity_factors.items()])})
Urgency tier: {case_context.urgency_tier.upper()}

{"🚨 EMERGENCY (RED) - Call 911 immediately" if case_context.urgency_tier == "emergency" else "⚠️ URGENT (AMBER) - Same-day evaluation needed" if case_context.urgency_tier == "urgent" else "✓ ROUTINE (GREEN) - Monitor or schedule"}

**OUTPUT FORMAT** (Keep responses SHORT and ACTIONABLE):

{"**GREETING**" if is_first_symptom_response else ""}
{"Thank you for sharing your symptoms." if is_first_symptom_response else ""}

**SUMMARY**
[1-2 sentences: Concern level and what pattern suggests]

**PRIMARY CONCERN**
[Condition name] — [One sentence: why this pattern matches]

**OTHER POSSIBILITIES**
• [Alternative] — [Brief reasoning]
• [If applicable] — [Brief reasoning]

**ACTION**
{f"Call 911 immediately or go to the nearest emergency room." if case_context.urgency_tier == "emergency" else f"Seek medical evaluation today at an urgent care or emergency department." if case_context.urgency_tier == "urgent" else "[Monitor symptoms and schedule appointment if worsening or persistent]"}

**DISCLAIMER:** This is not a diagnosis. Professional evaluation is required."""
        
        # Build context-aware message for AI
        if is_new_case:
            ai_input = message
        else:
            ai_input = f"Original symptoms: {case_context.initial_symptoms}\n\nFollow-up response: {message}\n\nProvide assessment maintaining consistency with original symptoms only."
        
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": ai_input}
            ],
            max_tokens=400,
            temperature=0.5  # Lower temp for consistency
        )
        
        ai_response = response.choices[0].message.content
        
        # SAFETY GATE: Remove any emojis from AI response (unprofessional in medical context)
        import re
        emoji_pattern = re.compile("["
            u"\U0001F600-\U0001F64F"  # emoticons
            u"\U0001F300-\U0001F5FF"  # symbols & pictographs
            u"\U0001F680-\U0001F6FF"  # transport & map symbols
            u"\U0001F1E0-\U0001F1FF"  # flags (iOS)
            u"\U00002702-\U000027B0"
            u"\U000024C2-\U0001F251"
            "]+", flags=re.UNICODE)
        ai_response = emoji_pattern.sub(r'', ai_response)
        
        # Save AI response to Firestore
        case_context.save_message_to_firestore(user_id, "assistant", ai_response)
        
        # Update conversation state in Firestore
        case_context.save_to_firestore(user_id)
        
        result = {
            "success": True,
            "response": ai_response,
            "emergency": case_context.is_emergency(),  # Boolean for backward compatibility
            "urgency_tier": case_context.urgency_tier,  # NEW: Three-tier system
            "emergency_level": case_context.urgency_tier,  # Alias for compatibility
            "session_id": session_id,
            "message_received": message,
            "severity_score": case_context.severity_score,
            "severity_factors": case_context.severity_factors
        }
        
        # Optionally include voice response (disabled by default for speed)
        if include_voice:
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_file:
                    audio_path = temp_file.name
                
                text_to_speech_with_gtts(ai_response, audio_path)
                result["audio_file"] = audio_path
            except Exception as e:
                logger.warning(f"Voice generation failed: {e}")
                # Continue without voice if it fails
        
        return result
        
    except Exception as e:
        logger.error(f"Error in AI chat: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Detailed health check with component status"""
    try:
        # Check if required environment variables are set
        groq_api_key = os.environ.get("GROQ_API_KEY")
        eleven_api_key = os.environ.get("ELEVEN_API_KEY")
        smtp_configured = bool(os.environ.get("SMTP_EMAIL") and os.environ.get("SMTP_PASSWORD"))
        
        return {
            "status": "healthy",
            "components": {
                "groq_api": "configured" if groq_api_key else "missing_key",
                "elevenlabs_api": "configured" if eleven_api_key else "missing_key",
                "firestore": "connected" if db else "not_configured",
                "email_otp": "configured" if smtp_configured else "dev_mode",
                "image_analysis": "available",
                "speech_to_text": "available",
                "text_to_speech": "available",
                "chat": "available"
            },
            "endpoints": [
                "/api/analyze-image",
                "/api/text-to-speech", 
                "/api/speech-to-text",
                "/api/chat",
                "/api/conversations",
                "/api/conversation/{session_id}",
                "/api/auth/send-otp",
                "/api/auth/verify-otp",
                "/api/auth/signup-with-otp",
                "/api/auth/resend-otp",
                "/api/auth/check-email",
                "/api/health"
            ]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/conversations")
async def get_user_conversations(user_id: str = "anonymous"):
    """Get all conversations for a user"""
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured")
    
    try:
        conversations_ref = db.collection('users').document(user_id).collection('conversations')
        conversations = conversations_ref.order_by('createdAt', direction=firestore.Query.DESCENDING).stream()
        
        result = []
        for conv in conversations:
            data = conv.to_dict()
            result.append({
                "sessionId": data.get("sessionId"),
                "initialSymptoms": data.get("initialSymptoms"),
                "emergencyLevel": data.get("emergencyLevel"),
                "severityScore": data.get("severityScore"),
                "createdAt": data.get("createdAt"),
                "updatedAt": data.get("updatedAt")
            })
        
        return {"success": True, "conversations": result}
    except Exception as e:
        logger.error(f"Failed to fetch conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/conversation/{session_id}")
async def get_conversation_details(session_id: str, user_id: str = "anonymous"):
    """Get full conversation details including messages"""
    if db is None:
        raise HTTPException(status_code=503, detail="Firestore not configured")
    
    try:
        # Get conversation metadata
        conv_ref = db.collection('users').document(user_id).collection('conversations').document(session_id)
        conv_doc = conv_ref.get()
        
        if not conv_doc.exists:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Get all messages
        messages_ref = conv_ref.collection('messages').order_by('timestamp')
        messages = messages_ref.stream()
        
        message_list = []
        for msg in messages:
            msg_data = msg.to_dict()
            message_list.append({
                "role": msg_data.get("role"),
                "content": msg_data.get("content"),
                "timestamp": msg_data.get("timestamp"),
                "emergencyLevel": msg_data.get("emergencyLevel"),
                "severityScore": msg_data.get("severityScore")
            })
        
        return {
            "success": True,
            "conversation": conv_doc.to_dict(),
            "messages": message_list
        }
    except Exception as e:
        logger.error(f"Failed to fetch conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/api/auth/send-otp")
async def send_otp(email: str = Form(...)):
    """
    Send OTP to user's email for verification
    Used for signup and login
    """
    try:
        # Validate email format
        if '@' not in email or '.' not in email:
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Generate OTP
        otp = OTPService.generate_otp()
        
        # Store OTP
        OTPService.store_otp(email, otp)
        
        # Send OTP via email
        success = email_service.send_otp_email(email, otp)
        
        # Check if SMTP is configured
        smtp_configured = bool(os.environ.get("SMTP_EMAIL") and os.environ.get("SMTP_PASSWORD"))
        
        if success:
            return {
                "success": True,
                "message": f"OTP sent to {email}. Please check your inbox." if smtp_configured else f"DEV MODE: Auto-verification enabled. Use any 6 digits.",
                "expiresIn": f"{10} minutes",
                "devMode": not smtp_configured,
                "otp": otp if not smtp_configured else None  # Only include in response if dev mode
            }
        else:
            # In development mode without SMTP, OTP is logged to console
            return {
                "success": True,
                "message": f"DEV MODE: Auto-verification enabled. Use any 6 digits.",
                "expiresIn": f"{10} minutes",
                "devMode": True,
                "otp": otp  # Include OTP in response for dev mode
            }
    
    except Exception as e:
        logger.error(f"Failed to send OTP: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/verify-otp")
async def verify_otp(email: str = Form(...), otp: str = Form(...)):
    """
    Verify OTP entered by user
    Returns success status and message
    """
    try:
        # Verify OTP
        success, message = OTPService.verify_otp(email, otp)
        
        if success:
            # Mark email as verified in Firebase (if user exists)
            firebase_user = FirebaseAuthService.get_user_by_email(email)
            if firebase_user:
                FirebaseAuthService.verify_email_in_firebase(email)
            
            return {
                "success": True,
                "message": message,
                "email": email,
                "verified": True
            }
        else:
            return {
                "success": False,
                "message": message,
                "verified": False
            }
    
    except Exception as e:
        logger.error(f"OTP verification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/signup-with-otp")
async def signup_with_otp(
    email: str = Form(...),
    password: str = Form(...),
    displayName: str = Form(...),
    otp: str = Form(...)
):
    """
    Complete signup after OTP verification
    Creates Firebase user account
    """
    try:
        # First verify OTP
        success, message = OTPService.verify_otp(email, otp)
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        # Check if user already exists
        existing_user = FirebaseAuthService.get_user_by_email(email)
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists with this email")
        
        # Create Firebase user
        result = FirebaseAuthService.create_user_with_email(email, password, displayName)
        
        if result['success']:
            # Mark as verified since OTP was confirmed
            FirebaseAuthService.verify_email_in_firebase(email)
            
            return {
                "success": True,
                "message": "Account created successfully!",
                "uid": result['uid'],
                "email": result['email']
            }
        else:
            raise HTTPException(status_code=400, detail=result['error'])
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/resend-otp")
async def resend_otp(email: str = Form(...)):
    """
    Resend OTP if user didn't receive or it expired
    """
    try:
        # Clean up old OTP
        if email in OTPService.otp_store:
            del OTPService.otp_store[email]
        
        # Generate new OTP
        otp = OTPService.generate_otp()
        OTPService.store_otp(email, otp)
        
        # Send new OTP
        success = email_service.send_otp_email(email, otp)
        
        return {
            "success": True,
            "message": f"New OTP sent to {email}",
            "expiresIn": f"{10} minutes"
        }
    
    except Exception as e:
        logger.error(f"Failed to resend OTP: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/check-email")
async def check_email_exists(email: str):
    """
    Check if email already exists in Firebase
    Used to determine if user should login or signup
    """
    try:
        user = FirebaseAuthService.get_user_by_email(email)
        
        if user:
            return {
                "exists": True,
                "email_verified": user['email_verified'],
                "display_name": user.get('display_name')
            }
        else:
            return {
                "exists": False
            }
    
    except Exception as e:
        return {
            "exists": False
        }

@app.post("/api/auth/login")
async def login(
    email: str = Form(...),
    password: str = Form(...)
):
    """
    Login with email and password
    Note: Firebase Admin SDK cannot verify passwords directly,
    so we return user data if account exists. Frontend should use Firebase Client SDK for actual password verification.
    """
    try:
        # Check if user exists
        user = FirebaseAuthService.get_user_by_email(email)
        
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Check if email is verified
        if not user['email_verified']:
            raise HTTPException(status_code=403, detail="Email not verified. Please verify your email first.")
        
        # Return user data
        # NOTE: In production, frontend should use Firebase Client SDK to verify password
        # Firebase Admin SDK does not have password verification capability
        return {
            "success": True,
            "message": "User authenticated",
            "user": {
                "uid": user['uid'],
                "email": user['email'],
                "displayName": user.get('display_name'),
                "emailVerified": user['email_verified']
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/forgot-password")
async def forgot_password(email: str = Form(...)):
    """
    Send password reset OTP to user's email
    """
    try:
        # Check if user exists
        user = FirebaseAuthService.get_user_by_email(email)
        
        if not user:
            # Don't reveal if email exists for security
            return {
                "success": True,
                "message": "If an account exists with this email, you will receive a password reset code."
            }
        
        # Generate OTP for password reset
        otp = OTPService.generate_otp()
        OTPService.store_otp(email, otp)
        
        # Send OTP via email
        success = email_service.send_password_reset_email(email, otp)
        
        return {
            "success": True,
            "message": "If an account exists with this email, you will receive a password reset code.",
            "expiresIn": f"{10} minutes"
        }
    
    except Exception as e:
        logger.error(f"Forgot password failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/auth/reset-password")
async def reset_password(
    email: str = Form(...),
    otp: str = Form(...),
    new_password: str = Form(...)
):
    """
    Reset password using OTP verification
    """
    try:
        # Verify OTP
        success, message = OTPService.verify_otp(email, otp)
        
        if not success:
            raise HTTPException(status_code=400, detail=message)
        
        # Check if user exists
        user = FirebaseAuthService.get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Reset password in Firebase
        reset_success = FirebaseAuthService.reset_password(email, new_password)
        
        if reset_success:
            return {
                "success": True,
                "message": "Password reset successfully! You can now login with your new password."
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to reset password")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password reset failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

        logger.error(f"Failed to fetch conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
