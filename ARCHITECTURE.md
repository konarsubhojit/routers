# DownloadSorter architecture (Phase 7)

DownloadSorter is a React Native (TypeScript) app with Kotlin Android native modules.

## High-level flow

1. User selects a folder through the Android SAF tree picker.
2. Native scanner walks the tree and returns file metadata (`uri`, `name`, `sizeBytes`, `mtime`, `mimeType`).
3. Pre-processing pipeline runs locally:
   - Extension bucket grouping (`Installers`, `Archives`, `Images`, `Docs`, `Audio`, `Video`, `Other`)
   - SHA-256 duplicate detection
   - Age check (`OLD`) threshold flagging
4. Tiered classification runs with fallback:
   - **Tier 1:** AICore / Gemini Nano (`AICoreClassifierModule`) when available
   - **Tier 2:** MediaPipe on-device text classifier
   - **Tier 3:** Cloud classifier (Gemini API, opt-in setting, default OFF) — used only when
     Tier 1/2 return `UNKNOWN` (i.e. on-device confidence is too low to decide) **and** the
     user has explicitly enabled cloud classification in settings.
5. UI review + write mode (v2):
   - Grouped list by bucket
   - Review badges (`DUPLICATE`, `OLD`, `TEMPORARY`, `CLOUD`) — the `CLOUD` badge marks any
     file whose classification came from Tier 3, so the tier that produced a result is always
     visible to the user.
   - "Selected for review" subset list
   - Collision policy selection (`Rename`, `Skip`, `Overwrite`)
   - "Move selected files" and "Undo last move" actions

## Diagnostics behavior

- If Tier 1 is available, UI reports **`AICore: available`**.
- Otherwise, if Tier 2 is available, UI reports **`MediaPipe: available`**.
- If neither is available, UI reports no on-device classifier.

## Model delivery pipeline (Tier 2 MediaPipe model)

The MediaPipe `.tflite` model is distributed out-of-band rather than bundled in the APK, so it
can be updated without a new app release and doesn't inflate binary size.

- **Hosting:** Cloudflare R2 (10 GB free tier, zero egress fees — the model is a repeated
  binary download, so egress cost would otherwise dominate).
- **Manifest:** a small JSON document fetched first: `{version, url, sha256, size}`.
- **`src/models/modelManager.ts`** (`ensureModel()`) implements, in priority order:
  1. If a model asset has been manually placed at
     `android/app/src/main/assets/mediapipe_text_classifier.tflite` (the existing dev
     workflow), use it — this keeps local development working with zero network access.
  2. Otherwise, if a previously downloaded model is already cached and its SHA-256 checksum
     still matches the manifest, reuse the cache.
  3. Otherwise, download fresh from the manifest URL to app-private storage, verify the
     SHA-256 checksum, and only then mark it usable. **A checksum mismatch discards the
     download and never allows an unverified model to be loaded.**
- Handles: no network on first launch (fails safely, or falls back to any previously verified
  cached model if the manifest itself can't be fetched), interrupted/resumed downloads (partial
  byte-range resume), corrupt cache (redownloaded), and insufficient device storage (rejected
  before writing).
- Prefers Wi-Fi for the initial download; a `userInitiated`/`allowCellular` option lets the user
  explicitly retry over cellular if Wi-Fi is unavailable.
- Fully unit tested with an in-memory fake filesystem (`__tests__/models/modelManager.test.ts`);
  the production adapter (`src/models/rnModelFileSystem.ts`) wires this to `react-native-fs` and
  `@react-native-community/netinfo`.

## Cloud fallback classification tier (Tier 3, Gemini)

- **Strictly opt-in, off by default.** The Settings toggle shows a clear explanation of what
  leaves the device before it can be enabled (`src/screens/PickFolderScreen.tsx`).
- **Only file metadata ever leaves the device — never file contents.** Two granularity levels,
  chosen by the user:
  - `filename` (default): file name + extension only.
  - `filename+metadata`: adds file size and MIME type.
  See `src/classify/cloudMetadata.ts` (`buildCloudPayload`) — the full file path is intentionally
  never included, only the basename.
- Requests are **batched** (`src/classify/cloudBatchClassifier.ts`) to conserve the Gemini free
  tier quota, and **rate-limited** with a fixed-window limiter.
- On any error, quota exhaustion, or a missing API key, the tier **degrades to the on-device
  result** — the app never blocks or fails a scan because the cloud tier is unavailable
  (`src/classify/cloudFallback.ts`, `classifyWithCloudEscalation`).
- Cloud results are **cached locally**, keyed by a hash of the metadata payload, so identical
  files are never re-sent.
- Escalation only happens when the on-device tiers return `UNKNOWN` (used here as the proxy for
  "confidence below threshold", since the on-device classifiers don't expose a numeric
  confidence score) **and** the user has opted in.
- The `CLOUD` review badge (see above) always tells the user which files were classified with
  network involvement.

## Crash reporting (Firebase Crashlytics)

- Free, unlimited, added for both Android and iOS via `@react-native-firebase/app` +
  `@react-native-firebase/crashlytics`.
- `google-services.json` / `GoogleService-Info.plist` are **never committed** (gitignored) —
  they're injected from CI secrets at build time. The Android Gradle build succeeds with or
  without these files present (the Google Services / Crashlytics Gradle plugins are only
  applied when `google-services.json` exists).
- Collection is **disabled in debug builds** regardless of the user setting
  (`shouldEnableCrashReporting`), and otherwise honours a user opt-out persisted via
  `src/settings/appSettings.ts` (`crashReportingEnabled`, default ON).
- Non-fatals are recorded for: SAF permission loss, file move failures, hash failures, model
  load/download failures, and classification errors.
- Custom keys attached to reports: file count bucket (never an exact count), collision policy,
  Android API level, model version, and whether the cloud tier is enabled.
- **Contract: crash telemetry never contains file names, paths, folder names, or file
  contents.** `src/crash/crashReporting.ts` enforces this with an explicit allow-list
  (`sanitizeContext`) and path-like-token redaction of free-text error messages
  (`redactMessage`); `__tests__/crash/crashReporting.test.ts` asserts this contract directly.

## Privacy and permission model

- Tier 3 cloud classification is disabled by default and controlled by explicit user opt-in;
  when enabled, only a file's name (and optionally size/MIME type) is sent to the Gemini API —
  never file contents, never the full path.
- Crash reporting is enabled by default but user-controllable, disabled entirely in debug
  builds, and structurally prevented from ever including file names/paths/contents.
- SAF tree permission is required for scan/move actions (`requestTreePermission`).
- `MANAGE_EXTERNAL_STORAGE` is optional (Android 11+), gated behind explicit user action
  in system settings, and expands access to SAF-restricted paths.

## Write mode (v2)

### Sequence diagram

```text
User -> UI: Choose folder
UI -> FileScannerModule: requestTreePermission()
FileScannerModule -> UI: selectedTreeUri (persisted SAF grant)
UI -> FileScannerModule: scanTree(selectedTreeUri)
FileScannerModule -> UI: scanned files
UI -> Classifier pipeline: bucket + badges + tiered classify
Classifier pipeline -> UI: grouped review list
User -> UI: Select files + collision policy + Move
UI -> BatchMove: batchMove(groups, selectedTreeUri, collisionPolicy)
BatchMove -> FolderManagerModule: ensureChildDirectory(treeUri, bucket)
FolderManagerModule -> BatchMove: destination bucket URI
BatchMove -> FileMoverModule: moveDocument(sourceUri, bucketUri, displayName)
FileMoverModule -> BatchMove: destinationUri | error
BatchMove -> moveJournal: saveJournal(moved entries)
BatchMove -> UI: moved/skipped/errors summary
User -> UI: Undo last move
UI -> undoLastMove: replay last journal
undoLastMove -> FileMoverModule: moveDocument(destinationUri, originalParentUri, originalName)
undoLastMove -> UI: restored/errors summary (journal cleared)
```

### Destination folders, naming, and creation rules

- Files are moved into top-level bucket directories under the selected folder:
  `Installers`, `Archives`, `Images`, `Docs`, `Audio`, `Video`, `Other`.
- Bucket directory names are fixed extension-bucket labels (single path segment only).
- If a bucket directory already exists and is a directory, it is reused.
- If an entry with the bucket name exists but is not a directory, move for that bucket fails.
- Files are never moved outside the selected SAF tree in the current UI flow.

### Move semantics and collision policy

- Move is best-effort per batch: failures are collected and remaining files continue.
- Native move first attempts `DocumentsContract.moveDocument`; if unavailable, it falls
  back to copy-then-delete with cleanup on partial failure.
- Collision policies:
  - `rename` (default): tries the original name first, then retries with
    `name (1)` ... `name (99)`. `MAX_RENAME_ATTEMPTS = 99` counts **retry**
    attempts only (it excludes the initial original-name attempt), so total
    max attempts per file is 100.
  - `skip`: treats name conflict as skipped file.
  - `overwrite` (UI label only, current behavior): despite the label, implementation
    is currently equivalent to fail-on-conflict (no replacement); name conflicts
    are surfaced as errors and processing continues.

### Undo semantics and limitations

- Undo replays only the **most recent** move journal and restores each file to its original
  parent directory using its original display name.
- Undo is best-effort: per-file failures are reported while other entries continue.
- Journal is cleared after undo replay, so undo is one-shot for the latest batch.
- Journal is in-memory only (not persisted across app restarts/process death).
- Only successfully moved files are journaled; skipped/error entries are not undoable.
