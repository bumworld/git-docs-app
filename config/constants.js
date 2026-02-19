import path from 'path';

const ROOT = process.cwd();

// Priority 1: Custom paths from environment variables (absolute paths)
const CUSTOM_SOURCE = process.env.SOURCE_DIR;
const CUSTOM_CONF = process.env.CONF_DIR;
const CUSTOM_DATA = process.env.DATA_DIR;
const CUSTOM_DIST = process.env.DIST_DIR;

// Priority 2: Use sample directory for local development
const USE_SAMPLE = process.env.USE_SAMPLE_DIR === 'true';

// Helper to resolve path with priority: CUSTOM > SAMPLE > DEFAULT
const resolvePath = (custom, samplePath, defaultPath) => {
  if (custom) return path.resolve(custom);
  return path.resolve(ROOT, USE_SAMPLE ? samplePath : defaultPath);
};

export const PATHS = {
  ROOT,
  SOURCE: resolvePath(CUSTOM_SOURCE, 'sample/source', 'source'),
  DOCS: path.resolve(ROOT, 'src', 'content', 'docs'),
  DOWNLOADS: path.resolve(ROOT, 'public', 'downloads'),
  DIST: resolvePath(CUSTOM_DIST, 'sample/dist', 'dist'),
  DIST_TEMP: resolvePath(CUSTOM_DIST ? `${CUSTOM_DIST}-temp` : null, 'sample/dist-temp', 'dist-temp'),
  DIST_OLD: resolvePath(CUSTOM_DIST ? `${CUSTOM_DIST}-old` : null, 'sample/dist-old', 'dist-old'),
  DATA: resolvePath(CUSTOM_DATA, 'sample/data', 'data'),
  DB: path.resolve(resolvePath(CUSTOM_DATA, 'sample/data', 'data'), 'wiki.db'),
  ADMIN_UI: path.resolve(ROOT, 'admin-ui'),
  CONF: resolvePath(CUSTOM_CONF, 'sample/conf', 'conf'),
  GOOGLE_AUTH: path.resolve(resolvePath(CUSTOM_CONF, 'sample/conf', 'conf'), 'google_auth.json'),
  SIDEBAR_JSON: path.resolve(ROOT, 'src', 'sidebar.json'),
};

export const FILE_EXTENSIONS = {
  MARKDOWN: ['.md', '.mdx', '.mdoc'],
  HTML: ['.html', '.htm'],
  IMAGE: ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'],
  TEXT: ['.txt', '.ini', '.conf', '.config', '.properties', '.json', '.sql', '.xml', '.yaml', '.yml', '.toml', '.csv', '.log', '.sh', '.bash', '.zsh', '.env', '.gitignore'],
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
