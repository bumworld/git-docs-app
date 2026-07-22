# Full Code Review Hardening Design

## Goal

Fix the verified correctness and security issues found during the repository-wide review without changing the application's core deployment model or normal authenticated wiki workflow.

## Scope

This change covers:

1. Protecting the generated Pagefind search index with the same active-user authentication as wiki pages.
2. Preventing source-provided HTML from retaining the wiki origin while scripts execute.
3. Rejecting pending and blocked administrators in admin API middleware.
4. Comparing session expiry values as SQLite datetimes instead of differently formatted strings.
5. Rewriting relative Markdown image destinations without corrupting valid Markdown destination syntax.
6. Making presentation tests depend on checked-in source fixtures rather than generated build output.
7. Retaining and validating the existing build error reporting changes on this branch.

The change does not introduce a separate content domain, replace the Markdown processor, or globally enable the currently documented CSP policy. Those are larger architectural changes with broader compatibility implications.

## Security Boundaries

### Search index

`/pagefind` contains searchable document data and is content, not a public application asset. Requests must pass `requireAuth` before `express.static` serves the index.

### HTML content

HTML copied from the source tree is treated as untrusted active content. The generated iframe keeps script support for interactive examples but drops `allow-same-origin`, giving the document an opaque origin. HTML responses under `/downloads` also receive a CSP sandbox so opening the file directly cannot restore the wiki origin and call authenticated APIs.

The sandbox policy will allow scripts but will not allow same-origin access. Features that require cookies, local storage, parent DOM access, popups, or same-origin API calls are intentionally unavailable in source-provided HTML.

### Administrative authorization

`requireAdmin` must enforce authentication, active account status, and the admin role. Pending and blocked accounts receive a 403 JSON response even if their persisted role is `admin`.

### Session expiry

Session expiry continues to be stored as an ISO-8601 string for compatibility. Queries wrap the stored value in SQLite's `datetime()` function for both reads and cleanup, ensuring `T`/`Z` formatting cannot affect ordering.

## Markdown Image Rewriting

Only inline image destinations that are relative filesystem paths are rewritten under `/downloads/<source-directory>/...`.

The rewriter preserves:

- absolute paths, fragments, and URI schemes;
- optional Markdown titles;
- angle-bracket destinations, including spaces;
- query strings and fragments attached to relative paths;
- balanced parentheses in ordinary destinations;
- surrounding Markdown syntax.

Parent-directory segments are normalized relative to the source Markdown file. A resolved path must remain inside the configured source root; paths escaping that root are left unchanged.

Reference-style image definitions are outside this targeted fix because changing shared link definitions could also change non-image links. They can be handled later with a Markdown AST if required.

## Error Handling

Authorization failures use the existing redirect behavior for browser content routes and JSON errors for API routes. HTML sandbox headers are added only for `.html` and `.htm` downloads. Malformed Markdown image syntax is left unchanged rather than guessed.

## Testing

Each production change receives a regression test that fails before the implementation change:

- unauthenticated Pagefind requests are rejected;
- blocked and pending admins cannot pass `requireAdmin`;
- an expired ISO-formatted session cannot be loaded and is eligible for cleanup;
- HTML downloads and generated iframe wrappers use the restricted sandbox;
- relative image destinations cover titles, spaces, parentheses, parent paths, and root-escape attempts;
- presentation fixtures are read from `sample/source`.

After targeted tests pass, run the complete unit/build suite, a local production build, and the Playwright suite when its browser/runtime dependencies are available.

## Compatibility and Rollback

The main compatibility change is intentional: source-provided HTML can no longer use the wiki origin. If an installation requires trusted same-origin HTML applications, it should use a separately reviewed opt-in mode or a separate origin rather than weakening the default sandbox.

All changes are isolated to middleware, response headers, session SQL predicates, the Markdown preprocessor, and tests. They can be reverted independently if a deployment-specific regression is found.
