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

# Import our AI doctor components
from brain_of_the_doctor import analyze_image_with_query, encode_image
from voice_of_the_doctor import text_to_speech_with_gtts, text_to_speech_with_elevenlabs
from voice_of_the_patient import transcribe_with_groq, record_audio

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CONVERSATION STATE MANAGEMENT (Critical for clinical safety)
# Stores case context to prevent context collapse
conversation_state = {}

class CaseContext:
    """
    Locks clinical context once a case begins.
    Prevents context collapse and symptom drift.
    Implements dynamic re-prioritization and severity scoring.
    """
    def __init__(self, session_id: str, initial_symptoms: str):
        self.session_id = session_id
        self.initial_symptoms = initial_symptoms
        self.emergency_level = "none"
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
        return self.emergency_level in ["critical", "urgent"]
    
    def set_emergency(self, level: str):
        """Emergency state is ONE-WAY - can only escalate, never de-escalate"""
        if level == "critical":
            self.emergency_level = "critical"
        elif level == "urgent" and self.emergency_level != "critical":
            self.emergency_level = "urgent"
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
        SEVERITY SCORING SYSTEM
        Replaces narrative severity with computed scores
        """
        text_lower = text.lower()
        self.severity_score = 0
        self.severity_factors = {}
        
        # Sudden onset symptoms (+2)
        if any(kw in text_lower for kw in ["sudden", "suddenly", "acute", "abrupt"]):
            self.severity_score += 2
            self.severity_factors["sudden_onset"] = 2
            
        # Fever (+1)
        if any(kw in text_lower for kw in ["fever", "temperature", "hot", "chills"]):
            self.severity_score += 1
            self.severity_factors["fever"] = 1
            
        # Neurological symptoms (+3)
        if any(kw in text_lower for kw in ["headache", "confusion", "weakness", "numbness", "seizure", "neck stiffness", "vision", "speech"]):
            self.severity_score += 3
            self.severity_factors["neurological"] = 3
            
        # Trauma (+3)
        if any(kw in text_lower for kw in ["trauma", "injury", "accident", "fall", "hit", "struck"]):
            self.severity_score += 3
            self.severity_factors["trauma"] = 3
            
        # Vomiting (+1)
        if any(kw in text_lower for kw in ["vomit", "vomiting", "throwing up"]):
            self.severity_score += 1
            self.severity_factors["vomiting"] = 1
            
        # Chest pain (+3)
        if any(kw in text_lower for kw in ["chest pain", "crushing", "radiating"]):
            self.severity_score += 3
            self.severity_factors["chest_pain"] = 3
            
        # Breathing difficulty (+2)
        if any(kw in text_lower for kw in ["can't breathe", "difficulty breathing", "shortness of breath", "dyspnea"]):
            self.severity_score += 2
            self.severity_factors["breathing_difficulty"] = 2
            
        # Update emergency level based on score
        if self.severity_score >= 5:
            self.set_emergency("critical")
        elif self.severity_score >= 3:
            self.set_emergency("urgent")
            
        logger.info(f"Severity score: {self.severity_score}, Factors: {self.severity_factors}")
    
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
        if self.emergency_level == "critical":
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

@app.post("/api/chat")
async def chat_with_ai_doctor(
    message: str = Form(...),
    session_id: str = Form(default="default"),
    include_voice: bool = Form(default=False)
):
    """
    Medical consultation with conversation state management
    """
    try:
        # CASE LOCKING: Check if this is a new case or continuation
        is_new_case = session_id not in conversation_state
        
        if is_new_case:
            # Initialize new case context
            case_context = CaseContext(session_id, message)
            case_context.organ_system = case_context.detect_organ_system(message)
            conversation_state[session_id] = case_context
            logger.info(f"New case started: {session_id}, Organ system: {case_context.organ_system}")
        else:
            # Continuing existing case
            case_context = conversation_state[session_id]
            case_context.add_follow_up(message)
            logger.info(f"Continuing case: {session_id}, Emergency: {case_context.emergency_level}")
        
        # RULE-BASED EMERGENCY DETECTION (Override AI)
        emergency_status = detect_emergency(message if is_new_case else case_context.initial_symptoms)
        
        # EMERGENCY STATE PERSISTENCE: One-way only
        case_context.set_emergency(emergency_status["level"])
        emergency_status = detect_emergency(message)
        
        # TIERED EMERGENCY RESPONSE SYSTEM
        if case_context.is_emergency():
            emergency_level = case_context.emergency_level
            
            # 🟥 FIRST EMERGENCY MESSAGE (Full detailed response)
            if not case_context.emergency_shown:
                case_context.emergency_shown = True
                emergency_response = f"""🚨 {'CRITICAL ' if emergency_level == 'critical' else 'URGENT '}MEDICAL SITUATION 🚨

**ORIGINAL SYMPTOMS:** {case_context.initial_symptoms}

**EMERGENCY STATUS:** This case was flagged as {emergency_level.upper()} and remains in emergency status.

**IMMEDIATE ACTION REQUIRED:**
{'Call your local emergency number or go to the nearest emergency department immediately.' if emergency_level == 'critical' else 'Seek medical attention within 24 hours.'}

This situation requires immediate professional medical evaluation. Follow-up questions or additional information do NOT change the emergency status. Only a healthcare professional can clear this status after in-person evaluation.

**BOUNDARY STATEMENT**
This is a medical information assistant. This assessment does not replace emergency medical services."""
            
            # 🟨 USER ACKNOWLEDGES ("I'm going", "Ok")
            elif case_context.is_user_acknowledging(message):
                emergency_response = """Understood. Please go to the nearest emergency department immediately.

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
            
            return {
                "success": True,
                "response": emergency_response,
                "emergency": True,
                "emergency_level": emergency_level,
                "session_id": session_id,
                "message_received": message
            }
        
        # For non-emergency consultations with context locking
        from groq import Groq
        
        client = Groq()
        
        # Professional medical consultation prompt with CONTEXT LOCKING
        risk_weight_explanation = case_context.get_risk_weight_explanation()
        suppress_questions = case_context.should_suppress_questions()
        
        system_prompt = f"""You are a medical information assistant (NOT a doctor). Your responses must follow this EXACT structure:

**CLINICAL CONTEXT (LOCKED):**
Original symptoms: {case_context.initial_symptoms}
Organ system: {case_context.organ_system}
Severity score: {case_context.severity_score} ({', '.join([f'{k}={v}' for k, v in case_context.severity_factors.items()])})
{'Follow-up responses: ' + ' | '.join(case_context.symptom_history[1:]) if len(case_context.symptom_history) > 1 else 'This is the initial consultation.'}

CRITICAL SAFETY RULES:
1. Base ALL assessment on ORIGINAL symptoms above - NO reinterpretation
2. Follow-ups can ONLY confirm/deny/clarify original symptoms
3. NEVER introduce new symptoms (no chest pain, burning, dysphagia unless user stated)
4. NEVER switch organ systems (locked to {case_context.organ_system})
5. Be SPECIFIC - avoid overgeneral claims (e.g., "trauma increases infection risk" is TOO VAGUE)

**SUMMARY** (1-2 sentences, defensible)
[Brief assessment with severity score justification: "Based on severity score of {case_context.severity_score}, this is [categorization]..."]

**MOST LIKELY EXPLANATION**
"The most consistent explanation for [exact original symptoms] is [condition], which typically presents with [be specific about mechanism, not just listing symptoms]."

**OTHER CONDITIONS CONSIDERED** (Ranked by probability)
{risk_weight_explanation if risk_weight_explanation else ""}
• Most likely (probability ~X%): [Condition] - [specific reason based on original symptoms]
• Less likely (probability ~Y%): [Condition] - [why less probable - be precise]
• Rare but serious (probability ~Z%): [Condition] - [cannot be excluded because...]

{"**DIFFERENTIAL RANKING EXPLANATION**" if risk_weight_explanation else ""}
{risk_weight_explanation if risk_weight_explanation else ""}

**ORGAN SYSTEM CONSISTENCY:**
All differentials above remain within {case_context.organ_system} pathology. Cross-system diagnoses are explicitly excluded.

**DEMOGRAPHIC CONSIDERATIONS**
[ONLY if age/sex mentioned: explain specific relevance. If uncertain, state uncertainty instead of making vague claims]

**WHAT MAKES THIS {"SERIOUS" if case_context.severity_score >= 3 else "NON-SERIOUS"}**
Severity score {case_context.severity_score}: {', '.join([f'{k} (+{v})' for k, v in case_context.severity_factors.items()])}
[Explain why this score translates to urgency level]

{"**IMMEDIATE ESCALATION REQUIRED - NO FURTHER QUESTIONS**" if suppress_questions else "**FOLLOW-UP QUESTIONS**"}
{'''Professional evaluation is required immediately. Do not attempt further self-assessment.''' if suppress_questions else '''(Maximum 3 decisive questions - SKIP if emergency locked)
"To refine the assessment:"
1. [Specific yes/no question about original symptom characteristic]
2. [Timeline question about original symptom progression]
3. [Risk factor question directly relevant to top differential]

DO NOT ask questions already answered. Tracked questions: ''' + str(list(case_context.asked_questions)) if not suppress_questions else ''}

**CLEAR ACTION**
[Based on severity score: ≥5=immediate ER, 3-4=urgent care within hours, <3=monitor/schedule appointment]

**BOUNDARY STATEMENT**
"I am a medical information assistant. This information does not replace professional medical evaluation."

HARD GATES (ONE VIOLATION = FAIL):
❌ NEVER add symptoms user didn't state
❌ NEVER make overgeneral medical claims without specificity
❌ NEVER switch organ systems
❌ NEVER ask redundant questions
❌ NEVER use narrative severity - always reference computed score"""
        
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
        
        result = {
            "success": True,
            "response": ai_response,
            "emergency": False,
            "emergency_level": None,
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
        
        return {
            "status": "healthy",
            "components": {
                "groq_api": "configured" if groq_api_key else "missing_key",
                "elevenlabs_api": "configured" if eleven_api_key else "missing_key",
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
                "/api/health"
            ]
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Run the server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
