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

## 3. Database Seeding & Admin Functions
- [ ] Create your production admin user credentials inside the Firebase Authentication console.
- [ ] Create the corresponding administrator document inside the Firestore `admins` collection:
  - Document ID: `<User UID from Firebase Authentication>`
  - Fields:
    - `email`: `admin@yourdomain.com` (string)
    - `role`: `admin` (string)
    - `name`: `Symposium Coordinator` (string)
- [ ] Log in to the administrator dashboard ([`http://yourdomain.vercel.app/login`](http://yourdomain.vercel.app/login)) using your admin credentials.
- [ ] Test the coordinator dashboard tabs (overview, teams, clues, event) to make sure they display empty states or initialize correctly.
- [ ] Use the event tab to configure event properties, and use the clues tab to add route and checkpoint configurations.

## 4. End-to-End Game Flow Verification
- [ ] Log in as a registered team from the team login page.
- [ ] Verify the team dashboard loads and displays the initial clue.
- [ ] On the administrator dashboard, click the "Print" icon next to the clue's QR code.
- [ ] Verify that the generated print page displays a high-resolution, centered QR code.
- [ ] Scan the printed QR code using a mobile device camera or navigate to the scanned URL directly.
- [ ] Verify that the scanner page successfully validates the token, displays a success indicator, and unlocks the next clue in the team dashboard.
- [ ] Complete the game sequence and verify that the victory screen triggers once the final checkpoint is reached.
