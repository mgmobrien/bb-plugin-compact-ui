import { useCallback, useEffect, useId, useRef, useState } from "react";
import { definePluginApp, useRealtime, useRealtimeConnectionState, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { DEFAULT_ACCENT, PRESETS, accentColour, normalizeAccent, pickerColour } from "./lib/accent";
import "./compact.css";

function useAccent() {
  const rpc = useRpc<typeof rpcContract>();
  const connection = useRealtimeConnectionState();
  const [accent, setAccent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const request = useRef(0);
  const refresh = useCallback(() => {
    const id = ++request.current;
    void rpc.call("getAccent", null).then((next) => {
      if (!mounted.current || request.current !== id) return;
      setAccent(next.accent); setError(null);
    }).catch((cause: unknown) => {
      if (mounted.current && request.current === id) setError(cause instanceof Error ? cause.message : String(cause));
    });
  }, [rpc]);
  useEffect(() => {
    mounted.current = true; refresh();
    return () => { mounted.current = false; ++request.current; };
  }, [refresh, connection]);
  useRealtime("accent", refresh);
  return { accent, error, refresh };
}

function AccentOverlay() {
  const { accent, error } = useAccent();
  useEffect(() => {
    if (error) console.warn("Compact Panes could not load the saved accent:", error);
  }, [error]);
  useEffect(() => {
    if (accent === null) return;
    const root = document.documentElement;
    const key = "--bb-workspace-accent";
    const colour = accent === DEFAULT_ACCENT ? "" : accentColour(accent);
    const previous = root.style.getPropertyValue(key);
    const priority = root.style.getPropertyPriority(key);
    if (colour) root.style.setProperty(key, colour);
    else root.style.removeProperty(key);
    return () => {
      if (root.style.getPropertyValue(key) !== colour) return;
      if (previous) root.style.setProperty(key, previous, priority);
      else root.style.removeProperty(key);
    };
  }, [accent]);
  return null;
}

function AccentSettings() {
  const rpc = useRpc<typeof rpcContract>();
  const { accent, error, refresh } = useAccent();
  const [draft, setDraft] = useState<string>(PRESETS[0].hex);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const hexId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (accent !== null) setDraft(pickerColour(accent)); }, [accent]);
  const save = async (next: string) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setSaveError(null); setSaved(false);
    try {
      await rpc.call("setAccent", { accent: next });
      if (mounted.current) { setSaved(true); refresh(); }
    } catch (cause) {
      if (mounted.current) setSaveError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const valid = normalizeAccent(draft);
  const disabled = accent === null || saving;
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">One accent for workspace highlights, pane headers and input focus. Green follows your bb theme.</p>
    {error ? <div role="alert" className="text-sm text-destructive">{error} <button type="button" className="underline" onClick={refresh}>Retry</button></div> : null}
    <fieldset disabled={disabled} className="flex flex-wrap gap-3">
      <legend className="sr-only">Accent presets</legend>
      {PRESETS.map((preset) => <button key={preset.value} type="button" aria-label={`${preset.name} accent`} aria-pressed={accent === preset.value}
        onClick={() => void save(preset.value)} className="flex min-w-12 flex-col items-center gap-1 rounded-md p-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full border border-border" style={{ backgroundColor: accentColour(preset.value) }}>
          {accent === preset.value ? <span className="rounded-full bg-background px-1 text-xs text-foreground">✓</span> : null}
        </span>{preset.name}
      </button>)}
    </fieldset>
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">Custom colour
        <input aria-label="Custom accent colour" type="color" disabled={disabled} value={valid?.startsWith("#") ? valid : PRESETS[0].hex}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); }} className="h-8 w-12 cursor-pointer rounded border border-border bg-background p-1 disabled:opacity-50" />
      </label>
      <label htmlFor={hexId} className="flex flex-col gap-1 text-xs">Hex
        <input id={hexId} type="text" value={draft} disabled={disabled} spellCheck={false} maxLength={7} aria-invalid={valid === null}
          onChange={(event) => { setDraft(event.target.value); setSaved(false); }} className="h-8 w-24 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground" />
      </label>
      <button type="button" disabled={disabled || valid === null || valid === DEFAULT_ACCENT} onClick={() => valid && void save(valid)} className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground disabled:opacity-50">Apply</button>
      <button type="button" disabled={disabled || accent === DEFAULT_ACCENT} onClick={() => void save(DEFAULT_ACCENT)} className="h-8 rounded-md border border-border px-3 text-xs disabled:opacity-50">Reset to green</button>
    </div>
    {valid === null ? <p className="text-xs text-muted-foreground">Use a six-digit hex colour, such as #5797ef.</p> : null}
    {saveError ? <p role="alert" className="text-sm text-destructive">Couldn’t save the accent: {saveError}</p> : null}
    <p role="status" className="min-h-4 text-xs text-muted-foreground">{saving ? "Saving…" : saved ? "Accent saved." : accent === null && !error ? "Loading accent…" : ""}</p>
  </div>;
}

export default definePluginApp((app) => {
  app.contentScripts.register({
    id: "compact-panes",
    mount() {
      document.documentElement.setAttribute("data-bb-compact-panes", "");
      return () => document.documentElement.removeAttribute("data-bb-compact-panes");
    },
  });
  app.slots.experimental_appOverlay({ id: "workspace-accent", component: AccentOverlay });
  app.slots.settingsSection({ id: "accent", title: "Workspace accent", component: AccentSettings });
});
