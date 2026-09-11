export const DEFAULT_ACCENT = "green";
export const PRESETS = [
  { name: "Green", value: "green", hex: "#4bc680" },
  { name: "Blue", value: "#5797ef", hex: "#5797ef" },
  { name: "Violet", value: "#aa86e8", hex: "#aa86e8" },
  { name: "Rose", value: "#e57c9f", hex: "#e57c9f" },
  { name: "Amber", value: "#dba952", hex: "#dba952" },
  { name: "Teal", value: "#48b6aa", hex: "#48b6aa" },
] as const;
export function normalizeAccent(value: unknown): string | null {
  if (value === DEFAULT_ACCENT) return DEFAULT_ACCENT;
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase() : null;
}
export function accentColour(value: string): string {
  return value === DEFAULT_ACCENT ? "var(--success)" : normalizeAccent(value) ?? "var(--success)";
}
export function pickerColour(value: string): string {
  return value === DEFAULT_ACCENT ? PRESETS[0].hex : value;
}
