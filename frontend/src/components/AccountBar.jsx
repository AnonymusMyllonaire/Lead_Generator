import { useState } from 'react'
import { openPolarCheckout } from '../lib/polarCheckout'

const CHECKOUT_URL = import.meta.env.VITE_POLAR_CHECKOUT_URL || ''

export default function AccountBar({ session }) {
  const { email, status, subscribed, isLoading, error, login, logout, refreshStatus } = session
  const [inputEmail, setInputEmail] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputEmail.trim()) return
    try {
      await login(inputEmail.trim())
    } catch {
      // error is surfaced via session.error
    }
  }

  const handleUpgrade = () => {
    if (!CHECKOUT_URL) return
    const checkoutHref = `${CHECKOUT_URL}?customer_email=${encodeURIComponent(email)}`
    openPolarCheckout(checkoutHref, {
      onSuccess: () => {
        // The webhook that flips our DB status may land a few seconds after
        // payment confirms, so poll status a handful of times to catch up.
        let attempts = 0
        const interval = setInterval(() => {
          attempts += 1
          refreshStatus()
          if (attempts >= 6) clearInterval(interval)
        }, 3000)
      },
    })
  }

  if (!email) {
    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="email"
          value={inputEmail}
          onChange={e => setInputEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-48 px-3 py-1.5 text-sm border border-gray-300 rounded-lg
            focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-3 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg
            hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap transition-colors"
        >
          {isLoading ? 'Checking…' : 'Check access'}
        </button>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </form>
    )
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-500 truncate max-w-[180px]" title={email}>{email}</span>
      {subscribed ? (
        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full">
          Active
        </span>
      ) : (
        <button
          onClick={handleUpgrade}
          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg
            hover:bg-emerald-700 transition-colors whitespace-nowrap"
        >
          Upgrade
        </button>
      )}
      <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-700 underline">
        Sign out
      </button>
      <span className="text-xs text-gray-300 hidden sm:inline">· {status}</span>
    </div>
  )
}
