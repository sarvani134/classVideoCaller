import bcrypt from 'bcrypt'
import { randomUUID } from 'node:crypto'
import { User } from '../models/userModel.js'
import { createAccessToken, isTokenSigningConfigured } from '../middlewares/authMiddleware.js'

const normalizeEmail = (value) => typeof value === 'string' ? value.trim().toLowerCase() : ''
const safeUser = (user) => ({ id: user.auth0Id, name: user.name || '', email: user.email || '', picture: user.picture || '' })

const validateCredentials = (email, password) => {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return 'Enter a valid email address.'
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return 'Password must be at least 8 characters and no more than 72 bytes.'
  }
  return ''
}

const respondWithSession = (user, res, status = 200) => {
  const token = createAccessToken(user.auth0Id)
  return res.status(status).json({ token, user: safeUser(user) })
}

export const register = async (req, res) => {
  if (!isTokenSigningConfigured()) return res.status(503).json({ msg: 'Authentication is not configured on the server.' })
  const email = normalizeEmail(req.body?.email)
  const password = req.body?.password
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 80) : ''
  const validationError = validateCredentials(email, password)
  if (validationError) return res.status(400).json({ msg: validationError })
  if (!name) return res.status(400).json({ msg: 'Enter your name.' })

  try {
    if (await User.exists({ emailNormalized: email })) return res.status(409).json({ msg: 'An account with this email already exists. Please sign in.' })
    const auth0Id = `local:${randomUUID()}`
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ auth0Id, userId: auth0Id, name, email, emailNormalized: email, passwordHash })
    return respondWithSession(user, res, 201)
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ msg: 'An account with this email already exists. Please sign in.' })
    console.error('Account registration failed:', error.message)
    return res.status(500).json({ msg: 'Unable to create your account right now.' })
  }
}

export const login = async (req, res) => {
  if (!isTokenSigningConfigured()) return res.status(503).json({ msg: 'Authentication is not configured on the server.' })
  const email = normalizeEmail(req.body?.email)
  const password = req.body?.password
  if (!email || typeof password !== 'string') return res.status(400).json({ msg: 'Enter your email and password.' })
  try {
    const user = await User.findOne({ emailNormalized: email }).select('+passwordHash')
    if (!user?.passwordHash || !await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ msg: 'Email or password is incorrect.' })
    }
    return respondWithSession(user, res)
  } catch (error) {
    console.error('Sign in failed:', error.message)
    return res.status(500).json({ msg: 'Unable to sign in right now.' })
  }
}

export const currentUser = async (req, res) => {
  try {
    const user = await User.findOne({ auth0Id: req.auth.payload.sub })
    if (!user) return res.status(401).json({ msg: 'Your account could not be found. Please sign in again.' })
    return res.json({ user: safeUser(user) })
  } catch (error) {
    console.error('Account lookup failed:', error.message)
    return res.status(500).json({ msg: 'Unable to load your account.' })
  }
}
