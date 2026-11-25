import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-panel" onSubmit={submit}>
      <span className="auth-kicker">YOUR VIBEMEET ACCOUNT</span>
      <h2>Welcome back.</h2>
      <p>Sign in to catch up with your people. They're only a call away.</p>
      <label className="auth-field">Email address
        <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="auth-field">Password
        <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {error && <p className="auth-form-error" role="alert">{error}</p>}
      <button className="auth-primary" type="submit" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in to VibeMeet'} <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}

export default LoginPage
