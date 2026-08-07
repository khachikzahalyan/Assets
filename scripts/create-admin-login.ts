// scripts/create-admin-login.ts
// Provision a username/password admin account for the login form.
//
// Creates (or updates) a Firebase Auth email/password user for a bare username —
// "superadmin" is stored as "superadmin@ams.local" (the synthetic-email domain the
// client uses in usernameToEmail()) — and writes users/{uid} with role super_admin.
// The Admin SDK bypasses Firestore rules, which is required to mint the first
// privileged role (chicken-and-egg: only a super_admin can grant roles in-app).
//
// Usage:
//   tsx scripts/create-admin-login.ts [username] [password] [--role <role>] [--project <id>] [--confirm]
//   defaults: username=superadmin  password=ams123  role=super_admin
//
// Guards: PREVIEW-by-default (no write without --confirm/--yes); prints resolved
// email/uid/role + target project before writing; never deletes anything.
//
// NOTE: the Email/Password sign-in provider must be ENABLED in Firebase Auth for
// the client signInWithEmailAndPassword to work (Console → Authentication →
// Sign-in method → Email/Password → Enable). The Admin SDK createUser below works
// regardless, but client sign-in will fail with auth/operation-not-allowed until
// the provider is on.
import { initAdmin, Timestamp } from './seed/adminApp'

// Keep in sync with USERNAME_EMAIL_DOMAIN in src/lib/auth/index.ts.
const USERNAME_EMAIL_DOMAIN = 'ams.local'
const VALID_ROLES = new Set(['super_admin', 'asset_admin', 'tech_admin', 'employee'])

function usernameToEmail(login: string): string {
  const v = login.trim()
  return v.includes('@') ? v.toLowerCase() : `${v.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`
}

async function main() {
  const args = process.argv.slice(2)
  let project: string | undefined
  let role = 'super_admin'
  let confirm = false
  const positionals: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') project = args[++i]
    else if (args[i] === '--role') role = args[++i]!
    else if (args[i] === '--confirm' || args[i] === '--yes') confirm = true
    else positionals.push(args[i]!)
  }

  const username = positionals[0] ?? 'superadmin'
  const password = positionals[1] ?? 'ams123'
  const email = usernameToEmail(username)

  if (!VALID_ROLES.has(role)) {
    console.error(`Invalid role "${role}". One of: ${[...VALID_ROLES].join(', ')}`)
    process.exit(2)
  }
  if (password.length < 6) {
    console.error('Firebase requires a password of at least 6 characters.')
    process.exit(2)
  }

  const { db, auth, projectId } = initAdmin(project)

  console.log(`Project: ${projectId}`)
  console.log(`Login "${username}" -> email ${email}, role=${role}`)

  if (!confirm) {
    console.log('\nPREVIEW only. Re-run with --confirm to create/update the account.')
    process.exit(0)
  }

  // 1. Firebase Auth user — create, or update the password if it already exists.
  let uid: string
  try {
    const existing = await auth.getUserByEmail(email)
    uid = existing.uid
    await auth.updateUser(uid, { password, emailVerified: true, disabled: false })
    console.log(`Updated existing auth user (password reset): uid=${uid}`)
  } catch {
    const created = await auth.createUser({ email, password, emailVerified: true, displayName: username })
    uid = created.uid
    console.log(`Created auth user: uid=${uid}`)
  }

  // 2. users/{uid} role doc — the server-trusted role the app reads at sign-in.
  const ref = db.collection('users').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) {
    await ref.set({
      email, displayName: username, role, status: 'active',
      createdBy: 'system', updatedBy: 'system',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    })
    console.log(`Created users/${uid} with role=${role}.`)
  } else {
    await ref.set(
      { role, status: 'active', updatedBy: 'system', updatedAt: Timestamp.now() },
      { merge: true })
    console.log(`Updated users/${uid} -> role=${role}, status=active.`)
  }

  console.log('\nDone. Enable Email/Password provider in Firebase Auth if not already,')
  console.log(`then sign in with login "${username}" and the password you set.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
