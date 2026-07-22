/** Shape of the /settings/auth Firestore doc, normalized for app use.
 *
 *  Gate fields read by beforeCreate (both checked at runtime):
 *   - allowedEmailDomains — domain-level pass; empty list → no domain passes.
 *   - seedSuperAdmins     — exact-email bypass checked BEFORE the domain list;
 *                           allows specific addresses regardless of domain.
 *
 *  Other fields are preserved across writes (merge) but not edited by the UI. */
export interface AuthSettings {
  allowedEmailDomains: string[]
  /** Exact email addresses granted access regardless of allowedEmailDomains. */
  seedSuperAdmins?: string[]
  emailLinkActionUrl?: string
  googleClientId?: string
  updatedAt?: string
  updatedBy?: string
}
