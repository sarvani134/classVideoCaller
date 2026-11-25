import { createHmac, timingSafeEqual } from 'node:crypto'

const tokenSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET.length >= 32 ? Buffer.from(process.env.JWT_SECRET) : null
  }
  // Render already requires CONNECTION_STRING for database access. Derive a
  // separate, stable signing key from it when no dedicated key is configured.
  if (!process.env.CONNECTION_STRING) return null
  return createHmac('sha256', process.env.CONNECTION_STRING)
    .update('VibeMeet access-token signing key v1')
    .digest()
}

export const isTokenSigningConfigured = () => Boolean(tokenSecret())

export const createAccessToken = (subject) => {
  const secret = tokenSecret()
  if (!secret) throw new Error('Token signing is not configured.')
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: subject, iat: now, exp: now + 7 * 24 * 60 * 60 })}`
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

export const checkJwt = (req, res, next) => {
  const secret = tokenSecret()
  if (!secret) return res.status(503).json({ msg: 'Authentication is not configured on the server.' })
  const match = /^Bearer\s+([\w.-]+)$/i.exec(req.headers.authorization || '')
  if (!match) return res.status(401).json({ msg: 'Please log in to continue.' })
  try {
    const [header, payload, signature] = match[1].split('.')
    if (!header || !payload || !signature) throw new Error('Malformed token')
    const headerClaims = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'))
    if (headerClaims.alg !== 'HS256' || headerClaims.typ !== 'JWT') throw new Error('Unsupported token')
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest()
    const supplied = Buffer.from(signature, 'base64url')
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error('Invalid signature')
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (claims.exp <= Math.floor(Date.now() / 1000) || typeof claims.sub !== 'string') throw new Error('Expired token')
    req.auth = { payload: claims }
    return next()
  } catch {
    return res.status(401).json({ msg: 'Your session expired. Please log in again.' })
  }
}
