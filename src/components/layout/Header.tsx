import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="clinical-container">
        <div className="flex h-16 items-center justify-between">
          <Logo to="/" />

          <nav className="hidden md:flex items-center gap-8">
            <Link
              to="/#features"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              Features
            </Link>
            <Link
              to="/#how-it-works"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              How It Works
            </Link>
            <Link
              to="/#about"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              About
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button variant="default" size="sm" asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
