# Worklog — work time tracking for your team

A starter project for tracking worker hours, with three parts that talk to each other:

```
worklog-app/
├── backend/      Node.js API + SQLite database — the shared brain
├── mobile/       React Native (Expo) app — workers log hours on their phone
└── admin-web/    React web dashboard — you review reports/calendar on PC
```

**How it fits together:** the backend is the single source of truth. Workers
use the phone app to clock in/out. You (manager) use the web dashboard on
your PC to see everyone's calendar and pull reports. Both apps just call the
same backend API — that's the "connection" between phone and PC.

## 0. No Node.js on your computer? Run it in GitHub Codespaces instead

You don't need anything installed locally — Codespaces gives you a full Linux
machine with Node already on it, running in your browser.

1. **Get the code into a GitHub repo.**
   - Create a free account at [github.com](https://github.com) if you don't have one.
   - Click **New repository**, give it any name (e.g. `worklog-app`), leave it
     empty, click **Create repository**.
   - On the new repo's page: **Add file → Upload files**. Unzip
     `worklog-app.zip` on your computer, then drag the whole `worklog-app`
     *folder* into the upload box (modern Chrome/Edge keep the folder
     structure). Click **Commit changes**.

2. **Open a Codespace.** On the repo page, click the green **Code** button →
   **Codespaces** tab → **Create codespace on main**. Wait ~30 seconds for it
   to boot — you'll get a full VS Code editor in your browser with a terminal
   at the bottom, and Node already installed.

3. **Start the backend** in that terminal:
   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```
   Edit `.env` in the file explorer on the left (set `JWT_SECRET` and your
   `SEED_MANAGER_EMAIL`/`SEED_MANAGER_PASSWORD`), then:
   ```bash
   npm run seed:manager
   npm start
   ```
   A popup will say "Your application running on port 4000 is available."
   Click the **Ports** tab (next to Terminal), right-click port `4000` →
   **Port Visibility → Public**, then copy that forwarded URL (looks like
   `https://yourname-abc123-4000.app.github.dev`).

4. **Start the admin dashboard.** Open a new terminal (the `+` in the
   terminal panel):
   ```bash
   cd admin-web
   npm install
   ```
   Edit `admin-web/src/api.js` and replace `http://localhost:4000` with the
   forwarded backend URL from step 3. Then:
   ```bash
   npm run dev
   ```
   Make port `5173` **Public** too in the Ports tab, and open that forwarded
   URL in your normal browser (not the Codespaces tab) to use the dashboard.

5. **Start the mobile app.** Another new terminal:
   ```bash
   cd mobile
   npm install
   ```
   Edit `mobile/src/config.js` and set `API_BASE_URL` to the same forwarded
   backend URL from step 3. Then:
   ```bash
   npx expo start --tunnel
   ```
   (`--tunnel` is needed because the dev server is in the cloud, not on your
   Wi-Fi — say yes if it asks to install `@expo/ngrok`.) Scan the QR code
   with **Expo Go** on your phone.

A free GitHub account includes a generous monthly quota of Codespaces hours,
plenty for building and testing this.

## A. Or run everything locally instead

If you get Node.js working later, here's the local version of the same steps:

```bash
cd backend
npm install
cp .env.example .env        # edit JWT_SECRET to a long random string
npm run seed:manager        # creates your first manager login (edit .env first to set its email/password)
npm start                   # starts the API on http://localhost:4000
```

Keep this running — both the phone app and the web dashboard depend on it.
For real use later, you'll deploy this to a small server (see section D).

## B. Run the admin web dashboard (PC)

```bash
cd admin-web
npm install
npm run dev                 # opens on http://localhost:5173
```

Log in with the manager email/password you set in `backend/.env`. By default
it talks to `http://localhost:4000` — that's set in `admin-web/src/api.js`.

## C. Run the mobile app (phone)

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app (App Store / Play Store) on your
phone — no app-store account or build needed yet, this is how you test fast.

**Important:** edit `mobile/src/config.js` and set `API_BASE_URL` to your
computer's LAN IP (not `localhost` — your phone is a separate device on the
network), e.g. `http://192.168.1.42:4000`. Find your IP with `ipconfig`
(Windows) or `ifconfig`/`ipconfig getifaddr en0` (Mac). Your phone and
computer need to be on the same Wi-Fi.

Log in as a worker. To create worker accounts, log into the **admin web
dashboard** as manager and use "+ Add worker" — then give that worker their
email/temporary password to log into the phone app.

## How the data flows

- A worker taps **Clock In** / **Clock Out** in the app → backend stores a
  row in `work_logs` with the date, timestamps, and computed hours.
- The worker's **Calendar** tab fills in each day that has logged hours —
  the "filled calendar" view you asked for.
- You see the same calendar per worker on the web dashboard, plus a **Team
  overview** report across everyone, with CSV export.
- If someone forgets to clock in/out, both apps have a manual "log hours
  directly" option that backfills a day.

## D. Path to real native apps on the App Store / Play Store

Right now you're running in **Expo Go**, which is for development only.
To publish for real:

1. Create a free [Expo account](https://expo.dev) and run `npx eas login`.
2. Deploy the backend somewhere reachable from the internet (not your
   laptop) — e.g. [Railway](https://railway.app), [Render](https://render.com),
   or a small VPS. Update `API_BASE_URL` in `mobile/src/config.js` and
   `admin-web/src/api.js` to that public URL.
3. Build the app binaries with [EAS Build](https://docs.expo.dev/build/introduction/):
   ```bash
   npx eas build --platform ios
   npx eas build --platform android
   ```
4. Submit with `npx eas submit` — you'll need an Apple Developer account
   ($99/yr) and a Google Play Developer account ($25 one-time).
5. The web dashboard can be deployed as a static site (Vercel, Netlify,
   Cloudflare Pages) — `npm run build` in `admin-web/` produces the files.

## Known simplifications (fine for a pilot with 10+ people, worth revisiting before scaling further)

- **Day boundaries are UTC-based on the server.** If your team spans
  multiple timezones, a clock-in right after local midnight could land on
  "yesterday" by server date. Fine for a single-timezone team; flag if you
  need this fixed.
- **SQLite** is a single file — simple and reliable for dozens of workers,
  but you'll want Postgres if you grow into the hundreds or need multiple
  backend servers.
- **No password reset flow yet** — a manager currently has to create the
  account with a temporary password. Easy to add later.
- **CORS is wide open** (`app.use(cors())`) for easy local development —
  restrict the `origin` before deploying somewhere public.
- Manager accounts are created via the `npm run seed:manager` script. There's
  no "manager creates another manager" UI yet — re-run the script with
  different `.env` values if you need a second manager.

## Project structure reference

```
backend/
  src/server.js          Express app + route wiring
  src/db.js               SQLite schema (users, work_logs)
  src/middleware/auth.js  JWT auth + manager-only guard
  src/routes/auth.js      login, current-user
  src/routes/workers.js   manager: list/add/remove workers
  src/routes/worklogs.js  clock-in/out, manual entry, month data for calendar
  src/routes/reports.js   aggregated totals + CSV export

mobile/
  App.js                  navigation (tabs: Log Work / Calendar / Team)
  src/screens/             one file per screen
  src/components/CalendarGrid.js   the filled-calendar UI

admin-web/
  src/App.jsx              auth state
  src/pages/Dashboard.jsx   sidebar of workers + calendar/report main view
  src/components/CalendarGrid.jsx
```
