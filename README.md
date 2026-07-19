# QR-Based Treasure Hunt Web Application

A modern, responsive, real-time QR-based Treasure Hunt web application built for college symposiums.

## Technology Stack

* **Frontend**: React.js, Vite, Tailwind CSS, Axios, React Router, Lucide Icons, Canvas Confetti
* **Backend**: Django, Django REST Framework, Django Channels (WebSockets), SimpleJWT Authentication
* **Database**: PostgreSQL (Production) / SQLite (Development fallback)
* **QR Generation**: Python `qrcode` library with `Pillow`

---

## Workspace Structure

```
treasure-hunt/
├── backend/
│   ├── accounts/         # User roles and authentication views
│   ├── events/           # Event configurations & seeding commands
│   ├── teams/            # Teams, Routes registration & progression tests
│   ├── clues/            # Riddles, campus locations & QR images
│   ├── qr/               # Scan validation logic and scan logs
│   ├── dashboard/        # Stats, Excel/PDF generators & WebSockets
│   ├── leaderboard/      # Public standings ranking API
│   ├── treasure_hunt/    # Main settings, URLs and ASGI router
│   ├── requirements.txt  # Python packages
│   └── manage.py
└── frontend/
    ├── src/
    │   ├── context/      # AuthContext & SocketContext
    │   ├── pages/        # Landing, Login, Dashboards, Scan and Standings
    │   ├── utils/        # Axios API client helper
    │   ├── App.jsx       # Route configuration and guards
    │   └── index.css     # Tailwind CSS & Glassmorphic variables
    ├── tailwind.config.js
    └── package.json
```

---

## Setup & Run Instructions

### 1. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Activate the pre-created virtual environment:
   * **Windows Powershell**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   * **Windows CMD**:
     ```cmd
     .venv\Scripts\activate.bat
     ```
   * **macOS/Linux**:
     ```bash
     source .venv/bin/activate
     ```
3. (Optional) Install dependencies if running on a new system:
   ```bash
   pip install -r requirements.txt
   ```
4. Run migrations:
   ```bash
   python manage.py migrate
   ```
5. Seed mock data (creates routes, clues, admin user, and pre-registered teams):
   ```bash
   python manage.py seed_data
   ```
   *Note: This command generates random 4-character codes for the teams (e.g., `T-W0RE`). Pay attention to the console output to note down these codes.*
6. Run the ASGI server (Daphne runs WebSockets and HTTP concurrently):
   ```bash
   python manage.py runserver
   ```
   The backend will be available at `http://localhost:8000`.

### 2. Frontend Setup

1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. (Optional) Install npm packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`.

---

## Authentication Credentials

* **Coordinator Console**:
  * URL: `http://localhost:5173/login`
  * Username: `admin`
  * Password: `adminpass`
* **Team Portal**:
  * URL: `http://localhost:5173/team-login`
  * Team Code: (e.g. `T-W0RE` - check console output from the `seed_data` command, or check inside the Django Admin dashboard at `http://localhost:8000/admin`).

---

## Key Features

1. **Anti-Tamper Scan Protection**: QR code links contain secret UUID tokens preventing participants from guessing QR endpoints.
2. **WebSocket Notification Feed**: Administrators receive real-time, toast alerts on the dashboard whenever a team scans a QR, completes a clue, or is completed.
3. **No-Redis InMemory Layer**: Django Channels is configured to use InMemory channel layers locally for easy testing without a Redis daemon, and can be scaled to Redis in production by specifying the `REDIS_HOST` environment variable.
4. **Excel/PDF Export**: Export the live standings directly from the dashboard to Excel spreadsheets or formatted PDF documents.
5. **Event Reset Command**: Clear team states, logs, and timers instantly to restart the symposium activity.
