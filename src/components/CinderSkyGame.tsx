"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Flame,
  Shield,
  Zap,
  Volume2,
  VolumeX,
  Play,
  Calendar,
  Trophy,
  Settings as SettingsIcon,
  RotateCcw,
  Pause,
  ArrowRight,
  Sparkles,
  Eye,
  AlertTriangle,
  X,
  Check,
  ChevronRight,
  Keyboard,
  MousePointer,
  HelpCircle,
  Crosshair,
  Target
} from "lucide-react";
import { CinderSkyEngine, HudState } from "@/game/engine";
import { GameMode, Difficulty, WaveTally, HighScoreRecord, WORKSHOP_PRICES, WorkshopUpgrades } from "@/game/types";
import { getDailySeedString } from "@/game/prng";
import {
  loadSettings,
  saveSettings,
  loadHighScores,
  recordHighScore,
  loadDailyRecord,
  clearAllStoredScores
} from "@/game/storage";

type ScreenState = "title" | "playing" | "tally" | "workshop" | "game_over" | "scores" | "settings" | "controls";

export function CinderSkyGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CinderSkyEngine | null>(null);
  const mousePosRef = useRef<{ x: number; y: number; onCanvas: boolean }>({ x: 600, y: 350, onCanvas: false });

  // High-level UI screens
  const [screen, setScreen] = useState<ScreenState>("title");
  const [gameMode, setGameMode] = useState<GameMode>("standard");
  const [dailySeed, setDailySeed] = useState<string>("");
  const [dailyRecord, setDailyRecord] = useState<{ score: number; wave: number } | null>(null);
  const [autoCountdown, setAutoCountdown] = useState<number>(4);

  // HUD State (updated on major events / throttled)
  const [hud, setHud] = useState<HudState>({
    score: 0,
    highScore: 0,
    embers: 0,
    wave: 1,
    combo: 1,
    slowTimeCharges: 1,
    slowTimeActive: false,
    slowTimeRemaining: 0,
    silos: [
      { id: 0, shells: 10, maxShells: 10, disabled: false },
      { id: 1, shells: 10, maxShells: 10, disabled: false },
      { id: 2, shells: 10, maxShells: 10, disabled: false }
    ],
    settlementsAlive: 6,
    shardsRemaining: 0,
    fps: 60
  });

  // Tally & Game Over states
  const [tally, setTally] = useState<WaveTally | null>(null);
  const [gameOverStats, setGameOverStats] = useState<{ score: number; wave: number; embers: number; isNewHigh: boolean } | null>(null);
  const [highScores, setHighScores] = useState<HighScoreRecord[]>([]);

  // Settings & Controls
  const [settings, setSettingsState] = useState(loadSettings());
  const [forcedSilo, setForcedSilo] = useState<number | undefined>(undefined);
  const [isPaused, setIsPaused] = useState(false);

  // Sync forced silo selection with engine mouse target
  useEffect(() => {
    engineRef.current?.updateMouseTarget(
      mousePosRef.current.x,
      mousePosRef.current.y,
      mousePosRef.current.onCanvas,
      forcedSilo
    );
  }, [forcedSilo]);

  // Launch Next Wave handler (Memoized for timers and key events)
  const handleLaunchNextWave = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.startWave(engine.wave + 1);
    setScreen("playing");
  }, []);

  // Auto-advance countdown from Tally screen to next wave (Frictionless arcade progression)
  useEffect(() => {
    if (screen !== "tally") return;
    setAutoCountdown(4);

    const interval = setInterval(() => {
      setAutoCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleLaunchNextWave();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [screen, tally, handleLaunchNextWave]);

  // Initialize engine and persistent data
  useEffect(() => {
    const loadedSettings = loadSettings();
    setSettingsState(loadedSettings);
    setHighScores(loadHighScores());

    const todaySeed = getDailySeedString();
    setDailySeed(todaySeed);
    setDailyRecord(loadDailyRecord(todaySeed));

    const engine = new CinderSkyEngine(todaySeed);
    engineRef.current = engine;
    engine.setSettings(loadedSettings);

    engine.onHudUpdate = (newHud) => {
      setHud({ ...newHud });
      setIsPaused(engine.isPaused);
    };

    engine.onWaveComplete = (waveTally) => {
      setTally(waveTally);
      setScreen("tally");
    };

    engine.onGameOver = (score, wave, embers) => {
      const isNewHigh = recordHighScore(score, wave, engine.mode, engine.seedString);
      setGameOverStats({ score, wave, embers, isNewHigh });
      setHighScores(loadHighScores());
      setScreen("game_over");
    };

    if (canvasRef.current) {
      engine.attachCanvas(canvasRef.current);
    }

    return () => {
      engine.detachCanvas();
      engineRef.current = null;
    };
  }, []);

  // Keyboard controls: 1/2/3 to choose/fire base, 0/A for auto, Space for Slow Time / Continue, P/Esc for Pause, H for Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      // When on Tally or Workshop screen: Space or Enter immediately launches next wave
      if (screen === "tally") {
        if (e.code === "Space" || e.key === "Enter") {
          e.preventDefault();
          handleLaunchNextWave();
          return;
        }
        if (e.key === "w" || e.key === "W") {
          e.preventDefault();
          setScreen("workshop");
          return;
        }
      }

      if (screen === "workshop") {
        if (e.code === "Space" || e.key === "Enter") {
          e.preventDefault();
          handleLaunchNextWave();
          return;
        }
      }

      // Base 1: Left Silo
      if (e.key === "1") {
        e.preventDefault();
        setForcedSilo(0);
        engine.updateMouseTarget(mousePosRef.current.x, mousePosRef.current.y, mousePosRef.current.onCanvas, 0);
        if (screen === "playing" && !engine.isPaused && mousePosRef.current.onCanvas) {
          engine.fireShell(mousePosRef.current.x, mousePosRef.current.y, 0);
        }
      }
      // Base 2: Center Fast Silo
      else if (e.key === "2") {
        e.preventDefault();
        setForcedSilo(1);
        engine.updateMouseTarget(mousePosRef.current.x, mousePosRef.current.y, mousePosRef.current.onCanvas, 1);
        if (screen === "playing" && !engine.isPaused && mousePosRef.current.onCanvas) {
          engine.fireShell(mousePosRef.current.x, mousePosRef.current.y, 1);
        }
      }
      // Base 3: Right Silo
      else if (e.key === "3") {
        e.preventDefault();
        setForcedSilo(2);
        engine.updateMouseTarget(mousePosRef.current.x, mousePosRef.current.y, mousePosRef.current.onCanvas, 2);
        if (screen === "playing" && !engine.isPaused && mousePosRef.current.onCanvas) {
          engine.fireShell(mousePosRef.current.x, mousePosRef.current.y, 2);
        }
      }
      // Auto / Nearest Base
      else if (e.key === "0" || e.key === "a" || e.key === "A") {
        e.preventDefault();
        setForcedSilo(undefined);
        engine.updateMouseTarget(mousePosRef.current.x, mousePosRef.current.y, mousePosRef.current.onCanvas, undefined);
      }
      // Slow Time
      else if (e.code === "Space") {
        e.preventDefault();
        if (screen === "playing" && !engine.isPaused) {
          engine.triggerSlowTime();
        }
      }
      // Pause Toggle
      else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        if (screen === "playing") {
          const paused = engine.togglePause();
          setIsPaused(paused);
        } else if (screen === "controls") {
          setScreen("playing");
        }
      }
      // Help / Controls modal
      else if (e.key === "h" || e.key === "H" || e.key === "?" || e.key === "c" || e.key === "C") {
        e.preventDefault();
        setScreen((prev) => (prev === "controls" ? "playing" : "controls"));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screen, handleLaunchNextWave]);

  // Pointer Movement: Continuous Mouse Reticle Tracking
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CinderSkyEngine.VIRTUAL_WIDTH / rect.width;
    const scaleY = CinderSkyEngine.VIRTUAL_HEIGHT / rect.height;

    const targetX = (e.clientX - rect.left) * scaleX;
    const targetY = (e.clientY - rect.top) * scaleY;

    mousePosRef.current = { x: targetX, y: targetY, onCanvas: true };
    engine.updateMouseTarget(targetX, targetY, true, forcedSilo);
  };

  const handlePointerLeave = () => {
    mousePosRef.current.onCanvas = false;
    engineRef.current?.updateMouseTarget(600, 350, false, forcedSilo);
  };

  // Canvas click / touch handler to fire flak shell
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas || screen !== "playing" || engine.isPaused) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CinderSkyEngine.VIRTUAL_WIDTH / rect.width;
    const scaleY = CinderSkyEngine.VIRTUAL_HEIGHT / rect.height;

    const targetX = (e.clientX - rect.left) * scaleX;
    const targetY = (e.clientY - rect.top) * scaleY;

    mousePosRef.current = { x: targetX, y: targetY, onCanvas: true };
    engine.fireShell(targetX, targetY, forcedSilo);
    engine.updateMouseTarget(targetX, targetY, true, forcedSilo);
  };

  // Start Standard Game
  const handleStartStandard = () => {
    const engine = engineRef.current;
    if (!engine) return;
    setGameMode("standard");
    engine.startNewGame("standard");
    setScreen("playing");
    setIsPaused(false);
  };

  // Start Daily Run
  const handleStartDaily = () => {
    const engine = engineRef.current;
    if (!engine) return;
    setGameMode("daily");
    engine.startNewGame("daily", dailySeed);
    setScreen("playing");
    setIsPaused(false);
  };

  // Workshop Purchases
  const handleUpgrade = (type: keyof WorkshopUpgrades) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.purchaseUpgrade(type);
    setHud({ ...hud, embers: engine.embers });
  };

  const handleRebuildSettlement = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.rebuildOneSettlement();
    setHud({
      ...hud,
      embers: engine.embers,
      settlementsAlive: engine.settlements.filter((s) => s.alive).length
    });
  };

  // Setting update helper
  const handleUpdateSetting = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    const updated = { ...settings, [key]: value };
    setSettingsState(updated);
    saveSettings(updated);
    engineRef.current?.setSettings(updated);
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050711] text-slate-100 flex flex-col items-center justify-between p-2 md:p-6 font-mono select-none overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="w-full max-w-[1200px] flex items-center justify-between px-4 py-2 border-b border-cyan-950/60 bg-[#080d1e]/80 backdrop-blur-md rounded-t-xl">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <h1 className="text-lg md:text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-300">
            CINDER SKY
          </h1>
          <span className="hidden sm:inline-block text-xs uppercase px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/40 text-cyan-300">
            Arcade Defense
          </span>
        </div>

        <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm">
          {screen === "playing" && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded text-amber-300">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>{hud.embers} EMBERS</span>
            </div>
          )}

          {/* Controls & Help Guide Button */}
          <button
            onClick={() => setScreen("controls")}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-cyan-700/60 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-xs font-bold transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            title="Controls & Tactical Guide [H]"
          >
            <Keyboard className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">CONTROLS</span>
            <span className="text-[10px] opacity-70">[H]</span>
          </button>

          <button
            onClick={() => handleUpdateSetting("soundEnabled", !settings.soundEnabled)}
            className="p-1.5 rounded-lg border border-cyan-900/40 bg-slate-900/60 hover:bg-cyan-950/80 text-cyan-300 transition-colors"
            title={settings.soundEnabled ? "Mute Synthesizer" : "Unmute Synthesizer"}
          >
            {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={() => setScreen("settings")}
            className="p-1.5 rounded-lg border border-cyan-900/40 bg-slate-900/60 hover:bg-cyan-950/80 text-cyan-300 transition-colors"
            title="Settings"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Game Screen Stage */}
      <main className="relative w-full max-w-[1200px] flex-1 flex flex-col items-center justify-center my-2">
        <div className="relative w-full aspect-[3/2] max-h-[800px] rounded-b-xl overflow-hidden border border-cyan-900/40 shadow-[0_0_50px_rgba(6,182,212,0.15)] bg-[#070a1a]">
          {/* Hardware Accelerated Canvas with continuous mouse tracking */}
          <canvas
            ref={canvasRef}
            width={1200}
            height={800}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onPointerDown={handleCanvasPointerDown}
            className="w-full h-full block cursor-crosshair touch-none"
          />

          {/* HUD Overlay (Only visible in 'playing' state) */}
          {screen === "playing" && (
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 md:p-6">
              {/* Top HUD Row */}
              <div className="flex items-start justify-between w-full">
                {/* Score & Combo */}
                <div className="flex flex-col gap-1">
                  <div className="text-xl md:text-3xl font-black tracking-widest text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {hud.score.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] md:text-xs text-slate-400 uppercase tracking-wider">
                      HIGH: {hud.highScore.toLocaleString()}
                    </span>
                    {hud.combo > 1 && (
                      <span className="text-xs md:text-sm font-bold px-2 py-0.5 rounded bg-amber-500/20 border border-amber-400 text-amber-300 animate-bounce shadow-[0_0_10px_#f59e0b]">
                        x{hud.combo} COMBO
                      </span>
                    )}
                  </div>
                </div>

                {/* Wave Badge & Quick Tactical Hint */}
                <div className="flex flex-col items-center">
                  <div className="px-4 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-xs md:text-sm font-bold tracking-widest uppercase shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                    {gameMode === "daily" ? `DAILY RUN • WAVE ${hud.wave}` : `WAVE ${hud.wave}`}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">
                    {hud.shardsRemaining} Shards Inbound • <strong className="text-cyan-400">Aim with Mouse</strong>
                  </span>
                </div>

                {/* Slow Time Button & Pause */}
                <div className="flex items-center gap-2 pointer-events-auto">
                  <button
                    onClick={() => engineRef.current?.triggerSlowTime()}
                    disabled={hud.slowTimeCharges <= 0 || hud.slowTimeActive}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                      hud.slowTimeActive
                        ? "bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_15px_#22d3ee] animate-pulse"
                        : hud.slowTimeCharges > 0
                        ? "bg-cyan-950/80 border-cyan-600 text-cyan-200 hover:bg-cyan-900/90 hover:scale-105"
                        : "bg-slate-900/60 border-slate-800 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span>SLOW TIME ({hud.slowTimeCharges})</span>
                    <span className="hidden sm:inline-block text-[10px] opacity-75">[SPACE]</span>
                  </button>

                  <button
                    onClick={() => {
                      const paused = engineRef.current?.togglePause();
                      setIsPaused(!!paused);
                    }}
                    className="p-1.5 rounded-lg border border-cyan-900/60 bg-slate-900/80 hover:bg-cyan-950 text-cyan-300"
                    title="Pause [P]"
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom HUD: Silo Ammo Selectors & Settlements */}
              <div className="flex items-end justify-between w-full pointer-events-auto">
                {/* Silos Interactive Controls with explicit 1/2/3 Keyboard number badges */}
                <div className="flex items-center gap-2 md:gap-3">
                  {hud.silos.map((silo, idx) => {
                    const isSelected = forcedSilo === idx;
                    const isCenter = idx === 1;
                    return (
                      <button
                        key={silo.id}
                        onClick={() => setForcedSilo(idx)}
                        disabled={silo.disabled || silo.shells <= 0}
                        className={`flex flex-col items-center px-3 py-1.5 rounded-lg border text-left transition-all relative ${
                          silo.disabled
                            ? "bg-red-950/40 border-red-900/40 text-red-400 opacity-60"
                            : isSelected
                            ? "bg-cyan-500/25 border-cyan-300 text-cyan-100 ring-2 ring-cyan-400 shadow-[0_0_15px_#38bdf8] scale-105"
                            : "bg-slate-900/85 border-cyan-900/50 text-slate-300 hover:border-cyan-500/70"
                        }`}
                        title={`Choose Missile Base ${idx + 1} (Press [${idx + 1}] on keyboard)`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
                          <span className={`px-1.5 py-0.2 rounded font-black text-xs ${isSelected ? "bg-cyan-400 text-slate-950" : "bg-cyan-950 text-cyan-300 border border-cyan-700/60"}`}>
                            [{idx + 1}]
                          </span>
                          <span className="font-bold">{isCenter ? "FAST CENTER" : idx === 0 ? "LEFT BASE" : "RIGHT BASE"}</span>
                          {isSelected && <span className="text-[9px] text-amber-300 font-bold ml-1 animate-pulse">• ACTIVE</span>}
                        </div>
                        <div className="text-sm md:text-base font-extrabold mt-0.5">
                          {silo.disabled ? "OFFLINE" : `${silo.shells} / ${silo.maxShells}`}
                        </div>
                      </button>
                    );
                  })}

                  {/* Auto Nearest Base Selector */}
                  <button
                    onClick={() => setForcedSilo(undefined)}
                    className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg border text-left transition-all ${
                      forcedSilo === undefined
                        ? "bg-emerald-950/40 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400/50 shadow-[0_0_10px_#10b981]"
                        : "bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                    title="Automatically fire from nearest silo with ammo (Press [A] or [0])"
                  >
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="px-1 rounded bg-slate-800 text-emerald-400 font-bold">[A]</span>
                      <span>AUTO</span>
                    </div>
                    <span className="text-[11px] font-bold">NEAREST</span>
                  </button>
                </div>

                {/* Settlements Indicator */}
                <div className="hidden sm:flex flex-col items-end">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
                    Settlements Alive ({hud.settlementsAlive}/6)
                  </div>
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-sm border transition-all ${
                          i < hud.settlementsAlive
                            ? "bg-amber-400 border-amber-300 shadow-[0_0_6px_#fbbf24]"
                            : "bg-slate-800 border-slate-700 opacity-30"
                        }`}
                        title={i < hud.settlementsAlive ? "Settlement standing" : "Settlement destroyed"}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pause Modal Overlay */}
          {screen === "playing" && isPaused && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20">
              <div className="w-full max-w-sm p-6 rounded-2xl bg-[#0b1226] border border-cyan-800/60 text-center shadow-2xl">
                <h2 className="text-2xl font-bold tracking-wider text-cyan-300 mb-2">TACTICAL PAUSE</h2>
                <p className="text-xs text-slate-400 mb-6">Simulation suspended. Press P or Esc to resume.</p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      engineRef.current?.togglePause();
                      setIsPaused(false);
                    }}
                    className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm tracking-wider transition-all"
                  >
                    RESUME DEFENSE
                  </button>
                  <button
                    onClick={() => setScreen("controls")}
                    className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-sm font-semibold transition-all"
                  >
                    VIEW CONTROLS GUIDE
                  </button>
                  <button
                    onClick={() => {
                      engineRef.current?.startNewGame(gameMode, gameMode === "daily" ? dailySeed : undefined);
                      setIsPaused(false);
                    }}
                    className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 text-sm font-semibold transition-all"
                  >
                    RESTART RUN
                  </button>
                  <button
                    onClick={() => setScreen("title")}
                    className="w-full py-2.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-800/40 text-red-300 text-sm font-semibold transition-all"
                  >
                    ABORT TO MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TITLE SCREEN MODAL OVERLAY */}
          {screen === "title" && (
            <div className="absolute inset-0 bg-gradient-to-b from-[#070a1a]/95 via-[#0b1226]/90 to-[#070a1a]/95 flex flex-col items-center justify-center p-4 md:p-8 z-20 text-center backdrop-blur-sm">
              <div className="max-w-md w-full flex flex-col items-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800/60 text-cyan-300 text-xs font-semibold uppercase mb-3 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Meteor Defense Simulation
                </div>

                <h1 className="text-4xl md:text-5xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-300 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] mb-2">
                  CINDER SKY
                </h1>
                <p className="text-xs md:text-sm text-slate-400 max-w-sm mb-5 leading-relaxed">
                  Meteor shards rain onto the valley. Control the missile pointer with your mouse, choose bases with keyboard numbers, and detonate flak interceptors.
                </p>

                <div className="w-full flex flex-col gap-3 mb-5">
                  <button
                    onClick={handleStartStandard}
                    className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:scale-[1.02]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    DEFEND VALLEY (STANDARD)
                  </button>

                  <button
                    onClick={handleStartDaily}
                    className="w-full py-3 px-6 rounded-xl bg-[#111e38] hover:bg-[#16274a] border border-cyan-500/40 text-cyan-300 font-bold text-sm tracking-wider uppercase flex items-center justify-between transition-all hover:scale-[1.01]"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" />
                      <span>DAILY SEEDED RUN</span>
                    </div>
                    <span className="text-[10px] text-amber-300/80">
                      {dailyRecord ? `BEST: ${dailyRecord.score}` : "NEW"}
                    </span>
                  </button>

                  {/* Prominent Controls Button */}
                  <button
                    onClick={() => setScreen("controls")}
                    className="w-full py-2.5 px-4 rounded-xl bg-cyan-950/70 hover:bg-cyan-900/90 border border-cyan-600/50 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  >
                    <Keyboard className="w-4 h-4 text-cyan-400" />
                    <span>CONTROLS & TACTICAL MANUAL</span>
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setScreen("scores")}
                      className="py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      HIGH SCORES
                    </button>
                    <button
                      onClick={() => setScreen("settings")}
                      className="py-2.5 px-4 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <SettingsIcon className="w-3.5 h-3.5 text-cyan-400" />
                      SETTINGS
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-center gap-2 bg-slate-900/70 px-4 py-1.5 rounded-full border border-slate-800">
                  <span className="text-cyan-400 font-bold">Mouse:</span> Aim • <span className="text-cyan-400 font-bold">1/2/3:</span> Choose & Fire Base • <span className="text-cyan-400 font-bold">Space:</span> Slow Time
                </div>
              </div>
            </div>
          )}

          {/* CONTROLS & FLIGHT MANUAL MODAL */}
          {screen === "controls" && (
            <div className="absolute inset-0 bg-[#070a1a]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-6 z-30 overflow-y-auto">
              <div className="max-w-lg w-full p-6 rounded-2xl bg-[#0c142b] border border-cyan-600/70 shadow-[0_0_35px_rgba(6,182,212,0.3)]">
                <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Keyboard className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-lg font-bold tracking-wider text-cyan-300">TACTICAL CONTROLS & MANUAL</h2>
                  </div>
                  <button onClick={() => setScreen(hud.wave > 1 || hud.score > 0 ? "playing" : "title")} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs text-left mb-6">
                  {/* Mouse Pointer Control */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-900/60">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm mb-1">
                      <MousePointer className="w-4 h-4 text-cyan-400" />
                      <span>Aiming the Missile Pointer</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Move your <strong>mouse</strong> over the sky. A glowing vector reticle follows your cursor, displaying altitude, active base status, and a dashed trajectory projection line.
                    </p>
                    <div className="mt-2 text-[11px] text-cyan-400 font-semibold">
                      • Left Click fires an interceptor shell to your exact pointer coordinates.
                    </div>
                  </div>

                  {/* Choosing Bases with 1, 2, 3 */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-900/60">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-sm mb-1">
                      <Target className="w-4 h-4 text-cyan-400" />
                      <span>Choosing Missile Bases (Keyboard Numbers)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                      <div className="p-2 rounded bg-slate-950/80 border border-indigo-500/40">
                        <div className="text-indigo-400 font-black text-sm">[1] LEFT BASE</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Wide left coverage. Press <strong>1</strong> to select & fire.</div>
                      </div>
                      <div className="p-2 rounded bg-slate-950/80 border border-cyan-500/40">
                        <div className="text-cyan-400 font-black text-sm">[2] CENTER BASE</div>
                        <div className="text-[10px] text-slate-400 mt-0.5"><strong>+40% Fast Shells!</strong> Press <strong>2</strong> to select & fire.</div>
                      </div>
                      <div className="p-2 rounded bg-slate-950/80 border border-purple-500/40">
                        <div className="text-purple-400 font-black text-sm">[3] RIGHT BASE</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Wide right coverage. Press <strong>3</strong> to select & fire.</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-slate-400">
                      Press <strong>[A]</strong> or <strong>[0]</strong> at any time for <strong>Auto Nearest Base</strong> mode.
                    </div>
                  </div>

                  {/* Special Abilities */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1">
                        <Zap className="w-4 h-4 text-amber-400" />
                        <span>Slow Time [SPACE]</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        3-second tactical dilation at 30% speed. Essential for cluster cores and gliders!
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold mb-1">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>Chain Combos</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Shards destroyed in blasts trigger secondary bursts. Score = Base Kill x Combo Multiplier!
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setScreen(hud.wave > 1 || hud.score > 0 ? "playing" : "title")}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-sm tracking-wider uppercase shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                >
                  {hud.wave > 1 || hud.score > 0 ? "RESUME BATTLE" : "GOT IT, READY TO DEFEND"}
                </button>
              </div>
            </div>
          )}

          {/* WAVE CLEAR TALLY SCREEN (With Auto-Advance & Direct Continue Button) */}
          {screen === "tally" && tally && (
            <div className="absolute inset-0 bg-[#070a1a]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-6 z-20">
              <div className="max-w-md w-full p-6 md:p-8 rounded-2xl bg-[#0c142b] border border-cyan-600/70 shadow-[0_0_35px_rgba(6,182,212,0.3)] text-center">
                <div className="inline-block px-3 py-1 rounded-full bg-cyan-950 border border-cyan-500 text-cyan-300 text-xs font-bold uppercase mb-2">
                  WAVE {tally.wave} SECURED
                </div>
                <h2 className="text-3xl font-black text-white tracking-widest mb-3">VALLEY SURVIVED</h2>

                <div className="space-y-2 mb-4 text-sm text-left">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Settlements Protected ({tally.settlementsSaved} x 500)</span>
                    <span className="font-bold text-cyan-300">+{tally.settlementsSaved * 500} PTS</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800">
                    <span className="text-slate-400">Unused Interceptor Ammo ({tally.ammoRemaining} x 10)</span>
                    <span className="font-bold text-cyan-300">+{tally.ammoRemaining * 10} PTS</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40 text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <Flame className="w-4 h-4 text-amber-400" /> Embers Harvested
                    </span>
                    <span className="font-bold">+{tally.embersEarned} EMBERS</span>
                  </div>
                </div>

                {/* Auto Countdown Pill */}
                <div className="flex items-center justify-center gap-2 mb-4 text-xs text-cyan-300 bg-cyan-950/60 border border-cyan-800/60 py-1.5 px-3 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Launching Wave {tally.wave + 1} in <strong>{autoCountdown}s</strong></span>
                </div>

                {/* Direct Action Buttons */}
                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={handleLaunchNextWave}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all hover:scale-[1.02]"
                  >
                    <span>CONTINUE TO WAVE {tally.wave + 1}</span>
                    <span className="text-xs bg-slate-950/30 px-1.5 py-0.5 rounded font-bold">[SPACE]</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setScreen("workshop")}
                    className="w-full py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-800/50 text-amber-300 font-bold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all"
                  >
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>VISIT WORKSHOP (UPGRADES & REPAIRS)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* WORKSHOP MODAL */}
          {screen === "workshop" && engineRef.current && (
            <div className="absolute inset-0 bg-[#070a1a]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-6 z-20 overflow-y-auto">
              <div className="max-w-lg w-full p-5 md:p-6 rounded-2xl bg-[#0c142b] border border-cyan-600/70 shadow-2xl flex flex-col max-h-[92%]">
                <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3 mb-3">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold tracking-wider text-cyan-300">VALLEY WORKSHOP</h2>
                    <p className="text-[11px] text-slate-400">Upgrade defense grid before Wave {engineRef.current.wave + 1}</p>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs">
                      <Flame className="w-3.5 h-3.5 text-amber-400" />
                      <span>{hud.embers} EMB</span>
                    </div>
                    {/* Header Quick Launch Button */}
                    <button
                      onClick={handleLaunchNextWave}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1 shadow-[0_0_10px_#22d3ee] transition-all"
                      title="Launch Next Wave (Press Space)"
                    >
                      <span>LAUNCH [SPACE]</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Upgrade Items List */}
                <div className="space-y-2.5 mb-4 overflow-y-auto flex-1 pr-1">
                  {/* 1. Blast Radius */}
                  {(() => {
                    const lvl = engineRef.current.upgrades.blastRadiusLevel;
                    const max = 5;
                    const price = WORKSHOP_PRICES.blastRadius[lvl];
                    const canAfford = price !== undefined && hud.embers >= price;
                    return (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div>
                          <div className="text-xs md:text-sm font-bold text-slate-200">Flak Blast Radius (+10%)</div>
                          <div className="text-[11px] text-slate-400">Expands blast interception radius (Lvl {lvl}/{max})</div>
                        </div>
                        <button
                          onClick={() => handleUpgrade("blastRadiusLevel")}
                          disabled={lvl >= max || !canAfford}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            lvl >= max
                              ? "bg-slate-800 text-slate-500 border border-slate-700"
                              : canAfford
                              ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_8px_#22d3ee]"
                              : "bg-slate-800 text-slate-500 border border-slate-700 opacity-60"
                          }`}
                        >
                          {lvl >= max ? "MAXED" : `${price} EMB`}
                        </button>
                      </div>
                    );
                  })()}

                  {/* 2. Shell Speed */}
                  {(() => {
                    const lvl = engineRef.current.upgrades.shellSpeedLevel;
                    const max = 5;
                    const price = WORKSHOP_PRICES.shellSpeed[lvl];
                    const canAfford = price !== undefined && hud.embers >= price;
                    return (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div>
                          <div className="text-xs md:text-sm font-bold text-slate-200">Shell Flight Speed (+15%)</div>
                          <div className="text-[11px] text-slate-400">Flak shells detonate sooner (Lvl {lvl}/{max})</div>
                        </div>
                        <button
                          onClick={() => handleUpgrade("shellSpeedLevel")}
                          disabled={lvl >= max || !canAfford}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            lvl >= max
                              ? "bg-slate-800 text-slate-500 border border-slate-700"
                              : canAfford
                              ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_8px_#22d3ee]"
                              : "bg-slate-800 text-slate-500 border border-slate-700 opacity-60"
                          }`}
                        >
                          {lvl >= max ? "MAXED" : `${price} EMB`}
                        </button>
                      </div>
                    );
                  })()}

                  {/* 3. Ammo Capacity */}
                  {(() => {
                    const lvl = engineRef.current.upgrades.ammoLevel;
                    const max = 5;
                    const price = WORKSHOP_PRICES.ammo[lvl];
                    const canAfford = price !== undefined && hud.embers >= price;
                    return (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div>
                          <div className="text-xs md:text-sm font-bold text-slate-200">Silo Ammo Capacity (+2 / silo)</div>
                          <div className="text-[11px] text-slate-400">Stores more shells per wave (Lvl {lvl}/{max})</div>
                        </div>
                        <button
                          onClick={() => handleUpgrade("ammoLevel")}
                          disabled={lvl >= max || !canAfford}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            lvl >= max
                              ? "bg-slate-800 text-slate-500 border border-slate-700"
                              : canAfford
                              ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_8px_#22d3ee]"
                              : "bg-slate-800 text-slate-500 border border-slate-700 opacity-60"
                          }`}
                        >
                          {lvl >= max ? "MAXED" : `${price} EMB`}
                        </button>
                      </div>
                    );
                  })()}

                  {/* 4. Slow Time Charges */}
                  {(() => {
                    const lvl = engineRef.current.upgrades.slowTimeChargesLevel;
                    const max = 3;
                    const price = WORKSHOP_PRICES.slowTime[lvl];
                    const canAfford = price !== undefined && hud.embers >= price;
                    return (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div>
                          <div className="text-xs md:text-sm font-bold text-slate-200">Extra Slow Time Charge (+1)</div>
                          <div className="text-[11px] text-slate-400">Extra 3-second tactical dilation (Lvl {lvl}/{max})</div>
                        </div>
                        <button
                          onClick={() => handleUpgrade("slowTimeChargesLevel")}
                          disabled={lvl >= max || !canAfford}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            lvl >= max
                              ? "bg-slate-800 text-slate-500 border border-slate-700"
                              : canAfford
                              ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_8px_#22d3ee]"
                              : "bg-slate-800 text-slate-500 border border-slate-700 opacity-60"
                          }`}
                        >
                          {lvl >= max ? "MAXED" : `${price} EMB`}
                        </button>
                      </div>
                    );
                  })()}

                  {/* 5. Rebuild Settlement */}
                  {(() => {
                    const hasDead = engineRef.current.settlements.some((s) => !s.alive);
                    const price = WORKSHOP_PRICES.rebuildSettlement;
                    const canAfford = hud.embers >= price;
                    return (
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                        <div>
                          <div className="text-xs md:text-sm font-bold text-slate-200">Reconstruct Settlement</div>
                          <div className="text-[11px] text-slate-400">Restore one lost valley settlement</div>
                        </div>
                        <button
                          onClick={handleRebuildSettlement}
                          disabled={!hasDead || !canAfford}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            !hasDead
                              ? "bg-slate-800 text-slate-500 border border-slate-700"
                              : canAfford
                              ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-[0_0_8px_#f59e0b]"
                              : "bg-slate-800 text-slate-500 border border-slate-700 opacity-60"
                          }`}
                        >
                          {!hasDead ? "ALL STANDING" : `${price} EMB`}
                        </button>
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom Launch Button */}
                <button
                  onClick={handleLaunchNextWave}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all hover:scale-[1.02]"
                >
                  <span>LAUNCH WAVE {engineRef.current.wave + 1}</span>
                  <span className="text-xs bg-slate-950/30 px-1.5 py-0.5 rounded font-bold">[SPACE]</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* GAME OVER SCREEN */}
          {screen === "game_over" && gameOverStats && (
            <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20 text-center">
              <div className="max-w-md w-full p-6 md:p-8 rounded-2xl bg-[#140a12] border border-red-700/60 shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/60 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>
                <h2 className="text-3xl font-black text-white tracking-widest mb-1">VALLEY OVERRUN</h2>
                <p className="text-xs text-red-300/80 mb-6">All settlements destroyed by meteor shards.</p>

                <div className="space-y-3 mb-6">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 text-sm">Final Score</span>
                    <span className="text-xl font-black text-white">{gameOverStats.score.toLocaleString()}</span>
                  </div>

                  {gameOverStats.isNewHigh && (
                    <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-[0_0_10px_#f59e0b]">
                      <Sparkles className="w-4 h-4" /> NEW ALL-TIME HIGH SCORE!
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
                      Wave Reached: <strong className="text-cyan-400">{gameOverStats.wave}</strong>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
                      Embers Gathered: <strong className="text-amber-400">{gameOverStats.embers}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={gameMode === "daily" ? handleStartDaily : handleStartStandard}
                    className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                  >
                    RETRY DEFENSE
                  </button>
                  <button
                    onClick={() => setScreen("title")}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* HIGH SCORES MODAL */}
          {screen === "scores" && (
            <div className="absolute inset-0 bg-[#070a1a]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-6 z-20">
              <div className="max-w-md w-full p-6 rounded-2xl bg-[#0c142b] border border-cyan-700/60 shadow-2xl flex flex-col max-h-[90%]">
                <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    <h2 className="text-lg font-bold tracking-wider text-cyan-300">VALLEY LEADERBOARD</h2>
                  </div>
                  <button onClick={() => setScreen("title")} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 pr-1 mb-4">
                  {highScores.length === 0 ? (
                    <div className="text-xs text-slate-400 text-center py-8">No recorded scores yet. Defend the valley!</div>
                  ) : (
                    highScores.map((rec, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                          i === 0
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                            : "bg-slate-900/60 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 font-bold text-center text-slate-500">#{i + 1}</span>
                          <div>
                            <div className="font-bold">{rec.score.toLocaleString()} PTS</div>
                            <div className="text-[10px] text-slate-400">Wave {rec.wave} • {rec.date}</div>
                          </div>
                        </div>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                          {rec.mode}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <button
                    onClick={() => {
                      clearAllStoredScores();
                      setHighScores([]);
                    }}
                    className="text-red-400 hover:text-red-300"
                  >
                    Reset Scores
                  </button>
                  <button
                    onClick={() => setScreen("title")}
                    className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS MODAL */}
          {screen === "settings" && (
            <div className="absolute inset-0 bg-[#070a1a]/95 backdrop-blur-md flex flex-col items-center justify-center p-4 md:p-6 z-20">
              <div className="max-w-md w-full p-6 rounded-2xl bg-[#0c142b] border border-cyan-700/60 shadow-2xl">
                <div className="flex items-center justify-between border-b border-cyan-900/60 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-cyan-400" />
                    <h2 className="text-lg font-bold tracking-wider text-cyan-300">DEFENSE SETTINGS</h2>
                  </div>
                  <button onClick={() => setScreen("title")} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 mb-6 text-sm">
                  {/* Sound FX */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">Audio Synthesizer</div>
                      <div className="text-xs text-slate-400">Pure Web Audio API (No files)</div>
                    </div>
                    <button
                      onClick={() => handleUpdateSetting("soundEnabled", !settings.soundEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.soundEnabled ? "bg-cyan-500" : "bg-slate-800"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          settings.soundEnabled ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <div className="font-semibold text-slate-200 mb-1">Difficulty Preset</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["easy", "normal", "hard"] as Difficulty[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => handleUpdateSetting("difficulty", d)}
                          className={`py-1.5 rounded-lg text-xs uppercase font-bold border transition-all ${
                            settings.difficulty === d
                              ? "bg-cyan-500 border-cyan-400 text-slate-950"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Reduced Motion */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">Reduced Motion</div>
                      <div className="text-xs text-slate-400">Minimizes shockwave screen jitter</div>
                    </div>
                    <button
                      onClick={() => handleUpdateSetting("reducedMotion", !settings.reducedMotion)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.reducedMotion ? "bg-cyan-500" : "bg-slate-800"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          settings.reducedMotion ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Colorblind Safe */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-200">Colorblind-Safe Palette</div>
                      <div className="text-xs text-slate-400">High-contrast cyan & amber trails</div>
                    </div>
                    <button
                      onClick={() => handleUpdateSetting("colorblindSafe", !settings.colorblindSafe)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${
                        settings.colorblindSafe ? "bg-cyan-500" : "bg-slate-800"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          settings.colorblindSafe ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => setScreen("title")}
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm tracking-wider uppercase"
                >
                  SAVE & CLOSE
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer System Specs & Direct Controls Summary Bar */}
      <footer className="w-full max-w-[1200px] flex flex-wrap items-center justify-between px-4 py-2 text-[11px] text-slate-400 border-t border-cyan-950/40 gap-2">
        <div className="flex items-center gap-2 md:gap-4 flex-wrap">
          <span className="text-cyan-300 font-semibold flex items-center gap-1">
            <MousePointer className="w-3.5 h-3.5" /> Aim: Mouse
          </span>
          <span>•</span>
          <span className="text-cyan-300 font-semibold flex items-center gap-1">
            <Keyboard className="w-3.5 h-3.5" /> Bases: Keys [1] [2] [3]
          </span>
          <span>•</span>
          <span className="text-slate-300">Auto: [A]</span>
          <span>•</span>
          <span className="text-slate-300">Slow Time: [Space]</span>
          <span>•</span>
          <span className="text-slate-300">Pause: [P]</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScreen("controls")}
            className="text-cyan-400 hover:underline flex items-center gap-1 font-bold"
          >
            <HelpCircle className="w-3.5 h-3.5" /> Controls Guide
          </button>
          <span>•</span>
          <span>Seed: <span className="text-cyan-400">{dailySeed}</span></span>
        </div>
      </footer>
    </div>
  );
}
