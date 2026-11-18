# PROGRESS — Esquadrão dos Amigos (Friends FPS)

## Current phase
Phase 2 — Player & physics

## Completed
- [x] Phase 1 — Foundation: Vite 7 + TypeScript 5.9 scaffold, Three.js renderer (ACES, sRGB, soft shadows), fixed-timestep loop (60 Hz), test scene. Verified in Chrome, 0 console errors, `tsc --noEmit` clean.

## Pending
- Phases 2–8 (see plan in ARCHITECTURE.md).

## Known bugs
- None.

## Technical decisions
- Versions pinned to stable majors with known APIs: three 0.187, rapier3d-compat 0.21, recast-navigation 0.44, yuka 0.7.8, howler 2.2.4, vite 7.3.8, typescript 5.9.3, vitest 4.0.18 (4.1.12 fails to install with npm 10.9 `edgesOut` bug).
- Character models are procedural (user decision); GLB swap supported later.

## Next objective
Phase 2: Rapier world, kinematic character controller, pointer lock, WASD/jump/crouch/walk.
