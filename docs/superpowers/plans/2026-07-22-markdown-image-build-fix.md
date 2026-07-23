# Markdown Image Build Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make source Markdown with local relative images build successfully and expose actionable Astro failures in `app.log`.

**Architecture:** Markdown processing rewrites only local relative image destinations to the already-copied `/downloads` asset tree. The build runner logs captured child-process output on failure while retaining it in the build result.

**Tech Stack:** Node.js ESM, Astro, `node:test`, `gray-matter`

## Global Constraints

- Do not change remote, root-absolute, anchor, or data image destinations.
- Do not add dependencies.
- Preserve the existing generated image wrapper pages and download paths.

---

### Task 1: Rewrite local Markdown image destinations

**Files:**
- Modify: `tests/prebuild.test.js`
- Modify: `scripts/prebuild/processors.js`

**Interfaces:**
- Consumes: source Markdown path and destination Markdown path passed to `processMarkdownFile(srcFile, destFile, stats)`
- Produces: Markdown whose local image destinations point to `/downloads/<source-relative-path>`

- [ ] Add a test with nested Markdown containing local, remote, root-absolute, anchor, and data image destinations.
- [ ] Run `node --test tests/prebuild.test.js` and confirm the local destination assertion fails.
- [ ] Add a focused rewrite helper and call it from `processMarkdownFile` before serialization.
- [ ] Run `node --test tests/prebuild.test.js` and confirm it passes.

### Task 2: Emit captured Astro errors to app.log

**Files:**
- Modify: `tests/unit/build-pipeline.test.js`
- Modify: `scripts/build.js`

**Interfaces:**
- Consumes: `err.stderr` and `err.stdout` attached by `execAsync`
- Produces: captured command output on `console.error` and in the existing returned build log

- [ ] Add a test that forces a child build failure and captures `console.error` output.
- [ ] Run `node --test tests/unit/build-pipeline.test.js` and confirm the output assertion fails.
- [ ] Emit non-empty captured stderr/stdout from the `runBuild` catch path.
- [ ] Run `node --test tests/unit/build-pipeline.test.js` and confirm it passes.

### Task 3: Verify the service build

**Files:**
- No production file changes.

**Interfaces:**
- Consumes: the two completed fixes
- Produces: a successful static site in `/tmp/git-docs/lk-docs/dist`

- [ ] Run `npm test` and confirm all tests pass.
- [ ] Run `SOURCE_DIR=/Users/ryan.kim/develop/workspace/liveklass/lk-docs DIST_DIR=/tmp/git-docs/lk-docs/dist DATA_DIR=/tmp/git-docs/lk-docs/data ADMIN_EMAIL=ryan.kim@liveklass.com PORT=3333 DEV_MODE=true node scripts/build.js` and confirm exit code 0.
- [ ] Restart with `/Users/ryan.kim/develop/tools/git-docs/lk-docs-run.sh restart`, verify status, and request `http://localhost:3333/`.
