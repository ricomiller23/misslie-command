// Mulberry32 deterministic pseudo-random number generator for seeded daily runs
export class SeededPRNG {
  private state: number;

  constructor(seed: number | string) {
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

  // Returns a pseudo-random float in [0, 1)
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns integer in [min, max]
  rangeInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Returns float in [min, max)
  rangeFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  // Chance helper (e.g. 0.4 = 40% chance)
  chance(prob: number): boolean {
    return this.next() < prob;
  }
}

export function getDailySeedString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `CINDER_SKY_${year}-${month}-${day}`;
}
