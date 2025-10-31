# Quick Start Guide - Cube Wars Analytics Dashboard

Get your dashboard up and running in 15 minutes!

## Prerequisites Checklist

Before starting, ensure you have:
- ✅ Node.js installed (check: `node --version`)
- ✅ Google Cloud project with Firebase Analytics
- ✅ Firebase Analytics streaming to BigQuery
- ✅ 15 minutes of time

## Quick Setup (TL;DR)

```bash
# 1. Install dependencies
cd ~/cube-wars-dashboard/backend && npm install
cd ~/cube-wars-dashboard/frontend && npm install

# 2. Configure backend
cd ~/cube-wars-dashboard/backend
cp .env.example .env
# Edit .env with your values
# Add emails to middleware/auth.js

# 3. Configure frontend
cd ~/cube-wars-dashboard/frontend
cp .env.example .env
# Edit .env with your values

# 4. Run
# Terminal 1:
cd ~/cube-wars-dashboard/backend && npm start

# Terminal 2:
cd ~/cube-wars-dashboard/frontend && npm start
```

## Detailed Steps

### 1. Get Google Cloud Credentials (5 minutes)

**Service Account Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: IAM & Admin > Service Accounts
3. Create service account with BigQuery roles
4. Download JSON key
5. Save to `backend/` folder

**OAuth Client ID:**
1. Go to: APIs & Services > Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Authorized origins: `http://localhost:3000`
4. Copy the Client ID

**BigQuery Dataset:**
1. Go to [BigQuery Console](https://console.cloud.google.com/bigquery)
2. Find dataset like `analytics_XXXXXXXXX`
3. Copy full path: `project-id.analytics_XXXXXXXXX`

### 2. Backend Setup (3 minutes)

```bash
cd ~/cube-wars-dashboard/backend
npm install
cp .env.example .env
```

Edit `.env`:
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=./your-service-account-key.json
BIGQUERY_DATASET=your-project-id.analytics_XXXXXXXXX
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
PORT=8080
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

Edit `middleware/auth.js`:
```javascript
const ALLOWED_EMAILS = [
  'your-email@gmail.com',  // ← Add your email here
];
```

### 3. Frontend Setup (2 minutes)

```bash
cd ~/cube-wars-dashboard/frontend
npm install
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_API_BASE_URL=http://localhost:8080/api
```

### 4. Start Everything (1 minute)

**Terminal 1 - Backend:**
```bash
cd ~/cube-wars-dashboard/backend
npm start
```
Wait for: `Cube Wars Analytics API running on port 8080`

**Terminal 2 - Frontend:**
```bash
cd ~/cube-wars-dashboard/frontend
npm start
```
Browser opens automatically to `http://localhost:3000`

### 5. Login & Explore (4 minutes)

1. Click "Sign in with Google"
2. Select your whitelisted account
3. Explore the tabs:
   - Overview: Quick stats
   - Rewarded Ads: Ad performance
   - Level Analysis: Level difficulty and progression
   - Unit Analysis: Meta and upgrades
   - Churn Analysis: Where players quit
   - Other Analytics: Booster boxes and upgrades

## Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| "Access denied" | Add email to `backend/middleware/auth.js` and restart backend |
| Port already in use | Change PORT in backend `.env` |
| BigQuery errors | Verify dataset path and service account permissions |
| CORS errors | Check FRONTEND_URL in backend `.env` |
| No data showing | Verify date range has data in BigQuery |

## What to Check First

After logging in, verify:
1. **Overview tab loads** → Backend connected to BigQuery ✓
2. **Numbers appear** → Data is being fetched ✓
3. **Charts render** → Frontend visualization working ✓
4. **Filters work** → Apply filters and click "Apply Filters" ✓

## Next Steps

✅ **Working?** Great! Read [FEATURES.md](FEATURES.md) to understand all capabilities

📚 **Need Help?** See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed troubleshooting

🚀 **Ready to Deploy?** Check [README.md](README.md) for production deployment

## File Structure Reference

```
cube-wars-dashboard/
├── backend/
│   ├── middleware/
│   │   └── auth.js          ← Add emails here
│   ├── routes/
│   │   └── auth.js
│   ├── .env                 ← Configure this
│   ├── .env.example
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Login.js
│   │   ├── contexts/
│   │   │   └── AuthContext.js
│   │   ├── App.js
│   │   ├── index.js
│   │   └── config.js
│   ├── .env                 ← Configure this
│   ├── .env.example
│   └── package.json
├── README.md                ← Full documentation
├── SETUP_GUIDE.md          ← Detailed setup
├── FEATURES.md             ← Feature explanation
└── QUICK_START.md          ← You are here
```

## Environment Variables Quick Reference

**Backend `.env`:**
```
GOOGLE_CLOUD_PROJECT_ID      → From Google Cloud Console
GOOGLE_CLOUD_KEY_FILE        → Path to JSON key file
BIGQUERY_DATASET             → From BigQuery Console
GOOGLE_CLIENT_ID             → From OAuth Credentials
JWT_SECRET                   → Generate with Node.js
PORT                         → 8080 (or your preference)
NODE_ENV                     → development
FRONTEND_URL                 → http://localhost:3000
```

**Frontend `.env`:**
```
REACT_APP_GOOGLE_CLIENT_ID   → Same as backend
REACT_APP_API_BASE_URL       → http://localhost:8080/api
```

## Testing Your Setup

Run these checks:

```bash
# Check Node.js version (should be 14+)
node --version

# Check if ports are available
lsof -ti:8080  # Should be empty
lsof -ti:3000  # Should be empty

# Test backend connection
curl http://localhost:8080/api/health
# Should return: {"status":"OK","timestamp":"..."}
```

## Dashboard Usage Tips

1. **Set Date Range First**: Default is last 7 days, adjust as needed
2. **Use Platform Filter**: Compare iOS vs Android
3. **Check Churn Tab**: Most critical for retention insights
4. **Monitor Level Analysis**: Identify difficulty spikes
5. **Review Weekly**: Check trends and make adjustments

## Getting the Most Value

**Daily (2 min):**
- Check Overview tab
- Note any unusual metrics

**Weekly (15 min):**
- Review all tabs
- Check for concerning trends
- Identify improvement opportunities

**Monthly (1 hour):**
- Deep dive analysis
- Compare month-over-month
- Plan balancing changes

## Support & Resources

- 📖 Full Documentation: [README.md](README.md)
- 🔧 Troubleshooting: [SETUP_GUIDE.md](SETUP_GUIDE.md)
- 📊 Features Explained: [FEATURES.md](FEATURES.md)
- 🎮 Game Play Store: [Cube Wars](https://play.google.com/store/apps/details?id=com.Snackgamer.CubeWars)

## Ready?

Let's get started! Follow the steps above and you'll have your analytics dashboard running in no time.

**Pro Tip**: Keep both terminals open in split view so you can see backend logs while using the frontend. This helps with debugging.

---

Happy analyzing! 🎮📊
