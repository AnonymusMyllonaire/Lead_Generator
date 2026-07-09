import { PolarEmbedCheckout } from '@polar-sh/checkout/embed'

// Opens Polar's hosted checkout as an in-page overlay instead of a redirect.
// onSuccess fires when payment completes; the local subscription status still
// updates via the Polar webhook, so callers should poll status afterward.
export async function openPolarCheckout(checkoutUrl, { onSuccess, onClose } = {}) {
  if (!checkoutUrl) return null
  const checkout = await PolarEmbedCheckout.create(checkoutUrl, { theme: 'light' })
  if (onSuccess) checkout.addEventListener('success', onSuccess)
  if (onClose) checkout.addEventListener('close', onClose)
  return checkout
}
