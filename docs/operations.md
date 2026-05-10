# Operations

How the pilot ships. Companion to [build-plan.md](./build-plan.md) §Phase 5.

## Local dev

```bash
corepack enable
pnpm install
cd apps/mobile && pnpm web         # http://localhost:8081 in any browser
# or
cd apps/mobile && npx expo start    # press i / a / w for iOS / Android / web
```

`apps/mobile/.env` must contain `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Anon keys are public-by-design; security comes from RLS.

## Supabase

- Project URL: see Supabase dashboard.
- Anonymous Sign-Ins must be enabled (Authentication → Sign In/Up → Anonymous Sign-Ins). See [ADR 0004](./decisions/0004-pilot-anonymous-auth.md).
- Edge functions live in `supabase/functions/*` and deploy via `supabase functions deploy <name>`.
- Required edge-function secrets:
  - `ANTHROPIC_API_KEY` — for `extract-entities`.
  - `PHONE_HASH_PEPPER` — server pepper for `match-contacts`. Set to any random 32+ char string; rotating breaks existing matches.

### Applying a migration

Two routes:

1. **CLI (preferred when it works):** `supabase link --project-ref <ref>`, then `supabase db push`. Re-running after a failed push may need the migration tracking table cleared — easier to use route 2.
2. **Dashboard SQL Editor:** paste the migration file contents into a New Query and Run. Always rerun the grants block after creating tables:
   ```sql
   grant all on all tables in schema public to anon, authenticated, service_role;
   grant all on all sequences in schema public to anon, authenticated, service_role;
   ```

## TestFlight (iOS)

Prerequisites: Apple Developer Program membership ($99/yr), App Store Connect access, EAS account (free at expo.dev).

1. **One-time:**
   - `cd apps/mobile && npx eas init` — creates an EAS project, fills `extra.eas.projectId` in `app.json`.
   - In Apple Developer portal → Identifiers, register the bundle ID `com.shreyarora.journal`.
   - In App Store Connect → Apps → New App, create the listing. Note the `ascAppId`.
   - Update `apps/mobile/eas.json` submit.production.ios with `appleId`, `ascAppId`, `appleTeamId`.
2. **Build:**
   ```bash
   cd apps/mobile
   eas build --profile production --platform ios
   ```
   Takes ~15 min. EAS handles signing.
3. **Submit:**
   ```bash
   eas submit --profile production --platform ios --latest
   ```
4. **TestFlight invites:** App Store Connect → Apps → Journal → TestFlight → External Testers → add the 20 pilot user emails. They receive a TestFlight invite; install via the TestFlight app on iOS.

Each subsequent push to TestFlight: bump version (handled by `autoIncrement: true` in eas.json), build, submit.

## Play Internal (Android)

Prerequisites: Google Play Console account ($25 one-time), service account JSON for `eas submit`.

1. **One-time:**
   - Play Console → Create App, with package name `com.shreyarora.journal`.
   - Generate a service account in Google Cloud, grant it the Service Agent role on the Play Console.
   - Download the JSON key and store as `apps/mobile/service-account.json` (gitignored).
2. **Build:**
   ```bash
   eas build --profile production --platform android
   ```
3. **Submit:**
   ```bash
   eas submit --profile production --platform android --latest
   ```
4. **Internal track invites:** Play Console → Testing → Internal testing → manage tester list. Up to 100 testers.

## Pilot onboarding playbook

Five steps per user (~15 min each):

1. Send personalised invite (WhatsApp message + TestFlight link).
2. They install via TestFlight, complete onboarding, hit Feed.
3. 10-min onboarding call: walk through the five hero flows from `docs/design-brief.md`.
4. They log their first trip on the call.
5. Add them to the shared feedback Notion doc.

Weekly review: triage feedback, file ADRs for non-obvious decisions, push fixes the same week.

## Sentry, PostHog

- Sentry catches unhandled errors; the `log` helper wraps it. PII is scrubbed in `lib/sentry.ts`.
- PostHog receives onboarding funnel events plus the structured events from `log.event()`. Events follow `<feature>.<action>` (e.g. `trip.created`, `follow.created`).
- Both initialise from env vars (`EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_KEY`) and silently no-op when keys are missing.

## Common breakage

| Symptom | Likely cause | Fix |
|---|---|---|
| "Anonymous sign-ins are disabled" toast on phone screen | Toggle off in Supabase dashboard | Authentication → Sign In/Up → enable |
| Tables exist but every read returns 401 | Postgres role grants missing on the table | Re-run the grants block above |
| Trip detail "Not found" right after save | Browser session is a different anonymous user than the trip's owner | Sign out + re-onboard; orphaned trips can be left or DB-cleaned |
| Extraction shows "No entities yet" forever | `ANTHROPIC_API_KEY` not set, or note is too short | Check Edge Functions → extract-entities → Logs in Supabase |
