# Common visual system and public entry

September 21, 2026.

The public landing page uses white, Babson green (#006b45), pale blue, and a restrained lime accent. Editorial typography, thin rules, an asymmetric hero, and a responsive bento grid establish the visual system. All graphics are code-native; no third-party imagery or font downloads are required.

- `/`: public landing page with top navigation and working signup links.
- `/login`: existing-account email-link login (`shouldCreateUser: false`).
- `/signup`: account creation by verified school email, with a community commitment checkbox.
- `/app`: server-verified Babson session required before the dashboard is rendered.
- `/preview`: fictional sample experience, available only without Supabase configuration.

Successful email callbacks lead to `/app`; invalid callbacks lead to a visible error on `/login`. Signing out returns to the public landing. The sidebar and mobile app navigation are absent from all public entry pages. Microsoft SSO remains a separate provider-configuration task and is not advertised as available.

The application shares the same type, colors, buttons, event posters, form fields, panels, and dialog design across discovery, schedules, saves, hosting, profiles, notifications, and moderation.

Validation: 27 unit/database tests and eight browser tests pass. Browser coverage includes public-page navigation, route protection, callback errors, mobile overflow, axe accessibility scans, event interactions, hosting, reporting, blocking, and calendar export. Auth unit tests confirm school-domain validation and the distinction between login and signup. Browser tests run in an isolated local sample environment; no live sign-in email was sent as part of this redesign.

Screenshots are saved as `docs/redesign-*.png`. `src/app/swiss.css` contains the shared design treatment; `globals.css` retains existing functional layout rules.
