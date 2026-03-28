# Contributing

This plugin is intentionally small and release-focused. Changes should aim to keep Bases locking reliable, lightweight, and compatible with Obsidian release guidelines.

## What to check before opening a change

- Keep persisted plugin data bounded.
- Avoid strong references to transient DOM nodes.
- Avoid direct DOM style assignment in JavaScript.
- Avoid deprecated Obsidian APIs when a supported alternative exists.
- Keep startup work minimal and defer UI sync until `workspace.onLayoutReady()`.
- Update `main.js` after changing `main.ts`.

## Local workflow

```powershell
npm install
npm run build
```

If the build succeeds, verify that these release files are present and up to date:

- `main.js`
- `manifest.json`
- `styles.css` if it changed

## Release notes

For the GitHub release body, write the delta from the previous version in plain language:

- Start with one sentence that describes the purpose of the release.
- Follow with 3 to 6 bullets that name the user-facing or maintenance changes.
- Mention any compatibility or release-safety improvements explicitly.
- Keep the note short enough that someone can scan it in a few seconds.

Example for `0.1.1`:

- Added a 128-entry cap for persisted lock records.
- Removed a detached-DOM memory leak path.
- Enabled the mutation observer that keeps newly added Bases rows locked.
- Restricted persisted keys to stable `.base` file-backed views.
- Moved initial sync to `workspace.onLayoutReady()`.

## Commit and release

Typical release sequence:

```powershell
git status --short
git add main.ts main.js manifest.json package.json versions.json README.md CONTRIBUTING.md
git commit -m "Release 0.1.1"
git tag 0.1.1
git push
git push --tags
```

If you use GitHub Releases, make the release title the exact version number, for example `0.1.1`.
