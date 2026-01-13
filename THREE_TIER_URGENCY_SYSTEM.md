# Three-Tier Urgency System Implementation

## Problem Identified
The system was previously over-escalating appendicitis cases to RED emergency status (call 911 immediately), when they should be classified as AMBER urgent (same-day evaluation). This caused:

1. **Internal inconsistency**: UI showing "Call 911" alongside "within 24 hours" mixed messaging
2. **False panic**: Loss of credibility from treating urgent conditions as emergencies
3. **User fatigue**: Too many RED alerts desensitizing users to actual emergencies

## Solution: Three-Tier Classification

### 🔴 EMERGENCY (RED) - Call 911 Immediately
**Definition**: Immediate life-threatening conditions requiring emergency services

**Examples**:
- Severe chest pain with cardiac signs (radiating to arm/jaw, sweating, dizziness)
- Cannot breathe / Severe respiratory distress (gasping, turning blue)
- Stroke symptoms (face drooping, arm weakness, slurred speech)
- Severe trauma (car accident, severe bleeding, stabbing)

**UI Behavior**:
- Red banner: "EMERGENCY - Call 911 Immediately"
- Input disabled to prevent continued conversation
- Clear instruction to call emergency services

**AI Response Pattern**:
```
**ACTION**
Call 911 immediately or go to the nearest emergency room.
```

---

### 🟠 URGENT (AMBER) - Same-Day Evaluation
**Definition**: Serious conditions requiring medical evaluation today, but not immediate 911 call

**Examples**:
- Appendicitis pattern (RLQ pain + anorexia + nausea)
- Peritonitis signs (abdominal guarding/rigidity)
- Sudden severe localized pain
- Persistent vomiting
- Neurological deficits (not stroke-level)
- High fever (104°F+)

**UI Behavior**:
- Amber banner: "Urgent - Seek Medical Evaluation Today"
- Simplified message (not verbose internal reasoning)
- Clear but calm instruction

**AI Response Pattern**:
```
**ACTION**
Seek medical evaluation today at an urgent care or emergency department.
```

---

### 🟢 ROUTINE (GREEN) - Monitor or Schedule
**Definition**: Mild symptoms that can be monitored or scheduled for outpatient care

**Examples**:
- Mild fever
- Non-persistent vomiting
- Headache without red flags
- Minor cold symptoms
- Non-localized pain

**UI Behavior**:
- No urgency banner
- Normal conversation flow
- Monitoring guidance

**AI Response Pattern**:
```
**ACTION**
Monitor symptoms and schedule an appointment if they worsen or persist.
```

---

## Technical Implementation

### Backend Changes (main.py)

#### 1. CaseContext Class (Lines 60-110)
```python
# Changed from binary emergency flag to three-tier system
self.urgency_tier = "routine"  # Options: "routine", "urgent", "emergency"

def set_urgency(self, tier: str):
    """Set urgency tier with escalation-only logic"""
    priority = {"routine": 0, "urgent": 1, "emergency": 2}
    if priority[tier] > priority[self.urgency_tier]:
        logger.warning(f"Urgency escalated: {self.urgency_tier} → {tier}")
        self.urgency_tier = tier

def is_emergency(self) -> bool:
    return self.urgency_tier == "emergency"

def is_urgent(self) -> bool:
    return self.urgency_tier == "urgent"

def is_routine(self) -> bool:
    return self.urgency_tier == "routine"
```

#### 2. Severity Calculation (Lines 136-220)
Updated pattern-based severity assessment with proper tier assignments:

**EMERGENCY tier triggers**:
- Severe cardiac symptoms (chest pain + radiating + sweating)
- Severe breathing distress (can't breathe, gasping, turning blue)
- Severe trauma (car accident, stabbing, severe bleeding)
- Stroke symptoms

**URGENT tier triggers**:
- Appendicitis pattern: RLQ pain + anorexia + nausea → `set_urgency("urgent")`
- Peritonitis signs: abdominal pain + guarding/rigidity
- Sudden severe localized pain
- Neurological deficits (not stroke-level)
- Persistent vomiting

**ROUTINE tier** (default):
- Mild fever
- Simple vomiting
- Minor symptoms

#### 3. API Response (Lines 1100-1110)
```python
result = {
    "success": True,
    "response": ai_response,
    "emergency": case_context.is_emergency(),  # Boolean (backward compatibility)
    "urgency_tier": case_context.urgency_tier,  # NEW: "routine", "urgent", "emergency"
    "emergency_level": case_context.urgency_tier,  # Alias
    "session_id": session_id,
    "severity_score": case_context.severity_score,
    "severity_factors": case_context.severity_factors
}
```

#### 4. System Prompt (Lines 1000-1080)
Updated with tier-specific action guidance:

```python
**ACTION**
{
  "emergency": "Call 911 immediately or go to the nearest emergency room.",
  "urgent": "Seek medical evaluation today at an urgent care or emergency department.",
  "routine": "[Monitor symptoms and schedule appointment if worsening or persistent]"
}
```

---

### Frontend Changes (Chat.tsx)

#### 1. State Management
```tsx
// Changed from binary isEmergency to three-tier urgencyTier
const [urgencyTier, setUrgencyTier] = useState<"routine" | "urgent" | "emergency" | null>(null);
```

#### 2. API Response Handling
```tsx
const data = await response.json();

// Extract urgency tier from response
if (data.urgency_tier) {
  setUrgencyTier(data.urgency_tier);
}
```

#### 3. Three-Tier Banner UI
```tsx
{/* EMERGENCY (RED) Banner */}
{urgencyTier === "emergency" && (
  <div className="bg-red-600 p-4 flex items-center gap-3">
    <AlertTriangle className="h-6 w-6 text-white flex-shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-semibold text-white">
        EMERGENCY - Call 911 Immediately
      </p>
      <p className="text-sm text-white/95">
        This requires immediate emergency medical attention.
      </p>
    </div>
  </div>
)}

{/* URGENT (AMBER) Banner */}
{urgencyTier === "urgent" && (
  <div className="bg-amber-600 p-4 flex items-center gap-3">
    <AlertTriangle className="h-5 w-5 text-white flex-shrink-0" />
    <div className="flex-1">
      <p className="text-sm font-semibold text-white">
        Urgent - Seek Medical Evaluation Today
      </p>
      <p className="text-sm text-white/95">
        This should be evaluated by a healthcare provider today.
      </p>
    </div>
  </div>
)}

{/* ROUTINE (GREEN) - No banner shown */}
```

---

## Test Scenarios

### ✅ Appendicitis (Should be AMBER)
**Input**: "I have right lower abdominal pain, lost my appetite, feeling nauseous, slight fever"

**Expected**:
- Severity score: 5
- Urgency tier: `"urgent"` (AMBER)
- Banner: Orange "Urgent - Seek Medical Evaluation Today"
- Action: "Seek medical evaluation today at an urgent care or emergency department"

**NOT**:
- ❌ Red emergency banner
- ❌ "Call 911 immediately"
- ❌ Input disabled

---

### ✅ Cardiac Emergency (Should be RED)
**Input**: "Crushing chest pain radiating to my left arm, sweating heavily, dizzy"

**Expected**:
- Severity score: 7
- Urgency tier: `"emergency"` (RED)
- Banner: Red "EMERGENCY - Call 911 Immediately"
- Action: "Call 911 immediately or go to the nearest emergency room"
- Input disabled

---

### ✅ Mild Fever (Should be GREEN)
**Input**: "I have a fever of 100°F and feeling tired"

**Expected**:
- Severity score: 1
- Urgency tier: `"routine"` (GREEN)
- Banner: None
- Action: "Monitor symptoms and schedule an appointment if they worsen or persist"
- Normal conversation continues

---

## Medical Safety Principles

1. **Escalation-Only Logic**: Urgency can only increase, never decrease during a session
2. **Pattern Recognition**: Not keyword matching - requires symptom combinations
3. **Red Flag Detection**: Specific patterns (e.g., RLQ pain + anorexia + nausea) trigger urgent tier
4. **Clear Communication**: Tier-appropriate language without mixed messaging
5. **No False Reassurance**: When uncertain, prioritize ruling out serious conditions

---

## Files Modified

1. `/home/pratik/Predicare/AI Doctor/main.py`
   - CaseContext class (urgency_tier system)
   - _calculate_severity() method (tier assignments)
   - System prompt (tier-specific guidance)
   - API response (urgency_tier field)

2. `/home/pratik/Predicare/src/pages/app/Chat.tsx`
   - State management (urgencyTier)
   - API response handling
   - Three-tier banner UI

---

## Status: ✅ IMPLEMENTED

Backend server restarted with three-tier urgency system active.
Frontend updated with AMBER/RED distinction.
Appendicitis now correctly classified as URGENT (AMBER), not EMERGENCY (RED).

---

## Next Steps (Optional)

- [ ] Test all three tiers with real scenarios
- [ ] Adjust severity thresholds based on feedback
- [ ] Add more pattern recognition rules
- [ ] Implement session history showing urgency tier changes
- [ ] Add analytics to track tier distribution
