// scripts/grant-super-admin.ts
// ONE-TIME bootstrap: mint the first super_admin. The Admin SDK bypasses Firestore
// rules, which is the only way to grant the first privileged role — in the app, only
// an existing super_admin can grant roles (chicken-and-egg), so this script breaks
// the cycle once, at go-live.
//
// Usage: tsx scripts/grant-super-admin.ts <uid|email> [--project <id>]
//
// Guards: requires an explicit argument; resolves email -> uid via Admin Auth; prints
// the resolved uid/email/displayName + target project before writing; refuses if no
// matching Firebase Auth user exists (no silent creation of a bogus account). Only
// ever sets role/status — never deletes anything.
import { initAdmin, Timestamp } from './seed/adminApp'

async function main() {
  const args = process.argv.slice(2)
  let project: string | undefined
  const positionals: string[] = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--project') project = args[++i]
    else positionals.push(args[i]!)
  }
  const target = positionals[0]
  if (!target) {
    console.error('Usage: tsx scripts/grant-super-admin.ts <uid|email> [--project <id>]')
    process.exit(2)
  }

  const { db, auth, projectId } = initAdmin(project)

  // Resolve email -> uid if needed.
  let uid = target
  let email = ''
  let displayName = ''
  try {
    const rec = target.includes('@') ? await auth.getUserByEmail(target) : await auth.getUser(target)
    uid = rec.uid; email = rec.email ?? ''; displayName = rec.displayName ?? ''
  } catch {
    console.error(`No Firebase Auth user found for "${target}" in project "${projectId}".`)
    console.error('The person must sign in to the app ONCE first (creates their auth record).')
    process.exit(1)
  }

  console.log(`Project: ${projectId}`)
  console.log(`Granting super_admin to: uid=${uid} email=${email} name="${displayName}"`)

  const ref = db.collection('users').doc(uid)
  const snap = await ref.get()
  if (!snap.exists) {
    // The user self-claims a no-role doc on first sign-in; if absent, create a complete one.
    await ref.set({
      email, displayName, role: 'super_admin', status: 'active',
      createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
    })
    console.log(`Created users/${uid} with role=super_admin (no prior self-claim doc existed).`)
  } else {
    await ref.set({ role: 'super_admin', status: 'active', updatedAt: Timestamp.now() }, { merge: true })
    console.log(`Updated users/${uid} -> role=super_admin, status=active.`)
  }
  console.log('\nDone. Sign out and back in to refresh the in-app role.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
