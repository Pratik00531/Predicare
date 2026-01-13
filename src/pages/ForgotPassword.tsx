import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase-service";

export default function ForgotPassword() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSendResetEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      
      setEmailSent(true);
      toast({
        title: "Reset Email Sent",
        description: "Check your email for a password reset link.",
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      
      let errorMessage = "Failed to send reset email. Please try again.";
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email address.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Logo showText className="mb-8 justify-center" />
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {!emailSent 
              ? "Enter your email to receive a password reset link"
              : "Check your email for the reset link"}
          </p>
        </div>

        {!emailSent ? (
          <form onSubmit={handleSendResetEmail} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="mt-1"
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Sign In
              </Link>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 text-center">
                📧 Password reset email sent to <strong>{email}</strong>
              </p>
              <p className="text-xs text-green-700 text-center mt-2">
                Click the link in the email to reset your password
              </p>
            </div>

            <Button 
              onClick={() => setEmailSent(false)} 
              variant="outline" 
              className="w-full"
            >
              Resend Email
            </Button>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
