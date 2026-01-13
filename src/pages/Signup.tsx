import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";

export default function Signup() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.id]: e.target.value
    });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agreedToTerms) return;
    
    setIsLoading(true);
    setError("");

    try {
      // Use Firebase Auth directly - no backend needed for signup
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase-service');
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase-service');

      // Create Firebase user
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      // Update profile with display name
      await updateProfile(userCredential.user, {
        displayName: `${formData.firstName} ${formData.lastName}`
      });

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: formData.email,
        displayName: `${formData.firstName} ${formData.lastName}`,
        firstName: formData.firstName,
        lastName: formData.lastName,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Send verification email (Firebase handles this automatically)
      // await sendEmailVerification(userCredential.user);

      // Success! Navigate to app
      navigate("/app");
      
    } catch (error: any) {
      console.error('Signup error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        setError("This email is already registered. Please sign in instead.");
      } else if (error.code === 'auth/weak-password') {
        setError("Password is too weak. Please use at least 6 characters.");
      } else if (error.code === 'auth/invalid-email') {
        setError("Invalid email address.");
      } else {
        setError("Failed to create account. Please try again.");
      }
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
              Create your account
            </h1>
            <p className="text-muted-foreground">
              Start your health assessment journey
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  required
                  autoComplete="given-name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  required
                  autoComplete="family-name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                required
                autoComplete="new-password"
                minLength={6}
                value={formData.password}
                onChange={handleInputChange}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 8 characters with at least one number and one letter
              </p>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
              />
              <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                I agree to the{" "}
                <Link to="/terms" className="underline text-foreground">
                  Terms of Service
                </Link>
                ,{" "}
                <Link to="/privacy" className="underline text-foreground">
                  Privacy Policy
                </Link>
                , and understand that Predicare does not replace professional medical advice.
              </Label>
            </div>

            <Button
              type="submit"
              variant="default"
              size="lg"
              className="w-full"
              disabled={isLoading || !agreedToTerms}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-medium text-foreground hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
