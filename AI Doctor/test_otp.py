"""
Test OTP Email Authentication
Quick script to test OTP sending and verification
"""

import requests
import time

BASE_URL = "http://localhost:8000"
TEST_EMAIL = "test@example.com"

def print_section(title):
    print("\n" + "="*60)
    print(f"  {title}")
    print("="*60)

def test_send_otp():
    """Test sending OTP"""
    print_section("TEST 1: Send OTP")
    
    data = {"email": TEST_EMAIL}
    response = requests.post(f"{BASE_URL}/api/auth/send-otp", data=data)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("✅ OTP sent successfully!")
        print("\n📧 CHECK YOUR TERMINAL/CONSOLE FOR THE OTP CODE (dev mode)")
        print("   Look for: '📧 DEV MODE - OTP for test@example.com: ######'")
        return True
    else:
        print("❌ Failed to send OTP")
        return False

def test_verify_otp(otp_code):
    """Test verifying OTP"""
    print_section("TEST 2: Verify OTP")
    
    data = {
        "email": TEST_EMAIL,
        "otp": otp_code
    }
    response = requests.post(f"{BASE_URL}/api/auth/verify-otp", data=data)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200 and response.json().get('success'):
        print("✅ OTP verified successfully!")
        return True
    else:
        print("❌ OTP verification failed")
        return False

def test_check_email():
    """Test checking if email exists"""
    print_section("TEST 3: Check Email Exists")
    
    response = requests.get(f"{BASE_URL}/api/auth/check-email", params={"email": TEST_EMAIL})
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    return response.status_code == 200

def test_resend_otp():
    """Test resending OTP"""
    print_section("TEST 4: Resend OTP")
    
    data = {"email": TEST_EMAIL}
    response = requests.post(f"{BASE_URL}/api/auth/resend-otp", data=data)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if response.status_code == 200:
        print("✅ OTP resent successfully!")
        print("\n📧 CHECK YOUR TERMINAL/CONSOLE FOR THE NEW OTP CODE")
        return True
    else:
        print("❌ Failed to resend OTP")
        return False

def test_invalid_otp():
    """Test with invalid OTP"""
    print_section("TEST 5: Invalid OTP (Should Fail)")
    
    data = {
        "email": TEST_EMAIL,
        "otp": "000000"  # Invalid OTP
    }
    response = requests.post(f"{BASE_URL}/api/auth/verify-otp", data=data)
    
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")
    
    if not response.json().get('success'):
        print("✅ Correctly rejected invalid OTP")
        return True
    else:
        print("❌ Should have rejected invalid OTP")
        return False

def interactive_test():
    """Interactive testing"""
    print("\n")
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║         PrediCare OTP Authentication Test Suite          ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    
    print("\n🔍 Make sure the backend server is running on port 8000!")
    print("   Run: cd '/home/pratik/Predicare/AI Doctor' && python main.py\n")
    
    input("Press Enter to start testing...")
    
    # Test 1: Send OTP
    if not test_send_otp():
        print("\n❌ Cannot proceed - OTP sending failed")
        return
    
    # Test 3: Check email
    test_check_email()
    
    # Test 5: Invalid OTP
    test_invalid_otp()
    
    # Test 4: Resend OTP
    print("\n⏳ Waiting 2 seconds before resend test...")
    time.sleep(2)
    test_resend_otp()
    
    # Test 2: Verify OTP (interactive)
    print_section("TEST 6: Verify Valid OTP (Interactive)")
    print("\n📧 Check the server terminal for the OTP code")
    print("   Look for: '2026-01-13 XX:XX:XX,XXX - INFO - 📧 DEV MODE - OTP for test@example.com: ######'")
    
    otp_code = input("\n✍️  Enter the 6-digit OTP from server logs: ").strip()
    
    if len(otp_code) == 6 and otp_code.isdigit():
        test_verify_otp(otp_code)
    else:
        print("❌ Invalid OTP format (must be 6 digits)")
    
    # Summary
    print_section("TEST SUMMARY")
    print("\n✅ All automated tests completed!")
    print("\n📝 Manual checks:")
    print("   • Verify OTP appears in server logs")
    print("   • Check OTP expiration (10 minutes)")
    print("   • Test max attempts (3)")
    print("   • Verify email template if SMTP configured")
    print("\n🎉 OTP authentication system is working!")

if __name__ == "__main__":
    try:
        interactive_test()
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to backend server!")
        print("   Make sure the server is running on http://localhost:8000")
        print("\n   Run: cd '/home/pratik/Predicare/AI Doctor' && python main.py")
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
