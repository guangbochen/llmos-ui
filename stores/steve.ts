import { defineStore } from 'pinia'
import { SteveServerActions, SteveServerGetters, SteveServerState } from '@/composables/steve/server'
import { SteveTypeActions, SteveTypeGetters, SteveTypeState } from '@/composables/steve/type'
import { MANAGEMENT, ML_LLMOS } from '@/config/schemas'
import type { IResource } from '~/composables/steve/types'

export const useMgmt = defineStore('mgmt', {
  state:   () => ({ ...SteveServerState }),
  getters: SteveServerGetters,
  actions: SteveServerActions,
})

export type SteveStoreType = ReturnType<typeof useMgmt>

// export const useSettings = defineStore('settings', {
//   state:   SteveTypeState<DecoratedResource>(MANAGEMENT.SETTING),
//   getters: SteveTypeGetters<DecoratedResource>(),
//   actions: SteveTypeActions<IResource, DecoratedResource>(),
// })

export const useUser = defineStore('users', {
  state:   SteveTypeState<DecoratedUser>(MANAGEMENT.USER),
  getters: SteveTypeGetters<DecoratedUser>(),
  actions: SteveTypeActions<IUser, DecoratedUser>(),
})

// export const useClusters = defineStore('clusters', {
//   state:   SteveTypeState<DecoratedCLUSTER>(MANAGEMENT.CLUSTER),
//   getters: SteveTypeGetters<DecoratedCLUSTER>(),
//   actions: SteveTypeActions<ICLUSTER, DecoratedCLUSTER>(),
// })

// export const useModelFile = defineStore('modelfiles', {
//   state:   SteveTypeState<DecoratedMessage>(ML_LLMOS.MODELFILE),
//   getters: SteveTypeGetters<DecoratedMessage>(),
//   actions: SteveTypeActions<IMessage, DecoratedMessage>(),
// })


export const mgmtStores: Record<string, any> = {
  // [MANAGEMENT.CLUSTER]: useClusters,
  [MANAGEMENT.USER]: useUser,
  // [MANAGEMENT.SETTING]: useSettings,
  // [ML_LLMOS.MODEL_FILE]: useModelFile,
}

export function storeFor(type: string) {
  return mgmtStores[type]
}
