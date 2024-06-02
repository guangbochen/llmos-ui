import dotenv from 'dotenv'

dotenv.config()

export const api = clean(process.env.API || process.env.NUXT_PUBLIC_API || 'https://localhost:8443')
export const isDev = process.env.NODE_ENV === 'development'

function clean(url: string) {
  return (url || '').trim().replace(/\/+$/, '')
}
