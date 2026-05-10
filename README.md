# FileSage

React Native (bare) + TypeScript scaffold for the FileSage app.

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

## Manual Android test (Phase 5 native SAF + hashing)

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
