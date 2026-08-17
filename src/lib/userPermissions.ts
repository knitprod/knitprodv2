/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRecord } from '../components/UserManagementView';

export const ALL_FACTORY_FLOORS: string[] = [
  'EKL',
  'EFL',
  'EFL-2',
  'Auto Stripe',
  'EFL-Extension',
  'ESL-Extension',
  'Sub-Contact'
];

/**
 * Normalizes floor names across spelling / hyphen variations
 */
export const normalizeFloorKey = (floor: string): string => {
  if (!floor) return '';
  const clean = floor.trim().toLowerCase().replace(/[-\s_]/g, '');
  if (clean === 'ekl') return 'EKL';
  if (clean === 'efl') return 'EFL';
  if (clean === 'efl2') return 'EFL-2';
  if (clean === 'autostripe') return 'Auto Stripe';
  if (clean === 'extension' || clean === 'eflextension' || clean === 'eflext') return 'EFL-Extension';
  if (clean === 'eslextension' || clean === 'eslext') return 'ESL-Extension';
  if (clean === 'subcontact') return 'Sub-Contact';
  return floor.trim();
};

/**
 * Checks if a user has full write/edit access for a specific tab
 */
export const hasUserWritePermissionForTab = (user: UserRecord | null | undefined, tabName: string): boolean => {
  if (!user) return false;
  if (user.userType === 'Admin') return true;
  if (user.tabPermissions && user.tabPermissions[tabName] === 'Full Access') return true;
  if (user.tabPermissions && user.tabPermissions[tabName] === 'View Only') return false;
  if (user.tabPermissions && user.tabPermissions[tabName] === 'No Access') return false;
  return user.permission === 'Read / Write';
};

/**
 * Returns the list of floor names a user is permitted to enter or modify data for.
 * - Admin users have access to ALL factory floors.
 * - Users with 'Full Access' on 'Production Ledger' or 'Read / Write' permission can enter/edit data.
 * - If assignedUnits is specified, they can enter data for those assigned units.
 * - If assignedUnits is empty/unrestricted, they have access to all factory floors.
 */
export const getUserAllowedFloorsForEntry = (user: UserRecord | null | undefined): string[] => {
  if (!user) return [];
  if (user.userType === 'Admin') {
    return [...ALL_FACTORY_FLOORS];
  }
  
  // Check write access via tabPermissions or top-level permission
  const hasWriteAccess = hasUserWritePermissionForTab(user, 'Production Ledger') || user.permission === 'Read / Write';
  if (!hasWriteAccess) {
    return [];
  }
  
  if (!user.assignedUnits || !Array.isArray(user.assignedUnits) || user.assignedUnits.length === 0) {
    // If user has write access but no specific floor restriction was assigned, grant access to all factory floors
    return [...ALL_FACTORY_FLOORS];
  }
  
  const assignedNorm = user.assignedUnits.map(normalizeFloorKey);
  if (assignedNorm.includes('all') || assignedNorm.includes('allunits')) {
    return [...ALL_FACTORY_FLOORS];
  }

  const matched: string[] = ALL_FACTORY_FLOORS.filter(fl => assignedNorm.includes(normalizeFloorKey(fl)));
  
  // If user has other custom unit names, include them
  user.assignedUnits.forEach(u => {
    const norm = normalizeFloorKey(u);
    if (!matched.includes(norm) && norm && norm !== 'all' && norm !== 'allunits') {
      matched.push(norm);
    }
  });
  
  return matched.length > 0 ? matched : [...ALL_FACTORY_FLOORS];
};

/**
 * Checks if a user is authorized to enter or modify data for a specific floor.
 */
export const isUserAuthorizedForFloor = (user: UserRecord | null | undefined, floor: string): boolean => {
  if (!user) return false;
  if (user.userType === 'Admin') return true;
  
  const hasWriteAccess = hasUserWritePermissionForTab(user, 'Production Ledger') || user.permission === 'Read / Write';
  if (!hasWriteAccess) return false;
  
  const allowed = getUserAllowedFloorsForEntry(user);
  const targetNorm = normalizeFloorKey(floor);
  return allowed.some(f => normalizeFloorKey(f) === targetNorm);
};
