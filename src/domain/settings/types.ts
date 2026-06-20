/** Shape of the /settings/auth Firestore doc, normalized for app use.
 *  allowedEmailDomains is the ONLY field beforeCreate reads. The other fields
 *  are preserved across writes (merge) but not edited by the UI. */
export interface AuthSettings {
  allowedEmailDomains: string[]
  emailLinkActionUrl?: string
  googleClientId?: string
  updatedAt?: string
  updatedBy?: string
}
