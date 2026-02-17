---
title: Frontend Development Guide
sidebar:
  label: Frontend Overview
---

# Frontend Development Guide

Complete guide for building modern web applications with React and TypeScript.

## Directory Structure

```
frontend/
├── README.md                    # This file
├── react-best-practices.md      # React coding standards
├── state-management.md          # Redux/Zustand patterns
├── styling-guide.md             # CSS-in-JS and Tailwind
└── performance-optimization.md  # Web performance tips
```

---

## Quick Start

### For New Developers
1. [React Best Practices](react-best-practices) - Learn our React conventions
2. [State Management](state-management) - Understand Redux patterns
3. [Styling Guide](styling-guide) - CSS and design system usage

### For Experienced Developers
1. [Performance Optimization](performance-optimization) - Advanced techniques
2. Review existing components in `src/components/`
3. Follow TypeScript strict mode guidelines

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2+ | UI framework |
| TypeScript | 5.0+ | Type safety |
| Vite | 4.0+ | Build tool |
| Tailwind CSS | 3.0+ | Styling |
| Redux Toolkit | 1.9+ | State management |
| React Query | 4.0+ | Server state |
| Vitest | 0.34+ | Unit testing |
| Playwright | 1.40+ | E2E testing |

---

## Development Workflow

1. **Setup**: Clone repo and run `npm install`
2. **Development**: `npm run dev` for hot reload
3. **Testing**: `npm test` for unit tests
4. **Build**: `npm run build` for production
5. **Preview**: `npm run preview` to test build

---

## Code Quality

- **Linting**: ESLint with custom rules
- **Formatting**: Prettier with 2-space indentation
- **Type checking**: TypeScript strict mode
- **Testing**: 80%+ code coverage target
- **Pre-commit**: Husky hooks for quality checks

---

## Resources

- [Component Library](../design/component-library)
- [API Integration Guide](../backend/api-integration)
- [Deployment Process](../infrastructure/deployment)
