# AITHERON ML 2026 - Deployment Guide

This guide details the architecture, configuration, and step-by-step procedures for deploying the **AITHERON ML 2026** application to **Vercel** (Frontend React SPA) and **Firebase** (Backend database, authentication, and cloud functions) using an automated **GitHub CI/CD workflow**.

---

## Deployment Architecture

```text
Local Development (Antigravity IDE / VS Code)
                │
                ▼
             GitHub
                │
      Automatic CI/CD Deployment
        ┌───────────────┴───────────────┐
        ▼                               ▼
     Vercel                        Firebase
 (React Frontend)        (Firestore, Authentication,
                           Cloud Functions, Storage)
```

---

## 1. Initial Local Setup

1. Verify that your root directory contains the following configuration files:
   - [`firebase.json`](file:///c:/Users/vivek/treassure%20hunt/firebase.json) (Emulator and rewrite routing setup)
   - [`.gitignore`](file:///c:/Users/vivek/treassure%20hunt/.gitignore) (Ensures local secrets and build folders are not pushed)
2. Inside the [`frontend/`](file:///c:/Users/vivek/treassure%20hunt/frontend/) directory:
   - [`.env.example`](file:///c:/Users/vivek/treassure%20hunt/frontend/.env.example) acts as a template for other developers.
   - [`.env.local`](file:///c:/Users/vivek/treassure%20hunt/frontend/.env.local) contains configuration for running local emulators.
   - [`vercel.json`](file:///c:/Users/vivek/treassure%20hunt/frontend/vercel.json) configures SPA routing rewrites.

---

## 2. GitHub Repository Setup

To enable CI/CD, you need to store the code in a remote GitHub repository:

1. Open your terminal at the project root directory.
2. Initialize Git if not already done:
   ```bash
   git init
   ```
3. Add the files to your local staging area and make the initial commit:
   ```bash
   git add .
   git commit -m "chore: initial deployment configurations and env migration"
   ```
4. Create a new repository on GitHub (do not add any default README, LICENSE, or `.gitignore` to avoid merge conflicts).
5. Link your local repository to the remote GitHub repository:
   ```bash
   git remote add origin https://github.com/your-username/your-repo-name.git
   ```
6. Rename the default branch to `main`:
   ```bash
   git branch -M main
   ```
7. Push your code to GitHub:
   ```bash
   git push -u origin main
   ```

---

## 3. Connecting GitHub to Vercel (Frontend Deployment)

Vercel acts as the automated hosting provider for the React frontend, rebuilding and deploying every commit pushed to `main`.

1. Go to [Vercel](https://vercel.com/) and log in (or create an account linked to your GitHub account).
2. Click **Add New** > **Project**.
3. Import the repository you just pushed.
4. Configure the Project Settings:
   - **Framework Preset**: Select `Vite` (it should detect this automatically).
   - **Root Directory**: Click Edit and select the `frontend` folder.
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Expand **Environment Variables** and add the production credentials for Firebase (retrieved from the Firebase console, see Step 4):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_USE_EMULATORS` = `false`
6. Click **Deploy**. Vercel will install dependencies, compile the React build, and provide a live production URL (with HTTPS active by default).

---

## 4. Connecting the Project to Firebase (Backend Deployment)

To configure the production database, authorization engine, and backend triggers:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Under **Project Settings**, register a new Web App to retrieve the SDK configuration credentials (API Key, Project ID, App ID, etc.). Use these values to populate the Vercel Environment Variables.
3. Enable the following services in the console:
   - **Authentication**: Enable Email/Password authentication.
   - **Cloud Firestore**: Start in production mode. Set your target region.
   - **Firebase Storage**: Enable default bucket rules.
4. Deploy security rules, indexes, and Cloud Functions from your local terminal:
   - Install the Firebase CLI:
     ```bash
     npm install -g firebase-tools
     ```
   - Authenticate with your Firebase account:
     ```bash
     firebase login
     ```
   - Associate your local project directory with the newly created Firebase production project:
     ```bash
     firebase use --add
     ```
   - Deploy security rules, indexes, and storage rules:
     ```bash
     firebase deploy --only firestore:rules,storage:rules,firestore:indexes
     ```
   - Deploy backend trigger Cloud Functions:
     ```bash
     firebase deploy --only functions
     ```

---

## 5. Local Development Workflow

When working locally, you should run the Firebase Emulator Suite to emulate all backend services in isolation:

1. Launch the Firebase Emulators:
   ```bash
   npx firebase emulators:start --project demo-aitheron
   ```
2. Seed the local Firestore database:
   ```bash
   node functions/seed_emulators.js
   ```
3. Run the Vite frontend:
   ```bash
   cd frontend
   npm run dev
   ```
   The local application will connect to the emulators on ports `9099` (Auth), `8085` (Firestore), `9199` (Storage), and `5001` (Functions).

---

## 6. Updating the Project (CI/CD Workflow)

Once the pipeline is configured, deploying updates to the frontend is fully automated:

1. Make changes to the code inside your local editor.
2. Commit and push the changes:
   ```bash
   git add .
   git commit -m "feature: describe your updates here"
   git push origin main
   ```
3. Vercel will automatically detect the push, rebuild the React build, and swap the traffic to the new build with zero downtime.
4. **Note**: If you modified code inside the `functions/` directory or changed rules in `firestore.rules`, you must manually deploy them via Firebase CLI since Vercel only deploys static frontend assets:
   ```bash
   firebase deploy --only functions
   firebase deploy --only firestore:rules
   ```

---

## 7. Troubleshooting

* **Vercel Returns 404 on Page Refresh**: Double check that [`frontend/vercel.json`](file:///c:/Users/vivek/treassure%20hunt/frontend/vercel.json) exists and is committed. It instructs Vercel to route all subpaths back to `index.html`.
* **Database Connection Issues in Production**: Ensure that `VITE_USE_EMULATORS` is explicitly set to `false` in Vercel's environment variables dashboard. If it is `true`, the production site will attempt to contact emulator ports on `127.0.0.1` and fail.
* **CORS Errors during Scan Verification**: Verify that the region for your production Cloud Functions matches the region configured in your frontend SDK initializations.

---

## 8. Rollback Procedure

If a production update introduces a bug:

1. **Frontend Rollback**:
   - Go to your Vercel Dashboard.
   - Navigate to the **Deployments** tab.
   - Find the last stable deployment in the list, click the ellipsis (`...`), and select **Promote to Production**. This instantly reverts live traffic to the chosen stable build.
2. **Backend Rollback**:
   - Revert your local code to the stable Git commit hash:
     ```bash
     git checkout <stable-commit-hash>
     ```
   - Re-deploy the stable Cloud Functions or Rules:
     ```bash
     firebase deploy --only functions,firestore:rules
     ```
