import React, { useState, useEffect, useRef } from 'react';
import { Mail, Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface OTPVerificationProps {
  email: string;
  onVerified: (email: string) => void;
  onBack: () => void;
  mode?: 'signup' | 'login';
}

const OTPVerification: React.FC<OTPVerificationProps> = ({ 
  email, 
  onVerified, 
  onBack,
  mode = 'signup'
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    if (!/^\d*$/.test(value)) return; // Only allow digits
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Take only last character
    setOtp(newOtp);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
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

    // Focus last filled input
    const lastIndex = Math.min(pastedData.length, 5);
    inputRefs.current[lastIndex]?.focus();

    // Auto-submit if 6 digits pasted
    if (pastedData.length === 6) {
      verifyOTP(pastedData);
    }
  };

  // Verify OTP
  const verifyOTP = async (otpCode: string) => {
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('email', email);
      formData.append('otp', otpCode);

      const response = await fetch('http://localhost:8000/api/auth/verify-otp', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onVerified(email);
        }, 1000);
      } else {
        setError(data.message || 'Invalid OTP. Please try again.');
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error) {
      setError('Failed to verify OTP. Please try again.');
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

      const response = await fetch('http://localhost:8000/api/auth/resend-otp', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setTimeLeft(600); // Reset timer
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setError('');
      } else {
        setError('Failed to resend OTP. Please try again.');
      }
    } catch (error) {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-white" />
        </div>
        <CardTitle>Verify Your Email</CardTitle>
        <CardDescription>
          We've sent a 6-digit code to<br />
          <strong className="text-foreground">{email}</strong>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
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
            Code expires in <span className="font-semibold text-foreground">{formatTime(timeLeft)}</span>
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
              Email verified successfully! Redirecting...
            </AlertDescription>
          </Alert>
        )}

        {/* Resend Button */}
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Didn't receive the code?
          </p>
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
          <p className="text-xs text-muted-foreground">
            {timeLeft > 540 ? 'Wait 60 seconds before resending' : 'Click to get a new code'}
          </p>
        </div>

        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={loading || success}
          className="w-full"
        >
          Back to {mode === 'signup' ? 'Sign Up' : 'Login'}
        </Button>

        {/* Help Text */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            Check your spam folder if you don't see the email
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default OTPVerification;
