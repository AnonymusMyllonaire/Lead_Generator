import { useCallback, useEffect, useState } from 'react'

const TOKEN_KEY = 'lg_session_token'
const EMAIL_KEY = 'lg_session_email'
const API_BASE = import.meta.env.VITE_API_URL || ''

export default function useSession() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY) || '')
  const [status, setStatus] = useState('none')
  const [subscribed, setSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const persist = (nextToken, nextEmail) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(EMAIL_KEY, nextEmail)
    setToken(nextToken)
    setEmail(nextEmail)
  }

  const login = useCallback(async (rawEmail) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: rawEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed to start session')
      persist(data.token, data.email)
      setStatus(data.status)
      setSubscribed(data.subscribed)
      return data
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshStatus = useCallback(async () => {
    const currentToken = localStorage.getItem(TOKEN_KEY)
    if (!currentToken) return
    try {
      const res = await fetch(`${API_BASE}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      })
      if (!res.ok) return
      const data = await res.json()
      setStatus(data.status)
      setSubscribed(data.subscribed)
    } catch {
      // Best-effort refresh; ignore transient network errors.
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    setToken('')
    setEmail('')
    setStatus('none')
    setSubscribed(false)
  }, [])

  useEffect(() => {
    if (token) refreshStatus()
  }, [])

  return { token, email, status, subscribed, isLoading, error, login, logout, refreshStatus }
}
