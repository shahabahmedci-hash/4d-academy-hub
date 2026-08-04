# Plan: Convert 4D Academy Hub to a Native Mobile App (Capacitor)

## Goal
Wrap the existing React + Vite SPA in Capacitor so it ships as a real native app to the Apple App Store and Google Play Store, with full access to phone features (camera, push notifications, sensors, etc.).

## Current State (verified)
- React 18 + Vite 5 SPA with `BrowserRouter` (client-side routing).
- Supabase client at `src/integrations/supabase/client.ts` reading `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` env vars.
- No Capacitor packages installed; no `capacitor.config.*` file exists.
- `vite.config.ts` uses default `base: '/'` — **must change to `./`** for `file://` loading in native shell.
- `index.html` has no app icons / manifest for native.
- App uses Adsterra ads via injected scripts — works in WebView but needs testing.
- Auth uses Supabase email/password + admin approval flow. Deep-link redirects (e.g. password reset) use `http://localhost` style URLs that must map to a custom scheme in native.

## Implementation Steps

### Step 1 — Vite config for native (`base: './'`)
- Update `vite.config.ts`: set `base: "./"` so built assets load via relative paths under `file://` in the WebView.
- Verify build still produces `dist/index.html` with relative asset references.

### Step 2 — Install Capacitor packages
Install these npm dependencies:
- `@capacitor/core`
- `@capacitor/cli` (dev dependency)
- `@capacitor/ios`
- `@capacitor/android`

### Step 3 — Initialize Capacitor project
Run `npx cap init` and configure `capacitor.config.ts`:
- `appId`: `app.lovable.d997c798f68f4ab19e11a2d43c7a1cb3`
- `appName`: `4D Academy Hub`
- `webDir`: `dist`
- `server.cleartext`: `true`
- Hot-reload dev URL (for testing against Lovable preview) inserted under `server.url`:
  `https://d997c798-f68f-4ab1-9e11-a2d43c7a1cb3.lovableproject.com?forceHideBadge=true`

### Step 4 — Native app icons
Generate app icons (1024×1024 source) and place favicon-style icons. Native icons for iOS/Android are generated from this during `npx cap sync`, but a source icon file must exist.

### Step 5 — SPA routing in native WebView
- `BrowserRouter` works inside Capacitor's WebView since the local server serves `index.html` for all routes. No change to `App.tsx` routing needed.
- Deep-link auth redirects (password reset, OAuth): configure a custom URL scheme (e.g. `app.lovable.d997c798...://`) so Supabase redirect URLs work natively. Update Supabase Auth settings to allow this scheme.

### Step 6 — Adsterra ads in WebView
- The current `AdBanner.tsx` injects scripts via `document.createElement`. This generally works in Capacitor's WebView but may need the `cleartext` flag (already set) and the `allowMixedContent` setting if ads load over HTTP. Test and adjust if blank.

### Step 7 — Build & sync
- `npm run build` → produces `dist/`
- `npx cap add ios` and/or `npx cap add android`
- `npx cap sync` to copy web assets into native projects

### Step 8 — Instructions for running on device
Provide user with the steps to run on a physical device or emulator (export to GitHub, npm install, cap add, cap sync, cap run).

## What this gives you
- A true native app icon on the phone home screen.
- Full access to camera (used by avatar upload), push notifications, file system, etc.
- Publishable to Apple App Store and Google Play Store.
- The same UI and codebase as the web app — no rewrite.

## Limitations / Notes
- Building the actual `.ipa` / `.apk` requires a Mac with Xcode (iOS) or Android Studio (Android) — the sandbox here can install and configure Capacitor, generate the config, and verify the web build, but the final native compile must happen on your machine.
- Ad serving may still depend on Adsterra domain approval (unchanged by going native).
- Push notifications, native camera, and other device features are available but require additional Capacitor plugins to be installed when you're ready to use them (e.g. `@capacitor/camera`, `@capacitor/push-notifications`).
