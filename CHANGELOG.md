# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog, with lightweight manual updates.

## Unreleased

### Changed

- Split build outputs into a library package build (`dist/lib`) and demo build (`dist/demo`).
- Reworked npm packaging metadata to publish a real library entrypoint.

### Fixed

- Runtime identity mapping now keeps `Object3D.name` aligned with DOM `id`.
- Runtime class mapping is exposed via `Object3D.classList` compatibility alias and `userData.classList`.

### Performance

- Cached selector / keyframe / asset-rule scans with invalidation on style changes.
- Reduced pointer-move raycast and repaint overhead.

## 0.9.2-beta.1

### Notes

- Previous beta release.
- npm `beta` dist-tag currently points here.

## 0.9.2-beta.0

### Notes

- Previous beta/stable-tagged release state.
