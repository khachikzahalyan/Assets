/**
 * Client helper — in-app receipt confirmation for a logged-in employee.
 *
 * Attaches the current user's Firebase ID token and POSTs to the Vercel function
 * `/api/confirm-receipt-app`, which verifies the caller is the asset's assignee and
 * flips st_pending → st_assigned via the service-account. Mirrors the email
 * magic-link path (api/confirm-receipt.ts) but requires an authenticated session.
 *
 * Returns `{ ok }` and never throws. The endpoint only exists on the deployed Vercel
 * app (and under `vercel dev`); plain `vite` dev has no `/api`, so `ok` is false there.
 */

import { auth } from '@/lib/firebase'

export async function confirmReceipt(assetId: string): Promise<{ ok: boolean }> {
  const id = assetId?.trim()
  if (!id) return { ok: false }
  try {
    const user = auth().currentUser
    if (!user) return { ok: false }
    const token = await user.getIdToken()

    const res = await fetch('/api/confirm-receipt-app', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ assetId: id }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
