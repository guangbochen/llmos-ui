import { defineStore } from "pinia";
import { SteveServerState } from "@/composables/steve/server";
import type { IType } from "@/composables/steve/server";
import type { IResource } from "@/composables/steve/types";
import { SteveServerGetters } from "@/composables/steve/getters";
import { SteveServerActions } from "@/composables/steve/actions";

/**
 * /v1/${type}
 */
export const useManagementStore = defineStore("mgmt", {
  state: SteveServerState<DecoratedResource>(
    { baseUrl: "/v1", }
  ),
  getters: SteveServerGetters<DecoratedResource>(),
  actions: SteveServerActions<IResource, DecoratedResource>(),
});

export type MgmtStoreType = ReturnType<typeof useManagementStore>

// define pre-loaded stores if any
export const mgmtStores: Record<string, IType> = {}

export function storeFor(type: string) {
  return mgmtStores[type]
}
