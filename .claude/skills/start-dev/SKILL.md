---
name: start-dev
description: Start a local dev server for the Stardew Season Planner so changes can be tested in a browser before committing or pushing. Use this whenever the user wants to run the app, preview it, spin up localhost, test locally, check their changes in a browser, or says things like "start the server", "run the app", or "let me see it" — even if they don't say "dev server" explicitly.
---

# Start the dev server

The app is a fully static site (plain HTML/CSS/JS modules, no build step), but it
MUST be served over HTTP — opening `index.html` via `file://` breaks the ES module
imports. That's the whole reason this skill exists.

## Steps

1. Run the bundled script (idempotent — reuses an already-running server, finds a
   free port automatically):

   ```bash
   bash .claude/skills/start-dev/scripts/start-dev.sh
   ```

   Optional: pass a port as the first argument, e.g. `... start-dev.sh 3000`.

2. Report the URL it prints to the user so they can open it in their browser.

3. If working in a remote/headless environment where the user can't open
   localhost, verify changes for them instead: drive the page with Playwright
   (Chromium at `/opt/pw-browsers/chromium` if present), click "Plan my season",
   check the console for errors, and share a screenshot.

## Notes

- No install step, no build step, no file watcher needed — edits to
  `index.html`, `css/`, or `js/` show up on browser refresh.
- Stop the server with the `kill <pid>` command the script prints
  (pidfile: `/tmp/stardew-dev-server.pid`, logs: `/tmp/stardew-dev-server.log`).
- Quick logic check without a browser: the profit engine is DOM-free, so
  `node --input-type=module -e "import { rankCrops } from './js/calc.js'; ..."`
  works for fast sanity tests.
