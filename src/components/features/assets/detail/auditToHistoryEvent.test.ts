/**
 * Pure unit tests for `auditToHistoryEvent` mapping and `buildSpecsLines` / `buildSpecsCopyText`.
 * No React, no rendering — just pure function verification.
 */
import { describe, it, expect } from 'vitest'
import { auditToHistoryEvent } from './auditToHistoryEvent'
import { buildSpecsLines, buildSpecsCopyText } from './detailFormat'
import type { AuditLog } from '@/domain/audit'
import type { AssetReferenceData } from '@/domain/asset'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const REF: AssetReferenceData = {
  statuses:       [],
  branches:       [{ id: 'br_g', name: 'Филиал Гюмри' }],
  departments:    [],
  categories:     [],
  employees:      [{ id: 'u_1', firstName: 'Иван', lastName: 'Петров', email: 'ivan@example.test' }],
  categoryGroups: [],
}

function mkLog(over: Partial<AuditLog>): AuditLog {
  return {
    id:        'log_1',
    entityType: 'asset',
    entityId:  'a_1',
    action:    'created',
    actorUid:  'u_system',
    actorRole: 'asset_admin',
    at:        '2026-01-15T12:00:00.000Z',
    before:    null,
    after:     null,
    comment:   null,
    ...over,
  }
}

// ---------------------------------------------------------------------------
// auditToHistoryEvent
// ---------------------------------------------------------------------------

describe('auditToHistoryEvent', () => {
  it("maps 'created' to icon 'plus' and action 'Создан в системе'", () => {
    // Arrange
    const log = mkLog({ action: 'created', actorUid: 'u_1' })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('plus')
    expect(ev.action).toBe('Создан в системе')
    expect(ev.actor).toBe('Иван Петров')   // resolved from REF.employees
  })

  it("maps 'disposed' (action) to icon 'archive-x' and action 'Списан'", () => {
    // Arrange
    const log = mkLog({ action: 'disposed', comment: 'Разбит экран' })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('archive-x')
    expect(ev.action).toBe('Списан')
    expect(ev.after).toBe('Разбит экран')
  })

  it("maps 'sent_to_repair' to icon 'hammer' and forwards comment as after", () => {
    // Arrange
    const log = mkLog({ action: 'sent_to_repair', comment: 'Сломалась клавиатура' })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('hammer')
    expect(ev.action).toBe('Отправлен в ремонт')
    expect(ev.after).toBe('Сломалась клавиатура')
  })

  it("maps 'status_changed' with statusId 'st_assigned' to icon 'arrow-right-left' and action 'Передача'", () => {
    // Arrange
    const log = mkLog({
      action: 'status_changed',
      before: { statusId: 'st_warehouse' },
      after:  { statusId: 'st_assigned' },
    })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('arrow-right-left')
    expect(ev.action).toBe('Передача')
  })

  it("maps 'status_changed' with statusId 'st_disposed' to icon 'archive-x'", () => {
    // Arrange
    const log = mkLog({
      action: 'status_changed',
      after:  { statusId: 'st_disposed' },
    })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('archive-x')
    expect(ev.action).toBe('Списан')
  })

  it("maps 'status_changed' with statusId 'st_repair' to icon 'hammer'", () => {
    // Arrange
    const log = mkLog({
      action: 'status_changed',
      after:  { statusId: 'st_repair' },
    })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('hammer')
    expect(ev.action).toBe('Отправлен в ремонт')
  })

  it("maps 'status_changed' with statusId 'st_warehouse' (return) to icon 'arrow-right-left' and action 'Возврат на склад'", () => {
    // Arrange
    const log = mkLog({
      action: 'status_changed',
      after:  { statusId: 'st_warehouse' },
    })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('arrow-right-left')
    expect(ev.action).toBe('Возврат на склад')
  })

  // INTENTIONALLY CHANGED: previously asserted raw uid; now forbids raw uid —
  // graceful fallback is «Администратор» when the uid is not in ref.employees
  // and no actorCtx matches.
  it('falls back actor to «Администратор» (not raw uid) when no employee name match', () => {
    // Arrange: actorUid does not match any employee and no actorCtx provided
    const log = mkLog({ action: 'created', actorUid: 'unknown_uid' })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert: graceful fallback, never the raw uid
    expect(ev.actor).toBe('Администратор')
  })

  // -------------------------------------------------------------------------
  // Transfer delta tests (BUG 1)
  // -------------------------------------------------------------------------

  it('transfer warehouse→branch: resolves before=«Склад» and after=«Филиал Гюмри»', () => {
    // Arrange: status_changed with nested assignment — warehouse side has null assignment
    const log = mkLog({
      action: 'status_changed',
      before: { statusId: 'st_warehouse', assignment: null },
      after:  { statusId: 'st_assigned',  assignment: { mode: 'branch', branchId: 'br_g' } },
    })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('arrow-right-left')
    expect(ev.action).toBe('Передача')
    expect(ev.before).toBe('Склад')
    expect(ev.after).toBe('Филиал Гюмри')
  })

  it('transfer employee→warehouse: resolves before=employee name and after=«Склад»', () => {
    // Arrange: before has an employee assignment, after has null (warehouse)
    const log = mkLog({
      action: 'status_changed',
      before: { statusId: 'st_assigned',  assignment: { mode: 'employee', employeeId: 'u_1' } },
      after:  { statusId: 'st_warehouse', assignment: null },
    })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert
    expect(ev.icon).toBe('arrow-right-left')
    expect(ev.action).toBe('Передача')
    expect(ev.before).toBe('Иван Петров')
    expect(ev.after).toBe('Склад')
  })

  // -------------------------------------------------------------------------
  // Actor resolution tests (BUG 2)
  // -------------------------------------------------------------------------

  it('actor resolves to «Вы» when actorUid matches currentUid in actorCtx', () => {
    // Arrange
    const log = mkLog({ action: 'created', actorUid: 'u_me' })

    // Act
    const ev = auditToHistoryEvent(log, REF, { currentUid: 'u_me' })

    // Assert: «Вы», not the name, not the uid
    expect(ev.actor).toBe('Вы')
  })

  it('actor graceful fallback: unknown uid + no actorCtx match → «Администратор», not raw uid', () => {
    // Arrange: uid not in employees, no actorCtx
    const log = mkLog({ action: 'created', actorUid: 'some_admin_uid' })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert: graceful fallback
    expect(ev.actor).toBe('Администратор')
  })

  it('actor resolves via actorCtx.resolveUid when not in employees', () => {
    // Arrange: uid not in employees, but resolveUid callback knows the name
    const log = mkLog({ action: 'created', actorUid: 'u_admin_42' })

    // Act
    const ev = auditToHistoryEvent(log, REF, {
      currentUid:  'u_other',
      resolveUid:  (uid) => uid === 'u_admin_42' ? 'Другой Админ' : undefined,
    })

    // Assert: name from resolveUid wins over «Администратор»
    expect(ev.actor).toBe('Другой Админ')
  })

  // -------------------------------------------------------------------------
  // Lifecycle status change still works (no assignment key → NOT a transfer)
  // -------------------------------------------------------------------------

  it("lifecycle status_changed with st_disposed (no assignment key) → icon 'archive-x', action 'Списан'", () => {
    // Arrange: no assignment key present — pure lifecycle change
    const log = mkLog({
      action: 'status_changed',
      after:  { statusId: 'st_disposed' },
    })

    // Act
    const ev = auditToHistoryEvent(log, REF)

    // Assert: lifecycle path, NOT treated as a transfer
    expect(ev.icon).toBe('archive-x')
    expect(ev.action).toBe('Списан')
    expect(ev.before).toBeUndefined()
    expect(ev.after).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// buildSpecsLines / buildSpecsCopyText
// ---------------------------------------------------------------------------

describe('buildSpecsLines', () => {
  it('returns empty array for null specs', () => {
    expect(buildSpecsLines(null)).toEqual([])
  })

  it('returns empty array for empty specs object', () => {
    expect(buildSpecsLines({})).toEqual([])
  })

  it('builds cpu→gpu→ram→ssd as first 4 lines for a laptop category (in spec order)', () => {
    // Arrange — use cat_laptop so GPU is included; laptop adds Cooling+Battery = 6 total
    const specs = { cpu: 'Intel i7', gpu: 'RTX 3060', ram: '16 ГБ', ssd: '512 ГБ' }

    // Act
    const lines = buildSpecsLines(specs, 'cat_laptop')

    // Assert order and content — labels carried as i18n keys, not resolved strings
    expect(lines).toHaveLength(6)
    expect(lines[0]).toMatchObject({ labelKey: 'form.specCpu', value: 'Intel i7',  icon: 'cpu',           accent: 'indigo'  })
    expect(lines[1]).toMatchObject({ labelKey: 'form.specGpu', value: 'RTX 3060',  icon: 'circuit-board', accent: 'violet'  })
    expect(lines[2]).toMatchObject({ labelKey: 'form.specRam', value: '16 ГБ',     icon: 'memory-stick',  accent: 'emerald' })
    expect(lines[3]).toMatchObject({ labelKey: 'form.specSsd', value: '512 ГБ',    icon: 'hard-drive',    accent: 'sky'     })
  })

  it('skips missing fields', () => {
    // Arrange: only cpu + ram provided
    const specs = { cpu: 'Intel i5', ram: '8 ГБ' }

    // Act
    const lines = buildSpecsLines(specs)

    // Assert: only two lines, no gpu / ssd
    expect(lines).toHaveLength(2)
    expect(lines[0]!.labelKey).toBe('form.specCpu')
    expect(lines[1]!.labelKey).toBe('form.specRam')
  })
})

describe('buildSpecsCopyText', () => {
  /** Minimal label resolver matching the Russian locale values. */
  const resolveRu = (key: string) => ({
    'form.specCpu': 'Процессор',
    'form.specGpu': 'Видеокарта',
    'form.specRam': 'Оперативная память',
    'form.specSsd': 'Накопитель',
  }[key] ?? key)

  it('joins lines as "Label: Value" separated by newlines', () => {
    // Arrange
    const lines = buildSpecsLines({ cpu: 'Intel i7', ram: '16 ГБ' })

    // Act
    const text = buildSpecsCopyText(lines, resolveRu)

    // Assert: exact string, render order cpu first
    expect(text).toBe('Процессор: Intel i7\nОперативная память: 16 ГБ')
  })

  it('returns empty string for empty lines array', () => {
    expect(buildSpecsCopyText([], resolveRu)).toBe('')
  })
})
