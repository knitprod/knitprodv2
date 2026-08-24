/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { KPIMetric } from '../types';
import TotalTargetGaugeCard from './TotalTargetGaugeCard';
import { useGlobalData } from '../context/GlobalDataContext';

interface KPICardsProps {
  kpis: KPIMetric[];
}

export default function KPICards({ kpis }: KPICardsProps) {
  const globalData = useGlobalData();
  const ledger = globalData?.ledger || [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((kpi) => {
        // Special rendering for Target KPI card matching the Gauge speedometer design
        if (kpi.id === 'target') {
          // Calculate running month data and total summary values
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June', 
            'July', 'August', 'September', 'October', 'November', 'December'
          ];
          const now = new Date();
          const currentRunningMonth = monthNames[now.getMonth()] || 'August';

          const overallTotal = ledger.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0) || 6680851;
          const overallBulk = ledger.reduce((sum, r) => {
            const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0) || 6703652;

          const currentMonthRecords = ledger.filter((r) => 
            (r.month && r.month.toLowerCase() === currentRunningMonth.toLowerCase()) ||
            (r.date && monthNames[new Date(r.date).getMonth()]?.toLowerCase() === currentRunningMonth.toLowerCase())
          );

          const monthTotal = currentMonthRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);
          const monthBulk = currentMonthRecords.reduce((sum, r) => {
            const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0);

          const inHouseTarget = currentMonthRecords
            .filter((r) => r.floor !== 'Sub-Contact' && r.unit !== 'Sub-Contact')
            .reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);

          const subContactTarget = currentMonthRecords
            .filter((r) => r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact')
            .reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);

          const splitTotal = inHouseTarget + subContactTarget;
          const inHousePct = splitTotal > 0 ? Math.round((inHouseTarget / splitTotal) * 100) : 66;
          const subContactPct = 100 - inHousePct;

          return (
            <TotalTargetGaugeCard
              key={kpi.id}
              totalTarget={overallTotal}
              totalBulk={overallBulk}
              monthName={currentRunningMonth}
              monthTotal={monthTotal > 0 ? monthTotal : 157528}
              monthBulk={monthBulk > 0 ? monthBulk : 158082}
              inHouseTarget={inHouseTarget > 0 ? inHouseTarget : 104196}
              subContactTarget={subContactTarget > 0 ? subContactTarget : 53332}
              inHousePct={inHousePct}
              subContactPct={subContactPct}
              lastMonthBulkTarget={149134}
              growthPct={6}
              className="col-span-1"
            />
          );
        }

        // Resolve Lucide Icon dynamically
        const iconName = kpi.iconName as keyof typeof LucideIcons;
        const IconComponent = LucideIcons[iconName] 
          ? (LucideIcons[iconName] as React.ComponentType<{ className?: string }>)
          : LucideIcons.HelpCircle;

        // Map colors to classes
        const colorStyles = {
          blue: {
            bg: 'bg-blue-50/70',
            text: 'text-blue-700',
            border: 'border-blue-100',
            lightText: 'text-blue-500',
            indicatorBg: 'bg-blue-500/10 text-blue-700',
            ringColor: 'ring-blue-100/50',
          },
          green: {
            bg: 'bg-emerald-50/70',
            text: 'text-emerald-700',
            border: 'border-emerald-100',
            lightText: 'text-emerald-500',
            indicatorBg: 'bg-emerald-500/10 text-emerald-700',
            ringColor: 'ring-emerald-100/50',
          },
          orange: {
            bg: 'bg-amber-50/70',
            text: 'text-amber-700',
            border: 'border-amber-100',
            lightText: 'text-amber-500',
            indicatorBg: 'bg-amber-500/10 text-amber-700',
            ringColor: 'ring-amber-100/50',
          },
          red: {
            bg: 'bg-red-50/70',
            text: 'text-red-700',
            border: 'border-red-100',
            lightText: 'text-red-500',
            indicatorBg: 'bg-red-500/10 text-red-700',
            ringColor: 'ring-red-100/50',
          },
        }[kpi.color];

        return (
          <div 
            key={kpi.id}
            className={`group relative overflow-hidden rounded-xl border bg-white dark:bg-slate-900 p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 ${colorStyles.border}`}
            id={`kpi-card-${kpi.id}`}
          >
            {/* Soft background shape */}
            <div className={`absolute -right-3 -top-3 h-16 w-16 rounded-full transition-transform duration-300 group-hover:scale-110 ${colorStyles.bg} opacity-50`} />

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                {kpi.label}
              </span>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ring-4 ${colorStyles.ringColor} ${colorStyles.bg} ${colorStyles.text}`}>
                <IconComponent className="h-4.5 w-4.5" />
              </div>
            </div>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
                {kpi.value}
              </span>
              {kpi.unit && (
                <span className="font-sans text-xs font-bold text-gray-400 dark:text-slate-500 uppercase">
                  {kpi.unit}
                </span>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 border-t border-gray-100 dark:border-slate-800 pt-3">
              <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-400">
                {kpi.description}
              </span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                kpi.isPositive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
              }`}>
                {kpi.change}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
