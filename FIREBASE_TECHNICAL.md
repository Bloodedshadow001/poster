# FirebaseUI Integration - Technical Architecture

## Overview

The POSTER app integrates FirebaseUI (v6.1.0) alongside Firebase SDK (v10.14.1) to provide flexible, multi-provider authentication with a fallback to local browser-based auth.

## Key Components

### 1. FirebaseAuthPanel Component (`src/App.jsx`)

**Location**: Lines 650-710

**Purpose**: Manages FirebaseUI initialization and rendering

**Flow**:
```
useEffect hook triggers on mount
  ↓
Check if FIREBASE_AUTH_ENABLED (config validation)
  ↓
Load Firebase scripts (compat SDKs + UI)
  ↓
Initialize Firebase app with config
  ↓
Get available sign-in providers
  ↓
Create/get AuthUI instance
  ↓
Call ui.start() with configuration
  ↓
Render container div + loader
```

**Key Functions**:
- `loadScriptOnce()`: Loads Firebase scripts (prevents duplicates)
- `loadStylesheetOnce()`: Loads FirebaseUI CSS
- `loadFirebaseUi()`: Orchestrates SDK loading
- `firebaseSignInOptions()`: Converts provider strings to Firebase objects

### 2. Firebase Configuration

**Environment Variables** (read from `.env`):
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_FIREBASE_SIGN_IN_PROVIDERS
```

**Config Object** (lines 14-22):
```javascript
const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  // ... other fields
};
```

**Validation** (line 23):
```javascript
const FIREBASE_AUTH_ENABLED = Boolean(
  FIREBASE_CONFIG.apiKey && 
  FIREBASE_CONFIG.authDomain && 
  FIREBASE_CONFIG.projectId && 
  FIREBASE_CONFIG.appId
);
```

### 3. Sign-In Options

**Provider Mapping** (lines 578-585):
```javascript
function firebaseSignInOptions(firebase) {
  const providerMap = {
    google: firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    facebook: firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    twitter: firebase.auth.TwitterAuthProvider.PROVIDER_ID,
    github: firebase.auth.GithubAuthProvider.PROVIDER_ID,
    email: firebase.auth.EmailAuthProvider.PROVIDER_ID,
    phone: firebase.auth.PhoneAuthProvider.PROVIDER_ID
  };
  // Parse VITE_FIREBASE_SIGN_IN_PROVIDERS and return array
}
```

### 4. Session Management

**After Successful Sign-In** (lines 671-676):
```javascript
signInSuccessWithAuthResult: authResult => {
  const session = firebaseSessionForUser(authResult.user);
  onSession(session);  // Callback to App.handleFirebaseSession()
  return false;  // Prevent redirect (we handle it)
}
```

**Session Creation** (lines 485-491):
```javascript
function firebaseSessionForUser(firebaseUser) {
  return {
    token: `firebase-${firebaseUser.uid}-${Date.now()}`,
    refreshToken: "",
    user: publicFirebaseUser(firebaseUser)
  };
}
```

**User Profile Conversion** (lines 463-494):
```javascript
function publicFirebaseUser(firebaseUser = {}) {
  return {
    id: firebaseUser.uid,
    businessName: firebaseUser.displayName || "Firebase User",
    email: firebaseUser.email,
    phone: firebaseUser.phoneNumber || "",
    emailVerified: Boolean(firebaseUser.emailVerified),
    // ... profile fields initialized
    firebaseOnly: true
  };
}
```

### 5. Rendering Integration

**In App Component** (lines 2310):
```jsx
<FirebaseAuthPanel 
  onSession={handleFirebaseSession}  // Saves session + redirects
  setToast={setToast}  // Shows errors
/>
```

**Login Panel** (lines 2257-2320):
- Shows email/password form (local auth)
- Renders FirebaseUI panel below
- Allows toggle between login/register modes

## Data Flow

### Sign-In Flow

```
User clicks Firebase provider button
  ↓
FirebaseUI handles OAuth redirect
  ↓
User authenticates with provider
  ↓
Firebase SDK returns authResult
  ↓
signInSuccessWithAuthResult callback triggered
  ↓
Convert Firebase user → App user object
  ↓
handleFirebaseSession() called
  ↓
Session saved to sessionStorage:
  - parasara_token
  - parasara_user
  ↓
authed flag becomes true
  ↓
App redirects to /dashboard
```

### Sign-Out Flow

```
User clicks "Sign out"
  ↓
signOutFirebaseAuth() called (line 589-591)
  ↓
Firebase session cleared: firebase.auth().signOut()
  ↓
clearSession() called
  ↓
sessionStorage cleared
  ↓
User redirected to login
```

## CSS Architecture

**Theme Variables** (`styles.css:1-50`):
```css
:root {
  --bg: #f7f3e8;
  --ink: #1d1b16;
  --gold: #c99628;
  --teal: #008f83;
  --shadow: 0 22px 65px rgba(77, 54, 10, .16);
  --glass: rgba(255, 255, 255, .58);
}
```

**FirebaseUI Overrides** (lines 1396-1453):
- `.firebase-auth-panel`: Container styling
- `.firebaseui-idp-button`: Provider button styling
- `.firebaseui-card-content`: Card content padding
- `.firebaseui-text`, `.firebaseui-title`: Typography

**Dark Mode Support** (lines 51-92):
- Automatically applied when `body.dark-mode` class added
- FirebaseUI inherits CSS variables

## Error Handling

**Scenarios**:

1. **Firebase SDK Load Failure**
   - Caught in `loadFirebaseUi()` try-catch
   - Error message shown in toast
   - Status set to "error"
   - Local auth still available

2. **No Providers Enabled**
   - Throws "No Firebase sign-in providers are enabled"
   - Shows error toast
   - Falls back to local auth

3. **Firebase Config Missing**
   - `FIREBASE_AUTH_ENABLED` = false
   - Component returns null
   - Only local auth available

## Performance Optimization

### Script Loading
- Scripts loaded once via `loadScriptOnce()`
- Prevents multiple Firebase initializations
- Cleanup on component unmount (`cancelled` flag)

### CSS Loading
- Stylesheet added only once via `loadStylesheetOnce()`
- Uses standard `<link>` tag (faster than @import)

### UI Rendering
- `uiShown` callback hides loader when UI ready
- Popup flow (not redirect) keeps user context

## Browser Compatibility

**Firebase SDKs Used**:
- `firebase-app-compat.js` - v10.12.5
- `firebase-auth-compat.js` - v10.12.5
- `firebase-ui-auth.js` - v6.0.1

**Supported Browsers**: All modern browsers (IE11+ with polyfills)

## Security Considerations

1. **ID Token Storage**: Stored in sessionStorage (cleared on close)
2. **Email Verification**: Can be required via Firebase rules
3. **HTTPS Required**: Firebase only works over HTTPS (except localhost)
4. **Domain Whitelist**: Authorized domains configured in Firebase Console
5. **reCAPTCHA**: Can be enabled per provider in Console

## Configuration Modes

### Mode 1: Firebase + Local Auth (Default)
```javascript
FIREBASE_AUTH_ENABLED: true
LOCAL_AUTH_ENABLED: true
```
- FirebaseUI renders when ready
- Local auth form always available
- Maximum flexibility

### Mode 2: Firebase Only
```javascript
FIREBASE_AUTH_ENABLED: true
LOCAL_AUTH_ENABLED: false
```
- Only FirebaseUI available
- Recommended for production
- Cleaner UX

### Mode 3: Local Only (Demo)
```javascript
FIREBASE_AUTH_ENABLED: false
LOCAL_AUTH_ENABLED: true
```
- No Firebase calls
- Fast offline testing
- Browser-only data

## Testing Checklist

- [ ] All providers load without console errors
- [ ] Email/password sign-in works
- [ ] OAuth redirects complete successfully
- [ ] User session persists on page refresh
- [ ] Sign-out clears session completely
- [ ] Dark mode applies to FirebaseUI
- [ ] Mobile responsive layout works
- [ ] Error messages display clearly
- [ ] Local auth fallback works
- [ ] Multiple sign-in flows don't conflict

## Deployment

**Considerations**:
- Add production domain to Firebase Console
- Set `VITE_LOCAL_AUTH=false` in production
- Configure backend to validate Firebase tokens
- Set up email verification workflow
- Enable reCAPTCHA protection (optional)
- Test all OAuth flows in staging

## Future Enhancements

- [ ] Multi-factor authentication (MFA)
- [ ] Anonymous auth upgrade flow
- [ ] Account linking workflows
- [ ] Social account profile data sync
- [ ] Device verification
- [ ] Custom claims for user roles
