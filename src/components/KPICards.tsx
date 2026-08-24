/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { KPIMetric } from '../types';
import TotalTargetGaugeCard from './TotalTargetGaugeCard';
import TotalProductionGaugeCard from './TotalProductionGaugeCard';
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

          const getMonthNameFromDateStr = (dateStr: string): string => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
              const idx = parseInt(parts[1], 10) - 1;
              if (idx >= 0 && idx < 12) return monthNames[idx];
            }
            return '';
          };

          const now = new Date();
          const currentRunningMonth = monthNames[now.getMonth()] || 'August';

          const overallTotal = ledger.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0) || 6680851;
          const overallBulk = ledger.reduce((sum, r) => {
            const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0) || 6703652;

          const currentMonthRecords = ledger.filter((r) => {
            const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
            return recMonth.toLowerCase() === currentRunningMonth.toLowerCase();
          });

          const targetRecords = currentMonthRecords.length > 0 ? currentMonthRecords : ledger;

          const monthTotal = targetRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);

          const inHouseRecords = targetRecords.filter((r) => r.floor !== 'Sub-Contact' && r.unit !== 'Sub-Contact' && !(r.remarks && r.remarks.toLowerCase().includes('sub-contact')));
          const subContactRecords = targetRecords.filter((r) => r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact' || (r.remarks && r.remarks.toLowerCase().includes('sub-contact')));

          const inHouseTarget = inHouseRecords.reduce((sum, r) => {
            const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0);

          const subContactTarget = subContactRecords.reduce((sum, r) => {
            const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0);

          const monthBulk = inHouseTarget + subContactTarget;
          const inHousePct = monthBulk > 0 ? Math.round((inHouseTarget / monthBulk) * 100) : 59;
          const subContactPct = 100 - inHousePct;

          const targetSampleTotal = targetRecords.reduce((sum, r) => {
            const s = (r as any).sampleTarget !== undefined && (r as any).sampleTarget !== null 
              ? Number((r as any).sampleTarget) 
              : (r.target !== undefined && r.targetBulk !== undefined ? Math.max(0, Number(r.target) - Number(r.targetBulk)) : 0);
            return sum + (Number.isNaN(s) ? 0 : s);
          }, 0);

          const targetLossForSample = targetRecords.reduce((sum, r) => {
            const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null ? Number(r.prodLossForSample) : 0;
            return sum + (Number.isNaN(l) ? 0 : l);
          }, 0);

          return (
            <TotalTargetGaugeCard
              key={kpi.id}
              totalTarget={overallTotal}
              totalBulk={overallBulk}
              monthName={currentRunningMonth}
              monthTotal={monthTotal > 0 ? monthTotal : 1381192}
              monthBulk={monthBulk > 0 ? monthBulk : 1334760}
              inHouseTarget={inHouseTarget > 0 ? inHouseTarget : 784760}
              subContactTarget={subContactTarget > 0 ? subContactTarget : 550000}
              inHousePct={inHousePct}
              subContactPct={subContactPct}
              lastMonthBulkTarget={1871880}
              growthPct={-29}
              className="col-span-1"
            />
          );
        }

        // Special rendering for Total Production KPI card matching the Gauge speedometer design
        if (kpi.id === 'production') {
          const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June', 
            'July', 'August', 'September', 'October', 'November', 'December'
          ];

          const getMonthNameFromDateStr = (dateStr: string): string => {
            if (!dateStr) return '';
            const parts = dateStr.split('-');
            if (parts.length >= 2) {
              const idx = parseInt(parts[1], 10) - 1;
              if (idx >= 0 && idx < 12) return monthNames[idx];
            }
            return '';
          };

          const now = new Date();
          const currentRunningMonth = monthNames[now.getMonth()] || 'August';

          const overallProd = ledger.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0) || 5743816;
          const overallBulkProd = ledger.reduce((sum, r) => {
            const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0) || 5712400;

          const currentMonthRecords = ledger.filter((r) => {
            const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
            return recMonth.toLowerCase() === currentRunningMonth.toLowerCase();
          });

          const prodRecords = currentMonthRecords.length > 0 ? currentMonthRecords : ledger;
          const monthProdTotal = prodRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);

          const inHouseRecords = prodRecords.filter((r) => r.floor !== 'Sub-Contact' && r.unit !== 'Sub-Contact' && !(r.remarks && r.remarks.toLowerCase().includes('sub-contact')));
          const subContactRecords = prodRecords.filter((r) => r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact' || (r.remarks && r.remarks.toLowerCase().includes('sub-contact')));

          const inHouseBulkProd = inHouseRecords.reduce((sum, r) => {
            const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0);
          const subContactBulkProd = subContactRecords.reduce((sum, r) => {
            const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
            return sum + (Number.isNaN(b) ? 0 : b);
          }, 0);

          const monthProdBulk = inHouseBulkProd + subContactBulkProd;

          const totalSampleProd = prodRecords.reduce((sum, r) => {
            const s = r.sampleProd !== undefined && r.sampleProd !== null 
              ? Number(r.sampleProd) 
              : (r.totalProduction !== undefined && r.bulkProd !== undefined ? Math.max(0, Number(r.totalProduction) - Number(r.bulkProd)) : 0);
            return sum + (Number.isNaN(s) ? 0 : s);
          }, 0);

          const totalLossForSample = prodRecords.reduce((sum, r) => {
            const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null ? Number(r.prodLossForSample) : 0;
            return sum + (Number.isNaN(l) ? 0 : l);
          }, 0);

          const inHouseBulkPct = monthProdBulk > 0 ? Math.round((inHouseBulkProd / monthProdBulk) * 100) : 58;
          const subContactBulkPct = 100 - inHouseBulkPct;

          const targetMonthTotal = prodRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);
          const achievementPct = targetMonthTotal > 0 ? parseFloat(((monthProdTotal / targetMonthTotal) * 100).toFixed(1)) : 80;

          return (
            <TotalProductionGaugeCard
              key={kpi.id}
              totalProduction={overallProd}
              totalBulkProduction={overallBulkProd}
              monthName={currentRunningMonth}
              monthTotalProduction={monthProdTotal > 0 ? monthProdTotal : 1141008}
              monthBulkProduction={monthProdBulk > 0 ? monthProdBulk : 1119058}
              inHouseBulkProduction={inHouseBulkProd > 0 ? inHouseBulkProd : 657334}
              subContactBulkProduction={subContactBulkProd > 0 ? subContactBulkProd : 483674}
              inHousePct={inHouseBulkPct}
              subContactPct={subContactBulkPct}
              sampleProduction={totalSampleProd > 0 ? totalSampleProd : 21950}
              prodLossForSample={totalLossForSample > 0 ? totalLossForSample : 32925}
              lastMonthProduction={1448084}
              growthPct={-21}
              achievementPct={achievementPct}
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
