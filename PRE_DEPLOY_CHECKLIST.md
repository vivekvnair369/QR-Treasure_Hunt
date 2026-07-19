# Pre-Deployment Checklist - AITHERON ML 2026

Ensure all the following tasks are checked and verified before initiating the production deployment.

## 1. Local Code & Build Verification
- [ ] Run a clean build from the root folder directory to ensure no bundle or syntax errors:
  ```bash
  npm run build
  ```
- [ ] Verify that all Vite CSS and JavaScript assets compile cleanly in the `frontend/dist/` output directory.

## 2. Environment Variables & Secrets
- [ ] Ensure that no production credentials (API Keys, secrets, etc.) are hardcoded in source code files like [`frontend/src/firebase/config.js`](file:///c:/Users/vivek/treassure%20hunt/frontend/src/firebase/config.js).
- [ ] Ensure [`.env.local`](file:///c:/Users/vivek/treassure%20hunt/frontend/.env.local) is listed in [`.gitignore`](file:///c:/Users/vivek/treassure%20hunt/.gitignore) to prevent accidental commits to GitHub.
- [ ] Document all environment variables in [`.env.example`](file:///c:/Users/vivek/treassure%20hunt/frontend/.env.example).
- [ ] Prepare production values for the following keys to be added to the Vercel dashboard:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_USE_EMULATORS` (Must be set to `false` for production)

## 3. GitHub & CI/CD Readiness
- [ ] Verify that you are on the `main` branch:
  ```bash
  git branch
  ```
- [ ] Ensure the local workspace is clean and all modified code is staged:
  ```bash
  git status
  ```
- [ ] Commit all changes with descriptive commit messages.

## 4. Vercel Configuration
- [ ] Verify that [`frontend/vercel.json`](file:///c:/Users/vivek/treassure%20hunt/frontend/vercel.json) is created and contains the rewrite rules for single-page routing:
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```

## 5. Firebase Production Setup (Spark Plan Free Tier)
- [ ] Create a new production Firebase project inside the [Firebase Console](https://console.firebase.google.com/).
- [ ] Enable **Firebase Authentication** and turn on **Email/Password** sign-in (required for admins and teams).
- [ ] Enable **Cloud Firestore** in production mode.
- [ ] Deploy security rules using Firebase CLI:
  ```bash
  firebase deploy --only firestore:rules
  ```
- [ ] Deploy storage rules using Firebase CLI:
  ```bash
  firebase deploy --only storage:rules
  ```
