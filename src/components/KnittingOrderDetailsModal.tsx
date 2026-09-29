import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Eye,
  Building2,
  User,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Download,
  X,
  Scissors
} from 'lucide-react';
import { KnittingStatusOrder } from '../types';
import { calculateKnittingCondition, sortKnittingItems } from '../lib/knittingStatusStore';
import { KnittingOrderSnippingModal } from './KnittingOrderSnippingModal';

interface KnittingOrderDetailsModalProps {
  order: KnittingStatusOrder;
  onClose: () => void;
}

export function KnittingOrderDetailsModal({ order, onClose }: KnittingOrderDetailsModalProps) {
  const [showSnippingModal, setShowSnippingModal] = useState(false);
  const condition = calculateKnittingCondition(order.greyQty, order.knitBalance);
  const items = useMemo(() => sortKnittingItems(order.items || []), [order.items]);
  const percentDone = order.greyQty > 0 ? Math.min(100, Math.round((order.production / order.greyQty) * 100)) : 0;
  const primaryUnit = items.find(i => i.productionUnit)?.productionUnit || '';

  // Calculate totals across all items, or fall back to order values if no items are listed
  const totals = useMemo(() => {
    if (items.length === 0) {
      return {
        reqQty: order.reqQty || 0,
        greyQty: order.greyQty || 0,
        production: order.production || 0,
        hold: 0,
        reject: 0,
        itmQty: 0,
        knitBalance: order.knitBalance || 0,
        avgProdPerDay: 0,
      };
    }
    return items.reduce((acc, itm) => ({
      reqQty: acc.reqQty + (itm.reqQty || 0),
      greyQty: acc.greyQty + (itm.greyQty || 0),
      production: acc.production + (itm.production || 0),
      hold: acc.hold + (itm.hold || 0),
      reject: acc.reject + (itm.reject || 0),
      itmQty: acc.itmQty + (itm.itmQty || 0),
      knitBalance: acc.knitBalance + (itm.knitBalance || 0),
      avgProdPerDay: acc.avgProdPerDay + (itm.avgProdPerDay || 0),
    }), { reqQty: 0, greyQty: 0, production: 0, hold: 0, reject: 0, itmQty: 0, knitBalance: 0, avgProdPerDay: 0 });
  }, [items, order]);

  // Export this specific order data and its fabric breakdown to Excel
  const handleExportOrder = () => {
    const dataRows = items.map((itm, idx) => ({
      '#': idx + 1,
      'Order No.': order.orderNo,
      'Buyer Name': order.buyerName,
      'Team Leader': order.teamLeader,
      'Color': itm.color,
      'M/C Type': itm.mcType,
      'Fab. Type': itm.fabType,
      'FGSM': itm.fgsm,
      'F. Width': itm.fWidth,
      'Yarn Count': itm.yarnCount,
      'Gauge & Dia': itm.gaugeDia,
      'Knit Start Date': (Number(itm.production || 0) > 0 || Number(itm.hold || 0) > 0) ? (itm.knitStartDate || '') : '',
      'Knit End Date': (Number(itm.production || 0) > 0 || Number(itm.hold || 0) > 0) ? (itm.knitEndDate || '') : '',
      'Req. Qty': itm.reqQty,
      'Grey Qty': itm.greyQty,
      'Production': itm.production,
      'Hold': itm.hold,
      'Reject': itm.reject,
      'ITM QTY': itm.itmQty,
      'Knit Balance': itm.knitBalance,
      'Production Unit': itm.productionUnit,
      'Avg. Prod/Day': itm.avgProdPerDay,
      'Condition': calculateKnittingCondition(itm.greyQty, itm.knitBalance),
    }));

    const finalRows = dataRows.length > 0 ? dataRows : [{
      '#': 1,
      'Order No.': order.orderNo,
      'Buyer Name': order.buyerName,
      'Team Leader': order.teamLeader,
      'Color': '-',
      'M/C Type': '-',
      'Fab. Type': '-',
      'FGSM': '-',
      'F. Width': '-',
      'Yarn Count': '-',
      'Gauge & Dia': '-',
      'Knit Start Date': order.knitStartDate || '',
      'Knit End Date': order.knitEndDate || '',
      'Req. Qty': order.reqQty,
      'Grey Qty': order.greyQty,
      'Production': order.production,
      'Hold': 0,
      'Reject': 0,
      'ITM QTY': 0,
      'Knit Balance': order.knitBalance,
      'Production Unit': primaryUnit,
      'Avg. Prod/Day': 0,
      'Condition': condition,
    }];

    const worksheet = XLSX.utils.json_to_sheet(finalRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Order_${order.orderNo}`);
    XLSX.writeFile(workbook, `Knitting_Status_Order_${order.orderNo}.xlsx`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
      id="knitting-order-details-modal"
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-6xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-auto animate-in fade-in duration-150">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/70 dark:bg-slate-850/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Order Details: {order.orderNo}
                </h2>
                {/* Condition Badge */}
                {condition === 'Complete' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Complete (Balance &lt; 3)
                  </span>
                )}
                {condition === 'Running' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                    </span>
                    Running (Grey Qty &gt; Balance)
                  </span>
                )}
                {condition === 'Pending' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <Clock className="w-3.5 h-3.5" />
                    Pending (Grey Qty = Balance)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  Buyer: <span className="font-bold">{order.buyerName}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  Team Leader: <span className="font-bold">{order.teamLeader}</span>
                </span>
                {primaryUnit ? (
                  <>
                    <span>•</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      Unit: <strong>{primaryUnit}</strong>
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSnippingModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors shadow-2xs cursor-pointer"
              title="Open Snipping Tool to snapshot or copy this order details"
              id="order-details-snip-header-btn"
            >
              <Scissors className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Snipping Tool</span>
            </button>
            <button
              type="button"
              onClick={handleExportOrder}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors shadow-2xs cursor-pointer"
              title="Export this order to Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close Details View"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Layer 1: Quantities Grid */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Layer 1: Order Quantities &amp; Progress</span>
              <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{percentDone}% Completed</span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full transition-all duration-500 ${
                  condition === 'Complete'
                    ? 'bg-emerald-500'
                    : condition === 'Running'
                    ? 'bg-blue-500'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${percentDone}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {/* Req Qty */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Req. Qty</span>
                <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                  {order.reqQty ? order.reqQty.toLocaleString() : '0'} <span className="text-[10px] font-normal text-slate-400">Kg</span>
                </div>
              </div>

              {/* Grey Qty */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Grey Qty</span>
                <div className="text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-0.5">
                  {order.greyQty ? order.greyQty.toLocaleString() : '0'} <span className="text-[10px] font-normal text-slate-400">Kg</span>
                </div>
              </div>

              {/* Production */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Production</span>
                <div className="text-base font-black text-emerald-800 dark:text-emerald-200 font-mono mt-0.5">
                  {order.production ? order.production.toLocaleString() : '0'} <span className="text-[10px] font-normal text-emerald-600/70">Kg</span>
                </div>
              </div>

              {/* Knit Balance */}
              <div
                className={`p-3 rounded-xl border ${
                  order.knitBalance < 3
                    ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                    : order.knitBalance > 0
                    ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-800/60 text-amber-800 dark:text-amber-200'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">Knit Balance</span>
                <div className="text-base font-black font-mono mt-0.5">
                  {order.knitBalance ? order.knitBalance.toLocaleString() : '0'} <span className="text-[10px] font-normal opacity-70">Kg</span>
                </div>
              </div>

              {/* Hold */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Hold Qty</span>
                <div className="text-base font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                  {totals.hold.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Kg</span>
                </div>
              </div>

              {/* Reject */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-500">Reject Qty</span>
                <div className="text-base font-black text-red-600 dark:text-red-400 font-mono mt-0.5">
                  {totals.reject.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Kg</span>
                </div>
              </div>

              {/* ITM QTY */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ITM QTY</span>
                <div className="text-base font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                  {totals.itmQty.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">Kg</span>
                </div>
              </div>

              {/* Avg Prod / Day */}
              <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-3 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Avg. Prod/Day</span>
                <div className="text-base font-black text-indigo-800 dark:text-indigo-200 font-mono mt-0.5">
                  {totals.avgProdPerDay ? Math.ceil(totals.avgProdPerDay).toLocaleString() : '0'} <span className="text-[10px] font-normal text-indigo-500/70">Kg</span>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule & OTD Performance Highlights */}
          <div className="bg-slate-50/80 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Knitting Schedule, PMC Milestones &amp; OTD Performance
                </span>
              </div>
              {order.otdStatus && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-2xs ${
                  order.otdStatus === 'Passed'
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                    : order.otdStatus === 'Failed'
                      ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-700'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    order.otdStatus === 'Passed' ? 'bg-emerald-600' : order.otdStatus === 'Failed' ? 'bg-rose-600' : 'bg-slate-400'
                  }`} />
                  Overall OTD: {order.otdStatus}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Knit Start Dates */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Knit Start Schedule</div>
                <div className="space-y-1 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">PMC Plan:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{order.pmcKnitStartDate || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Actual:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{order.actualKnitStartDate || order.knitStartDate || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Start OTD */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Start OTD Status</div>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                    order.knitStartOtd === 'Passed'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : order.knitStartOtd === 'Failed'
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}>
                    {order.knitStartOtd || 'Pending'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {order.actualKnitStartDate ? 'Started vs PMC Target' : 'Awaiting start'}
                </div>
              </div>

              {/* Knit End Dates */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Knit End Schedule</div>
                <div className="space-y-1 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">PMC Target:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{order.pmcKnitEndDate || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Actual/End:</span>
                    <span className="font-bold text-slate-900 dark:text-white">{order.actualKnitEndDate || order.knitEndDate || '-'}</span>
                  </div>
                </div>
              </div>

              {/* End OTD */}
              <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">End OTD Status</div>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                    order.knitEndOtd === 'Passed'
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : order.knitEndOtd === 'Failed'
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  }`}>
                    {order.knitEndOtd || 'Pending'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {order.knitBalance < 3 ? 'Completed vs PMC' : 'Target completion tracking'}
                </div>
              </div>
            </div>
          </div>

          {/* Layer 2: All Fabric Specifications Table */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Layer 2: Fabric &amp; Color Specifications ({items.length})
                </h3>
              </div>
              <span className="text-[11px] text-slate-400">
                All yarn, machine, and production breakdown metrics
              </span>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 text-xs">
                No fabric specifications registered for this order.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                      <th className="py-2.5 px-2.5 text-center w-8">#</th>
                      <th className="py-2.5 px-2.5">Color</th>
                      <th className="py-2.5 px-2.5">M/C Type</th>
                      <th className="py-2.5 px-2.5">Fab. Type</th>
                      <th className="py-2.5 px-2.5">FGSM</th>
                      <th className="py-2.5 px-2.5">F. Width</th>
                      <th className="py-2.5 px-2.5">Yarn Count</th>
                      <th className="py-2.5 px-2.5">Gauge &amp; Dia</th>
                      <th className="py-2.5 px-3 min-w-[130px]">
                        <div>Knit Start Date</div>
                        <div className="text-[9px] font-normal text-slate-400 lowercase tracking-normal">PMC / ACT</div>
                      </th>
                      <th className="py-2.5 px-3 min-w-[130px]">
                        <div>Knit End Date</div>
                        <div className="text-[9px] font-normal text-slate-400 lowercase tracking-normal">PMC / ACT</div>
                      </th>
                      <th className="py-2.5 px-2.5 text-right">Req. Qty</th>
                      <th className="py-2.5 px-2.5 text-right">Grey Qty</th>
                      <th className="py-2.5 px-2.5 text-right">Production</th>
                      <th className="py-2.5 px-2.5 text-right">Hold</th>
                      <th className="py-2.5 px-2.5 text-right">Reject</th>
                      <th className="py-2.5 px-2.5 text-right">ITM QTY</th>
                      <th className="py-2.5 px-2.5 text-right">Knit Balance</th>
                      <th className="py-2.5 px-2.5 text-right">Avg. Prod/Day</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {items.map((itm, idx) => (
                      <tr key={itm.id ? `${itm.id}-${idx}` : `itm-${idx}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-2.5 font-bold text-slate-900 dark:text-white">
                          {itm.color ? (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
                              {itm.color}
                            </span>
                          ) : ''}
                        </td>
                        <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300">{itm.mcType || ''}</td>
                        <td className="py-2 px-2.5 text-slate-700 dark:text-slate-300">{itm.fabType || ''}</td>
                        <td className="py-2 px-2.5 font-mono text-slate-600 dark:text-slate-400">{itm.fgsm || ''}</td>
                        <td className="py-2 px-2.5 font-mono text-slate-600 dark:text-slate-400">{itm.fWidth || ''}</td>
                        <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400">{itm.yarnCount || ''}</td>
                        <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400">{itm.gaugeDia || ''}</td>
                        {/* Knit Start Date: strictly empty if no production and no hold */}
                        <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 font-mono">
                          {(Number(itm.production || 0) > 0 || Number(itm.hold || 0) > 0) ? (itm.knitStartDate || '') : ''}
                        </td>
                        {/* Knit End Date: strictly empty if no production and no hold */}
                        <td className="py-2 px-2.5 text-slate-600 dark:text-slate-400 font-mono">
                          {(Number(itm.production || 0) > 0 || Number(itm.hold || 0) > 0) ? (itm.knitEndDate || '') : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {itm.reqQty ? itm.reqQty.toLocaleString() : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-semibold text-slate-900 dark:text-white">
                          {itm.greyQty ? itm.greyQty.toLocaleString() : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {itm.production ? itm.production.toLocaleString() : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-amber-500">
                          {itm.hold ? itm.hold.toLocaleString() : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-red-500">
                          {itm.reject ? itm.reject.toLocaleString() : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 dark:text-slate-400">
                          {itm.itmQty ? itm.itmQty.toLocaleString() : ''}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold">
                          <span
                            className={
                              itm.knitBalance < 3
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {itm.knitBalance !== undefined ? itm.knitBalance.toLocaleString() : ''}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {itm.avgProdPerDay ? `${Math.ceil(Number(itm.avgProdPerDay)).toLocaleString()} Kg` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Totals Summary Row */}
                  <tfoot>
                    <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-600">
                      <td colSpan={10} className="py-2.5 px-3 text-right uppercase tracking-wider text-[10px]">
                        Specifications Total:
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono">{totals.reqQty.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono">{totals.greyQty.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{totals.production.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-amber-500">{totals.hold.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-red-500">{totals.reject.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono">{totals.itmQty.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-indigo-600 dark:text-indigo-400">{totals.knitBalance.toLocaleString()}</td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-indigo-700 dark:text-indigo-300 font-bold">
                        {totals.avgProdPerDay ? `${Math.ceil(totals.avgProdPerDay).toLocaleString()} Kg` : ''}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850/50 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            Order <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{order.orderNo}</span> • {items.length} fabric specifications
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSnippingModal(true)}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
              id="order-details-snip-footer-btn"
            >
              <Scissors className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Snipping Tool</span>
            </button>
            <button
              type="button"
              onClick={handleExportOrder}
              className="px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export Order</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {showSnippingModal && (
        <KnittingOrderSnippingModal
          order={order}
          isOpen={showSnippingModal}
          onClose={() => setShowSnippingModal(false)}
          includeAllocation={false}
        />
      )}
    </div>
  );
}
