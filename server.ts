import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { DEFAULT_ACCENT, normalizeAccent } from "./lib/accent";

const value = z.string().refine((v) => normalizeAccent(v) !== null, "Choose a preset or a six-digit hex colour.");
const configuration = z.object({ accent: value });
export const rpcContract = defineRpcContract({
  getAccent: { input: z.null(), output: configuration },
  setAccent: { input: configuration, output: configuration },
});
export default function register(bb: BbPluginApi) {
  bb.rpc.register(rpcContract, {
    async getAccent() {
      const stored = await bb.storage.kv.get<unknown>("accent");
      const accent = normalizeAccent(stored);
      if (stored !== undefined && accent === null) bb.log.warn("Ignoring an invalid saved accent; using green.");
      return { accent: accent ?? DEFAULT_ACCENT };
    },
    async setAccent(input) {
      const accent = normalizeAccent(input.accent);
      if (accent === null) throw new Error("Choose a preset or a six-digit hex colour.");
      await bb.storage.kv.set("accent", accent);
      bb.realtime.publish("accent", { accent });
      return { accent };
    },
  });
}
