# Markdown Image Build Fix Design

## Problem

Prebuild copies source images into `public/downloads`, while copied Markdown keeps relative image references such as `images/example.png`. Astro resolves those references beneath `src/content/docs`, where the original image no longer exists, and aborts the static build with `ImageNotFound`. The build runner captures Astro output but only prints the generic exit-code message to `app.log`.

## Design

During Markdown processing, rewrite local relative image destinations to their corresponding absolute `/downloads/` URL. Preserve remote URLs, absolute URLs, anchors, and data URLs. Apply the rewrite before frontmatter is serialized so both existing and newly generated frontmatter paths behave consistently.

When an external build command fails, print its captured stderr and stdout to the process error stream in addition to returning them in the persisted build record. This makes the actionable Astro error visible in `app.log`.

## Verification

Add regression tests proving a nested Markdown file rewrites a relative image destination and leaves external/absolute destinations unchanged. Add a build-pipeline test proving captured stderr is emitted when Astro exits unsuccessfully. Run focused tests, the complete unit/build test suite, and the real `lk-docs` build environment.
