# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
yarn install                  # Install dependencies (also runs rebuild and lint:fix)
yarn run dev                  # Build and run in developer mode (hot reload)

# Building
yarn run build                # Build binaries and packages for your OS
yarn run build:bin            # Build binary only (no installer)
yarn run build:dev            # Build only (no electron-builder packaging)
yarn run build:clean          # Clean build artifacts

# Testing
yarn run unit                 # Run unit tests (Karma/Mocha in Electron)
yarn run e2e                  # Run end-to-end tests (Playwright) — requires pack first
yarn run test:specs           # Run CommonMark/GFM conformance specs

# Linting
yarn run lint                 # Lint JS and Vue files
yarn run lint:fix             # Auto-fix lint issues
```

**Node.js requirement:** `>=v16` but `<v17`. Use yarn (not npm).

## Architecture

MarkText is an Electron app with **three distinct process contexts**:

### `src/common/`
Utilities using only Node.js APIs. Importable from both `main` and `renderer`, but **not** from `muya`.

### `src/main/`
Electron main process. Entry point: `src/main/index.js`. The `App` class (`src/main/app/index.js`) controls the application lifecycle, window management, IO, native dialogs, file system watchers, and menu. Each window is represented as an editor window instance.

### `src/muya/`
The editor backend — a self-contained browser-based markdown engine with **no Electron or Node.js APIs**. Uses only pure JS, DOM, and BOM APIs. Handles:
- Real-time WYSIWYG markdown parsing and rendering (block-based structure)
- CommonMark, GFM, and Pandoc markdown specs
- Math (KaTeX), emojis, front matter
- HTML/markdown export
- Selection, event handling, content state

### `src/renderer/`
Electron renderer process (one per window). Entry point: `src/renderer/main.js`. Built with Vue 2 + Vuex + Vue Router. Key subdirectories:
- `store/` — Vuex modules (editor, layout, preferences, etc.)
- `components/` — Vue components (editorWithTabs, sideBar, titleBar, etc.)
- `services/` — Cross-cutting services

### Source-code editor
CodeMirror provides the source-code editing mode. It is **not** part of Muya — it reads markdown from Muya on switch and re-imports when switching back to preview mode.

## IPC Convention

Main ↔ renderer communication uses Electron's `ipcMain`/`ipcRenderer`. All cross-process event names are prefixed with `mt::` (e.g., `mt::open-new-tab`). Events emitted directly on `ipcMain` (not from a renderer) are **not** prefixed.

## Code Style

- ES6+ with no semicolons, 2-space indent
- ESLint with `eslint-config-standard` + Vue plugin
- JSDoc for documentation
- PRs target the `develop` branch

## Debugging

In dev mode (`yarn run dev`):
- Main process DevTools: `chrome://inspect` on port `5858`
- Renderer process DevTools: port `8315`, or `View → Toggle Developer Tools` in the app

## Build System

Webpack configs live in `.electron-vue/`:
- `webpack.main.config.js` — bundles `src/main/`
- `webpack.renderer.config.js` — bundles `src/renderer/` and `src/muya/`
- Output goes to `dist/electron/`

Muya can also be built/published independently: `yarn run build:muya`.
