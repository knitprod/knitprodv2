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
  if (clean === 'extension' || clean === 'eflextension' || clean === 'eflext' || clean === 'eflextn') return 'EFL-Extension';
  if (clean === 'eslextension' || clean === 'eslext' || clean === 'eslextn' || clean === 'esl') return 'ESL-Extension';
  if (clean === 'subcontact' || clean === 'sub' || clean === 'subcontract') return 'Sub-Contact';
  
  // Check if it matches any standard floor in ALL_FACTORY_FLOORS
  const standardMatch = ALL_FACTORY_FLOORS.find(
    f => f.toLowerCase().replace(/[-\s_]/g, '') === clean
  );
  if (standardMatch) return standardMatch;

  return floor.trim();
};

/**
 * Checks if a user has full write/edit access for a specific tab
 */
export const hasUserWritePermissionForTab = (user: UserRecord | null | undefined, tabName: string): boolean => {
  if (!user) return true;
  if (user.userType === 'Admin') return true;
  if (user.tabPermissions && user.tabPermissions[tabName] === 'Full Access') return true;
  if (user.tabPermissions && user.tabPermissions[tabName] === 'View Only') return false;
  if (user.tabPermissions && user.tabPermissions[tabName] === 'No Access') return false;
  return user.permission === 'Read / Write';
};

/**
 * Returns the list of floor names a user is permitted to enter or modify data for.
 * - Admin users have access to ALL factory floors.
 * - If assignedUnits is specified, they have access to those assigned units (normalized).
 * - If assignedUnits is empty/unrestricted, they have access to all factory floors.
 */
export const getUserAllowedFloorsForEntry = (user: UserRecord | null | undefined): string[] => {
  if (!user) return [...ALL_FACTORY_FLOORS];
  if (user.userType === 'Admin') {
    return [...ALL_FACTORY_FLOORS];
  }
  
  // If user has specific assigned units, map and return them
  if (user.assignedUnits && Array.isArray(user.assignedUnits) && user.assignedUnits.length > 0) {
    const assignedNorm = user.assignedUnits.map(normalizeFloorKey).filter(Boolean);
    if (assignedNorm.some(u => u.toLowerCase() === 'all' || u.toLowerCase() === 'allunits')) {
      return [...ALL_FACTORY_FLOORS];
    }

    const result: string[] = [];
    assignedNorm.forEach(u => {
      const match = ALL_FACTORY_FLOORS.find(f => normalizeFloorKey(f) === normalizeFloorKey(u));
      const finalName = match || u;
      if (!result.includes(finalName)) {
        result.push(finalName);
      }
    });

    if (result.length > 0) return result;
  }
  
  return [...ALL_FACTORY_FLOORS];
};

/**
 * Checks if a user is authorized to enter or modify data for a specific floor.
 */
export const isUserAuthorizedForFloor = (user: UserRecord | null | undefined, floor: string): boolean => {
  if (!user) return true;
  if (user.userType === 'Admin') return true;
  
  const allowed = getUserAllowedFloorsForEntry(user);
  if (!allowed || allowed.length === 0) return true;
  
  const targetNorm = normalizeFloorKey(floor);
  return allowed.some(f => normalizeFloorKey(f) === targetNorm);
};

/**
 * Normalizes date string to YYYY-MM-DD format for reliable comparison.
 */
export const normalizeDateKey = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const trimmed = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Strip ordinal suffixes like 31st, 1st, 2nd, 3rd, 4th -> 31, 1, 2, 3, 4
  const cleanSuffix = trimmed.replace(/(\d+)(st|nd|rd|th)/gi, '$1');

  // Handle M/D/YYYY or MM/DD/YYYY or DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(cleanSuffix)) {
    const parts = cleanSuffix.split(/[\/\-\.]/);
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    // If first part > 12, assume DD/MM/YYYY
    let y = p2;
    let m = p0 > 12 ? p1 : p0;
    let d = p0 > 12 ? p0 : p1;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Handle ISO strings (e.g. 2026-08-31T00:00:00.000Z)
  if (cleanSuffix.includes('T')) {
    const isoDate = cleanSuffix.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  }

  const d = new Date(cleanSuffix);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return trimmed;
};

/**
 * Checks if a ledger record with the same Date and Unit (Floor) already exists.
 * Returns the conflicting duplicate record if found, or undefined if no conflict.
 */
export const findDuplicateProductionRecord = (
  records: Array<{ id?: string; date?: string; floor?: string; unit?: string }>,
  date: string,
  floor: string,
  excludeId?: string
): { id?: string; date?: string; floor?: string; unit?: string } | undefined => {
  const normDate = normalizeDateKey(date);
  const normFloor = normalizeFloorKey(floor);

  if (!normDate || !normFloor) return undefined;

  return records.find(r => {
    if (excludeId && r.id === excludeId) return false;
    const rDateNorm = normalizeDateKey(r.date);
    const rFloorNorm = normalizeFloorKey(r.floor || r.unit || '');
    return rDateNorm === normDate && rFloorNorm === normFloor;
  });
};

