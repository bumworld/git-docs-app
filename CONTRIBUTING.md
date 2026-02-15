# Contributing to Git Docs App

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
# Clone the repository
git clone https://github.com/bumworld/git-docs-app.git
cd git-docs-app

# Install dependencies
npm install

# Start in dev mode (authentication bypassed)
DEV_MODE=true npm run dev
```

The server starts at `http://localhost:3000`.

### With Google OAuth

1. Set up Google OAuth credentials (see [README](README.md#1-set-up-google-oauth))
2. Place credentials in `conf/google_auth.json`
3. Start the server:

```bash
ADMIN_EMAIL=you@gmail.com npm run dev
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
config/          # App constants
conf/            # Runtime config (OAuth credentials)
source/          # Wiki content (markdown files)
public/          # Static assets
```

## Code Style

- ES Modules (`import`/`export`)
- No TypeScript in server code (plain JS with JSDoc where helpful)
- Keep dependencies minimal

## Questions?

Open an issue with the question label, and we'll be happy to help.
