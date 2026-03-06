# Build AppImage

Build a Linux AppImage package for MarkText.

## Steps

1. Kill any leftover build processes
2. Clean previous build artifacts (`build/` and `dist/electron/`)
3. Webpack compile (main + renderer) via `node .electron-vue/build.js`
4. Rebuild native modules with `electron-rebuild -f`
5. Package AppImage with `electron-builder` (skip redundant native rebuild)

## Notes

- Requires Node.js v16 — uses `nvm use 16` automatically
- `npmRebuild: false` is safe: native modules are already rebuilt in step 4
- Output: `build/marktext-x86_64.AppImage`
- The bad `rebuild` npm package (a file-watcher, not `@electron/rebuild`) can pollute
  the npx cache at `~/.npm/_npx/` — this script clears it before building

## Commands

Run the following in sequence:

```bash
# 1. Kill any leftover processes
kill $(ps aux | grep -E 'electron-builder|app-builder' | grep -v grep | awk '{print $2}') 2>/dev/null || true

# 2. Clean & compile
source ~/.nvm/nvm.sh && nvm use 16
yarn run build:clean
node .electron-vue/build.js

# 3. Clear bad npx cache entry (prevents wrong 'rebuild' package being used)
rm -rf ~/.npm/_npx/7d83ce88599d010b 2>/dev/null || true

# 4. Rebuild native modules
./node_modules/.bin/electron-rebuild -f

# 5. Package AppImage only
npx electron-builder build --linux AppImage -c.npmRebuild=false
```

Execute all steps now. Run steps 1-2 sequentially first, then step 3-4-5 sequentially.
Use `nvm use 16` before every `yarn`/`node`/`npx` call.
Report the final AppImage path and file size when done.
