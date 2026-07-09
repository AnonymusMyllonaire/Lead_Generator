const CHECKOUT_URL = import.meta.env.VITE_POLAR_CHECKOUT_URL || ''

export default function PaywallOverlay({ subscribed, lockedCount, email, children }) {
  if (subscribed || !lockedCount) return children

  const checkoutHref = CHECKOUT_URL
    ? `${CHECKOUT_URL}${email ? `?customer_email=${encodeURIComponent(email)}` : ''}`
    : '#'

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
          <a
            href={checkoutHref}
            target="_blank"
            rel="noreferrer"
            className="inline-block px-5 py-2 bg-emerald-600 text-white text-sm font-medium
              rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Unlock full results
          </a>
        </div>
      </div>
    </div>
  )
}
