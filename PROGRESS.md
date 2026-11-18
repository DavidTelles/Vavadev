# PROGRESS — Esquadrão dos Amigos (Friends FPS)

## Current phase
Etapa B — fix phases 1–4 integration (plan: ~/.claude/plans/continue-de-onde-parou-cryptic-sunrise.md), then Phase 5

## Completed
- [x] Phase 1 — Foundation: Vite 7 + TypeScript 5.9 scaffold, Three.js renderer (ACES, sRGB, PCF soft shadows), fixed-timestep loop (60 Hz), test scene. Verified in Chrome, 0 console errors, `tsc --noEmit` clean. (commit: Phase 1 project foundation)
- [x] Client integration — playable single-player loop: `src/client/player/Game.ts` wires Input → Simulation (LocalAuthority) → renderer at 60 Hz; first-person camera + viewmodel; 9 bot agents (placeholder chase/shoot brains) vs 1 human on Usina; FX tracers/impacts; DOM HUD (ammo, HP, armor, credits, round, kill feed); kill/damage/round events. `src/client/player/AgentRenderer.ts` (procedural skinned characters + AnimationMixer), `src/client/fx/FX.ts` (tracer/impact pools). `src/main.ts` boots `Game`.
- [x] `src/shared/i18n/pt-BR.ts`: all UI strings in PT-BR via `t()` helper.

- [x] Etapa A — Main menu (inspired by user's reference art): `src/client/menu/MenuScene.ts` (live rainy neon city, crescent moon, Reflector wet ground, bloom, selected agent in 3D, `CharacterModelProvider` for future GLB), `src/client/ui/MainMenu.ts` + `menu.css` (brand, tabs, wallet, profile, side menu, news/status cards, footer hints; panels Jogar/Agentes/Arsenal/Mapas/Carreira/Configurações/Ajuda; Loja/Social "em breve"), `src/client/Profile.ts` (localStorage), `src/client/App.ts` (menu → match → menu, one shared Engine).
- Audit of phases 1–4 (2026-11-18): black screen (viewmodel pass cleared the frame) FIXED; Input one-shots never consumed FIXED; AgentRenderer per-frame interpolation + LoopRepeat×3 FIXED; placeholder bots now need LOS. Still open → Etapa B below.

## In progress
- Etapa B: click-to-play/pause polish, ability VFX (`effectSpawn`/`explosion`/`blinded` have no listener — smoke is invisible), Spike + ground weapons rendering, decals, fire/reload clips, full HUD, shop (B), scoreboard (Tab), spectator on death.
- Phase 5: recast navmesh (`generateSoloNavMesh`) + Yuka steering + 12-state bot brain (replace placeholder chase/shoot).

## Pending
- Phase 6: `tools/sim-harness.ts` headless full-match runner (bot-vs-bot, asserts winner, no stuck bots).
- Phase 7: UI polish (main menu, shop, scoreboard, pause, victory/defeat, settings), audio (howler SFX + TTS voice lines), perf pass.
- Phase 8: Colyseus MatchRoom + NetworkAuthority client swap.

## Known bugs
- Bot brains are a placeholder (chase nearest enemy + shoot); replaced in Phase 5 with navmesh/Yuka.
- Full UI (menu/shop/scoreboard/pause) not yet built (Phase 7).

## Technical decisions
- Versions: three 0.187, rapier3d-compat 0.21, recast-navigation 0.44, yuka 0.7.8, howler 2.2.4, vite 7.3.8, typescript 5.9.3, vitest 4.0.18.
- Sim layer (match, combat, weapons, abilities, movement, physics) is render-free and DOM-free; Rapier runs in the sim.
- Character models are procedural (user decision); GLB swap supported later via CharacterModelProvider.
- "Spike" kept as named; all other names/map/weapons/art original.

## Next objective
Phase 5: recast navmesh from Usina geometry, Yuka FollowPath/arrive steering, 12-state bot brain with goal evaluator.
