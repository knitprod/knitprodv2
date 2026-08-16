/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRecord } from '../components/UserManagementView';

export const ALL_FACTORY_FLOORS = [
  'EKL',
  'EFL',
  'EFL-2',
  'Auto Stripe',
  'EFL-Extension',
  'ESL-Extension',
  'Sub-Contact'
] as const;

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
 * Returns the list of floor names a user is permitted to enter or modify data for.
 * - Admin users have access to ALL factory floors.
 * - Users with 'Read' or 'Hide' permissions have NO write access (empty list).
 * - General users with 'Read / Write' can ONLY enter data for their assignedUnits.
 */
export const getUserAllowedFloorsForEntry = (user: UserRecord | null | undefined): string[] => {
  if (!user) return [];
  if (user.userType === 'Admin') {
    return [...ALL_FACTORY_FLOORS];
  }
  
  // If user permission is 'Read' or 'Hide', user cannot enter or edit data
  if (user.permission && user.permission !== 'Read / Write') {
    return [];
  }
  
  if (!user.assignedUnits || !Array.isArray(user.assignedUnits) || user.assignedUnits.length === 0) {
    return [];
  }
  
  const assignedNorm = user.assignedUnits.map(normalizeFloorKey);
  const matched = ALL_FACTORY_FLOORS.filter(fl => assignedNorm.includes(normalizeFloorKey(fl)));
  
  // If user has other custom unit names, include them
  user.assignedUnits.forEach(u => {
    const norm = normalizeFloorKey(u);
    if (!matched.includes(norm) && norm) {
      matched.push(norm);
    }
  });
  
  return matched;
};

/**
 * Checks if a user is authorized to enter or modify data for a specific floor.
 */
export const isUserAuthorizedForFloor = (user: UserRecord | null | undefined, floor: string): boolean => {
  if (!user) return false;
  if (user.userType === 'Admin') return true;
  if (user.permission && user.permission !== 'Read / Write') return false;
  
  const allowed = getUserAllowedFloorsForEntry(user);
  const targetNorm = normalizeFloorKey(floor);
  return allowed.some(f => normalizeFloorKey(f) === targetNorm);
};
