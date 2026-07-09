import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'

const API_BASE = import.meta.env.VITE_API_URL || ''

// The embedded overlay requires a checkout session created server-side with
// embed_origin set to this exact page's origin — a static Checkout Link can't
// be framed, so we always ask the backend for a fresh session URL first.
async function createCheckoutUrl(email) {
  const res = await fetch(`${API_BASE}/api/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to start checkout')
  }
  const data = await res.json()
  return data.url
}

// Opens Polar's checkout as an in-page overlay instead of a redirect.
// onSuccess fires when payment completes; the local subscription status still
// updates via the Polar webhook, so callers should poll status afterward.
export async function openPolarCheckout(email, { onSuccess, onClose } = {}) {
  const checkoutUrl = await createCheckoutUrl(email)
  const checkout = await PolarEmbedCheckout.create(checkoutUrl, { theme: 'light' })
  if (onSuccess) checkout.addEventListener('success', onSuccess)
  if (onClose) checkout.addEventListener('close', onClose)
  return checkout
}
