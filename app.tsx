import { useCallback, useEffect, useId, useRef, useState } from "react";
import { definePluginApp, useBbContext, useRealtime, useRealtimeConnectionState, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { ACCENT_OPTION_KEYS, type AccentMode, type AccentOptionKey, type AccentOptions, DEFAULT_ACCENT, DEFAULT_ACCENT_OPTIONS, EMPTY_HUES, NONE_ACCENT, PRESETS, type ProjectHuesState, accentColor, normalizeAccent, normalizeAccentOptions, normalizeHuesState, pickerColor, projectAccentForHue } from "./lib/accent";
import { applyAccentOptions } from "./lib/accent-options";
import { type ProjectAccentsHandle, currentProjectId, mountProjectAccents, watchActiveProject } from "./lib/project-accent";
import "./compact.css";
import { mountSidebarDensity } from "./lib/sidebar-density";

function useAccent() {
  const rpc = useRpc<typeof rpcContract>();
  const connection = useRealtimeConnectionState();
  const [accent, setAccent] = useState<string | null>(null);
  const [mode, setMode] = useState<AccentMode>("single");
  const [options, setOptions] = useState<AccentOptions>(DEFAULT_ACCENT_OPTIONS);
  const [hues, setHues] = useState<ProjectHuesState>(EMPTY_HUES);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const refresh = useCallback(() => {
    const id = ++request.current;
    void rpc.call("getAccent", null).then((next) => {
      if (!mounted.current || request.current !== id) return;
      setAccent(next.accent); setMode(next.mode); setOptions(normalizeAccentOptions(next.options)); setError(null);
    }).catch((cause: unknown) => {
      if (mounted.current && request.current === id) setError(cause instanceof Error ? cause.message : String(cause));
    });
    void rpc.call("getProjectHues", null).then((next) => {
      if (mounted.current && request.current === id) setHues(next);
    }).catch((cause: unknown) => {
      if (mounted.current && request.current === id) console.warn("Compact Panes could not load project colors:", cause);
    });
  }, [rpc]);
  /* Accept a hues state from an RPC result or a realtime signal. Newer seeds
     win; within a seed a map that knows at least as many ids wins, so a slow
     response never overwrites a later, fuller map. */
  const applyHues = useCallback((value: unknown) => {
    const next = normalizeHuesState(value);
    if (!next || !mounted.current) return;
    setHues((current) => next.seed > current.seed || (next.seed === current.seed && Object.keys(next.hues).length >= Object.keys(current.hues).length) ? next : current);
  }, []);
  useEffect(() => {
    mounted.current = true; refresh();
    return () => { mounted.current = false; ++request.current; };
  }, [refresh, connection]);
  useRealtime("accent", refresh);
  useRealtime("projectHues", applyHues);
  return { accent, mode, options, hues, applyHues, error, refresh };
}

/* Which project the window-level accent follows in per-project mode. The
   route (useBbContext) is the primary signal; the Workspaces active heading
   in the sidebar only decides on surfaces that route to neither a project nor
   a thread. A MutationObserver re-evaluates when that heading moves. */
function useCurrentProjectId(enabled: boolean): string | null {
  const route = useBbContext();
  const [domTick, setDomTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    watchActiveProject(document.body, () => setDomTick((tick) => tick + 1), controller.signal);
    return () => controller.abort();
  }, [enabled]);
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    setProjectId(enabled ? currentProjectId(route, document) : null);
  }, [enabled, route.projectId, route.threadId, domTick]);
  return projectId;
}

/* Debounce before asking the server for hues the sidebar shows but the map
   lacks. Ids are requested at most once per mount (dedupes bursts and the
   in-flight call); a failed request is logged and retried only when the
   sidebar changes again after the retry delay. */
const ASSIGN_DEBOUNCE_MS = 100;
const ASSIGN_RETRY_MS = 5000;

function AccentOverlay() {
  const rpc = useRpc<typeof rpcContract>();
  const { accent, mode, options, hues, applyHues, error } = useAccent();
  /* 0.9.0: the None accent is monochrome, so per-project coloring has no
     meaning with it; the stored mode is kept but not applied (no sidebar
     decoration, no assignment requests). */
  const perProject = accent !== null && mode === "per-project" && accent !== NONE_ACCENT;
  const projectId = useCurrentProjectId(perProject);
  const huesRef = useRef(hues);
  huesRef.current = hues;
  const handle = useRef<ProjectAccentsHandle | null>(null);
  useEffect(() => {
    if (error) console.warn("Compact Panes could not load the saved accent:", error);
  }, [error]);
  useEffect(() => {
    if (accent === null) return;
    const root = document.documentElement;
    const key = "--bb-workspace-accent";
    const fallback = accent === DEFAULT_ACCENT ? "" : accentColor(accent);
    const hue = perProject && projectId ? hues.hues[projectId] : undefined;
    const color = hue === undefined ? fallback : projectAccentForHue(hue);
    const previous = root.style.getPropertyValue(key);
    const priority = root.style.getPropertyPriority(key);
    if (color) root.style.setProperty(key, color);
    else root.style.removeProperty(key);
    return () => {
      if (root.style.getPropertyValue(key) !== color) return;
      if (previous) root.style.setProperty(key, previous, priority);
      else root.style.removeProperty(key);
    };
  }, [accent, perProject, projectId, hues]);
  /* 0.9.0: surface toggles ride on html attributes the stylesheets gate on.
     Cleared on unmount so a disabled plugin leaves nothing behind. */
  useEffect(() => { applyAccentOptions(document.documentElement, options); }, [options]);
  useEffect(() => () => applyAccentOptions(document.documentElement, DEFAULT_ACCENT_OPTIONS), []);
  useEffect(() => { handle.current?.refresh(); }, [hues]);
  useEffect(() => {
    if (!perProject) return;
    const controller = new AbortController();
    const requested = new Set<string>();
    let latest: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      timer = undefined;
      if (controller.signal.aborted) return;
      const projectIds = latest;
      void rpc.call("assignProjectHues", { projectIds }).then(applyHues).catch((cause: unknown) => {
        console.warn("Compact Panes could not assign project colors:", cause);
        setTimeout(() => { for (const id of projectIds) requested.delete(id); }, ASSIGN_RETRY_MS);
      });
    };
    handle.current = mountProjectAccents(document.body, controller.signal, () => huesRef.current.hues, (ids) => {
      latest = ids;
      const missing = ids.filter((id) => huesRef.current.hues[id] === undefined && !requested.has(id));
      if (missing.length === 0) return;
      for (const id of missing) requested.add(id);
      if (timer) clearTimeout(timer);
      timer = setTimeout(send, ASSIGN_DEBOUNCE_MS);
    });
    return () => { controller.abort(); if (timer) clearTimeout(timer); handle.current = null; };
  }, [perProject, rpc, applyHues]);
  return null;
}

const PER_PROJECT_SWATCH = "conic-gradient(from 0deg, oklch(0.72 0.13 0), oklch(0.72 0.13 60), oklch(0.72 0.13 120), oklch(0.72 0.13 180), oklch(0.72 0.13 240), oklch(0.72 0.13 300), oklch(0.72 0.13 360))";
const OPTION_LABELS: Record<AccentOptionKey, string> = {
  headings: "Project headings",
  threads: "Thread titles",
  rails: "Active workspace rails",
  hover: "Hover wash on open groups",
  header: "Pane header color",
  wash: "Pane background wash",
  input: "Text input glow",
};

function AccentSettings() {
  const rpc = useRpc<typeof rpcContract>();
  const { accent, mode, options, applyHues, error, refresh } = useAccent();
  const [draft, setDraft] = useState<string>(PRESETS[0].hex);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState<"accent" | "shuffle" | false>(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const hexId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (accent !== null) setDraft(pickerColor(accent)); }, [accent]);
  const save = async (next: { accent?: string; mode?: AccentMode; options?: Partial<AccentOptions> }) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setSaveError(null); setSaved(false);
    try {
      await rpc.call("setAccent", next);
      if (mounted.current) { setSaved("accent"); refresh(); }
    } catch (cause) {
      if (mounted.current) setSaveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const shuffle = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setSaveError(null); setSaved(false);
    try {
      applyHues(await rpc.call("shuffleProjectHues", null));
      if (mounted.current) setSaved("shuffle");
    } catch (cause) {
      if (mounted.current) setSaveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const valid = normalizeAccent(draft);
  const disabled = accent === null || saving;
  const none = accent === NONE_ACCENT;
  const perProject = mode === "per-project" && !none;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">{none
      ? "None: workspace highlights, pane headers and input focus use bb’s own ink with no color. Choose a preset or a custom color to bring color back."
      : perProject
      ? "Each project gets its own color. The color chosen below is the fallback for the personal Threads area and anything outside a project."
      : "One accent for workspace highlights, pane headers and input focus. Green follows your bb theme."}</p>
    {error ? <div role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></div> : null}
    <fieldset disabled={disabled} className="flex flex-wrap gap-3">
      <legend className="sr-only">Accent presets</legend>
      {PRESETS.map((preset) => <button key={preset.value} type="button" aria-label={`${preset.name} accent`} aria-pressed={accent === preset.value}
        onClick={() => void save({ accent: preset.value })} className="flex min-w-12 flex-col items-center gap-1 rounded-md p-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full border border-border" style={{ backgroundColor: accentColor(preset.value) }}>
          {accent === preset.value ? <span className="rounded-full bg-background px-1 text-xs text-foreground">✓</span> : null}
        </span>{preset.name}
      </button>)}
      <button type="button" aria-label="Random per project" aria-pressed={perProject} disabled={none} aria-describedby={none ? `${hexId}-none` : undefined}
        onClick={() => void save({ mode: perProject ? "single" : "per-project" })} className="flex min-w-12 flex-col items-center gap-1 rounded-md p-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full border border-border" style={{ backgroundImage: PER_PROJECT_SWATCH }}>
          {perProject ? <span className="rounded-full bg-background px-1 text-xs text-foreground">✓</span> : null}
        </span>Per project
      </button>
      {mode === "per-project" ? <button type="button" disabled={none} onClick={() => void shuffle()} className="self-center h-8 rounded-md border border-border px-3 text-xs disabled:opacity-50">Shuffle colors</button> : null}
    </fieldset>
    {none ? <p id={`${hexId}-none`} className="text-xs text-muted-foreground">Per-project colors are not available with None. Pick a color to use them.</p> : null}
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="text-xs font-medium">Color applies to</legend>
      {ACCENT_OPTION_KEYS.map((key) => <label key={key} className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={options[key]} onChange={(event) => void save({ options: { [key]: event.target.checked } })}
          style={{ accentColor: "var(--foreground)" }} className="size-4 shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" />
        {OPTION_LABELS[key]}
      </label>)}
    </fieldset>
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">Custom color
        <input aria-label="Custom accent color" type="color" disabled={disabled} value={valid?.startsWith("#") ? valid : PRESETS[0].hex}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); }} className="h-8 w-12 cursor-pointer rounded border border-border bg-background p-1 disabled:opacity-50" />
      </label>
      <label htmlFor={hexId} className="flex flex-col gap-1 text-xs">Hex
        <input id={hexId} type="text" value={draft} disabled={disabled} spellCheck={false} maxLength={7} aria-invalid={valid === null}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); }} className="h-8 w-24 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground" />
      </label>
      <button type="button" disabled={disabled || valid === null || valid === DEFAULT_ACCENT} onClick={() => valid && void save({ accent: valid })} className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">Apply</button>
      <button type="button" disabled={disabled || accent === DEFAULT_ACCENT} onClick={() => void save({ accent: DEFAULT_ACCENT })} className="h-8 rounded-md border border-border px-3 text-xs disabled:opacity-50">Reset to green</button>
    </div>
    {valid === null ? <p className="text-xs text-muted-foreground">Use a six-digit hex color, such as #5797ef.</p> : null}
    {perProject ? <p className="text-xs text-muted-foreground">Project colors are assigned once, kept apart from each other, and saved, so they stay the same across windows and restarts. Shuffle colors draws a fresh, equally spread set.</p> : null}
    {saveError ? <p role="alert" className="text-sm text-destructive">Couldn’t save the accent: {saveError}</p> : null}
    <p role="status" className="min-h-4 text-xs text-muted-foreground">{saving ? "Saving…" : saved === "shuffle" ? "Colors shuffled." : saved === "accent" ? "Accent saved." : accent === null && !error ? "Loading accent…" : ""}</p>
  </div>;
}

function AccentPanel() {
  return <div className="h-full overflow-y-auto p-4 md:p-5">
    <div className="mx-auto w-full max-w-3xl"><AccentSettings /></div>
  </div>;
}

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "compact-panes",
    mount() {
      document.documentElement.setAttribute("data-bb-compact-panes", "");
      const disposeDensity = mountSidebarDensity();
      return () => { disposeDensity(); document.documentElement.removeAttribute("data-bb-compact-panes"); };
    },
  });
  app.slots.experimental_appOverlay({ id: "workspace-accent", component: AccentOverlay });
  app.slots.settingsSection({ id: "accent", title: "Workspace accent", component: AccentSettings });
  app.slots.navPanel({ id: "accent", title: "Compact UI", icon: "GridView", path: "accent", component: AccentPanel });
});
