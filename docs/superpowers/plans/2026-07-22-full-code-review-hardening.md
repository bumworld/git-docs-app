# Full Code Review Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the verified authorization, content-isolation, session-expiry, Markdown image, and test-fixture defects while retaining the existing build diagnostics work.

**Architecture:** Keep the current Express/Astro structure and strengthen existing boundaries in place. Each defect gets a focused regression test before the smallest production change, followed by targeted and repository-wide verification.

**Tech Stack:** Node.js ESM, Express 4, express-session, better-sqlite3, Astro 5, Node test runner, Playwright

## Global Constraints

- Do not add a separate content domain or replace the Markdown processor.
- Do not globally enable the documented CSP policy in this change.
- Source-provided HTML may execute scripts but must not retain the wiki origin.
- Reference-style Markdown image definitions remain outside scope.
- Preserve the existing staged build error reporting behavior and tests.

---

### Task 1: Active-user authorization for search and admin APIs

**Files:**
- Modify: `server/index.js:155-169`
- Modify: `server/middleware/requireAuth.js:60-75`
- Test: `tests/security.test.js`

**Interfaces:**
- Consumes: existing `requireAuth(req, res, next)` and `requireAdmin(req, res, next)` Express middleware.
- Produces: `/pagefind` protected by `requireAuth`; `requireAdmin` rejects `pending` and `blocked` users with JSON 403 responses.

- [ ] **Step 1: Write failing middleware and route-structure tests**

Add direct `requireAdmin` tests using request objects with authenticated admin users in each account state. Add a source-structure assertion that the `/pagefind` static mount includes `requireAuth` before `express.static`.

```js
const result = invokeMiddleware(requireAdmin, { role: 'admin', status: 'blocked' });
assert.equal(result.statusCode, 403);
assert.deepEqual(result.body, { error: 'Account blocked' });
assert.match(serverSource, /app\.use\('\/pagefind',\s*requireAuth,\s*express\.static/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/security.test.js`

Expected: FAIL because blocked/pending admins currently reach `next()` and `/pagefind` has no middleware.

- [ ] **Step 3: Implement active-status checks and protected search mount**

Use the same status messages as `requireAuthAPI`, before checking the role:

```js
if (req.user.status === 'pending') {
  return res.status(403).json({ error: 'Account pending approval' });
}
if (req.user.status === 'blocked') {
  return res.status(403).json({ error: 'Account blocked' });
}
```

Mount search as:

```js
app.use('/pagefind', requireAuth, express.static(path.join(PATHS.DIST, 'pagefind')));
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/security.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/index.js server/middleware/requireAuth.js tests/security.test.js
git commit -m "fix: protect search and admin authorization"
```

### Task 2: Correct ISO session expiry comparisons

**Files:**
- Modify: `server/session-store.js:8-58`
- Test: `tests/session-store.test.js`

**Interfaces:**
- Consumes: session rows whose `expired` value is an ISO-8601 string.
- Produces: exported `deleteExpiredSessions()` helper returning the SQLite run result; store reads and cleanup compare `datetime(expired)` with `datetime('now')`.

- [ ] **Step 1: Write failing expiry regression tests**

Create a session with an expiry earlier on the current UTC date in ISO form, confirm `store.get` returns `null`, call `deleteExpiredSessions()`, and confirm the row is deleted. Use a unique SID and remove it in test cleanup.

```js
db.prepare('INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)')
  .run(sid, JSON.stringify({ cookie: {} }), expiredEarlierToday);
assert.equal(await getSession(store, sid), null);
deleteExpiredSessions();
assert.equal(db.prepare('SELECT sid FROM sessions WHERE sid = ?').get(sid), undefined);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/session-store.test.js`

Expected: FAIL because the ISO string compares lexically against SQLite's space-separated datetime.

- [ ] **Step 3: Normalize SQL comparisons**

Change the read predicate to:

```sql
datetime(expired) > datetime('now')
```

Extract and export cleanup:

```js
export function deleteExpiredSessions() {
  return db.prepare("DELETE FROM sessions WHERE datetime(expired) <= datetime('now')").run();
}
```

The interval calls this helper and retains the existing error isolation.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/session-store.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/session-store.js tests/session-store.test.js
git commit -m "fix: compare session expiry as datetimes"
```

### Task 3: Isolate source-provided HTML

**Files:**
- Modify: `config/security.js:60-71`
- Modify: `server/index.js:207-208`
- Test: `tests/security.test.js`
- Test: `tests/unit/processors.test.js`

**Interfaces:**
- Consumes: `IFRAME_SANDBOX` in generated wrappers and HTML files served from `PATHS.DOWNLOADS`.
- Produces: iframe sandbox value `allow-scripts`; HTML download CSP header `sandbox allow-scripts`.

- [ ] **Step 1: Write failing sandbox tests**

Assert generated HTML wrappers contain `sandbox="allow-scripts"` and never `allow-same-origin`. Test an exported `setDownloadSecurityHeaders(res, filePath)` helper with HTML and non-HTML paths.

```js
setDownloadSecurityHeaders(res, '/tmp/example.html');
assert.equal(headers['Content-Security-Policy'], 'sandbox allow-scripts');
setDownloadSecurityHeaders(otherRes, '/tmp/report.pdf');
assert.equal(otherHeaders['Content-Security-Policy'], undefined);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/security.test.js tests/unit/processors.test.js`

Expected: FAIL because `allow-same-origin` is present and no download response helper exists.

- [ ] **Step 3: Restrict iframe and response origins**

Set:

```js
export const IFRAME_SANDBOX = 'allow-scripts';
```

Export the header helper from `server/index.js` and pass it to `express.static`:

```js
export function setDownloadSecurityHeaders(res, filePath) {
  if (/\.html?$/i.test(filePath)) {
    res.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
  }
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/security.test.js tests/unit/processors.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add config/security.js server/index.js tests/security.test.js tests/unit/processors.test.js
git commit -m "fix: isolate source html content"
```

### Task 4: Robust relative Markdown image rewriting

**Files:**
- Modify: `scripts/prebuild/processors.js:142-149`
- Modify: `tests/prebuild.test.js:140-164`
- Test: `tests/unit/processors.test.js`

**Interfaces:**
- Consumes: Markdown content plus the absolute source Markdown filename.
- Produces: exported `rewriteLocalImagePaths(content, srcFile)` returning rewritten Markdown while leaving malformed, external, absolute, fragment, and root-escaping destinations unchanged.

- [ ] **Step 1: Add failing destination cases**

Extend tests with titled images, angle-bracket paths containing spaces, balanced parentheses, `../` normalization, query/fragment suffixes, and a path that escapes `PATHS.SOURCE`.

```js
assert.match(output, /!\[space\]\(<\/downloads\/guides\/my image\.png> "Title"\)/);
assert.match(output, /!\[parent\]\(\/downloads\/images\/parent\.png\)/);
assert.match(output, /!\[escape\]\(\.\.\/\.\.\/outside\.png\)/);
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/prebuild.test.js tests/unit/processors.test.js`

Expected: FAIL on spaces, balanced parentheses, or root-escape behavior.

- [ ] **Step 3: Implement a small inline-image scanner**

Replace the single regular expression with a scanner that:

1. finds `![... ](` openers;
2. parses angle-bracket destinations to `>` or ordinary destinations with escaped characters and balanced parentheses;
3. preserves whitespace and optional title text;
4. rejects URI schemes, `/`, `#`, malformed input, and paths resolving outside `PATHS.SOURCE`;
5. rewrites only the path portion while retaining query and fragment suffixes.

Do not change reference definitions or normal links.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/prebuild.test.js tests/unit/processors.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/prebuild/processors.js tests/prebuild.test.js tests/unit/processors.test.js
git commit -m "fix: rewrite markdown image paths safely"
```

### Task 5: Stable fixtures and complete verification

**Files:**
- Modify: `tests/presentation.test.js:104-113,243-252`
- Verify existing: `scripts/build.js`
- Verify existing: `tests/unit/build-pipeline.test.js`

**Interfaces:**
- Consumes: checked-in `sample/source/example-presentation.md` and existing `reportCommandFailure(err)`.
- Produces: tests independent of generated `src/content/docs`; retained child-process stdout/stderr diagnostics.

- [ ] **Step 1: Change presentation tests to checked-in source fixture**

Use:

```js
const examplePath = path.join(process.cwd(), 'sample/source/example-presentation.md');
```

This is a test correction, so its verified RED state is the existing two-test failure observed before prebuild restored generated output.

- [ ] **Step 2: Run the presentation and build diagnostic tests**

Run: `node --test tests/presentation.test.js tests/unit/build-pipeline.test.js`

Expected: PASS.

- [ ] **Step 3: Run formatting and diff checks**

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 4: Run the complete unit/build suite**

Run: `npm test`

Expected: 0 failures.

- [ ] **Step 5: Run a local production build**

Run: `npm run build:local`

Expected: Astro build succeeds and generated output is synchronized to `sample/dist`.

- [ ] **Step 6: Run end-to-end tests**

Run: `npm run test:e2e`

Expected: all Playwright tests pass. If browser binaries are unavailable, report the exact dependency error without claiming E2E success.

- [ ] **Step 7: Commit remaining fixture and build diagnostic work**

```bash
git add scripts/build.js tests/unit/build-pipeline.test.js tests/presentation.test.js
git commit -m "test: stabilize build and presentation diagnostics"
```

- [ ] **Step 8: Review final branch state**

Run: `git status --short --branch && git log --oneline --decorate -8`

Expected: only intentionally untracked pre-existing documents remain; implementation changes are committed on `review/full-code-fixes-20260722`.
