import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Send, 
  Image as ImageIcon, 
  Mic,
  AlertTriangle,
  MessageSquare,
  AlertCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
}

interface Session {
  id: string;
  title: string;
  date: Date;
  messages: Message[];
}

interface UserProfile {
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  height: number;
  weight: number;
  medicalConditions: string;
  medications: string;
  allergies: string;
}

// Helper function to detect if content is a structured assessment
const isStructuredAssessment = (content: string): boolean => {
  return content.includes("**SUMMARY**") || 
         content.includes("**PRIMARY CONCERN**") ||
         content.includes("**ACTION**");
};

// Helper function to parse structured assessment content
const parseAssessment = (content: string) => {
  const sections: Record<string, string> = {};
  
  // Remove greeting if present
  let cleanContent = content.replace(/\*\*GREETING\*\*[\s\S]*?(?=\*\*|$)/i, '').trim();
  cleanContent = cleanContent.replace(/Thank you for sharing your symptoms\./i, '').trim();
  
  // Extract sections
  const summaryMatch = cleanContent.match(/\*\*SUMMARY\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  const concernMatch = cleanContent.match(/\*\*PRIMARY CONCERN\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  const otherMatch = cleanContent.match(/\*\*OTHER POSSIBILITIES\*\*\s*([\s\S]*?)(?=\*\*|$)/i);
  const actionMatch = cleanContent.match(/\*\*ACTION\*\*\s*([\s\S]*?)(?=\*\*DISCLAIMER|$)/i);
  const disclaimerMatch = cleanContent.match(/\*\*DISCLAIMER:\*\*\s*([\s\S]*?)$/i);
  
  if (summaryMatch) sections.summary = summaryMatch[1].trim();
  if (concernMatch) sections.concern = concernMatch[1].trim();
  if (otherMatch) sections.other = otherMatch[1].trim();
  if (actionMatch) sections.action = actionMatch[1].trim();
  if (disclaimerMatch) sections.disclaimer = disclaimerMatch[1].trim();
  
  return sections;
};

// Assessment Result Panel Component
const AssessmentPanel = ({ content, urgencyTier }: { content: string; urgencyTier: string | null }) => {
  const sections = parseAssessment(content);
  
  // Extract condition name from concern section
  const concernLines = sections.concern?.split('\n') || [];
  const conditionName = concernLines[0]?.replace(/—.*$/, '').trim() || '';
  const conditionReason = concernLines[0]?.replace(/^[^—]*—\s*/, '').trim() || '';
  
  return (
    <div className="max-w-[700px] mx-auto bg-background border border-border rounded-lg shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-start gap-3">
          {urgencyTier === "urgent" ? (
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-1" />
          ) : null}
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {urgencyTier === "urgent" ? "Urgent Medical Evaluation Needed" : "Assessment Complete"}
            </h3>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="px-6 py-5 space-y-6">
        {/* What's concerning */}
        {sections.summary && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">What's concerning</h4>
            <p className="text-[15px] leading-relaxed text-foreground">{sections.summary}</p>
          </div>
        )}
        
        {/* Primary concern */}
        {sections.concern && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Primary concern</h4>
            <div className="space-y-1">
              {conditionName && (
                <p className="text-[15px] font-medium text-foreground">{conditionName}</p>
              )}
              {conditionReason && (
                <p className="text-[15px] leading-relaxed text-foreground/90">{conditionReason}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Other possibilities */}
        {sections.other && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Other possibilities</h4>
            <div className="text-[15px] leading-relaxed text-foreground/90 space-y-1">
              {sections.other.split('\n').map((line, idx) => {
                const cleaned = line.replace(/^[•\-\*]\s*/, '').trim();
                if (!cleaned) return null;
                return <p key={idx}>{cleaned}</p>;
              })}
            </div>
          </div>
        )}
        
        {/* What to do now */}
        {sections.action && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">What to do now</h4>
            <p className="text-[15px] leading-relaxed text-foreground">{sections.action}</p>
          </div>
        )}
      </div>
      
      {/* Footer disclaimer */}
      {sections.disclaimer && (
        <div className="px-6 py-3 bg-muted/30 border-t border-border">
          <p className="text-xs text-muted-foreground">{sections.disclaimer}</p>
        </div>
      )}
    </div>
  );
};

export default function Chat() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [urgencyTier, setUrgencyTier] = useState<"routine" | "urgent" | "emergency" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const startNewSession = () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: "New Assessment",
      date: new Date(),
      messages: [],
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setMessages([]);
    setUrgencyTier(null);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || urgencyTier === "emergency") return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      // Get user profile data from localStorage
      const savedProfile = localStorage.getItem('userProfile');
      let profileData: Partial<UserProfile> = {};
      
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile);
        profileData = {
          age: parsed.age,
          gender: parsed.gender,
          height: parsed.height,
          weight: parsed.weight,
          medicalConditions: parsed.medicalConditions,
          medications: parsed.medications,
          allergies: parsed.allergies
        };
      }

      // Call the actual backend API
      const formData = new FormData();
      formData.append("message", currentInput);
      formData.append("session_id", activeSessionId || "default");
      formData.append("user_id", user?.uid || "anonymous");
      formData.append("include_voice", "false");
      
      // Add profile data if available
      if (profileData.age) formData.append("age", profileData.age.toString());
      if (profileData.gender) formData.append("gender", profileData.gender);
      if (profileData.height) formData.append("height", profileData.height.toString());
      if (profileData.weight) formData.append("weight", profileData.weight.toString());
      if (profileData.medicalConditions) formData.append("medical_conditions", profileData.medicalConditions);
      if (profileData.medications) formData.append("medications", profileData.medications);
      if (profileData.allergies) formData.append("allergies", profileData.allergies);

      const response = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to get response from AI doctor");
      }

      const data = await response.json();

      // Check urgency tier
      if (data.urgency_tier) {
        setUrgencyTier(data.urgency_tier);
      }

      // Add AI response to messages
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: data.urgency_tier === "emergency" ? "system" : "assistant",
          content: data.response,
          timestamp: new Date(),
        },
      ]);

      setIsLoading(false);
    } catch (error) {
      console.error("Error calling AI doctor API:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "system",
          content:
            "Sorry, I'm having trouble connecting to the assessment service. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] bg-surface-elevated">
      {/* Sessions Panel */}
      <aside className="hidden md:flex w-72 border-r border-border flex-col bg-background">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground mb-3">Assessment Sessions</h2>
          <Button
            variant="default"
            className="w-full justify-start gap-2"
            onClick={startNewSession}
          >
            <Plus className="h-4 w-4" />
            New Assessment
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {sessions.length > 0 ? (
            <div className="space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`
                    w-full text-left px-3 py-3 rounded-md transition-colors duration-150
                    ${activeSessionId === session.id 
                      ? "bg-primary/10 text-primary border border-primary/20" 
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent"
                    }
                  `}
                >
                  <div className="text-sm font-medium truncate">{session.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {session.date.toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground">No previous sessions</p>
            </div>
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <main className="flex-1 flex flex-col bg-background">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Symptom Assessment</h1>
              <p className="text-xs text-muted-foreground">
                Describe your symptoms for evidence-based guidance
              </p>
            </div>
          </div>
        </div>

        {/* Urgency Banners - Three Tiers */}
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 bg-surface-elevated">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="bg-background border border-border rounded-lg p-8 max-w-md">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <img 
                    src="/logo-icon.png" 
                    alt="PrediCare" 
                    className="h-7 w-7"
                    onError={(e) => {
                      // Fallback to text icon if image fails
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Begin Symptom Assessment
                </h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Start a new assessment to describe your symptoms and receive 
                  evidence-based guidance on appropriate next steps.
                </p>
                <Button variant="default" onClick={startNewSession}>
                  <Plus className="h-4 w-4 mr-2" />
                  Start New Assessment
                </Button>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((message) => {
                const isAssessment = message.role === "assistant" && isStructuredAssessment(message.content);
                
                return (
                  <div
                    key={message.id}
                    className={`fade-in ${
                      message.role === "user" ? "flex justify-end" : ""
                    }`}
                  >
                    {message.role === "system" ? (
                      <div className="bg-emergency/10 border border-emergency/30 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-emergency flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-foreground">{message.content}</p>
                        </div>
                      </div>
                    ) : isAssessment ? (
                      <AssessmentPanel content={message.content} urgencyTier={urgencyTier} />
                    ) : (
                      <div
                        className={`
                          max-w-[85%] px-4 py-3 rounded-lg
                          ${message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border text-foreground"
                          }
                        `}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                        <p className={`text-xs mt-2 ${message.role === "user" ? "opacity-70" : "text-muted-foreground"}`}>
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="fade-in">
                  <div className="bg-background border border-border text-foreground max-w-[85%] px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-100" />
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-200" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        {activeSessionId && (
          <div className="border-t border-border p-4 bg-background">
            <div className="max-w-3xl mx-auto">
              {urgencyTier === "emergency" ? (
                <div className="bg-muted rounded-lg p-4 text-center border border-border">
                  <p className="text-sm text-muted-foreground">
                    Chat is disabled during emergency mode. Please seek immediate medical care.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {urgencyTier === "urgent" && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        Further discussion here is limited because in-person evaluation is recommended.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Attach image"
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Voice input"
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                    <Input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                      placeholder="Describe your symptoms..."
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      variant="default"
                      size="icon"
                      onClick={handleSend}
                      disabled={!inputValue.trim() || isLoading}
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
