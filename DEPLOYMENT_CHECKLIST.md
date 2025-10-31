# Deployment Checklist - Cube Wars Analytics Dashboard

Use this checklist when deploying to production.

## Pre-Deployment Checklist

### Google Cloud Setup
- [ ] Google Cloud project created
- [ ] Billing enabled on project
- [ ] BigQuery API enabled
- [ ] Cloud Run API enabled
- [ ] Firebase Analytics streaming to BigQuery verified
- [ ] Service account created with BigQuery permissions
- [ ] Service account JSON key downloaded and secured
- [ ] OAuth Client ID created
- [ ] OAuth consent screen configured

### Local Testing Complete
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Login works with Google OAuth
- [ ] All 6 dashboard tabs load successfully
- [ ] Data appears correctly in all visualizations
- [ ] Filters work (date range, platform)
- [ ] Logout works correctly
- [ ] No console errors in browser
- [ ] API endpoints return expected data

### Code & Configuration
- [ ] `.env` files NOT committed to git (in .gitignore)
- [ ] Service account JSON key NOT committed to git
- [ ] Strong JWT_SECRET generated (64+ characters)
- [ ] Email whitelist configured in `backend/middleware/auth.js`
- [ ] Dependencies up to date (`npm update`)
- [ ] No hardcoded credentials in code

## Backend Deployment (Google Cloud Run)

### Preparation
- [ ] Install Google Cloud SDK: `gcloud --version`
- [ ] Authenticate: `gcloud auth login`
- [ ] Set project: `gcloud config set project YOUR_PROJECT_ID`
- [ ] Test locally one more time

### Environment Variables for Production
Create a list of your production environment variables:

```bash
GOOGLE_CLOUD_PROJECT_ID=_______________
BIGQUERY_DATASET=_____________________
GOOGLE_CLIENT_ID=_____________________
JWT_SECRET=___________________________  # Use a NEW secret for production!
NODE_ENV=production
FRONTEND_URL=_________________________ # Your Firebase Hosting URL
```

### Deploy Command
- [ ] Navigate to backend folder
- [ ] Run deployment command:

```bash
cd ~/cube-wars-dashboard/backend

gcloud run deploy cube-wars-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT_ID=YOUR_PROJECT_ID,BIGQUERY_DATASET=YOUR_DATASET,GOOGLE_CLIENT_ID=YOUR_CLIENT_ID,JWT_SECRET=YOUR_PRODUCTION_JWT_SECRET,NODE_ENV=production,FRONTEND_URL=YOUR_FRONTEND_URL"
```

- [ ] Deployment successful
- [ ] Service URL received (save it): `https://cube-wars-api-xxxxx-uc.a.run.app`
- [ ] Test health endpoint: `curl https://YOUR_SERVICE_URL/api/health`

### Post-Deployment Backend Tests
- [ ] Health check returns OK: `/api/health`
- [ ] Auth endpoints accessible: `/api/auth/check`
- [ ] Service is running

## Frontend Deployment (Firebase Hosting)

### Preparation
- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] Login: `firebase login`
- [ ] Test backend is deployed and running

### Initialize Firebase (if not already done)
- [ ] Navigate to frontend folder
- [ ] Run: `firebase init hosting`
  - [ ] Select your Firebase project
  - [ ] Public directory: `build`
  - [ ] Single-page app: Yes
  - [ ] GitHub deploys: No (or configure if desired)

### Configure Production Environment
- [ ] Create/update `.env` with production values:

```env
REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
REACT_APP_API_BASE_URL=https://cube-wars-api-xxxxx-uc.a.run.app/api
```

### Build & Deploy
- [ ] Build production bundle:
```bash
cd ~/cube-wars-dashboard/frontend
npm run build
```

- [ ] Verify build folder created
- [ ] Deploy to Firebase:
```bash
firebase deploy --only hosting
```

- [ ] Deployment successful
- [ ] Hosting URL received (save it): `https://your-project.web.app`

### Post-Deployment Frontend Tests
- [ ] Site loads at production URL
- [ ] No console errors
- [ ] Login page displays correctly
- [ ] OAuth login popup works
- [ ] Can successfully authenticate

## Google OAuth Production Setup

### Update OAuth Credentials
- [ ] Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
- [ ] Edit OAuth 2.0 Client ID
- [ ] Add production URLs to Authorized JavaScript origins:
  - [ ] `https://your-project.web.app`
  - [ ] `https://your-project.firebaseapp.com`
  - [ ] (Keep `http://localhost:3000` for local development)
- [ ] Add same URLs to Authorized redirect URIs
- [ ] Save changes

### Test OAuth in Production
- [ ] Visit production URL
- [ ] Click "Sign in with Google"
- [ ] OAuth popup appears (not blocked)
- [ ] Can select Google account
- [ ] Successfully redirected back
- [ ] Dashboard loads after authentication

## Full Integration Test

### Authentication Flow
- [ ] Can login with whitelisted email
- [ ] Cannot login with non-whitelisted email
- [ ] Session persists on page reload
- [ ] Can logout successfully
- [ ] Logout clears session

### Data Loading
- [ ] Overview tab loads with data
- [ ] Rewarded Ads tab displays correctly
- [ ] Level Analysis tab shows metrics
- [ ] Unit Analysis tab works
- [ ] Churn Analysis tab loads
- [ ] Other Analytics tab displays

### Filters
- [ ] Can change date range
- [ ] Can select platform (iOS/Android/All)
- [ ] "Apply Filters" button triggers data refresh
- [ ] Data updates correctly after filter change

### Performance
- [ ] Initial load time < 3 seconds
- [ ] Tab switching is smooth
- [ ] Charts render without lag
- [ ] No memory leaks (check browser dev tools)

### Cross-Browser Testing
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works in Edge
- [ ] Mobile responsive (test on phone)

## Security Checklist

### Credentials & Secrets
- [ ] Production JWT_SECRET is different from development
- [ ] Service account key is secured (not in git)
- [ ] `.env` files are not committed
- [ ] Email whitelist is up to date

### HTTPS & Cookies
- [ ] All connections use HTTPS in production
- [ ] Cookies marked as secure in production
- [ ] CORS configured correctly
- [ ] No mixed content warnings

### Access Control
- [ ] Only whitelisted emails can access
- [ ] API endpoints require authentication
- [ ] No unauthorized data access possible
- [ ] Session timeout works (7 days)

## Monitoring Setup

### Set Up Alerts (Recommended)
- [ ] Set up error monitoring (Cloud Logging)
- [ ] Configure uptime monitoring
- [ ] Set budget alerts for BigQuery
- [ ] Monitor Cloud Run costs

### Logging
- [ ] Backend logs viewable in Cloud Logging
- [ ] Can track API requests
- [ ] Authentication failures logged
- [ ] BigQuery errors logged

## Documentation

### For Team Members
- [ ] Share production URL with team
- [ ] Add team emails to whitelist
- [ ] Share [QUICK_START.md](QUICK_START.md) for usage
- [ ] Share [FEATURES.md](FEATURES.md) for understanding metrics

### For Future Maintenance
- [ ] Document production environment variables
- [ ] Save deployment commands
- [ ] Record service URLs
- [ ] Note OAuth Client ID used

## Post-Deployment Verification (24 hours later)

- [ ] Check error logs (should be minimal)
- [ ] Verify data is updating
- [ ] Test from different locations/networks
- [ ] Check BigQuery costs
- [ ] Verify all team members can access

## Rollback Plan

If something goes wrong:

### Backend Rollback
```bash
# List revisions
gcloud run revisions list --service cube-wars-api

# Rollback to previous revision
gcloud run services update-traffic cube-wars-api \
  --to-revisions=PREVIOUS_REVISION_NAME=100
```

### Frontend Rollback
```bash
# View hosting releases
firebase hosting:channel:list

# Rollback
firebase hosting:rollback
```

### Emergency Access
- [ ] Know how to access Cloud Console
- [ ] Know how to check logs
- [ ] Have backup admin access
- [ ] Can quickly add/remove whitelist emails

## Cost Monitoring

After 1 week, verify costs:
- [ ] BigQuery: Check data scanned per query
- [ ] Cloud Run: Check request counts and costs
- [ ] Firebase Hosting: Check bandwidth usage
- [ ] Total cost is within expected range ($5-30/month)

### Cost Optimization
If costs are high:
- [ ] Review query efficiency
- [ ] Consider caching for frequent queries
- [ ] Limit date ranges by default
- [ ] Review access patterns

## Maintenance Schedule

### Daily
- [ ] Quick check - is the site accessible?

### Weekly
- [ ] Review error logs
- [ ] Check uptime
- [ ] Monitor costs

### Monthly
- [ ] Update npm dependencies
- [ ] Review email whitelist
- [ ] Check for security updates
- [ ] Review usage patterns

### Quarterly
- [ ] Rotate JWT_SECRET if desired
- [ ] Review OAuth settings
- [ ] Audit access logs
- [ ] Consider feature additions

## Backup & Disaster Recovery

### What to Backup
- [ ] `.env` files (store securely, not in git)
- [ ] Service account JSON key
- [ ] Email whitelist
- [ ] OAuth Client ID
- [ ] Deployment commands/scripts

### Recovery Steps (if needed)
1. Re-clone repository
2. Restore `.env` files
3. Re-deploy backend
4. Re-deploy frontend
5. Verify OAuth settings
6. Test thoroughly

## Success Criteria

Deployment is successful when:
- ✅ All team members can login
- ✅ All data loads correctly
- ✅ No errors in logs
- ✅ Performance is acceptable
- ✅ Costs are within budget
- ✅ Security checks pass
- ✅ Team is trained on usage

## Useful Commands Reference

### Backend (Cloud Run)
```bash
# View logs
gcloud run services logs read cube-wars-api --limit=50

# List deployments
gcloud run services describe cube-wars-api

# Update environment variable
gcloud run services update cube-wars-api \
  --set-env-vars="NEW_VAR=value"
```

### Frontend (Firebase)
```bash
# View hosting sites
firebase hosting:sites:list

# View deployment history
firebase hosting:channel:list

# Open hosting dashboard
firebase hosting:channel:open
```

### BigQuery
```bash
# View recent queries
bq ls -j -a -n 10

# Check data size
bq show --format=prettyjson YOUR_PROJECT:analytics_XXXXXXXXX
```

## Support Contacts

- Google Cloud Support: [https://cloud.google.com/support](https://cloud.google.com/support)
- Firebase Support: [https://firebase.google.com/support](https://firebase.google.com/support)
- Documentation: [README.md](README.md), [SETUP_GUIDE.md](SETUP_GUIDE.md)

---

## Final Deployment Checklist Summary

Before going live:
- [ ] All pre-deployment tests pass
- [ ] Backend deployed to Cloud Run
- [ ] Frontend deployed to Firebase Hosting
- [ ] OAuth configured for production URLs
- [ ] Full integration test complete
- [ ] Security checklist complete
- [ ] Monitoring set up
- [ ] Team members have access
- [ ] Documentation shared
- [ ] Rollback plan understood

**Status**: [ ] Not Started | [ ] In Progress | [ ] Complete ✅

**Deployed By**: _________________
**Deployment Date**: _________________
**Production URL**: _________________
**Backend URL**: _________________

---

🎉 **Congratulations on deploying your analytics dashboard!**
