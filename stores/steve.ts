import { defineStore } from "pinia";
import { SteveServerState } from "@/composables/steve/server";
import { SteveServerGetters } from "@/composables/steve/getters";
import { SteveServerActions } from "@/composables/steve/actions";

/**
 * /v1/${type}
 */
export const useManagementStore = defineStore("mgmt", {
  state: SteveServerState(
    { baseUrl: "/v1", }
  ),
  getters: SteveServerGetters(),
  actions: SteveServerActions<DecoratedResource>(),
});

export type MgmtStoreType = ReturnType<typeof useManagementStore>