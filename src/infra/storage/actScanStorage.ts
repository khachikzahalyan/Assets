import { getDownloadURL, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage'

export const ACT_MAX_BYTES = 10 * 1024 * 1024
export const ACT_CONTENT_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const
export type ActValidationError = 'too-large' | 'bad-type'

export function validateActFile(file: { size: number; type: string }): ActValidationError | null {
  if (file.size > ACT_MAX_BYTES) return 'too-large'
  if (!(ACT_CONTENT_TYPES as readonly string[]).includes(file.type)) return 'bad-type'
  return null
}

export function actStoragePath(assetId: string, fileName: string): string {
  return `acts/${assetId}/${fileName}`
}

/** Uploads the act scan and returns its storage path. Throws if validation fails. */
export async function uploadActScan(
  storage: FirebaseStorage, assetId: string, file: File,
): Promise<string> {
  const err = validateActFile(file)
  if (err) throw new Error(`Invalid act file: ${err}`)
  const path = actStoragePath(assetId, file.name)
  await uploadBytes(ref(storage, path), file, { contentType: file.type })
  return path
}

/** Resolves a download URL for a stored act scan. */
export async function actScanUrl(storage: FirebaseStorage, path: string): Promise<string> {
  return getDownloadURL(ref(storage, path))
}
