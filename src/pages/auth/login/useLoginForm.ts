import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  signInWithGoogle, mapGoogleSignInError,
  signInWithUsernamePassword, mapPasswordSignInError,
} from '@/lib/auth'

export function useLoginForm() {
  const { t } = useTranslation('login')

  // Google sign-in state
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)

  // Login + password sign-in state
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [pwBusy, setPwBusy] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  async function handleGoogle() {
    setGoogleError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
      // AuthProvider's onAuthStateChanged takes over from here.
    } catch (err) {
      const kind = mapGoogleSignInError(err)
      const keyMap: Record<typeof kind, string> = {
        'unauthorized-domain': 'error.google.unauthorizedDomain',
        'popup-closed':        'error.google.popupClosed',
        'popup-blocked':       'error.google.popupBlocked',
        'operation-not-allowed': 'error.google.notEnabled',
        'domain-not-allowed':  'error.google.domainNotAllowed',
        'network':             'error.google.network',
        'unknown':             'error.googleFailed',
      }
      setGoogleError(t(keyMap[kind]))
    } finally {
      setGoogleBusy(false)
    }
  }

  async function handlePasswordSignIn() {
    setPwError(null)
    if (login.trim().length === 0 || password.length === 0) {
      setPwError(t('error.password.empty'))
      return
    }
    setPwBusy(true)
    try {
      await signInWithUsernamePassword(login, password, rememberMe)
      // AuthProvider's onAuthStateChanged takes over from here.
    } catch (err) {
      const kind = mapPasswordSignInError(err)
      const keyMap: Record<typeof kind, string> = {
        'invalid-credentials':   'error.password.invalid',
        'too-many-requests':     'error.password.tooMany',
        'user-disabled':         'error.password.disabled',
        'operation-not-allowed': 'error.password.notEnabled',
        'network':               'error.password.network',
        'unknown':               'error.password.unknown',
      }
      setPwError(t(keyMap[kind]))
    } finally {
      setPwBusy(false)
    }
  }

  return {
    googleError,
    googleBusy,
    login,
    setLogin,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    pwBusy,
    pwError,
    setPwError,
    handlePasswordSignIn,
    handleGoogle,
  }
}
