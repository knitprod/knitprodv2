import React, { useState, useEffect } from 'react';
import {
  Scissors,
  Copy,
  Check,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Clock,
  Calendar,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Layers,
  Factory,
  Boxes
} from 'lucide-react';
import { KnittingStatusOrder } from '../types';
import { calculateKnittingCondition } from '../lib/knittingStatusStore';
import { getCompanyLogo } from '../lib/logoStore';
import { GreyStockStorage, getOrderLookupKeys, GreyStockItem } from '../lib/greyStockStore';
import { SnipDisplayMode } from './KnittingOrderSnippingModal';
import { safeCopyText } from '../lib/clipboardHelper';

function parseDateString(str?: string): Date | null {
  if (!str || str === '-' || str.toLowerCase() === 'pending' || str.toLowerCase() === 'not set') return null;
  const parts = str.match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const mStr = parts[2].toLowerCase();
    const year = parseInt(parts[3], 10);
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    if (months[mStr] !== undefined) {
      return new Date(year, months[mStr], day);
    }
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateToStr(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d.getTime());
  res.setDate(res.getDate() + days);
  return res;
}

interface RaihanOrderCardProps {
  order: KnittingStatusOrder;
  allocations?: any[];
  greyStockItems?: GreyStockItem[];
  onOpenSnippingTool?: (order: KnittingStatusOrder, mode?: SnipDisplayMode) => void;
  onOpenGreyStockSnippingTool?: (group: any) => void;
  className?: string;
  viewMode?: 'all' | 'production' | 'allocation' | 'prediction' | 'grey_stock';
  filterColor?: string;
}

export const RaihanOrderCard: React.FC<RaihanOrderCardProps> = ({
  order,
  allocations = [],
  greyStockItems = [],
  onOpenSnippingTool,
  onOpenGreyStockSnippingTool,
  className = '',
  viewMode = 'all',
  filterColor
}) => {
  const [copied, setCopied] = useState(false);
  const [isSnipMenuOpen, setIsSnipMenuOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'all' | 'production' | 'allocation' | 'prediction' | 'grey_stock'>(viewMode || 'all');
  const customLogo = getCompanyLogo();

  useEffect(() => {
    if (viewMode) {
      setActiveMode(viewMode);
    }
  }, [viewMode]);

  // If a specific color was queried, filter items strictly for that color
  let rawItems = Array.isArray(order.items) ? order.items : [];
  if (filterColor) {
    const fc = filterColor.toLowerCase().trim();
    const filtered = rawItems.filter(it => {
      const c = String(it.color || '').toLowerCase().trim();
      return c.includes(fc) || fc.includes(c);
    });
    if (filtered.length > 0) {
      rawItems = filtered;
    }
  }
  const items = rawItems;
  const condition = calculateKnittingCondition(order.greyQty, order.knitBalance);

  // Compute sums
  const totals = {
    req: items.reduce((acc, it) => acc + (Number(it.reqQty) || 0), 0) || Number(order.reqQty) || 0,
    grey: items.reduce((acc, it) => acc + (Number(it.greyQty) || 0), 0) || Number(order.greyQty) || 0,
    prod: items.reduce((acc, it) => acc + (Number(it.production) || 0), 0) || Number(order.production) || 0,
    bal: items.reduce((acc, it) => acc + (Number(it.knitBalance) || 0), 0) || Number(order.knitBalance) || 0,
    hold: items.reduce((acc, it) => acc + (Number(it.hold) || 0), 0),
    reject: items.reduce((acc, it) => acc + (Number(it.reject) || 0), 0)
  };

  // Prediction calculations
  const activeDailyRate = items.reduce((acc, it) => acc + (Number(it.avgProdPerDay) || 0), 0);
  const standardMachineRate = 180; // standard Epyllion factory circular machine output kg/day
  const totalItemCount = Math.max(1, items.length);
  const fullCapacityRate = Math.max(totalItemCount * standardMachineRate, activeDailyRate);

  const daysAtCurrent = activeDailyRate > 0 ? Math.ceil(totals.bal / activeDailyRate) : (totals.bal > 0 ? Math.ceil(totals.bal / 180) : 0);
  const finishAtCurrent = addDays(new Date(), daysAtCurrent);
  const finishAtCurrentStr = formatDateToStr(finishAtCurrent);

  const daysAtFullCapacity = Math.ceil(totals.bal / fullCapacityRate);
  const finishAtFullCapacity = addDays(new Date(), daysAtFullCapacity);
  const finishAtFullCapacityStr = formatDateToStr(finishAtFullCapacity);

  const targetEndDate = parseDateString(order.knitEndDate);
  const pctDone = totals.grey > 0 ? ((totals.prod / totals.grey) * 100).toFixed(1) : '0';

  let varianceBadge = { text: 'On Track', color: 'emerald', days: 0 };
  if (targetEndDate && totals.bal > 0 && activeDailyRate > 0) {
    const diffMs = finishAtCurrent.getTime() - targetEndDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      varianceBadge = { text: `Delayed by ${diffDays} day(s) past target knit end`, color: 'amber', days: diffDays };
    } else if (diffDays < 0) {
      varianceBadge = { text: `On Track (${Math.abs(diffDays)} day(s) ahead of schedule)`, color: 'emerald', days: diffDays };
    } else {
      varianceBadge = { text: 'Exact On-Schedule delivery', color: 'teal', days: 0 };
    }
  } else if (totals.bal <= 0) {
    varianceBadge = { text: '100% Completed', color: 'emerald', days: 0 };
  }

  // Filter allocated yarn for this order (and color if filterColor is specified)
  const validAllocations = (Array.isArray(allocations) ? allocations : []).filter(y => {
    const ordMatch = String(y.orderNumber || y.order_number || '').trim();
    const qty = Number(y.allocatedQty ?? y.allocated_qty ?? 0);
    const yarn = String(y.allocatedYarn || y.allocated_yarn || y.yarnRequired || '').trim();
    const color = String(y.fabricShade || y.fabric_shade || y.color || '').toLowerCase().trim();
    const matchesColor = !filterColor || color.includes(filterColor.toLowerCase().trim()) || filterColor.toLowerCase().trim().includes(color);
    return ordMatch.includes(order.orderNo) && (qty > 0 || yarn.length > 0) && matchesColor;
  });

  // Group allocations
  const allocGroups = new Map<string, {
    color: string;
    fabricType: string;
    allocatedYarn: string;
    lot: string;
    spinner: string;
    allocatedQty: number;
  }>();

  for (const y of validAllocations) {
    const color = String(y.fabricShade || y.fabric_shade || y.color || 'Standard Shade').trim();
    const fabricType = String(y.fabricsType || y.fabrics_type || y.fabrication || 'Knitted Fabric').trim();
    const allocatedYarn = String(y.allocatedYarn || y.allocated_yarn || y.yarnRequired || '').trim();
    const lot = String(y.lotNo || y.lot_no || 'N/A').trim();
    const spinner = String(y.spinnersName || y.spinners_name || 'N/A').trim();
    const qty = Number(y.allocatedQty ?? y.allocated_qty ?? 0);

    const key = `${color.toLowerCase()}__${fabricType.toLowerCase()}__${allocatedYarn.toLowerCase()}__${lot.toLowerCase()}__${spinner.toLowerCase()}`;
    const existing = allocGroups.get(key);
    if (existing) {
      existing.allocatedQty += qty;
    } else {
      allocGroups.set(key, { color, fabricType, allocatedYarn, lot, spinner, allocatedQty: qty });
    }
  }

  // Fallback: if no yarn allocation records exist in yarn allocations store, derive from filtered items
  if (allocGroups.size === 0 && items.length > 0) {
    for (const itm of items) {
      const color = String(itm.color || 'Standard').trim();
      const fabricType = String(itm.fabType || itm.mcType || 'Knitted Fabric').trim();
      const allocatedYarn = String(itm.yarnCount || 'Allocated Ring Spun Cotton').trim();
      const lot = 'Allocated';
      const spinner = 'Epyllion Spinning / Associated';
      const qty = Number(itm.greyQty || itm.reqQty || 0);

      const key = `${color.toLowerCase()}__${fabricType.toLowerCase()}__${allocatedYarn.toLowerCase()}`;
      const existing = allocGroups.get(key);
      if (existing) {
        existing.allocatedQty += qty;
      } else {
        allocGroups.set(key, { color, fabricType, allocatedYarn, lot, spinner, allocatedQty: qty });
      }
    }
  }

  const sortedAllocations = Array.from(allocGroups.values()).sort((a, b) => {
    const c = a.color.localeCompare(b.color);
    if (c !== 0) return c;
    return a.fabricType.localeCompare(b.fabricType);
  });

  const totalAllocatedQty = sortedAllocations.reduce((sum, a) => sum + a.allocatedQty, 0);
  const conditionText = condition === 'Running' ? 'currently running' : condition.toLowerCase();

  const resolvedGreyItems = React.useMemo(() => {
    let list = Array.isArray(greyStockItems) && greyStockItems.length > 0 ? greyStockItems : [];
    if (list.length === 0) {
      const all = GreyStockStorage.getRecords();
      const keys = getOrderLookupKeys(order.orderNo);
      list = all.filter(g => {
        const rawG = String(g.orderNo || '').trim().toLowerCase();
        return keys.some(k => rawG === k || rawG.includes(k) || k.includes(rawG));
      });
    }
    if (filterColor && list.length > 0) {
      const fc = filterColor.toLowerCase().trim();
      const filtered = list.filter(g => {
        const c = String(g.colour || '').toLowerCase().trim();
        return c.includes(fc) || fc.includes(c);
      });
      if (filtered.length > 0) return filtered;
    }
    return list;
  }, [greyStockItems, order.orderNo, filterColor]);

  const totalGreyNetReceived = resolvedGreyItems.reduce((acc, it) => acc + (Number(it.netReceivedQty) || 0), 0);
  const totalGreyNetIssued = resolvedGreyItems.reduce((acc, it) => acc + (Number(it.netIssuedQty) || 0), 0);
  const totalGreyStock = resolvedGreyItems.reduce((acc, it) => acc + (it.stockQty !== undefined ? Number(it.stockQty) : Math.max(0, (Number(it.netReceivedQty) || 0) - (Number(it.netIssuedQty) || 0))), 0);
  const orderGreyTotal = totals.grey || Number(order.greyQty) || resolvedGreyItems.reduce((acc, it) => acc + (Number(it.matchedGreyQty) || 0), 0);

  const handleCopySummary = () => {
    if (activeMode === 'grey_stock') {
      let gsText = `📦 Grey Stock Summary • Order #${order.orderNo}\n`;
      gsText += `Buyer: ${order.buyerName || 'Epyllion'} | Status: ${(order as any).status || 'Running'}\n`;
      gsText += `Total Grey QTY: ${Math.round(orderGreyTotal).toLocaleString()} kg | Net Received: ${Math.round(totalGreyNetReceived).toLocaleString()} kg | Net Issued: ${Math.round(totalGreyNetIssued).toLocaleString()} kg | Stock: ${Math.round(totalGreyStock).toLocaleString()} kg\n\n`;
      gsText += `Order No. | Colour | Fabric Style | Fabrics Type | Buyer | Owner Unit | Total Grey QTY | Net Received Qty.-Kg | Net Issued Qty.-Kg | Stock Qty. Kg\n`;
      resolvedGreyItems.forEach(it => {
        const g = it.matchedGreyQty || (resolvedGreyItems.length === 1 ? orderGreyTotal : 0);
        const r = it.netReceivedQty || 0;
        const i = it.netIssuedQty || 0;
        const s = it.stockQty !== undefined ? it.stockQty : Math.max(0, r - i);
        gsText += `${order.orderNo} | ${it.colour || '-'} | ${it.fabStyle || '-'} | ${it.fabType || '-'} | ${it.buyerName || order.buyerName || '-'} | ${it.ownerUnit || 'EKL'} | ${Math.round(g)} kg | ${Math.round(r)} kg | ${Math.round(i)} kg | ${Math.round(s)} kg\n`;
      });
      safeCopyText(gsText.trim()).then((ok) => {
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      });
      return;
    }

    if (activeMode === 'prediction') {
      let predText = `⏱️ Completion Date Prediction • Order #${order.orderNo}\n`;
      predText += `Buyer: ${order.buyerName || 'Epyllion'} | Team Leader: ${order.teamLeader || 'Unassigned'}\n`;
      predText += `PMC Knit Dates: ${order.pmcKnitStartDate || 'N/A'} to ${order.pmcKnitEndDate || 'N/A'}\n`;
      predText += `Actual Knit Dates: ${order.actualKnitStartDate || 'Not started'} to ${order.actualKnitEndDate || 'Not finished'}\n\n`;
      predText += `• Progress: ${pctDone}% (${totals.prod.toLocaleString()} kg produced / ${totals.grey.toLocaleString()} kg grey)\n`;
      predText += `• Remaining Balance: ${totals.bal.toLocaleString()} kg\n`;
      predText += `• Active Floor Run-Rate: ${activeDailyRate > 0 ? `${Math.ceil(activeDailyRate).toLocaleString()} kg/day` : '0 kg/day'}\n`;
      predText += `• Projected Completion Date: ${finishAtCurrentStr} (${varianceBadge.text})\n\n`;
      predText += `Itemized Breakdown:\n`;
      items.forEach(it => {
        predText += `• ${it.color} (${it.fabType}): ${Number(it.knitBalance || 0).toLocaleString()} kg remaining | Daily: ${Math.ceil(Number(it.avgProdPerDay || 0))} kg/d | PMC: ${it.pmcKnitStartDate || '-'}\n`;
      });
      safeCopyText(predText).then((ok) => {
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }
      });
      return;
    }

    let summaryText = `Sure! I found it. Order #${order.orderNo}${filterColor ? ` (${filterColor})` : ''} is ${conditionText} (${order.buyerName || 'Epyllion'}):\n`;
    summaryText += `👤 Buyer: ${order.buyerName || 'Epyllion'} | 👔 Team Leader: ${order.teamLeader || 'Unassigned'}\n`;
    summaryText += `📅 PMC Knit Start: ${order.pmcKnitStartDate || '-'} | 📅 PMC Knit End: ${order.pmcKnitEndDate || '-'}\n`;
    summaryText += `📅 Actual Knit Start: ${order.actualKnitStartDate || '-'} | 📅 Actual Knit End: ${order.actualKnitEndDate || '-'}\n\n`;
    if (activeMode !== 'allocation') {
      summaryText += `🏭 Production Data:\n`;
      summaryText += `Color | Fabric Type | GSM | Width | PMC Start | PMC End | Actual Start | Actual End | Req. QTY | Grey QTY | Production | Hold | Reject | Balance\n`;
      items.forEach(it => {
        const pText = Number(it.production || 0) > 0 ? `${Number(it.production).toLocaleString()} kg` : '0 kg';
        const hText = Number(it.hold || 0) > 0 ? `${Number(it.hold).toLocaleString()} kg` : '-';
        const rText = Number(it.reject || 0) > 0 ? `${Number(it.reject).toLocaleString()} kg` : '-';
        summaryText += `${it.color} | ${it.fabType} | ${it.fgsm || '-'} | ${it.fWidth || '-'} | ${it.pmcKnitStartDate || '-'} | ${it.pmcKnitEndDate || '-'} | ${it.actualKnitStartDate || '-'} | ${it.actualKnitEndDate || '-'} | ${Number(it.reqQty || 0).toLocaleString()} kg | ${Number(it.greyQty || 0).toLocaleString()} kg | ${pText} | ${hText} | ${rText} | ${Number(it.knitBalance || 0).toLocaleString()} kg\n`;
      });
      summaryText += `Total | - | - | - | - | - | - | - | ${totals.req.toLocaleString()} kg | ${totals.grey.toLocaleString()} kg | ${totals.prod.toLocaleString()} kg | ${totals.hold > 0 ? `${totals.hold.toLocaleString()} kg` : '-'} | ${totals.reject > 0 ? `${totals.reject.toLocaleString()} kg` : '-'} | ${totals.bal.toLocaleString()} kg\n\n`;
      summaryText += `📊 Total Summary: Req: ${totals.req.toLocaleString()} kg | Grey: ${totals.grey.toLocaleString()} kg | Production: ${totals.prod.toLocaleString()} kg | Hold: ${totals.hold.toLocaleString()} kg | Reject: ${totals.reject.toLocaleString()} kg | Balance: ${totals.bal.toLocaleString()} kg\n`;
    }

    if (activeMode !== 'production' && sortedAllocations.length > 0) {
      summaryText += `\n🧶 Allocated Yarn Details:\n`;
      sortedAllocations.forEach(a => {
        summaryText += `• ${a.color} | ${a.fabricType} | ${a.allocatedYarn} | Lot: ${a.lot} | Spinner: ${a.spinner} | Qty: ${a.allocatedQty.toLocaleString()} kg\n`;
      });
      summaryText += `Total Allocated Yarn: ${totalAllocatedQty.toLocaleString()} kg\n`;
    }

    safeCopyText(summaryText).then((ok) => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    });
  };

  return (
    <div
      className={`raihan-order-summary-card bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl shadow-sm overflow-hidden my-2.5 transition-all text-slate-800 dark:text-slate-100 ${className}`}
      style={{ width: '100%', maxWidth: '100%' }}
    >
      {/* Top Header Matching image.png */}
      <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border-b-2 border-teal-600">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {customLogo ? (
              <div className="flex items-center justify-center shrink-0 max-h-11">
                <img
                  src={customLogo}
                  alt="Epyllion Knitex Ltd."
                  className="h-9 w-auto max-w-[120px] max-h-10 object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center shrink-0 shadow-2xs" title="Epyllion Knitex Logo">
                <svg width="40" height="40" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" className="rounded-xl overflow-hidden shadow-2xs">
                  <rect width="44" height="44" rx="10" fill="#15803D" />
                  <path d="M 25 13 C 27 10 31 8 35 7" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" fill="none" />
                  <path d="M 27 16 C 32 13 36 11 40 10" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" fill="none" />
                  <path d="M 28 20 C 33 17 38 14 42 13" stroke="#FBBF24" strokeWidth="2" strokeLinecap="round" fill="none" />
                  <path d="M 9 27 C 7 19 16 11 24 17 C 26 19 28 22 26 27 C 20.5 29 15 29 9 27 Z" fill="#22C55E" />
                  <path d="M 11 26 C 15 22 20 22 24 26" stroke="#FFFFFF" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                  <path d="M 7 32 C 15 26 26 20 37 23" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                  <text x="13" y="29" fontFamily="system-ui, -apple-system, sans-serif" fontSize="18" fontWeight="900" fill="#FFFFFF">E</text>
                </svg>
              </div>
            )}

            <div>
              <div className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                EPYLLION KNITEX LIMITED
              </div>
              <div className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5 flex-wrap">
                <span>Ask Raihan · Production Guide</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  Order #{order.orderNo} {filterColor ? `(${filterColor})` : ''} {activeMode === 'prediction' ? '• Completion Date Prediction' : activeMode === 'production' ? '• Production Data' : activeMode === 'allocation' ? '• Yarn Allocation' : 'Summary'}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            {(order as any).isSyntheticKnittingStatus || (order as any).dataSource === 'plan_allocation' ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-700 px-3 py-1 rounded-full shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Plan / Allocation (Pending Knitting)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 px-3 py-1 rounded-full shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                Verified ERP Record
              </span>
            )}
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        {((order as any).isSyntheticKnittingStatus || (order as any).dataSource === 'plan_allocation') && (
          <div className="mt-2.5 px-3 py-2 bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              <strong>Note:</strong> Order #{order.orderNo} does not have entries in the Knitting Status tracking module yet. Specifications are displayed from <strong>Plan Order Followup / Yarn Allocation</strong>.
            </span>
          </div>
        )}

        {/* View Mode Interactive Switcher */}
        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 overflow-x-auto text-[11.5px]">
          <span className="text-slate-400 dark:text-slate-500 text-[11px] font-semibold mr-1 shrink-0">View:</span>
          <button
            type="button"
            onClick={() => setActiveMode('all')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeMode === 'all'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            📊 All Details
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('grey_stock')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeMode === 'grey_stock'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            📦 Grey Stock
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('prediction')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeMode === 'prediction'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ⏱️ Completion Prediction
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('production')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeMode === 'production'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            🏭 Production Data
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('allocation')}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all shrink-0 cursor-pointer ${
              activeMode === 'allocation'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            🧶 Allocated Yarn
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* Order Overview & PMC / ACT Dates Breakdown Strip */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Buyer:</span>
            <strong className="text-slate-900 dark:text-white font-bold">{order.buyerName || 'N/A'}</strong>
          </div>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-semibold">Team Leader:</span>
            <strong className="text-slate-900 dark:text-white font-bold">{order.teamLeader || 'N/A'}</strong>
          </div>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-slate-500 font-semibold">PMC Knit Start:</span>
            <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800">
              {order.pmcKnitStartDate || '-'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-500 font-semibold">ACT Knit Start:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {order.actualKnitStartDate || '-'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span className="text-slate-500 font-semibold">PMC Knit End:</span>
            <span className="font-mono font-bold text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800">
              {order.pmcKnitEndDate || '-'}
            </span>
          </div>
          <span className="text-slate-300 dark:text-slate-600 hidden sm:inline">•</span>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-500 font-semibold">ACT Knit End:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
              {order.actualKnitEndDate || '-'}
            </span>
          </div>
        </div>

        {/* Intro text line */}
        <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
          {activeMode === 'prediction'
            ? `Sure! Here is the completion date prediction & timeline forecast for Order #${order.orderNo}${filterColor ? ` (${filterColor})` : ''} (${order.buyerName || 'Stanley Stella'}):`
            : activeMode === 'allocation'
              ? `Sure! I found it. Here is the allocated yarn for Order #${order.orderNo}${filterColor ? ` (${filterColor})` : ''} (${order.buyerName || 'Stanley Stella'}):`
              : activeMode === 'production'
                ? `Sure! I found it. Here is the production data for Order #${order.orderNo}${filterColor ? ` (${filterColor})` : ''} (${order.buyerName || 'Stanley Stella'}):`
                : activeMode === 'grey_stock'
                  ? `Sure! I found it. Here is the Grey Stock data for Order #${order.orderNo}${filterColor ? ` (${filterColor})` : ''} (${order.buyerName || 'Stanley Stella'}):`
                  : `Sure! I found it. Order #${order.orderNo}${filterColor ? ` (${filterColor})` : ''} is ${conditionText} (${order.buyerName || 'Stanley Stella'}):`
          }
        </p>

        {/* SECTION: COMPLETION DATE PREDICTION DASHBOARD (When activeMode is 'prediction') */}
        {activeMode === 'prediction' && (
          <div className="space-y-4">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Projected Finish Date */}
              <div className="p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 shadow-2xs">
                <div className="flex items-center gap-1.5 text-teal-800 dark:text-teal-300 font-bold text-[11px] mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Projected Completion</span>
                </div>
                <div className="text-base sm:text-lg font-black text-teal-950 dark:text-teal-100">
                  {finishAtCurrentStr}
                </div>
                <div className="text-[10px] font-bold text-teal-700 dark:text-teal-400 mt-0.5">
                  ~{daysAtCurrent} days remaining
                </div>
              </div>

              {/* Status Variance */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-bold text-[11px] mb-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Schedule Variance</span>
                </div>
                <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white line-clamp-1">
                  {varianceBadge.text}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Target: {order.knitEndDate || 'Not set'}
                </div>
              </div>

              {/* Balance Remaining */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 shadow-2xs">
                <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-bold text-[11px] mb-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Knit Balance Left</span>
                </div>
                <div className="text-base sm:text-lg font-black text-amber-950 dark:text-amber-100">
                  {totals.bal.toLocaleString()} kg
                </div>
                <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                  {pctDone}% finished
                </div>
              </div>

              {/* Current Daily Run-rate */}
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 shadow-2xs">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] mb-1">
                  <Factory className="w-3.5 h-3.5" />
                  <span>Floor Speed</span>
                </div>
                <div className="text-base sm:text-lg font-black text-emerald-950 dark:text-emerald-100">
                  {activeDailyRate > 0 ? `${Math.ceil(activeDailyRate).toLocaleString()} kg` : '0 kg'}
                </div>
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                  daily output rate
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <span>Production Progress</span>
                <span className="font-mono">{pctDone}% ({totals.prod.toLocaleString()} kg / {totals.grey.toLocaleString()} kg)</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-teal-600 h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, Number(pctDone)))}%` }}
                />
              </div>
            </div>

            {/* Projected Scenarios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl border border-teal-200 dark:border-teal-900/80 bg-teal-50/30 dark:bg-teal-950/20">
                <div className="text-xs font-bold text-teal-900 dark:text-teal-200 mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>Scenario A (Current Daily Pace @ {Math.ceil(activeDailyRate).toLocaleString()} kg/d)</span>
                </div>
                <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300 mt-2">
                  <li>• Estimated Working Days Needed: <strong className="text-slate-900 dark:text-white">~{daysAtCurrent} days</strong></li>
                  <li>• Projected Finish Date: <strong className="text-teal-700 dark:text-teal-300">{finishAtCurrentStr}</strong></li>
                  <li>• Schedule Variance: <strong className="text-slate-900 dark:text-white">{varianceBadge.text}</strong></li>
                </ul>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="text-xs font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Scenario B (Standard Floor Loading — {totalItemCount} Machine(s) @ 180 kg/d)</span>
                </div>
                <ul className="text-xs space-y-1 text-slate-700 dark:text-slate-300 mt-2">
                  <li>• Estimated Daily Output: <strong className="text-slate-900 dark:text-white">{fullCapacityRate.toLocaleString()} kg/day</strong></li>
                  <li>• Estimated Days Needed: <strong className="text-slate-900 dark:text-white">~{daysAtFullCapacity} days</strong></li>
                  <li>• Projected Completion: <strong className="text-slate-900 dark:text-white">{finishAtFullCapacityStr}</strong></li>
                </ul>
              </div>
            </div>

            {/* Item-by-item breakdown */}
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2">
                <span>🧵</span>
                <span>Color-by-Color Item Status & Remaining Days</span>
              </h4>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-xs text-left border-collapse table-auto min-w-[550px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="px-3 py-2">Color</th>
                      <th className="px-3 py-2">Fabric Type</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                      <th className="px-3 py-2 text-right">Daily Rate</th>
                      <th className="px-3 py-2">Status & Estimated Timeline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((it, idx) => {
                      const itmBal = Number(it.knitBalance || 0);
                      const itmRate = Number(it.avgProdPerDay || 0);
                      const itmProd = Number(it.production || 0);
                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="px-3 py-2 font-bold text-slate-900 dark:text-white">{it.color || 'Standard'}</td>
                          <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{it.fabType || '-'}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {itmBal.toLocaleString()} kg
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-slate-600 dark:text-slate-400">
                            {itmRate > 0 ? `${Math.ceil(itmRate)} kg/d` : '-'}
                          </td>
                          <td className="px-3 py-2">
                            {itmBal <= 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">
                                ✅ Completed
                              </span>
                            ) : itmRate > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md">
                                🟢 Running (~{Math.ceil(itmBal / itmRate)} days left)
                              </span>
                            ) : itmProd > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">
                                🟡 Stopped / Hold ({itmProd.toLocaleString()} kg done)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                                ⏳ Pending Setup (~{Math.ceil(itmBal / standardMachineRate)} days @ 180 kg/d)
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Floor Optimization Advice */}
            <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-xs space-y-1.5">
              <div className="font-bold text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>💡 Raihan's Floor Optimization Advice</span>
              </div>
              <p className="text-slate-700 dark:text-slate-300">
                • Target delivery end date is <strong>{order.knitEndDate || 'Not set'}</strong>. Current floor pace yields <strong>~{daysAtCurrent} days</strong> of knitting balance.
              </p>
              {items.some(it => (Number(it.production) || 0) === 0 && (Number(it.knitBalance) || 0) > 0) && (
                <p className="text-slate-700 dark:text-slate-300">
                  • Setup dedicated circular machines on pending items to boost output by <strong>+{standardMachineRate} kg/day</strong> per machine.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Section: Production Data (Shown when activeMode is 'all' or 'production') */}
        {activeMode !== 'allocation' && activeMode !== 'prediction' && activeMode !== 'grey_stock' && (
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2">
              <span>🏭</span>
              <span>Production Data: {filterColor ? `(${filterColor})` : ''}</span>
            </h4>

            {/* 10-Column Production Data Table with Generous Width */}
            <div className="rounded-xl border border-slate-300 dark:border-slate-700 overflow-x-auto bg-white dark:bg-slate-900 shadow-2xs">
              <table className="w-full text-xs text-left border-collapse table-auto min-w-[760px]">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-300 dark:border-slate-700">
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 min-w-[100px]">Color</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 min-w-[100px]">Fabric Type</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-center min-w-[65px]">GSM</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-center min-w-[65px]">Width</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 min-w-[105px]">
                      <div>Knit Start</div>
                      <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">PMC / ACT</div>
                    </th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 min-w-[105px]">
                      <div>Knit End</div>
                      <div className="text-[9px] font-bold text-purple-600 dark:text-purple-400">PMC / ACT</div>
                    </th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right min-w-[95px]">Req. QTY</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right min-w-[95px]">Grey QTY</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right min-w-[100px]">Production</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right min-w-[70px]">Hold</th>
                    <th className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right min-w-[70px]">Reject</th>
                    <th className="px-3 py-2.5 text-right min-w-[100px] font-bold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-4 text-center text-slate-400">
                        No production data registered for this order.
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const prodNum = Number(it.production || 0);
                      const holdNum = Number(it.hold || 0);
                      const rejectNum = Number(it.reject || 0);
                      const isEven = idx % 2 === 1;

                      const itemPmcStart = it.pmcKnitStartDate || order.pmcKnitStartDate || '';
                      const hasItemActivity = prodNum > 0 || holdNum > 0;
                      const itmGrey = Number(it.greyQty || 0);
                      const isItmComplete = (it.knitBalance !== undefined && it.knitBalance < 3) || (prodNum > 0 && prodNum >= itmGrey);
                      const itemActStart = hasItemActivity ? (it.actualKnitStartDate || '') : '';
                      const itemPmcEnd = it.pmcKnitEndDate || order.pmcKnitEndDate || '';
                      const itemActEnd = hasItemActivity ? (it.actualKnitEndDate || '') : '';

                      return (
                        <tr
                          key={idx}
                          className={isEven ? 'bg-slate-50/70 dark:bg-slate-850/60' : 'bg-white dark:bg-slate-900'}
                        >
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 font-semibold text-slate-900 dark:text-white">
                            {it.color || 'Standard'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                            {it.fabType || '-'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-slate-600 dark:text-slate-400">
                            {it.fgsm || '-'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-center font-mono text-slate-600 dark:text-slate-400">
                            {it.fWidth || '-'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 font-mono text-[10.5px]">
                            <div className="flex flex-col gap-0.5">
                              {itemPmcStart ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase w-6 shrink-0">PMC:</span>
                                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{itemPmcStart}</span>
                                </div>
                              ) : null}
                              {itemActStart ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase w-6 shrink-0">ACT:</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{itemActStart}</span>
                                </div>
                              ) : (
                                !itemPmcStart && <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 font-mono text-[10.5px]">
                            <div className="flex flex-col gap-0.5">
                              {itemPmcEnd ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase w-6 shrink-0">PMC:</span>
                                  <span className="text-slate-600 dark:text-slate-300 font-semibold">{itemPmcEnd}</span>
                                </div>
                              ) : null}
                              {itemActEnd ? (
                                <div className="flex items-center gap-1">
                                  <span className="text-[8.5px] font-bold text-slate-400 uppercase w-6 shrink-0">ACT:</span>
                                  <span className="font-bold text-slate-900 dark:text-white">{itemActEnd}</span>
                                </div>
                              ) : (
                                !itemPmcEnd && <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-right font-mono">
                            {Number(it.reqQty || 0).toLocaleString()} kg
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-right font-mono">
                            {Number(it.greyQty || 0).toLocaleString()} kg
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-right font-mono">
                            {prodNum > 0 ? `${prodNum.toLocaleString()} kg` : '0 kg'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-right font-mono text-slate-600 dark:text-slate-400">
                            {holdNum > 0 ? `${holdNum.toLocaleString()} kg` : '-'}
                          </td>
                          <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 text-right font-mono text-slate-600 dark:text-slate-400">
                            {rejectNum > 0 ? `${rejectNum.toLocaleString()} kg` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {Number(it.knitBalance || 0).toLocaleString()} kg
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* Total Row */}
                  <tr className="bg-emerald-50 dark:bg-emerald-950/40 font-bold border-t-2 border-emerald-400 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100">
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 font-extrabold uppercase text-xs">Total</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-center">-</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-center">-</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-center">-</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-center">-</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-center">-</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right font-mono">{totals.req.toLocaleString()} kg</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right font-mono">{totals.grey.toLocaleString()} kg</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right font-mono">{totals.prod.toLocaleString()} kg</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right font-mono">{totals.hold > 0 ? `${totals.hold.toLocaleString()} kg` : '-'}</td>
                    <td className="px-3 py-2.5 border-r border-slate-200 dark:border-slate-700 text-right font-mono">{totals.reject > 0 ? `${totals.reject.toLocaleString()} kg` : '-'}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-black">{totals.bal.toLocaleString()} kg</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Summary Row matching image.png */}
            <div className="text-xs sm:text-[12.5px] font-bold text-slate-800 dark:text-slate-200 leading-relaxed pt-2">
              <span>📊 Total Summary:</span> Req: <strong className="text-slate-900 dark:text-white">{totals.req.toLocaleString()} kg</strong> | Grey: <strong className="text-slate-900 dark:text-white">{totals.grey.toLocaleString()} kg</strong> | Production: <strong className="text-slate-900 dark:text-white">{totals.prod.toLocaleString()} kg</strong> | Hold: <strong className="text-slate-900 dark:text-white">{totals.hold.toLocaleString()} kg</strong> | Reject: <strong className="text-slate-900 dark:text-white">{totals.reject.toLocaleString()} kg</strong> | Balance: <strong className="text-slate-900 dark:text-white">{totals.bal.toLocaleString()} kg</strong>
            </div>
          </div>
        )}

        {/* Section: Allocated Yarn Details (Shown when activeMode is 'all' or 'allocation') */}
        {activeMode !== 'production' && activeMode !== 'prediction' && activeMode !== 'grey_stock' && sortedAllocations.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <span>🧶</span>
                <span>Allocated Yarn Details: {filterColor ? `(${filterColor})` : ''}</span>
              </span>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                Total: {totalAllocatedQty.toLocaleString()} kg
              </span>
            </h4>

            <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/60 overflow-x-auto bg-amber-50/20 dark:bg-amber-950/20 shadow-2xs">
              <table className="w-full text-xs text-left border-collapse table-auto min-w-[550px]">
                <thead>
                  <tr className="bg-amber-100/70 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 font-bold border-b border-amber-200 dark:border-amber-900/60">
                    <th className="px-3 py-2">Color</th>
                    <th className="px-3 py-2">Fabric Type</th>
                    <th className="px-3 py-2 min-w-[140px]">Allocated Yarn</th>
                    <th className="px-3 py-2">Lot</th>
                    <th className="px-3 py-2">Spinner</th>
                    <th className="px-3 py-2 text-right">Sum of Allocated Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60 dark:divide-amber-900/40">
                  {sortedAllocations.map((a, i) => (
                    <tr key={i} className="hover:bg-amber-100/40 dark:hover:bg-amber-900/30">
                      <td className="px-3 py-1.5 font-bold">{a.color}</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{a.fabricType}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-900 dark:text-slate-100">{a.allocatedYarn}</td>
                      <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-400">{a.lot}</td>
                      <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">{a.spinner}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold text-amber-900 dark:text-amber-300">
                        {a.allocatedQty.toLocaleString()} kg
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-amber-100/90 dark:bg-amber-950/80 font-bold text-amber-950 dark:text-amber-200 border-t border-amber-300 dark:border-amber-800">
                    <td className="px-3 py-2 font-black uppercase text-xs">Total</td>
                    <td colSpan={4} className="px-3 py-2 text-slate-500 dark:text-slate-400 text-right font-normal">Allocated Yarn Sum</td>
                    <td className="px-3 py-2 text-right font-mono font-black text-amber-900 dark:text-amber-300">
                      {totalAllocatedQty.toLocaleString()} kg
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section: Grey Stock Details (Shown when activeMode is 'all' or 'grey_stock') */}
        {activeMode !== 'production' && activeMode !== 'prediction' && activeMode !== 'allocation' && resolvedGreyItems.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <span>📦</span>
                <span>Grey Stock Summary: {filterColor ? `(${filterColor})` : ''}</span>
              </span>
              <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                Stock: {Math.round(totalGreyStock).toLocaleString()} kg
              </span>
            </h4>

            {/* KPI Cards Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
              <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <span className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-400">Total Grey QTY</span>
                <div className="text-base font-black font-mono text-indigo-950 dark:text-indigo-200 mt-0.5">
                  {Math.round(orderGreyTotal).toLocaleString()} kg
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Net Received</span>
                <div className="text-base font-black font-mono text-emerald-950 dark:text-emerald-200 mt-0.5">
                  {Math.round(totalGreyNetReceived).toLocaleString()} kg
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800">
                <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-400">Net Issued</span>
                <div className="text-base font-black font-mono text-blue-950 dark:text-blue-200 mt-0.5">
                  {Math.round(totalGreyNetIssued).toLocaleString()} kg
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <span className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Stock Qty. Kg</span>
                <div className="text-base font-black font-mono text-amber-950 dark:text-amber-200 mt-0.5">
                  {Math.round(totalGreyStock).toLocaleString()} kg
                </div>
              </div>
            </div>

            {/* 10-Column Grey Stock Table matching user headers */}
            <div className="rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 overflow-x-auto bg-indigo-50/10 dark:bg-indigo-950/10 shadow-2xs">
              <table className="w-full text-xs text-left border-collapse table-auto min-w-[720px]">
                <thead>
                  <tr className="bg-indigo-100/70 dark:bg-indigo-950/60 text-indigo-950 dark:text-indigo-200 font-bold border-b border-indigo-200 dark:border-indigo-900/60">
                    <th className="px-3 py-2">Order No.</th>
                    <th className="px-3 py-2">Colour</th>
                    <th className="px-3 py-2">Fabric Style</th>
                    <th className="px-3 py-2">Fabrics Type</th>
                    <th className="px-3 py-2">Buyer</th>
                    <th className="px-3 py-2 text-center">Owner Unit</th>
                    <th className="px-3 py-2 text-right text-indigo-700 dark:text-indigo-300">Total Grey QTY</th>
                    <th className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-300">Net Received Qty.-Kg</th>
                    <th className="px-3 py-2 text-right text-blue-700 dark:text-blue-300">Net Issued Qty.-Kg</th>
                    <th className="px-3 py-2 text-right text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/30">Stock Qty. Kg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-indigo-100/60 dark:divide-indigo-900/40">
                  {resolvedGreyItems.map((itm, i) => {
                    let gQty = Math.round(Number(itm.matchedGreyQty || 0));
                    if (gQty === 0 && resolvedGreyItems.length === 1 && orderGreyTotal) {
                      gQty = Math.round(orderGreyTotal);
                    }
                    const rQty = Math.round(Number(itm.netReceivedQty || 0));
                    const iQty = Math.round(Number(itm.netIssuedQty || 0));
                    const sQty = itm.stockQty !== undefined ? Math.round(Number(itm.stockQty)) : Math.max(0, rQty - iQty);

                    return (
                      <tr key={itm.id || i} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20">
                        <td className="px-3 py-2 font-mono font-bold">{order.orderNo}</td>
                        <td className="px-3 py-2 font-bold">{itm.colour || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{itm.fabStyle || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{itm.fabType || '—'}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{itm.buyerName || order.buyerName || '—'}</td>
                        <td className="px-3 py-2 text-center font-mono text-[11px] font-bold">{itm.ownerUnit || 'EKL'}</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-indigo-700 dark:text-indigo-300">{gQty.toLocaleString()} kg</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">{rQty.toLocaleString()} kg</td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-blue-700 dark:text-blue-300">{iQty.toLocaleString()} kg</td>
                        <td className="px-3 py-2 text-right font-mono font-black text-amber-900 dark:text-amber-200 bg-amber-50/40 dark:bg-amber-950/20">{sQty.toLocaleString()} kg</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-indigo-100/90 dark:bg-indigo-950/80 font-black text-indigo-950 dark:text-indigo-100 border-t-2 border-indigo-300 dark:border-indigo-800">
                    <td colSpan={6} className="px-3 py-2.5 uppercase tracking-wider text-xs">Total Order Sum</td>
                    <td className="px-3 py-2.5 text-right font-mono text-indigo-800 dark:text-indigo-200">{Math.round(orderGreyTotal).toLocaleString()} kg</td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-800 dark:text-emerald-200">{Math.round(totalGreyNetReceived).toLocaleString()} kg</td>
                    <td className="px-3 py-2.5 text-right font-mono text-blue-800 dark:text-blue-200">{Math.round(totalGreyNetIssued).toLocaleString()} kg</td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-900 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-900/40">{Math.round(totalGreyStock).toLocaleString()} kg</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total Summary Row */}
            <div className="text-xs sm:text-[12.5px] font-bold text-slate-800 dark:text-slate-200 leading-relaxed pt-2">
              <span>📦 Total Grey Stock Summary:</span> Grey Req: <strong className="text-indigo-600 dark:text-indigo-400">{Math.round(orderGreyTotal).toLocaleString()} kg</strong> | Received: <strong className="text-emerald-600 dark:text-emerald-400">{Math.round(totalGreyNetReceived).toLocaleString()} kg</strong> | Issued: <strong className="text-blue-600 dark:text-blue-400">{Math.round(totalGreyNetIssued).toLocaleString()} kg</strong> | Stock: <strong className="text-amber-600 dark:text-amber-400">{Math.round(totalGreyStock).toLocaleString()} kg</strong>
            </div>
          </div>
        )}

        {/* Card Footer Matching image.png */}
        <div className="mt-4 pt-3 border-t border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 flex-wrap gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>Verified ERP Summary generated by Ask Raihan</span>
          </span>
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            Epyllion Knitex Limited-Knitting Department.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {onOpenSnippingTool && (
              <div className="relative inline-flex items-center rounded-xl shadow-xs overflow-visible bg-teal-600 hover:bg-teal-700 transition-all">
                <button
                  type="button"
                  onClick={() => onOpenSnippingTool(order, activeMode === 'grey_stock' ? 'grey_stock' : (activeMode === 'allocation' ? 'allocation' : (activeMode === 'production' ? 'knitting' : 'combine')))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700 cursor-pointer active:scale-98 rounded-l-xl"
                  title="Open Snipping Tool (HD Snapshot)"
                >
                  <Scissors className="w-3.5 h-3.5" />
                  <span>Snipping Tool</span>
                </button>
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSnipMenuOpen(prev => !prev);
                  }}
                  className="px-2 py-1.5 text-white/90 hover:text-white hover:bg-teal-800 border-l border-teal-500/80 cursor-pointer rounded-r-xl"
                  title="Choose Screenshot Option: 1. Knitting Status, 2. Yarn Allocation, 3. Grey Stock, 4. All Combine"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isSnipMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSnipMenuOpen && (
                  <div 
                    className="absolute left-0 bottom-full mb-1.5 w-56 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1 z-30 animate-in fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                      Choose Screenshot View
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSnipMenuOpen(false);
                        onOpenSnippingTool(order, 'knitting');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>1. Knitting Status</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSnipMenuOpen(false);
                        onOpenSnippingTool(order, 'allocation');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5 text-amber-600" />
                      <span>2. Yarn Allocation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSnipMenuOpen(false);
                        onOpenSnippingTool(order, 'grey_stock');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Boxes className="w-3.5 h-3.5 text-purple-600" />
                      <span>3. Grey Stock</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSnipMenuOpen(false);
                        onOpenSnippingTool(order, 'combine');
                      }}
                      className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-t border-slate-100 dark:border-slate-800 transition-colors"
                    >
                      <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                      <span>4. All Combine</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
              title="Copy formatted summary text"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>{activeMode === 'prediction' ? 'Copy Prediction' : 'Copy Summary'}</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[10.5px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>Verified ERP Summary Layout</span>
            <ChevronRight className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
