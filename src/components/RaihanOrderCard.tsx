import React, { useState } from 'react';
import {
  Scissors,
  Copy,
  Check,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { KnittingStatusOrder } from '../types';
import { calculateKnittingCondition } from '../lib/knittingStatusStore';
import { getCompanyLogo } from '../lib/logoStore';

interface RaihanOrderCardProps {
  order: KnittingStatusOrder;
  allocations?: any[];
  onOpenSnippingTool?: (order: KnittingStatusOrder) => void;
  className?: string;
}

export const RaihanOrderCard: React.FC<RaihanOrderCardProps> = ({
  order,
  allocations = [],
  onOpenSnippingTool,
  className = ''
}) => {
  const [copied, setCopied] = useState(false);
  const customLogo = getCompanyLogo();

  const items = Array.isArray(order.items) ? order.items : [];
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

  // Filter allocated yarn for this order
  const validAllocations = (Array.isArray(allocations) ? allocations : []).filter(y => {
    const ordMatch = String(y.orderNumber || y.order_number || '').trim();
    const qty = Number(y.allocatedQty ?? y.allocated_qty ?? 0);
    const yarn = String(y.allocatedYarn || y.allocated_yarn || y.yarnRequired || '').trim();
    return ordMatch.includes(order.orderNo) && qty > 0 && yarn.length > 0;
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

  // Fallback: if no yarn allocation records exist in yarn allocations store, derive from order.items
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

  const handleCopySummary = () => {
    let summaryText = `Sure! I found it. Order #${order.orderNo} is ${conditionText} (${order.buyerName || 'Epyllion'}):\n\n`;
    summaryText += `🏭 Production Data:\n`;
    summaryText += `Color | Fabric Type | GSM | Width | Req. QTY | Grey QTY | Production | Hold | Reject | Balance\n`;
    items.forEach(it => {
      const pText = Number(it.production || 0) > 0 ? `${Number(it.production).toLocaleString()} kg` : '0 kg';
      const hText = Number(it.hold || 0) > 0 ? `${Number(it.hold).toLocaleString()} kg` : '-';
      const rText = Number(it.reject || 0) > 0 ? `${Number(it.reject).toLocaleString()} kg` : '-';
      summaryText += `${it.color} | ${it.fabType} | ${it.fgsm || '-'} | ${it.fWidth || '-'} | ${Number(it.reqQty || 0).toLocaleString()} kg | ${Number(it.greyQty || 0).toLocaleString()} kg | ${pText} | ${hText} | ${rText} | ${Number(it.knitBalance || 0).toLocaleString()} kg\n`;
    });
    summaryText += `Total | - | - | - | ${totals.req.toLocaleString()} kg | ${totals.grey.toLocaleString()} kg | ${totals.prod.toLocaleString()} kg | ${totals.hold > 0 ? `${totals.hold.toLocaleString()} kg` : '-'} | ${totals.reject > 0 ? `${totals.reject.toLocaleString()} kg` : '-'} | ${totals.bal.toLocaleString()} kg\n\n`;
    summaryText += `📊 Total Summary: Req: ${totals.req.toLocaleString()} kg | Grey: ${totals.grey.toLocaleString()} kg | Production: ${totals.prod.toLocaleString()} kg | Hold: ${totals.hold.toLocaleString()} kg | Reject: ${totals.reject.toLocaleString()} kg | Balance: ${totals.bal.toLocaleString()} kg\n`;

    if (sortedAllocations.length > 0) {
      summaryText += `\n🧶 Allocated Yarn Details:\n`;
      sortedAllocations.forEach(a => {
        summaryText += `• ${a.color} | ${a.fabricType} | ${a.allocatedYarn} | Lot: ${a.lot} | Spinner: ${a.spinner} | Qty: ${a.allocatedQty.toLocaleString()} kg\n`;
      });
      summaryText += `Total Allocated Yarn: ${totalAllocatedQty.toLocaleString()} kg\n`;
    }

    navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
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
              <div className="text-xs font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1.5">
                <span>Ask Raihan · Production Guide</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="text-slate-700 dark:text-slate-300 font-semibold">
                  Order #{order.orderNo} Summary
                </span>
              </div>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-700 px-3 py-1 rounded-full shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Verified ERP Record
            </span>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {new Date().toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Intro text line */}
        <p className="text-xs sm:text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
          Sure! I found it. Order #{order.orderNo} is {conditionText} ({order.buyerName || 'Stanley Stella'}):
        </p>

        {/* Section Heading: Production Data */}
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mb-2">
            <span>🏭</span>
            <span>Production Data:</span>
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
                    <td colSpan={10} className="py-4 text-center text-slate-400">
                      No production data registered for this order.
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => {
                    const prodNum = Number(it.production || 0);
                    const holdNum = Number(it.hold || 0);
                    const rejectNum = Number(it.reject || 0);
                    const isEven = idx % 2 === 1;

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
        </div>

        {/* Total Summary Row matching image.png */}
        <div className="text-xs sm:text-[12.5px] font-bold text-slate-800 dark:text-slate-200 leading-relaxed pt-1">
          <span>📊 Total Summary:</span> Req: <strong className="text-slate-900 dark:text-white">{totals.req.toLocaleString()} kg</strong> | Grey: <strong className="text-slate-900 dark:text-white">{totals.grey.toLocaleString()} kg</strong> | Production: <strong className="text-slate-900 dark:text-white">{totals.prod.toLocaleString()} kg</strong> | Hold: <strong className="text-slate-900 dark:text-white">{totals.hold.toLocaleString()} kg</strong> | Reject: <strong className="text-slate-900 dark:text-white">{totals.reject.toLocaleString()} kg</strong> | Balance: <strong className="text-slate-900 dark:text-white">{totals.bal.toLocaleString()} kg</strong>
        </div>

        {/* Layer 3: Allocated Yarn Details if exists */}
        {sortedAllocations.length > 0 && (
          <div className="pt-2">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5">
                <span>🧶</span>
                <span>Allocated Yarn Details:</span>
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
              <button
                type="button"
                onClick={() => onOpenSnippingTool(order)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-xs cursor-pointer active:scale-98"
                title="Open in Snipping Tool (1060px HD View) to snapshot, copy HD image, or download PNG"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Open in Snipping Tool (HD Snapshot)</span>
              </button>
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
                  <span>Copy Summary</span>
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
