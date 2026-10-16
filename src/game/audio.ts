// Synthesized Web Audio API sound effects for Cinder Sky (Zero external audio files)
export class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private enabled: boolean = false;

  constructor(enabled: boolean = false) {
    this.enabled = enabled;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (enabled && !this.ctx) {
      this.initContext();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public initContext() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Launch whoosh: rising sawtooth wave with quick decay
  public playLaunch(isFastCenter: boolean = false) {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "sawtooth";
      const startFreq = isFastCenter ? 350 : 250;
      const endFreq = isFastCenter ? 900 : 750;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.14);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch {}
  }

  // Soft detonation: low frequency thud + band-pass feel
  public playBlast() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "triangle";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  // Rising tone per combo step: combo multiplier increases pitch!
  public playComboKill(combo: number) {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "sine";
      // Scale frequency with combo step (pentatonic harmonic scale feel)
      const baseFreq = 440;
      const semitones = Math.min(24, combo * 2);
      const freq = baseFreq * Math.pow(2, semitones / 12);

      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.1, now + 0.12);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  // Low rumble when a settlement or silo is destroyed
  public playSettlementLoss() {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "square";
      osc.frequency.setValueAtTime(75, now);
      osc.frequency.linearRampToValueAtTime(20, now + 0.6);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch {}
  }

  // Slow Time sound effect
  public playSlowTime(active: boolean) {
    if (!this.enabled || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = "sine";
      if (active) {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.4);
      } else {
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
      }

      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {}
  }
}
