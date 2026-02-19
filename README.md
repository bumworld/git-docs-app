# Git Docs App

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Self-hosted wiki solution powered by **Astro Starlight** with Google OAuth authentication.

Drop markdown files into a folder, and instantly get a beautiful, searchable wiki with access control.

## Features

- **Markdown → Wiki**: Automatically converts markdown files to a static wiki site
- **Google OAuth**: Login restricted to approved Google accounts only
- **Admin Panel**: Manage users, approve access requests, configure site settings
- **Auto Build**: File changes in `sample/source/` trigger automatic rebuilds
- **Auto Sidebar**: Navigation sidebar generated from directory structure
- **Mermaid Diagrams**: Mermaid code blocks rendered as diagrams
- **Presentation Mode**: Convert markdown to reveal.js presentations
- **View Source**: View and copy page markdown/HTML source
- **Copy Content**: Copy rendered page content as rich text
- **Print PDF**: Print pages to PDF with optimized layouts
- **Video Player**: Embed videos with source link display and copy
- **Docker Ready**: Single image, multiple instances via port mapping
- **Multi-language filenames**: Korean, Japanese, Chinese, and other non-ASCII filenames supported

## Documentation

- 📖 **[Usage Guide (English)](USAGE.md)** - Comprehensive feature guide
- 📖 **[사용 가이드 (한국어)](USAGE.ko.md)** - 한국어 상세 가이드

## 🚀 Quick Deploy (Demo)

Want to deploy a **public demo** without authentication?

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/bumworld/git-docs-app)

**Features:**
- ✅ No authentication required (auto-login as admin)
- ✅ Uses sample markdown content
- ✅ **All features work** (rebuild, admin panel, SSE, etc.)
- ✅ Free hosting on Render.com
- ✅ Auto-deploy on git push
- ✅ Persistent SQLite database

👉 **[Render Deployment Guide](RENDER_DEPLOY.md)** - Step-by-step instructions

<details>
<summary>Alternative: Vercel (static only)</summary>

For static deployment without dynamic features:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/bumworld/git-docs-app&env=DEV_MODE,USE_SAMPLE_DIR&envDescription=Demo%20mode%20configuration&envLink=https://github.com/bumworld/git-docs-app/blob/main/VERCEL_DEPLOY.md)

📖 **[Vercel Deployment Guide](VERCEL_DEPLOY.md)** (requires serverless setup)

</details>

## Quick Start (Docker)

### 1. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application)
3. Add **Authorized redirect URIs**:
   - `http://localhost:3000/oauth2/callback` (local development)
   - `https://your-domain.com/oauth2/callback` (production)
4. Download the JSON credentials file

### 2. Configure

```bash
# Clone the repository
git clone https://github.com/bumworld/git-docs-app.git
cd git-docs-app

# Place your Google OAuth credentials (either way works):

# Option A: Download from Google Console and rename
mv ~/Downloads/client_secret_*.json sample/conf/google_auth.json

# Option B: Copy the example and fill in your credentials
cp sample/conf/google_auth.example.json sample/conf/google_auth.json
# Edit sample/conf/google_auth.json with your client_id, client_secret, redirect_uris
```

### 3. Run with Docker Compose

```bash
# Set your admin email and start
ADMIN_EMAIL=your-email@gmail.com docker compose up -d
```

Open `http://localhost:8080` in your browser.

### 4. Add Content

Place your markdown files in the `sample/source/` directory:

```
sample/source/
├── getting-started.md
├── guides/
│   ├── installation.md
│   └── configuration.md
├── api/
│   └── reference.md
├── images/
│   └── architecture.png    # Embedded in wiki pages
└── downloads/
    └── report.pdf           # Available as download
```

The wiki rebuilds automatically when files change. Sidebar navigation is generated from the directory structure.

## Folder Structure

| Folder | Description | Docker Volume |
|--------|-------------|---------------|
| `sample/source/` | Your markdown, HTML, and resource files | Yes |
| `sample/conf/` | `google_auth.json` (OAuth credentials) | Yes |
| `sample/data/` | `wiki.db` (SQLite - auto-created) | Yes |
| `sample/dist/` | Built static HTML (served to users) | No |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_EMAIL` | *(empty)* | Initial admin Google email |
| `PORT` | `8080` | Host-side port mapping (docker compose) |
| `SESSION_SECRET` | `change-me-in-production` | Session encryption key |
| `DEV_MODE` | `false` | Set `true` to bypass authentication (for local dev) |

## Content Types

| File Type | Behavior |
|-----------|----------|
| `.md`, `.mdx` | Converted to HTML wiki pages |
| `.html` folder (with `index.html`) | Embedded as iframe |
| Single `.html` | Embedded as iframe |
| `.png`, `.jpg`, `.svg`, etc. | Copied to static assets, usable in markdown |
| Other files (PDF, CSV, ZIP, etc.) | Available as download links at `/downloads/` |

## Mermaid Diagrams

Use fenced code blocks with `mermaid` language:

````markdown
```mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[OK]
    B -->|No| D[Cancel]
```
````

## Advanced Features

### Presentation Mode

Convert markdown pages to reveal.js presentations. Add frontmatter to your markdown:

```yaml
---
title: My Presentation
presentation: true
theme: night
---
```

Separate slides with `---` and click "🎬 Presentation Mode" button to view.

### View Source & Copy Content

- **View Source**: Click button in sidebar to view/copy markdown or HTML source
- **Copy Content**: Copy rendered page content as rich text (preserves formatting for Word, email, etc.)

### Print to PDF

Click "Print PDF" button in sidebar to generate PDF with optimized layout.

### Video Embedding

Embed videos with automatic source link display:

```html
<div class="video-wrapper">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID"></iframe>
</div>
```

See detailed usage guide: [USAGE.md](USAGE.md) | [USAGE.ko.md](USAGE.ko.md)

## Docker Build & Push

소스에서 직접 빌드하고 Docker Hub에 배포하는 방법:

```bash
# 멀티 플랫폼 빌드 & 푸시 (amd64 + arm64)
docker buildx build --platform linux/amd64,linux/arm64 \
  -t bumworld/git-docs-app:latest \
  -t bumworld/git-docs-app:1.0.0 \
  --push .

# 로컬 빌드만 (현재 플랫폼)
docker compose build
```

배포 서버에서는 소스 없이 이미지만 pull해서 사용:

```yaml
# docker-compose.yml (서버용)
services:
  wiki:
    image: bumworld/git-docs-app:latest
    ports:
      - "8080:3000"
    volumes:
      - ./sample/source:/app/source
      - ./sample/conf:/app/conf
      - ./sample/data:/app/data
    environment:
      - ADMIN_EMAIL=your-email@gmail.com
      - SESSION_SECRET=your-random-secret-key
    restart: unless-stopped
```

## Multiple Instances

Run separate wikis on different ports:

```bash
# Wiki A on port 8080
docker run -p 8080:3000 \
  -v ./repo-a/sample/source:/app/source \
  -v ./repo-a/sample/conf:/app/conf \
  -v ./repo-a/sample/data:/app/data \
  -e ADMIN_EMAIL=admin-a@gmail.com \
  bumworld/git-docs-app

# Wiki B on port 8081
docker run -p 8081:3000 \
  -v ./repo-b/sample/source:/app/source \
  -v ./repo-b/sample/conf:/app/conf \
  -v ./repo-b/sample/data:/app/data \
  -e ADMIN_EMAIL=admin-b@gmail.com \
  bumworld/git-docs-app
```

## Admin Panel

Access the admin panel at `/admin` (admin users only):

- **Dashboard**: View user statistics and pending access requests
- **Users**: Manage users, approve/block accounts, assign admin roles
- **Settings**: Configure site title, description, contact email, footer text

## Access Control Flow

1. User clicks "Sign in with Google"
2. If email is registered and **active** → access granted
3. If email is **not registered** → auto-added as **pending**, shown waiting page
4. If email is **blocked** → access denied
5. Admin approves/blocks pending users via admin panel

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/auth/google` | Public | Start Google login |
| `GET` | `/auth/me` | Public | Current user info |
| `GET` | `/auth/logout` | Public | Logout |
| `POST` | `/api/rebuild` | User | Trigger wiki rebuild |
| `GET` | `/api/admin/users` | Admin | List all users |
| `PUT` | `/api/admin/users/:id/status` | Admin | Update user status |
| `PUT` | `/api/admin/users/:id/role` | Admin | Update user role |
| `GET/PUT` | `/api/admin/settings` | Admin | Site settings |

## Development

```bash
# Install dependencies
npm install

# Start with authentication bypassed
DEV_MODE=true npm run dev

# Start with Google OAuth
ADMIN_EMAIL=you@gmail.com npm run dev

# Manual build only
npm run build
```

## Tech Stack

- **Astro Starlight** - Static site generator
- **Express.js** - HTTP server with auth middleware
- **Passport.js** - Google OAuth 2.0
- **better-sqlite3** - Embedded database
- **chokidar** - File system watcher
- **Mermaid** - Diagram rendering

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the [MIT License](LICENSE).
