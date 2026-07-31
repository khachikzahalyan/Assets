/**
 * Shared Tailwind className constants for repeated AMS patterns.
 * Import these instead of copy-pasting inline strings.
 * Use cn(CONSTANT, 'extra-classes') to append per-instance overrides.
 *
 * CONSERVATIVE extraction — only patterns with ≥3 verbatim occurrences.
 */

/**
 * Standard dialog/modal backdrop — z-50, bottom-sheet on mobile.
 * Usages: BranchFormDialog, ConfirmDeleteDialog, CategoryFormDialog,
 * DepartmentFormDialog, AssignLicenseDialog, LicenseFormDialog,
 * + RolesPage (with extra backdrop-blur-sm via cn).
 */
export const DIALOG_BACKDROP =
  'fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60 light:bg-slate-900/35'

/**
 * License-module modal backdrop — z-200, centered, with blur and padding.
 * 4 usages: ActivateKeyModal, AddSubscriptionModal, KeyDetailsModal, ManageAssigneesModal.
 */
export const DIALOG_BACKDROP_BLUR =
  'fixed inset-0 z-[200] bg-black/60 light:bg-slate-900/35 backdrop-blur-sm flex items-center justify-center p-4 max-md:items-end max-md:p-0'

/**
 * Mobile bottom-sheet panel classes — slide up from bottom on ≤767px.
 * Apply to the modal panel div alongside desktop sizing classes.
 * Pair with DIALOG_BACKDROP or DIALOG_BACKDROP_BLUR (both already have max-md:items-end).
 */
export const MODAL_SHEET =
  'max-md:w-full max-md:max-w-full max-md:rounded-t-[18px] max-md:rounded-b-none max-md:max-h-[90vh] max-md:overflow-y-auto max-md:[animation:amsSheetIn_0.22s_ease-out]'

/**
 * Absolute inner backdrop for portal-based modals (EmployeeModalShell, HandoverModal, Drawer).
 * 3 usages.
 */
export const MODAL_BACKDROP_ABS =
  'absolute inset-0 bg-black/60 light:bg-slate-900/35 backdrop-blur-[2px] anim-backdrop-fade'

/**
 * List-row separator — border bottom, remove on last child (border-b-0 variant).
 * Use when the row does NOT use border-0 shorthand.
 * 3 usages: RecentActivityList (×2), ActivateKeyModal.
 */
export const LIST_ROW_SEPARATOR = 'border-b border-border last:border-b-0'

/**
 * Modal panel width tokens — pair with MODAL_SHEET and layout/border classes.
 * Use: cn(MODAL_W_MD, 'rounded-lg border border-border bg-surface p-5 mx-4 max-md:mx-0', MODAL_SHEET)
 *
 * MODAL_W_SM  — 2 usages: ConfirmDeleteDialog, AssignLicenseDialog
 * MODAL_W_MD  — 3 usages: DepartmentFormDialog, AuthSettingsPanel (DialogShell), BranchFormDialog
 * MODAL_W_LG  — 3 usages: CategoryGroupFormDialog, CategoryFormDialog, LicenseFormDialog
 * MODAL_W_XL  — 1 usage:  PartCategoryFormDialog (included for symmetry with the full size set)
 */
export const MODAL_W_SM = 'w-full max-w-[var(--modal-w-sm)]'
export const MODAL_W_MD = 'w-full max-w-[var(--modal-w-md)]'
export const MODAL_W_LG = 'w-full max-w-[var(--modal-w-lg)]'
export const MODAL_W_XL = 'w-full max-w-[var(--modal-w-xl)]'
