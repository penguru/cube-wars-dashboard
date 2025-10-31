# Cube Wars Dashboard - Deployment Guide

## Overview
This guide will help you deploy:
- **Frontend**: React app to Firebase Hosting
- **Backend**: Node.js API to Google Cloud Run

## Prerequisites
- Firebase CLI installed ✅
- Google Cloud SDK (`gcloud` CLI) - Install from: https://cloud.google.com/sdk/docs/install
- Logged in to both Firebase and gcloud

## Step 1: Deploy Backend to Cloud Run

### 1.1 Login to Google Cloud
```bash
gcloud auth login
gcloud config set project cube-wars-15b73
```

### 1.2 Enable Required APIs
```bash
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 1.3 Deploy to Cloud Run
```bash
cd backend

# Build and deploy in one command
gcloud run deploy cube-wars-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=cube-wars-15b73,GOOGLE_CLOUD_KEY_FILE=./cube-wars-service-account.json,BIGQUERY_DATASET=cube-wars-15b73.analytics_478520406,GOOGLE_CLIENT_ID=794254735646-tafe7sqf4oh86dc3iqvt0l0ss2a6amgt.apps.googleusercontent.com,JWT_SECRET=465b12c89e8c8d625b5127210eaa45106255c68797aed02074959207b6a907416d8973719899e62dfc7b454ffd879ecb9774159e309102f6b256f0fb0e594c9d,NODE_ENV=production"
```

After deployment, you'll get a URL like: `https://cube-wars-api-xxxxx-uc.a.run.app`

**IMPORTANT**: Copy this URL - you'll need it for the frontend configuration!

### 1.4 Update CORS Settings
After you get the Cloud Run URL, you need to update the backend CORS settings to allow your Firebase Hosting domain.

You'll get your Firebase URL after deployment (Step 2), then update `backend/server.js` line 19-25:
```javascript
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://cube-wars-15b73.web.app',  // Add your Firebase URL here
    'https://cube-wars-15b73.firebaseapp.com',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
```

Then redeploy:
```bash
gcloud run deploy cube-wars-api --source .
```

## Step 2: Update Frontend Configuration

Update the frontend to use the Cloud Run backend URL:

```bash
cd ../frontend
```

Edit `.env` file:
```env
REACT_APP_GOOGLE_CLIENT_ID=794254735646-tafe7sqf4oh86dc3iqvt0l0ss2a6amgt.apps.googleusercontent.com
REACT_APP_API_BASE_URL=https://cube-wars-api-xxxxx-uc.a.run.app/api
```

Replace `https://cube-wars-api-xxxxx-uc.a.run.app` with your actual Cloud Run URL.

Rebuild the frontend:
```bash
npm run build
```

## Step 3: Deploy Frontend to Firebase Hosting

### 3.1 Login to Firebase
```bash
firebase login
```

### 3.2 Deploy
```bash
cd ..
firebase deploy --only hosting
```

After deployment, you'll get a URL like:
- **Hosting URL**: `https://cube-wars-15b73.web.app`

## Step 4: Update Google OAuth Settings

Go to Google Cloud Console OAuth settings:
https://console.cloud.google.com/apis/credentials

Update your OAuth 2.0 Client ID:

**Authorized JavaScript origins**:
- `https://cube-wars-15b73.web.app`
- `https://cube-wars-15b73.firebaseapp.com`
- `https://cube-wars-api-xxxxx-uc.a.run.app`

**Authorized redirect URIs**:
- `https://cube-wars-15b73.web.app`
- `https://cube-wars-15b73.firebaseapp.com`

## Step 5: Set Environment Variables in Cloud Run (Alternative Method)

If you prefer to use Secret Manager for sensitive data:

```bash
# Store JWT secret
echo -n "465b12c89e8c8d625b5127210eaa45106255c68797aed02074959207b6a907416d8973719899e62dfc7b454ffd879ecb9774159e309102f6b256f0fb0e594c9d" | gcloud secrets create jwt-secret --data-file=-

# Update Cloud Run service to use secret
gcloud run services update cube-wars-api \
  --update-secrets=JWT_SECRET=jwt-secret:latest
```

## Deployment Summary

After completing all steps:

1. ✅ Backend API: `https://cube-wars-api-xxxxx-uc.a.run.app`
2. ✅ Frontend App: `https://cube-wars-15b73.web.app`
3. ✅ OAuth configured for production URLs
4. ✅ CORS configured to allow frontend domain

## Troubleshooting

### Issue: "Cannot find module 'express'"
Solution: The Cloud Run deployment automatically installs dependencies. Make sure `package.json` is correct.

### Issue: CORS errors
Solution: Update `backend/server.js` CORS settings to include your Firebase Hosting URL.

### Issue: 401 Unauthorized
Solution: Check that OAuth origins are correctly configured in Google Cloud Console.

### Issue: BigQuery access denied
Solution: Ensure the service account has BigQuery Data Viewer role:
```bash
gcloud projects add-iam-policy-binding cube-wars-15b73 \
  --member="serviceAccount:cube-wars-analytics@cube-wars-15b73.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataViewer"
```

## Continuous Deployment

For future updates:

**Backend**:
```bash
cd backend
gcloud run deploy cube-wars-api --source .
```

**Frontend**:
```bash
cd frontend
npm run build
cd ..
firebase deploy --only hosting
```

## Viewing Logs

**Backend logs**:
```bash
gcloud run logs read cube-wars-api --limit=100
```

**Frontend logs**: Check Firebase Console > Hosting

## Cost Estimation

- **Firebase Hosting**: Free tier includes 10GB storage, 360MB/day bandwidth
- **Cloud Run**: Free tier includes 2 million requests/month
- **BigQuery**: $5/TB queried (you control costs with query limits)

Most likely you'll stay within free tier limits for a dashboard with moderate usage.
