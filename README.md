# Lock Bases View

An Obsidian plugin that prevents editing interactions inside Bases views and remembers the lock state per `.base` file.

## Features

- Lock editing interactions in Bases views.
- Remember the lock state for each `.base` file.
- Add a toolbar button to toggle lock state quickly.
- Follow the current Obsidian language for visible UI text.

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
