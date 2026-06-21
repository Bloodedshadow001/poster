# GitHub Deployment Guide - Firebase Secrets

## For GitHub Pages / Vercel / Netlify Deployment

### Step 1: Add GitHub Secrets

1. Go to your GitHub repo: `https://github.com/Bloodedshadow001/poster`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:

| Secret Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | Your Firebase API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `VITE_FIREBASE_APP_ID` | Your Firebase App ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Your Sender ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Your Measurement ID |
| `VITE_FIREBASE_SIGN_IN_PROVIDERS` | `google,email` |
| `VITE_LOCAL_AUTH` | `false` |
| `VITE_API_BASE_URL` | Your backend URL |

### Step 2: For Vercel Deployment

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**
2. Add all the secrets above
3. Redeploy

### Step 3: For Netlify Deployment

1. Go to **Netlify** → Your Site → **Site settings** → **Build & deploy** → **Environment**
2. Add all the secrets above
3. Redeploy

### Step 4: For GitHub Pages (if using GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
          VITE_FIREBASE_SIGN_IN_PROVIDERS: ${{ secrets.VITE_FIREBASE_SIGN_IN_PROVIDERS }}
          VITE_LOCAL_AUTH: ${{ secrets.VITE_LOCAL_AUTH }}
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
        run: npm run build
      
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Troubleshooting

**FirebaseUI not showing?**
- [ ] Check all secrets are added
- [ ] Open browser console (F12)
- [ ] Look for Firebase initialization errors
- [ ] Check Network tab for `firebase-ui-auth.js` loading

**"No Firebase sign-in providers are enabled"?**
- [ ] Verify `VITE_FIREBASE_API_KEY` is set
- [ ] Verify `VITE_FIREBASE_PROJECT_ID` is set
- [ ] Enable providers in Firebase Console

**Environment variables not working?**
- [ ] Rebuild after adding secrets
- [ ] Use Vite prefix: `VITE_*`
- [ ] Verify build logs show env vars are loaded
