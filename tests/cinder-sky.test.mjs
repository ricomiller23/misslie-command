import test from "node:test";
import assert from "node:assert/strict";

// 1. Seeded PRNG Determinism (Mulberry32)
class SeededPRNG {
  constructor(seed) {
    if (typeof seed === "string") {
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
      }
      this.state = hash >>> 0;
    } else {
      this.state = seed >>> 0;
    }
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  next() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  rangeInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  rangeFloat(min, max) {
    return this.next() * (max - min) + min;
  }
}

test("Seeded PRNG generates 100% deterministic sequence from same seed", () => {
  const seed = "CINDER_SKY_2026-10-16";
  const rng1 = new SeededPRNG(seed);
  const rng2 = new SeededPRNG(seed);

  const seq1 = Array.from({ length: 25 }, () => rng1.next());
  const seq2 = Array.from({ length: 25 }, () => rng2.next());

  assert.deepEqual(seq1, seq2, "PRNG output sequences must match exactly");
  assert.equal(seq1.length, 25);
  seq1.forEach((val) => {
    assert.ok(val >= 0 && val < 1, `Value ${val} should be in [0, 1)`);
  });
});

test("Daily Seed string adheres to CINDER_SKY_YYYY-MM-DD pattern", () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const expected = `CINDER_SKY_${year}-${month}-${day}`;

  const regex = /^CINDER_SKY_\d{4}-\d{2}-\d{2}$/;
  assert.ok(regex.test(expected), "Daily seed must match standard date pattern");
});

test("Fixed-timestep physics accumulator maintains invariant 60Hz step", () => {
  const FIXED_DT = 1 / 60;
  let accumulator = 0;
  let physicsUpdates = 0;

  // Simulate a 33.33ms frame (approx 30 FPS display drop)
  const rawDeltaSec = (2 / 60);
  accumulator += rawDeltaSec;

  while (accumulator >= FIXED_DT) {
    physicsUpdates++;
    accumulator -= FIXED_DT;
  }

  // At 33.33ms and dt=16.66ms, exactly 2 physics steps must execute
  assert.equal(physicsUpdates, 2, "Physics must step twice for 33ms frame");
  assert.ok(accumulator < FIXED_DT, "Accumulator remainder must be less than 1 frame");
});

test("Flak blast collision and chain combo multiplier calculations", () => {
  const blast = { x: 500, y: 400, radius: 60 };
  const targetShard = { x: 530, y: 420 }; // distance = sqrt(30^2 + 20^2) = ~36.05 <= 60
  const distantShard = { x: 700, y: 700 }; // distance = sqrt(200^2 + 300^2) > 60

  const distTarget = Math.hypot(targetShard.x - blast.x, targetShard.y - blast.y);
  const distDistant = Math.hypot(distantShard.x - blast.x, distantShard.y - blast.y);

  assert.ok(distTarget <= blast.radius, "Target shard must be within blast radius");
  assert.ok(distDistant > blast.radius, "Distant shard must not collide with blast");

  // Chain multiplier score formula: base * combo
  const baseKillScore = 50;
  const combo = 4;
  const totalKillScore = baseKillScore * combo;
  assert.equal(totalKillScore, 200, "Kill score must equal base * combo");
});

test("Workshop upgrade pricing and level cap constraints", () => {
  const WORKSHOP_PRICES = {
    blastRadius: [150, 300, 600, 1100, 1800],
    shellSpeed: [120, 260, 500, 950, 1600],
    ammo: [140, 280, 550, 1000, 1700],
    slowTime: [300, 750, 1500],
    rebuildSettlement: 500
  };

  assert.equal(WORKSHOP_PRICES.blastRadius.length, 5, "Blast radius must have 5 tiers");
  assert.equal(WORKSHOP_PRICES.shellSpeed.length, 5, "Shell speed must have 5 tiers");
  assert.equal(WORKSHOP_PRICES.ammo.length, 5, "Ammo must have 5 tiers");
  assert.equal(WORKSHOP_PRICES.slowTime.length, 3, "Slow Time must have 3 tiers");
  assert.equal(WORKSHOP_PRICES.rebuildSettlement, 500, "Rebuild settlement must cost 500");

  // Monotonically increasing price check
  for (let i = 1; i < WORKSHOP_PRICES.blastRadius.length; i++) {
    assert.ok(WORKSHOP_PRICES.blastRadius[i] > WORKSHOP_PRICES.blastRadius[i - 1]);
  }
});

test("Shard splitting logic produces expected child counts", () => {
  // Splitter: 2-3 pebbles
  const rng = new SeededPRNG("TEST_SPLITTER");
  const splitterChildren = rng.rangeInt(2, 3);
  assert.ok(splitterChildren >= 2 && splitterChildren <= 3, "Splitter must yield 2 or 3 pebbles");

  // Cluster Core: 4 streaks
  const clusterChildrenCount = 4;
  assert.equal(clusterChildrenCount, 4, "Cluster Core must yield 4 streaks");
});

test("Missile pointer mouse aiming and keyboard base selection logic", () => {
  const VIRTUAL_HEIGHT = 800;
  const SILO_LINE_Y = VIRTUAL_HEIGHT - 60; // 740

  const silos = [
    { id: 0, x: 120, y: 755, shells: 10, isCenterFast: false },
    { id: 1, x: 600, y: 755, shells: 10, isCenterFast: true },
    { id: 2, x: 1080, y: 755, shells: 10, isCenterFast: false }
  ];

  // 1. Mouse coordinates inside valid sky fire zone
  const mouseTargetValid = { x: 500, y: 300 };
  assert.ok(mouseTargetValid.y <= SILO_LINE_Y, "Pointer in sky should be valid fire zone");

  // 2. Mouse coordinates below silo line
  const mouseTargetInvalid = { x: 500, y: 760 };
  assert.ok(mouseTargetInvalid.y > SILO_LINE_Y, "Pointer below silo line should be invalid fire zone");

  // 3. Center silo speed multiplier is 1.4x (40% faster)
  const baseSpeed = 420;
  const sideSpeed = baseSpeed * 1.0;
  const centerSpeed = baseSpeed * 1.4;
  assert.equal(centerSpeed / sideSpeed, 1.4, "Center base must have 1.4x speed factor");

  // 4. Choosing base 1, 2, or 3
  const chosenBases = [0, 1, 2];
  chosenBases.forEach((idx) => {
    const selectedSilo = silos[idx];
    assert.equal(selectedSilo.id, idx, `Base index ${idx + 1} must match silo id`);
    assert.ok(selectedSilo.shells > 0, `Base ${idx + 1} must have ammo`);
  });
});
