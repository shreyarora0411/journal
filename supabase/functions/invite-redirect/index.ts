// invite-redirect — a stable URL every invite/share message can carry.
//
// WHY (the stale-link problem): buildFollowLink()'s only prior form was a
// raw vouch://follow?id=<id> scheme link, dead on arrival for anyone without
// the app already installed — exactly the invitee we most need to reach.
// Pointing INVITE_URL straight at an EAS artifact URL would work today, but
// that URL changes on every new build (four different ones in one session),
// silently breaking every link already sent out in old WhatsApp threads.
// This function is the fixed point: INVITE_URL points HERE once, and this
// function resolves to whatever app_config.invite_install_url currently is
// (migration 70) — updateable with one SQL UPDATE, no app release, no
// function redeploy, no link ever goes stale again.
//
// WHY html, not a plain 302 (the already-installed-user problem): a raw
// redirect to a bare *.supabase.co URL is NOT an iOS/Android Associated
// Domain for this app — nothing OS-level intercepts it, so a plain 302
// would open a browser for EVERY tap, even from someone who already has the
// app installed and would previously auto-follow via the vouch:// scheme
// (see pending-follow.ts's parseFollowUrl, which also only recognizes a
// `follow` path segment — this URL's path never had one). Standing up a
// true Associated Domain needs a custom domain we host + signed association
// files, out of scope for now. This function gets the same practical
// outcome the cheap way: serve an HTML page that tries the vouch:// scheme
// immediately (works if the app is installed, doesn't need Associated
// Domains — the app's own custom URL scheme is enough), then falls back to
// the install link after a short delay if nothing intercepted it. Standard
// deferred-deep-link bounce pattern used before investing in Universal/App
// Links. <noscript> covers the no-JS case with a meta-refresh straight to
// the install link.
//
// Public and unauthenticated by necessity — the person clicking this has no
// account yet. Read-only: never writes app_config, never processes user
// input beyond forwarding an opaque id string into a scheme URL and a query
// param (both escaped for safe embedding — see escapeHtml/JSON.stringify
// below).
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.6';

const FALLBACK_URL = 'https://expo.dev/accounts/shreyarora/projects/lore/builds';
const APP_SCHEME = 'vouch';
// Long enough that a real app-open has time to background this tab before
// we fall back; short enough that a user without the app isn't left
// staring at a blank page.
const FALLBACK_DELAY_MS = 1200;

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

Deno.serve(async (req: Request) => {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const { data, error } = await admin
    .from('app_config')
    .select('value')
    .eq('key', 'invite_install_url')
    .maybeSingle();

  // Never dead-end an invitee on a config-read failure — fall back to the
  // project's own builds page rather than a blank error screen.
  const target = !error && data?.value ? data.value : FALLBACK_URL;

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const installUrl = new URL(target);
  if (id) installUrl.searchParams.set('id', id);
  const installUrlStr = installUrl.toString();

  // No id to follow — nothing app-specific to try first, a plain redirect
  // to the install link is both correct and faster.
  if (!id) {
    return new Response(null, { status: 302, headers: { Location: installUrlStr } });
  }

  const schemeUrl = `${APP_SCHEME}://follow?id=${encodeURIComponent(id)}`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opening Vouch…</title>
<noscript><meta http-equiv="refresh" content="0;url=${escapeHtml(installUrlStr)}"></noscript>
</head>
<body>
<script>
  window.location.href = ${JSON.stringify(schemeUrl)};
  setTimeout(function () {
    window.location.href = ${JSON.stringify(installUrlStr)};
  }, ${FALLBACK_DELAY_MS});
</script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
});
