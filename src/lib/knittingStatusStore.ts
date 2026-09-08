/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Knitting Status Data Store & Helpers
 */

import { KnittingStatusOrder, KnittingStatusItem, OrderPlan } from '../types';

export type KnittingCondition = 'Pending' | 'Running' | 'Complete';

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  january: 0, february: 1, march: 2, april: 3, may_: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateDisplay(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  // Check if date was created at UTC midnight (which is what XLSX.read cellDates: true outputs,
  // or epoch timestamp Math.round((num - 25569) * 86400 * 1000)).
  // In timezones with negative UTC offset (e.g. UTC-7), calling date.getDate() on UTC midnight
  // shifts the day backwards by 1 (e.g. 6 Sept 00:00:00 UTC becomes 5 Sept 17:00:00 local time).
  const isUtcMidnight = (date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0) ||
                        (date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0);
  const d = String(isUtcMidnight ? date.getUTCDate() : date.getDate()).padStart(2, '0');
  const m = MONTH_NAMES[isUtcMidnight ? date.getUTCMonth() : date.getMonth()];
  const y = isUtcMidnight ? date.getUTCFullYear() : date.getFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Formats an Excel date value (which could be a date serial number, Date object, or date string)
 * into standard display format 'DD-MMM-YYYY'.
 */
export function formatExcelDate(value: any): string {
  if (value === undefined || value === null || value === '') return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    return formatDateDisplay(value);
  }
  if (typeof value === 'number') {
    if (value > 1000 && value < 100000) {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return formatDateDisplay(date);
      }
    }
    return String(value);
  }
  const s = String(value).trim();
  if (!s || s === '-' || s.toLowerCase() === 'pending' || s.toLowerCase() === 'n/a') return '';

  if (/^\d{5}$/.test(s)) {
    const num = Number(s);
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return formatDateDisplay(date);
    }
  }

  // 1) Match DD-MMM-YYYY or DD MMM YYYY or D-MMM-YYYY or DD-Month-YYYY (e.g. 6 Sept 2026, 6-Sep-2026, 06-September-2026, 6-Sep-26)
  const dmyAlpha = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,12})[-/\s](\d{2,4})$/);
  if (dmyAlpha) {
    const day = parseInt(dmyAlpha[1], 10);
    const monStr = dmyAlpha[2].toLowerCase();
    let year = parseInt(dmyAlpha[3], 10);
    if (year < 100) year += 2000;
    const mIdx = MONTH_MAP[monStr] !== undefined ? MONTH_MAP[monStr] : MONTH_MAP[monStr.slice(0, 3)];
    if (mIdx !== undefined && mIdx >= 0 && mIdx < 12) {
      return `${String(day).padStart(2, '0')}-${MONTH_NAMES[mIdx]}-${year}`;
    }
  }

  // 2) Match YYYY-MM-DD or YYYY/MM/DD (ISO style, e.g. 2026-09-06)
  const ymdNum = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdNum) {
    const y = parseInt(ymdNum[1], 10);
    const m = parseInt(ymdNum[2], 10) - 1;
    const d = parseInt(ymdNum[3], 10);
    if (m >= 0 && m < 12) {
      return `${String(d).padStart(2, '0')}-${MONTH_NAMES[m]}-${y}`;
    }
  }

  // 3) Match DD/MM/YYYY or DD-MM-YYYY (e.g. 06/09/2026 or 6/9/2026)
  const dmyNum = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyNum) {
    const d = parseInt(dmyNum[1], 10);
    const m = parseInt(dmyNum[2], 10) - 1;
    let y = parseInt(dmyNum[3], 10);
    if (y < 100) y += 2000;
    if (m >= 0 && m < 12) {
      return `${String(d).padStart(2, '0')}-${MONTH_NAMES[m]}-${y}`;
    }
  }

  // 4) Try Date.parse if it looks like a standard date string (e.g. "Sun Sep 06 2026")
  const parsed = Date.parse(s);
  if (!isNaN(parsed) && !/^\d+$/.test(s)) {
    const date = new Date(parsed);
    return formatDateDisplay(date);
  }

  return s;
}

/**
 * Detects if a value is a Date object, an ISO date string, or a JavaScript Date.toString()
 * (such as "Tue Jun 30 2026 23:59:40 GMT+0600 (Bangladesh Standard Time)").
 */
export function isDateOrTimestampString(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  if (val instanceof Date) return true;
  const str = String(val).trim();
  if (!str) return false;
  if (/\bGMT[+-]\d{4}\b/i.test(str)) return true;
  if (/Standard Time/i.test(str)) return true;
  if (/^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}/.test(str)) return true;
  return false;
}

/**
 * Sanitizes order remarks so that date objects or leaked Date.toString() values
 * (such as "Tue Jun 30 2026 23:59:40 GMT+0600 (Bangladesh Standard Time)") are eliminated.
 */
export function sanitizeRemarksValue(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  if (isDateOrTimestampString(val)) return '';
  return String(val).trim();
}

/**
 * Cleans any leaked date string in an OrderPlan's knitStartRemarks and knitEndRemarks.
 */
export function sanitizeOrderPlanRemarks(order: OrderPlan): OrderPlan {
  if (!order) return order;
  const startBad = isDateOrTimestampString(order.knitStartRemarks);
  const endBad = isDateOrTimestampString(order.knitEndRemarks);
  if (startBad || endBad) {
    return {
      ...order,
      knitStartRemarks: startBad ? '' : (order.knitStartRemarks || '').trim(),
      knitEndRemarks: endBad ? '' : (order.knitEndRemarks || '').trim()
    };
  }
  return order;
}

/**
 * Parses any date representation (string, serial number, Date object) into a Unix millisecond timestamp for comparisons.
 */
export function parseDateToTimestamp(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val.getTime();
  }
  if (typeof val === 'number' && val > 1000 && val < 100000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  const s = String(val).trim();
  if (/^\d{5}$/.test(s)) {
    const d = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.getTime();
  }

  // Check DD-MMM-YYYY or DD-MMM-YY e.g. 12-Aug-2026 or 12-Aug-26
  const dmyAlpha = s.match(/^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{2,4})$/);
  if (dmyAlpha) {
    const day = parseInt(dmyAlpha[1], 10);
    const monStr = dmyAlpha[2].toLowerCase();
    let year = parseInt(dmyAlpha[3], 10);
    if (year < 100) year += 2000;
    const month = MONTH_MAP[monStr];
    if (month !== undefined) {
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d.getTime();
    }
  }

  // Check YYYY-MM-DD or YYYY/MM/DD
  const ymdNum = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymdNum) {
    const y = parseInt(ymdNum[1], 10);
    const m = parseInt(ymdNum[2], 10);
    const d = parseInt(ymdNum[3], 10);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date.getTime();
  }

  // Check DD/MM/YYYY or DD-MM-YYYY
  const dmyNum = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyNum) {
    const part1 = parseInt(dmyNum[1], 10);
    const part2 = parseInt(dmyNum[2], 10);
    let year = parseInt(dmyNum[3], 10);
    if (year < 100) year += 2000;
    // Standard DD/MM/YYYY
    if (part2 <= 12) {
      const date = new Date(year, part2 - 1, part1);
      if (!isNaN(date.getTime())) return date.getTime();
    }
  }

  const parsed = Date.parse(s);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Takes the Minimum Knit Start Date from the expanded ledger items
 */
export function getMinKnitStartDate(items: KnittingStatusItem[], fallback: string = ''): string {
  if (!items || items.length === 0) return fallback;
  let minTime = Infinity;
  let minDateStr = '';

  for (const itm of items) {
    if (!itm.knitStartDate) continue;
    const time = parseDateToTimestamp(itm.knitStartDate);
    if (time !== null && time < minTime) {
      minTime = time;
      minDateStr = itm.knitStartDate;
    }
  }
  return minDateStr || fallback;
}

/**
 * Takes the Maximum Knit End Date from the expanded ledger items
 */
export function getMaxKnitEndDate(items: KnittingStatusItem[], fallback: string = ''): string {
  if (!items || items.length === 0) return fallback;
  let maxTime = -Infinity;
  let maxDateStr = '';

  for (const itm of items) {
    if (!itm.knitEndDate) continue;
    const time = parseDateToTimestamp(itm.knitEndDate);
    if (time !== null && time > maxTime) {
      maxTime = time;
      maxDateStr = itm.knitEndDate;
    }
  }
  return maxDateStr || fallback;
}

/**
 * Sorts the expanded ledger items by:
 * 1. Color
 * 2. Machine Type (mcType)
 * 3. Fabric Type (fabType)
 */
export function sortKnittingItems(items: KnittingStatusItem[]): KnittingStatusItem[] {
  if (!items || items.length === 0) return [];
  return [...items].sort((a, b) => {
    // 1. Color
    const cDiff = (a.color || '').localeCompare(b.color || '', undefined, { sensitivity: 'base', numeric: true });
    if (cDiff !== 0) return cDiff;

    // 2. Machine Type
    const mDiff = (a.mcType || '').localeCompare(b.mcType || '', undefined, { sensitivity: 'base', numeric: true });
    if (mDiff !== 0) return mDiff;

    // 3. Fabric Type
    return (a.fabType || '').localeCompare(b.fabType || '', undefined, { sensitivity: 'base', numeric: true });
  });
}

/**
 * Calculated condition according to user rules:
 * - If Knit Balance < 3 => "Complete"
 * - If Grey QTY > Knit Balance => "Running"
 * - If Grey QTY = Knit Balance => "Pending"
 */
export function calculateKnittingCondition(greyQty: number, knitBalance: number): KnittingCondition {
  const g = Number(greyQty) || 0;
  const b = Number(knitBalance) || 0;

  if (b < 3) {
    return 'Complete';
  }
  if (g > b) {
    return 'Running';
  }
  if (g === b || b >= g) {
    return 'Pending';
  }
  return 'Pending';
}

/**
 * Calculates order aggregates from its sub-items if items are present:
 * - Sorts items by Color -> Machine Type -> Fabric Type
 * - Knit Start Date = Minimum Date from the expanded ledger column
 * - Knit End Date = Maximum Date from the expanded ledger column
 */
export function aggregateOrderValues(order: KnittingStatusOrder): KnittingStatusOrder {
  if (!order.items || order.items.length === 0) {
    const knitBalance = order.knitBalance !== undefined ? order.knitBalance : Math.max(0, (order.greyQty || 0) - (order.production || 0));
    return {
      ...order,
      knitBalance
    };
  }

  // Sort items according to rule: Color -> Machine Type -> Fabric Type
  const sortedItems = sortKnittingItems(order.items);

  const reqQty = sortedItems.reduce((sum, itm) => sum + (Number(itm.reqQty) || 0), 0);
  const greyQty = sortedItems.reduce((sum, itm) => sum + (Number(itm.greyQty) || 0), 0);
  const production = sortedItems.reduce((sum, itm) => sum + (Number(itm.production) || 0), 0);
  const knitBalance = sortedItems.reduce((sum, itm) => sum + (Number(itm.knitBalance) || 0), 0);

  // Take the Minimum Date from the expanded ledger for Knit Start Date
  const minStartDate = getMinKnitStartDate(sortedItems, order.knitStartDate || '');
  // Take the Maximum Date from the expanded ledger for Knit End Date
  const maxEndDate = getMaxKnitEndDate(sortedItems, order.knitEndDate || '');

  return {
    ...order,
    items: sortedItems,
    reqQty: reqQty || order.reqQty || 0,
    greyQty: greyQty || order.greyQty || 0,
    production: production || order.production || 0,
    knitBalance: knitBalance !== undefined ? knitBalance : Math.max(0, greyQty - production),
    knitStartDate: minStartDate,
    knitEndDate: maxEndDate
  };
}

export const INITIAL_KNITTING_STATUS_ORDERS: KnittingStatusOrder[] = [
  {
    id: 'ks-ord-271890',
    orderNo: '271890',
    buyerName: 'Vogue Sourcin',
    teamLeader: 'Kabir Hossain',
    knitStartDate: '12-Aug-2026',
    knitEndDate: '25-Aug-2026',
    reqQty: 3200,
    greyQty: 3250,
    production: 1850,
    knitBalance: 1400,
    items: [
      {
        id: 'itm-271890-1',
        color: 'Navy Blue',
        mcType: 'Single Jersey',
        fabType: '100% Cotton Single Jersey',
        fgsm: 180,
        fWidth: '72" Open',
        yarnCount: '26s Combed',
        gaugeDia: '24G x 30"',
        knitStartDate: '12-Aug-2026',
        knitEndDate: '20-Aug-2026',
        reqQty: 1800,
        greyQty: 1825,
        production: 1100,
        hold: 25,
        reject: 12,
        itmQty: 150,
        knitBalance: 725,
        productionUnit: '',
        avgProdPerDay: 220
      },
      {
        id: 'itm-271890-2',
        color: 'Bright White',
        mcType: 'Single Jersey',
        fabType: '95% Cotton 5% Spandex S/J',
        fgsm: 190,
        fWidth: '68" Open',
        yarnCount: '30s Combed + 20D Lycra',
        gaugeDia: '28G x 32"',
        knitStartDate: '16-Aug-2026',
        knitEndDate: '25-Aug-2026',
        reqQty: 1400,
        greyQty: 1425,
        production: 750,
        hold: 15,
        reject: 8,
        itmQty: 90,
        knitBalance: 675,
        productionUnit: 'EFL Floor-1',
        avgProdPerDay: 180
      }
    ]
  },
  {
    id: 'ks-ord-271891',
    orderNo: '271891',
    buyerName: 'S.Oliver',
    teamLeader: 'Shahidul Islam',
    knitStartDate: '15-Aug-2026',
    knitEndDate: '28-Aug-2026',
    reqQty: 2450,
    greyQty: 2480,
    production: 2480,
    knitBalance: 0,
    items: [
      {
        id: 'itm-271891-1',
        color: 'Olive Green',
        mcType: 'Rib 1x1',
        fabType: '100% Cotton 1x1 Rib',
        fgsm: 220,
        fWidth: '64" Tube',
        yarnCount: '24s Carded',
        gaugeDia: '18G x 30"',
        knitStartDate: '15-Aug-2026',
        knitEndDate: '22-Aug-2026',
        reqQty: 1200,
        greyQty: 1220,
        production: 1220,
        hold: 0,
        reject: 6,
        itmQty: 0,
        knitBalance: 0,
        productionUnit: 'Auto Stripe Floor',
        avgProdPerDay: 200
      },
      {
        id: 'itm-271891-2',
        color: 'Dark Olive',
        mcType: 'Interlock',
        fabType: 'Drop Needle Interlock',
        fgsm: 240,
        fWidth: '70" Open',
        yarnCount: '34s CVC',
        gaugeDia: '24G x 34"',
        knitStartDate: '18-Aug-2026',
        knitEndDate: '28-Aug-2026',
        reqQty: 1250,
        greyQty: 1260,
        production: 1260,
        hold: 0,
        reject: 9,
        itmQty: 0,
        knitBalance: 0,
        productionUnit: 'EFL-2 Floor',
        avgProdPerDay: 190
      }
    ]
  },
  {
    id: 'ks-ord-270258',
    orderNo: '270258',
    buyerName: 'C&A',
    teamLeader: 'Tanvir Ahmed',
    knitStartDate: '20-Aug-2026',
    knitEndDate: '02-Sep-2026',
    reqQty: 4100,
    greyQty: 4180,
    production: 0,
    knitBalance: 4180,
    items: [
      {
        id: 'itm-270258-1',
        color: 'Mid Blue',
        mcType: 'Fleece 3-Thread',
        fabType: 'CVC 60/40 Brushed Fleece',
        fgsm: 280,
        fWidth: '76" Open',
        yarnCount: '20s CVC + 10s OE',
        gaugeDia: '20G x 30"',
        knitStartDate: '20-Aug-2026',
        knitEndDate: '28-Aug-2026',
        reqQty: 2500,
        greyQty: 2550,
        production: 0,
        hold: 0,
        reject: 0,
        itmQty: 200,
        knitBalance: 2550,
        productionUnit: 'EKL Unit-2',
        avgProdPerDay: 0
      },
      {
        id: 'itm-270258-2',
        color: 'Heather Grey',
        mcType: 'Rib 2x2',
        fabType: '95/5 Cotton Spandex Rib 2x2',
        fgsm: 340,
        fWidth: '60" Tube',
        yarnCount: '24s Melange + 30D Spandex',
        gaugeDia: '18G x 32"',
        knitStartDate: '24-Aug-2026',
        knitEndDate: '02-Sep-2026',
        reqQty: 1600,
        greyQty: 1630,
        production: 0,
        hold: 0,
        reject: 0,
        itmQty: 120,
        knitBalance: 1630,
        productionUnit: 'EFL-Extension',
        avgProdPerDay: 0
      }
    ]
  },
  {
    id: 'ks-ord-260796',
    orderNo: '260796',
    buyerName: 'H&M',
    teamLeader: 'Masud Rana',
    knitStartDate: '05-Aug-2026',
    knitEndDate: '18-Aug-2026',
    reqQty: 5400,
    greyQty: 5490,
    production: 5488,
    knitBalance: 2,
    items: [
      {
        id: 'itm-260796-1',
        color: 'Pitch Black',
        mcType: 'Single Jersey',
        fabType: '100% Organic Cotton S/J',
        fgsm: 160,
        fWidth: '74" Open',
        yarnCount: '30s Organic Combed',
        gaugeDia: '28G x 32"',
        knitStartDate: '05-Aug-2026',
        knitEndDate: '12-Aug-2026',
        reqQty: 3000,
        greyQty: 3050,
        production: 3049,
        hold: 0,
        reject: 14,
        itmQty: 0,
        knitBalance: 1,
        productionUnit: '',
        avgProdPerDay: 260
      },
      {
        id: 'itm-260796-2',
        color: 'Pure White',
        mcType: 'Single Jersey',
        fabType: '100% Cotton Slub Single Jersey',
        fgsm: 150,
        fWidth: '72" Open',
        yarnCount: '26s Slub Yarn',
        gaugeDia: '24G x 30"',
        knitStartDate: '10-Aug-2026',
        knitEndDate: '18-Aug-2026',
        reqQty: 2400,
        greyQty: 2440,
        production: 2439,
        hold: 0,
        reject: 11,
        itmQty: 0,
        knitBalance: 1,
        productionUnit: 'EFL Floor-2',
        avgProdPerDay: 245
      }
    ]
  },
  {
    id: 'ks-ord-265430',
    orderNo: '265430',
    buyerName: 'Next',
    teamLeader: 'Kabir Hossain',
    knitStartDate: '14-Aug-2026',
    knitEndDate: '26-Aug-2026',
    reqQty: 3800,
    greyQty: 3860,
    production: 2100,
    knitBalance: 1760,
    items: [
      {
        id: 'itm-265430-1',
        color: 'Burgundy Red',
        mcType: 'French Terry',
        fabType: '80/20 Cotton Polyester French Terry',
        fgsm: 260,
        fWidth: '74" Open',
        yarnCount: '24s Combed + 150D Poly',
        gaugeDia: '20G x 32"',
        knitStartDate: '14-Aug-2026',
        knitEndDate: '20-Aug-2026',
        reqQty: 2200,
        greyQty: 2240,
        production: 1400,
        hold: 20,
        reject: 15,
        itmQty: 180,
        knitBalance: 840,
        productionUnit: 'EFL Floor-1',
        avgProdPerDay: 230
      },
      {
        id: 'itm-265430-2',
        color: 'Oatmeal Melange',
        mcType: 'Waffle Knit',
        fabType: '100% Cotton Thermal Waffle',
        fgsm: 230,
        fWidth: '66" Open',
        yarnCount: '26s Melange',
        gaugeDia: '18G x 30"',
        knitStartDate: '18-Aug-2026',
        knitEndDate: '26-Aug-2026',
        reqQty: 1600,
        greyQty: 1620,
        production: 700,
        hold: 10,
        reject: 7,
        itmQty: 110,
        knitBalance: 920,
        productionUnit: 'ESL-Extension',
        avgProdPerDay: 175
      }
    ]
  }
];

const STORAGE_KEY = 'epyllion_knitting_status_orders_v1';

export class KnittingStatusStorage {
  static getOrders(): KnittingStatusOrder[] {
    if (typeof window === 'undefined') return INITIAL_KNITTING_STATUS_ORDERS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.map(o => ({
            ...o,
            buyerName: o.buyerName === 'General Buyer' ? '' : (o.buyerName || ''),
            items: (o.items || []).map(itm => ({
              ...itm,
              productionUnit: itm.productionUnit === 'EKL Unit-1' ? '' : (itm.productionUnit || '')
            }))
          }));
          return cleaned.map(aggregateOrderValues);
        }
      }
    } catch (e) {
      console.warn('Could not read knitting status from localStorage', e);
    }
    return INITIAL_KNITTING_STATUS_ORDERS.map(aggregateOrderValues);
  }

  static saveOrders(orders: KnittingStatusOrder[]): void {
    if (typeof window === 'undefined') return;
    try {
      const sanitized = orders.map(aggregateOrderValues);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (e) {
      console.warn('Could not save knitting status to localStorage', e);
    }
  }

  static resetToDefault(): KnittingStatusOrder[] {
    const fresh = INITIAL_KNITTING_STATUS_ORDERS.map(aggregateOrderValues);
    this.saveOrders(fresh);
    return fresh;
  }
}

/**
 * Normalizes an order number / EWO for consistent lookups and deduplication.
 */
export function normOrderNum(str: any): string {
  return String(str || '').trim().replace(/^#+/, '').toUpperCase().replace(/\s+/g, '');
}

/**
 * Normalizes a fabric color name for consistent lookups and deduplication.
 */
export function normColorName(str: any): string {
  return String(str || '').trim().toUpperCase().replace(/\s+/g, '');
}

/**
 * Produces a deterministic, unique canonical ID for an OrderPlan record.
 * This guarantees consistent identity across sessions, Excel uploads, and database upserts.
 */
export function getOrderPlanCanonicalId(order: Partial<OrderPlan>): string {
  const ordKey = normOrderNum(order.ewo || order.id);
  const colKey = normColorName(order.color);
  if (ordKey) {
    return `ord-${ordKey}-${colKey || 'MAIN'}`;
  }
  return String(order.id || `ord-${Date.now()}`);
}

/**
 * Comprehensive deduplication for OrderPlan records.
 * Identifies duplicate orders by Order Number (EWO) and Color.
 * Merges duplicate entries safely by combining the most populated/recent values
 * and assigns consistent deterministic canonical IDs to prevent duplicate database rows.
 */
export function deduplicateOrderPlans(orders: OrderPlan[]): OrderPlan[] {
  if (!orders || !Array.isArray(orders)) return [];
  const map = new Map<string, OrderPlan>();

  orders.forEach(rawOrd => {
    if (!rawOrd) return;
    const ord = sanitizeOrderPlanRemarks(rawOrd);
    const ordKey = normOrderNum(ord.ewo || ord.id);
    if (!ordKey) return;
    const colKey = normColorName(ord.color);
    const compositeKey = `${ordKey}___${colKey}`;

    const existing = map.get(compositeKey);
    if (!existing) {
      const canonicalId = getOrderPlanCanonicalId(ord);
      map.set(compositeKey, { ...ord, id: canonicalId });
    } else {
      // Merge records: preserve non-empty/latest values and populated fields
      const latestProdDate = (ord.lastProductionDate && ord.lastProductionDate !== '-') ? ord.lastProductionDate : existing.lastProductionDate;
      const latestAKnitStart = (ord.aKnitStart && ord.aKnitStart !== '-') ? ord.aKnitStart : existing.aKnitStart;
      const merged: OrderPlan = {
        ...existing,
        ...ord,
        id: existing.id || getOrderPlanCanonicalId(ord),
        planMonth: ord.planMonth || existing.planMonth,
        planType: ord.planType || existing.planType,
        ewo: existing.ewo || ord.ewo,
        buyer: ord.buyer || existing.buyer,
        color: ord.color || existing.color,
        knitStart: ord.knitStart || existing.knitStart,
        knitEnd: ord.knitEnd || existing.knitEnd,
        target: (ord.target !== undefined && ord.target !== 0) ? ord.target : (existing.target || 0),
        targetNextMonth: (ord.targetNextMonth !== undefined && ord.targetNextMonth !== 0) ? ord.targetNextMonth : (existing.targetNextMonth || 0),
        allocationStart: ord.allocationStart || existing.allocationStart,
        allocationEnd: ord.allocationEnd || existing.allocationEnd,
        allocatedQty: (ord.allocatedQty !== undefined && ord.allocatedQty !== 0) ? ord.allocatedQty : (existing.allocatedQty || 0),
        allocatedBal: (ord.allocatedBal !== undefined && ord.allocatedBal !== 0) ? ord.allocatedBal : (existing.allocatedBal || 0),
        greyReq: (ord.greyReq !== undefined && ord.greyReq !== 0) ? ord.greyReq : (existing.greyReq || 0),
        knitPro: (ord.knitPro !== undefined && ord.knitPro !== 0) ? ord.knitPro : (existing.knitPro || 0),
        knitBal: ord.knitBal !== undefined ? ord.knitBal : existing.knitBal,
        aKnitStart: latestAKnitStart,
        lastProductionDate: latestProdDate,
        avgProdDay: (ord.avgProdDay !== undefined && ord.avgProdDay !== 0) ? ord.avgProdDay : (existing.avgProdDay || 0),
        expectedKnitEnd: ord.expectedKnitEnd || existing.expectedKnitEnd,
        knitStartOtd: (ord.knitStartOtd && ord.knitStartOtd !== 'Pending') ? ord.knitStartOtd : existing.knitStartOtd,
        knitEndOtd: (ord.knitEndOtd && ord.knitEndOtd !== 'Pending') ? ord.knitEndOtd : existing.knitEndOtd,
        knitStartRemarks: ord.knitStartRemarks || existing.knitStartRemarks,
        knitEndRemarks: ord.knitEndRemarks || existing.knitEndRemarks,
        knitTeamLeaders: ord.knitTeamLeaders || existing.knitTeamLeaders,
      };
      map.set(compositeKey, merged);
    }
  });

  const results = Array.from(map.values());

  // Second pass: If an order exists with blank color and there is an exact single matching order for that EWO with a color, merge them
  const byEwo = new Map<string, OrderPlan[]>();
  results.forEach(o => {
    const k = normOrderNum(o.ewo || o.id);
    if (!byEwo.has(k)) byEwo.set(k, []);
    byEwo.get(k)!.push(o);
  });

  const finalResults: OrderPlan[] = [];
  const processedKeys = new Set<string>();

  results.forEach(o => {
    const k = normOrderNum(o.ewo || o.id);
    const colKey = normColorName(o.color);
    const compositeKey = `${k}___${colKey}`;
    if (processedKeys.has(compositeKey)) return;

    const group = byEwo.get(k) || [];
    if (group.length === 2) {
      const blankOrder = group.find(g => !normColorName(g.color));
      const coloredOrder = group.find(g => !!normColorName(g.color));
      if (blankOrder && coloredOrder) {
        const mergedCol: OrderPlan = {
          ...blankOrder,
          ...coloredOrder,
          id: coloredOrder.id || blankOrder.id,
          color: coloredOrder.color
        };
        finalResults.push(mergedCol);
        processedKeys.add(`${k}___`);
        processedKeys.add(`${k}___${normColorName(coloredOrder.color)}`);
        return;
      }
    }

    processedKeys.add(compositeKey);
    finalResults.push(o);
  });

  return finalResults;
}
