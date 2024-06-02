import type { IncomingMessage } from 'node:http'
import type { CookieSerializeOptions } from 'cookie-es'

const prefix = 'L_'

export const LOCALE = `${ prefix }LOCALE`
export const LOG = `${ prefix }LOG`
export const NONCE = `${ prefix }NONCE`
export const PCS = `${ prefix }PCS`
export const SESSION = `${ prefix }SESS`
export const THEME = `${ prefix }THEME`

export const OPT_REGULAR: CookieSerializeOptions = {
  httpOnly: false,
  secure:   true,
  path:     '/',
  sameSite: 'lax',
}

export const OPT_HTTPONLY: CookieSerializeOptions = {
  ...OPT_REGULAR,
  httpOnly: true,
}

export const OPT_PERMANENT: CookieSerializeOptions = {
  ...OPT_REGULAR,
  maxAge: 31536000, // 1 year
}

/**
 * Generates session options for cookies.
 * @param isDev - Indicates whether the application is running in development mode.
 * @param req - The incoming HTTP request object.
 * @param clear - Indicates whether to clear the session options.
 * @returns The session options for cookies.
 */
export function sessionOpts(isDev: boolean, req: IncomingMessage, clear = false) {
  const out = { ...OPT_HTTPONLY }

  if ( !isDev ) {
    const domain = (req.headers.host || '').replace(/:.*$/, '')

    out.domain = `.${ domain }`
  }

  if ( clear ) {
    return removeOpts(out)
  }

  return out
}

export function removeOpts(opt = OPT_REGULAR) {
  opt.maxAge = -1
  opt.expires = new Date('Wed, 24 Feb 1982 18:42:00 GMT')

  return opt
}
