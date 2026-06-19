import { describe, it, expect } from 'vitest'
import { isValidEmail } from './EmployeeForm'

describe('isValidEmail', () => {
  it('accepts a normal address', () => { expect(isValidEmail('i@x.com')).toBe(true) })
  it('rejects malformed', () => { expect(isValidEmail('nope')).toBe(false); expect(isValidEmail('a@b')).toBe(false) })
})
