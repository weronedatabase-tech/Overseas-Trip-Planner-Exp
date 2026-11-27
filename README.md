# Overseas Trip Planner

A modular web application for planning and managing overseas trips—covering participant registration, logistics, rooming and bus allocations, attendance tracking, multi-currency finance and receipt management, meeting minutes, and Excel (`.xlsx`) data extractions. Built with a 100% static Vanilla JavaScript + Tailwind CSS frontend (compatible with both **GitHub Pages** and **Google AI Studio**) backed exclusively by **Google Apps Script, Google Drive, and Google Sheets**.

---

## Key Features & Modules

### 1. Authentication, Registration & Landing Portal (`index.html`, `register.html`)
- **Participant & Admin Login**: Password-based authentication (`NRIC/FIN or Passport No. + Year of Birth` for participants, or Admin credentials).
- **Public Trip Registration**: Configurable registration form for Trainees, Caregivers, and Volunteers with passport/NRIC validation, dietary preferences, medical details, and emergency contacts.
- **Public Receipt Submission**: Allows participants or volunteers to upload expense or refund receipts directly from the landing page without logging in.
- **Trip Infographic Display**: Displays the active trip infographic poster with full-screen preview.

### 2. Participant Profile Dashboard (`dashboard.html`, `frontend/js/profile.js`)
- **My Profile & Family View**: Displays personal details, passport expiry warnings, assigned logistics group, bus, room occupants, and paired volunteers/trainees.
- **Trip Fee Payment Portal**: Generates dynamic PayNow QR codes with unique family order references and supports uploading or replacing payment/refund screenshots.
- **Group IC Portal**: Group ICs can view their group roster, export group contacts (`.csv`), and take real-time attendance for official or custom junctures.

### 3. Roster & Participant Management (`roster.html`, `frontend/js/participants.js`, `frontend/js/rolodex.js`)
- **Master Roster**: Search, filter, add, edit, and delete participants across projects and roles (`TRAINEE`, `CAREGIVER`, `VOLUNTEER`).
- **Rolodex Integration**: Quick-import returning participants from the master Rolodex database.
- **Communication Hub (`frontend/js/comm.js`)**: Direct WhatsApp and phone call links for individual participants and family POCs.

### 4. Logistics & Allocations (`logistics.html` & sub-modules)
- **Grouping (`grouping.html`, `frontend/js/grouping.js`)**: Drag-and-drop assignment of families and volunteers into buses/groups with group IC designation.
- **Pairing (`pairing.html`, `frontend/js/pairing.js`)**: Pair volunteers with trainees and families.
- **Rooming (`logistics.html`, `frontend/js/logistics.js`)**: Hotel room allocation with capacity tracking, gender/family validation, and drag-and-drop room cards.
- **Specialized Trackers**:
  - **Dietary Requirements (`diet.html`, `frontend/js/diet.js`)**: Summary and breakdown of special dietary needs and allergies.
  - **Medical & Mobility (`medical.html`, `frontend/js/medical.js`)**: Overview of medical conditions, wheelchair/mobility aids, and medication notes.
  - **Passport Expiry (`expired.html`, `frontend/js/expired.js`)**: Flags participants whose passports expire within 6 months of travel.
  - **Volunteer Overview (`volunteer.html`, `frontend/js/volunteer.js`)**: Manage volunteer roles and assignments.
  - **Other Logistics (`other.html`, `frontend/js/other.js`)**: Additional custom logistics fields and notes.

### 5. Attendance Tracking (`attendance.html`, `frontend/js/attendance.js`)
- **Multi-Juncture Check-In**: Track attendance across admin-defined trip junctures, bus boarding lists, and Group IC custom junctures.
- **Live Sync**: Instant attendance status updates with timestamps and recorder attribution across connected devices.

### 6. Finance & Expense Management (`finance.html`, `frontend/js/finance.js`)
- **Budget Planning**: Create and compare multiple budget options with per-person, fixed, and custom line items before locking in a finalized budget.
- **Finalized Finances Overview**: Real-time comparison of budgeted vs. actual expenditure per category, total collected trip fees, and net surplus/deficit.
- **Receipts Browser & Upload**:
  - Upload, edit, and delete official trip receipts with image/PDF attachments stored in Google Drive (with local fallback storage).
  - **Multi-Currency & Exchange Rates**: Supports SGD, MYR, USD, EUR, GBP, AUD, IDR, THB, JPY, KRW, TWD, PHP, and VND with bidirectional exchange rate conversion.
  - **Vendor Refunds (Negative Amounts)**: Supports negative receipt amounts (e.g., `-50.00`) to accurately record refunds from vendors and offset category expenditure.
  - **Reimbursement Tracking**: Toggle receipts between `Pending` and `Reimbursed`.
- **Trip Fees Tracker**: Manage per-pax fees, family fee deviations/subsidies, PayNow QR codes, payment status (`PAID` / `UNPAID`), and payment screenshot verification.

### 7. Meeting Minutes (`minutes.html`, `frontend/js/minutes.js`)
- Create, edit, and organize committee meeting minutes with rich action items and timestamps.

### 8. Files & Excel Data Extractions (`files.html`, `frontend/js/files.js`, `frontend/js/extraction.js`)
- **Trip Files Repository**: Manage shared trip documents, links, and reference files.
- **Excel (`.xlsx`) Data Extractions**: All data export tools generate formatted Excel workbooks (`.xlsx`) with auto-fitted columns, styled headers, and borders:
  - **Insurance Extraction**: Exports participant particulars formatted for travel insurance submission.
  - **Bus for ICA Extraction**: Generates a multi-sheet Excel workbook with a separate worksheet per bus/group formatted for ICA clearance.
  - **Custom Extraction**: Build custom exports by filtering projects, roles, and columns, exported directly as an `.xlsx` file.

### 9. System Settings (`settings.html`, `frontend/js/settings.js`)
- Configure trip name, active projects and project badge colors, attendance junctures, sorting rules, registration toggle, trip info document link, and landing page infographic.

---

## Project Structure

```text
├── backend/
│   ├── Code.js              # Google Apps Script backend API & Google Sheets/Drive handlers
│   ├── CheckSettings.js     # Backend settings & diagnostic helpers
│   ├── config.js            # Environment configuration (Prod, Dev, Exp) & API URLs
│   └── appsscript.json      # Google Apps Script manifest
├── data/
│   ├── receipts_overrides.json # Local persistence for receipt edits, uploads & deletions
│   └── trip_files.json      # Local persistence for trip files metadata
├── frontend/
│   ├── css/
│   │   └── styles.css       # Custom styles, animations, scrollbars & dark mode utilities
│   └── js/
│       ├── api.js           # Backend API client, caching & live-sync broadcast triggers
│       ├── attendance.js    # Attendance tracking module
│       ├── auth.js          # Login, session management & public landing receipt upload
│       ├── comm.js          # WhatsApp & phone communication helpers
│       ├── diet.js          # Dietary requirements tracker
│       ├── dnd.js           # Drag-and-drop utilities for logistics & rooming
│       ├── expired.js       # Passport validity & expiry checker
│       ├── extraction.js    # Excel (.xlsx) data extraction & export engine
│       ├── files.js         # Trip files manager & extraction modal triggers
│       ├── finance.js       # Budgeting, receipts browser, exchange rates & fee tracker
│       ├── grouping.js      # Bus & group allocation module
│       ├── live-sync.js     # WebSocket client for real-time cross-tab/cross-device sync
│       ├── logistics.js     # Rooming allocation & logistics hub
│       ├── main.js          # App initialization, navigation & global lifecycle
│       ├── medical.js       # Medical & mobility tracker
│       ├── minutes.js       # Meeting minutes editor
│       ├── other.js         # Custom logistics fields
│       ├── pairing.js       # Volunteer-trainee pairing module
│       ├── participants.js  # Master roster CRUD & filtering
│       ├── profile.js       # Participant dashboard, PayNow QR & Group IC tools
│       ├── registration.js  # Public registration form handler
│       ├── rolodex.js       # Returning participant lookup & import
│       ├── settings.js      # Admin system configuration
│       ├── state.js         # Shared global application state
│       ├── tailwind.config.js # Tailwind CSS theme & custom palette configuration
│       ├── ui.js            # Modal dialogs, toast notifications, fuzzy search & date picker
│       └── volunteer.js     # Volunteer management module
├── server.js                # Express + WebSocket server, GAS proxy & Excel (.xlsx) generator
├── package.json             # Node.js dependencies (express, ws, exceljs) & scripts
└── *.html                   # Modular HTML entry points (index, dashboard, roster, finance, etc.)
```

---

## Local Development & Running the Server

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start the Server**:
   ```bash
   npm run dev
   ```
   The application runs on `http://localhost:3000`.

3. **Preview Server (`server.js`)**:
   - Minimal static-only file server for local / Google AI Studio previews, exposing only public frontend assets (`*.html`, `frontend/`, `assets/`, `manifest.json`, `favicon.svg`, `backend/config.js`).
   - All API requests go directly from the browser to Google Apps Script (`API_URL`) with signed HMAC-SHA256 session tokens—identical to GitHub Pages deployments.

---

## Environment Configurations

The application supports three environments: **Prod**, **Dev**, and **Exp**.
To change the active environment, update the `ENV` variable in:
1. `/backend/config.js`

The frontend automatically renders a red **"Testing"** banner for `Dev` and a purple **"Experimentation"** banner for `Exp`.

---

## CI/CD: Automated Google Apps Script Deployment

This repository is configured to automatically push and deploy backend code to Google Apps Script while maintaining your existing Web App URL.

### 1. Initial Local Setup (Only needed once to get credentials)
1. Install Clasp: `npm install -g @google/clasp`
2. Login to Clasp: `clasp login`
3. Locate your `.clasprc.json` file (usually in your home directory `~/.clasprc.json` or `C:\Users\Name\.clasprc.json`).

### 2. GitHub Secrets Setup
Navigate to your GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**.
Add the following three Repository Secrets:

- **`CLASPRC_JSON`**: Paste the entire contents of your `.clasprc.json` file here.
- **`GAS_SCRIPT_ID`**: The Script ID of your Google Apps Script project (Found in Apps Script -> Project Settings).
- **`GAS_DEPLOYMENT_ID`**: The active Web App Deployment ID.
  - *To find this:* In Apps Script, go to **Deploy** -> **Manage Deployments**. Copy the Deployment ID for your active Web App.

### 3. Deployment Workflow
Whenever you push changes to the `main` branch that modify files inside the `/backend/` folder, GitHub Actions will automatically:
1. Authenticate with Google using your saved `CLASPRC_JSON`.
2. Push your latest code from `/backend` to the Apps Script project.
3. Deploy a new version to the **existing** Web App URL so users don't need a new link.