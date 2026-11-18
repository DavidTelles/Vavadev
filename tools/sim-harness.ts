/**
 * Headless full-match runner: 10 bots, real Simulation (Rapier + bot AI), no rendering.
 *
 *   npx tsx tools/sim-harness.ts [--rounds full|quick] [--difficulty facil|normal|dificil|all] [--seed N] [--matches N]
 *
 * Asserts: the match ends with a winner, no exceptions, at least one plant
 * happened, and no living bot stood still for >10 s outside hold/plant/defuse.
 */
import { Simulation, type AgentSetup } from '../src/shared/sim/Simulation';
import { CHARACTERS } from '../src/shared/data/characters';
import { BotController } from '../src/shared/sim/bots/BotController';
import { TICK_DT } from '../src/shared/constants';
import type { Difficulty, MatchMode, Team } from '../src/shared/types';

const args = process.argv.slice(2);
const arg = (k: string, d: string): string => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const mode: MatchMode = arg('rounds', 'quick') === 'full' ? 'competitivo' : 'rapida';
const diffArg = arg('difficulty', 'normal');
const diffs: Difficulty[] = diffArg === 'all' ? ['facil', 'normal', 'dificil'] : [diffArg as Difficulty];
const matches = Number(arg('matches', '1'));
const seed0 = Number(arg('seed', '1'));

interface Result {
  difficulty: Difficulty;
  seed: number;
  winner: Team | null;
  score: Record<Team, number>;
  rounds: number;
  reasons: Record<string, number>;
  plants: number;
  defuses: number;
  kills: number;
  abilityCasts: number;
  maxIdle: number;
  idleWho: string;
  simSeconds: number;
  wallMs: number;
  errors: string[];
}

async function runMatch(difficulty: Difficulty, seed: number): Promise<Result> {
  const agents: AgentSetup[] = CHARACTERS.slice(0, 10).map((c, i) => ({
    name: c.name, team: i < 5 ? 'atk' : 'def', characterId: c.id, isBot: true, difficulty,
  }));
  const sim = await Simulation.create({ mode, seed, agents });
  const bots = sim.controllers.find((c) => c instanceof BotController) as BotController;
  const r: Result = {
    difficulty, seed, winner: null, score: { atk: 0, def: 0 }, rounds: 0, reasons: {}, plants: 0, defuses: 0, kills: 0,
    abilityCasts: 0, maxIdle: 0, idleWho: '', simSeconds: 0, wallMs: 0, errors: [],
  };
  sim.events.on('roundEnd', (p) => { r.rounds++; r.reasons[p.reason] = (r.reasons[p.reason] ?? 0) + 1; });
  sim.events.on('spikePlanted', () => r.plants++);
  sim.events.on('spikeDefused', () => r.defuses++);
  sim.events.on('kill', () => r.kills++);
  sim.events.on('abilityCast', () => r.abilityCasts++);
  sim.events.on('matchEnd', (p) => { r.winner = p.winner; r.score = p.score; });
  sim.start();

  const lastMove = new Map<number, { x: number; z: number; t: number }>();
  const t0 = Date.now();
  const maxTicks = 60 * 60 * 60; // 60 sim-minutes safety cap
  for (let i = 0; i < maxTicks && !r.winner; i++) {
    try {
      sim.step(TICK_DT);
    } catch (e) {
      r.errors.push(String((e as Error).stack ?? e));
      break;
    }
    if (i % 30 !== 0) continue;
    const phase = sim.match.phase;
    for (const a of sim.agents) {
      const lm = lastMove.get(a.id);
      const moved = !lm || Math.hypot(a.pos.x - lm.x, a.pos.z - lm.z) > 0.8;
      const st = bots.brainOf(a.id)?.state ?? '';
      const exempt = !a.alive || (phase !== 'combat' && phase !== 'planted') || st === 'hold' || st === 'plant' || st === 'defuse' || st === 'combat' || st === 'cover';
      if (moved || exempt) lastMove.set(a.id, { x: a.pos.x, z: a.pos.z, t: sim.time });
      else {
        const idle = sim.time - lm!.t;
        if (idle > 8 && r.maxIdle <= 8 && args.includes('--debug')) {
          const b = bots.brainOf(a.id)!;
          console.log('IDLE DEBUG', JSON.stringify({
            name: a.name, team: a.team, state: b.state, goalKey: b.goalKey, goal: b.goal, pos: a.pos, path: b.path, pathIdx: b.pathIdx,
            hasSpike: a.hasSpike, input: a.input, hold: b.hold, phase, vel: a.motor.vel, grounded: a.motor.grounded,
          }));
        }
        if (idle > r.maxIdle) {
          r.maxIdle = idle;
          r.idleWho = `${a.name} (${st}) at ${a.pos.x.toFixed(1)},${a.pos.z.toFixed(1)} round ${sim.match.round}`;
        }
      }
    }
  }
  r.simSeconds = sim.time;
  r.wallMs = Date.now() - t0;
  sim.dispose();
  return r;
}

async function main(): Promise<void> {
  let failed = false;
  for (const d of diffs) {
    for (let m = 0; m < matches; m++) {
      const r = await runMatch(d, seed0 + m);
      const checks: [string, boolean][] = [
        ['winner', r.winner !== null],
        ['no exceptions', r.errors.length === 0],
        ['at least one plant', r.plants > 0],
        ['no bot idle > 10 s', r.maxIdle <= 10],
      ];
      console.log(`\n=== ${mode} · ${d} · seed ${r.seed} ===`);
      console.log(`winner ${r.winner} ${r.score.atk}:${r.score.def} in ${r.rounds} rounds · ${(r.simSeconds / 60).toFixed(1)} sim-min · ${(r.wallMs / 1000).toFixed(1)} s wall`);
      console.log(`reasons ${JSON.stringify(r.reasons)} · plants ${r.plants} · defuses ${r.defuses} · kills ${r.kills} · casts ${r.abilityCasts}`);
      console.log(`max idle ${r.maxIdle.toFixed(1)} s ${r.idleWho}`);
      for (const [name, ok] of checks) {
        console.log(`  ${ok ? 'PASS' : 'FAIL'} ${name}`);
        if (!ok) failed = true;
      }
      if (r.errors.length) console.log(r.errors[0]);
    }
  }
  process.exit(failed ? 1 : 0);
}

void main();
