import type { IncomingMessage } from 'node:http'
import type { Socket } from 'node:net'
import type { Nuxt } from '@nuxt/schema'
import type { RequestHandler } from 'http-proxy-middleware'
import useProxy from '../server/utils/proxy'
import { randomStr } from '../utils/string'
import { api } from '../config/server'

/**
 * Creates a WebSocket proxy middleware.
 * @param opt - The options for the proxy middleware.
 * @param nuxt - The Nuxt instance.
 */
export default (opt: any, nuxt: Nuxt) => {
  nuxt.hook('listen', (server) => {
    server.on('upgrade', async (req: IncomingMessage, socket: Socket, head: any) => {
      let proxy: RequestHandler

      if ( !req.headers.reqid ) {
        req.headers.reqid = randomStr()
      }

      proxy = useProxy(api)

      return proxy.upgrade!(req as any, socket, head)
    })
  })
}
