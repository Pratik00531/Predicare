import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  MessageSquare, 
  MapPin, 
  Clock, 
  Shield,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Home() {
  const { user } = useAuth();
  const userName = user?.displayName?.split(' ')[0] || "there";
  const hasLastAssessment = false;
  const lastAssessmentDate = new Date(Date.now() - 86400000);
  const lastAssessmentStatus = "Completed";

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-surface-elevated">
      {/* Welcome Section */}
      <div className="bg-background border-b border-border">
        <div className="clinical-container py-8 lg:py-10">
          <div className="max-w-3xl">
            <h1 className="text-2xl lg:text-3xl font-semibold text-foreground mb-3">
              Welcome back, {userName}
            </h1>
            <p className="text-muted-foreground text-base lg:text-lg leading-relaxed">
              Predicare provides clinically-informed symptom assessment to help you understand 
              your health concerns and guide you to appropriate care. Select an action below to get started.
            </p>
          </div>
        </div>
      </div>

      <div className="clinical-container py-8">
        {/* Primary Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {/* Start New Assessment */}
          <div className="bg-background border border-border rounded-lg p-6 hover:border-primary/30 transition-colors duration-150">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Start New Assessment
            </h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Describe your symptoms and receive evidence-based guidance on next steps.
            </p>
            <Button asChild className="w-full">
              <Link to="/app/chat">
                Begin Assessment
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Continue Last Assessment */}
          <div className={`bg-background border border-border rounded-lg p-6 ${hasLastAssessment ? 'hover:border-primary/30' : 'opacity-60'} transition-colors duration-150`}>
            <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center mb-4">
              <Clock className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Continue Last Assessment
            </h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              {hasLastAssessment 
                ? `Resume your assessment from ${lastAssessmentDate.toLocaleDateString()}.`
                : "No previous assessment found. Start a new one to begin."
              }
            </p>
            <Button 
              variant="outline" 
              className="w-full" 
              asChild
              disabled={!hasLastAssessment}
            >
              <Link to="/app/chat">
                {hasLastAssessment ? "Continue" : "Not Available"}
                {hasLastAssessment && <ArrowRight className="h-4 w-4 ml-2" />}
              </Link>
            </Button>
          </div>

          {/* Find Nearby Care */}
          <div className="bg-background border border-border rounded-lg p-6 hover:border-primary/30 transition-colors duration-150">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Find Nearby Care
            </h3>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
              Locate hospitals, clinics, and specialists in your area for in-person care.
            </p>
            <Button variant="outline" asChild className="w-full">
              <Link to="/app/nearby">
                Search Providers
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-background border border-border rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
          </div>
          <div className="p-6">
            {hasLastAssessment ? (
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-5 w-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="text-sm font-medium text-foreground">
                      Headache Assessment
                    </h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">
                      {lastAssessmentStatus}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {lastAssessmentDate.toLocaleDateString(undefined, { 
                      weekday: 'long',
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tension-type headache identified. Recommended: rest, hydration, over-the-counter pain relief.
                  </p>
                </div>
                <Button variant="ghost" size="sm" asChild className="flex-shrink-0">
                  <Link to="/app/history">View All</Link>
                </Button>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-3">
                  No recent activity. Start your first assessment to see your history here.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/chat">Start Assessment</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Privacy & Safety */}
        <div className="bg-background border border-border rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                Your Privacy & Safety
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Predicare is designed to assist, not replace, professional medical judgment. 
                Your health data is encrypted and stored securely. We do not share your information 
                with third parties. If you experience a medical emergency, please call 911 or visit 
                your nearest emergency room immediately.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
