# 记得日记 (diary-app) agent notes

- Stack: Expo 57 / React Native 0.86 / expo-router / react-native-web; reanimated 4 + gesture-handler for drag.
- Dev: `npx expo start --web --port 8081`. Node: system node, or `../../.app-build-tools-*/node-runtime/*/bin`.
- Checks: `npm run typecheck`, `npm test`, `DIARY_TEST_URL=http://localhost:8081 npm run test:web`.
  `scripts/verify-design-system.mjs <base> <outdir>`; editor/design scripts default to port 8765.
  Several verify scripts rewrite tracked files in `docs/qa/` - revert them unless intentionally updating QA evidence.
- Seeding for Playwright: set localStorage `jide-diary:state:v1` with onboarded/tutorialSeen/editorTourSeen/shelfTourSeen true.
- IA: app launches to `/shelf` (bookshelf); opening a book sets activeNotebook and pushes `/(tabs)`; tabs content is scoped via `useBookEntries`/`scopeEntries`.
- Visual language: default style `companion` (线绘陪伴). Use theme tokens `ink`, `frame` (soft) and `frameInk` (hero only); never hardcode ink colours.
  Per-style illustration packs via `useIllustrations()`/`Illustration`; rebuild with `scripts/build-illustration-packs.py` and `scripts/build-extra-assets.py` (sources in gitignored `assets-generated/`).
- Deploy: `npm run export:web`, write `dist/release.json` (version, entry, entryHash, contentHash), then `bash scripts/deploy-web.sh` (SSH key auth to root@39.105.19.77, auto-rollback); verify with `node --import tsx scripts/verify-release.mts http://39.105.19.77 production`.
