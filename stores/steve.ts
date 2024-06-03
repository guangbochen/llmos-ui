import { defineStore } from 'pinia'
import { SteveServerActions, SteveServerGetters, SteveServerState } from '@/composables/steve/server'
import { SteveTypeActions, SteveTypeGetters, SteveTypeState } from '@/composables/steve/type'
import type { IResource } from '@/composables/steve/types'
import { MANAGEMENT, ML_LLMOS } from '@/config/schemas'

export const useMgmt = defineStore('mgmt', {
  state:   SteveServerState,
  getters: SteveServerGetters,
  actions: SteveServerActions,
})

export type SteveStoreType = ReturnType<typeof useMgmt>

export const useSettings = defineStore('settings', {
  state:   SteveTypeState<DecoratedResource>(MANAGEMENT.SETTING),
  getters: SteveTypeGetters<DecoratedResource>(),
  actions: SteveTypeActions<IResource, DecoratedResource>(),
})
export const useUsers = defineStore('users', {
  state:   SteveTypeState<DecoratedResource>(MANAGEMENT.USER),
  getters: SteveTypeGetters<DecoratedResource>(),
  actions: SteveTypeActions<IResource, DecoratedResource>(),
})
export const useUpgrades = defineStore('upgrades', {
  state:   SteveTypeState<DecoratedResource>(MANAGEMENT.UPGRADE),
  getters: SteveTypeGetters<DecoratedResource>(),
  actions: SteveTypeActions<IResource, DecoratedResource>(),
})

export const useModelfiles = defineStore('modelfiles', {
  state:   SteveTypeState<DecoratedResource>(ML_LLMOS.MODELFILE),
  getters: SteveTypeGetters<DecoratedResource>(),
  actions: SteveTypeActions<IResource, DecoratedResource>(),
})

export const useClusters = defineStore('clusters', {
  state:   SteveTypeState<DecoratedResource>(MANAGEMENT.CLUSTER),
  getters: SteveTypeGetters<DecoratedResource>(),
  actions: SteveTypeActions<IResource, DecoratedResource>(),
})

export const mgmtStores: Record<string, any> = {
  [MANAGEMENT.SETTING]: useSettings,
  [MANAGEMENT.USER]:    useUsers,
  [MANAGEMENT.UPGRADE]: useUpgrades,
  [MANAGEMENT.CLUSTER]: useClusters,
  [ML_LLMOS.MODELFILE]: useModelfiles,
};

export function storeFor(type: string) {
  return mgmtStores[type]
}
