# Community Hero — Hyperlocal Problem Solver

Community Hero is an AI-powered civic management platform that empowers citizens to report local infrastructure issues, tracks politician accountability through dynamic "Shame Scores," predicts infrastructural hotspots before they fail, and uses forensic AI comparison to verify repairs and prevent contractor fraud.

### 🔗 Live Project
* **Live Website:** [Link to Deployed Website] (Update this link after deployment)
* **Demo Video:** [Link to Demo Video]

---

## 🚀 Key Features

### 1. AI-Powered Civic Reporting
* **Intelligent Analysis**: Citizens upload photos or videos of local civic issues. Gemini 1.5 Flash automatically identifies the issue, classifies the category, and estimates the severity.
* **Auto-Routing & Official Letters**: The system maps the issue category to the responsible municipal department, generates a formal government-style complaint letter, and automatically dispatches it via SendGrid.
* **Duplicate Detection**: Employs mathematical Haversine calculations to compare incoming reports against active issues within a 100-meter radius, linking duplicate reports automatically.

### 2. Politician Accountability Tracker
* **Interactive Map**: Displays dynamic municipal boundary polygons over an open-source map layer. Constituencies are color-coded (Green/Orange/Red) based on the volume of unresolved issues.
* **Shame Scores**: Evaluates ward representatives worst-to-best on a live leaderboard. Scores are calculated using unresolved ratio, resolution speed, and issue volume.
* **Awareness Campaigns**: Allows citizens to directly trigger AI-generated email campaigns to their representative's office detailing the top unresolved issues in their constituency.

### 3. Predictive Hotspot Engine
* **Preemptive Infrastructure Planning**: A background forecasting engine aggregates historical issue resolution rates, ward-level road age metadata, and live 5-day weather forecasts.
* **Risk Mapping**: Areas with a combined risk score greater than 65% are flagged as purple hotspot markers on the public feed, warning citizens and government planners of imminent issues (e.g., potholes forming during heavy rain).

### 4. Forensic Fraud Prevention
* **Verification Pipeline**: When a repair is reported resolved, citizens upload an "after" photo.
* **Dual-Image Analysis**: Gemini Vision analyzes the "before" and "after" photos side-by-side to verify if the issue was actually fixed, confirms the location matches, and checks for stock/unrelated images.
* **Automated Action**: Fake or suspicious resolutions automatically reopen the issue, flag the contractor, and alert the department.

### 5. Conversational CivicBot
* **Agentic Assistant**: A floating, multi-turn AI assistant capable of responding in Hindi and English. 
* **Database Actions**: CivicBot queries Firestore in real-time to answer questions like *"Show me my recent reports"* or *"Tell me what is happening near me"*.

---

## 🛠️ Tech Stack

* **Frontend**: React 18, Vite 6, Tailwind CSS 3, Leaflet.js, React-Leaflet, Lucide React, Recharts
* **Backend**: FastAPI (Python 3.11), Uvicorn, Pydantic
* **AI/ML Model**: Google Gemini 1.5 Flash (via `google-generativeai` SDK)
* **Database & Auth**: Firebase Authentication, Google Cloud Firestore
* **Image Hosting**: Cloudinary (unsigned upload preset api)
* **Mail Delivery**: SendGrid API
* **Weather Data**: OpenWeather 5-day Forecast API

---

## 📂 Project Architecture

```
community-hero/
├── frontend/                    # React + Vite + Tailwind
│   ├── src/
│   │   ├── contexts/AuthContext.jsx
│   │   ├── utils/cloudinary.js  # Cloudinary free uploads
│   │   ├── pages/               # Dashboard, Analytics, Accountability Page
│   │   ├── components/
│   │   │   ├── ui/              # Custom Badges, Status Pills, Issue Cards
│   │   │   ├── layout/          # Mobile-friendly Navigation
│   │   │   ├── chat/            # CivicBot Chat Panel
│   │   │   └── notifications/   # Real-time Notification Bell
│   │   └── firebase/config.js
├── backend/                     # FastAPI + Uvicorn
│   ├── main.py
│   ├── firebase_admin_config.py
│   ├── routers/                 # API Endpoints
│   │   ├── issues.py            # Duplicate check, AI reporting pipeline
│   │   ├── agent.py             # CivicBot router
│   │   ├── politicians.py       # Leaderboard and Analytics stats
│   │   ├── fraud.py             # AI before/after comparison
│   │   └── jobs.py              # Cloud Scheduler endpoints
│   ├── services/
│   │   ├── gemini_service.py    # Legacy SDK stable implementation
│   │   ├── complaint_letter.py  # SendGrid dispatch
│   │   ├── predictions.py       # Weather + historical risk engine
│   │   └── politician_service.py
│   └── seed/seed_politicians.py # Lucknow data seed script
├── firestore.rules
├── docker-compose.yml
└── README.md
```
