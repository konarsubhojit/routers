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
   - **Tier 3:** Cloud classifier (opt-in setting, default OFF)
5. UI review + write mode (v2):
   - Grouped list by bucket
   - Review badges (`DUPLICATE`, `OLD`, `TEMPORARY`)
   - "Selected for review" subset list
   - Collision policy selection (`Rename`, `Skip`, `Overwrite`)
   - "Move selected files" and "Undo last move" actions

## Diagnostics behavior

- If Tier 1 is available, UI reports **`AICore: available`**.
- Otherwise, if Tier 2 is available, UI reports **`MediaPipe: available`**.
- If neither is available, UI reports no on-device classifier.

## Privacy and permission model

- Tier 3 cloud classification is disabled by default and controlled by explicit user opt-in.
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
UI -> batchMove: batchMove(groups, selectedTreeUri, collisionPolicy)
batchMove -> FolderManagerModule: ensureChildDirectory(treeUri, bucket)
FolderManagerModule -> batchMove: destination bucket URI
batchMove -> FileMoverModule: moveDocument(sourceUri, bucketUri, displayName)
FileMoverModule -> batchMove: destinationUri | error
batchMove -> moveJournal: saveJournal(moved entries)
batchMove -> UI: moved/skipped/errors summary
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
  - `rename` (default): retries with `name (1)` ... `name (99)` before failing
    (`MAX_RENAME_ATTEMPTS = 99`).
  - `skip`: treats name conflict as skipped file.
  - `overwrite` (current behavior): does **not** replace existing files yet; name
    conflicts are surfaced as errors and processing continues.

### Undo semantics and limitations

- Undo replays only the **most recent** move journal and restores each file to its original
  parent directory using its original display name.
- Undo is best-effort: per-file failures are reported while other entries continue.
- Journal is cleared after undo replay, so undo is one-shot for the latest batch.
- Journal is in-memory only (not persisted across app restarts/process death).
- Only successfully moved files are journaled; skipped/error entries are not undoable.
