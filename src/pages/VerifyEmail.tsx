import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, CheckCircle, XCircle, RefreshCw, AlertCircle } from "lucide-react";
import Logo from "@/components/Logo";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const devMode = location.state?.devMode || false;
  const devOTP = location.state?.otp || sessionStorage.getItem('devOTP') || "";
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no email provided
  useEffect(() => {
    if (!email) {
      navigate('/signup');
    }
    
    // Auto-fill OTP in dev mode
    if (devMode && devOTP && devOTP.length === 6) {
      const digits = devOTP.split('');
      setOtp(digits);
      // Auto-verify after a short delay
      setTimeout(() => {
        verifyOTP(devOTP);
      }, 500);
    }
  }, [email, navigate, devMode, devOTP]);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle OTP input change
  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newOtp.every(digit => digit !== '') && !loading) {
      verifyOTP(newOtp.join(''));
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
    setOtp(newOtp);

    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();

    if (pastedData.length === 6) {
      verifyOTP(pastedData);
    }
  };

  // Verify OTP and create account
  const verifyOTP = async (otpCode: string) => {
    setLoading(true);
    setError('');

    try {
      // Get pending signup data
      const pendingSignupData = sessionStorage.getItem('pendingSignup');
      if (!pendingSignupData) {
        setError('Session expired. Please sign up again.');
        setTimeout(() => navigate('/signup'), 2000);
        return;
      }

      const signupData = JSON.parse(pendingSignupData);

      // Complete signup with OTP verification
      const formData = new FormData();
      formData.append('email', email);
      formData.append('password', signupData.password);
      formData.append('displayName', signupData.displayName);
      formData.append('otp', otpCode);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/signup-with-otp`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        sessionStorage.removeItem('pendingSignup');
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(data.message || 'Invalid verification code. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      console.error('Verification error:', error);
      setError('Failed to verify code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setResending(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('email', email);

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/auth/resend-otp`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setTimeLeft(600);
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setError('');
      } else {
        setError('Failed to resend code. Please try again.');
      }
    } catch (error) {
      setError('Failed to resend code. Please try again.');
    } finally {
      setResending(false);
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
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <Mail className="h-8 w-8 text-primary" />
            </div>

            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Check your email
            </h1>
            
            <p className="text-muted-foreground">
              We've sent a 6-digit verification code to<br />
              <strong className="text-foreground">{email}</strong>
            </p>
          </div>

          <div className="space-y-6">
            {/* OTP Input */}
            <div className="flex justify-center gap-2">
              {otp.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  disabled={loading || success}
                  className={`w-12 h-14 text-center text-xl font-bold ${
                    success ? 'border-green-500 bg-green-50' : 
                    error ? 'border-red-500' : ''
                  }`}
                />
              ))}
            </div>

            {/* Timer */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Code expires in{' '}
                <span className={`font-semibold ${timeLeft < 60 ? 'text-destructive' : 'text-foreground'}`}>
                  {formatTime(timeLeft)}
                </span>
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {success && (
              <Alert className="border-green-500 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-600">
                  Email verified successfully! Redirecting to sign in...
                </AlertDescription>
              </Alert>
            )}

            {/* Instructions */}
            {!error && !success && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Enter the 6-digit code from your email or check the server console if in development mode.
                </AlertDescription>
              </Alert>
            )}

            {/* Resend Button */}
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={handleResend}
                disabled={resending || loading || success || timeLeft > 540}
                className="w-full"
              >
                {resending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resend Code
                  </>
                )}
              </Button>
              
              <p className="text-xs text-center text-muted-foreground">
                {timeLeft > 540 
                  ? 'Wait 60 seconds before resending' 
                  : "Didn't receive the code? Click to resend"}
              </p>
            </div>

            {/* Back to Signup */}
            <Button
              variant="ghost"
              onClick={() => navigate('/signup')}
              disabled={loading || success}
              className="w-full"
            >
              Back to Sign Up
            </Button>

            {/* Help Text */}
            <div className="mt-4 p-4 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground text-center">
                Check your spam folder if you don't see the email.<br />
                For development testing, check the backend server console for the OTP code.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
