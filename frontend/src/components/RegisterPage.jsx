import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'

function RegisterPage() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await register(name, email, password)
    } catch (requestError) {
      setError(requestError.response?.data?.msg || 'Could not create your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="auth-panel" onSubmit={submit}>
      <span className="auth-kicker">MAKE YOURSELF AT HOME</span>
      <h2>Let's get acquainted.</h2>
      <p>Create an account. Bring your people together. Start with a hello.</p>
      <label className="auth-field">Your name
        <input type="text" autoComplete="name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="auth-field">Email address
        <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <label className="auth-field">Password
        <input type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} />
        <small>Use at least 8 characters.</small>
      </label>
      {error && <p className="auth-form-error" role="alert">{error}</p>}
      <button className="auth-primary" type="submit" disabled={busy}>
        {busy ? 'Creating account…' : 'Join VibeMeet'} <span aria-hidden="true">→</span>
      </button>
    </form>
  )
}

export default RegisterPage
