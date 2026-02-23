# Manual Release Guide

This repo uses a manual release flow:

- Manual PRs / merges
- Manual npm publish
- Manual GitHub Release page creation

## Release Channels

- `beta` dist-tag: prereleases (for example `0.9.3-beta.1`)
- `latest` dist-tag: stable releases (for example `0.9.3`)

## Build Outputs

- npm package library build: `dist/lib`
- Demo build (optional release artifact): `dist/demo`

## Pre-Release Checklist

1. Make sure `main` is up to date locally.
2. Confirm working tree is clean (`git status`).
3. Update `CHANGELOG.md` (`Unreleased` -> new version section).
4. Run package checks:
   - `npm run build:lib`
   - `npm run pack:check`
5. Optional: build demo artifact:
   - `npm run build:demo`
6. Verify package contents from `npm pack --dry-run` include `dist/lib/index.js`, `README.md`, `LICENSE`.

## Beta Release (npm `beta`)

Example:

```bash
npm version prerelease --preid=beta
npm run build:lib
npm run pack:check
npm publish --tag beta
git push origin main --tags
```

Tag format produced by `npm version`:

- `v0.9.3-beta.1`

Then create a GitHub Release manually for the new tag and paste release notes from `CHANGELOG.md`.

## Stable Release (npm `latest`)

Example patch release:

```bash
npm version patch
npm run build:lib
npm run pack:check
npm publish
git push origin main --tags
```

For `minor` / `major`, replace `patch` accordingly.

Then create a GitHub Release manually for the new tag and paste release notes from `CHANGELOG.md`.

## GitHub Release Page (Manual)

Recommended contents:

- Version summary
- Highlights / breaking changes
- Upgrade notes
- npm install command
- Known issues (if any)

Optional attachments:

- Zip of `dist/demo` build for quick preview/testing
