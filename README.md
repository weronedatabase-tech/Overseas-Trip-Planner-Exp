# Overseas Trip Planner

A fully modular and progressive web application powered by Google Apps Script and vanilla JS/Tailwind.

## Project Structure
The repository is modularized for long-term scalability and parallel development:
- **`backend/`**: Contains Google Apps Script (`Code.js`, `config.js`, `appsscript.json`).
- **`frontend/`**: Contains the client-side UI separated logically.
  - **`js/`**: All JavaScript logic (`app.js`, `config.js`, `auth.js`, etc.).
  - **`css/`**: All styling (`styles.css`).
- **`assets/`**: Static assets like `icon-192.png` and `icon-512.png`. Place all future images here.
- **`root files`**: Core entry points like `index.html`, `sw.js` (Service Worker), and `manifest.json`.

## Environment Configurations
The application natively supports three environments: **Prod**, **Dev**, and **Exp**.
To change the active environment, update the `ENV` variable in:
1. `/backend/config.js`

The frontend will automatically render a red "Testing" banner for Dev, and a purple "Experimentation" banner for Exp.

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
  - *To find this:* In Apps Script, go to Deploy -> Manage Deployments. Copy the Deployment ID for your active Web App.

### 3. Deployment Workflow
Whenever you push changes to the `main` branch that modify files inside the `/backend/` folder, GitHub Actions will automatically:
1. Authenticate with Google using your saved `CLASPRC_JSON`.
2. Push your latest code from `/backend` to the Apps Script project.
3. Deploy a new version to the **existing** Web App URL so users don't need a new link.
