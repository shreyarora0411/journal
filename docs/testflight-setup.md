# TestFlight setup — first real iOS build (Workstream B)

Companion to [operations.md](./operations.md) §TestFlight and `pending-work-plan.md` Workstream B. This
file is the precise, copy-pasteable version — everything a coding agent could prepare has been done;
the steps below are the ones that need a human (Apple ID / Google Cloud login, physical device, App
Review).

## 0. What's already prepared (no action needed)

- `apps/mobile/app.json` — `ios.bundleIdentifier` is `com.shreyarora.lore`. **Do not change this** —
  deep links (`lore://`) and Supabase auth redirects depend on it.
- `apps/mobile/eas.json` — three build profiles exist and are configured:
  - `development` — dev client, internal distribution, simulator build.
  - `preview` — internal (ad hoc) distribution, device build (`ios.simulator: false`).
  - `production` — store distribution, `autoIncrement: true`, `appVersionSource: "remote"` (EAS tracks
    the build number remotely, so you never hand-edit it).
  - Each profile now declares `"environment"` (`development` / `preview` / `production`) so it picks up
    EAS-hosted environment variables automatically — see step 4.
- `getGooglePlacesKey()` in `apps/mobile/src/lib/google-places.ts` already picks
  `EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS` on iOS in production (`!__DEV__`) and
  `EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV` in dev, regardless of platform. No code change needed — verified
  correct.
- `eas-cli` is reachable from this machine (`npx eas-cli --version` → `18.11.0`, with `20.0.0` available
  as an upgrade — either works; `eas.json` only requires `>= 13.0.0`).

## 1. Restrict the production Google Places key (Google Cloud Console)

Do this before shipping any build a real tester will run — the iOS key is compiled into the JS bundle
and is technically extractable from the binary.

1. Go to https://console.cloud.google.com/apis/credentials (the project that owns
   `EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS` in `apps/mobile/.env`).
2. Click the key used for `EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS`.
3. Under **Application restrictions**, choose **iOS apps** → **Add an item** → bundle ID
   `com.shreyarora.lore`.
4. Under **API restrictions**, choose **Restrict key** → check only **Places API (New)** (uncheck
   everything else, including legacy Places API).
5. Save. Wait ~5 minutes for propagation, then sanity-check with a real device build (step 7) that
   autocomplete still returns results — a bad restriction shows up as `google-places autocomplete
   non-200` in Sentry/logs, not a crash.
6. Leave `EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV` unrestricted (or restricted to your dev machine's IP) —
   it never ships in a production build.

## 2. Log in to EAS

```bash
cd apps/mobile
npx eas login
```

Uses your Expo account (create one free at https://expo.dev if you don't have one). This is the first
step that requires interactive auth.

## 3. Configure the EAS project (fills in `extra.eas.projectId`)

```bash
cd apps/mobile
npx eas build:configure
```

`app.json` currently has `"extra": { "eas": { "projectId": "TBD" } }` — this command creates (or links)
an EAS project and writes the real project ID in its place. Commit that one-line change after it runs.

## 4. Push environment variables to EAS

The app reads these via `process.env.EXPO_PUBLIC_*` at build time (grepped across `apps/mobile/src`):

| Variable | Used by |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | `src/lib/supabase.ts` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase.ts` |
| `EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS` | `src/lib/google-places.ts` (prod, iOS) |
| `EXPO_PUBLIC_GOOGLE_PLACES_KEY_DEV` | `src/lib/google-places.ts` (dev, any platform) |
| `EXPO_PUBLIC_GOOGLE_PLACES_KEY_ANDROID` | `src/lib/google-places.ts` (prod, Android) |
| `EXPO_PUBLIC_SENTRY_DSN` | `src/lib/sentry.ts` |
| `EXPO_PUBLIC_POSTHOG_KEY` | `src/lib/posthog.ts` |
| `EXPO_PUBLIC_POSTHOG_HOST` | `src/lib/posthog.ts` (defaults to `https://us.i.posthog.com` if unset) |
| `EXPO_PUBLIC_UNSPLASH_ACCESS_KEY` | `src/components/CityHero.tsx`, `src/lib/hero-photo.ts` |

None of these values are copied into `eas.json` (it's committed to git) — do **not** add an `"env"`
block with real values. Instead, create them as EAS-hosted environment variables, once per environment
(`development`, `preview`, `production`), reading the actual values from your local
`apps/mobile/.env`:

```bash
cd apps/mobile
npx eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value "<from .env>" --visibility plaintext
npx eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<from .env>" --visibility plaintext
npx eas env:create --environment production --name EXPO_PUBLIC_GOOGLE_PLACES_KEY_IOS --value "<from .env>" --visibility sensitive
npx eas env:create --environment production --name EXPO_PUBLIC_SENTRY_DSN --value "<from .env>" --visibility plaintext
npx eas env:create --environment production --name EXPO_PUBLIC_POSTHOG_KEY --value "<from .env>" --visibility plaintext
npx eas env:create --environment production --name EXPO_PUBLIC_POSTHOG_HOST --value "<from .env>" --visibility plaintext
```

Repeat with `--environment preview` for the same variables (the `preview` profile builds a real device
build too, so it needs the same keys — Supabase anon key is public-by-design, Sentry/PostHog/Places
keys are fine to reuse across preview and production unless you want separate PostHog projects per
environment).

Notes:
- `--visibility plaintext` is readable in the EAS dashboard/CLI; `sensitive` is obfuscated in build logs;
  `secret` is never readable again after creation (fine for anything you have on file elsewhere, but
  annoying if you need to double check the value later — `plaintext`/`sensitive` are the practical
  choices for `EXPO_PUBLIC_*` values, which end up compiled into the client bundle anyway and aren't
  secret once shipped).
- If your `eas-cli` version predates the `eas env:*` commands, the older equivalent is
  `eas secret:create --scope project --name <NAME> --value "<value>"` (no `--environment` split; same
  secret is used for every profile).
- Verify what's registered: `npx eas env:list --environment production`.

## 5. Optional fast path — install directly on your own iPhone (no App Review, no TestFlight wait)

Useful as a first sanity check before going through App Store Connect at all.

```bash
cd apps/mobile
npx eas device:create   # follow the prompt; registers your iPhone's UDID to your Apple account
npx eas build --platform ios --profile preview
```

This is an **internal/ad hoc** distribution build (per `eas.json`), not a TestFlight build — when it
finishes, EAS gives you a QR code / link that installs the `.ipa` straight onto the registered device.
Good for confirming the build boots and hits production Supabase before investing in the full
TestFlight round-trip. Skip this step if you want to go straight to TestFlight.

## 6. One-time Apple / App Store Connect setup

1. https://developer.apple.com/account → **Certificates, Identifiers & Profiles** → **Identifiers** —
   confirm `com.shreyarora.lore` is registered (EAS will offer to auto-create it during step 7/8 if not;
   either way is fine).
2. https://appstoreconnect.apple.com → **My Apps** → **+** → **New App**:
   - Platform: iOS
   - Name: Vouch (or your preferred App Store display name — distinct from the internal name in
     `app.json`, which is fine)
   - Bundle ID: `com.shreyarora.lore`
   - SKU: any unique string, e.g. `vouch-ios-001`
3. Note three values from the listing / your Apple Developer account for `eas.json`:
   - `ascAppId` — App Store Connect → your app → **App Information** → **General Information** → "Apple
     ID" (a numeric ID, not your email).
   - `appleTeamId` — https://developer.apple.com/account → **Membership** → "Team ID".
   - `appleId` — the Apple ID email you use to log into App Store Connect.
4. Replace the three `"TBD"` placeholders in `apps/mobile/eas.json` under `submit.production.ios` with
   those values (or skip this — `eas submit` also accepts them as interactive prompts if left as `TBD`).

## 7. Build the production (store-distribution) binary

```bash
cd apps/mobile
npx eas build --platform ios --profile production
```

Takes roughly 10–20 minutes on EAS's cloud builders. EAS handles code signing automatically (it will
offer to generate/manage the distribution certificate and provisioning profile — accept the defaults
unless you already manage these yourself).

## 8. Submit to App Store Connect

Two options — pick one:

**Option A — `eas submit` (recommended, one command):**
```bash
cd apps/mobile
npx eas submit --platform ios --profile production --latest
```

**Option B — manual upload via Transporter:**
1. On the EAS build page (link printed at the end of step 7, or https://expo.dev → your project →
   Builds), download the `.ipa`.
2. Install **Transporter** from the Mac App Store.
3. Open Transporter, sign in with the Apple ID from step 6.
4. Drag the `.ipa` in, click **Deliver**.

Either way, Apple's processing takes roughly 10–30 minutes before the build appears under **TestFlight**
in App Store Connect ("Processing" → "Ready to Submit" / "Ready to Test").

## 9. Add testers in TestFlight

App Store Connect → your app → **TestFlight**:
- **Internal testing** (fastest, up to 100 people who are members of your App Store Connect team, no
  Apple review needed): add them under **App Store Connect Users**, then add to the internal test
  group. Available almost immediately once the build finishes processing.
- **External testing** (up to 10,000 testers by email, no team membership needed — this is what you
  want for the ~20 pilot users in `operations.md`): create a group, add tester emails, submit **for
  Beta App Review** (first build only; usually resolves within 24 hours; subsequent builds on the same
  group don't need re-review unless you materially change functionality).

Testers install the **TestFlight** app from the App Store, accept the email invite, then install Vouch
through TestFlight.

Each subsequent build: bump nothing manually (`autoIncrement: true` handles the build number), repeat
steps 7–8.

## 10. Manual QA checklist — five hero flows (do this on a real device before wide invites)

Run through as a fresh anonymous user (or your seeded founder account) on the TestFlight build, not the
simulator. For each flow, also sanity-check the privacy invariants noted below — these are hard
constraints per `CLAUDE.md` and must never be visible cross-user in a real build.

1. **Taste setup onboarding** (`taste-setup-screen.tsx`) — first-run flow completes, home city picker
   works (Google Places autocomplete returns real results — this is the first place a broken/restricted
   API key shows up), lands on the home tab without errors.
2. **Log a place** (Add tab → `log-place-screen.tsx`) — search/pick a real place via Google Places,
   save a loved/fine/skip sentiment with a tag and a voice-style note. Confirm the save is instant
   (optimistic) and shows up on Your Map afterward.
3. **Go out — browse** (Search tab → `go-out-screen.tsx`) — hub chips load, recommended places render,
   tapping a place opens `spot-screen.tsx`, "Open in Maps" drops a correct pin.
4. **People / person map** (Friends tab → `people-screen.tsx` → tap into a person →
   `person-screen.tsx`) — taste-overlap copy never uses the word "match"; no stars/scores anywhere;
   tapping through to a friend's map never reveals which specific places they marked fine/skip (only
   loved places + notes should ever be attributable) and never shows raw timestamps.
5. **Your map** (Book tab → `your-map-screen.tsx`) — readout reflects your own logged places
   immediately after step 2's save (watch for the known stale-readout race noted in
   `pending-work-plan.md` Workstream F.5 — if the empty-state prompt shows despite having loves, switch
   tabs and back before concluding it's broken).

Also confirm: Sentry receives a deliberate test error (throw once from a dev-only button or via the
device's crash reporting test), and PostHog is receiving events (`taste.place_logged`,
`taste.go_out_entered`, etc. — see `docs/pending-work-plan.md` Workstream H for the full event list).

## 11. Gaps found during this prep pass — fix before/soon after the first real build

- **App icon is not committed anywhere.** `apps/mobile/app.json` has no `"icon"` key, and there is no
  `apps/mobile/assets/` directory in the repo at all. The local `apps/mobile/ios/` folder (gitignored —
  confirmed via `.gitignore` and `git ls-files`, 0 tracked files under `ios/`) happens to have a real
  1024×1024 icon baked into `Images.xcassets/AppIcon.appiconset`, but **EAS Build clones only the git
  repo and re-runs `expo prebuild` from `app.json`** — it has no access to that local folder. Left as-is,
  the TestFlight build will ship Expo's default icon, not the real one. Fix: add a 1024×1024 PNG (no
  alpha channel) at e.g. `apps/mobile/assets/icon.png` and set `"expo.icon": "./assets/icon.png"` in
  `app.json` (and, for Android, `"expo.android.adaptiveIcon.foregroundImage"` — currently only
  `backgroundColor` is set) before a build you intend to show real testers. This needs an actual icon
  asset from design — not something to generate automatically.
- **Splash screen** is background-color only (`#FAF8F3`, matching the plugin config) with no image —
  this looks intentional (the local native project's `SplashScreenBackground.colorset` matches exactly,
  no image asset present either), not a gap, but flagging in case a logo mark was intended.
- **`version` is `0.0.1`.** Harmless for internal/preview builds (`appVersionSource: "remote"` +
  `autoIncrement: true` manage the actual build number on EAS's servers regardless of this value), but
  consider bumping to something like `1.0.0` before the first external TestFlight round — it's the
  version string testers see in the TestFlight app.
- `extra.eas.projectId` is `"TBD"` and `eas.json`'s `submit.production.ios` block is all `"TBD"` — both
  are filled in by steps 3 and 6 above, not before.

## Founder-only steps (cannot be automated by an agent)

- Google Cloud Console key restriction (step 1).
- `eas login` (step 2) — interactive Apple/Expo auth.
- `eas build:configure` (step 3) if not already linked.
- Apple Developer / App Store Connect app registration and the three ID lookups (step 6).
- Running the actual `eas build` / `eas submit` commands (steps 5, 7, 8) — these were deliberately not
  run by this pass; they need your interactive Apple ID session.
- Adding tester emails and clearing Apple's Beta App Review for external testing (step 9).
- On-device manual QA (step 10).
- Supplying the real app icon asset (§11).
