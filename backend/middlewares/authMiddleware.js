import 'dotenv/config'
import { auth } from 'express-oauth2-jwt-bearer'

export const checkJwt = auth({
   audience: process.env.AUTH0_AUDIENCE,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || 'https://dev-nlpzoekt84zq0v7d.us.auth0.com/',
  tokenSigningAlg: 'RS256'
})
