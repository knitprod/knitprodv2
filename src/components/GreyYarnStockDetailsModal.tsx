import React from 'react';
import {
  X,
  Building2,
  Calendar,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Scissors,
  Boxes,
  Truck
} from 'lucide-react';
import { GreyYarnStockOrderGroup } from '../lib/greyYarnStockStore';

interface GreyYarnStockDetailsModalProps {
  orderGroup: GreyYarnStockOrderGroup | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSnip?: (group: GreyYarnStockOrderGroup) => void;
}

export const GreyYarnStockDetailsModal: React.FC<GreyYarnStockDetailsModalProps> = ({
  orderGroup,
  isOpen,
  onClose,
  onOpenSnip
}) => {
  if (!isOpen || !orderGroup) return null;

  const isComplete = orderGroup.status?.toLowerCase().includes('complete') || orderGroup.status?.toLowerCase().includes('close');
  const isRunning = orderGroup.status?.toLowerCase().includes('run');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-scale-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/60">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-xs">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                  Grey Yarn Stock
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isComplete 
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' 
                    : isRunning
                    ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {orderGroup.status}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mt-0.5">
                Order #{orderGroup.orderNo}
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                  • {orderGroup.buyerName}
                </span>
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSnip && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSnip(orderGroup);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-all shadow-xs cursor-pointer"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Snip Tool</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Buyer</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">{orderGroup.buyerName}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Completion Date</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{orderGroup.completionDate || '—'}</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Yarn Specifications</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{orderGroup.items.length} lots</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Order Status</span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">{orderGroup.status}</p>
            </div>
          </div>

          {/* 1st Layer Summary KPI Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400 block truncate">Booking QTY</span>
              <span className="text-sm font-black font-mono text-slate-700 dark:text-slate-200">
                {Math.round(orderGroup.totalBookingQty).toLocaleString()} <span className="text-[10px] font-normal text-slate-400">kg</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
              <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block truncate">Yarn Required</span>
              <span className="text-sm font-black font-mono text-indigo-900 dark:text-indigo-200">
                {Math.round(orderGroup.totalYarnRequired).toLocaleString()} <span className="text-[10px] font-normal text-indigo-400">kg</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block truncate">Net Received</span>
              <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">
                {Math.round(orderGroup.totalNetReceived).toLocaleString()} <span className="text-[10px] font-normal text-emerald-500">kg</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
              <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block truncate">Net Issued</span>
              <span className="text-sm font-black font-mono text-blue-700 dark:text-blue-300">
                {Math.round(orderGroup.totalNetIssued).toLocaleString()} <span className="text-[10px] font-normal text-blue-500">kg</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50">
              <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 block truncate">Excess Issued</span>
              <span className="text-sm font-black font-mono text-rose-700 dark:text-rose-300">
                {Math.round(orderGroup.totalExcessIssued).toLocaleString()} <span className="text-[10px] font-normal text-rose-500">kg</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
              <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400 block truncate">Stock QTY</span>
              <span className="text-sm font-black font-mono text-amber-800 dark:text-amber-300">
                {Math.round(orderGroup.totalStockQty).toLocaleString()} <span className="text-[10px] font-normal text-amber-500">kg</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50">
              <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block truncate">Issue Balance</span>
              <span className="text-sm font-black font-mono text-purple-800 dark:text-purple-300">
                {Math.round(orderGroup.totalIssuedBalance).toLocaleString()} <span className="text-[10px] font-normal text-purple-500">kg</span>
              </span>
            </div>
          </div>

          {/* 2nd Layer: Physical Yarn Count & Lot Breakdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>2nd Layer: Physical Yarn Count, Lot &amp; Spinner Breakdown</span>
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                {orderGroup.items.length} specifications recorded
              </span>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 uppercase tracking-wider text-[11px]">
                    <th className="py-2.5 px-3 min-w-[150px]">Physical Yarn Count</th>
                    <th className="py-2.5 px-3 min-w-[110px] font-mono">Physical Yarn Lot</th>
                    <th className="py-2.5 px-3 min-w-[140px]">Spinner</th>
                    <th className="py-2.5 px-3 text-right">Booking QTY</th>
                    <th className="py-2.5 px-3 text-right">Yarn Required</th>
                    <th className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">Total Received</th>
                    <th className="py-2.5 px-3 text-right text-blue-600 dark:text-blue-400">Total Issued</th>
                    <th className="py-2.5 px-3 text-right text-rose-600 dark:text-rose-400">Excess Issued</th>
                    <th className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400 font-extrabold bg-amber-50/50 dark:bg-amber-950/20">Total Stock QTY</th>
                    <th className="py-2.5 px-3 text-right text-purple-600 dark:text-purple-400">Issued Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {orderGroup.items.map((itm, idx) => (
                    <tr key={itm.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {itm.physicalYarnCount}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300">
                        {itm.physicalYarnLot || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {itm.spinner || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                        {Math.round(itm.bookingQty || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-200">
                        {Math.round(itm.yarnRequired || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {Math.round(itm.totalReceived || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {Math.round(itm.totalIssued || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                        {Math.round(itm.excessIssued || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-amber-700 dark:text-amber-300 bg-amber-50/30 dark:bg-amber-950/10">
                        {Math.round(itm.totalStockQty || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-purple-700 dark:text-purple-300">
                        {Math.round(itm.issuedBalance || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-700 font-black text-xs text-slate-900 dark:text-white">
                    <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider">
                      Sum Total (1st Layer Rollup):
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {Math.round(orderGroup.totalBookingQty).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">
                      {Math.round(orderGroup.totalYarnRequired).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                      {Math.round(orderGroup.totalNetReceived).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400">
                      {Math.round(orderGroup.totalNetIssued).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                      {Math.round(orderGroup.totalExcessIssued).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-700 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-950/40">
                      {Math.round(orderGroup.totalStockQty).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-purple-700 dark:text-purple-300">
                      {Math.round(orderGroup.totalIssuedBalance).toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 text-xs">
          <span className="text-slate-400 font-medium">
            Epyllion Knitex Ltd. • Grey Yarn Stock Summary Tracking System
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-bold rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
