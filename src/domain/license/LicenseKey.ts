/**
 * Secret holder for a license key.
 * Stored at `{collection}/{id}/secrets/current`. NEVER read by the client SDK —
 * reveal/rotate go through privileged server-side paths only.
 */
export interface LicenseKeySecret {
  key: string
  updatedAt: string
  updatedBy: string
}
