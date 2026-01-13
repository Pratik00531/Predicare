# if you dont use pipenv uncomment the following:
#from dotenv import load_dotenv
#load_dotenv()

#Step1: Setup GROQ API key
import os
import logging

logger = logging.getLogger(__name__)

GROQ_API_KEY=os.environ.get("GROQ_API_KEY")

#Step2: Convert image to required format
import base64


#image_path="acne.jpg"

def encode_image(image_path):   
    image_file=open(image_path, "rb")
    return base64.b64encode(image_file.read()).decode('utf-8')

#Step3: Setup Multimodal LLM 
from groq import Groq

query="Is there something wrong with my face?"
# Use the best available vision model from SUPPORTED_VISION_MODELS

# Available Groq models (updated January 2026)
# Priority order: best/fastest first
SUPPORTED_VISION_MODELS = [
    "llama-3.2-90b-vision-preview",  # Best quality vision model
    "llava-v1.5-7b-4096-preview"     # Fallback vision model
]

SUPPORTED_TEXT_MODELS = [
    "llama-3.1-8b-instant",      # Fastest for text responses
    "llama-3.1-70b-versatile",   # More capable but slower
    "mixtral-8x7b-32768"         # Alternative option
]

def get_best_available_model(model_type="text"):
    """Get the best available model based on type"""
    if model_type == "vision":
        return SUPPORTED_VISION_MODELS[0]  # Return the first (usually best) option
    else:
        return SUPPORTED_TEXT_MODELS[0]

def analyze_image_with_query(query, model, encoded_image):
    client=Groq()  
    
    # Professional medical image analysis prompt
    base_prompt = """You are a professional medical AI assistant analyzing this image. Provide your response in this EXACT structure:

**SUMMARY** (1-2 sentences)
[Brief assessment of what you observe and urgency level]

**MOST LIKELY EXPLANATION**
[Primary assessment with clear reasoning]
Example: "This pattern is most consistent with [condition], which typically presents in [demographic] with [characteristics]."

**OTHER CONDITIONS CONSIDERED** (Ranked)
• Less likely: [Condition] - [why less probable]
• Rare but serious: [Condition] - [why it can't be ignored]

**DEMOGRAPHIC CONSIDERATIONS**
[If age/sex/body type visible or mentioned, explain relevance]
If not apparent: "Information about age, sex, and medical history would help refine this assessment."

**WHAT MAKES THIS SERIOUS/NOT SERIOUS**
[Clear explanation of actual risk]

**FOLLOW-UP QUESTIONS** (Maximum 3 decisive questions)
"To provide a more accurate assessment, I need to ask:"
1. [Question that changes differential]
2. [Question about onset/duration]
3. [Question about symptoms or triggers]

**CLEAR ACTION**
[Specific, unambiguous next step]

**BOUNDARY STATEMENT**
"This visual assessment does not replace an in-person medical evaluation."

CRITICAL: Use confidence-dampened language. Say "most consistent with" NOT "diagnosis is".

User's specific question: """
    
    enhanced_query = base_prompt + query
    
    # Build image URL separately to avoid f-string nesting issues
    image_url = "data:image/jpeg;base64," + encoded_image
    
    messages=[
        {
            "role": "user",
            "content": [
                {
                    "type": "text", 
                    "text": enhanced_query
                },
                {
                    "type": "image_url",
                    "image_url": {
                        "url": image_url,
                    },
                },
            ],
        }]
    
    # Use the best available vision model with fallback
    vision_model = model or SUPPORTED_VISION_MODELS[0]
    
    try:
        chat_completion = client.chat.completions.create(
            messages=messages,
            model=vision_model,
            max_tokens=500,  # Allow longer responses for image analysis
            temperature=0.7
        )
    except Exception as e:
        logger.error(f"Vision model {vision_model} failed: {e}")
        # Try fallback model if primary fails
        if len(SUPPORTED_VISION_MODELS) > 1:
            vision_model = SUPPORTED_VISION_MODELS[1]
            logger.info(f"Retrying with fallback model: {vision_model}")
            chat_completion = client.chat.completions.create(
                messages=messages,
                model=vision_model,
                max_tokens=500,
                temperature=0.7
            )
        else:
            raise

    return chat_completion.choices[0].message.content