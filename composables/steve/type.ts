import { reactive } from 'vue'
// import { defaultSort } from '@/config/schemas'

export interface ISteveType<D> {
  list: IStored<D>[]
  haveAll: boolean
  haveSelector: Record<string, boolean>
  revision: number
  generation: number
  map: Record<string, IStored<D>>
}

export function SteveType<D>() {
  return reactive<ISteveType<D>>({
    list: [],
    haveAll: false,
    haveSelector: {},
    revision: 0,
    generation: 0,
    map: {},
  })
}