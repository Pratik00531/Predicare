# Social Login Setup Guide

## ✅ What's Been Added

- **Google Sign-In** button on signup and login pages
- **GitHub Sign-In** button on signup and login pages
- Automatic user profile creation in Firestore
- Beautiful UI with provider logos

## 🔧 Firebase Console Setup Required

To make social login work, you need to enable these providers in Firebase Console:

### 1. Google Sign-In (Easiest - No Setup Needed!)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **predicare-cdc51**
3. Go to **Authentication** → **Sign-in method**
4. Click on **Google**
5. Toggle **Enable**
6. Select your **support email** (your Gmail)
7. Click **Save**

✅ **Done!** Google login will work immediately.

---

### 2. GitHub Sign-In

1. Go to **Authentication** → **Sign-in method** in Firebase Console
2. Click on **GitHub**
3. Toggle **Enable**

4. **Get GitHub OAuth credentials:**
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click **New OAuth App**
   - Fill in:
     - **Application name**: PrediCare
     - **Homepage URL**: `https://predicare.vercel.app`
     - **Authorization callback URL**: `https://predicare-cdc51.firebaseapp.com/__/auth/handler`
       *(Copy this exact URL from Firebase Console - it's shown in the GitHub setup section)*
   - Click **Register application**
   - Copy the **Client ID**
   - Generate a new **Client Secret** and copy it

5. **Back in Firebase Console:**
   - Paste **Client ID** 
   - Paste **Client Secret**
   - Click **Save**

✅ **Done!** GitHub login will work.

---

### 3. Apple Sign-In (Optional - More Complex)

Apple Sign-In requires:
- Apple Developer Account ($99/year)
- App ID configuration
- Service ID configuration
- Private key generation

**For now, skip Apple** unless you have an Apple Developer account. Google + GitHub are sufficient!

---

## 🧪 Testing

After enabling in Firebase Console:

1. **Google Login:**
   - Go to https://predicare.vercel.app/signup
   - Click **"Continue with Google"**
   - Select your Google account
   - Should redirect to `/app` immediately!

2. **GitHub Login:**
   - Click **"Continue with GitHub"**
   - Authorize the app
   - Should redirect to `/app` immediately!

3. **Email/Password:**
   - Still works as before
   - No email verification required
   - Instant signup and login

---

## 🎨 UI Features

- **Clean separation** between social login and email/password
- **Provider logos** (colorful Google, GitHub icons)
- **Loading states** to prevent double-clicks
- **Error handling** for:
  - Popup closed by user
  - Account exists with different provider
  - Network errors

---

## 📝 Notes

- User profiles are automatically created in Firestore
- Social login users get `authProvider` field set to 'google' or 'github'
- Email/password users don't have this field
- All auth methods create the same user structure
- No backend changes needed - everything happens on frontend + Firebase

---

## 🚀 Next Steps

1. ✅ Enable Google in Firebase Console (2 minutes)
2. ⚠️ Enable GitHub in Firebase Console (5 minutes - needs GitHub OAuth app)
3. 🎉 Test on https://predicare.vercel.app
4. 📱 (Optional) Add more providers later: Microsoft, Twitter, Facebook

**Priority:** Enable Google first - it's the most popular and easiest!
