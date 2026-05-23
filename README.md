# FileSage

React Native (bare) + TypeScript scaffold for the FileSage app.

See `ARCHITECTURE.md` for the tiered classifier and pre-processing pipeline design.

## Android configuration

- **Application ID / package**: `com.filesage`
- **Minimum SDK**: 26
- **Target SDK**: 34

## Tooling

- ESLint + Prettier using React Native defaults (`@react-native/eslint-config`, `.prettierrc.js`)
- Jest configured with React Native preset (`@react-native/jest-preset`)
- TypeScript typecheck script: `npm run typecheck`

## Quickstart

```sh
npm ci
npm run lint
npm test
```

To run on Android (with emulator/device configured):

```sh
npm run android
```

In-app flow (write mode v2):

1. Tap **Scan Folder** and choose a folder in the Android SAF picker.
2. Wait for scan + classification to complete, then review grouped files.
3. Select files, choose a collision policy (`Rename`, `Skip`, `Overwrite`), and tap **Move**.
4. Optionally use **Undo last move** to replay the latest move batch in reverse.

## Screenshots (placeholder)

Planned assets for follow-up docs/UI capture work (paths intentionally reserved):

- `docs/screenshots/01-choose-folder.png` — Choose folder (SAF picker)
- `docs/screenshots/02-scan-review.png` — Scan results + selected files
- `docs/screenshots/03-move-summary.png` — Move summary + undo action

## Manual Android test (folder scan + hashing)

These steps must be run on an Android emulator/device (not in CI):

1. Start the app with `npm run android`.
2. In a debug JS context (for example Metro console or app dev menu), import:
   `requestTreePermission`, `scanTree`, and `sha256` from `src/native`.
3. Call `requestTreePermission()` and select any folder you want to scan in the SAF picker.
4. Call `scanTree(<returnedTreeUri>)` and verify that it returns entries with
   `{uri, name, sizeBytes, mtime, mimeType}`.
5. Pick one returned file URI and call `sha256(file.uri)` to verify a lowercase
   SHA-256 hex string is returned.

## MediaPipe text classifier model asset (Phase 6)

- Place the MediaPipe `.tflite` model at:
  `android/app/src/main/assets/mediapipe_text_classifier.tflite`.
- Do **not** commit the model file to git.
