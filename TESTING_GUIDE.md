# Quick Testing Guide - State Management Validation

## 🎯 Test Case 1: Context Persistence (CRITICAL)

**Objective:** Verify original symptoms persist across multiple messages

### Steps:
1. Open http://localhost:8080
2. First message: "I have severe headache, neck stiffness, and high fever"
3. Wait for response (should flag CRITICAL emergency)
4. Second message: "How serious is this?"
5. Third message: "What should I do?"

### Expected Results:
✅ All responses mention "Original symptoms: severe headache, neck stiffness, high fever"
✅ Emergency status stays CRITICAL in all responses
✅ No new symptoms introduced by AI
✅ Red border persists on all emergency messages

### What to check in logs:
```bash
INFO: New case started: session_xxx, Organ system: neurological
INFO: Continuing case: session_xxx, Emergency: critical
```

---

## 🎯 Test Case 2: Organ System Lock (CRITICAL)

**Objective:** Prevent organ system switching mid-conversation

### Steps:
1. First message: "I have crushing chest pain radiating to my left arm"
2. Wait for response (cardiovascular system locked)
3. Second message: "I also have some stomach discomfort"
4. Check if AI switches to gastrointestinal

### Expected Results:
✅ Organ system locked at "cardiovascular"
✅ AI interprets stomach discomfort as referred pain (cardiac origin)
✅ All differentials stay within cardiovascular pathology
✅ No switch to gastrointestinal system

### What to check in response:
- Look for "Organ system: cardiovascular" in context section
- Differentials should be: cardiac, angina, myocardial infarction
- Should NOT suggest: gastritis, GERD, food poisoning

---

## 🎯 Test Case 3: Emergency Escalation (One-Way)

**Objective:** Verify emergency can escalate but never de-escalate

### Steps:
1. First message: "I have a mild headache"
2. Wait for response (non-emergency)
3. Second message: "Actually, it's the worst headache of my life, came on suddenly"
4. Wait for response (should escalate to CRITICAL)
5. Third message: "I think I'm feeling a bit better now"

### Expected Results:
✅ Initially: non-emergency (blue styling)
✅ After second message: escalates to CRITICAL (red border)
✅ After third message: STAYS CRITICAL (does not de-escalate)
✅ Warning persists: "Emergency status cannot be cleared without professional evaluation"

### What to check in logs:
```bash
INFO: Continuing case: session_xxx, Emergency: critical
# Should NOT see: Emergency: none (after it was critical)
```

---

## 🎯 Test Case 4: Session Isolation

**Objective:** Verify different browser tabs maintain separate contexts

### Steps:
1. Open http://localhost:8080 in Tab 1
2. Send message: "I have chest pain" (cardiovascular)
3. Open http://localhost:8080 in Tab 2 (new session)
4. Send message: "I have headache" (neurological)
5. Return to Tab 1, send follow-up: "How serious is this?"

### Expected Results:
✅ Tab 1: Maintains cardiovascular context
✅ Tab 2: Separate neurological context
✅ No cross-contamination between sessions
✅ Different session IDs in logs

### What to check in logs:
```bash
INFO: New case started: session_123, Organ system: cardiovascular
INFO: New case started: session_456, Organ system: neurological
INFO: Continuing case: session_123, Emergency: urgent  # Tab 1
INFO: Continuing case: session_456, Emergency: none    # Tab 2
```

---

## 🎯 Test Case 5: Symptom Drift Prevention

**Objective:** Ensure AI doesn't introduce symptoms user never mentioned

### Steps:
1. First message: "I have a cough for 3 days"
2. Wait for response
3. Second message: "How long does this usually last?"
4. Check if AI mentions symptoms like "fever", "shortness of breath" that user didn't report

### Expected Results:
✅ AI only discusses "cough" (the original symptom)
✅ No assumptions about fever, breathing difficulty, chest pain unless user mentioned
✅ Follow-up questions ask to CONFIRM symptoms (not assume them)
✅ Example good question: "Do you have any fever?"
✅ Example bad: "Given your fever and cough..." (assumes fever)

---

## 🎯 Test Case 6: Persona Validation

**Objective:** Verify "AI Doctor" persona removed

### Steps:
1. Read initial greeting message
2. Check all AI responses for "AI Doctor" text
3. Verify boundary statements present

### Expected Results:
✅ Greeting says: "I'm a medical information assistant"
✅ NO "I'm your AI Doctor" anywhere
✅ Every response ends with: "I am a medical information assistant. This information does not replace professional medical evaluation."
✅ Header shows: "Medical Information Assistant" (not "AI Medical Consultation")

---

## 🔍 How to Check Backend State

### View conversation state (development only):

Add temporary debug endpoint to `main.py`:
```python
@app.get("/api/debug/state")
async def debug_state():
    """REMOVE IN PRODUCTION - For testing only"""
    return {
        "active_sessions": len(conversation_state),
        "sessions": {
            session_id: {
                "initial_symptoms": ctx.initial_symptoms,
                "organ_system": ctx.organ_system,
                "emergency_level": ctx.emergency_level,
                "message_count": len(ctx.symptom_history)
            }
            for session_id, ctx in conversation_state.items()
        }
    }
```

Then check: `curl http://localhost:8000/api/debug/state`

---

## 🚨 Red Flags (System NOT Working)

If you see any of these, the system is broken:

❌ **Context collapse:** AI response doesn't mention original symptoms
❌ **Emergency de-escalation:** CRITICAL → none in follow-up
❌ **Organ switching:** Neurology → GI mid-conversation
❌ **Symptom invention:** AI mentions symptoms user never said
❌ **Persona leak:** "As an AI Doctor" in responses
❌ **No emergency persistence:** User says "feeling better" and emergency clears

---

## ✅ Green Lights (System Working Correctly)

✅ Every response includes: "Original symptoms: [initial message]"
✅ Emergency messages have red/amber borders
✅ Emergency state persists even when user says "feeling better"
✅ Organ system stays consistent (logged in backend)
✅ Follow-up questions clarify (not assume) symptoms
✅ Boundary statements present: "I am a medical information assistant"
✅ Different tabs maintain separate conversation contexts

---

## 📊 Quick Validation Checklist

Run through this 5-minute test before any demo:

- [ ] Test 1: Context persistence (3 messages deep)
- [ ] Test 2: Organ system lock (try to switch)
- [ ] Test 3: Emergency escalation (can't de-escalate)
- [ ] Test 4: Session isolation (two tabs)
- [ ] Test 5: No symptom drift (AI doesn't invent)
- [ ] Test 6: Persona check (no "AI Doctor")

**If all 6 pass:** ✅ System is safe to demo
**If any fail:** 🚨 DO NOT demo - critical safety issue

---

## 🎓 What Success Looks Like

### Good Response Example:
```
🚨 CRITICAL MEDICAL SITUATION 🚨

**ORIGINAL SYMPTOMS:** severe headache, neck stiffness, high fever

**EMERGENCY STATUS:** This case was flagged as CRITICAL and remains in emergency status.

**IMMEDIATE ACTION REQUIRED:**
CALL 911 OR GO TO EMERGENCY ROOM IMMEDIATELY

This situation requires immediate professional medical evaluation. 
Follow-up questions or additional information do NOT change the emergency status.

**BOUNDARY STATEMENT**
This is a medical information assistant. This assessment does not replace emergency medical services.
```

### Bad Response Example (OLD SYSTEM):
```
Based on your current situation, here are some home remedies you can try...
[No mention of original critical symptoms]
[Emergency status cleared because user said "feeling a bit better"]
```

---

## 🛠️ Troubleshooting

### Problem: Context not persisting
**Check:**
1. Is sessionId being generated? (Check browser console)
2. Is session_id sent to backend? (Check network tab FormData)
3. Is CaseContext created? (Check backend logs for "New case started")

### Problem: Emergency de-escalating
**Check:**
1. `set_emergency()` method - should be one-way
2. `/api/chat` endpoint - should check `case_context.is_emergency()` first
3. Should NOT call `detect_emergency()` on follow-up (only initial)

### Problem: Organ system switching
**Check:**
1. `detect_organ_system()` called only once (on first message)
2. `validate_organ_system_consistency()` prevents changes
3. System prompt includes: "You MUST NOT switch to a different organ system"

---

## 📝 Notes

- Tests should be run with **fresh browser sessions** (clear cache between tests)
- Check **both frontend and backend logs** for validation
- **Temperature 0.5** means some response variation is normal (expected)
- Session state is **in-memory** (lost on server restart - acceptable for demo)
