# Environment Setup

## Frontend (.env.local)
Create this file in the root directory:

```bash
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123
VITE_API_URL=http://localhost:8000
```

## Backend (AI Doctor/.env)
Create this file in the AI Doctor directory:

```bash
GROQ_API_KEY=your_groq_api_key
ALLOWED_ORIGINS=http://localhost:5173
```

## Get API Keys

- **Firebase**: https://console.firebase.google.com (free)
- **Groq AI**: https://console.groq.com (free)
