import { SeededPRNG } from "./prng";
import { SoundSynthesizer } from "./audio";
import {
  Shard,
  ShardType,
  FlakShell,
  Blast,
  SparkParticle,
  Settlement,
  Silo,
  WorkshopUpgrades,
  GameSettings,
  WaveTally,
  Difficulty,
  GameMode
} from "./types";

export interface HudState {
  score: number;
  highScore: number;
  embers: number;
  wave: number;
  combo: number;
  slowTimeCharges: number;
  slowTimeActive: boolean;
  slowTimeRemaining: number;
  silos: Array<{ id: number; shells: number; maxShells: number; disabled: boolean }>;
  settlementsAlive: number;
  shardsRemaining: number;
  fps: number;
}

export class CinderSkyEngine {
  // Virtual Coordinate Space (Fixed Aspect Ratio 3:2)
  public static readonly VIRTUAL_WIDTH = 1200;
  public static readonly VIRTUAL_HEIGHT = 800;
  public static readonly FIXED_DT = 1 / 60; // 60 FPS fixed physics step

  // Mutable Game Entities (Plain Object State Outside React)
  public settlements: Settlement[] = [];
  public silos: Silo[] = [];
  public shards: Shard[] = [];
  public shells: FlakShell[] = [];
  public blasts: Blast[] = [];
  public particles: SparkParticle[] = [];

  // Core Game State
  public score: number = 0;
  public highScore: number = 0;
  public embers: number = 0;
  public wave: number = 1;
  public combo: number = 1;
  public mode: GameMode = "standard";
  public seedString: string = "";

  // Mechanics State
  public slowTimeCharges: number = 1;
  public slowTimeActive: boolean = false;
  public slowTimeTimer: number = 0; // seconds remaining in slow time
  public nextSettlementScoreThreshold: number = 10000;
  public isPaused: boolean = false;
  public isGameOver: boolean = false;
  public mouseTarget = {
    x: 600,
    y: 350,
    active: false,
    chosenSiloIndex: undefined as number | undefined
  };

  public updateMouseTarget(x: number, y: number, active: boolean, chosenSiloIndex?: number) {
    this.mouseTarget.x = x;
    this.mouseTarget.y = y;
    this.mouseTarget.active = active;
    this.mouseTarget.chosenSiloIndex = chosenSiloIndex;
  }
  public inWave: boolean = false;

  // Wave Spawner State
  private totalShardsForWave: number = 0;
  private shardsSpawnedSoFar: number = 0;
  private spawnCooldown: number = 0;
  private prng: SeededPRNG;
  private nextEntityId: number = 1;

  // Upgrades & Settings
  public upgrades: WorkshopUpgrades = {
    blastRadiusLevel: 0,
    shellSpeedLevel: 0,
    ammoLevel: 0,
    slowTimeChargesLevel: 0
  };

  public settings: GameSettings = {
    soundEnabled: true,
    difficulty: "normal",
    reducedMotion: false,
    colorblindSafe: false
  };

  public audio: SoundSynthesizer;

  // Render & Timing
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private accumulator: number = 0;
  private currentFps: number = 60;
  private frameCount: number = 0;
  private fpsTimer: number = 0;

  // Callbacks to React (only invoked on significant events)
  public onHudUpdate?: (hud: HudState) => void;
  public onWaveComplete?: (tally: WaveTally) => void;
  public onGameOver?: (score: number, wave: number, embers: number) => void;
  public onSettlementRebuilt?: (id: number) => void;

  constructor(seed?: string) {
    this.seedString = seed || `CINDER_${Date.now()}`;
    this.prng = new SeededPRNG(this.seedString);
    this.audio = new SoundSynthesizer(this.settings.soundEnabled);
    this.initWorld();
  }

  public initWorld() {
    // 6 Settlements nestled in valleys
    const settlementX = [230, 360, 480, 720, 840, 970];
    this.settlements = settlementX.map((x, idx) => ({
      id: idx,
      x,
      y: 755,
      alive: true,
      lanternPhase: Math.random() * Math.PI * 2
    }));

    // 3 Silos: Left (100), Center (600), Right (1100)
    const baseAmmo = 10 + this.upgrades.ammoLevel * 2;
    this.silos = [
      { id: 0, x: 100, y: 750, shells: baseAmmo, maxShells: baseAmmo, disabled: false, isCenterFast: false },
      { id: 1, x: 600, y: 750, shells: baseAmmo, maxShells: baseAmmo, disabled: false, isCenterFast: true },
      { id: 2, x: 1100, y: 750, shells: baseAmmo, maxShells: baseAmmo, disabled: false, isCenterFast: false }
    ];

    this.shards = [];
    this.shells = [];
    this.blasts = [];
    this.particles = [];
    this.combo = 1;
  }

  public attachCanvas(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.startLoop();
  }

  public detachCanvas() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.canvas = null;
    this.ctx = null;
  }

  public setSettings(newSettings: Partial<GameSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.audio.setEnabled(this.settings.soundEnabled);
  }

  // Starts a new game run
  public startNewGame(mode: GameMode = "standard", customSeed?: string) {
    this.mode = mode;
    this.seedString = customSeed || (mode === "daily" ? `DAILY_${new Date().toISOString().slice(0, 10)}` : `RUN_${Date.now()}`);
    this.prng = new SeededPRNG(this.seedString);

    this.score = 0;
    this.embers = 0;
    this.wave = 1;
    this.combo = 1;
    this.nextSettlementScoreThreshold = 10000;
    this.isGameOver = false;
    this.isPaused = false;

    this.upgrades = {
      blastRadiusLevel: 0,
      shellSpeedLevel: 0,
      ammoLevel: 0,
      slowTimeChargesLevel: 0
    };

    this.initWorld();
    this.startWave(1);
  }

  // Begins wave N
  public startWave(waveNum: number) {
    this.wave = waveNum;
    this.inWave = true;
    this.combo = 1;

    // Reset and replenish silos
    const maxAmmo = 10 + this.upgrades.ammoLevel * 2;
    this.silos.forEach((s) => {
      s.disabled = false;
      s.maxShells = maxAmmo;
      s.shells = maxAmmo;
    });

    // Slow time charges
    this.slowTimeCharges = 1 + this.upgrades.slowTimeChargesLevel;
    this.slowTimeActive = false;
    this.slowTimeTimer = 0;

    // Calculate wave shard counts based on difficulty
    const diffMultiplier = this.settings.difficulty === "easy" ? 0.8 : this.settings.difficulty === "hard" ? 1.3 : 1.0;
    this.totalShardsForWave = Math.round((6 + 2 * this.wave) * diffMultiplier);
    this.shardsSpawnedSoFar = 0;
    this.spawnCooldown = 0.5; // initial half-second calm

    this.shards = [];
    this.shells = [];
    this.blasts = [];
    this.particles = [];

    this.emitHud();
  }

  // Player action: Fire flak shell
  public fireShell(targetX: number, targetY: number, forcedSiloIndex?: number): boolean {
    if (this.isPaused || this.isGameOver || !this.inWave) return false;
    if (targetY > CinderSkyEngine.VIRTUAL_HEIGHT - 60) { this.audio.playDryFire(); return false; } // Don't fire below silo line

    // Audio unlock on interaction
    this.audio.initContext();

    let chosenSilo: Silo | null = null;

    if (forcedSiloIndex !== undefined && forcedSiloIndex >= 0 && forcedSiloIndex <= 2) {
      const s = this.silos[forcedSiloIndex];
      if (!s.disabled && s.shells > 0) {
        chosenSilo = s;
      } else {
        this.audio.playDryFire();
        return false;
      }
    }

    if (!chosenSilo) {
      // Find closest active silo with shells
      let bestDist = Infinity;
      for (const s of this.silos) {
        if (!s.disabled && s.shells > 0) {
          const dist = Math.hypot(s.x - targetX, s.y - targetY);
          if (dist < bestDist) {
            bestDist = dist;
            chosenSilo = s;
          }
        }
      }
    }

    if (!chosenSilo) return false;

    // Decrement ammo
    chosenSilo.shells--;

    // Speed calculation (+15% per upgrade level, center silo is 40% faster)
    const baseSpeed = 420; // virtual pixels per second
    const upgradeFactor = 1 + this.upgrades.shellSpeedLevel * 0.15;
    const centerFactor = chosenSilo.isCenterFast ? 1.4 : 1.0;
    const travelDist = Math.hypot(chosenSilo.x - targetX, chosenSilo.y - targetY);
    const speed = ((baseSpeed * upgradeFactor * centerFactor) / Math.max(1, travelDist));

    this.shells.push({
      id: this.nextEntityId++,
      siloIndex: chosenSilo.id,
      startX: chosenSilo.x,
      startY: chosenSilo.y,
      x: chosenSilo.x,
      y: chosenSilo.y,
      targetX,
      targetY,
      progress: 0,
      speed
    });

    this.audio.playLaunch(chosenSilo.isCenterFast);
    this.emitHud();
    return true;
  }

  // Player action: Trigger Slow Time
  public togglePause(): boolean {
    if (this.isGameOver || !this.inWave) return false;
    this.isPaused = !this.isPaused;
    this.emitHud();
    return this.isPaused;
  }

  public triggerSlowTime(): boolean {
    if (this.isPaused || this.isGameOver || !this.inWave) return false;
    if (this.slowTimeCharges <= 0 || this.slowTimeActive) return false;

    this.slowTimeCharges--;
    this.slowTimeActive = true;
    this.slowTimeTimer = 3.0; // 3 seconds at 30% speed
    this.audio.playSlowTime(true);
    this.emitHud();
    return true;
  }

  // Spawns a meteor shard
  private spawnShard(customType?: ShardType, customX?: number, customY?: number) {
    const type: ShardType = customType || this.pickShardTypeForWave();
    const startX = customX !== undefined ? customX : this.prng.rangeFloat(80, CinderSkyEngine.VIRTUAL_WIDTH - 80);
    const startY = customY !== undefined ? customY : 0;

    // Pick target: living settlement or silo
    const livingSettlements = this.settlements.filter((s) => s.alive);
    const availableTargets: Array<{ x: number; y: number }> = [];

    livingSettlements.forEach((s) => availableTargets.push({ x: s.x, y: s.y }));
    this.silos.forEach((s) => {
      if (!s.disabled) availableTargets.push({ x: s.x, y: s.y });
    });

    let targetX = CinderSkyEngine.VIRTUAL_WIDTH * 0.5;
    let targetY = CinderSkyEngine.VIRTUAL_HEIGHT - 35;

    if (availableTargets.length > 0) {
      const chosen = availableTargets[this.prng.rangeInt(0, availableTargets.length - 1)];
      targetX = chosen.x;
      targetY = chosen.y;
    }

    // Base speed scaling: 1 + 0.05 * wave (capped at 2.5)
    const waveSpeedFactor = Math.min(2.5, 1 + 0.05 * this.wave);
    const diffSpeed = this.settings.difficulty === "easy" ? 0.8 : this.settings.difficulty === "hard" ? 1.3 : 1.0;

    let baseSpeed = 48; // px / sec
    let color = "#fb923c"; // warm orange
    let splitTrigger: number | undefined = undefined;

    if (type === "streak") {
      baseSpeed = 105;
      color = "#f43f5e";
    } else if (type === "splitter") {
      baseSpeed = 55;
      color = "#f59e0b";
      splitTrigger = CinderSkyEngine.VIRTUAL_HEIGHT * 0.5; // mid altitude
    } else if (type === "cluster_core") {
      baseSpeed = 38;
      color = "#a855f7";
      splitTrigger = CinderSkyEngine.VIRTUAL_HEIGHT * 0.4; // 40% altitude
    } else if (type === "glider") {
      baseSpeed = 65;
      color = "#06b6d4";
    }

    this.shards.push({
      id: this.nextEntityId++,
      type,
      startX,
      startY,
      x: startX,
      y: startY,
      targetX,
      targetY,
      speed: baseSpeed * waveSpeedFactor * diffSpeed,
      splitTriggerAltitude: splitTrigger,
      hasSplit: false,
      wobblePhase: this.prng.rangeFloat(0, Math.PI * 2),
      color: this.settings.colorblindSafe ? "#38bdf8" : color,
      trail: []
    });

    this.shardsSpawnedSoFar++;
  }

  private pickShardTypeForWave(): ShardType {
    if (this.wave >= 10 && this.prng.chance(0.2)) {
      return "glider";
    }
    if (this.wave >= 6 && this.prng.chance(0.2)) {
      return "cluster_core";
    }
    if (this.wave >= 3 && this.prng.chance(0.28)) {
      return "splitter";
    }
    if (this.prng.chance(0.35)) {
      return "streak";
    }
    return "pebble";
  }

  // Detonates a flak shell or shard chain reaction
  private createBlast(x: number, y: number, isChain: boolean = false) {
    const baseRadius = 55 * (1 + this.upgrades.blastRadiusLevel * 0.1);
    const radius = isChain ? baseRadius * 0.65 : baseRadius;

    this.blasts.push({
      id: this.nextEntityId++,
      x,
      y,
      radius: 4,
      maxRadius: radius,
      phase: "growing",
      phaseTimer: 0,
      isChain,
      comboCount: this.combo,
      color: this.settings.colorblindSafe ? "#38bdf8" : "#67e8f9"
    });

    this.audio.playBlast();
  }

  // Spawn visual sparks/particles
  private spawnSparks(x: number, y: number, count: number, color: string) {
    if (this.settings.reducedMotion) count = Math.min(count, 3);
    for (let i = 0; i < count; i++) {
      const angle = this.prng.rangeFloat(0, Math.PI * 2);
      const speed = this.prng.rangeFloat(30, 160);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.35 + this.prng.rangeFloat(0, 0.25),
        maxLife: 0.6,
        color,
        size: this.prng.rangeFloat(1.5, 3.5)
      });
    }
  }

  // Fixed-timestep simulation update (called at 60 Hz)
  public updatePhysics(dt: number) {
    if (this.isPaused || this.isGameOver || !this.inWave) return;

    // Handle Slow Time Modifier (30% speed)
    let effectiveDt = dt;
    if (this.slowTimeActive) {
      effectiveDt = dt * 0.3;
      this.slowTimeTimer -= dt;
      if (this.slowTimeTimer <= 0) {
        this.slowTimeActive = false;
        this.audio.playSlowTime(false);
      }
    }

    // 1. Spawner Logic
    if (this.shardsSpawnedSoFar < this.totalShardsForWave) {
      this.spawnCooldown -= effectiveDt;
      if (this.spawnCooldown <= 0) {
        this.spawnShard();
        // Spread spawn over time
        const interval = Math.max(0.4, 2.2 - this.wave * 0.08);
        this.spawnCooldown = this.prng.rangeFloat(interval * 0.6, interval * 1.4);
      }
    }

    // 2. Update In-Flight Shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.progress += s.speed * effectiveDt;
      s.x = s.startX + (s.targetX - s.startX) * s.progress;
      s.y = s.startY + (s.targetY - s.startY) * s.progress;

      if (s.progress >= 1.0) {
        this.createBlast(s.targetX, s.targetY, false);
        this.shells.splice(i, 1);
      }
    }

    // 3. Update Blasts (0.4s grow, 0.15s hold, 0.4s shrink)
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      b.phaseTimer += dt; // blast duration runs in real time, not slowed

      if (b.phase === "growing") {
        const t = Math.min(1, b.phaseTimer / 0.4);
        b.radius = 4 + (b.maxRadius - 4) * t;
        if (b.phaseTimer >= 0.4) {
          b.phase = "holding";
          b.phaseTimer = 0;
        }
      } else if (b.phase === "holding") {
        b.radius = b.maxRadius;
        if (b.phaseTimer >= 0.15) {
          b.phase = "shrinking";
          b.phaseTimer = 0;
        }
      } else if (b.phase === "shrinking") {
        const t = Math.min(1, b.phaseTimer / 0.4);
        b.radius = b.maxRadius * (1 - t);
        if (b.phaseTimer >= 0.4 || b.radius <= 1) {
          this.blasts.splice(i, 1);
          continue;
        }
      }

      // Check collision between Blast and Meteor Shards
      for (let sIdx = this.shards.length - 1; sIdx >= 0; sIdx--) {
        const sh = this.shards[sIdx];
        const dist = Math.hypot(sh.x - b.x, sh.y - b.y);
        if (dist <= b.radius) {
          // Shard Destroyed!
          this.destroyShard(sh, sIdx, true);
        }
      }
    }

    // 4. Update Meteor Shards
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];

      // Record trail
      sh.trail.unshift({ x: sh.x, y: sh.y, alpha: 0.8 });
      if (sh.trail.length > 12) sh.trail.pop();
      sh.trail.forEach((t) => (t.alpha -= effectiveDt * 1.5));

      const dx = sh.targetX - sh.startX;
      const dy = sh.targetY - sh.startY;
      const totalDist = Math.hypot(dx, dy);

      if (sh.type === "glider") {
        sh.wobblePhase = (sh.wobblePhase || 0) + effectiveDt * 3.5;
        const vx = (dx / totalDist) * sh.speed;
        const vy = (dy / totalDist) * sh.speed;
        sh.x += vx * effectiveDt + Math.sin(sh.wobblePhase) * 60 * effectiveDt;
        sh.y += vy * effectiveDt;
      } else {
        const vx = (dx / totalDist) * sh.speed;
        const vy = (dy / totalDist) * sh.speed;
        sh.x += vx * effectiveDt;
        sh.y += vy * effectiveDt;
      }

      // Altitude Trigger Splits
      if (!sh.hasSplit && sh.splitTriggerAltitude && sh.y >= sh.splitTriggerAltitude) {
        sh.hasSplit = true;
        if (sh.type === "splitter") {
          // Split into 2-3 pebbles
          const count = this.prng.rangeInt(2, 3);
          for (let k = 0; k < count; k++) {
            this.spawnShard("pebble", sh.x + (k - 1) * 20, sh.y);
          }
          this.shards.splice(i, 1);
          continue;
        } else if (sh.type === "cluster_core") {
          // Split into 4 streaks
          for (let k = 0; k < 4; k++) {
            this.spawnShard("streak", sh.x + (k - 1.5) * 25, sh.y);
          }
          this.shards.splice(i, 1);
          continue;
        }
      }

      // Ground Impact Check (Altitude 750)
      if (sh.y >= CinderSkyEngine.VIRTUAL_HEIGHT - 45 || sh.x < -100 || sh.x > CinderSkyEngine.VIRTUAL_WIDTH + 100) {
        this.handleGroundImpact(sh);
        this.shards.splice(i, 1);
      }
    }

    // 5. Update Particle Sparks
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * effectiveDt;
      p.y += p.vy * effectiveDt;
      p.life -= effectiveDt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 6. Check Settlement Rebuild Threshold (every 10,000 points)
    if (this.score >= this.nextSettlementScoreThreshold) {
      const deadSettlement = this.settlements.find((s) => !s.alive);
      if (deadSettlement) {
        deadSettlement.alive = true;
        this.onSettlementRebuilt?.(deadSettlement.id);
      }
      this.nextSettlementScoreThreshold += 10000;
    }

    // 7. Check Wave Completion
    if (
      this.shardsSpawnedSoFar >= this.totalShardsForWave &&
      this.shards.length === 0 &&
      this.shells.length === 0 &&
      this.blasts.length === 0
    ) {
      this.finishWave();
    }
  }

  // Destroys a shard via blast, triggers chain blast & score calculation
  private destroyShard(sh: Shard, shardIndex: number, isFlakHit: boolean) {
    this.shards.splice(shardIndex, 1);

    // Score = base * combo
    const basePoints = sh.type === "cluster_core" ? 250 : sh.type === "streak" ? 150 : 100;
    const gained = basePoints * this.combo;
    this.score += gained;
    this.embers += Math.max(1, Math.floor(gained / 50));

    if (this.score > this.highScore) this.highScore = this.score;

    this.audio.playComboKill(this.combo);
    this.spawnSparks(sh.x, sh.y, 12, sh.color);

    // Trigger Chain Reaction Blast
    this.createBlast(sh.x, sh.y, true);

    // Increment Combo Counter
    this.combo++;

    this.emitHud();
  }

  // Shard reaches ground: check if settlement or silo is hit
  private handleGroundImpact(sh: Shard) {
    this.spawnSparks(sh.x, sh.y, 16, "#ef4444");
    this.audio.playSettlementLoss();

    // Reset combo counter on missed impact
    this.combo = 1;

    // Check Settlements
    let hitSettlement = false;
    for (const s of this.settlements) {
      if (s.alive && Math.abs(s.x - sh.x) <= 35) {
        s.alive = false;
        hitSettlement = true;
        this.createBlast(s.x, s.y - 10, false);
        break;
      }
    }

    // Check Silos
    if (!hitSettlement) {
      for (const b of this.silos) {
        if (!b.disabled && Math.abs(b.x - sh.x) <= 45) {
          b.disabled = true;
          b.shells = 0;
          this.createBlast(b.x, b.y, false);
          break;
        }
      }
    }

    // Check Game Over: all 6 settlements destroyed
    if (this.settlements.every((s) => !s.alive)) {
      this.isGameOver = true;
      this.inWave = false;
      this.onGameOver?.(this.score, this.wave, this.embers);
    }

    this.emitHud();
  }

  // Wave clear calculations
  private finishWave() {
    this.inWave = false;

    const livingCount = this.settlements.filter((s) => s.alive).length;
    const remainingAmmo = this.silos.reduce((sum, s) => sum + s.shells, 0);

    // Scoring & Embers conversion
    const settlementBonusScore = livingCount * 500;
    const ammoBonusScore = remainingAmmo * 10;
    const waveScore = settlementBonusScore + ammoBonusScore;

    const settlementEmbers = livingCount * 50;
    const ammoEmbers = remainingAmmo * 2;
    const waveEmbers = settlementEmbers + ammoEmbers;

    this.score += waveScore;
    this.embers += waveEmbers;
    if (this.score > this.highScore) this.highScore = this.score;

    const tally: WaveTally = {
      wave: this.wave,
      settlementsSaved: livingCount,
      ammoRemaining: remainingAmmo,
      waveScore,
      embersEarned: waveEmbers,
      totalScore: this.score,
      totalEmbers: this.embers
    };

    this.onWaveComplete?.(tally);
    this.emitHud();
  }

  // Rebuilds one settlement in the workshop
  public rebuildOneSettlement(): boolean {
    const dead = this.settlements.find((s) => !s.alive);
    if (!dead) return false;
    if (this.embers < 500) return false;

    this.embers -= 500;
    dead.alive = true;
    this.emitHud();
    return true;
  }

  // Purchases workshop upgrade
  public purchaseUpgrade(type: keyof WorkshopUpgrades): boolean {
    const levelKey = type;
    const currentLvl = this.upgrades[levelKey];
    const prices: Record<string, number[]> = {
      blastRadiusLevel: [150, 300, 600, 1100, 1800],
      shellSpeedLevel: [120, 260, 500, 950, 1600],
      ammoLevel: [140, 280, 550, 1000, 1700],
      slowTimeChargesLevel: [300, 750, 1500]
    };

    const maxLvl = prices[levelKey]?.length || 5;
    if (currentLvl >= maxLvl) return false;

    const cost = prices[levelKey][currentLvl];
    if (this.embers < cost) return false;

    this.embers -= cost;
    this.upgrades[levelKey]++;
    this.emitHud();
    return true;
  }

  private emitHud() {
    if (!this.onHudUpdate) return;
    this.onHudUpdate({
      score: this.score,
      highScore: this.highScore,
      embers: this.embers,
      wave: this.wave,
      combo: this.combo,
      slowTimeCharges: this.slowTimeCharges,
      slowTimeActive: this.slowTimeActive,
      slowTimeRemaining: Math.max(0, parseFloat(this.slowTimeTimer.toFixed(1))),
      silos: this.silos.map((s) => ({ id: s.id, shells: s.shells, maxShells: s.maxShells, disabled: s.disabled })),
      settlementsAlive: this.settlements.filter((s) => s.alive).length,
      shardsRemaining: Math.max(0, this.totalShardsForWave - this.shardsSpawnedSoFar + this.shards.length),
      fps: this.currentFps
    });
  }

  // Main Render Loop (Canvas drawing)
  private startLoop() {
    this.lastTimestamp = performance.now();
    this.fpsTimer = performance.now();
    this.frameCount = 0;

    const loop = (now: number) => {
      const rawDeltaSec = (now - this.lastTimestamp) / 1000;
      this.lastTimestamp = now;

      // FPS tracking
      this.frameCount++;
      if (now - this.fpsTimer >= 500) {
        this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsTimer));
        this.frameCount = 0;
        this.fpsTimer = now;
      }

      // Fixed-timestep accumulator (Crucial requirement from spec)
      this.accumulator += Math.min(rawDeltaSec, 0.1);
      while (this.accumulator >= CinderSkyEngine.FIXED_DT) {
        this.updatePhysics(CinderSkyEngine.FIXED_DT);
        this.accumulator -= CinderSkyEngine.FIXED_DT;
      }

      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  // Draw code-generated vector scene (Zero external image assets)
  private render() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const W = CinderSkyEngine.VIRTUAL_WIDTH;
    const H = CinderSkyEngine.VIRTUAL_HEIGHT;

    // Reset transform & scale to canvas dimensions
    const scaleX = this.canvas.width / W;
    const scaleY = this.canvas.height / H;
    ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

    // 1. Deep Indigo Night Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, "#070a1a");
    skyGrad.addColorStop(0.65, "#0f162e");
    skyGrad.addColorStop(1, "#181f3d");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Slow Time Overlay Tint
    if (this.slowTimeActive) {
      ctx.fillStyle = "rgba(6, 182, 212, 0.08)";
      ctx.fillRect(0, 0, W, H);
    }

    // Distant Stars (Code drawn)
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    const starCoords = [
      [120, 80], [340, 60], [510, 110], [780, 50], [920, 95], [1110, 75],
      [220, 180], [440, 150], [680, 200], [890, 170], [1040, 190], [160, 250],
      [590, 280], [820, 260]
    ];
    for (const [sx, sy] of starCoords) {
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    // 2. Jagged Dark Mountain Valley Silhouettes
    ctx.fillStyle = "#090d1e";
    ctx.beginPath();
    ctx.moveTo(0, H - 90);
    ctx.lineTo(80, H - 180);
    ctx.lineTo(190, H - 120);
    ctx.lineTo(320, H - 210);
    ctx.lineTo(460, H - 140);
    ctx.lineTo(600, H - 240);
    ctx.lineTo(760, H - 130);
    ctx.lineTo(890, H - 220);
    ctx.lineTo(1050, H - 150);
    ctx.lineTo(1140, H - 200);
    ctx.lineTo(W, H - 110);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Forefront Valley Terrain
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.lineTo(120, H - 55);
    ctx.lineTo(280, H - 45);
    ctx.lineTo(450, H - 50);
    ctx.lineTo(600, H - 65);
    ctx.lineTo(750, H - 48);
    ctx.lineTo(920, H - 52);
    ctx.lineTo(1080, H - 60);
    ctx.lineTo(W, H - 42);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();

    // Valley Horizon Glow Line
    ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, H - 40);
    ctx.lineTo(120, H - 55);
    ctx.lineTo(280, H - 45);
    ctx.lineTo(450, H - 50);
    ctx.lineTo(600, H - 65);
    ctx.lineTo(750, H - 48);
    ctx.lineTo(920, H - 52);
    ctx.lineTo(1080, H - 60);
    ctx.lineTo(W, H - 42);
    ctx.stroke();

    // 3. Draw Settlements (Simple lantern-lit alpine huts)
    const timeSec = performance.now() / 1000;
    this.settlements.forEach((s) => {
      if (s.alive) {
        // Hut base
        ctx.fillStyle = "#1f2937";
        ctx.fillRect(s.x - 18, s.y - 18, 36, 18);

        // Hut A-frame roof
        ctx.fillStyle = "#374151";
        ctx.beginPath();
        ctx.moveTo(s.x - 22, s.y - 18);
        ctx.lineTo(s.x, s.y - 32);
        ctx.lineTo(s.x + 22, s.y - 18);
        ctx.closePath();
        ctx.fill();

        // Warm Glowing Lantern Window
        const pulse = 0.7 + 0.3 * Math.sin(timeSec * 3 + s.lanternPhase);
        ctx.fillStyle = `rgba(251, 191, 36, ${pulse})`;
        ctx.fillRect(s.x - 6, s.y - 12, 12, 10);

        // Warm Window Glare
        const rad = ctx.createRadialGradient(s.x, s.y - 7, 2, s.x, s.y - 7, 24);
        rad.addColorStop(0, `rgba(251, 191, 36, ${pulse * 0.4})`);
        rad.addColorStop(1, "rgba(251, 191, 36, 0)");
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(s.x, s.y - 7, 24, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Destroyed Settlement Ruins
        ctx.fillStyle = "#4b5563";
        ctx.fillRect(s.x - 12, s.y - 6, 24, 6);
        ctx.fillStyle = "#374151";
        ctx.fillRect(s.x - 6, s.y - 10, 8, 4);
      }
    });

    // 4. Draw Interceptor Silos (Left, Center, Right)
    this.silos.forEach((silo) => {
      // Silo Concrete Emplacement
      ctx.fillStyle = silo.disabled ? "#374151" : "#1e293b";
      ctx.beginPath();
      ctx.arc(silo.x, silo.y + 4, 28, Math.PI, 0);
      ctx.fill();

      // Launch Tube Turret
      ctx.fillStyle = silo.disabled ? "#1f2937" : silo.isCenterFast ? "#0ea5e9" : "#6366f1";
      ctx.beginPath();
      ctx.arc(silo.x, silo.y - 4, 14, Math.PI, 0);
      ctx.fill();

      // Ammo Status Lights
      const ammoFraction = silo.shells / silo.maxShells;
      ctx.fillStyle = silo.disabled ? "#ef4444" : ammoFraction > 0.35 ? "#10b981" : ammoFraction > 0 ? "#f59e0b" : "#ef4444";
      ctx.beginPath();
      ctx.arc(silo.x, silo.y - 12, 4, 0, Math.PI * 2);
      ctx.fill();

      // Silo Ammo Counter Text
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 13px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(silo.disabled ? "OFFLINE" : `${silo.shells}`, silo.x, silo.y + 22);
    });

    // 5. Draw Shard Trails & Meteor Shards
    this.shards.forEach((sh) => {
      // Glowing Trail
      if (sh.trail.length > 1) {
        ctx.strokeStyle = sh.color;
        ctx.lineWidth = sh.type === "streak" ? 1.5 : 2.5;
        ctx.beginPath();
        ctx.moveTo(sh.trail[0].x, sh.trail[0].y);
        for (let t = 1; t < sh.trail.length; t++) {
          ctx.lineTo(sh.trail[t].x, sh.trail[t].y);
        }
        ctx.stroke();
      }

      // Hot Meteor Core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.type === "streak" ? 2.5 : 4, 0, Math.PI * 2);
      ctx.fill();

      // Shard Corona Glow
      ctx.strokeStyle = sh.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, sh.type === "streak" ? 4.5 : 7, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 6. Draw Flak Shells In Flight
    this.shells.forEach((sh) => {
      // Trajectory Line
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sh.startX, sh.startY);
      ctx.lineTo(sh.x, sh.y);
      ctx.stroke();

      // Interceptor Shell Head
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(sh.x, sh.y, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Target Crosshair
      ctx.strokeStyle = "rgba(56, 189, 248, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(sh.targetX - 5, sh.targetY - 5, 10, 10);
    });

    // 7. Draw Blasts (Expanding, Holding, Shrinking with Shockwaves)
    this.blasts.forEach((b) => {
      const alpha = b.phase === "shrinking" ? b.radius / b.maxRadius : 0.85;

      // Outer Shockwave Ring
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Radial Glowing Body
      const blastGrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius);
      blastGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`);
      blastGrad.addColorStop(0.35, `rgba(103, 232, 249, ${alpha * 0.65})`);
      blastGrad.addColorStop(1, `rgba(6, 182, 212, 0)`);
      ctx.fillStyle = blastGrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      // Chain Combo Indicator Text (if chained)
      if (b.isChain && b.comboCount > 1) {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 13px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`x${b.comboCount}`, b.x, b.y - b.radius - 4);
      }
    });

    // 8. Draw Spark Particles
    this.particles.forEach((p) => {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;

    // 9. Draw Mouse Targeting Pointer Crosshair & Trajectory Guide Line
    if (this.mouseTarget.active && !this.isGameOver) {
      const mx = this.mouseTarget.x;
      const my = this.mouseTarget.y;
      const isValidAltitude = my <= CinderSkyEngine.VIRTUAL_HEIGHT - 60;

      // Determine which silo will fire towards this target
      let primedSilo: Silo | null = null;
      if (this.mouseTarget.chosenSiloIndex !== undefined) {
        const s = this.silos[this.mouseTarget.chosenSiloIndex];
        if (!s.disabled && s.shells > 0) primedSilo = s;
      }
      if (!primedSilo && this.mouseTarget.chosenSiloIndex === undefined) {
        let bestDist = Infinity;
        for (const s of this.silos) {
          if (!s.disabled && s.shells > 0) {
            const dist = Math.hypot(s.x - mx, s.y - my);
            if (dist < bestDist) {
              bestDist = dist;
              primedSilo = s;
            }
          }
        }
      }

      // 9a. Trajectory Guide Line from Primed Silo
      if (primedSilo && isValidAltitude) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        const guideColor = primedSilo.isCenterFast
          ? "rgba(14, 165, 233, 0.45)"
          : primedSilo.id === 0
          ? "rgba(99, 102, 241, 0.45)"
          : "rgba(168, 85, 247, 0.45)";
        ctx.strokeStyle = guideColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(primedSilo.x, primedSilo.y - 12);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.restore();
      }

      // 9b. Vector Missile Crosshair Reticle
      ctx.save();
      const reticleColor = !isValidAltitude
        ? "#ef4444"
        : primedSilo
        ? (this.settings.colorblindSafe ? "#38bdf8" : "#22d3ee")
        : "#f59e0b";

      // Outer Ring
      ctx.strokeStyle = reticleColor;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      ctx.arc(mx, my, 14, 0, Math.PI * 2);
      ctx.stroke();

      // Cardinal Tick Marks
      ctx.beginPath();
      ctx.moveTo(mx, my - 14);
      ctx.lineTo(mx, my - 21);
      ctx.moveTo(mx, my + 14);
      ctx.lineTo(mx, my + 21);
      ctx.moveTo(mx - 14, my);
      ctx.lineTo(mx - 21, my);
      ctx.moveTo(mx + 14, my);
      ctx.lineTo(mx + 21, my);
      ctx.stroke();

      // Center Aim Dot
      ctx.fillStyle = reticleColor;
      ctx.beginPath();
      ctx.arc(mx, my, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Tactical Readout Label next to Reticle
      let baseLabel = "NO AMMO";
      if (!isValidAltitude) {
        baseLabel = "LOW CEILING";
      } else if (primedSilo) {
        const baseName = primedSilo.id === 0 ? "BASE 1 [L]" : primedSilo.id === 1 ? "BASE 2 [FAST]" : "BASE 3 [R]";
        baseLabel = `${baseName} (${primedSilo.shells})`;
      } else if (this.mouseTarget.chosenSiloIndex !== undefined) {
        baseLabel = `BASE ${this.mouseTarget.chosenSiloIndex + 1} EMPTY`;
      }
      ctx.fillStyle = reticleColor;
      ctx.font = "bold 11px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(baseLabel, mx + 18, my - 5);

      ctx.restore();
    }
  }
}
