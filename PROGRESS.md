# PROGRESS — Esquadrão dos Amigos (Friends FPS)

## Current phase
Phase 5 — Bots (navmesh + Yuka brain). Plan: ~/.claude/plans/continue-de-onde-parou-cryptic-sunrise.md

## Completed
- [x] Phase 1 — Foundation: Vite 7 + TypeScript 5.9 scaffold, Three.js renderer (ACES, sRGB, PCF soft shadows), fixed-timestep loop (60 Hz), test scene. Verified in Chrome, 0 console errors, `tsc --noEmit` clean. (commit: Phase 1 project foundation)
- [x] Client integration — playable single-player loop: `src/client/player/Game.ts` wires Input → Simulation (LocalAuthority) → renderer at 60 Hz; first-person camera + viewmodel; 9 bot agents (placeholder chase/shoot brains) vs 1 human on Usina; FX tracers/impacts; DOM HUD (ammo, HP, armor, credits, round, kill feed); kill/damage/round events. `src/client/player/AgentRenderer.ts` (procedural skinned characters + AnimationMixer), `src/client/fx/FX.ts` (tracer/impact pools). `src/main.ts` boots `Game`.
- [x] `src/shared/i18n/pt-BR.ts`: all UI strings in PT-BR via `t()` helper.

- [x] Etapa A — Main menu (inspired by user's reference art): `src/client/menu/MenuScene.ts` (live rainy neon city, crescent moon, Reflector wet ground, bloom, selected agent in 3D, `CharacterModelProvider` for future GLB), `src/client/ui/MainMenu.ts` + `menu.css` (brand, tabs, wallet, profile, side menu, news/status cards, footer hints; panels Jogar/Agentes/Arsenal/Mapas/Carreira/Configurações/Ajuda; Loja/Social "em breve"), `src/client/Profile.ts` (localStorage), `src/client/App.ts` (menu → match → menu, one shared Engine).
- Audit of phases 1–4 (2026-11-18): black screen (viewmodel pass cleared the frame) FIXED; Input one-shots never consumed FIXED; AgentRenderer per-frame interpolation + LoopRepeat×3 FIXED; placeholder bots now need LOS. Still open → Etapa B below.

- [x] Etapa B — playable integration: `src/client/fx/WorldRenderer.ts` (polls sim: smoke/molly/slow/lockdown/sensor/trap/turret/wall VFX, projectiles, explosions, flash pops, ground weapons, Spike with beeps), `src/client/ui/HUD.ts` + `hud.css` (score/clock/alive pips, HP/shield, C/Q/E/X charges + cooldown + ult points, ammo, spike timer, plant/defuse bar, blind overlay, kill feed, banners, shop on B via `sim.buy`, scoreboard on Tab), pause screen on pointer-lock loss, spectator camera on death, match end → career record → menu. ViewModel fixes: inverted equip offset hid the gun; RoomEnvironment so metal isn't black.
- Verified in Chrome (2026-11-18): Q spends exactly 1 charge, R reloads repeatedly, WASD moves, smoke visible, spectate works, victory → menu, 0 new console errors.

## In progress
- Phase 5: recast navmesh (`generateSoloNavMesh`) + Yuka steering + 12-state bot brain (replace placeholder chase/shoot).

## Pending
- Phase 6: `tools/sim-harness.ts` headless full-match runner (bot-vs-bot, asserts winner, no stuck bots).
- Phase 7: UI polish (main menu, shop, scoreboard, pause, victory/defeat, settings), audio (howler SFX + TTS voice lines), perf pass.
- Phase 8: Colyseus MatchRoom + NetworkAuthority client swap.

## Known bugs
- Bot brains are a placeholder (chase nearest visible enemy + shoot, no pathing → they get stuck on walls); replaced in Phase 5 with navmesh/Yuka.
- Third-person `fire`/`reload` clips not added yet; no bullet-hole decals (impact sparks only).

## Technical decisions
- Versions: three 0.187, rapier3d-compat 0.21, recast-navigation 0.44, yuka 0.7.8, howler 2.2.4, vite 7.3.8, typescript 5.9.3, vitest 4.0.18.
- Sim layer (match, combat, weapons, abilities, movement, physics) is render-free and DOM-free; Rapier runs in the sim.
- Character models are procedural (user decision); GLB swap supported later via CharacterModelProvider.
- "Spike" kept as named; all other names/map/weapons/art original.

## Next objective
Phase 5: recast navmesh from Usina geometry, Yuka FollowPath/arrive steering, 12-state bot brain with goal evaluator.
