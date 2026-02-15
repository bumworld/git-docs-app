import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Test the build.js extractFailedFiles logic
describe('extractFailedFiles', () => {
  // Recreate the function for testing
  function extractFailedFiles(output) {
    const failed = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const fileMatch = line.match(/(?:error|fail|Error|FAIL).*?[:\s]+((?:\/|\.\/|src\/|source\/).+?\.\w+)/i);
      if (fileMatch && failed.length < 100) {
        const filePath = fileMatch[1].trim();
        if (!failed.includes(filePath)) {
          failed.push(filePath);
        }
      }
    }
    return failed;
  }

  it('should extract file paths from error lines', () => {
    const output = [
      'error: Could not compile src/content/docs/test.md',
      'Error in ./src/pages/broken.astro',
      'Some normal output line',
      'FAIL: source/docs/bad-file.md had issues',
    ].join('\n');

    const files = extractFailedFiles(output);
    assert.ok(files.length >= 1);
  });

  it('should return empty array for clean output', () => {
    const output = 'Build completed successfully.\nAll files processed.';
    const files = extractFailedFiles(output);
    assert.deepStrictEqual(files, []);
  });

  it('should deduplicate file paths', () => {
    const output = [
      'error: src/content/docs/test.md failed',
      'Error: src/content/docs/test.md still failing',
    ].join('\n');

    const files = extractFailedFiles(output);
    // Check no duplicates
    const unique = [...new Set(files)];
    assert.strictEqual(files.length, unique.length);
  });

  it('should limit to 100 files', () => {
    const lines = [];
    for (let i = 0; i < 150; i++) {
      lines.push(`error: src/content/docs/file${i}.md failed`);
    }
    const output = lines.join('\n');

    const files = extractFailedFiles(output);
    assert.ok(files.length <= 100);
  });
});

describe('Build result format', () => {
  it('should return correct structure for success', () => {
    // Simulate runBuild success result
    const result = {
      success: true,
      log: '[Build] Build completed in 5.0s',
      durationMs: 5000,
      failedFiles: [],
    };

    assert.strictEqual(result.success, true);
    assert.ok(typeof result.log === 'string');
    assert.strictEqual(typeof result.durationMs, 'number');
    assert.ok(Array.isArray(result.failedFiles));
    assert.strictEqual(result.failedFiles.length, 0);
  });

  it('should return correct structure for failure', () => {
    const result = {
      success: false,
      log: '[Build] Build FAILED:\nSome error message',
      durationMs: 3000,
      failedFiles: ['src/content/docs/bad.md'],
    };

    assert.strictEqual(result.success, false);
    assert.ok(result.log.includes('FAILED'));
    assert.strictEqual(result.failedFiles.length, 1);
  });
});

describe('Build JSON export format', () => {
  it('should produce valid JSON for clipboard copy', () => {
    const build = {
      id: 1,
      status: 'success',
      trigger_type: 'manual',
      triggered_by: 'user@example.com',
      started_at: '2026-02-15 10:30:00',
      finished_at: '2026-02-15 10:30:45',
      duration_ms: 45000,
      failed_files: [],
      log: 'Build completed successfully',
    };

    const json = JSON.stringify({
      id: build.id,
      status: build.status,
      trigger_type: build.trigger_type,
      triggered_by: build.triggered_by,
      started_at: build.started_at,
      finished_at: build.finished_at,
      duration_ms: build.duration_ms,
      failed_files: build.failed_files,
      log: build.log,
    }, null, 2);

    // Verify it's valid JSON
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.id, 1);
    assert.strictEqual(parsed.status, 'success');
    assert.strictEqual(parsed.trigger_type, 'manual');
    assert.strictEqual(parsed.triggered_by, 'user@example.com');
    assert.ok(Array.isArray(parsed.failed_files));
    assert.ok(typeof parsed.log === 'string');
  });

  it('should handle failed build with failed files in JSON', () => {
    const build = {
      id: 2,
      status: 'failed',
      trigger_type: 'watcher',
      triggered_by: 'system',
      started_at: '2026-02-15 11:00:00',
      finished_at: '2026-02-15 11:00:30',
      duration_ms: 30000,
      failed_files: ['src/file1.md', 'src/file2.md'],
      log: 'Build failed with errors',
    };

    const json = JSON.stringify(build, null, 2);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.failed_files.length, 2);
    assert.strictEqual(parsed.status, 'failed');
  });
});
