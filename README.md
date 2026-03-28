# Lock Bases View

An Obsidian plugin that prevents editing interactions inside Bases views by adding a button in toolbar and remembers the lock state per `.base` file.

## Features

- Lock editing interactions in Bases views.
- Remember the lock state for each `.base` file.
- Add a toolbar button to toggle lock state quickly.
- Follow the current Obsidian language for visible UI text.

## Latest release

### v0.1.2

Compared with `0.1.1`, this release focuses on a specific Markdown embed edge case and release readiness:

- Fixed the Markdown preview edge case where embedded Bases could become editable after switching from edit mode to view mode.
- Broadened Bases view detection to include embedded Bases wrappers inside Markdown previews.
- Kept the `128`-entry cap for persisted lock records to prevent `lockedBases` from growing without bound.
- Preserved the detached-DOM cleanup and `MutationObserver` behavior so newly added rows stay locked.
- Kept startup synchronization on `workspace.onLayoutReady()` for better Obsidian compatibility.

If you want a shorter GitHub release note, use:

> This release fixes a Markdown preview edge case for embedded Bases and keeps the lock system stable.
> It broadens Bases detection for embedded previews, preserves the 128-entry persisted-state cap, and keeps the existing leak and observer fixes in place.

## Compatibility

- Requires the Obsidian core plugin `Bases`.
- Tested on desktop, Android, and iOS.
- Mobile support has been verified for locking, unlocking, and optional checkbox interaction while locked.

## Settings

- `Lock checkboxes`: enabled by default.
- When enabled, checkbox fields are locked together with the rest of the Bases view.
- When disabled, checkbox fields remain clickable even while the Bases view is locked.

## Project structure

- `manifest.json` - Obsidian plugin manifest
- `main.ts` - source entry
- `main.js` - built/runtime entry
- `styles.css` - optional stylesheet
- `versions.json` - release compatibility map
- `esbuild.config.mjs` - build config
- `tsconfig.json` - TypeScript config

## Development

```powershell
npm install
npm run build
```

## Local testing

Copy these files to your vault plugin folder:

- `manifest.json`
- `main.js`
- `styles.css`

Example target folder:

```powershell
$pluginDir = "<YourVault>/.obsidian/plugins/lock-bases-view"
Copy-Item ".\manifest.json" "$pluginDir/manifest.json" -Force
Copy-Item ".\main.js" "$pluginDir/main.js" -Force
Copy-Item ".\styles.css" "$pluginDir/styles.css" -Force
```

## Release

For a manual installable package, zip:

- `manifest.json`
- `main.js`
- `styles.css`

Then users extract to `.obsidian/plugins/lock-bases-view/`.
