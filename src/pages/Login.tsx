import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase-service";

export default function Login() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Use Firebase Client SDK to verify email and password
      const userCredential = await signInWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      // Successful login - skip email verification check for now
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
      
      navigate("/app/chat");
    } catch (error: any) {
      console.error("Login error:", error);
      
      let errorMessage = "Invalid email or password";
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (error.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage = "Invalid email or password";
      }
      
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border">
        <div className="clinical-container py-4">
          <Logo to="/" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Sign in to Predicare
            </h1>
            <p className="text-muted-foreground">
              Access your health assessment dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-foreground hover:underline"
              >
                Create account
              </Link>
            </p>
          </div>

          <div className="mt-8 p-4 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground text-center">
              By signing in, you agree to our{" "}
              <Link to="/terms" className="underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
