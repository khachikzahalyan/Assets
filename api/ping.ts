/**
 * Trivial diagnostic endpoint — NO imports. If /api/ping works but
 * /api/notify-access crashes, the problem is that function's code/imports, not
 * the Vercel /api runtime itself. Safe to delete once the notify flow is stable.
 */
export default function handler(_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }): void {
  res.status(200).json({ ok: true, node: process.version, ts: Date.now() })
}
