import type { Firestore } from 'firebase/firestore'
import { getLicenseSecretKey } from './licenseSecrets'
import { maskLicenseKey } from '@/lib/audit'

/**
 * Reads the license key for the given collection + id and returns it in
 * MASKED form (last-4 alphanumeric revealed, everything else is `*`).
 *
 * Returns the em-dash placeholder `'—'` when no key has been set.
 * The raw key is NEVER returned; callers that need the full key should use
 * `revealLicenseKey` from `@/lib/licenses/revealKey`.
 *
 * Gated by firestore.rules:
 *   /licenses secrets       — super_admin OR tech_admin
 *   /server_licenses secrets — super_admin only
 */
export async function getMaskedLicenseKey(
  db: Firestore,
  col: 'licenses' | 'server_licenses',
  licenseId: string,
): Promise<string> {
  const raw = await getLicenseSecretKey(db, col, licenseId)
  if (raw === null) return '—'
  return maskLicenseKey(raw) as string
}
