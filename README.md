# MINDS MYG Outings Organiser

This repository holds the code for the MINDS MYG Outings Organiser app. It features a completely modularized architecture designed for scalability, ease of maintenance, and continuous integration/continuous deployment (CI/CD).

## 📂 Project Structure
- **`.github/workflows/`**: Contains the GitHub Actions `deploy.yml` CI/CD pipeline script.
- **`assets/`**: Stores app-related static imagery like PWA icons (`icon-192.png`, `icon-512.png`).
- **`backend/`**: Contains Google Apps Script backend `.js` files and `config.js` acting as the single source of truth for environments.
- **`frontend/`**: 
  - **`css/`**: Separated, structured CSS styling.
  - **`js/`**: Modular logic separated by specific features (State, API wrapper, App UI, Authentication, Profiles, Settings).
- **`index.html`**: The unified frontend interface referencing the modules.
- **`sw.js`** & **`manifest.json`**: PWA service worker configuration allowing caching, offline-availability logic, and PWA integration.

## 🔄 Environments

We maintain 3 completely separate environments. To switch environments, you only need to modify one file: `backend/config.js`.

1. **Exp (Experimentation)**: Displays a purple banner.
2. **Dev (Development)**: Displays a red banner.
3. **Prod (Production)**: Standard UI.

## 🚀 GitHub Actions Setup (Auto Deployment)

The project includes an automated CI/CD pipeline utilizing Google `clasp`. When code is pushed to the `backend/` directory on the `main` branch, GitHub Actions will:
1. Push the updated code to Google Apps Script.
2. Deploy the latest version natively to Google's servers.
3. Keep the original Web App URL functional without changes.

### How to Configure Secrets in GitHub

To make the auto-deployment functional, you must add the following **Repository Secrets** in your GitHub repository: 
*(Settings -> Secrets and variables -> Actions -> New repository secret)*

#### 1. `CLASP_CREDENTIALS`
Install clasp locally (`npm install -g @google/clasp`), log in (`clasp login`), and copy the entire contents of your generated `~/.clasprc.json` file. Paste it as the value for `CLASP_CREDENTIALS`.

#### 2. `SCRIPT_ID`
Go to your Apps Script project -> Project Settings (gear icon) -> Copy the **Script ID** and paste it here.

#### 3. `DEPLOYMENT_ID`
To retain your current Web App URL, we must target your existing deployment. Go to your Apps Script project -> Deploy -> Manage Deployments -> Copy the **Deployment ID** of your active Web App and paste it here.

---
*Note: Make sure to clear your browser cache or utilize the "Refresh" button on the UI to load the newest service worker (sw.js) when making CSS/JS changes.*