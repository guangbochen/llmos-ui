import type { IResource } from '@/composables/steve/types'

declare global {
  interface IUser extends IResource {
    spec: {
      assistantName: string
      parentThreadName?: string
      startMessageName?: string
    }

    status: {
     conditions: ICondition[]
     description: string
    }
  }

  export interface DecoratedUser extends DecoratedResource {}
}

type IDecoratedTUser = {
  [k in keyof typeof User]: ReturnType<typeof User[k]>
}

const User = {}

export default User
