import type { RequestHandler } from 'http-proxy-middleware'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { isDev } from '../../config/server'
import { randomStr } from '../../utils/string'

const cache: Record<string, RequestHandler> = {}

/**
 * Returns a proxy function for the specified API.
 * If the proxy function does not exist in the cache, it creates a new one.
 * 
 * @param api - The API to create a proxy for.
 * @param strip - The number of characters to strip from the API string.
 * @returns The proxy function for the specified API.
 */
export default function useProxy(api: string, strip = 0) {
  const key = `${strip}-${api}`

  if (!cache[key]) {
    cache[key] = createProxy(api, strip)
  }

  return cache[key]
}

/**
 * Creates a proxy middleware for handling HTTP requests.
 *
 * @param api - The target API URL.
 * @param strip - The number of path segments to strip from the request URL.
 * @returns The proxy middleware.
 */
function createProxy(api: string, strip = 0) {
  const out = createProxyMiddleware({
    target: api,
    changeOrigin: true,
    followRedirects: false,
    secure: !isDev,
    ws: true,
    on: {
      proxyReq(proxyReq, req, res) {
        if (!req.headers?.reqid) {
          req.headers.reqid = randomStr()
          res.setHeader('reqid', req.headers.reqid)
        }

        if (strip) {
          const parts = proxyReq.path.split('/')
          const removed = parts.splice(1, strip)

          proxyReq.path = parts.join('/')

          if (removed.length) {
            proxyReq.setHeader('x-api-url-prefix', `/${removed.join('/')}`)
          }
        }

        proxyReq.setHeader('origin', api)
        proxyReq.setHeader('x-api-host', req.headers.host || '')
        proxyReq.setHeader('x-forwarded-proto', 'https')

        // console.info(`[${ req.headers.reqid }] Proxy onProxyReq`, proxyReq.path, JSON.stringify(proxyReq.getHeaders()))
      },

      proxyReqWs(proxyReq, req) {
        if (!req.headers.reqid) {
          req.headers.reqid = randomStr()
        }

        if (strip) {
          const parts = proxyReq.path.split('/')
          const removed = parts.splice(1, strip)

          proxyReq.path = parts.join('/')

          if (removed.length) {
            proxyReq.setHeader('x-api-url-prefix', `/${removed.join('/')}`)
          }
        }

        proxyReq.setHeader('origin', api)
        proxyReq.setHeader('x-api-host', req.headers.host || '')
        proxyReq.setHeader('x-forwarded-proto', 'https')

        // console.info(`[${ req.headers.reqid }] Proxy onProxyReqWs`, proxyReq.path, JSON.stringify(proxyReq.getHeaders()))
      },

      error(err, req, res) {
        console.error(`[${req.headers?.reqid}] Proxy onError`, res.statusCode, JSON.stringify(err))
      },
    }
  })

  return out
}
