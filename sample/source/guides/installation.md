# Installation Guide

Detailed installation instructions for various environments.

## Docker Installation

```bash
docker pull git-docs-app
docker run -p 8080:3000 -e ADMIN_EMAIL=you@gmail.com git-docs-app
```

## Manual Installation

```bash
git clone https://github.com/example/git-docs-app.git
cd git-docs-app
npm install
npm run build
npm start
```

## Configuration

All configuration is managed through the admin panel after first login.
