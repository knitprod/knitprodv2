/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Grey Yarn Stock Summary Data Store & Helpers
 * Enterprise module under Knitting Status tracking:
 * 1st Layer: Order-level Grey Yarn Stock Summary (Booking QTY, Yarn Required, Net Received, Net Issued, Excess Issued, Stock QTY, Issue Balance)
 * 2nd Layer: Physical Yarn Count, Physical Yarn Lot, Spinner breakdown
 */

import * as XLSX from 'xlsx';
import { KnittingStatusStorage } from './knittingStatusStore';
import { TextileClosePMCStorage } from './textileClosePMCStore';
import { SupabaseSync } from './supabaseClient';
import { GasClient } from './gasClient';

export interface GreyYarnStockItem {
  id: string;
  orderNo: string;
  buyerName?: string;
  status?: string;
  completionDate?: string;
  physicalYarnCount: string; // 2nd Layer: Physical Yarn Count
  physicalYarnLot: string;   // 2nd Layer: Physical Yarn Lot
  spinner: string;           // 2nd Layer: Spinner
  bookingQty: number;        // 2nd Layer: Booking QTY (kg)
  yarnRequired: number;      // 2nd Layer: Yarn Required (kg)
  totalReceived: number;     // 2nd Layer: Total Received (kg)
  totalIssued: number;       // 2nd Layer: Total Issued (kg)
  excessIssued: number;      // 2nd Layer: Excess Issued (kg)
  totalStockQty: number;     // 2nd Layer: Total Stock QTY (Total Received - Total Issued)
  issuedBalance: number;     // 2nd Layer: Issued Balance (Yarn Required - Total Issued)
  remarks?: string;
  customFields?: Record<string, any>;
  [key: string]: any;
}

export interface GreyYarnStockOrderGroup {
  orderNo: string;
  status: string;
  completionDate?: string;
  buyerName: string;
  totalBookingQty: number;   // 1st Layer: Booking QTY (Sum from 2nd Layer Booking QTY)
  totalYarnRequired: number; // 1st Layer: Yarn Required (Sum from 2nd Layer Yarn Required)
  totalNetReceived: number;  // 1st Layer: Net Received (Sum from 2nd Layer Total Received)
  totalNetIssued: number;    // 1st Layer: Net Issued (Sum from 2nd Layer Total Issued)
  totalExcessIssued: number; // 1st Layer: Excess Issued (Sum from 2nd Layer Excess Issued)
  totalStockQty: number;     // 1st Layer: Stock QTY (Sum from 2nd Layer Total Stock QTY)
  totalIssuedBalance: number;// 1st Layer: Issue Balance (Sum from 2nd Layer Issued Balance)
  items: GreyYarnStockItem[];
}

export interface GreyYarnStockUploadMeta {
  lastUploadedAt: string | null;
  fileName: string | null;
  totalRecords: number;
  totalOrders: number;
}

const STORAGE_KEY = 'epyllion_grey_yarn_stock_summary_v1';
const LAST_UPLOAD_KEY = 'epyllion_grey_yarn_last_upload';

/**
 * Normalizes string for robust case-insensitive comparison
 */
export function norm(val: string | null | undefined): string {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes Order Number
 */
export function normOrder(val: string | null | undefined): string {
  if (!val) return '';
  return String(val).trim().toLowerCase().replace(/^0+/, '');
}

import { formatCompletionDate } from './dateUtils';
export { formatCompletionDate };

/**
 * Initial Default Demo Records for Grey Yarn Stock Summary
 * Matching authentic Epyllion Knitex Ltd. orders & multi-layer yarn specs
 */
export const INITIAL_GREY_YARN_STOCK_RECORDS: GreyYarnStockItem[] = [
  // Order 271890 - Vogue Sourcing Limited (Running)
  {
    id: 'gys-271890-1',
    orderNo: '271890',
    buyerName: 'Vogue Sourcing Limited',
    status: 'Running',
    completionDate: '24-Oct-2024',
    physicalYarnCount: '26/1 CVC 60/40 Melange',
    physicalYarnLot: 'LT-48210',
    spinner: 'Square Textiles Ltd.',
    bookingQty: 4200,
    yarnRequired: 4100,
    totalReceived: 4100,
    totalIssued: 3500,
    excessIssued: 0,
    totalStockQty: 600,
    issuedBalance: 600,
    remarks: 'Floor knitting in progress'
  },
  {
    id: 'gys-271890-2',
    orderNo: '271890',
    buyerName: 'Vogue Sourcing Limited',
    status: 'Running',
    completionDate: '24-Oct-2024',
    physicalYarnCount: '30/1 100% Combed Cotton',
    physicalYarnLot: 'LT-48299',
    spinner: 'Badar Spinning Mills',
    bookingQty: 3200,
    yarnRequired: 3150,
    totalReceived: 3150,
    totalIssued: 2800,
    excessIssued: 0,
    totalStockQty: 350,
    issuedBalance: 350,
    remarks: 'Auto stripe body yarn'
  },
  {
    id: 'gys-271890-3',
    orderNo: '271890',
    buyerName: 'Vogue Sourcing Limited',
    status: 'Running',
    completionDate: '24-Oct-2024',
    physicalYarnCount: '20D Creora Spandex',
    physicalYarnLot: 'SP-0912',
    spinner: 'Hyosung Corp',
    bookingQty: 250,
    yarnRequired: 240,
    totalReceived: 240,
    totalIssued: 200,
    excessIssued: 0,
    totalStockQty: 40,
    issuedBalance: 40,
    remarks: 'Rib elastane feed'
  },

  // Order 272277 - M&S (Running)
  {
    id: 'gys-272277-1',
    orderNo: '272277',
    buyerName: 'M&S',
    status: 'Running',
    completionDate: '18-Nov-2024',
    physicalYarnCount: '30s Combed Cotton Compact',
    physicalYarnLot: 'LOT-9844',
    spinner: 'Badar Spinning Mills',
    bookingQty: 3100,
    yarnRequired: 3000,
    totalReceived: 2950,
    totalIssued: 2200,
    excessIssued: 0,
    totalStockQty: 750,
    issuedBalance: 800,
    remarks: 'Single jersey high gauge'
  },
  {
    id: 'gys-272277-2',
    orderNo: '272277',
    buyerName: 'M&S',
    status: 'Running',
    completionDate: '18-Nov-2024',
    physicalYarnCount: '30/1 Combed + 20D Lycra',
    physicalYarnLot: 'LOT-9821',
    spinner: 'Square Textiles Ltd.',
    bookingQty: 600,
    yarnRequired: 550,
    totalReceived: 550,
    totalIssued: 420,
    excessIssued: 0,
    totalStockQty: 130,
    issuedBalance: 130,
    remarks: '1x1 Spandex Rib'
  },

  // Order 271522 - Zara (Running)
  {
    id: 'gys-271522-1',
    orderNo: '271522',
    buyerName: 'Zara',
    status: 'Running',
    completionDate: '05-Dec-2024',
    physicalYarnCount: '30s Organic Combed Cotton',
    physicalYarnLot: 'LOT-4412',
    spinner: 'Square Textiles Ltd.',
    bookingQty: 4500,
    yarnRequired: 4350,
    totalReceived: 4200,
    totalIssued: 3250,
    excessIssued: 0,
    totalStockQty: 950,
    issuedBalance: 1100,
    remarks: 'Organic certified GOTS'
  },
  {
    id: 'gys-271522-2',
    orderNo: '271522',
    buyerName: 'Zara',
    status: 'Running',
    completionDate: '05-Dec-2024',
    physicalYarnCount: '34/1 Carded Cotton',
    physicalYarnLot: 'LOT-4480',
    spinner: 'Akij Textile Mills',
    bookingQty: 1800,
    yarnRequired: 1750,
    totalReceived: 1800,
    totalIssued: 1780,
    excessIssued: 30,
    totalStockQty: 20,
    issuedBalance: 0,
    remarks: 'Over-requisition issued for sample collar'
  },

  // Order 271891 - S.Oliver (Complete)
  {
    id: 'gys-271891-1',
    orderNo: '271891',
    buyerName: 'S.Oliver',
    status: 'Complete',
    completionDate: '12-Oct-2024',
    physicalYarnCount: '24/1 Cotton Melange 10%',
    physicalYarnLot: 'LT-27189-A',
    spinner: 'Kader Spinning Mills',
    bookingQty: 2600,
    yarnRequired: 2550,
    totalReceived: 2550,
    totalIssued: 2550,
    excessIssued: 0,
    totalStockQty: 0,
    issuedBalance: 0,
    remarks: 'Fully completed and cleared'
  },
  {
    id: 'gys-271891-2',
    orderNo: '271891',
    buyerName: 'S.Oliver',
    status: 'Complete',
    completionDate: '12-Oct-2024',
    physicalYarnCount: '30/1 100% Combed Cotton',
    physicalYarnLot: 'LT-27189-B',
    spinner: 'Aman Spinning Ltd.',
    bookingQty: 1300,
    yarnRequired: 1280,
    totalReceived: 1280,
    totalIssued: 1280,
    excessIssued: 0,
    totalStockQty: 0,
    issuedBalance: 0,
    remarks: 'Drop needle interlock complete'
  },

  // Order 270258 - H&M (Complete)
  {
    id: 'gys-270258-1',
    orderNo: '270258',
    buyerName: 'H&M',
    status: 'Complete',
    completionDate: '30-Sep-2024',
    physicalYarnCount: '28/1 Cotton Poly Melange',
    physicalYarnLot: 'LOT-HM-91',
    spinner: 'Akij Textile Mills',
    bookingQty: 3800,
    yarnRequired: 3700,
    totalReceived: 3700,
    totalIssued: 3700,
    excessIssued: 0,
    totalStockQty: 0,
    issuedBalance: 0,
    remarks: 'Shipped'
  },

  // Order 268400 - Mango (Running)
  {
    id: 'gys-268400-1',
    orderNo: '268400',
    buyerName: 'Mango',
    status: 'Running',
    completionDate: '02-Dec-2024',
    physicalYarnCount: '34/1 Compact Combed Cotton',
    physicalYarnLot: 'LT-MG-340',
    spinner: 'NR Group Spinning',
    bookingQty: 2100,
    yarnRequired: 2050,
    totalReceived: 2000,
    totalIssued: 1580,
    excessIssued: 0,
    totalStockQty: 420,
    issuedBalance: 470,
    remarks: 'Knitting floor EFL'
  },
  {
    id: 'gys-268400-2',
    orderNo: '268400',
    buyerName: 'Mango',
    status: 'Running',
    completionDate: '02-Dec-2024',
    physicalYarnCount: '20D Elastane Clear',
    physicalYarnLot: 'SP-MG-02',
    spinner: 'Hyosung Corp',
    bookingQty: 120,
    yarnRequired: 110,
    totalReceived: 110,
    totalIssued: 90,
    excessIssued: 0,
    totalStockQty: 20,
    issuedBalance: 20,
    remarks: 'Flat knit polo collar'
  }
];

let memoryRecordsCache: GreyYarnStockItem[] | null = null;
let memoryMetaCache: GreyYarnStockUploadMeta | null = null;

export const GreyYarnStockStorage = {
  getRecords(): GreyYarnStockItem[] {
    if (memoryRecordsCache && memoryRecordsCache.length > 0) {
      return memoryRecordsCache;
    }
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) {
        memoryRecordsCache = INITIAL_GREY_YARN_STOCK_RECORDS;
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_GREY_YARN_STOCK_RECORDS));
        } catch {}
        return INITIAL_GREY_YARN_STOCK_RECORDS;
      }
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryRecordsCache = parsed;
        return parsed;
      }
      memoryRecordsCache = INITIAL_GREY_YARN_STOCK_RECORDS;
      return INITIAL_GREY_YARN_STOCK_RECORDS;
    } catch {
      memoryRecordsCache = INITIAL_GREY_YARN_STOCK_RECORDS;
      return INITIAL_GREY_YARN_STOCK_RECORDS;
    }
  },

  saveRecords(records: GreyYarnStockItem[], pushToRemote: boolean = false): void {
    const isSameReference = memoryRecordsCache === records;
    memoryRecordsCache = records;
    if (!isSameReference) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (err) {
        console.warn('Storage quota notice - keeping dataset in memory:', err);
      }
    }
    // Dispatch custom event for real-time reactive sync across components
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('epyllion_grey_yarn_stock_updated', { detail: records }));
      } catch {}
    }, 0);

    // If explicit upload, push to Supabase
    if (pushToRemote && Array.isArray(records) && records.length > 0) {
      try {
        if (SupabaseSync.isConfigured()) {
          SupabaseSync.bulkSaveGreyYarnStockRecords(records, true).catch(() => {});
        }
      } catch (e) {
        console.warn('Sync push notice:', e);
      }
    }
  },

  /**
   * Pulls & synchronizes records from Supabase cloud (Supabase is single source of truth).
   */
  async syncTwoWay(
    forcePushLocal: boolean = false,
    onProgress?: (processed: number, total: number, percentage: number, stage?: string) => void
  ): Promise<{ records: GreyYarnStockItem[]; source: string; count: number }> {
    if (forcePushLocal) {
      const localRecords = this.getRecords();
      if (SupabaseSync.isConfigured() && SupabaseSync.isGreyYarnStockTableAvailable()) {
        await SupabaseSync.bulkSaveGreyYarnStockRecords(localRecords, true, onProgress);
      }
      return { records: localRecords, source: 'local_pushed', count: localRecords.length };
    }

    if (SupabaseSync.isConfigured()) {
      try {
        const remoteRecords = await SupabaseSync.fetchGreyYarnStockRecords(
          (loaded, total, percent) => {
            if (onProgress) onProgress(loaded, total, percent, `Loaded ${loaded} of ${total} records from Supabase...`);
          }
        );
        if (Array.isArray(remoteRecords) && remoteRecords.length > 0) {
          this.saveRecords(remoteRecords, false);
          const groups = groupGreyYarnStockRecords(remoteRecords);
          const meta: GreyYarnStockUploadMeta = {
            lastUploadedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            fileName: 'Supabase Cloud (grey_yarn_stock)',
            totalRecords: remoteRecords.length,
            totalOrders: groups.length
          };
          this.saveUploadMeta(meta);
          return { records: remoteRecords, source: 'supabase', count: remoteRecords.length };
        }
      } catch (e) {
        console.warn('Supabase fetch notice:', e);
      }
    }

    const current = this.getRecords();
    return { records: current, source: 'local', count: current.length };
  },

  getUploadMeta(): GreyYarnStockUploadMeta {
    if (memoryMetaCache) return memoryMetaCache;
    try {
      const data = localStorage.getItem(LAST_UPLOAD_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        memoryMetaCache = parsed;
        return parsed;
      }
    } catch {}
    const defaultMeta: GreyYarnStockUploadMeta = {
      lastUploadedAt: 'Live Synced',
      fileName: 'Master Grey Yarn Inventory',
      totalRecords: INITIAL_GREY_YARN_STOCK_RECORDS.length,
      totalOrders: 6
    };
    memoryMetaCache = defaultMeta;
    return defaultMeta;
  },

  saveUploadMeta(meta: GreyYarnStockUploadMeta): void {
    memoryMetaCache = meta;
    try {
      localStorage.setItem(LAST_UPLOAD_KEY, JSON.stringify(meta));
    } catch {}
  },

  resetToDefault(): GreyYarnStockItem[] {
    memoryRecordsCache = INITIAL_GREY_YARN_STOCK_RECORDS;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_GREY_YARN_STOCK_RECORDS));
    } catch {}
    const meta: GreyYarnStockUploadMeta = {
      lastUploadedAt: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      fileName: 'Default Demo Dataset',
      totalRecords: INITIAL_GREY_YARN_STOCK_RECORDS.length,
      totalOrders: 6
    };
    this.saveUploadMeta(meta);
    setTimeout(() => {
      try {
        window.dispatchEvent(new CustomEvent('epyllion_grey_yarn_stock_updated', { detail: INITIAL_GREY_YARN_STOCK_RECORDS }));
      } catch {}
    }, 0);
    return INITIAL_GREY_YARN_STOCK_RECORDS;
  }
};

/**
 * Groups 2nd layer Grey Yarn Stock Items into 1st layer Order Groups
 * Calculates exact sums:
 * - totalBookingQty = Sum from 2nd Layer Booking QTY
 * - totalYarnRequired = Sum from 2nd Layer Yarn Required
 * - totalNetReceived = Sum from 2nd Layer Total Received
 * - totalNetIssued = Sum from 2nd Layer Total Issued
 * - totalExcessIssued = Sum from 2nd Layer Excess Issued
 * - totalStockQty = Sum from 2nd Layer Total Stock QTY
 * - totalIssuedBalance = Sum from 2nd Layer Issued Balance
 */
export function groupGreyYarnStockRecords(records: GreyYarnStockItem[]): GreyYarnStockOrderGroup[] {
  if (!records || records.length === 0) return [];

  // Instant lookup maps from Knitting Status & Textile Close for status / buyer / completion date enrichment
  const knittingOrders = KnittingStatusStorage.getOrders();
  const textileRecords = TextileClosePMCStorage.getRecords();

  const knittingMap = new Map<string, { status: string; buyer: string; completionDate: string }>();
  knittingOrders.forEach(o => {
    if (o.orderNo) {
      const k = normOrder(o.orderNo);
      const anyO = o as any;
      knittingMap.set(k, {
        status: anyO.status || 'Running',
        buyer: o.buyerName || anyO.buyer || '',
        completionDate: o.knitEndDate || anyO.deliveryDate || anyO.completionDate || ''
      });
    }
  });

  const textileSet = new Set<string>();
  textileRecords.forEach(t => {
    if (t.orderNo) textileSet.add(normOrder(t.orderNo));
  });

  const orderMap = new Map<string, {
    orderNo: string;
    buyerName: string;
    status: string;
    completionDate: string;
    items: GreyYarnStockItem[];
  }>();

  records.forEach(item => {
    const rawOrder = (item.orderNo || '').trim();
    const orderDisplay = rawOrder || 'Unassigned Order';
    const cleanKey = rawOrder ? normOrder(rawOrder) : '__unassigned_order__';

    let group = orderMap.get(cleanKey);
    if (!group) {
      // Determine Order Status:
      let resolvedStatus = item.status || '';
      let resolvedBuyer = item.buyerName || '';
      let resolvedCompDate = item.completionDate ? formatCompletionDate(item.completionDate) : '';

      if (textileSet.has(cleanKey)) {
        resolvedStatus = 'Textile Close';
      } else if (knittingMap.has(cleanKey)) {
        const kData = knittingMap.get(cleanKey)!;
        if (!resolvedStatus || resolvedStatus.toLowerCase() === 'running') {
          resolvedStatus = kData.status || resolvedStatus || 'Running';
        }
        if (!resolvedBuyer && kData.buyer) resolvedBuyer = kData.buyer;
        if (!resolvedCompDate && kData.completionDate) resolvedCompDate = formatCompletionDate(kData.completionDate);
      }

      if (!resolvedStatus) {
        resolvedStatus = 'Running';
      }

      group = {
        orderNo: orderDisplay,
        buyerName: resolvedBuyer || 'Unknown Buyer',
        status: resolvedStatus,
        completionDate: resolvedCompDate,
        items: []
      };
      orderMap.set(cleanKey, group);
    } else {
      if (!group.buyerName && item.buyerName) group.buyerName = item.buyerName;
      if (!group.completionDate && item.completionDate) group.completionDate = formatCompletionDate(item.completionDate);
    }

    group.items.push(item);
  });

  const result: GreyYarnStockOrderGroup[] = [];

  orderMap.forEach(grp => {
    let bookingSum = 0;
    let yarnReqSum = 0;
    let receivedSum = 0;
    let issuedSum = 0;
    let excessSum = 0;
    let stockSum = 0;
    let balanceSum = 0;

    grp.items.forEach(itm => {
      const bQty = Number(itm.bookingQty) || 0;
      const yReq = Number(itm.yarnRequired) || 0;
      const rQty = Number(itm.totalReceived) || 0;
      const iQty = Number(itm.totalIssued) || 0;
      const eQty = Number(itm.excessIssued) || 0;
      const sQty = itm.totalStockQty !== undefined ? (Number(itm.totalStockQty) || 0) : Math.max(0, rQty - iQty);
      const bal = itm.issuedBalance !== undefined ? (Number(itm.issuedBalance) || 0) : Math.max(0, yReq - iQty);

      bookingSum += bQty;
      yarnReqSum += yReq;
      receivedSum += rQty;
      issuedSum += iQty;
      excessSum += eQty;
      stockSum += sQty;
      balanceSum += bal;
    });

    result.push({
      orderNo: grp.orderNo,
      status: grp.status,
      completionDate: grp.completionDate,
      buyerName: grp.buyerName,
      totalBookingQty: bookingSum,
      totalYarnRequired: yarnReqSum,
      totalNetReceived: receivedSum,
      totalNetIssued: issuedSum,
      totalExcessIssued: excessSum,
      totalStockQty: stockSum,
      totalIssuedBalance: balanceSum,
      items: grp.items
    });
  });

  return result;
}

/**
/**
 * Formats a yarn numeric quantity with clean commas and up to 2 decimal places if present
 */
export function formatYarnNumber(val: number | null | undefined): string {
  if (val === undefined || val === null || isNaN(val)) return '0';
  const hasDecimals = Math.abs(val % 1) > 0.001;
  return Number(val).toLocaleString('en-US', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  });
}

/**
 * Intelligent Excel Parser for Grey Yarn Stock files
 * Accurately matches user's exact 14 columns, filters out Summary/Total rows,
 * and preserves exact numerical values without artificial formula overrides.
 */
export async function parseGreyYarnStockExcel(file: File): Promise<GreyYarnStockItem[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    throw new Error('The uploaded Excel file has no sheets.');
  }

  // Find the most appropriate sheet
  let targetSheetName = wb.SheetNames[0];
  const preferred = wb.SheetNames.find(n => {
    const s = n.toLowerCase();
    return s.includes('yarn') || s.includes('stock') || s.includes('grey') || s.includes('knitting');
  });
  if (preferred) targetSheetName = preferred;

  const ws = wb.Sheets[targetSheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (!rows || rows.length === 0) {
    throw new Error('The selected sheet is empty.');
  }

  // Signature dictionary for all 14 columns
  const colSignatures: Record<string, string[]> = {
    orderNo: [
      'allocated order wa', // Exact header from user's file
      'allocated order',
      'order wa',
      'order no',
      'order number',
      'order #',
      'order',
      'job no',
      'po no',
      'orderno'
    ],
    buyerName: [
      'buyer', // Exact header from user's file
      'buyer name',
      'customer',
      'brand',
      'buyername'
    ],
    status: [
      'status', // Exact header from user's file
      'order status',
      'knitting status',
      'yarn status'
    ],
    completionDate: [
      'completion date', // Exact header from user's file
      'completion',
      'completio',
      'complete date',
      'comp date',
      'comp. date',
      'delivery date',
      'ship date',
      'closing date',
      'finish date',
      'date',
      'pmc date'
    ],
    physicalYarnCount: [
      'physical count', // Exact header from user's file
      'physical yarn count',
      'yarn count physical',
      'yarn count',
      'count physical',
      'allocated yarn count',
      'allocated yarn',
      'yarn description',
      'yarn spec',
      'count'
    ],
    physicalYarnLot: [
      'physical lot', // Exact header from user's file
      'physical yarn lot',
      'yarn lot',
      'lot no',
      'lot #',
      'lot',
      'spinning lot',
      'lot ref'
    ],
    spinner: [
      'spinner', // Exact header from user's file
      "spinner's name",
      'spinners name',
      'spinning mill',
      'mill',
      'yarn supplier',
      'vendor'
    ],
    bookingQty: [
      'booking qty', // Exact header from user's file
      'booking quantity',
      'booking (kg)',
      'booking',
      'booking_qty',
      'plan booking',
      'book qty'
    ],
    yarnRequired: [
      'yarn required', // Exact header from user's file
      'yarn req',
      'yarn req qty',
      'yarn rq qty',
      'req qty',
      'required (kg)',
      'yarn required (kg)',
      'rq qty',
      'required qty',
      'yarn requirement'
    ],
    totalReceived: [
      'net received', // Exact header from user's file
      'total received',
      'received qty',
      'received (kg)',
      'rcvd qty',
      'yarn received',
      'total net received',
      'net rec'
    ],
    totalIssued: [
      'total issued', // Exact header from user's file
      'net issued',
      'issued qty',
      'issued (kg)',
      'yarn issued',
      'total net issued',
      'net iss'
    ],
    excessIssued: [
      'excess issued', // Exact header from user's file
      'excess qty',
      'extra issued',
      'over issued',
      'excess (kg)',
      'over issue'
    ],
    totalStockQty: [
      'total stock qty', // Exact header from user's file
      'stock qty',
      'total stock',
      'stock (kg)',
      'yarn stock',
      'grey yarn stock',
      'balance stock',
      'stock'
    ],
    issuedBalance: [
      'issue balance', // Exact header from user's file
      'issued balance',
      'balance to issue',
      'balance (kg)',
      'balance',
      'yarn balance',
      'req balance',
      'bal qty'
    ]
  };

  // Find the BEST header row across the first 40 rows (maximum match count wins)
  let bestHeaderRowIndex = -1;
  let bestMatchCount = 0;
  let colIndexMap: Record<string, number> = {};

  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let matchCount = 0;
    const tempMap: Record<string, number> = {};

    row.forEach((cellVal, cIdx) => {
      if (cellVal === undefined || cellVal === null) return;
      const clean = String(cellVal).trim().toLowerCase().replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ');
      const cleanAlpha = clean.replace(/[^a-z0-9]/g, '');
      if (!clean) return;

      for (const [key, patterns] of Object.entries(colSignatures)) {
        if (tempMap[key] !== undefined) continue;
        for (const pat of patterns) {
          const patAlpha = pat.replace(/[^a-z0-9]/g, '');
          if (
            clean === pat ||
            cleanAlpha === patAlpha ||
            clean.startsWith(pat) ||
            cleanAlpha.startsWith(patAlpha) ||
            (clean.includes(pat) && pat.length > 5)
          ) {
            tempMap[key] = cIdx;
            matchCount++;
            break;
          }
        }
      }
    });

    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestHeaderRowIndex = r;
      colIndexMap = tempMap;
    }
  }

  if (bestHeaderRowIndex === -1 || bestMatchCount < 2) {
    throw new Error('Could not identify table headers. Please make sure the Excel file has columns such as Allocated Order WA, Buyer, Physical Count, Booking QTY, Net Received, Total Issued, etc.');
  }

  const items: GreyYarnStockItem[] = [];
  let currentOrderNo = '';
  let currentBuyer = '';
  let currentStatus = '';
  let currentCompDate = '';

  const hasReqCol = colIndexMap['yarnRequired'] !== undefined;
  const hasExcessCol = colIndexMap['excessIssued'] !== undefined;
  const hasStockCol = colIndexMap['totalStockQty'] !== undefined;
  const hasBalCol = colIndexMap['issuedBalance'] !== undefined;

  for (let r = bestHeaderRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const getVal = (key: string): any => {
      const idx = colIndexMap[key];
      if (idx === undefined) return undefined;
      if (key === 'completionDate' && ws) {
        const cellAddress = XLSX.utils.encode_cell({ r, c: idx });
        const cell = ws[cellAddress];
        if (cell) {
          if (typeof cell.w === 'string' && cell.w.trim()) {
            return cell.w.trim();
          }
          if (cell.v !== undefined && cell.v !== null) {
            return cell.v;
          }
        }
      }
      return row[idx];
    };

    const getNum = (key: string): number => {
      const v = getVal(key);
      if (v === undefined || v === null || v === '') return 0;
      if (typeof v === 'number') return isNaN(v) ? 0 : v;
      const str = String(v).trim();
      const isNegative = str.startsWith('(') && str.endsWith(')');
      const cleanNumStr = str.replace(/[^0-9.-]/g, '');
      if (!cleanNumStr) return 0;
      const n = parseFloat(cleanNumStr);
      if (isNaN(n)) return 0;
      return isNegative ? -n : n;
    };

    const getStr = (key: string): string => {
      const v = getVal(key);
      if (v === undefined || v === null) return '';
      return String(v).trim();
    };

    let rawOrderNo = getStr('orderNo');
    let buyer = getStr('buyerName');
    let status = getStr('status');
    let count = getStr('physicalYarnCount');
    let lot = getStr('physicalYarnLot');
    let spinner = getStr('spinner');

    // CHECK FOR TOTAL / GRAND TOTAL / SUMMARY ROWS:
    // If this row is a summary or total row, SKIP IT so it doesn't double or corrupt the data!
    const rowStr = row.map(c => String(c || '').trim().toLowerCase()).join(' ');
    const isTotalRow = 
      rowStr.startsWith('total') ||
      rowStr.startsWith('grand total') ||
      rowStr.startsWith('sub total') ||
      rowStr.startsWith('subtotal') ||
      rowStr.includes('grand total') ||
      rowStr.includes('report total') ||
      rawOrderNo.toLowerCase() === 'total' ||
      rawOrderNo.toLowerCase() === 'grand total' ||
      buyer.toLowerCase() === 'total' ||
      buyer.toLowerCase() === 'grand total' ||
      count.toLowerCase() === 'total' ||
      count.toLowerCase() === 'grand total';

    if (isTotalRow) {
      continue; // Skip summary / grand total row!
    }

    let orderNo = rawOrderNo;
    // If order number is merged or blank, inherit from previous row if there is yarn item data
    if (orderNo) {
      currentOrderNo = orderNo;
    } else if (currentOrderNo && (count || lot || spinner || getNum('bookingQty') > 0 || getNum('totalReceived') > 0)) {
      orderNo = currentOrderNo;
    }

    if (!orderNo) {
      // Check if this row has non-zero quantities or yarn specs
      const anyNum = getNum('bookingQty') || getNum('totalReceived') || getNum('totalIssued') || getNum('totalStockQty');
      if (anyNum || count || lot) {
        orderNo = currentOrderNo || 'Unassigned Order';
      } else {
        continue; // Skip blank spacer row
      }
    }

    if (buyer) currentBuyer = buyer; else buyer = currentBuyer;
    if (status) currentStatus = status; else status = currentStatus;

    let compDate = getVal('completionDate');
    if (compDate) {
      currentCompDate = formatCompletionDate(compDate);
      compDate = currentCompDate;
    } else {
      compDate = currentCompDate;
    }

    const physicalCount = count || 'Standard Yarn';
    const physicalLot = lot || '—';
    const spinnerName = spinner || '—';

    const bookingQty = getNum('bookingQty');
    // If yarnRequired column is present in the Excel file, strictly preserve the user's Excel value!
    const yarnRequired = hasReqCol ? getNum('yarnRequired') : (bookingQty || 0);
    const totalReceived = getNum('totalReceived');
    const totalIssued = getNum('totalIssued');

    // Excess Issued: strictly preserve Excel value if column exists, else compute fallback
    let excessIssued = getNum('excessIssued');
    if (!hasExcessCol && totalIssued > yarnRequired && yarnRequired > 0) {
      excessIssued = totalIssued - yarnRequired;
    }

    // Total Stock QTY: strictly preserve Excel value if column exists, else compute fallback
    let totalStockQty = getNum('totalStockQty');
    if (!hasStockCol && (totalReceived > 0 || totalIssued > 0)) {
      totalStockQty = Math.max(0, totalReceived - totalIssued);
    }

    // Issue Balance: strictly preserve Excel value if column exists, else compute fallback
    let issuedBalance = getNum('issuedBalance');
    if (!hasBalCol && yarnRequired > 0) {
      issuedBalance = Math.max(0, yarnRequired - totalIssued);
    }

    items.push({
      id: `gys-upload-${orderNo}-${r}`,
      orderNo,
      buyerName: buyer,
      status: status || 'Running',
      completionDate: compDate,
      physicalYarnCount: physicalCount,
      physicalYarnLot: physicalLot,
      spinner: spinnerName,
      bookingQty,
      yarnRequired,
      totalReceived,
      totalIssued,
      excessIssued,
      totalStockQty,
      issuedBalance
    });
  }

  if (items.length === 0) {
    throw new Error('No valid yarn stock rows could be parsed from the file.');
  }

  return items;
}

/**
 * Exports Grey Yarn Stock Summary into Excel with exact 14 columns matching user file structure
 * and includes a dedicated Grand Total row matching the KPI Cards.
 */
export function exportGreyYarnStockToExcel(groups: GreyYarnStockOrderGroup[], filename?: string): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Exact 14 Columns matching user's file structure + Grand Total row
  const rawRows: any[] = [];
  let grandBooking = 0;
  let grandRequired = 0;
  let grandReceived = 0;
  let grandIssued = 0;
  let grandExcess = 0;
  let grandStock = 0;
  let grandBalance = 0;

  groups.forEach(g => {
    g.items.forEach(itm => {
      grandBooking += Number(itm.bookingQty) || 0;
      grandRequired += Number(itm.yarnRequired) || 0;
      grandReceived += Number(itm.totalReceived) || 0;
      grandIssued += Number(itm.totalIssued) || 0;
      grandExcess += Number(itm.excessIssued) || 0;
      grandStock += Number(itm.totalStockQty) || 0;
      grandBalance += Number(itm.issuedBalance) || 0;

      rawRows.push({
        'Completion Date': itm.completionDate || g.completionDate || '—',
        'Buyer': itm.buyerName || g.buyerName,
        'Status': itm.status || g.status,
        'Allocated Order WA': itm.orderNo || g.orderNo,
        'Physical Count': itm.physicalYarnCount,
        'Physical Lot': itm.physicalYarnLot,
        'Spinner': itm.spinner,
        'Booking QTY': itm.bookingQty,
        'Yarn Required': itm.yarnRequired,
        'Net Received': itm.totalReceived,
        'Total Issued': itm.totalIssued,
        'Excess Issued': itm.excessIssued,
        'Total Stock QTY': itm.totalStockQty,
        'Issue Balance': itm.issuedBalance
      });
    });
  });

  // Append Grand Total Row so Excel status bar / sum matches Card Totals 100%
  rawRows.push({
    'Completion Date': '',
    'Buyer': '',
    'Status': '',
    'Allocated Order WA': 'GRAND TOTAL',
    'Physical Count': '',
    'Physical Lot': '',
    'Spinner': `${rawRows.length} lots`,
    'Booking QTY': grandBooking,
    'Yarn Required': grandRequired,
    'Net Received': grandReceived,
    'Total Issued': grandIssued,
    'Excess Issued': grandExcess,
    'Total Stock QTY': grandStock,
    'Issue Balance': grandBalance
  });

  const wsRaw = XLSX.utils.json_to_sheet(rawRows);
  XLSX.utils.book_append_sheet(wb, wsRaw, 'Grey Yarn Stock');

  // Sheet 2: 1st Layer Order Summary (Order Rollup)
  const summaryRows = groups.map(g => ({
    'Allocated Order WA': g.orderNo,
    'Status': g.status,
    'Completion Date': g.completionDate || '—',
    'Buyer': g.buyerName,
    'Booking QTY': g.totalBookingQty,
    'Yarn Required': g.totalYarnRequired,
    'Net Received': g.totalNetReceived,
    'Total Issued': g.totalNetIssued,
    'Excess Issued': g.totalExcessIssued,
    'Total Stock QTY': g.totalStockQty,
    'Issue Balance': g.totalIssuedBalance
  }));

  // Append Grand Total to Order Summary sheet
  summaryRows.push({
    'Allocated Order WA': 'GRAND TOTAL',
    'Status': '',
    'Completion Date': '',
    'Buyer': `${groups.length} Orders`,
    'Booking QTY': grandBooking,
    'Yarn Required': grandRequired,
    'Net Received': grandReceived,
    'Total Issued': grandIssued,
    'Excess Issued': grandExcess,
    'Total Stock QTY': grandStock,
    'Issue Balance': grandBalance
  });

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Order Summary (1st Layer)');

  const finalName = filename || `Epyllion_Grey_Yarn_Stock_Summary_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, finalName);
}

/**
 * Downloads a sample Excel template with the exact 14 columns matching user file structure:
 * Completion Date | Buyer | Status | Allocated Order WA | Physical Count | Physical Lot | Spinner | Booking QTY | Yarn Required | Net Received | Total Issued | Excess Issued | Total Stock QTY | Issue Balance
 */
export function downloadGreyYarnStockTemplate(): void {
  const templateRows = [
    {
      'Completion Date': '24-Oct-2024',
      'Buyer': 'Vogue Sourcing Limited',
      'Status': 'Running',
      'Allocated Order WA': '271890',
      'Physical Count': '26/1 CVC 60/40 Melange',
      'Physical Lot': 'LT-48210',
      'Spinner': 'Square Textiles Ltd.',
      'Booking QTY': 4200,
      'Yarn Required': 4100,
      'Net Received': 4100,
      'Total Issued': 3500,
      'Excess Issued': 0,
      'Total Stock QTY': 600,
      'Issue Balance': 600
    },
    {
      'Completion Date': '24-Oct-2024',
      'Buyer': 'Vogue Sourcing Limited',
      'Status': 'Running',
      'Allocated Order WA': '271890',
      'Physical Count': '30/1 100% Combed Cotton',
      'Physical Lot': 'LT-48299',
      'Spinner': 'Badar Spinning Mills',
      'Booking QTY': 3200,
      'Yarn Required': 3150,
      'Net Received': 3150,
      'Total Issued': 2800,
      'Excess Issued': 0,
      'Total Stock QTY': 350,
      'Issue Balance': 350
    },
    {
      'Completion Date': '18-Nov-2024',
      'Buyer': 'H&M Hennes & Mauritz',
      'Status': 'Running',
      'Allocated Order WA': '272105',
      'Physical Count': '34/1 BCI Cotton Organic',
      'Physical Lot': 'LOT-9921',
      'Spinner': 'Akij Textile Mills',
      'Booking QTY': 5500,
      'Yarn Required': 5400,
      'Net Received': 5400,
      'Total Issued': 4200,
      'Excess Issued': 0,
      'Total Stock QTY': 1200,
      'Issue Balance': 1200
    }
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(templateRows, {
    header: [
      'Completion Date',
      'Buyer',
      'Status',
      'Allocated Order WA',
      'Physical Count',
      'Physical Lot',
      'Spinner',
      'Booking QTY',
      'Yarn Required',
      'Net Received',
      'Total Issued',
      'Excess Issued',
      'Total Stock QTY',
      'Issue Balance'
    ]
  });

  // Set column widths for readability
  ws['!cols'] = [
    { wch: 16 }, // Completion Date
    { wch: 24 }, // Buyer
    { wch: 14 }, // Status
    { wch: 20 }, // Allocated Order WA
    { wch: 28 }, // Physical Count
    { wch: 16 }, // Physical Lot
    { wch: 24 }, // Spinner
    { wch: 14 }, // Booking QTY
    { wch: 14 }, // Yarn Required
    { wch: 14 }, // Net Received
    { wch: 14 }, // Total Issued
    { wch: 14 }, // Excess Issued
    { wch: 16 }, // Total Stock QTY
    { wch: 14 }  // Issue Balance
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Grey Yarn Stock Template');
  XLSX.writeFile(wb, 'Epyllion_Grey_Yarn_Stock_Upload_Template.xlsx');
}
