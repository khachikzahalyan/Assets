/**
 * Client helper — fires the AMS access-notification email.
 *
 * Single call site for the triggers (role granted / employee added / asset handed over). It attaches
 * the current admin's Firebase ID token and POSTs to the Vercel function
 * `/api/notify-access` (same origin). BEST-EFFORT by contract: it never throws
 * and returns `{ ok }`, so callers can show a non-blocking toast on failure and
 * NEVER revert the admin action that already succeeded.
 *
 * Note: the endpoint only exists on the deployed Vercel app (and under
 * `vercel dev`); plain `vite` dev has no `/api`, so `ok` will be false there.
 */

import { auth } from '@/lib/firebase'

export interface SendAccessEmailInput {
  /** Recipient email (the invited/added person's gmail). */
  email: string
  /** Recipient display name (optional; server falls back to email/brand). */
  name?: string
  /** 'role' = access granted; 'employee' = HR record created; 'asset' = asset handed over. */
  kind: 'role' | 'employee' | 'asset'
  /** Human-readable RU role label, for kind='role'. */
  roleLabel?: string
  /** Role id (super_admin | asset_admin | tech_admin | employee) — selects the badge icon in the email. */
  role?: string
  /** Asset display label (brand+model or category), for kind='asset'. */
  assetLabel?: string
  /** Asset inventory code, for kind='asset'. */
  assetCode?: string
}

export async function sendAccessEmail(input: SendAccessEmailInput): Promise<{ ok: boolean }> {
  const email = input.email?.trim()
  if (!email) return { ok: false }

  try {
    const user = auth().currentUser
    if (!user) return { ok: false }
    const token = await user.getIdToken()

    const res = await fetch('/api/notify-access', {
      method: 'POST',
      // keepalive → the request completes even if the page navigates/re-renders
      // right after firing (transfer closes the panel + reloads data).
      keepalive: true,
      headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email,
        name: input.name ?? '',
        kind: input.kind,
        ...(input.roleLabel ? { roleLabel: input.roleLabel } : {}),
        ...(input.role ? { role: input.role } : {}),
        ...(input.assetLabel ? { assetLabel: input.assetLabel } : {}),
        ...(input.assetCode ? { assetCode: input.assetCode } : {}),
      }),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}
