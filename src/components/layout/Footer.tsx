import { Link } from "react-router-dom";
import Logo from "@/components/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface-elevated">
      <div className="clinical-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="mb-4">
              <Logo to="/" className="mb-4" />
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Predicare provides AI-assisted symptom assessment to help you understand 
              your health better. We are committed to clinical accuracy, data privacy, 
              and connecting you with appropriate care.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                  Features
                </Link>
              </li>
              <li>
                <Link to="/#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                  How It Works
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/hipaa" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                  HIPAA Compliance
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <div className="bg-muted rounded-md p-4 mb-6">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Medical Disclaimer:</strong> Predicare is designed to 
              provide general health information and is not a substitute for professional medical advice, 
              diagnosis, or treatment. Always seek the advice of your physician or other qualified health 
              provider with any questions you may have regarding a medical condition. If you think you may 
              have a medical emergency, call your doctor, go to the emergency department, or call emergency 
              services immediately.
            </p>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © {new Date().getFullYear()} Predicare Health Technologies. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
