import { GameSettings, HighScoreRecord, GameMode } from "./types";

const SETTINGS_KEY = "cinder_sky_settings";
const HIGH_SCORES_KEY = "cinder_sky_high_scores";
const DAILY_SCORES_KEY = "cinder_sky_daily_scores";

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  difficulty: "normal",
  reducedMotion: false,
  colorblindSafe: false
};

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function loadHighScores(): HighScoreRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HIGH_SCORES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordHighScore(score: number, wave: number, mode: GameMode, seed?: string): boolean {
  if (typeof window === "undefined" || score <= 0) return false;
  try {
    const scores = loadHighScores();
    const newRecord: HighScoreRecord = {
      score,
      wave,
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      mode,
      seed
    };
    scores.push(newRecord);
    scores.sort((a, b) => b.score - a.score);
    const top10 = scores.slice(0, 10);
    localStorage.setItem(HIGH_SCORES_KEY, JSON.stringify(top10));

    // Also update daily record if in daily mode
    if (mode === "daily" && seed) {
      saveDailyRecord(seed, score, wave);
    }

    return top10[0]?.score === score;
  } catch {
    return false;
  }
}

export function loadDailyRecord(seed: string): { score: number; wave: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DAILY_SCORES_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw);
    return map[seed] || null;
  } catch {
    return null;
  }
}

export function saveDailyRecord(seed: string, score: number, wave: number) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(DAILY_SCORES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    const prev = map[seed];
    if (!prev || score > prev.score) {
      map[seed] = { score, wave, date: new Date().toISOString() };
      localStorage.setItem(DAILY_SCORES_KEY, JSON.stringify(map));
    }
  } catch {}
}

export function clearAllStoredScores() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(HIGH_SCORES_KEY);
    localStorage.removeItem(DAILY_SCORES_KEY);
  } catch {}
}
