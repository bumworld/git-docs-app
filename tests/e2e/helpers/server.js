/**
 * tests/e2e/helpers/server.js
 * E2E 테스트용 서버 시작/종료 헬퍼
 *
 * Playwright globalSetup/globalTeardown에서 사용:
 * - 테스트 DB 초기화
 * - E2E 픽스처 소스 파일을 임시 source/ 위치에 복사
 * - prebuild 실행 (source → src/content/docs/)
 * - 실제 Astro build (dist/ 생성)
 * - NODE_ENV=test로 서버 기동 (port 3001)
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { initTestDatabase } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const E2E_TMP = path.join(PROJECT_ROOT, '.e2e-tmp');

const E2E_SOURCE = path.join(E2E_TMP, 'source');
const E2E_DATA = path.join(E2E_TMP, 'data');
const E2E_DIST = path.join(E2E_TMP, 'dist');

const FIXTURES_SOURCE = path.join(__dirname, '../fixtures/source');
const REAL_SOURCE = path.join(PROJECT_ROOT, 'source');
const REAL_DATA = path.join(PROJECT_ROOT, 'data');
const REAL_DIST = path.join(PROJECT_ROOT, 'dist');

let serverProcess = null;

/**
 * E2E 서버를 시작한다.
 * @returns {Promise<void>}
 */
export async function startServer() {
  // 1. 임시 디렉토리 생성
  fs.ensureDirSync(E2E_SOURCE);
  fs.ensureDirSync(E2E_DATA);
  fs.ensureDirSync(E2E_DIST);

  // 2. 실제 source/, data/ 백업
  const sourceBackupExists = fs.existsSync(REAL_SOURCE);
  const dataBackupExists = fs.existsSync(REAL_DATA);
  const distBackupExists = fs.existsSync(REAL_DIST);

  if (sourceBackupExists) {
    fs.moveSync(REAL_SOURCE, path.join(E2E_TMP, 'source-backup'), { overwrite: true });
  }
  if (dataBackupExists) {
    fs.moveSync(REAL_DATA, path.join(E2E_TMP, 'data-backup'), { overwrite: true });
  }
  if (distBackupExists) {
    fs.moveSync(REAL_DIST, path.join(E2E_TMP, 'dist-backup'), { overwrite: true });
  }

  // 3. E2E 픽스처 소스 파일 복사
  fs.ensureDirSync(REAL_SOURCE);
  if (fs.existsSync(FIXTURES_SOURCE)) {
    fs.copySync(FIXTURES_SOURCE, REAL_SOURCE, { overwrite: true });
  }

  // 4. 테스트 DB 생성
  fs.ensureDirSync(REAL_DATA);
  const testDbPath = path.join(REAL_DATA, 'wiki.db');
  initTestDatabase(testDbPath);

  // 5. prebuild 실행
  await runCommand('node', ['scripts/prebuild.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, NODE_ENV: 'test' },
  });

  // 6. Astro build 실행
  await runCommand('node', ['scripts/build.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      SITE_TITLE: 'E2E Test Wiki',
      SITE_URL: 'http://localhost:3001',
    },
  });

  // 7. 서버 시작
  serverProcess = spawn('node', ['server/index.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: '3001',
      NODE_ENV: 'test',
      SESSION_SECRET: 'e2e-test-secret-12345',
      ADMIN_EMAIL: 'admin@test.com',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (d) => process.stdout.write(`[E2E Server] ${d}`));
  serverProcess.stderr?.on('data', (d) => process.stderr.write(`[E2E Server ERR] ${d}`));

  // 8. 서버 ready 대기
  await waitForServer('http://localhost:3001/login', 30000);
  console.log('[E2E] Server ready at http://localhost:3001');
}

/**
 * E2E 서버를 종료하고 원래 파일들을 복원한다.
 */
export async function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }

  // 백업에서 복원
  const sourceBackup = path.join(E2E_TMP, 'source-backup');
  const dataBackup = path.join(E2E_TMP, 'data-backup');
  const distBackup = path.join(E2E_TMP, 'dist-backup');

  if (fs.existsSync(REAL_SOURCE)) fs.removeSync(REAL_SOURCE);
  if (fs.existsSync(sourceBackup)) fs.moveSync(sourceBackup, REAL_SOURCE, { overwrite: true });

  if (fs.existsSync(REAL_DATA)) fs.removeSync(REAL_DATA);
  if (fs.existsSync(dataBackup)) fs.moveSync(dataBackup, REAL_DATA, { overwrite: true });

  if (fs.existsSync(REAL_DIST)) fs.removeSync(REAL_DIST);
  if (fs.existsSync(distBackup)) fs.moveSync(distBackup, REAL_DIST, { overwrite: true });

  // E2E 임시 디렉토리 정리
  fs.removeSync(E2E_TMP);

  console.log('[E2E] Server stopped and files restored');
}

/**
 * 주어진 URL이 응답할 때까지 대기한다.
 */
async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // 아직 시작 안 됨
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not start within ${timeoutMs}ms`);
}

/**
 * 명령어를 실행하고 완료를 기다린다.
 */
function runCommand(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { ...options, stdio: 'pipe' });
    let out = '';
    let err = '';
    proc.stdout?.on('data', d => { out += d.toString(); });
    proc.stderr?.on('data', d => { err += d.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} ${args.join(' ')} failed (code ${code})\n${err}`));
    });
    proc.on('error', reject);
  });
}
