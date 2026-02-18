/**
 * tests/e2e/global-teardown.js
 * Playwright globalTeardown: E2E 테스트 후 실행
 * - 백업에서 source/, data/ 복원
 */
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const REAL_SOURCE = path.join(PROJECT_ROOT, 'source');
const REAL_DATA = path.join(PROJECT_ROOT, 'data');
const BACKUP_DIR = path.join(PROJECT_ROOT, '.e2e-backup');

export default async function globalTeardown() {
  console.log('\n[E2E Teardown] Restoring original files...');

  const sourceBackup = path.join(BACKUP_DIR, 'source');
  const dataBackup = path.join(BACKUP_DIR, 'data');

  // source/ 복원
  if (fs.existsSync(sourceBackup)) {
    if (fs.existsSync(REAL_SOURCE)) fs.emptyDirSync(REAL_SOURCE);
    else fs.ensureDirSync(REAL_SOURCE);
    fs.copySync(sourceBackup, REAL_SOURCE, { overwrite: true });
    console.log('[E2E Teardown] source/ restored');
  }

  // data/ 복원
  if (fs.existsSync(dataBackup)) {
    if (fs.existsSync(REAL_DATA)) fs.emptyDirSync(REAL_DATA);
    else fs.ensureDirSync(REAL_DATA);
    fs.copySync(dataBackup, REAL_DATA, { overwrite: true });
    console.log('[E2E Teardown] data/ restored');
  }

  // 백업 디렉토리 정리
  if (fs.existsSync(BACKUP_DIR)) {
    fs.removeSync(BACKUP_DIR);
  }

  console.log('[E2E Teardown] Done!\n');
}
