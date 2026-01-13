# 🩺 PrediCare - AI Health Assistant

Modern AI-powered health application with medical consultations, image analysis, and voice support.

## ✨ Features

- 🤖 AI medical consultations
- 🖼️ Medical image analysis
- 💬 24/7 AI chat support
- 🎤 Voice input/output
- 🔐 Firebase authentication
- 📱 Responsive design

## 🚀 Quick Start

```bash
# 1. Install
npm install

# 2. Setup environment variables
cp .env.example .env.local
cp "AI Doctor/.env.example" "AI Doctor/.env"
# Edit both files with your actual API keys

# 3. Run
npm run dev
```

**Get API Keys:**
- Firebase (free): https://console.firebase.google.com
- Groq AI (free): https://console.groq.com

See [SETUP.md](SETUP.md) for detailed environment setup.

## 📦 Commands

```bash
npm run dev        # Start app (frontend + backend)
npm run build      # Build for production
npm run preview    # Preview production build
```

## 🏗️ Project Structure

```
Predicare/
├── src/                    # Frontend React application
│   ├── components/         # React components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── ErrorBoundary.tsx
│   │   └── AIDoctorConsole.tsx
│   ├── pages/             # Page components
│   ├── contexts/          # React contexts (Auth, etc.)
│   ├── lib/               # Utilities and API clients
│   │   ├── api-client.ts  # Backend API client
│   │  Structure

```
src/              # React frontend
AI Doctor/        # Python FastAPI backend
```

## 🔧 Tech Stack

**Frontend**: React + TypeScript + Vite + TailwindCSS + Firebase  
**Backend**: FastAPI + Groq AI + Python 3.8+

## 🐛 Troubleshooting

**Backend issues?**
```bash
cd "AI Doctor"
pip install -r requirements.txt
python main.py
```

**Frontend issues?**
```bash
npm install
npm run dev
```

---

**Built with ❤️ for better healthcare