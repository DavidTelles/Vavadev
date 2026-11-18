import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/shared/sim/Simulation';
import { emptyInput } from '../src/shared/types';

async function makeSim() {
  const sim = await Simulation.create({
    mode: 'treino',
    seed: 1,
    agents: [{ name: 'Teste', team: 'atk', characterId: 'david', isBot: false, difficulty: 'normal' }],
  });
  sim.start();
  return sim;
}

describe('movement', () => {
  it('stands on the ground without falling through', async () => {
    const sim = await makeSim();
    const a = sim.agents[0];
    for (let i = 0; i < 120; i++) sim.step();
    expect(a.pos.y).toBeGreaterThan(-0.05);
    expect(a.pos.y).toBeLessThan(0.1);
    expect(a.motor.grounded).toBe(true);
  });

  it('cannot walk through the outer wall', async () => {
    const sim = await makeSim();
    const a = sim.agents[0];
    const cmd = { ...emptyInput(), moveZ: 1, yaw: Math.PI };
    for (let i = 0; i < 600; i++) {
      sim.setInput(a.id, cmd);
      sim.step();
    }
    expect(a.pos.z).toBeLessThan(sim.map.maxZ);
    expect(sim.map.solidAt(a.pos.x, a.pos.z)).toBe(false);
  });

  it('jumps and lands', async () => {
    const sim = await makeSim();
    const a = sim.agents[0];
    for (let i = 0; i < 30; i++) sim.step();
    sim.setInput(a.id, { ...emptyInput(), jump: true });
    sim.step();
    let maxY = 0;
    sim.setInput(a.id, emptyInput());
    for (let i = 0; i < 90; i++) {
      sim.step();
      maxY = Math.max(maxY, a.pos.y);
    }
    expect(maxY).toBeGreaterThan(0.8);
    expect(a.motor.grounded).toBe(true);
  });

  it('crouch reduces height and speed', async () => {
    const sim = await makeSim();
    const a = sim.agents[0];
    for (let i = 0; i < 30; i++) {
      sim.setInput(a.id, { ...emptyInput(), crouch: true, moveZ: 1 });
      sim.step();
    }
    expect(a.motor.bodyHeight).toBeLessThan(1.3);
    expect(a.motor.horizontalSpeed()).toBeLessThan(2.7);
  });
});
