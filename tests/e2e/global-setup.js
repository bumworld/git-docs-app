/**
 * tests/e2e/global-setup.js
 * Playwright globalSetup: E2E 테스트 전 실행
 * - 테스트 픽스처 소스 파일 source/에 배포
 * - 테스트 DB 초기화
 * - prebuild + Astro build 실행
 */
import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { initTestDatabase } from './helpers/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const FIXTURES_SOURCE = path.join(__dirname, 'fixtures/source');
const REAL_SOURCE = path.join(PROJECT_ROOT, 'source');
const REAL_DATA = path.join(PROJECT_ROOT, 'data');
const BACKUP_DIR = path.join(PROJECT_ROOT, '.e2e-backup');

async function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...options, stdio: 'pipe' });
    let out = '';
    let err = '';
    proc.stdout?.on('data', d => { out += d.toString(); });
    proc.stderr?.on('data', d => { err += d.toString(); });
    proc.on('close', code => {
      if (code === 0) {
        resolve(out);
      } else {
        reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}\n${err}\n${out}`));
      }
    });
    proc.on('error', reject);
  });
}

export default async function globalSetup() {
  console.log('\n[E2E Setup] Starting E2E test environment...');

  // 1. 기존 source/, data/ 백업
  fs.ensureDirSync(BACKUP_DIR);
  if (fs.existsSync(REAL_SOURCE)) {
    console.log('[E2E Setup] Backing up source/...');
    fs.copySync(REAL_SOURCE, path.join(BACKUP_DIR, 'source'), { overwrite: true });
  }
  if (fs.existsSync(REAL_DATA)) {
    console.log('[E2E Setup] Backing up data/...');
    fs.copySync(REAL_DATA, path.join(BACKUP_DIR, 'data'), { overwrite: true });
  }

  // 2. 테스트 픽스처 소스 파일 배포
  console.log('[E2E Setup] Deploying E2E fixture source files...');
  fs.emptyDirSync(REAL_SOURCE);
  if (fs.existsSync(FIXTURES_SOURCE)) {
    fs.copySync(FIXTURES_SOURCE, REAL_SOURCE, { overwrite: true });
  }

  // 3. 테스트 DB 초기화 (WAL 파일 포함 완전 제거)
  console.log('[E2E Setup] Initializing test database...');
  fs.ensureDirSync(REAL_DATA);
  const testDbPath = path.join(REAL_DATA, 'wiki.db');
  // SQLite WAL 파일도 함께 제거 (이전 세션 잔여물)
  [testDbPath, `${testDbPath}-shm`, `${testDbPath}-wal`].forEach(f => {
    if (fs.existsSync(f)) fs.removeSync(f);
  });
  initTestDatabase(testDbPath);

  // 4. prebuild 실행 (source/ → src/content/docs/)
  console.log('[E2E Setup] Running prebuild...');
  await runCommand('node', ['scripts/prebuild.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, NODE_ENV: 'test' },
  });

  // 5. Astro build (dist/ 생성)
  console.log('[E2E Setup] Running Astro build (this may take a moment)...');
  await runCommand('npx', ['astro', 'build'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SITE_TITLE: 'E2E Test Wiki',
      SITE_URL: 'http://localhost:3001',
    },
  });

  console.log('[E2E Setup] Setup complete!\n');
}
