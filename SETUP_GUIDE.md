# Cube Wars Analytics Dashboard - Setup Guide

This guide will walk you through setting up the Cube Wars Analytics Dashboard step by step.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Google Cloud Setup](#google-cloud-setup)
3. [Project Installation](#project-installation)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [Deployment](#deployment)

## Prerequisites

Before you begin, ensure you have:

- [ ] Node.js (v14 or higher) installed
- [ ] npm or yarn installed
- [ ] A Google Cloud account
- [ ] Firebase project with Analytics enabled
- [ ] Firebase Analytics data streaming to BigQuery
- [ ] Access to Google Cloud Console

## Google Cloud Setup

### Step 1: Enable Required APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the same one used for Firebase)
3. Navigate to **APIs & Services** > **Library**
4. Enable the following APIs:
   - BigQuery API
   - Cloud Run API (if deploying to Cloud Run)

### Step 2: Verify BigQuery Dataset

1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. In the Explorer panel, find your project
3. Look for a dataset named `analytics_XXXXXXXXX` (where X's are numbers)
4. Click on it and verify you can see tables like `events_20241030` (date-based)
5. Copy the full dataset path: `your-project-id.analytics_XXXXXXXXX`

### Step 3: Create Service Account

1. Navigate to **IAM & Admin** > **Service Accounts**
2. Click **+ CREATE SERVICE ACCOUNT**
3. Service account details:
   - Name: `cube-wars-analytics`
   - Description: "Service account for Cube Wars Analytics Dashboard"
   - Click **CREATE AND CONTINUE**
4. Grant permissions:
   - Add role: **BigQuery Data Viewer**
   - Add role: **BigQuery Job User**
   - Click **CONTINUE**
5. Skip the "Grant users access" step, click **DONE**
6. Find your new service account in the list and click on it
7. Go to the **KEYS** tab
8. Click **ADD KEY** > **Create new key**
9. Choose **JSON** format
10. Click **CREATE** - this will download a JSON file
11. **IMPORTANT**: Save this file securely. You'll need it for the backend configuration

### Step 4: Configure Google OAuth

1. Go to **APIs & Services** > **Credentials**
2. If you haven't configured the OAuth consent screen:
   - Click **CONFIGURE CONSENT SCREEN**
   - Choose **Internal** (if using Google Workspace) or **External**
   - Fill in required fields:
     - App name: "Cube Wars Analytics Dashboard"
     - User support email: Your email
     - Developer contact: Your email
   - Click **SAVE AND CONTINUE**
   - Skip the Scopes step
   - Add test users if using External type
   - Click **SAVE AND CONTINUE**

3. Create OAuth 2.0 Client ID:
   - Click **+ CREATE CREDENTIALS** > **OAuth client ID**
   - Application type: **Web application**
   - Name: "Cube Wars Analytics Dashboard"
   - Authorized JavaScript origins:
     - Click **+ ADD URI**
     - Add: `http://localhost:3000`
     - For production, add your domain: `https://your-domain.com`
   - Authorized redirect URIs:
     - Click **+ ADD URI**
     - Add: `http://localhost:3000`
     - For production, add your domain: `https://your-domain.com`
   - Click **CREATE**
   - **Copy the Client ID** - you'll need this for both backend and frontend

## Project Installation

### Step 1: Install Backend Dependencies

```bash
cd ~/cube-wars-dashboard/backend
npm install
```

This will install:
- Express (web server)
- BigQuery client library
- Google authentication library
- CORS, cookie-parser, JWT, etc.

### Step 2: Install Frontend Dependencies

```bash
cd ~/cube-wars-dashboard/frontend
npm install
```

This will install:
- React and React DOM
- Recharts (for visualizations)
- Tailwind CSS (for styling)
- Google OAuth library
- Lucide React (for icons)

## Configuration

### Step 1: Backend Configuration

1. Navigate to the backend folder:
   ```bash
   cd ~/cube-wars-dashboard/backend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Move your Google Cloud service account JSON key file to the backend folder:
   ```bash
   # Example - adjust the path to where you downloaded the file
   mv ~/Downloads/your-service-account-key.json ./cube-wars-service-account.json
   ```

4. Open `.env` in a text editor and configure:

   ```env
   # Your Google Cloud Project ID
   GOOGLE_CLOUD_PROJECT_ID=your-project-id

   # Path to service account key (relative to backend folder)
   GOOGLE_CLOUD_KEY_FILE=./cube-wars-service-account.json

   # BigQuery dataset (from Step 2 of Google Cloud Setup)
   BIGQUERY_DATASET=your-project-id.analytics_XXXXXXXXX

   # Google OAuth Client ID (from Step 4 of Google Cloud Setup)
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

   # Generate a secure JWT secret (see below)
   JWT_SECRET=your-generated-secret-here

   PORT=8080
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

5. Generate a secure JWT secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```
   Copy the output and paste it as your `JWT_SECRET` value

### Step 2: Configure Email Whitelist

1. Open `backend/middleware/auth.js`
2. Find the `ALLOWED_EMAILS` array (around line 6)
3. Add your email addresses:

   ```javascript
   const ALLOWED_EMAILS = [
     'your-email@gmail.com',
     'teammate@company.com',
     'admin@yourdomain.com',
     // Add more authorized emails here
   ];
   ```

4. Save the file

### Step 3: Frontend Configuration

1. Navigate to the frontend folder:
   ```bash
   cd ~/cube-wars-dashboard/frontend
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Open `.env` and configure:

   ```env
   # Same Google OAuth Client ID used in backend
   REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

   # Backend API URL
   REACT_APP_API_BASE_URL=http://localhost:8080/api
   ```

## Running the Application

### Step 1: Start the Backend

Open a terminal and run:

```bash
cd ~/cube-wars-dashboard/backend
npm start
```

You should see:
```
Cube Wars Analytics API running on port 8080
```

If you see errors:
- Check that your `.env` file is properly configured
- Verify the service account JSON file path is correct
- Ensure all required npm packages are installed

### Step 2: Start the Frontend

Open a **second terminal** and run:

```bash
cd ~/cube-wars-dashboard/frontend
npm start
```

This will:
- Start the React development server
- Automatically open your browser to `http://localhost:3000`

### Step 3: Login

1. You should see the login page
2. Click "Sign in with Google"
3. Choose a Google account
4. If your email is in the whitelist, you'll be logged in
5. If not, you'll see "Access denied" - add your email to the whitelist and restart the backend

### Step 4: Explore the Dashboard

Once logged in, you can:
- Use the date filters to select a date range
- Select platform (All/iOS/Android)
- Navigate between tabs:
  - **Overview**: High-level metrics and charts
  - **Rewarded Ads**: Detailed rewarded ads analytics
  - **Level Analysis**: Level completion, attempts, and silver coin boost impact
  - **Unit Analysis**: Unit loadout and upgrade statistics
  - **Churn Analysis**: User retention and level difficulty
  - **Other Analytics**: Booster boxes and base station upgrades

## Deployment

### Deploying to Google Cloud Run (Backend)

1. Install Google Cloud SDK if you haven't:
   ```bash
   # macOS
   brew install google-cloud-sdk

   # Or download from: https://cloud.google.com/sdk/docs/install
   ```

2. Authenticate:
   ```bash
   gcloud auth login
   gcloud config set project your-project-id
   ```

3. Deploy:
   ```bash
   cd ~/cube-wars-dashboard/backend

   gcloud run deploy cube-wars-api \
     --source . \
     --platform managed \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=your-project-id,BIGQUERY_DATASET=your-project-id.analytics_XXXXXXXXX,GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com,JWT_SECRET=your-jwt-secret,NODE_ENV=production,FRONTEND_URL=https://your-frontend-domain.com"
   ```

4. Note the service URL provided (e.g., `https://cube-wars-api-xxxxx-uc.a.run.app`)

### Deploying to Firebase Hosting (Frontend)

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase (if not already done):
   ```bash
   cd ~/cube-wars-dashboard/frontend
   firebase init hosting
   ```
   - Select your Firebase project
   - Build directory: `build`
   - Single-page app: Yes
   - Setup automatic builds: No

4. Update `.env` for production:
   ```env
   REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   REACT_APP_API_BASE_URL=https://cube-wars-api-xxxxx-uc.a.run.app/api
   ```

5. Build and deploy:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

6. Update Google OAuth settings:
   - Go to Google Cloud Console > Credentials
   - Edit your OAuth Client ID
   - Add your Firebase Hosting URL to authorized origins and redirect URIs

## Testing Checklist

After setup, verify:

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can access login page
- [ ] Google OAuth login works
- [ ] Dashboard loads after login
- [ ] Date filters work
- [ ] Platform filter works
- [ ] All tabs load data correctly
- [ ] Charts and tables display properly
- [ ] Logout works

## Troubleshooting

### Backend won't start

**Error**: "Cannot find module '@google-cloud/bigquery'"
- Solution: Run `npm install` in the backend folder

**Error**: "GOOGLE_CLIENT_ID is not defined"
- Solution: Check that `.env` file exists and is properly configured

**Error**: "Service account key file not found"
- Solution: Verify the path in `GOOGLE_CLOUD_KEY_FILE` is correct

### Frontend won't start

**Error**: "Cannot find module 'react'"
- Solution: Run `npm install` in the frontend folder

**Error**: "REACT_APP_GOOGLE_CLIENT_ID is undefined"
- Solution: Check that `.env` file exists in frontend folder

### Login issues

**Error**: "Access denied"
- Solution: Add your email to `ALLOWED_EMAILS` in `backend/middleware/auth.js` and restart backend

**Error**: "Invalid Google token"
- Solution: Verify `GOOGLE_CLIENT_ID` matches in both backend and frontend `.env` files

### No data showing

**Issue**: Dashboard loads but shows empty charts
- Check date range - data might not exist for selected dates
- Verify BigQuery dataset has data
- Check browser console for errors

### CORS errors

**Error**: "CORS policy: No 'Access-Control-Allow-Origin' header"
- Solution: Ensure backend `.env` has correct `FRONTEND_URL`
- Verify CORS configuration in `backend/server.js`

## Next Steps

After successful setup:

1. **Add Team Members**: Update the email whitelist to give access to your team
2. **Customize Date Range**: Adjust default date range in the frontend if needed
3. **Monitor Usage**: Check BigQuery quotas and costs
4. **Set Up Monitoring**: Consider setting up Cloud Monitoring for the backend
5. **Schedule Regular Reviews**: Use the dashboard regularly to inform game design decisions

## Support

If you encounter issues not covered in this guide:

1. Check the main README.md for additional information
2. Verify all environment variables are correct
3. Check that your Google Cloud project has billing enabled
4. Ensure Firebase Analytics is actively collecting data

---

**Congratulations!** Your Cube Wars Analytics Dashboard should now be running. Happy analyzing!
