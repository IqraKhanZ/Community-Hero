# Community Hero — Free Hosting Deployment Guide
## 🛑 100% Free · No Credit Cards · No Billing Accounts Needed

This guide will show you how to deploy your app for free using **Render** (for the backend) and **Vercel** (for the frontend). Both services connect directly to GitHub and require zero payment setup.

---

## 📦 Step 1 — Push Your Code to GitHub
Ensure all your local changes are committed and pushed to your repository:
```bash
git push -u origin main
```

---

## ⚙️ Step 2 — Deploy the Backend on Render (Free Tier)
Render will host your FastAPI server. Render is free and automatically runs your code directly from GitHub.

1. Go to **[https://render.com](https://render.com)** and sign up using your **GitHub account**.
2. On the dashboard, click **"New +"** (top right) → select **"Web Service"**.
3. Choose **"Build and deploy from a Git repository"** → Click **Next**.
4. Connect your `Community-Hero` repository from the list.
5. Configure the Web Service:
   * **Name**: `community-hero-backend`
   * **Region**: Select the closest region (e.g., `Singapore (Southeast Asia)`)
   * **Branch**: `main`
   * **Root Directory**: `backend` *(tells Render to look inside the backend folder)*
   * **Language**: `Python 3` (or `Docker` since we have a Dockerfile, but Python 3 is faster and uses less RAM on Render's free tier)
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Scroll down and select the **Free** instance type.
7. Click the **"Advanced"** button to add Environment Variables matching your local `.env`:
   * `GEMINI_API_KEY` = *Your Gemini API Key*
   * `SENDGRID_API_KEY` = *Your SendGrid API Key*
   * `SENDGRID_FROM_EMAIL` = *Your verified SendGrid sender email*
   * `SENDGRID_FROM_NAME` = `Community Hero`
   * `OPENWEATHER_API_KEY` = *Your OpenWeather API Key*
   * `CITY_NAME` = `Lucknow`
   * `CITY_LAT` = `26.8467`
   * `CITY_LON` = `80.9462`
   * `JOB_SECRET_TOKEN` = `lsbqzfkd4mtihn5ogyjax027ew9831uc`
   * `FIREBASE_SERVICE_ACCOUNT_PATH` = `serviceAccountKey.json`
8. Click **"Create Web Service"**.

> ⏰ Render will install packages and launch the FastAPI server. 
> Copy your new live Backend URL once complete (e.g. `https://community-hero-backend.onrender.com`).
> *Note: Free instances on Render go to sleep after 15 minutes of inactivity. When you make the first request after a while, it takes ~50 seconds to wake up. This is normal for the free tier.*

---

## 🖥️ Step 3 — Deploy the Frontend on Vercel (Free Tier)
Vercel is the industry standard for React hosting. It compiles your code and serves it globally on a fast CDN for free.

1. Go to **[https://vercel.com](https://vercel.com)** and sign up using your **GitHub account**.
2. Click **"Add New..."** → **"Project"**.
3. Select your `Community-Hero` repository and click **"Import"**.
4. In the Project Configuration:
   * **Framework Preset**: Select **Vite** (it should auto-detect this).
   * **Root Directory**: Click Edit and select the `frontend` folder.
   * **Build and Output Settings**: Leave as default.
5. Click **"Environment Variables"** and paste the keys from your local `frontend/.env`:
   * `VITE_FIREBASE_API_KEY` = *Your Firebase API Key*
   * `VITE_FIREBASE_AUTH_DOMAIN` = `community-hero-94069.firebaseapp.com`
   * `VITE_FIREBASE_PROJECT_ID` = `community-hero-94069`
   * `VITE_FIREBASE_MESSAGING_SENDER_ID` = `208507941379`
   * `VITE_FIREBASE_APP_ID` = `1:208507941379:web:87345d1f2ebf304df81436`
   * `VITE_CLOUDINARY_CLOUD_NAME` = `dooj4emku`
   * `VITE_CLOUDINARY_UPLOAD_PRESET` = `community_hero`
   * `VITE_BACKEND_URL` = *Paste the Render Backend URL from Step 2 (make sure there's no trailing slash `/` at the end)*
6. Click **"Deploy"**.

> 🎉 Vercel will build your static files and give you a live URL (e.g. `https://community-hero-frontend.vercel.app`).

---

## 🔄 Step 4 — Update Backend CORS (Crucial)
To allow your backend on Render to accept requests from your frontend on Vercel:

1. Go to your **Render Dashboard** → click your `community-hero-backend` service.
2. Go to **Settings** → scroll down to the **Environment Variables** section.
3. Update the variable **`FRONTEND_URL`** to match your new **Vercel frontend URL** (e.g., `https://community-hero-frontend.vercel.app`).
4. Save the changes. Render will automatically redeploy the backend.

You are now fully live on the web for free! 🚀
