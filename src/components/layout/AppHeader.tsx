import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Home,
  MessageSquare, 
  MapPin, 
  Clock, 
  User, 
  LogOut 
} from "lucide-react";
import Logo from "@/components/Logo";

const navItems = [
  { label: "Home", path: "/app/home", icon: Home },
  { label: "Symptom Assessment", path: "/app/chat", icon: MessageSquare },
  { label: "Nearby Care", path: "/app/nearby", icon: MapPin },
  { label: "History", path: "/app/history", icon: Clock },
  { label: "Profile", path: "/app/profile", icon: User },
];

export function AppHeader() {
  const location = useLocation();

  const isActivePath = (path: string) => {
    if (path === "/app/home") {
      return location.pathname === "/app" || location.pathname === "/app/home";
    }
    return location.pathname === path;
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="clinical-container">
        <div className="flex h-16 items-center justify-between">
          <Logo to="/app/home" />

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = isActivePath(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors duration-150
                    ${isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }
                  `}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="lg:hidden border-t border-border bg-background">
        <div className="flex overflow-x-auto">
          {navItems.map((item) => {
            const isActive = isActivePath(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-medium transition-colors duration-150 min-w-max
                  ${isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
