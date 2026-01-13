"""
Authentication Service with OTP Email Verification
Handles OTP generation, email sending, and verification
"""

import os
import random
import string
from datetime import datetime, timedelta
from typing import Dict, Optional
import logging
from firebase_admin import auth, firestore
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

logger = logging.getLogger(__name__)

# In-memory OTP store (for production, use Redis or Firestore)
otp_store: Dict[str, Dict] = {}

# OTP Configuration
OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 10
MAX_OTP_ATTEMPTS = 3

class OTPService:
    """Handles OTP generation and verification"""
    
    @staticmethod
    def generate_otp() -> str:
        """Generate a 6-digit OTP"""
        return ''.join(random.choices(string.digits, k=OTP_LENGTH))
    
    @staticmethod
    def store_otp(email: str, otp: str) -> None:
        """Store OTP with expiry timestamp"""
        otp_store[email] = {
            'otp': otp,
            'created_at': datetime.now(),
            'attempts': 0,
            'verified': False
        }
        logger.info(f"OTP generated for {email}")
    
    @staticmethod
    def verify_otp(email: str, otp: str) -> tuple[bool, str]:
        """
        Verify OTP for email
        Returns: (success: bool, message: str)
        """
        if email not in otp_store:
            return False, "No OTP found for this email. Please request a new one."
        
        stored_data = otp_store[email]
        
        # Check if already verified
        if stored_data['verified']:
            return False, "This OTP has already been used."
        
        # Check expiry
        expiry_time = stored_data['created_at'] + timedelta(minutes=OTP_EXPIRY_MINUTES)
        if datetime.now() > expiry_time:
            del otp_store[email]
            return False, f"OTP expired. Please request a new one."
        
        # Check attempts
        if stored_data['attempts'] >= MAX_OTP_ATTEMPTS:
            del otp_store[email]
            return False, "Too many failed attempts. Please request a new OTP."
        
        # Verify OTP
        if stored_data['otp'] != otp:
            stored_data['attempts'] += 1
            remaining = MAX_OTP_ATTEMPTS - stored_data['attempts']
            return False, f"Invalid OTP. {remaining} attempts remaining."
        
        # Success!
        stored_data['verified'] = True
        logger.info(f"OTP verified successfully for {email}")
        return True, "OTP verified successfully!"
    
    @staticmethod
    def cleanup_expired_otps() -> None:
        """Remove expired OTPs from store"""
        current_time = datetime.now()
        expired_emails = [
            email for email, data in otp_store.items()
            if current_time > data['created_at'] + timedelta(minutes=OTP_EXPIRY_MINUTES)
        ]
        for email in expired_emails:
            del otp_store[email]
        if expired_emails:
            logger.info(f"Cleaned up {len(expired_emails)} expired OTPs")


class EmailService:
    """Handles email sending for OTP"""
    
    def __init__(self):
        # Email configuration from environment
        self.smtp_server = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
        self.smtp_port = int(os.getenv('SMTP_PORT', '587'))
        self.smtp_email = os.getenv('SMTP_EMAIL')
        self.smtp_password = os.getenv('SMTP_PASSWORD')
        self.from_name = os.getenv('SMTP_FROM_NAME', 'PrediCare Health')
        
        if not self.smtp_email or not self.smtp_password:
            logger.warning("⚠️ SMTP credentials not configured - OTP emails will not be sent")
    
    def send_otp_email(self, to_email: str, otp: str) -> bool:
        """
        Send OTP via email
        Returns: True if sent successfully, False otherwise
        """
        if not self.smtp_email or not self.smtp_password:
            logger.error("SMTP not configured - cannot send email")
            # For development: log OTP to console
            logger.info(f"📧 DEV MODE - OTP for {to_email}: {otp}")
            return True  # Return True in dev mode for testing
        
        try:
            # Create email message
            message = MIMEMultipart('alternative')
            message['Subject'] = f'Your PrediCare Verification Code: {otp}'
            message['From'] = f'{self.from_name} <{self.smtp_email}>'
            message['To'] = to_email
            
            # Email body (HTML)
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; margin: 0; padding: 0; background-color: #f3f4f6; }}
                    .container {{ max-width: 600px; margin: 0 auto; background: white; }}
                    .header {{ background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); 
                              color: white; padding: 40px 30px; text-align: center; }}
                    .logo {{ margin-bottom: 20px; }}
                    .logo-img {{ max-width: 180px; height: auto; }}
                    .content {{ padding: 40px 30px; background: white; }}
                    .otp-box {{ background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); 
                               border: 3px solid #3b82f6; 
                               padding: 25px; 
                               text-align: center; 
                               font-size: 36px; 
                               font-weight: bold; 
                               letter-spacing: 10px; 
                               margin: 30px 0; 
                               border-radius: 12px; 
                               color: #1e40af;
                               box-shadow: 0 4px 6px rgba(59, 130, 246, 0.1); }}
                    .footer {{ text-align: center; color: #6b7280; font-size: 12px; padding: 20px; background: #f9fafb; }}
                    .warning {{ background: #fef3c7; border-left: 4px solid #f59e0b; 
                               padding: 16px; margin: 20px 0; border-radius: 4px; }}
                    .title {{ font-size: 24px; color: #1f2937; margin-bottom: 10px; }}
                    .subtitle {{ color: #6b7280; margin-top: 0; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">
                            <!-- Logo will be displayed if email client supports it -->
                            <div style="background: white; display: inline-block; padding: 12px 24px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                                <h1 style="margin: 0; color: #1e40af; font-size: 28px; font-weight: 600;">
                                    🏥 PrediCare
                                </h1>
                            </div>
                        </div>
                        <p style="margin: 15px 0 0 0; font-size: 16px; opacity: 0.95;">Your Healthcare AI Assistant</p>
                    </div>
                    <div class="content">
                        <h2 class="title">Email Verification</h2>
                        <p class="subtitle">Verify your email to complete registration</p>
                        <p>Hello!</p>
                        <p>Thank you for signing up with PrediCare. To complete your registration, 
                           please verify your email address using the verification code below:</p>
                        
                        <div class="otp-box">
                            {otp}
                        </div>
                        
                        <p style="text-align: center;"><strong>⏰ This code will expire in {OTP_EXPIRY_MINUTES} minutes</strong></p>
                        
                        <div class="warning">
                            <strong>🔒 Security Notice:</strong><br>
                            • Never share this code with anyone<br>
                            • PrediCare will never ask for this code via phone or email<br>
                            • If you didn't request this code, please ignore this email
                        </div>
                        
                        <p>If you have any questions or need assistance, feel free to contact our support team.</p>
                        
                        <p style="margin-top: 30px;">Best regards,<br><strong>The PrediCare Team</strong></p>
                    </div>
                    <div class="footer">
                        <p style="margin: 5px 0;">This is an automated email. Please do not reply.</p>
                        <p style="margin: 5px 0;">© 2026 PrediCare Health. All rights reserved.</p>
                        <p style="margin: 15px 0 5px 0; font-size: 11px; color: #9ca3af;">
                            PrediCare is an AI-powered healthcare assistant.<br>
                            Always consult with a healthcare professional for medical advice.
                        </p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text alternative
            text_body = f"""
            PrediCare Health - Email Verification
            
            Your verification code is: {otp}
            
            This code will expire in {OTP_EXPIRY_MINUTES} minutes.
            
            If you didn't request this code, please ignore this email.
            
            Best regards,
            PrediCare Health Team
            """
            
            # Attach both versions
            part1 = MIMEText(text_body, 'plain')
            part2 = MIMEText(html_body, 'html')
            message.attach(part1)
            message.attach(part2)
            
            # Send email with timeout
            with smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=10) as server:
                server.starttls()
                server.login(self.smtp_email, self.smtp_password)
                server.send_message(message)
            
            logger.info(f"✅ OTP email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send OTP email to {to_email}: {e}")
            # For development: still log OTP to console
            logger.info(f"📧 DEV MODE - OTP for {to_email}: {otp}")
            return False
    
    def send_password_reset_email(self, to_email: str, otp: str) -> bool:
        """Send password reset OTP email"""
        try:
            message = MIMEMultipart('alternative')
            message['Subject'] = 'Reset Your PrediCare Password'
            message['From'] = self.smtp_email
            message['To'] = to_email
            
            # HTML email body with modern design
            html_body = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
                <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header with gradient -->
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 40px 30px; text-align: center;">
                        <div style="background-color: rgba(255, 255, 255, 0.15); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                            <div style="font-size: 40px; color: white;">🔐</div>
                        </div>
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Password Reset Request</h1>
                        <p style="color: rgba(255, 255, 255, 0.95); margin: 10px 0 0 0; font-size: 16px;">PrediCare Health</p>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 40px 30px;">
                        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                            We received a request to reset your password. Use the verification code below to create a new password:
                        </p>
                        
                        <!-- OTP Code Box -->
                        <div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border: 2px solid #3b82f6; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                            <p style="color: #1e40af; font-size: 14px; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Reset Code</p>
                            <div style="font-size: 36px; font-weight: 700; color: #1e40af; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                                {otp}
                            </div>
                            <p style="color: #6b7280; font-size: 13px; margin: 15px 0 0 0;">
                                Valid for {OTP_EXPIRY_MINUTES} minutes
                            </p>
                        </div>
                        
                        <!-- Important Notes -->
                        <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 25px 0; border-radius: 6px;">
                            <p style="color: #92400e; font-size: 14px; margin: 0; font-weight: 600;">
                                ⚠️ Security Notice
                            </p>
                            <p style="color: #78350f; font-size: 13px; margin: 8px 0 0 0; line-height: 1.5;">
                                If you didn't request a password reset, please ignore this email and ensure your account is secure.
                            </p>
                        </div>
                        
                        <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0 0;">
                            This code will expire in {OTP_EXPIRY_MINUTES} minutes. After entering the code, you'll be able to create a new password for your account.
                        </p>
                    </div>
                    
                    <!-- Footer -->
                    <div style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
                        <p style="color: #6b7280; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                            <strong style="color: #374151;">PrediCare Health</strong><br>
                            AI-Powered Healthcare Assistant
                        </p>
                        <p style="margin: 15px 0 5px 0; font-size: 11px; color: #9ca3af; text-align: center;">
                            PrediCare is an AI-powered healthcare assistant.<br>
                            For security reasons, never share your verification code with anyone.
                        </p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text alternative
            text_body = f"""
            PrediCare Health - Password Reset
            
            Your password reset verification code is: {otp}
            
            This code will expire in {OTP_EXPIRY_MINUTES} minutes.
            
            If you didn't request a password reset, please ignore this email.
            
            Best regards,
            PrediCare Health Team
            """
            
            # Attach both versions
            part1 = MIMEText(text_body, 'plain')
            part2 = MIMEText(html_body, 'html')
            message.attach(part1)
            message.attach(part2)
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_email, self.smtp_password)
                server.send_message(message)
            
            logger.info(f"✅ Password reset email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send password reset email to {to_email}: {e}")
            # For development: still log OTP to console
            logger.info(f"📧 DEV MODE - Password Reset OTP for {to_email}: {otp}")
            return False


class FirebaseAuthService:
    """Handles Firebase Authentication operations"""
    
    @staticmethod
    def create_user_with_email(email: str, password: str, display_name: str = None) -> dict:
        """
        Create a new Firebase user (without auto-verification)
        User must verify OTP before account is fully activated
        """
        try:
            user_record = auth.create_user(
                email=email,
                password=password,
                display_name=display_name,
                email_verified=False  # User must verify OTP first
            )
            
            logger.info(f"✅ Firebase user created: {user_record.uid}")
            return {
                'success': True,
                'uid': user_record.uid,
                'email': user_record.email
            }
        except Exception as e:
            logger.error(f"Failed to create Firebase user: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def verify_email_in_firebase(email: str) -> bool:
        """Mark email as verified in Firebase after OTP verification"""
        try:
            user = auth.get_user_by_email(email)
            auth.update_user(user.uid, email_verified=True)
            logger.info(f"✅ Email verified in Firebase for {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to verify email in Firebase: {e}")
            return False
    
    @staticmethod
    def get_user_by_email(email: str) -> Optional[dict]:
        """Get Firebase user by email"""
        try:
            user = auth.get_user_by_email(email)
            return {
                'uid': user.uid,
                'email': user.email,
                'email_verified': user.email_verified,
                'display_name': user.display_name
            }
        except Exception as e:
            logger.error(f"User not found: {e}")
            return None
    
    @staticmethod
    def reset_password(email: str, new_password: str) -> bool:
        """Reset user password in Firebase"""
        try:
            user = auth.get_user_by_email(email)
            auth.update_user(user.uid, password=new_password)
            logger.info(f"✅ Password reset successfully for {email}")
            return True
        except Exception as e:
            logger.error(f"Failed to reset password: {e}")
            return False
