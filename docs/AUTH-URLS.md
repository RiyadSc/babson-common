# Authentication URL setup

Common has three distinct origins. Keep all three in Supabase Auth → URL Configuration while testing:

```text
Site URL (production):
https://babson-common.vercel.app

Redirect URLs:
https://babson-common.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

The old immutable preview URL `https://babson-common-7yml22a6c-riyadscs-projects.vercel.app` is not a current Common deployment and should be removed from Supabase’s allowed URLs. Add it only temporarily if you need to recover an old email link; request a new link afterward.

Local development reads `APP_URL=http://localhost:3000` from `.env.local`. Vercel Production reads `APP_URL=https://babson-common.vercel.app`. Preview deployments use the stable production callback until a preview-specific Auth URL is deliberately added.

The root page also forwards a legacy `?code=...` link to `/auth/callback` so a stale Supabase redirect does not strand a new session. A code is single-use; never share it or reuse it after a failed exchange.
