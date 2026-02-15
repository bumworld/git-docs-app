import path from 'path';

const ROOT = process.cwd();

export const PATHS = {
  ROOT,
  SOURCE: path.resolve(ROOT, 'source'),
  DOCS: path.resolve(ROOT, 'src', 'content', 'docs'),
  DOWNLOADS: path.resolve(ROOT, 'public', 'downloads'),
  DIST: path.resolve(ROOT, 'dist'),
  DIST_TEMP: path.resolve(ROOT, 'dist-temp'),
  DIST_OLD: path.resolve(ROOT, 'dist-old'),
  DATA: path.resolve(ROOT, 'data'),
  DB: path.resolve(ROOT, 'data', 'wiki.db'),
  ADMIN_UI: path.resolve(ROOT, 'admin-ui'),
  CONF: path.resolve(ROOT, 'conf'),
  GOOGLE_AUTH: path.resolve(ROOT, 'conf', 'google_auth.json'),
  SIDEBAR_JSON: path.resolve(ROOT, 'src', 'sidebar.json'),
};

export const FILE_EXTENSIONS = {
  MARKDOWN: ['.md', '.mdx', '.mdoc'],
  HTML: ['.html', '.htm'],
  IMAGE: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'],
};

export const IGNORE_FILES = ['.DS_Store', 'Thumbs.db', '.gitkeep'];

export const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'cdk.out', '.next', '.nuxt', '__pycache__', '.venv', 'venv', '.cache', 'build'];

export const USER_STATUS = {
  ACTIVE: 'active',
  PENDING: 'pending',
  BLOCKED: 'blocked',
  ALL: ['active', 'pending', 'blocked'],
};

export const USER_ROLE = {
  ADMIN: 'admin',
  USER: 'user',
  ALL: ['admin', 'user'],
};

export const SESSION = {
  MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days
  CLEANUP_INTERVAL: 15 * 60 * 1000,  // 15 minutes
};

export const BUILD = {
  DEBOUNCE_MS: 2000,
};
