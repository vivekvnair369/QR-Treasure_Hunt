# Post-Deployment Checklist - AITHERON ML 2026

Run the following checks on the live production environment once the CI/CD pipeline triggers and completes the build.

## 1. Vercel Build & Routing Checks
- [ ] Go to the Vercel Dashboard and verify that the build for the latest commit succeeded.
- [ ] Open the live production website URL.
- [ ] Verify page refreshes: Navigate to `/login`, refresh the page in the browser, and verify it loads correctly (does not return a 404).

## 2. Firebase Authentication Settings
- [ ] Go to the **Firebase Console** > **Authentication** > **Settings** > **Authorized Domains**.
- [ ] Add your live Vercel domain (e.g., `your-project.vercel.app`) to the authorized domains list.
- [ ] Try logging in with invalid admin credentials on the landing/login page and ensure proper warning alerts appear.

## 3. Database Seeding Setup
- [ ] Download a service account private key JSON from Firebase Console > Project Settings > Service Accounts.
- [ ] Save it as `service-account.json` in your local project root folder.
- [ ] Seed the production database by running:
  ```bash
  npm run seed:production
  ```
  *(Note: This creates the vivekvnair9037@gmail.com admin account, initial event config, routes, clues, and 3 mock teams inside Auth and Firestore)*

## 4. End-to-End Game Flow Verification
- [ ] Log in as a registered team (e.g., `T-CYBER`) from the team login page.
- [ ] Verify the team dashboard loads and displays the initial clue.
- [ ] On the administrator dashboard, click the "Print" icon next to the clue's QR code.
- [ ] Verify that the generated print page displays a high-resolution, centered QR code.
- [ ] Scan the printed QR code using a mobile device camera or navigate to the scanned URL directly.
- [ ] Verify that the scanner page successfully validates the token client-side, updates the team sequence atomically, and unlocks the next clue in the team dashboard.
- [ ] Complete the game sequence and verify that the victory screen triggers once the final checkpoint is reached.
