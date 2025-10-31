# Cube Wars Analytics Dashboard

A comprehensive analytics dashboard for Cube Wars mobile game, built with React, Express, and Google BigQuery.

## Features

### Rewarded Ads Analytics
- Track how many times each Rewarded Ad is watched
- Calculate average views per user
- View distribution of different rewarded ad types

### Level Analysis
- **Completion Rate**: Track average completion rate for each level
- **Attempts to Complete**: Monitor the average number of attempts users take to complete each level
- **Duration Analysis**: View average game duration for both completed and failed levels
- **Silver Coin Boost Impact**: Analyze the impact of silver coin rewards (from RV_Watched_Silver_Coin_Before_Game and RV_Watched_Silver_Coin_In_Game) on level completion rates

### Unit Analysis
- **Battle Start Loadout**:
  - View most used unit combinations in battle start loadouts
  - See which individual units are most frequently used
  - Top 20 most popular loadout combinations
- **Unit Upgrades**:
  - Track which units are most frequently upgraded
  - View average upgrade levels for each unit

### Churn Analysis
- **Hardest Level**: Identify the most difficult level based on failure rates and attempts
- **Maximum Churn Level**: Find the level where most users stop playing
- **Level-by-Level Data**: Detailed churn metrics for each level including:
  - Number of users who reached the level
  - Number of users who churned at that level
  - Churn rate percentage
  - Failure rate
  - Difficulty score

### Booster Box Analytics
- Track how many times each booster box is opened
- View statistics per box type

### Additional Analytics
- Base station upgrade statistics
- Overall game statistics
- Platform-specific filtering (iOS/Android)
- Date range filtering

## Architecture

This project follows the same architecture as the sample dashboard:

- **Backend**: Node.js with Express, BigQuery integration, Google OAuth authentication
- **Frontend**: React with Recharts for visualizations, Tailwind CSS for styling
- **Authentication**: Google OAuth with email whitelist
- **Database**: Google BigQuery (Firebase Analytics data)

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Google Cloud account with BigQuery access
- Firebase Analytics data streamed to BigQuery
- Google OAuth Client ID

## Installation

### 1. Clone or Download the Project

```bash
cd cube-wars-dashboard
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Copy the environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account-key.json
BIGQUERY_DATASET=your-project-id.analytics_XXXXXXXXX

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
JWT_SECRET=generate-a-long-random-string-here

PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Generate a secure JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Configure Email Whitelist

Edit `backend/middleware/auth.js` and add authorized email addresses:

```javascript
const ALLOWED_EMAILS = [
  'your-email@example.com',
  'teammate@example.com',
  // Add more emails as needed
];
```

### 4. Frontend Setup

```bash
cd ../frontend
npm install
```

Copy the environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env`:

```env
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_API_BASE_URL=http://localhost:8080/api
```

## Google Cloud Setup

### 1. Enable BigQuery API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable BigQuery API for your project
3. Ensure Firebase Analytics is streaming to BigQuery

### 2. Create Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Create a new service account
3. Grant it **BigQuery Data Viewer** and **BigQuery Job User** roles
4. Create and download a JSON key file
5. Save it securely and reference it in your backend `.env` file

### 3. Configure Google OAuth

1. Go to **APIs & Services** > **Credentials**
2. Create **OAuth 2.0 Client ID**
3. Configure OAuth consent screen
4. Add authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - Your production domain
5. Add authorized redirect URIs (same as origins)
6. Copy the Client ID to both backend and frontend `.env` files

## Running the Application

### Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

The application will open at `http://localhost:3000`

## API Endpoints

All endpoints require authentication except `/api/auth/*` and `/api/health`.

- `GET /api/health` - Health check
- `POST /api/auth/login` - Login with Google
- `POST /api/auth/logout` - Logout
- `GET /api/auth/check` - Check authentication status
- `GET /api/rewarded-ads` - Get rewarded ads analytics
- `GET /api/level-analysis` - Get level completion analysis
- `GET /api/level-silver-coin-boost` - Get silver coin boost impact
- `GET /api/unit-loadout-analysis` - Get unit loadout statistics
- `GET /api/unit-upgrade-analysis` - Get unit upgrade statistics
- `GET /api/churn-analysis` - Get churn analysis data
- `GET /api/booster-box-analysis` - Get booster box statistics
- `GET /api/base-station-analysis` - Get base station upgrades
- `GET /api/overall-stats` - Get overall game statistics

### Query Parameters

All analytics endpoints support:
- `startDate` - Start date (YYYY-MM-DD)
- `endDate` - End date (YYYY-MM-DD)
- `platform` - Platform filter (all/ios/android)

## Event Mapping

The dashboard tracks the following Firebase events:

### Rewarded Video Events
- All events starting with `RV_Watched_*`
- Includes: Victory Pack, Defeat Pack, Silver Coin (Before/In Game), Booster Box, Daily Spin Wheel, etc.

### Level Events
- `level_start` - When a level is started
- `level_complete` - When a level is completed (with duration)
- `level_fail` - When a level is failed (with duration)

### Unit Events
- `battle_start_loadout` - Tracks the 6 units used in battle start
- `unit_upgrade` - When a unit is upgraded

### Other Events
- `booster_box_opened` - When a booster box is opened
- `base_station_upgrade` - When base station is upgraded

## Additional Insights & Suggestions

Based on the events and typical mobile game analytics, here are additional insights the dashboard provides:

1. **Silver Coin Boost Effectiveness**: Analyzes whether users who watch silver coin ads (before or during game) have better completion rates. This helps you understand the value of this reward mechanism.

2. **Unit Meta Analysis**: By tracking which units are most used and most upgraded, you can understand the current game meta and identify if certain units need balancing.

3. **Difficulty Progression**: The churn analysis combined with level difficulty scores helps identify if your level difficulty curve is appropriate or if certain levels are creating unfair barriers.

4. **Monetization Opportunities**: The rewarded ads data shows which ad placements are most popular, helping optimize ad strategy and identify which rewards users value most.

5. **Engagement Patterns**: By analyzing attempts per level and completion rates, you can identify levels that create good challenge vs frustration.

## Production Deployment

### Backend (Google Cloud Run)

```bash
cd backend
gcloud run deploy cube-wars-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=$PROJECT_ID,BIGQUERY_DATASET=$DATASET,GOOGLE_CLIENT_ID=$CLIENT_ID,JWT_SECRET=$JWT_SECRET,NODE_ENV=production,FRONTEND_URL=https://your-domain.com"
```

### Frontend (Firebase Hosting)

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

Update your `.env` files with production URLs and ensure Google OAuth authorized origins include your production domains.

## Security Considerations

- Keep `.env` files secure and never commit them to version control
- Use strong JWT secrets (64+ characters)
- Regularly review the email whitelist
- Use HTTPS in production
- Keep dependencies updated

## Troubleshooting

### "Access denied" error
- Verify your email is in the `ALLOWED_EMAILS` array in `backend/middleware/auth.js`
- Restart the backend server after updating the whitelist

### BigQuery errors
- Ensure your service account has proper permissions
- Verify the dataset path in your `.env` file
- Check that Firebase Analytics is correctly streaming to BigQuery

### CORS errors
- Ensure `FRONTEND_URL` in backend `.env` matches your frontend URL
- Check CORS configuration in `backend/server.js`

## Support

For issues or questions, please check:
1. The event mapping in the Firebase Events Excel file
2. BigQuery dataset structure
3. Service account permissions

## License

This project is for internal use. All rights reserved.
