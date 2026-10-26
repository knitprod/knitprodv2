/**
 * Timezone-Agnostic Date Utilities for Epyllion Knitex ERP
 * 
 * Prevents the "1 day behind" date shift bug caused by toLocaleDateString()
 * converting UTC midnight timestamps into negative local timezones.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12
};

/**
 * Formats completion date cleanly into readable string (e.g. "24-Oct-2024")
 * strictly preserving the exact calendar date without timezone shift.
 */
export function formatCompletionDate(val: any): string {
  if (val === null || val === undefined || val === '') return '—';

  // 1. If it's a JavaScript Date instance
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '—';
    // Shift by +12 hours so midnight UTC or SheetJS 23:59:xx offset sits safely at midday UTC
    const noon = new Date(val.getTime() + (12 * 3600 * 1000));
    const y = noon.getUTCFullYear();
    const m = noon.getUTCMonth();
    const d = noon.getUTCDate();
    if (!isNaN(y) && m >= 0 && m < 12 && !isNaN(d)) {
      return `${String(d).padStart(2, '0')}-${MONTH_NAMES[m]}-${y}`;
    }
    return '—';
  }

  // 2. Excel serial numbers (e.g. 45589 = 24-Oct-2024)
  if (typeof val === 'number') {
    if (isNaN(val) || val <= 0) return '—';
    if (val > 30000 && val < 70000) {
      // Excel serial date to UTC noon timestamp:
      // Day 1 = 1900-01-01, 25569 = 1970-01-01
      const ms = Math.round((val - 25569) * 86400 * 1000) + (12 * 3600 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const m = d.getUTCMonth();
        const day = d.getUTCDate();
        return `${String(day).padStart(2, '0')}-${MONTH_NAMES[m]}-${y}`;
      }
    }
  }

  const s = String(val).trim();
  if (!s || s === '0' || s === 'null' || s === 'undefined' || s === '—' || s === '-' || s.toLowerCase() === 'n/a') {
    return '—';
  }

  // If numeric string like "45589"
  const numVal = Number(s);
  if (!isNaN(numVal) && numVal > 30000 && numVal < 70000 && /^\d+(\.\d+)?$/.test(s)) {
    const ms = Math.round((numVal - 25569) * 86400 * 1000) + (12 * 3600 * 1000);
    const d = new Date(ms);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const day = d.getUTCDate();
      return `${String(day).padStart(2, '0')}-${MONTH_NAMES[m]}-${y}`;
    }
  }

  // 3. String formatted as "24-Oct-2024", "24-OCT-2024", "24 Oct 2024", "24-Oct-24"
  const dMmmY = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,})[-\s/](\d{2,4})$/);
  if (dMmmY) {
    const d = parseInt(dMmmY[1], 10);
    const monStr = dMmmY[2].toLowerCase();
    let y = parseInt(dMmmY[3], 10);
    if (y < 100) y += (y > 50 ? 1900 : 2000);
    const mNum = MONTH_MAP[monStr] || MONTH_MAP[monStr.slice(0, 3)];
    if (mNum && d >= 1 && d <= 31) {
      return `${String(d).padStart(2, '0')}-${MONTH_NAMES[mNum - 1]}-${y}`;
    }
  }

  // 4. ISO format: "2024-10-24", "2024-10-24T00:00:00", "2024-10-24 14:30:00"
  const isoMatch = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(d).padStart(2, '0')}-${MONTH_NAMES[m - 1]}-${y}`;
    }
  }

  // 5. Standard DD/MM/YYYY or DD-MM-YYYY format: "24/10/2024", "24-10-2024"
  const dmyMatch = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    let d = p1;
    let m = p2;
    if (p1 > 12 && p2 <= 12) {
      d = p1;
      m = p2;
    } else if (p2 > 12 && p1 <= 12) {
      d = p2;
      m = p1;
    }
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${String(d).padStart(2, '0')}-${MONTH_NAMES[m - 1]}-${y}`;
    }
  }

  // 6. Fallback parse with UTC midday
  const parsed = Date.parse(s);
  if (!isNaN(parsed) && !s.match(/^\d+$/)) {
    try {
      const noon = new Date(parsed + (12 * 3600 * 1000));
      const y = noon.getUTCFullYear();
      const m = noon.getUTCMonth();
      const d = noon.getUTCDate();
      if (!isNaN(y) && m >= 0 && m < 12 && !isNaN(d)) {
        return `${String(d).padStart(2, '0')}-${MONTH_NAMES[m]}-${y}`;
      }
    } catch {}
  }

  return s;
}
