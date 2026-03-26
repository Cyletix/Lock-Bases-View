# Publishing checklist

## 1. Before release

Update these fields before submitting the plugin:

- `manifest.json` -> `author`
- `manifest.json` -> `authorUrl` (optional)
- `package.json` -> `author`
- `LICENSE` -> replace `[Your Name]`

## 2. Build

```powershell
npm install
npm run build
```

Build output for release assets:

- `main.js`
- `manifest.json`
- `styles.css`

## 3. Create a GitHub release

1. Push the repository to GitHub.
2. Create a tag that matches the plugin version in `manifest.json`.
3. Open GitHub -> Releases -> Draft a new release.
4. Tag version: `0.1.0`.
5. Release title: `0.1.0`.
6. Upload these files as release assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`
7. Publish the release.

Suggested release title:

```text
0.1.0
```

Suggested release notes:

```text
Initial release of Lock Bases View.

- Add a toolbar button to lock or unlock Bases views.
- Prevent editing interactions while a Bases view is locked.
- Persist lock state per .base file.
```

## 4. Submit to the Obsidian community plugins list

Add an entry to `community-plugins.json` using this structure:

```json
{
  "id": "lock-bases-view",
  "name": "Lock Bases View",
  "author": "<Your Name>",
  "description": "Lock editing interactions in Obsidian Bases views and persist lock state per .base file.",
  "repo": "<your-github-name>/<your-repo-name>"
}
```

## 5. PR title

```text
Add plugin: Lock Bases View
```

## 6. PR description template

```text
## Checklist

- [x] I have read the developer policies.
- [x] I have read the submission requirements for plugins.
- [x] I have included a LICENSE file.
- [x] I have a GitHub release with the required assets.
- [x] I have tested the plugin after building it.

## Details

- Plugin name: Lock Bases View
- Plugin id: lock-bases-view
- Repository: <your-github-name>/<your-repo-name>
- Release version: 0.1.0
- Minimum Obsidian version: 1.8.0

## Description

Lock editing interactions in Obsidian Bases views and persist lock state per .base file.
```

## 7. PR notes

- Confirm that `manifest.json`, `versions.json`, and release assets are in sync.
- Wait for the validation bot before expecting human review.
- If review requests changes, update the same GitHub release instead of opening a new PR.
