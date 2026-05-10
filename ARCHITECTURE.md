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
5. UI remains read-only in v1 and shows:
   - Grouped list by bucket
   - Review badges (`DUPLICATE`, `OLD`, `TEMPORARY`)
   - "Selected for review" subset list

## Diagnostics behavior

- If Tier 1 is available, UI reports **`AICore: available`**.
- Otherwise, if Tier 2 is available, UI reports **`MediaPipe: available`**.
- If neither is available, UI reports no on-device classifier.

## Privacy and v1 constraints

- Tier 3 cloud classification is disabled by default and controlled by explicit user opt-in.
- No deletion or file movement actions are available in v1.
