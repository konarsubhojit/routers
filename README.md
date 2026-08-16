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

- **Local dev workflow (unchanged):** place the MediaPipe `.tflite` model at
  `android/app/src/main/assets/mediapipe_text_classifier.tflite`. Do **not** commit the model
  file to git. If present, this manually-placed asset always takes priority over any remote
  download.
- **Remote model delivery (Cloudflare R2):** in production, the model is hosted on
  [Cloudflare R2](https://developers.cloudflare.com/r2/) (10 GB free tier, zero egress fees —
  important since the model is downloaded repeatedly across installs/updates). The app fetches
  a small manifest first, then downloads the `.tflite` file if needed:

  ```json
  {
    "version": "2024.06.1",
    "url": "https://<your-r2-public-bucket>/mediapipe_text_classifier.tflite",
    "sha256": "<sha256 hex digest of the file>",
    "size": 12345678
  }
  ```

  - `version` — opaque version identifier used for cache invalidation and telemetry.
  - `url` — public R2 (or R2 + custom domain) URL of the `.tflite` file.
  - `sha256` — hex-encoded SHA-256 checksum of the file; **the app refuses to use a downloaded
    model whose checksum does not match this value.**
  - `size` — expected file size in bytes, used for storage-space pre-checks.

  See `src/models/modelManager.ts` for the full logic (manual asset → cache → download,
  checksum verification, storage/network checks, Wi-Fi preference with a user-initiated
  cellular override) and `src/models/manifest.ts` for the manifest fetch/validation.

## Cloud classification tier (Tier 3, opt-in)

FileSage can optionally escalate a file to a cloud classifier (Google's
[Gemini API](https://ai.google.dev/), free tier via `@google/genai`) when the on-device
classifiers (Tier 1/2) aren't confident enough to decide. **This is off by default and must be
explicitly enabled in-app.**

What is sent, and when:

- Only when you turn on **"Tier 3: cloud classification"** in the app, and only for files the
  on-device model couldn't confidently classify.
- Never file contents. Only metadata, at a granularity you choose:
  - **Filename only** (default): the file's name and extension.
  - **Filename + size/type**: adds file size in bytes and MIME type.
- Requests are batched and rate-limited to conserve the Gemini free-tier quota, and results are
  cached locally (keyed by a hash of the metadata) so the same file is never sent twice.
- If the API key is missing, the network is unavailable, quota is exhausted, or any error
  occurs, FileSage silently falls back to the on-device classification — cloud involvement is
  never required for the app to work.
- Any file classified via Tier 3 is marked with a **`CLOUD`** badge in the review screen, so you
  always know which results involved the network.

### CI / build secrets

The following secrets are consumed at build time and must **never** be committed to the repo
(they're already gitignored):

| Secret | Purpose | Where it's used |
| --- | --- | --- |
| `GEMINI_API_KEY` | Enables the Tier 3 cloud classifier | `src/classify/cloudClassifier.ts` (`process.env.GEMINI_API_KEY`) |
| `android/app/google-services.json` | Firebase/Crashlytics config for Android | `android/app/build.gradle` (conditional plugin application) |
| `ios/GoogleService-Info.plist` | Firebase/Crashlytics config for iOS | iOS Firebase bootstrap |

Builds succeed without any of these present — the Gemini-backed tier simply reports
unavailable, and the Firebase/Crashlytics Gradle plugins are only applied when
`google-services.json` exists.

## Crash reporting (opt-out)

FileSage uses Firebase Crashlytics (free, unlimited) to catch crashes and non-fatal errors such
as SAF permission loss, file move failures, hash failures, and model/classification failures.

- **Enabled by default**, but always off in debug builds, and can be turned off entirely from
  in-app settings (`crashReportingEnabled`, persisted locally).
- **Never includes file names, paths, folder names, or file contents** — only structural
  metadata (a bucketed file count, the collision policy in use, Android API level, model
  version, and whether the cloud tier is enabled). This is enforced in code
  (`src/crash/crashReporting.ts`) and covered by an explicit test.

## Privacy

- **Your files are read locally to classify and sort them. File contents never leave your
  device**, in any mode.
- The on-device classifiers (Tiers 1–2) run entirely on-device and send nothing anywhere.
- The optional cloud tier (Tier 3) is off unless you turn it on, and even then only sends a file
  name (and optionally size/MIME type) — never contents, never the full file path.
- Crash reports contain only structural counts/flags, never file names, paths, or contents, and
  can be disabled from settings at any time.
- The model file itself is a generic on-device classifier download and is not tied to your
  personal files in any way.
