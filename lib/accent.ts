export const DEFAULT_ACCENT = "green";
/* 0.9.0: "none" is a monochrome accent. Every derived token (tint, foreground,
   indicator, fills, rails, glow, washes) is computed from this color, so an
   achromatic source makes all of them achromatic: bb's own sidebar ink with
   its chroma set to zero. It follows the theme (dark ink in light themes,
   light ink in dark themes) and stays legible through the same clamps. */
export const NONE_ACCENT = "none";
export const NONE_ACCENT_COLOR = "oklch(from var(--sidebar-foreground) l 0 h)";
export const PRESETS = [
  { name: "Green", value: "green", hex: "#4bc680" },
  { name: "Blue", value: "#5797ef", hex: "#5797ef" },
  { name: "Violet", value: "#aa86e8", hex: "#aa86e8" },
  { name: "Rose", value: "#e57c9f", hex: "#e57c9f" },
  { name: "Amber", value: "#dba952", hex: "#dba952" },
  { name: "Teal", value: "#48b6aa", hex: "#48b6aa" },
  { name: "None", value: NONE_ACCENT, hex: "#808080" },
] as const;
export function normalizeAccent(value: unknown): string | null {
  if (value === DEFAULT_ACCENT) return DEFAULT_ACCENT;
  if (value === NONE_ACCENT) return NONE_ACCENT;
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase() : null;
}
export function accentColor(value: string): string {
  if (value === DEFAULT_ACCENT) return "var(--success)";
  if (value === NONE_ACCENT) return NONE_ACCENT_COLOR;
  return normalizeAccent(value) ?? "var(--success)";
}
export function pickerColor(value: string): string {
  return PRESETS.find((preset) => preset.value === value)?.hex ?? value;
}

/* 0.9.0: which surfaces the accent colors. Stored as one object under
   `accentOptions`; every key defaults to on, so installs without the key and
   partial updates from any client behave as before. 0.9.3 adds the pane
   surfaces: header (focused pane header gradient, Workspaces), wash (the 3%
   selected-pane wash, Compact UI) and input (the composer focus glow,
   Workspaces). The key order is the order of the settings checkboxes. */
export const ACCENT_OPTION_KEYS = ["headings", "threads", "rails", "hover", "header", "wash", "input"] as const;
export type AccentOptionKey = (typeof ACCENT_OPTION_KEYS)[number];
export type AccentOptions = Record<AccentOptionKey, boolean>;
export const DEFAULT_ACCENT_OPTIONS: AccentOptions = { headings: true, threads: true, rails: true, hover: true, header: true, wash: true, input: true };
/* Merge a stored or submitted value over a base. Unknown keys are dropped and
   non-boolean values are ignored (the base wins), so a damaged record never
   switches a surface off by accident. */
export function normalizeAccentOptions(value: unknown, base: AccentOptions = DEFAULT_ACCENT_OPTIONS): AccentOptions {
  const out: AccentOptions = { ...base };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return out;
  const record = value as Record<string, unknown>;
  for (const key of ACCENT_OPTION_KEYS) if (typeof record[key] === "boolean") out[key] = record[key] as boolean;
  return out;
}
export function sameAccentOptions(a: AccentOptions, b: AccentOptions): boolean {
  return ACCENT_OPTION_KEYS.every((key) => a[key] === b[key]);
}

/* Accent mode. "single" (the default, and what every pre-0.8 install has)
   uses one color everywhere. "per-project" gives each sidebar project a
   deterministic color; the single color becomes the fallback for the
   personal Threads area and any surface without a project. */
export const ACCENT_MODES = ["single", "per-project"] as const;
export type AccentMode = (typeof ACCENT_MODES)[number];
export const DEFAULT_MODE: AccentMode = "single";
export function normalizeMode(value: unknown): AccentMode | null {
  return (ACCENT_MODES as readonly unknown[]).includes(value) ? value as AccentMode : null;
}

/* bb's personal Threads area. Its threads route without a project on some
   hosts and as this id on others; both mean "no project" here. */
export const PERSONAL_PROJECT_ID = "proj_personal";

/* Per-project colors sit in the perceptual range of the six presets, which
   convert (sRGB -> OKLCH) to L 0.674–0.764 (mean 0.716) and C 0.101–0.150
   (mean 0.133). Fixed L/C keep every generated hue equally weighted; only the
   hue varies. */
export const PROJECT_ACCENT_L = 0.72;
export const PROJECT_ACCENT_C = 0.13;

/* FNV-1a 32-bit over UTF-16 code units; stable across restarts and windows. */
export function hashProjectId(projectId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < projectId.length; i++) {
    hash ^= projectId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/* Base hue is hash % 360. Adjacent hashes would otherwise land one degree
   apart, so a nudge of up to ±12° drawn from higher bits spreads them. */
export function projectHue(projectId: string): number {
  const hash = hashProjectId(projectId);
  const base = hash % 360;
  const nudge = ((hash >>> 12) % 25) - 12;
  return (base + nudge + 360) % 360;
}

/* Seeded hue. Seed 0 is exactly the 0.8.0 hue, so an install upgraded from
   0.8.0 keeps its colors except where the spread walk has to move one.
   Shuffle bumps the seed; later seeds hash "seed:id" instead. */
export function seededHue(seed: number, projectId: string): number {
  return seed === 0 ? projectHue(projectId) : projectHue(`${seed}:${projectId}`);
}

/* Neighbour-aware assignment (0.8.1). Hashing each id on its own cannot keep
   hues apart, so new ids are assigned one at a time against everything
   already assigned: start at the seeded hue and, while it sits within minGap
   of an assigned hue, advance by the golden angle (137.508°) up to
   GOLDEN_STEP_CAP times, then accept the best-separated candidate tried. Unassigned ids are
   walked in sorted order so every window computes the same map; assigned
   hues are never moved. minGap is derived once per call from the final
   expected count: 40° for up to six projects, shrinking as more arrive. */
export const GOLDEN_ANGLE = 137.508;
export const GOLDEN_STEP_CAP = 24;
export const MAX_MIN_GAP = 40;
export type ProjectHues = Record<string, number>;
export function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}
export function minGapFor(count: number): number {
  return Math.min(MAX_MIN_GAP, Math.floor((360 / (count + 1)) * 0.8));
}
export function normalizeHue(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 360 ? value : null;
}
/* Persisted / published shape: { seed, hues }. Anything malformed is
   rejected as a whole rather than partially trusted. */
export interface ProjectHuesState { seed: number; hues: ProjectHues }
export const EMPTY_HUES: ProjectHuesState = { seed: 0, hues: {} };
export function normalizeHuesState(value: unknown): ProjectHuesState | null {
  if (typeof value !== "object" || value === null) return null;
  const { seed, hues } = value as { seed?: unknown; hues?: unknown };
  if (typeof seed !== "number" || !Number.isInteger(seed) || seed < 0) return null;
  if (typeof hues !== "object" || hues === null || Array.isArray(hues)) return null;
  const out: ProjectHues = {};
  for (const [id, raw] of Object.entries(hues as Record<string, unknown>)) {
    const h = normalizeHue(raw);
    if (h === null || !id || id === PERSONAL_PROJECT_ID) return null;
    out[id] = h;
  }
  return { seed, hues: out };
}
export function assignHues(seed: number, existing: Readonly<ProjectHues>, ids: readonly string[]): ProjectHues {
  const hues: ProjectHues = { ...existing };
  const pending = Array.from(new Set(ids)).filter((id) => id && id !== PERSONAL_PROJECT_ID && !(id in hues)).sort();
  if (pending.length === 0) return hues;
  const minGap = minGapFor(Object.keys(hues).length + pending.length);
  for (const id of pending) {
    const base = seededHue(seed, id);
    const assigned = Object.values(hues);
    let best = base;
    let bestGap = -1;
    for (let step = 0; step <= GOLDEN_STEP_CAP; step++) {
      const hue = Math.round(base + step * GOLDEN_ANGLE) % 360;
      const gap = assigned.reduce((min, other) => Math.min(min, hueGap(hue, other)), 360);
      if (gap > bestGap) { best = hue; bestGap = gap; }
      if (gap >= minGap) break;
    }
    hues[id] = best;
  }
  return hues;
}

/* A CSS color usable anywhere --bb-workspace-accent is read, including the
   oklch(from …) relative-color expressions that derive the foreground and
   indicator tokens. */
export function projectAccentForHue(hue: number): string {
  return `oklch(${PROJECT_ACCENT_L} ${PROJECT_ACCENT_C} ${hue})`;
}
