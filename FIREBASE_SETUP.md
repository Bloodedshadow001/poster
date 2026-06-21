# FirebaseUI Authentication Setup Guide

Your POSTER app now has **FirebaseUI** integrated for easy multi-provider authentication. This guide walks you through the setup process.

## What's Included

✅ **Firebase & FirebaseUI packages** installed  
✅ **FirebaseAuthPanel component** in `src/App.jsx`  
✅ **Environment configuration** template in `.env.example`  
✅ **Custom CSS styling** for FirebaseUI in `styles.css`  
✅ **FirebaseUI stylesheet** linked in `index.html`  

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a new project"
3. Enter project name (e.g., "Parasara Media Marketplace")
4. Enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Register Your Web App

1. In Firebase Console, go to **Project settings** (⚙️ icon)
2. Click the **"Web"** button to create a web app
3. Enter app nickname (e.g., "Parasara Web")
4. Check "Also set up Firebase Hosting" (optional)
5. Click "Register app"
6. Copy the configuration object that appears

## Step 3: Configure Environment Variables

1. Open `.env` (or create it from `.env.example`)
2. Add your Firebase config values:

```env
VITE_FIREBASE_API_KEY=YOUR_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
VITE_FIREBASE_APP_ID=YOUR_APP_ID
VITE_FIREBASE_MEASUREMENT_ID=YOUR_MEASUREMENT_ID
```

3. Configure sign-in providers (comma-separated):
```env
VITE_FIREBASE_SIGN_IN_PROVIDERS=google,email
```

## Step 4: Enable Sign-In Methods

In Firebase Console, go to **Authentication > Sign-in method** and enable:

### Email/Password Sign-In (Recommended)
1. Click "Email/Password"
2. Toggle "Enable"
3. Optionally enable "Email link (passwordless)"
4. Click "Save"

### Google Sign-In
1. Click "Google"
2. Toggle "Enable"
3. Set project name and email if prompted
4. Click "Save"

### Other Providers (Optional)
- Facebook: Requires App ID and Secret
- GitHub: Requires Client ID and Secret
- Twitter: Requires API Key and Secret
- Phone: Requires reCAPTCHA setup

## Step 5: Authorize Your Domain

1. Go to **Authentication > Settings**
2. Scroll to "Authorized domains"
3. Click "Add domain"
4. Add your domain(s):
   - Local dev: `localhost` (auto-added)
   - Production: `your-domain.com`
5. Click "Add"

## Step 6: Test Locally

1. Run your app:
```bash
npm run dev
```

2. Navigate to the login page

3. You should see:
   - FirebaseUI sign-in panel with enabled providers
   - Email/password form
   - Social provider buttons
   - Fallback to local auth if Firebase isn't configured

## Environment Configuration

The app supports **three authentication modes**:

### 1. **Firebase Only** ✅ Recommended
Set all Firebase environment variables + disable local auth:
```env
VITE_LOCAL_AUTH=false
VITE_FIREBASE_*=your_values
```

### 2. **Firebase + Local Auth Fallback** (Default)
Both Firebase and local auth work:
```env
VITE_LOCAL_AUTH=true
VITE_FIREBASE_*=your_values
```

### 3. **Local Auth Only** (Demo/Development)
No Firebase needed:
```env
VITE_LOCAL_AUTH=true
VITE_FIREBASE_API_KEY=    # Leave empty
```

## Customization

### Change Sign-In Providers

Edit `.env`:
```env
# Single provider
VITE_FIREBASE_SIGN_IN_PROVIDERS=google

# Multiple providers
VITE_FIREBASE_SIGN_IN_PROVIDERS=google,email,phone,facebook,twitter,github
```

### Customize Sign-In UI

Edit `src/App.jsx` in the `FirebaseAuthPanel` function:

```javascript
ui.start("#firebaseui-auth-container", {
  // Toggle between popup and redirect flow
  signInFlow: "popup",  // or "redirect"
  
  // Redirect after successful sign-in
  signInSuccessUrl: "/dashboard",
  
  // Customize provider scopes
  signInOptions: [
    {
      provider: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
      scopes: ["profile", "email"],
    },
    firebase.auth.EmailAuthProvider.PROVIDER_ID,
  ],
  
  // Terms of service and privacy policy
  tosUrl: "https://your-app.com/terms",
  privacyPolicyUrl: "https://your-app.com/privacy",
});
```

### Customize Styling

Edit `styles.css` (search for `.firebase-auth-panel`):

```css
.firebase-auth-panel .firebaseui-idp-button {
  max-width: none;
  min-height: 48px;
  border-radius: 6px;
  background: var(--navy);
  color: white;
  border: none;
}
```

## How It Works

1. **App Loads** → Checks for Firebase config
2. **If Firebase Enabled** → Loads FirebaseUI SDK and renders sign-in panel
3. **User Signs In** → `handleFirebaseSession()` called with auth result
4. **Session Saved** → User data stored in sessionStorage
5. **Redirects** → User sent to `/dashboard`

## User Session Data

After successful Firebase sign-in, the user profile contains:

```javascript
{
  id: firebaseUser.uid,
  businessName: firebaseUser.displayName,
  email: firebaseUser.email,
  phone: firebaseUser.phoneNumber,
  emailVerified: firebaseUser.emailVerified,
  accountMode: "buyer",
  profileStrength: 45,
  // ... additional fields initialized
}
```

## Troubleshooting

### "No Firebase sign-in providers are enabled"
- Check `.env` has valid Firebase credentials
- Verify `VITE_FIREBASE_SIGN_IN_PROVIDERS` is set

### "FirebaseUI fails to load"
- Clear browser cache and localStorage
- Check console for CDN loading errors
- Verify domain is authorized in Firebase Console

### "Sign-in succeeds but user not created"
- Users are created automatically in Firebase Authentication
- Backend should sync Firebase users to your database
- Check `/server/middleware/auth.js` for Firebase token validation

### "Local auth shows instead of Firebase"
- Set `VITE_LOCAL_AUTH=false` in `.env` to disable fallback
- Or ensure `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_PROJECT_ID` are set

## Production Deployment

Before deploying:

1. ✅ Authorize your production domain in Firebase
2. ✅ Configure backend to validate Firebase ID tokens
3. ✅ Set up email verification workflow
4. ✅ Enable reCAPTCHA protection (optional)
5. ✅ Configure password reset email template
6. ✅ Test all sign-in flows in production

## Backend Integration

Validate Firebase tokens in your backend:

```javascript
const admin = require("firebase-admin");

app.post("/api/auth/verify", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    // Find or create user in your database
    res.json({ verified: true, uid });
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
});
```

## Resources

- [Firebase Console](https://console.firebase.google.com)
- [FirebaseUI Documentation](https://firebase.google.com/docs/auth/web/firebaseui)
- [Firebase Authentication Docs](https://firebase.google.com/docs/auth/web/start)
- [Firebase Pricing](https://firebase.google.com/pricing)

## Support

For issues:
1. Check browser console for error messages
2. Verify all environment variables are set
3. Check Firebase Console logs
4. Review Firebase security rules
