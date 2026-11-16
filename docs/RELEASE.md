# Releasing

## Web (also the "install on iPhone today" route)

The web build is a static site (`npx expo export --platform web` → `dist/`).
`vercel.json` holds the build settings. The site is on Vercel at
<https://stayfolio-gamma.vercel.app>; every push to `main` redeploys it.
For another address:

1. Put the address in `.env` as `EXPO_PUBLIC_WEB_URL` (shared statement links
   and password-reset emails point there) and redeploy.
2. Set the same address in Supabase (see docs/SECURITY.md, "Recommended settings").

On an iPhone: open the address in Safari → Share → **Add to Home Screen**.
The app opens full screen with its own icon. The camera and file pickers work.

## iPhone app (TestFlight, then App Store)

Requirements that only the account owner can provide:

- an **Apple Developer Program** membership ($99 / year);
- a free **Expo** account.

First build (once, interactive, about 15 minutes of attention):

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest init                 # links the project, writes the project id
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

EAS asks for the Apple ID and its two-factor code, then creates the
certificates, the provisioning profile and the App Store Connect app itself.
No Mac and no Xcode are needed. When the build finishes it appears in
**TestFlight**: install the TestFlight app on the iPhone and open the build.

After that, builds can run without anyone at the keyboard:

1. expo.dev → Account settings → Access tokens → create a token.
2. GitHub → repository → Settings → Secrets → `EXPO_TOKEN`.
3. GitHub → Actions → **Build iOS** → Run workflow.

### Before submitting for App Store review

- [ ] App Store Connect → App Privacy: declare *Contact info (email)*,
      *Financial info* and *User content (photos, documents)*, all "linked to
      the user", none used for tracking.
- [ ] Privacy policy URL: `<web address>/privacy`.
- [ ] A demo account for the reviewer (or mention "Explore the demo" on the sign-in screen).
- [ ] Screenshots (6.9" iPhone), description, support URL.
- [ ] Account deletion is in Settings (required, already built).
- [ ] If Apple emails about a missing "required reason" API, add the reason to
      `ios.privacyManifests` in `app.json` and rebuild.

Apple currently requires builds made with Xcode 26 / the iOS 26 SDK; EAS's
default image for this Expo SDK satisfies that.

## Android (when wanted)

Nothing to rewrite. `npx eas-cli build --platform android`, a Google Play
developer account ($25 once), and the Play Console's data-safety form. Google
also requires a web link for account deletion: use `<web address>` (Settings →
Delete my account).

## Version numbers

`version` in `app.json` is what users see (1.0.0). Build numbers are managed
by EAS and increase automatically.
