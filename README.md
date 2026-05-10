# DownloadSorter

DownloadSorter is a new Android-focused app that replaces the legacy Node/Pug demo.

## Architecture (tiered)

The planned architecture is split into clear tiers:

1. **App Layer (React Native + TypeScript)**
   - UI, orchestration, and preprocessing logic.
2. **Android Native Layer (Kotlin)**
   - Platform capabilities such as file access and hashing.
3. **Tiered Classification Layer**
   - Tier 1: Gemini Nano via AICore (when available)
   - Tier 2: On-device MediaPipe/TFLite classifier fallback
   - Tier 3: Optional cloud classification (opt-in)

## Quickstart

Phase 1 is a repository cleanup and baseline documentation step.

Current status:
- Legacy Node/Pug application files removed.
- Repository prepared for React Native + Kotlin scaffolding in Phase 2.

Next step:
- Implement the new application skeleton and tooling in Phase 2.
