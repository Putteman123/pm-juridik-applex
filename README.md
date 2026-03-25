# PM Juridik – Juridisk AI-plattform

Juridisk ärendehantering och AI-assistent byggd med Firebase, Firestore och Gemini AI.

## Funktioner

- 🔐 Google Workspace-inloggning (Firebase Auth)
- 📁 Ärendehantering (skapa, hantera, avsluta fall)
- 📄 Dokumenthantering (uppladdning, lagring i Firebase Storage)
- 📋 Dokumentmallar (stämning, yttrande, fullmakt, kostnadsräkning, svarsskrivelse, överklagan)
- 🤖 AI-assistent (Gemini Pro) med kontext per ärende
- 🎙️ Diktafon med realtidstranskribering (Web Speech API)
- 👥 AI-baserad talar-identifiering
- 📷 Dokumentscanner med OCR (Gemini Vision)
- 🔔 Påminnelser och deadlines
- 🏢 Byråinställningar med logotyp

## Tech Stack

- **Frontend:** Vanilla JS, CSS (inline)
- **Backend:** Firebase (Auth, Firestore, Storage)
- **AI:** Google Gemini Pro API
- **Hosting:** Firebase Hosting
- **Design:** Domstolsverket-inspirerad (Open Sans + EB Garamond, #1c1f66)

## Deploy

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only hosting
```

### GitHub Actions (automatic deploy)
- Workflow: `.github/workflows/deploy.yml` deploys to Firebase Hosting on pushes to `main` (or when triggered manually).
- Required secret: `FIREBASE_SERVICE_ACCOUNT_PM_JURIDIK_APPLEX` containing a Firebase service account JSON with Hosting deploy permissions. The default `GITHUB_TOKEN` is used for repo access.

## Struktur

```
public/
├── index.html    # HTML + CSS (UI)
└── app.js        # All JavaScript (Firebase, AI, UI logic)
firebase.json     # Firebase Hosting config
.firebaserc       # Firebase project config
```

## Admin

- Admin-email: patrick@mellberg.online
- Firebase-projekt: pm-juridik-applex
- Live: https://pm-juridik-applex.web.app

## Beta v0.9
