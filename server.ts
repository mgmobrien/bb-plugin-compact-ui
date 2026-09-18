import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { ACCENT_MODES, ACCENT_OPTION_KEYS, DEFAULT_ACCENT, DEFAULT_MODE, EMPTY_HUES, PERSONAL_PROJECT_ID, type ProjectHuesState, assignHues, normalizeAccent, normalizeAccentOptions, normalizeHuesState, normalizeMode, sameAccentOptions } from "./lib/accent";

const value = z.string().refine((v) => normalizeAccent(v) !== null, "Choose a preset or a six-digit hex color.");
const mode = z.enum(ACCENT_MODES);
/* 0.9.0: which surfaces the accent colors (kv `accentOptions`). Reads always
   return the full object; updates may send any subset. 0.9.3 adds header,
   wash and input (pane header color, pane background wash, text input glow). */
const options = z.object({ headings: z.boolean(), threads: z.boolean(), rails: z.boolean(), hover: z.boolean(), header: z.boolean(), wash: z.boolean(), input: z.boolean() } satisfies Record<(typeof ACCENT_OPTION_KEYS)[number], z.ZodBoolean>);
const configuration = z.object({ accent: value, mode, options });
/* Older clients send { accent } only; the stored mode and options are kept in that case. */
const update = z.object({ accent: value.optional(), mode: mode.optional(), options: options.partial().optional() });
export const OPTIONS_KEY = "accentOptions";
/* Per-project hues (0.8.1): the server owns the assignment so every window
   sees the same spread. Only hues and the shuffle seed are stored. */
const hue = z.number().int().min(0).max(359);
const projectId = z.string().min(1).max(200);
const huesState = z.object({ seed: z.number().int().min(0), hues: z.record(projectId, hue) });
const assignInput = z.object({ projectIds: z.array(projectId).max(1000) });
export const HUES_KEY = "projectHues";
export const rpcContract = defineRpcContract({
  getAccent: { input: z.null(), output: configuration },
  setAccent: { input: update, output: configuration },
  getProjectHues: { input: z.null(), output: huesState },
  assignProjectHues: { input: assignInput, output: huesState },
  shuffleProjectHues: { input: z.null(), output: huesState },
});
export default function register(bb: BbPluginApi) {
  async function read() {
    const storedAccent = await bb.storage.kv.get<unknown>("accent");
    const accent = normalizeAccent(storedAccent);
    if (storedAccent !== undefined && accent === null) bb.log.warn("Ignoring an invalid saved accent; using green.");
    const storedMode = await bb.storage.kv.get<unknown>("accentMode");
    const current = normalizeMode(storedMode);
    if (storedMode !== undefined && current === null) bb.log.warn("Ignoring an invalid saved accent mode; using a single color.");
    const storedOptions = await bb.storage.kv.get<unknown>(OPTIONS_KEY);
    if (storedOptions !== undefined && (typeof storedOptions !== "object" || storedOptions === null)) bb.log.warn("Ignoring invalid saved accent options; coloring every surface.");
    return { accent: accent ?? DEFAULT_ACCENT, mode: current ?? DEFAULT_MODE, options: normalizeAccentOptions(storedOptions) };
  }
  async function readHues(): Promise<ProjectHuesState> {
    const stored = await bb.storage.kv.get<unknown>(HUES_KEY);
    const state = normalizeHuesState(stored);
    if (stored !== undefined && state === null) bb.log.warn("Ignoring invalid saved project hues; reassigning.");
    return state ?? EMPTY_HUES;
  }
  /* Assignments read-modify-write one key; two windows asking at once must
     not interleave, so mutations run one after another. */
  let chain: Promise<unknown> = Promise.resolve();
  function serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = chain.then(task, task);
    chain = next.catch(() => undefined);
    return next;
  }
  async function write(state: ProjectHuesState): Promise<ProjectHuesState> {
    await bb.storage.kv.set(HUES_KEY, state);
    bb.realtime.publish(HUES_KEY, state);
    return state;
  }
  bb.rpc.register(rpcContract, {
    async getAccent() {
      return read();
    },
    async setAccent(input) {
      const current = await read();
      const accent = input.accent === undefined ? current.accent : normalizeAccent(input.accent);
      if (accent === null) throw new Error("Choose a preset or a six-digit hex color.");
      const next = input.mode ?? current.mode;
      const nextOptions = normalizeAccentOptions(input.options, current.options);
      if (accent !== current.accent) await bb.storage.kv.set("accent", accent);
      if (next !== current.mode) await bb.storage.kv.set("accentMode", next);
      if (!sameAccentOptions(nextOptions, current.options)) await bb.storage.kv.set(OPTIONS_KEY, nextOptions);
      const result = { accent, mode: next, options: nextOptions };
      bb.realtime.publish("accent", result);
      return result;
    },
    async getProjectHues() {
      return readHues();
    },
    async assignProjectHues(input) {
      return serialized(async () => {
        const current = await readHues();
        const ids = input.projectIds.filter((id) => id !== PERSONAL_PROJECT_ID);
        if (ids.every((id) => id in current.hues)) return current;
        return write({ seed: current.seed, hues: assignHues(current.seed, current.hues, ids) });
      });
    },
    async shuffleProjectHues() {
      return serialized(async () => {
        const current = await readHues();
        const seed = current.seed + 1;
        return write({ seed, hues: assignHues(seed, {}, Object.keys(current.hues)) });
      });
    },
  });
}
