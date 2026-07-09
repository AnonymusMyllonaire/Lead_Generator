import { useState } from 'react'
import { openPolarCheckout } from '../lib/polarCheckout'

export default function PaywallOverlay({ subscribed, lockedCount, email, onUpgraded, children }) {
  const [checkoutError, setCheckoutError] = useState(null)

  if (subscribed || !lockedCount) return children

  const handleUnlock = async () => {
    setCheckoutError(null)
    try {
      await openPolarCheckout(email, {
        onSuccess: () => {
          let attempts = 0
          const interval = setInterval(() => {
            attempts += 1
            onUpgraded?.()
            if (attempts >= 6) clearInterval(interval)
          }, 3000)
        },
      })
    } catch (err) {
      setCheckoutError(err.message)
    }
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-6 text-center max-w-sm">
          <p className="font-semibold text-gray-900">
            {lockedCount} more result{lockedCount !== 1 ? 's' : ''} locked
          </p>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Subscribe to unlock the full list and CSV export.
          </p>
          {email ? (
            <button
              onClick={handleUnlock}
              className="inline-block px-5 py-2 bg-emerald-600 text-white text-sm font-medium
                rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Unlock full results
            </button>
          ) : (
            <p className="text-sm text-gray-400">Enter your email above to unlock.</p>
          )}
          {checkoutError && <p className="text-xs text-red-500 mt-2">{checkoutError}</p>}
        </div>
      </div>
    </div>
  )
}
