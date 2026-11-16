# Notes for whoever maintains this (human or AI)

Expo SDK 58, React Native, TypeScript strict. Read README.md and
docs/ARCHITECTURE.md first: they are short.

## Before changing anything

- Expo APIs change every SDK. Check `https://docs.expo.dev/versions/v58.0.0/`
  (or `https://docs.expo.dev/llms.txt`) rather than relying on memory.
- Add packages with `npx expo install <package>` so versions match the SDK.

## Rules of this codebase

- Business rules live in `src/core` as pure functions with tests. Screens do
  not compute money.
- Types in `src/core/types.ts` mirror database columns one-to-one.
- Screens talk to `useStore` only, never to Supabase directly.
- Colours, fonts and spacing come from `src/ui/theme.ts`. Read `color.*` inside
  components (at render), never in a module-level constant: themes swap its values.
- User-facing text is written in French and English side by side: `t('…', '…')`.
- Anything shown to owners or partners goes through `src/core/sharing.ts`.
  Do not add a field there without asking whether it is private.
- Every table has `owner_id` and the "own rows" policy. A new table without
  both is a security bug.

## Before calling a change done

```bash
npm run typecheck && npm run lint && npm test
npx expo export --platform web      # the web build still compiles
```
