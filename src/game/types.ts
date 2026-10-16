// Cinder Sky entity and game state types

export type ShardType = "pebble" | "streak" | "splitter" | "cluster_core" | "glider";
export type Difficulty = "easy" | "normal" | "hard";
export type GameMode = "standard" | "daily";

export interface Settlement {
  id: number;
  x: number;
  y: number;
  alive: boolean;
  lanternPhase: number;
}

export interface Silo {
  id: number; // 0: left, 1: center, 2: right
  x: number;
  y: number;
  shells: number;
  maxShells: number;
  disabled: boolean;
  isCenterFast: boolean;
}

export interface Shard {
  id: number;
  type: ShardType;
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  splitTriggerAltitude?: number; // e.g. 50% height for splitter, 40% for cluster
  hasSplit?: boolean;
  angle?: number;
  wobblePhase?: number; // for glider
  color: string;
  trail: Array<{ x: number; y: number; alpha: number }>;
}

export interface FlakShell {
  id: number;
  siloIndex: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number; // calculated progress delta per second
}

export interface Blast {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  phase: "growing" | "holding" | "shrinking";
  phaseTimer: number; // seconds spent in current phase
  isChain: boolean;
  comboCount: number;
  color: string;
}

export interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface WorkshopUpgrades {
  blastRadiusLevel: number; // max 5 (+10% per level)
  shellSpeedLevel: number; // max 5 (+15% per level)
  ammoLevel: number; // max 5 (+2 shells per silo)
  slowTimeChargesLevel: number; // max 3 (extra slow time charge)
}

export interface GameSettings {
  soundEnabled: boolean;
  difficulty: Difficulty;
  reducedMotion: boolean;
  colorblindSafe: boolean;
}

export interface WaveTally {
  wave: number;
  settlementsSaved: number;
  ammoRemaining: number;
  waveScore: number;
  embersEarned: number;
  totalScore: number;
  totalEmbers: number;
}

export interface HighScoreRecord {
  score: number;
  wave: number;
  date: string;
  mode: GameMode;
  seed?: string;
}

export const WORKSHOP_PRICES = {
  blastRadius: [150, 300, 600, 1100, 1800],
  shellSpeed: [120, 260, 500, 950, 1600],
  ammo: [140, 280, 550, 1000, 1700],
  slowTime: [300, 750, 1500],
  rebuildSettlement: 500
};
