"use client";

import React, { useEffect, useRef, useState } from "react";
import { Shield, Zap, X, RotateCcw, Volume2, VolumeX, Crosshair, Award } from "lucide-react";

interface Missile {
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  color: string;
}

interface Interceptor {
  startX: number;
  startY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
}

interface Explosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  expanding: boolean;
  color: string;
  alpha: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export function MissileCanvasDefense({ onClose }: { onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(1450);
  const [wave, setWave] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fps, setFps] = useState(60);
  const [frameLatencyMs, setFrameLatencyMs] = useState(11.4);

  // Audio Context (Synthesizer for retro sounds without external asset dependencies)
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSynthSound = (type: "launch" | "explode" | "city_hit") => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === "launch") {
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.12);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === "explode") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "city_hit") {
        osc.type = "square";
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(20, now + 0.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    let height = (canvas.height = 480);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        height = canvas.height = 480;
      }
    };
    window.addEventListener("resize", handleResize);

    // Defense Bases & Cities
    let cities = [
      { x: width * 0.15, alive: true },
      { x: width * 0.25, alive: true },
      { x: width * 0.35, alive: true },
      { x: width * 0.65, alive: true },
      { x: width * 0.75, alive: true },
      { x: width * 0.85, alive: true }
    ];

    let batteries = [
      { x: width * 0.06, y: height - 20, missiles: 15 },
      { x: width * 0.5, y: height - 20, missiles: 20 },
      { x: width * 0.94, y: height - 20, missiles: 15 }
    ];

    let incomingMissiles: Missile[] = [];
    let interceptors: Interceptor[] = [];
    let explosions: Explosion[] = [];
    let particles: Particle[] = [];

    let lastSpawn = performance.now();
    let currentWave = 1;
    let waveMissilesSpawned = 0;
    const missilesPerWave = 15;
    let currentScore = 0;
    let isRunning = true;
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsTimer = performance.now();

    const spawnEnemyMissile = () => {
      const startX = Math.random() * width;
      const startY = 0;
      // Target either a city or battery
      const livingCities = cities.filter((c) => c.alive);
      let targetX = width * 0.5;
      if (livingCities.length > 0 && Math.random() < 0.7) {
        const c = livingCities[Math.floor(Math.random() * livingCities.length)];
        targetX = c.x;
      } else {
        const b = batteries[Math.floor(Math.random() * batteries.length)];
        targetX = b.x;
      }

      const speed = 0.6 + currentWave * 0.25 + Math.random() * 0.3;
      incomingMissiles.push({
        startX,
        startY,
        x: startX,
        y: startY,
        targetX,
        targetY: height - 20,
        speed,
        color: Math.random() > 0.3 ? "#ef4444" : "#f59e0b"
      });
      waveMissilesSpawned++;
    };

    // User Click: Launch Interceptor from closest battery with ammo
    const handleCanvasClick = (e: MouseEvent) => {
      if (!isRunning) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Don't fire below batteries
      if (clickY > height - 40) return;

      // Find closest battery with ammo
      let bestBattery = -1;
      let minDist = Infinity;
      batteries.forEach((b, idx) => {
        if (b.missiles > 0) {
          const dist = Math.hypot(b.x - clickX, b.y - clickY);
          if (dist < minDist) {
            minDist = dist;
            bestBattery = idx;
          }
        }
      });

      if (bestBattery !== -1) {
        batteries[bestBattery].missiles--;
        interceptors.push({
          startX: batteries[bestBattery].x,
          startY: batteries[bestBattery].y,
          x: batteries[bestBattery].x,
          y: batteries[bestBattery].y,
          targetX: clickX,
          targetY: clickY,
          progress: 0,
          speed: 0.04
        });
        playSynthSound("launch");
      }
    };

    canvas.addEventListener("click", handleCanvasClick);

    // Animation Loop (Sub-16ms target)
    let animationId: number;

    const renderLoop = (now: number) => {
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      frameCount++;

      if (now - fpsTimer >= 500) {
        setFps(Math.round((frameCount * 1000) / (now - fpsTimer)));
        setFrameLatencyMs(parseFloat(delta.toFixed(1)));
        frameCount = 0;
        fpsTimer = now;
      }

      // Clear Canvas with Tactical Radar Fade
      ctx.fillStyle = "rgba(10, 13, 20, 0.4)";
      ctx.fillRect(0, 0, width, height);

      // Radar Grid Lines
      ctx.strokeStyle = "rgba(16, 185, 129, 0.06)";
      ctx.lineWidth = 1;
      for (let y = 60; y < height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      for (let x = 80; x < width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Ground Landscape
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, height - 20, width, 20);
      ctx.fillStyle = "#10b981";
      ctx.fillRect(0, height - 20, width, 2);

      // Draw Cities
      cities.forEach((c) => {
        if (c.alive) {
          ctx.fillStyle = "#06b6d4";
          ctx.fillRect(c.x - 14, height - 28, 28, 8);
          ctx.fillRect(c.x - 8, height - 36, 16, 8);
          ctx.fillRect(c.x - 3, height - 42, 6, 6);
        } else {
          ctx.fillStyle = "#475569";
          ctx.fillRect(c.x - 10, height - 23, 20, 3);
        }
      });

      // Draw Batteries
      batteries.forEach((b) => {
        ctx.fillStyle = "#8b5cf6";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 14, Math.PI, 0);
        ctx.fill();

        // Ammo Bar
        ctx.fillStyle = b.missiles > 5 ? "#10b981" : b.missiles > 0 ? "#f59e0b" : "#ef4444";
        ctx.fillRect(b.x - 12, b.y + 4, (b.missiles / 20) * 24, 4);
      });

      // Spawn Enemy Missiles
      if (waveMissilesSpawned < missilesPerWave) {
        const spawnDelay = Math.max(700, 2400 - currentWave * 300);
        if (now - lastSpawn > spawnDelay) {
          spawnEnemyMissile();
          lastSpawn = now;
        }
      } else if (incomingMissiles.length === 0 && explosions.length === 0) {
        // Next Wave Bonus
        const remainingCities = cities.filter((c) => c.alive).length;
        const remainingAmmo = batteries.reduce((acc, b) => acc + b.missiles, 0);
        const waveBonus = remainingCities * 100 + remainingAmmo * 10;
        currentScore += waveBonus;
        setScore(currentScore);

        currentWave++;
        setWave(currentWave);
        waveMissilesSpawned = 0;
        // Refill batteries
        batteries.forEach((b) => (b.missiles = Math.min(20, b.missiles + 15)));
      }

      // Update & Draw Enemy Missiles
      for (let i = incomingMissiles.length - 1; i >= 0; i--) {
        const m = incomingMissiles[i];
        const dx = m.targetX - m.startX;
        const dy = m.targetY - m.startY;
        const totalDist = Math.hypot(dx, dy);
        const vx = (dx / totalDist) * m.speed;
        const vy = (dy / totalDist) * m.speed;

        m.x += vx;
        m.y += vy;

        // Trace line
        ctx.strokeStyle = m.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(m.startX, m.startY);
        ctx.lineTo(m.x, m.y);
        ctx.stroke();

        // Warhead dot
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(m.x - 1.5, m.y - 1.5, 3, 3);

        // Ground Impact Check
        if (m.y >= height - 20) {
          // Check if city hit
          cities.forEach((c) => {
            if (c.alive && Math.abs(c.x - m.x) < 20) {
              c.alive = false;
              playSynthSound("city_hit");
              explosions.push({
                x: c.x,
                y: height - 20,
                radius: 2,
                maxRadius: 36,
                expanding: true,
                color: "#ef4444",
                alpha: 1
              });
            }
          });

          incomingMissiles.splice(i, 1);

          // Check Game Over (all cities destroyed)
          if (cities.every((c) => !c.alive)) {
            isRunning = false;
            setGameOver(true);
          }
        }
      }

      // Update & Draw Interceptors
      for (let i = interceptors.length - 1; i >= 0; i--) {
        const int = interceptors[i];
        int.progress += int.speed;
        int.x = int.startX + (int.targetX - int.startX) * int.progress;
        int.y = int.startY + (int.targetY - int.startY) * int.progress;

        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(int.startX, int.startY);
        ctx.lineTo(int.x, int.y);
        ctx.stroke();

        // Crosshair at target
        ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
        ctx.strokeRect(int.targetX - 4, int.targetY - 4, 8, 8);

        if (int.progress >= 1) {
          explosions.push({
            x: int.targetX,
            y: int.targetY,
            radius: 2,
            maxRadius: 38,
            expanding: true,
            color: "#10b981",
            alpha: 1
          });
          playSynthSound("explode");
          interceptors.splice(i, 1);
        }
      }

      // Update & Draw Explosions (Flak Burst)
      for (let i = explosions.length - 1; i >= 0; i--) {
        const exp = explosions[i];
        if (exp.expanding) {
          exp.radius += 1.8;
          if (exp.radius >= exp.maxRadius) exp.expanding = false;
        } else {
          exp.radius -= 0.8;
          exp.alpha -= 0.03;
        }

        if (exp.alpha <= 0 || exp.radius <= 0) {
          explosions.splice(i, 1);
          continue;
        }

        ctx.fillStyle = `${exp.color}${Math.floor(exp.alpha * 255)
          .toString(16)
          .padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner shockwave ring
        ctx.strokeStyle = `rgba(255, 255, 255, ${exp.alpha * 0.8})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(exp.x, exp.y, exp.radius * 0.65, 0, Math.PI * 2);
        ctx.stroke();

        // Check Collision with Enemy Missiles
        for (let mIdx = incomingMissiles.length - 1; mIdx >= 0; mIdx--) {
          const m = incomingMissiles[mIdx];
          const dist = Math.hypot(m.x - exp.x, m.y - exp.y);
          if (dist <= exp.radius) {
            // Hit! Spawn spark particles
            for (let p = 0; p < 8; p++) {
              particles.push({
                x: m.x,
                y: m.y,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 18,
                maxLife: 18,
                color: "#fbbf24"
              });
            }
            incomingMissiles.splice(mIdx, 1);
            currentScore += 25 * currentWave;
            setScore(currentScore);
            if (currentScore > highScore) setHighScore(currentScore);
          }
        }
      }

      // Draw Sparks/Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 2, 2);
      }

      if (isRunning) {
        animationId = requestAnimationFrame(renderLoop);
      }
    };

    animationId = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("click", handleCanvasClick);
    };
  }, [wave]);

  return (
    <div className="defense-canvas-modal">
      <div className="defense-header">
        <div className="flex-row items-center gap-2">
          <Crosshair className="text-emerald" size={20} />
          <strong>Sub-16ms Dynamic Canvas Frame Render Loop (Missile Defense Radar)</strong>
          <span className="badge-emerald">{fps} FPS // {frameLatencyMs}ms</span>
        </div>
        <div className="flex-row items-center gap-3">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="icon-btn-minimal"
            title={soundEnabled ? "Mute Synthesizer" : "Unmute Synthesizer"}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <button onClick={onClose} className="close-btn">&times;</button>
        </div>
      </div>

      <div className="defense-stats-bar">
        <div>SCORE: <span className="text-emerald font-mono font-bold">{score}</span></div>
        <div>HIGH SCORE: <span className="text-cyan font-mono font-bold">{highScore}</span></div>
        <div>DEFENSE WAVE: <span className="text-purple font-mono font-bold">WAVE {wave}</span></div>
        <div className="text-muted text-xs">CLICK AIRSPACE TO DETONATE FLAK INTERCEPTORS</div>
      </div>

      <div className="canvas-wrapper">
        <canvas ref={canvasRef} className="missile-canvas" />
        {gameOver && (
          <div className="game-over-overlay">
            <h2 className="text-rose">AIRSPACE OVERRUN</h2>
            <p className="text-muted">All regional strategic population centers compromised.</p>
            <div className="font-mono text-lg mb-3">FINAL TACTICAL SCORE: {score}</div>
            <button
              onClick={() => {
                setGameOver(false);
                setScore(0);
                setWave(1);
              }}
              className="btn-glow-emerald"
            >
              <RotateCcw size={16} />
              <span>Re-engage Defense Grid</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
