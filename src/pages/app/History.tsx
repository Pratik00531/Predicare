import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Search, ChevronRight, AlertTriangle, FileText, MessageSquare } from "lucide-react";

interface AssessmentHistory {
  id: string;
  title: string;
  date: Date;
  summary: string;
  severity: "low" | "moderate" | "high" | "emergency";
  messageCount: number;
}

const mockHistory: AssessmentHistory[] = [
  {
    id: "1",
    title: "Persistent Headache",
    date: new Date(Date.now() - 86400000),
    summary: "Tension-type headache. Recommended: rest, hydration, over-the-counter pain relief. Follow up if symptoms persist beyond 3 days.",
    severity: "low",
    messageCount: 8,
  },
  {
    id: "2",
    title: "Upper Respiratory Symptoms",
    date: new Date(Date.now() - 172800000),
    summary: "Symptoms consistent with common cold. Recommended: rest, fluids, symptom management. Seek care if fever exceeds 101°F.",
    severity: "moderate",
    messageCount: 12,
  },
  {
    id: "3",
    title: "Joint Pain - Right Knee",
    date: new Date(Date.now() - 604800000),
    summary: "Possible strain or minor injury. Recommended: RICE protocol, avoid strenuous activity. Consult orthopedist if not improving.",
    severity: "low",
    messageCount: 6,
  },
  {
    id: "4",
    title: "Chest Discomfort",
    date: new Date(Date.now() - 1209600000),
    summary: "Emergency referral issued. Patient advised to seek immediate medical attention.",
    severity: "emergency",
    messageCount: 4,
  },
];

const severityLabels = {
  low: { label: "Low Concern", className: "bg-success/10 text-success" },
  moderate: { label: "Moderate", className: "bg-primary/10 text-primary" },
  high: { label: "High Priority", className: "bg-destructive/10 text-destructive" },
  emergency: { label: "Emergency", className: "bg-emergency text-emergency-foreground" },
};

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [history] = useState<AssessmentHistory[]>([]);
  const showEmptyState = true; // Always show empty state for fresh accounts

  const filteredHistory = history.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const displayHistory = showEmptyState ? [] : filteredHistory;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-elevated">
      {/* Page Header */}
      <div className="bg-background border-b border-border">
        <div className="clinical-container py-6">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Assessment History
          </h1>
          <p className="text-muted-foreground">
            Review your past symptom assessments and their recommendations.
          </p>
        </div>
      </div>

      <div className="clinical-container py-6">
        {/* Search */}
        <div className="mb-6 bg-background border border-border rounded-lg p-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search assessments by title or summary..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* History List or Empty State */}
        {displayHistory.length > 0 ? (
          <div className="space-y-3">
            {displayHistory.map((item) => {
              const severity = severityLabels[item.severity];
              return (
                <div
                  key={item.id}
                  className="border border-border rounded-lg p-5 bg-background hover:border-primary/30 transition-colors duration-150"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {item.severity === "emergency" && (
                          <AlertTriangle className="h-4 w-4 text-emergency flex-shrink-0" />
                        )}
                        <h3 className="text-base font-semibold text-foreground">
                          {item.title}
                        </h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severity.className}`}>
                          {severity.label}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {item.date.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {item.messageCount} messages
                        </span>
                      </div>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {item.summary}
                      </p>
                    </div>

                    <Button variant="ghost" size="icon" className="flex-shrink-0 text-muted-foreground hover:text-foreground">
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-background border border-border rounded-lg p-8">
            <div className="max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-5">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {searchQuery ? "No matching assessments" : "No assessment history yet"}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                {searchQuery
                  ? "Try adjusting your search terms to find what you're looking for."
                  : "Your completed symptom assessments will appear here. History helps you track patterns and share information with healthcare providers."}
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link to="/app/chat">Start Your First Assessment</Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Data Usage Notice */}
        <div className="mt-6 bg-background border border-border rounded-lg p-5">
          <h4 className="text-sm font-semibold text-foreground mb-2">Data Retention & Privacy</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your assessment history is stored securely and encrypted. You can request deletion of your data at any time 
            through your profile settings. Assessment data is used solely to provide you with personalized health guidance 
            and is never shared with third parties without your explicit consent.
          </p>
        </div>
      </div>
    </div>
  );
}
