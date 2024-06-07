import useProxy from '@/server/utils/proxy'
import { RequestHandler } from 'express';

/**
 * Defines an event handler that proxies the request to the specified API endpoint.
 * @param event - The event object containing the request and response objects.
 * @returns A promise that resolves when the request has been proxied successfully.
 */
export default defineEventHandler(async (event) => {
  await new Promise((resolve, reject) => {
    const proxy = useProxy(useRuntimeConfig().public.api)

    proxy(event.node.req as any, event.node.res as any, (err?: unknown) => {
      if (err) {
        reject(err)
      } else {
        resolve(true)
      }
    })
  })
})
