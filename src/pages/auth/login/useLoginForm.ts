import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { completeEmailLinkIfPresent, sendEmployeeLink, signInWithGoogle } from '@/lib/auth'

/** Minimal email validity check — non-empty and contains @. */
function isValidEmail(v: string): boolean {
  return v.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export function useLoginForm() {
  const { t } = useTranslation('login')

  // Email-link completion state
  const [linkCheckError, setLinkCheckError] = useState<string | null>(null)
  const [linkChecking, setLinkChecking] = useState(false)

  // Google sign-in state
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)

  // Employee email-link request state
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSent, setLinkSent] = useState(false)

  // On mount: complete email link if current URL is a sign-in link
  useEffect(() => {
    let cancelled = false
    setLinkChecking(true)
    void completeEmailLinkIfPresent(t('confirmEmailPrompt'))
      .then(() => {
        if (!cancelled) setLinkChecking(false)
        // Auth state is driven by AuthProvider; no manual navigate needed.
      })
      .catch(() => {
        if (!cancelled) {
          setLinkChecking(false)
          setLinkCheckError(t('error.emailLinkFailed'))
        }
      })
    return () => { cancelled = true }
  // Run once on mount only — t is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGoogle() {
    setGoogleError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
      // AuthProvider's onAuthStateChanged takes over from here.
    } catch {
      setGoogleError(t('error.googleFailed'))
    } finally {
      setGoogleBusy(false)
    }
  }

  async function handleSendLink() {
    setEmailError(null)
    setLinkError(null)
    if (!isValidEmail(email)) {
      setEmailError(t('employee.invalidEmail'))
      return
    }
    setLinkBusy(true)
    try {
      await sendEmployeeLink(email.trim())
      setLinkSent(true)
    } catch {
      setLinkError(t('error.linkFailed'))
    } finally {
      setLinkBusy(false)
    }
  }

  return {
    linkCheckError,
    linkChecking,
    googleError,
    googleBusy,
    email,
    setEmail,
    emailError,
    setEmailError,
    linkBusy,
    linkError,
    setLinkError,
    linkSent,
    setLinkSent,
    handleGoogle,
    handleSendLink,
  }
}
