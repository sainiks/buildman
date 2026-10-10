import { github } from "./github";
import { supabase } from "./supabase";
import type { Provider, ProviderId } from "./types";
import { vercel } from "./vercel";

// To add a plugin: implement `Provider` in its own file and list it here. The connect routes,
// the token vault and the Connections page pick it up with no other changes.
export const providers: Record<ProviderId, Provider> = { github, vercel, supabase };
export const providerList: Provider[] = Object.values(providers);

export function getProvider(id: string): Provider | null {
  return Object.prototype.hasOwnProperty.call(providers, id) ? providers[id as ProviderId] : null;
}

export type { Provider, ProviderId } from "./types";
