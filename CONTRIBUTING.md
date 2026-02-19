# Contributing to Git Docs App

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- npm

### Local Development

There are two ways to develop locally:

#### Option 1: Local Development with Sample Data (Recommended)

Use this for testing with the sample content structure:

```bash
# Clone the repository
git clone https://github.com/bumworld/git-docs-app.git
cd git-docs-app

# Install dependencies
npm install

# Build locally (uses sample/ directory)
npm run build:local

# Start server locally (uses sample/ directory)
DEV_MODE=true npm run dev:local
```

- Source files: `sample/source/`
- Config: `sample/conf/`
- Database: `sample/data/`
- Build output: `sample/dist/`

#### Option 2: Custom Directory Development

Use this to test with any external documentation directory:

```bash
# Point to any directory with markdown files
SOURCE_DIR=/path/to/your/docs DEV_MODE=true npm run dev:custom

# Customize all paths
SOURCE_DIR=/path/to/docs \
CONF_DIR=/path/to/conf \
DATA_DIR=/path/to/data \
DIST_DIR=/path/to/dist \
npm run dev:custom
```

- Works with any directory containing markdown files
- Perfect for testing with real documentation
- No need to copy files

#### Option 3: Docker Compose Development

Use this for production-like environment:

```bash
# Start with Docker Compose
ADMIN_EMAIL=you@gmail.com docker compose up -d

# Watch logs
docker logs -f git-docs-wiki
```

- Uses same `sample/` directory
- Volumes mounted to `/app/source`, `/app/conf`, `/app/data` inside container

The server starts at `http://localhost:8080` (Docker) or `http://localhost:3000` (local).

### With Google OAuth

1. Set up Google OAuth credentials (see [README](README.md#1-set-up-google-oauth))
2. Place credentials in `sample/conf/google_auth.json` (local) or `conf/google_auth.json` (Docker)
3. Start the server:

```bash
# Local development
ADMIN_EMAIL=you@gmail.com npm run dev:local

# Docker
ADMIN_EMAIL=you@gmail.com docker compose up -d
```

## How to Contribute

### Reporting Bugs

- Use the [Bug Report](https://github.com/bumworld/git-docs-app/issues/new?template=bug_report.md) issue template
- Include steps to reproduce, expected vs actual behavior
- Include Node.js version and OS info

### Suggesting Features

- Use the [Feature Request](https://github.com/bumworld/git-docs-app/issues/new?template=feature_request.md) issue template
- Describe the use case and why it would be useful

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch from `develop`:
   ```bash
   git checkout -b feature/your-feature develop
   ```
3. Make your changes
4. Test locally with `DEV_MODE=true npm run dev`
5. Commit with a clear message:
   ```bash
   git commit -m "feat: add new feature description"
   ```
6. Push and open a Pull Request against `develop`

### Commit Message Convention

We follow a simple convention:

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code refactoring
- `chore:` maintenance tasks

## Project Structure

```
server/          # Express server, auth, API routes
scripts/         # Build scripts, file watcher
src/             # Astro Starlight source templates
admin-ui/        # Admin panel HTML/JS
config/          # App constants (PATH resolution logic)
public/          # Static assets
sample/          # Sample data directory (local development)
  ├── source/    # Wiki content (markdown files)
  ├── conf/      # Runtime config (OAuth credentials)
  ├── data/      # Database files (wiki.db)
  └── dist/      # Build output (auto-generated)
```

### Directory Structure Notes

The project uses a **multi-path system** with 3 modes:

1. **Default mode** (Container production)
   - Uses root-level paths: `source/`, `conf/`, `data/`, `dist/`
   - Run with: `npm run build` or `npm run dev`

2. **Sample mode** (Local development)
   - Uses `sample/` directory: `sample/source/`, `sample/conf/`, etc.
   - Run with: `npm run build:local` or `npm run dev:local`
   - Keeps sample data separate from service code

3. **Custom mode** (External testing) ⭐
   - Uses any directory via environment variables
   - Run with: `SOURCE_DIR=/path npm run dev:custom`
   - Perfect for testing with real documentation

**Path Resolution Priority:**
1. Custom environment variables (`SOURCE_DIR`, `CONF_DIR`, `DATA_DIR`, `DIST_DIR`)
2. Sample directory (`USE_SAMPLE_DIR=true`)
3. Default paths (`source/`, `conf/`, `data/`, `dist/`)

**Key files:**
- `config/constants.js` - Multi-level path resolution logic
- `package.json` - Contains `:local` and `:custom` script variants
- `docker-compose.yml` - Volume mounts from `./sample/*` to `/app/*`

This allows:
- Clean separation of sample data and service code
- Testing with any external documentation
- Standard paths inside containers
- Same codebase works in all environments

## Code Style

- ES Modules (`import`/`export`)
- No TypeScript in server code (plain JS with JSDoc where helpful)
- Keep dependencies minimal

## Questions?

Open an issue with the question label, and we'll be happy to help.
