import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "email" | "verify" | "newPassword";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSendOTP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("email", email);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/forgot-password`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to send reset code");
      }

      setStep("verify");
      toast({
        title: "Code Sent",
        description: "Check your email for the verification code.",
      });
    } catch (error) {
      console.error("Send OTP error:", error);
      toast({
        title: "Error",
        description: "Failed to send reset code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter the complete 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    setStep("newPassword");
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords Don't Match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("otp", otp);
      formData.append("new_password", newPassword);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/reset-password`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to reset password");
      }

      toast({
        title: "Success!",
        description: "Password reset successfully. You can now login.",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (error: any) {
      console.error("Reset password error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to reset password. Please try again.",
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
            {step === "email" && "Enter your email to receive a verification code"}
            {step === "verify" && "Enter the 6-digit code sent to your email"}
            {step === "newPassword" && "Create a new password for your account"}
          </p>
        </div>

        {/* Step 1: Email Input */}
        {step === "email" && (
          <form onSubmit={handleSendOTP} className="mt-8 space-y-6">
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
              {isLoading ? "Sending..." : "Send Verification Code"}
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
        )}

        {/* Step 2: OTP Verification */}
        {step === "verify" && (
          <form onSubmit={handleVerifyOTP} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="otp" className="text-center block mb-4">
                  Verification Code
                </Label>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(value) => setOtp(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <p className="text-xs text-gray-500 text-center mt-2">
                  Code sent to {email}
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={otp.length !== 6}>
              Verify Code
            </Button>

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                Change Email Address
              </button>
            </div>
          </form>
        )}

        {/* Step 3: New Password */}
        {step === "newPassword" && (
          <form onSubmit={handleResetPassword} className="mt-8 space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-1"
                  minLength={6}
                />
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1"
                  minLength={6}
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Security Note:</strong> The verification code expires in 10 minutes.
            {step === "verify" && " Don't share this code with anyone."}
          </p>
        </div>
      </div>
    </div>
  );
}
