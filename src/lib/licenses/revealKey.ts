import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

/**
 * Calls the `revealLicenseKey` Cloud Function (super-admin only, server-enforced).
 * Returns the RAW key string.
 * The Cloud Function logs a masked `key_revealed` audit entry server-side.
 */
export async function revealLicenseKey(
  collection: 'licenses' | 'server_licenses',
  licenseId: string,
): Promise<string> {
  const callable = httpsCallable<
    { collection: string; licenseId: string },
    { key: string }
  >(functions(), 'revealLicenseKey')
  const res = await callable({ collection, licenseId })
  return res.data.key
}

/**
 * Calls the `setLicenseKey` Cloud Function to write (or rotate) a raw license
 * key into the secrets sub-collection. Super-admin only, server-enforced.
 */
export async function setLicenseKey(
  collection: 'licenses' | 'server_licenses',
  licenseId: string,
  rawKey: string,
): Promise<void> {
  const callable = httpsCallable<
    { collection: string; licenseId: string; rawKey: string },
    void
  >(functions(), 'setLicenseKey')
  await callable({ collection, licenseId, rawKey })
}
