# Community Hero — Google Cloud Deployment Guide

This guide will walk you through deploying both the **FastAPI backend** and the **React frontend** directly to **Google Cloud Run** using your web browser (no local CLI installations needed).

---

## 🛠️ Prerequisites
1. **GitHub Repository**: Push your code to your repository: `https://github.com/IqraKhanZ/Community-Hero`
2. **Google Cloud Account**: A GCP project with billing enabled (required for Cloud Run builds).

---

## ⚙️ Step 1 — Deploy the Backend to Cloud Run
The backend runs the API, handles Firebase verification, and processes Gemini AI requests.

1. Go to the **[Google Cloud Run Console](https://console.cloud.google.com/run)**.
2. Click **"Create Service"**.
3. Select **"Continuously deploy from a repository"** → Click **"Set up with Cloud Build"**.
4. In the sidebar:
   * **Repository Provider**: Select **GitHub**.
   * **Repository**: Select `IqraKhanZ/Community-Hero`.
   * Click **Next**.
5. In **Build Configuration**:
   * **Branch**: `main`
   * **Build Type**: Select **Dockerfile**.
   * **Source Directory**: Type `/backend` *(this is where the backend code and Dockerfile live)*.
   * Click **Save**.
6. Back on the Service Settings page:
   * **Service Name**: `community-hero-backend`
   * **Region**: Select `asia-south1 (Mumbai)` or `us-central1`.
   * **CPU Allocation**: Select **"CPU is only allocated during request processing"** (saves money).
   * **Ingress**: Select **"Allow all traffic"**.
   * **Authentication**: Select **"Allow unauthenticated invocations"** (we use Firebase JWT tokens to secure specific endpoints).
7. Expand **"Container, volumes, connections, security"**:
   * In the **Variables** tab, click **Add Variable** for each env key in your `backend/.env`:
     * `GEMINI_API_KEY` = *Your Gemini Key*
     * `SENDGRID_API_KEY` = *Your SendGrid Key*
     * `SENDGRID_FROM_EMAIL` = *Your Verified Sender Email*
     * `SENDGRID_FROM_NAME` = `Community Hero`
     * `OPENWEATHER_API_KEY` = *Your OpenWeather Key*
     * `CITY_NAME` = `Lucknow`
     * `CITY_LAT` = `26.8467`
     * `CITY_LON` = `80.9462`
     * `JOB_SECRET_TOKEN` = `lsbqzfkd4mtihn5ogyjax027ew9831uc`
     * `FIREBASE_SERVICE_ACCOUNT_PATH` = `serviceAccountKey.json`
8. Click **"Create"**.

> 💡 Cloud Run will build and launch your backend container. Copy the **Service URL** once it completes (e.g. `https://community-hero-backend-xxxx.a.run.app`).

---

## 🖥️ Step 2 — Deploy the Frontend to Cloud Run
The frontend displays the Leaflet maps, forms, and charts.

1. Go back to the **[Google Cloud Run Console](https://console.cloud.google.com/run)**.
2. Click **"Create Service"**.
3. Select **"Continuously deploy from a repository"** → Click **"Set up with Cloud Build"**.
4. Configure the same GitHub repository:
   * **Repository**: `IqraKhanZ/Community-Hero`
   * Click **Next**.
5. In **Build Configuration**:
   * **Branch**: `main`
   * **Build Type**: Select **Dockerfile**.
   * **Source Directory**: Type `/frontend` *(this is where the frontend code, production Dockerfile, and Nginx settings live)*.
   * Click **Save**.
6. Back on the Service Settings page:
   * **Service Name**: `community-hero-frontend`
   * **Region**: Match the backend region (e.g., `asia-south1` or `us-central1`).
   * **CPU Allocation**: Select **"CPU is only allocated during request processing"**.
   * **Ingress**: Select **"Allow all traffic"**.
   * **Authentication**: Select **"Allow unauthenticated invocations"**.
7. Expand **"Container, volumes, connections, security"**:
   * In the **Variables** tab, add your frontend env variables (matching your local `frontend/.env`):
     * `VITE_FIREBASE_API_KEY` = *Your Firebase API Key*
     * `VITE_FIREBASE_AUTH_DOMAIN` = `community-hero-94069.firebaseapp.com`
     * `VITE_FIREBASE_PROJECT_ID` = `community-hero-94069`
     * `VITE_FIREBASE_MESSAGING_SENDER_ID` = `208507941379`
     * `VITE_FIREBASE_APP_ID` = `1:208507941379:web:87345d1f2ebf304df81436`
     * `VITE_CLOUDINARY_CLOUD_NAME` = `dooj4emku`
     * `VITE_CLOUDINARY_UPLOAD_PRESET` = `community_hero`
     * `VITE_BACKEND_URL` = *Paste the Backend Cloud Run Service URL from Step 1*
8. Click **"Create"**.

> 💡 Cloud Run will build your frontend container, compile the React assets using Nginx, and launch. You will receive a **Frontend Service URL** (e.g., `https://community-hero-frontend-xxxx.a.run.app`).

---

## 🔄 Step 3 — Final Environment Sync
For safety and security:
1. Copy the **Frontend Service URL** from Step 2.
2. Go back to your **Backend Cloud Run Service** → **Edit & Deploy New Revision**.
3. Under Environment Variables, update **`FRONTEND_URL`** to match your new Frontend Service URL (so CORS requests are allowed).
4. Click **Deploy**.

---

### 🎉 Done!
Your application is fully hosted on Google Cloud! Every time you `git push` to your GitHub repo, Cloud Run will automatically rebuild and deploy your changes.
