/**
 * Shared Tailwind className constants for repeated AMS patterns.
 * Import these instead of copy-pasting inline strings.
 * Use cn(CONSTANT, 'extra-classes') to append per-instance overrides.
 *
 * CONSERVATIVE extraction — only patterns with ≥3 verbatim occurrences.
 */

/**
 * Standard dialog/modal backdrop — z-50, bottom-sheet on mobile.
 * 8 usages: BranchFormDialog, ConfirmDeleteDialog, CategoryFormDialog,
 * DepartmentFormDialog, AssignLicenseDialog, LicenseFormDialog,
 * AssetStatusFormDialog, + RolesPage (with extra backdrop-blur-sm via cn).
 */
export const DIALOG_BACKDROP =
  'fixed inset-0 z-50 flex items-center justify-center max-md:items-end bg-black/60'

/**
 * License-module modal backdrop — z-200, centered, with blur and padding.
 * 4 usages: ActivateKeyModal, AddSubscriptionModal, KeyDetailsModal, ManageAssigneesModal.
 */
export const DIALOG_BACKDROP_BLUR =
  'fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 max-md:items-end max-md:p-0'

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
  'absolute inset-0 bg-black/60 backdrop-blur-[2px] anim-backdrop-fade'

/**
 * List-row separator — border bottom, remove on last child (border-b-0 variant).
 * Use when the row does NOT use border-0 shorthand.
 * 3 usages: RecentActivityList (×2), ActivateKeyModal.
 */
export const LIST_ROW_SEPARATOR = 'border-b border-border last:border-b-0'

/**
 * List-row separator — border bottom, remove on last child (border-0 variant).
 * Use when the row uses the border-0 shorthand (resets all borders on last child).
 * 3 usages: AssetHistory, PendingUsersPage, RolesPage.
 */
export const LIST_ROW_SEPARATOR_FULL = 'border-b border-border last:border-0'
