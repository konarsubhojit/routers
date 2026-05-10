# DownloadSorter — hierarchical issue plan

This document is the source of truth for the issues that should be opened on
GitHub for the **DownloadSorter** rewrite. It exists because the agent that
drafted the plan was running in a sandbox without permission to create issues
via the GitHub API, and we want a durable, reviewable artifact rather than a
chat transcript.

The plan models a single **Epic** with **7 phase sub-issues**. A small
`gh`-based script at the bottom of this file will create them all and link
each phase issue as a sub-issue of the epic via the GraphQL `addSubIssue`
mutation.

> **Scope recap** — React Native (bare) + Kotlin native modules for SAF and
> other Android-specific features. v1 is **read-only**: scan and recommend,
> never delete or move files. No iOS. No bundled ML model in git.

---

## EPIC — Build "DownloadSorter": tiered on-device AI cleaner for Android Downloads

**Goal.** Replace the legacy Node/Pug demo with a React Native (bare) +
Kotlin app that scans the user's Downloads folder, runs a no-AI
pre-processing pipeline (extension buckets, SHA-256 dedupe, age check), then
classifies ambiguous files as `TEMPORARY` vs `PERMANENT` through a tiered AI
fallback:

1. **Tier 1** — Gemini Nano via AICore (flagship devices only).
2. **Tier 2** — MediaPipe / TFLite text classifier (broad device support).
3. **Tier 3** — Opt-in cloud classification (default OFF, explicit consent).

**Non-goals (v1).** No file deletion or movement. No bundled large model in
git. No iOS support.

**Sub-issues.** Phases 1 → 7 below.

---

## Phase 1 — Repo cleanup & baseline docs

**Parent.** Epic.

**Tasks.**

- [ ] Delete legacy files: `app.js`, `handlers.js`, `routers.js`, `server.js`,
      `index.html`, `scripts.js`, `message.pug`, `register.pug`,
      `package.json`, `package-lock.json`, `a.out`, `.vscode/`.
- [ ] Keep `.git/`, `.github/`, `.gitignore`. Extend `.gitignore` for
      Android, React Native, Node, Gradle, Kotlin.
- [ ] Update `.github/copilot-instructions.md` (currently describes the
      Node/Pug app) — replace with placeholder pointing to the new
      architecture; final version lands in Phase 2.
- [ ] Add a top-level `README.md` describing the new app, the tiered
      architecture, and a quickstart.

**Acceptance.** Repo root contains only the new app skeleton + docs;
`git status` is clean.

---

## Phase 2 — Scaffold React Native (bare) + TypeScript + tooling

**Parent.** Epic. **Depends on.** Phase 1.

**Tasks.**

- [ ] `npx @react-native-community/cli init DownloadSorter --template
      react-native-template-typescript`. Move generated files to repo root.
- [ ] Confirm `npm run android`, `npm test`, `npm run lint` all work on a
      fresh clone.
- [ ] Configure ESLint + Prettier (RN defaults) and Jest (TS preset).
- [ ] Add CI workflow `.github/workflows/ci.yml`: install, lint, typecheck,
      jest. (No Android emulator build in CI v1.)
- [ ] Choose package id `com.konarsubhojit.downloadsorter`, min SDK 26,
      target SDK 34. Document in README.

**Acceptance.** `npm ci && npm run lint && npm test` green locally and in CI.

---

## Phase 3 — Pre-processing pipeline (pure TypeScript, fully unit-tested)

**Parent.** Epic. **Depends on.** Phase 2.

**Tasks.**

- [ ] `src/preprocess/extensionBuckets.ts` — map ext → bucket
      (`Installers`, `Archives`, `Images`, `Docs`, `Audio`, `Video`,
      `Other`).
- [ ] `src/preprocess/duplicates.ts` — pure
      `groupByHash(files: {path,hash}[]): Map<hash, files[]>`; flag
      duplicates.
- [ ] `src/preprocess/ageFilter.ts` — flag files older than configurable
      threshold (default 180 days).
- [ ] Jest unit tests for every function, including edge cases (no
      extension, mixed case, empty list, single file).

**Acceptance.** ≥ 90% line coverage on `src/preprocess/`.

---

## Phase 4 — Tiered classifier abstraction + stubs

**Parent.** Epic. **Depends on.** Phase 2.

**Tasks.**

- [ ] `src/classify/types.ts` — `FileMeta`,
      `Classification = 'TEMPORARY' | 'PERMANENT' | 'UNKNOWN'`,
      `Classifier` interface (`isAvailable()`, `classify(file)`).
- [ ] `src/classify/tieredClassifier.ts` — accepts `[tier1, tier2, tier3]`,
      picks first `isAvailable()`, falls through on error.
- [ ] Stub implementations: `aicoreClassifier.ts`,
      `mediapipeClassifier.ts`, `cloudClassifier.ts` — each returns
      `isAvailable() === false` until its corresponding native module /
      network layer lands.
- [ ] Unit tests: priority order, fallback on unavailable, fallback on
      thrown error.

**Acceptance.** Tiered selection logic works with any combination of
available tiers; covered by tests.

---

## Phase 5 — Native modules (Kotlin) for SAF & hashing

**Parent.** Epic. **Depends on.** Phase 2.

**Tasks.**

- [ ] `FileScannerModule` (Kotlin) — request SAF persistent permission for
      the Downloads tree URI; stream file metadata
      `{uri, name, sizeBytes, mtime, mimeType}`.
- [ ] `HashingModule` (Kotlin) — SHA-256 of a content URI on a background
      dispatcher; return hex.
- [ ] TS bridge typings under `src/native/`.
- [ ] Manual test instructions added to README (cannot be CI-tested without
      an emulator).

**Sub-tasks (optional checklist inside this issue).**

- [ ] 5a SAF permission flow
- [ ] 5b Streaming scanner
- [ ] 5c SHA-256 module
- [ ] 5d TS typings + RN bridge

**Acceptance.** On a real device, "Scan Downloads" returns a populated list
with hashes.

---

## Phase 6 — Tier 2: MediaPipe text classifier (real)

**Parent.** Epic. **Depends on.** Phase 4, Phase 5.

**Tasks.**

- [ ] `MediaPipeClassifierModule` (Kotlin) using MediaPipe Tasks
      `TextClassifier`.
- [ ] Document where to drop the `.tflite` model in
      `android/app/src/main/assets/` (do **not** commit the model).
- [ ] Wire into `mediapipeClassifier.ts` so `isAvailable()` returns true
      when the asset is present.
- [ ] Map MediaPipe labels → `TEMPORARY` / `PERMANENT` heuristic.

**Acceptance.** With a sample model present, classifying a known
"boarding pass"-style string returns `TEMPORARY`.

---

## Phase 7 — Minimal UI + AICore stub + cloud opt-in (read-only v1)

**Parent.** Epic. **Depends on.** Phase 5, Phase 6.

**Tasks.**

- [ ] One screen: "Scan Downloads" button → grouped list by bucket →
      badges `DUPLICATE`, `OLD`, `TEMPORARY`.
- [ ] No deletion/movement actions in v1 — only a "Selected for review"
      list.
- [ ] `AICoreClassifierModule` (Kotlin) — `isAvailable()` checks AICore +
      Gemini Nano presence; classify path stubbed behind feature flag;
      clear TODO with link to AICore docs.
- [ ] Settings toggle for "Tier 3: cloud classification" — default OFF,
      with explicit privacy warning copy.
- [ ] `ARCHITECTURE.md` describing the tiered design and pre-processing
      pipeline.

**Acceptance.** App launches on a real device, scans Downloads, displays
the categorized read-only list; flagship devices show
"AICore: available" diagnostic, others show "MediaPipe: available".

---

## Creating these issues with `gh`

Run from a checkout of this repo, with a `gh` token that has `repo` scope.
The script creates the epic first, then each phase issue, then links each
phase as a sub-issue of the epic via the GraphQL `addSubIssue` mutation.

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO="konarsubhojit/routers"

# 1. Create the epic.
EPIC_URL=$(gh issue create --repo "$REPO" \
  --title "EPIC: Build DownloadSorter — tiered on-device AI cleaner for Android Downloads" \
  --body  "See ISSUES.md (section 'EPIC') for the full description. Sub-issues will be linked below.")
EPIC_NUM="${EPIC_URL##*/}"
EPIC_ID=$(gh api "repos/$REPO/issues/$EPIC_NUM" --jq .node_id)
echo "Epic #$EPIC_NUM created."

# 2. Create each phase issue and link it as a sub-issue of the epic.
phases=(
  "Phase 1 — Repo cleanup & baseline docs"
  "Phase 2 — Scaffold React Native (bare) + TypeScript + tooling"
  "Phase 3 — Pre-processing pipeline (pure TypeScript, fully unit-tested)"
  "Phase 4 — Tiered classifier abstraction + stubs"
  "Phase 5 — Native modules (Kotlin) for SAF & hashing"
  "Phase 6 — Tier 2: MediaPipe text classifier (real)"
  "Phase 7 — Minimal UI + AICore stub + cloud opt-in (read-only v1)"
)

for title in "${phases[@]}"; do
  url=$(gh issue create --repo "$REPO" \
    --title "$title" \
    --body  "Parent: #$EPIC_NUM. See ISSUES.md (section '$title') for tasks and acceptance criteria.")
  num="${url##*/}"
  child_id=$(gh api "repos/$REPO/issues/$num" --jq .node_id)
  gh api graphql \
    -f query='mutation($parent:ID!,$child:ID!){addSubIssue(input:{issueId:$parent,subIssueId:$child}){subIssue{number}}}' \
    -f parent="$EPIC_ID" -f child="$child_id" >/dev/null
  echo "  • #$num linked under epic #$EPIC_NUM — $title"
done
```

If the `addSubIssue` mutation is unavailable on the repository (older API
preview), the phase issues will still be created and the epic checklist of
phases will continue to function as a manual hierarchy.
