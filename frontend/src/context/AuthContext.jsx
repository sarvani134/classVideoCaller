import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api'

const AuthContext = createContext(null)
const SESSION_KEY = 'vibemeet-session-token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem(SESSION_KEY) || '')
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const endSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    setToken('')
    setUser(null)
  }, [])

  useEffect(() => {
    let active = true
    if (!token) {
      setIsLoading(false)
      return () => { active = false }
    }
    api.get('/users/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => { if (active) setUser(data.user) })
      .catch(() => { if (active) endSession() })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [token, endSession])

  const acceptSession = useCallback((data) => {
    sessionStorage.setItem(SESSION_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
  }, [])

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/users/auth/login', { email, password })
    acceptSession(data)
    return data.user
  }, [acceptSession])

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/users/auth/register', { name, email, password })
    acceptSession(data)
    return data.user
  }, [acceptSession])

  const getAccessTokenSilently = useCallback(async () => {
    if (!token) throw new Error('Please sign in again.')
    return token
  }, [token])

  const value = useMemo(() => ({
    user,
    isAuthenticated: Boolean(user && token),
    isLoading,
    login,
    register,
    logout: endSession,
    getAccessTokenSilently,
  }), [user, token, isLoading, login, register, endSession, getAccessTokenSilently])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
