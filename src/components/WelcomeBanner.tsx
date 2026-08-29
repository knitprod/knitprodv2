/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import { 
  Sparkles, 
  Activity, 
  RefreshCw, 
  ArrowRight, 
  Target, 
  Factory, 
  Percent, 
  Gauge,
  TrendingUp,
  TrendingDown,
  Layers,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Filter,
  Calendar,
  Building2,
  Database,
  RotateCcw
} from 'lucide-react';
import { FactoryFloor, LedgerRecord } from '../types';
import { useGlobalData } from '../context/GlobalDataContext';
import { getTotalMachinesForUnit, getUnitConfigs, getProductionCapacityForUnit, getEffectiveDailyCapacity } from '../lib/unitStore';
import { 
  calculateLedgerEfficiency, 
  calculateLedgerCapacityUtilization, 
  calculateEffectiveDays, 
  calculateLedgerPeriodCapacity,
  isSubContactRecord 
} from '../lib/productionMetrics';
import { FilterState } from './DashboardFilterToolbar';

interface WelcomeBannerProps {
  floors?: FactoryFloor[];
  filterState?: FilterState;
  onFilterChange?: (filters: FilterState) => void;
  onNavigate: (page: string) => void;
}

/**
 * The 7 Production Floors across Knitting Plant
 */
const STANDARD_7_FLOORS: { id: string; name: string; label: string }[] = [
  { id: 'EKL', name: 'EKL', label: 'EKL' },
  { id: 'EFL', name: 'EFL', label: 'EFL' },
  { id: 'EFL-2', name: 'EFL-2', label: 'EFL-2' },
  { id: 'Auto Stripe', name: 'Auto Stripe', label: 'Auto Stripe' },
  { id: 'EFL-Extension', name: 'EFL-Extension', label: 'EFL-Ext' },
  { id: 'ESL-Extension', name: 'ESL-Extension', label: 'ESL-Ext' },
  { id: 'Sub-Contact', name: 'Sub-Contact', label: 'Sub-Contact' },
];

function isRecordMatchingFloor(record: LedgerRecord, floorId: string): boolean {
  const f = (record.floor || '').trim().toLowerCase();
  const u = (record.unit || '').trim().toLowerCase();
  const r = (record.remarks || '').trim().toLowerCase();
  const target = floorId.toLowerCase();

  if (target === 'sub-contact') {
    return f === 'sub-contact' || u === 'sub-contact' || r.includes('sub-contact');
  }
  if (target === 'auto stripe') {
    return f.includes('auto') || f.includes('stripe');
  }
  if (target === 'efl-extension') {
    return (f.includes('efl') && (f.includes('ext') || f.includes('extension')));
  }
  if (target === 'esl-extension') {
    return (f.includes('esl') && (f.includes('ext') || f.includes('extension')));
  }
  if (target === 'efl-2') {
    return f === 'efl-2' || f === 'efl 2' || f === 'efl2';
  }
  if (target === 'efl') {
    return (f === 'efl' || f === 'efl-1' || f === 'efl 1') && !f.includes('ext') && !f.includes('2');
  }
  if (target === 'ekl') {
    return f === 'ekl';
  }
  return f === target;
}

/**
 * Modern Compact Semicircular Speedometer / Industrial Gauge
 * Industrial dashboard gauge with needle and gradient arc
 */
function SpeedometerGauge({ 
  value, 
  target = 85, 
  gaugeId = 'speedometer',
  startColor = '#3B82F6',
  midColor = '#06B6D4',
  endColor = '#10B981'
}: { 
  value: number; 
  target?: number; 
  gaugeId?: string;
  startColor?: string;
  midColor?: string;
  endColor?: string;
}) {
  const percentage = Math.min(100, Math.max(0, value));
  
  const cx = 58;
  const cy = 48;
  const r = 35;
  const strokeWidth = 5.5;
  const needleLen = 27;

  // Circumference of semicircle: PI * R
  const arcLength = Math.PI * r;
  const filledLength = (percentage / 100) * arcLength;
  const offset = arcLength - filledLength;

  // Angle math: at 0%, needle points left; at 50%, straight up; at 100%, needle points right
  const theta = (percentage / 100) * Math.PI;
  const needleX = cx - Math.cos(theta) * needleLen;
  const needleY = cy - Math.sin(theta) * needleLen;

  const gradId = `grad_${gaugeId}`;
  const glowId = `glow_${gaugeId}`;

  return (
    <div className="relative w-full max-w-[105px] sm:max-w-[115px] flex items-center justify-center shrink-0">
      <svg viewBox="0 0 116 58" className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={startColor} />
            <stop offset="50%" stopColor={midColor} />
            <stop offset="85%" stopColor={endColor} />
            <stop offset="100%" stopColor={endColor} />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Dark Track */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="#1E293B"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Active Gradient Arc */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={arcLength}
          strokeDashoffset={offset}
          strokeLinecap="round"
          filter={`url(#${glowId})`}
          className="transition-all duration-700 ease-out"
        />

        {/* Marker: 0% */}
        <text x={cx - r - 8} y={cy + 3} fill="#64748B" fontSize="6" fontWeight="700" textAnchor="middle">0%</text>

        {/* Marker: 50% */}
        <text x={cx} y={cy - r - 3.5} fill="#64748B" fontSize="6" fontWeight="700" textAnchor="middle">50%</text>

        {/* Marker: 85% Target Zone */}
        <text x={cx + r * 0.72} y={cy - r * 0.65} fill="#10B981" fontSize="5.5" fontWeight="800" textAnchor="middle">85%</text>

        {/* Marker: 100% */}
        <text x={cx + r + 8} y={cy + 3} fill="#64748B" fontSize="6" fontWeight="700" textAnchor="middle">100%</text>

        {/* Needle Indicator */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="#38BDF8"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
          filter="drop-shadow(0 0 3px rgba(56, 189, 248, 0.9))"
        />

        {/* Center Pivot Hub */}
        <circle cx={cx} cy={cy} r="4" fill="#0B132B" stroke="#38BDF8" strokeWidth="1.8" />
        <circle cx={cx} cy={cy} r="1.2" fill="#38BDF8" />
      </svg>
    </div>
  );
}

/**
 * Compact Circular Progress Ring for Achievement Card
 */
function CircularProgressRing({ percentage }: { percentage: number }) {
  const p = Math.min(100, Math.max(0, percentage));
  const r = 16;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (p / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg className="w-10 h-10 -rotate-90 transform" viewBox="0 0 40 40">
        {/* Background Track */}
        <circle
          cx="20"
          cy="20"
          r={r}
          className="stroke-slate-800"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress Arc */}
        <circle
          cx="20"
          cy="20"
          r={r}
          className="stroke-emerald-400 transition-all duration-700 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <div className="absolute text-[9.5px] font-mono font-black text-white">
        {Math.round(p)}%
      </div>
    </div>
  );
}

export default function WelcomeBanner({ 
  floors, 
  filterState, 
  onFilterChange, 
  onNavigate 
}: WelcomeBannerProps) {
  const globalData = useGlobalData();
  const ledger = globalData?.ledger || [];

  // Live time ticker for Last Updated
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('15:10');

  useEffect(() => {
    const updateTime = () => {
      const d = globalData?.lastSyncedAt || new Date();
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, [globalData?.lastSyncedAt]);

  // -----------------------------------------------------------------
  // 1-DAY REPORTING LAG DATE CALCULATION
  // E.g.: Current date: 27 AUG 2026 -> Production Date: 26 AUG 2026
  // -----------------------------------------------------------------
  const productionDateMeta = useMemo(() => {
    const now = new Date();
    const lagDate = new Date(now);
    lagDate.setDate(lagDate.getDate() - 1);

    const day = String(lagDate.getDate()).padStart(2, '0');
    const monthsUpper = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const monthUpper = monthsUpper[lagDate.getMonth()];
    const year = lagDate.getFullYear();

    const formatted = `${day} ${monthUpper} ${year}`; // e.g. "26 AUG 2026"
    const isoDate = `${year}-${String(lagDate.getMonth() + 1).padStart(2, '0')}-${day}`;

    return {
      formatted,
      isoDate,
      day,
      monthUpper,
      year
    };
  }, []);

  // Evaluation date for 7 Floors update status
  const activeDateForStatus = useMemo(() => {
    if (filterState?.singleDate) return filterState.singleDate;
    return productionDateMeta.isoDate;
  }, [filterState?.singleDate, productionDateMeta.isoDate]);

  // 7 Floors pending vs updated status
  const floorUpdateStatus = useMemo(() => {
    const recordsForDate = ledger.filter(r => r.date === activeDateForStatus);

    const updatedFloors: { id: string; name: string; label: string }[] = [];
    const pendingFloors: { id: string; name: string; label: string }[] = [];

    STANDARD_7_FLOORS.forEach(sf => {
      const hasUpdate = recordsForDate.some(r => isRecordMatchingFloor(r, sf.id));
      if (hasUpdate) {
        updatedFloors.push(sf);
      } else {
        pendingFloors.push(sf);
      }
    });

    return {
      activeDate: activeDateForStatus,
      totalFloors: STANDARD_7_FLOORS.length, // 7
      updatedCount: updatedFloors.length,
      pendingCount: pendingFloors.length,
      updatedFloors,
      pendingFloors,
      isAllUpdated: updatedFloors.length === STANDARD_7_FLOORS.length,
      isNoneUpdated: updatedFloors.length === 0, // all 7 floors pending
    };
  }, [ledger, activeDateForStatus]);

  // Helper to check if a row is Sub-Contact
  const isSubContactRow = (r: any) => 
    r.floor === 'Sub-Contact' || 
    r.unit === 'Sub-Contact' || 
    (r.remarks && r.remarks.toLowerCase().includes('sub-contact'));

  // -----------------------------------------------------------------
  // DYNAMIC FILTERING LINKED LIVE WITH PRODUCTION LEDGER
  // -----------------------------------------------------------------
  const { filteredRows, filterContextLabel, isFiltered } = useMemo(() => {
    if (!ledger || ledger.length === 0) {
      return { 
        filteredRows: [], 
        filterContextLabel: `Default: ${productionDateMeta.formatted}`,
        isFiltered: false 
      };
    }

    let rows = [...ledger];
    let dateLabel = productionDateMeta.formatted;
    let unitLabel = 'All Units';
    let filtered = false;

    // 1. Date Filtering
    if (filterState && (filterState.dateFrom || filterState.dateTo || (filterState.year && filterState.year !== 'all') || filterState.singleDate)) {
      if (filterState.dateFrom && filterState.dateTo) {
        if (filterState.dateFrom === filterState.dateTo) {
          rows = rows.filter(r => r.date === filterState.dateFrom);
          dateLabel = filterState.dateFrom;
        } else {
          rows = rows.filter(r => r.date >= filterState.dateFrom && r.date <= filterState.dateTo);
          dateLabel = `${filterState.dateFrom} ~ ${filterState.dateTo}`;
        }
        filtered = true;
      } else if (filterState.dateFrom) {
        rows = rows.filter(r => r.date >= filterState.dateFrom);
        dateLabel = `From ${filterState.dateFrom}`;
        filtered = true;
      } else if (filterState.dateTo) {
        rows = rows.filter(r => r.date <= filterState.dateTo);
        dateLabel = `Up to ${filterState.dateTo}`;
        filtered = true;
      } else if (filterState.dateMode === 'single' && filterState.singleDate) {
        rows = rows.filter(r => r.date === filterState.singleDate);
        dateLabel = filterState.singleDate;
        if (filterState.singleDate !== productionDateMeta.isoDate) filtered = true;
      } else if (filterState.year && filterState.year !== 'all') {
        rows = rows.filter(r => r.date && r.date.startsWith(filterState.year));
        dateLabel = `Year: ${filterState.year}`;
        filtered = true;
      } else if (filterState.dateMode === 'month' && filterState.month) {
        rows = rows.filter(r => r.date && r.date.startsWith(filterState.month));
        dateLabel = `Month: ${filterState.month}`;
        filtered = true;
      }
    } else {
      // Default: match the 1-day reporting lag date if present, or latest available date
      const lagRows = rows.filter(r => r.date === productionDateMeta.isoDate);
      if (lagRows.length > 0) {
        rows = lagRows;
        dateLabel = productionDateMeta.formatted;
      } else {
        const dates = Array.from(new Set(rows.map(r => r.date).filter(Boolean))).sort().reverse();
        const latestDate = dates[0];
        if (latestDate) {
          rows = rows.filter(r => r.date === latestDate);
          dateLabel = latestDate;
        }
      }
    }

    // 2. Unit Filtering
    const activeUnit = filterState?.unit || 'all';
    if (activeUnit !== 'all') {
      filtered = true;
      if (activeUnit === 'In-House' || activeUnit === 'in-house') {
        rows = rows.filter(r => !isSubContactRow(r));
        unitLabel = 'In-House Units';
      } else if (activeUnit === 'Sub-Contact' || activeUnit === 'sub-contact') {
        rows = rows.filter(r => isSubContactRow(r));
        unitLabel = 'Sub-Contact';
      } else {
        rows = rows.filter(r => 
          (r.floor && r.floor.trim().toLowerCase() === activeUnit.trim().toLowerCase()) ||
          (r.unit && r.unit.trim().toLowerCase() === activeUnit.trim().toLowerCase())
        );
        unitLabel = activeUnit;
      }
    }

    return {
      filteredRows: rows,
      filterContextLabel: `${unitLabel} • ${dateLabel}`,
      isFiltered: filtered
    };
  }, [ledger, filterState, productionDateMeta.isoDate, productionDateMeta.formatted]);

  // -----------------------------------------------------------------
  // CALCULATE ALL 7 KPIS ACCURATELY FROM THE FILTERED LEDGER RECORDS
  // -----------------------------------------------------------------
  const metrics = useMemo(() => {
    let inHouseTarget = 0;
    let inHouseBulkTarget = 0;
    let subContactTarget = 0;
    let subContactBulkTarget = 0;
    let inHouseProd = 0;
    let inHouseTotalProd = 0;
    let subContactProd = 0;
    let subContactTotalProd = 0;
    let inHouseTotalMachines = 0;
    let inHouseRunningMachines = 0;
    let inHouseBulkRunning = 0;
    let inHouseSampleRunning = 0;
    let qualityReject = 0;
    let qualityHold = 0;
    let qualityJhute = 0;
    let efficiency = 0;
    let capacity = 0;
    let totalDailyCapacity = 0;
    let periodTotalCapacity = 0;
    let sampleProduction = 0;
    let inHouseSampleProd = 0;
    let subContactSampleProd = 0;

    const appliedUnit = filterState?.unit || 'all';

    if (filteredRows.length > 0) {
      const ihRows = filteredRows.filter(r => !isSubContactRecord(r));
      const scRows = filteredRows.filter(r => isSubContactRecord(r));

      // 1. Targets (strictly from the Production Ledger records)
      inHouseTarget = ihRows.reduce((sum, r) => {
        const t = r.target !== undefined && r.target !== null && Number(r.target) > 0 
          ? Number(r.target) 
          : (r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : 0);
        return sum + (Number.isNaN(t) ? 0 : t);
      }, 0);

      inHouseBulkTarget = ihRows.reduce((sum, r) => {
        const b = r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0 
          ? Number(r.targetBulk) 
          : (Number(r.target) || 0);
        return sum + (Number.isNaN(b) ? 0 : b);
      }, 0);

      subContactTarget = scRows.reduce((sum, r) => {
        const b = r.target !== undefined && r.target !== null && Number(r.target) > 0
          ? Number(r.target)
          : (r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : 0);
        return sum + (Number.isNaN(b) ? 0 : b);
      }, 0);

      subContactBulkTarget = scRows.reduce((sum, r) => {
        const b = r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0
          ? Number(r.targetBulk)
          : (Number(r.target) || 0);
        return sum + (Number.isNaN(b) ? 0 : b);
      }, 0);

      // 2. Productions (matching Production Ledger)
      inHouseProd = ihRows.reduce((sum, r) => {
        const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
        return sum + (Number.isNaN(b) ? 0 : b);
      }, 0);

      inHouseTotalProd = ihRows.reduce((sum, r) => {
        const t = r.totalProduction !== undefined && r.totalProduction !== null && Number(r.totalProduction) > 0 
          ? Number(r.totalProduction) 
          : (Number(r.bulkProd || 0) + Number(r.sampleProd || 0));
        return sum + (Number.isNaN(t) ? 0 : t);
      }, 0) || inHouseProd;

      subContactProd = scRows.reduce((sum, r) => {
        const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
        return sum + (Number.isNaN(b) ? 0 : b);
      }, 0);

      subContactTotalProd = scRows.reduce((sum, r) => {
        const t = r.totalProduction !== undefined && r.totalProduction !== null && Number(r.totalProduction) > 0
          ? Number(r.totalProduction)
          : (Number(r.bulkProd || 0) + Number(r.sampleProd || 0));
        return sum + (Number.isNaN(t) ? 0 : t);
      }, 0) || subContactProd;

      // 3. Efficiency & Capacity (Strictly identical to Production Ledger formulas)
      const effectiveDays = calculateEffectiveDays(filteredRows, filterState);
      efficiency = calculateLedgerEfficiency(ihRows, scRows, appliedUnit);
      capacity = calculateLedgerCapacityUtilization(ihRows, appliedUnit, effectiveDays);

      // Sample production
      inHouseSampleProd = ihRows.reduce((sum, r) => sum + (Number(r.sampleProd) || 0), 0);
      subContactSampleProd = scRows.reduce((sum, r) => sum + (Number(r.sampleProd) || 0), 0);
      sampleProduction = inHouseSampleProd + subContactSampleProd;

      // Daily capacity calculation from Setting Panel (defaults to 50K/day for In-House)
      totalDailyCapacity = getEffectiveDailyCapacity(appliedUnit);
      periodTotalCapacity = calculateLedgerPeriodCapacity(appliedUnit, effectiveDays);

      // 4. In-House Total Machines from settings store
      if (appliedUnit !== 'all' && !appliedUnit.toLowerCase().includes('in-house')) {
        inHouseTotalMachines = getTotalMachinesForUnit(appliedUnit, 66);
      } else {
        const distinctFloors = Array.from(new Set(ihRows.map(r => r.floor).filter(Boolean))) as string[];
        if (distinctFloors.length > 0) {
          inHouseTotalMachines = distinctFloors.reduce((sum: number, f: string) => sum + getTotalMachinesForUnit(f, 45), 0);
        } else {
          const inHouseConfigs = getUnitConfigs().filter(u => !u.unitName.toLowerCase().includes('sub'));
          inHouseTotalMachines = inHouseConfigs.reduce((sum, u) => sum + Number(u.totalMachine || 0), 0) || (filteredRows.length > 0 ? 261 : 0);
        }
      }

      // Daily machine averages
      const inHouseDateMap: Record<string, { bulkRun: number; sampleRun: number; totalRun: number }> = {};
      ihRows.forEach(r => {
        const d = r.date || 'default';
        if (!inHouseDateMap[d]) {
          inHouseDateMap[d] = { bulkRun: 0, sampleRun: 0, totalRun: 0 };
        }
        const bRun = Number(r.runningBulk) || Math.max(0, (Number(r.runningMachine) || 0) - (Number(r.runningSample) || 0));
        const sRun = Number(r.runningSample) || 0;
        inHouseDateMap[d].bulkRun += bRun;
        inHouseDateMap[d].sampleRun += sRun;
        inHouseDateMap[d].totalRun += (bRun + sRun);
      });

      const inHouseDateKeys = Object.keys(inHouseDateMap);
      const inHouseDaysCount = Math.max(1, inHouseDateKeys.length);
      const sumBulkRun = inHouseDateKeys.reduce((acc, d) => acc + inHouseDateMap[d].bulkRun, 0);
      const sumSampleRun = inHouseDateKeys.reduce((acc, d) => acc + inHouseDateMap[d].sampleRun, 0);
      const sumTotalRun = inHouseDateKeys.reduce((acc, d) => acc + inHouseDateMap[d].totalRun, 0);

      inHouseBulkRunning = inHouseDateKeys.length > 0 ? Math.round(sumBulkRun / inHouseDaysCount) : 0;
      inHouseSampleRunning = inHouseDateKeys.length > 0 ? Math.round(sumSampleRun / inHouseDaysCount) : 0;
      inHouseRunningMachines = inHouseDateKeys.length > 0 ? Math.round(sumTotalRun / inHouseDaysCount) : 0;

      // 5. Quality metrics (In-House + Sub-Contact)
      const inHouseReject = Math.round(ihRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0));
      const inHouseHold = Math.round(ihRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.hold)) ? 0 : Number(r.hold || 0)), 0));
      const inHouseJhuteVal = Math.round(ihRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.jhuteCutpcs)) ? 0 : Number(r.jhuteCutpcs || 0)), 0));
      const subContactReject = Math.round(scRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0));

      qualityReject = inHouseReject + subContactReject;
      qualityHold = inHouseHold;
      qualityJhute = inHouseJhuteVal;
    } else if (floors && floors.length > 0) {
      // Fallback to initial floor models if ledger empty
      const ihFloors = floors.filter(f => !f.name.toLowerCase().includes('sub'));
      const scFloors = floors.filter(f => f.name.toLowerCase().includes('sub'));
      inHouseTarget = ihFloors.reduce((sum, f) => sum + f.targetKg, 0);
      inHouseBulkTarget = inHouseTarget;
      subContactTarget = scFloors.reduce((sum, f) => sum + f.targetKg, 0);
      inHouseProd = ihFloors.reduce((sum, f) => sum + f.productionKg, 0);
      inHouseTotalProd = inHouseProd;
      subContactProd = scFloors.reduce((sum, f) => sum + f.productionKg, 0);
      subContactTotalProd = subContactProd;
      inHouseTotalMachines = ihFloors.reduce((sum, f) => sum + f.totalMachines, 0);
      inHouseRunningMachines = ihFloors.reduce((sum, f) => sum + f.runningMachines, 0);
      inHouseBulkRunning = Math.round(inHouseRunningMachines * 0.85);
      inHouseSampleRunning = inHouseRunningMachines - inHouseBulkRunning;
      efficiency = 84.6;
      capacity = 78.4;
      qualityReject = 180;
      qualityHold = 110;
      qualityJhute = 45;
    }

    const totalTarget = inHouseTarget + subContactTarget;
    const bulkTarget = inHouseBulkTarget + subContactBulkTarget;
    const primaryTarget = bulkTarget > 0 ? bulkTarget : totalTarget;
    const bulkProduction = inHouseProd + subContactProd;
    const totalProdCombined = inHouseTotalProd + subContactTotalProd;

    // ACHIEVEMENT% = (Total Production / Total Target) * 100
    const targetForAchievement = totalTarget > 0 ? totalTarget : (bulkTarget > 0 ? bulkTarget : 0);
    const prodForAchievement = totalProdCombined > 0 ? totalProdCombined : bulkProduction;
    const achievementPct = targetForAchievement > 0 
      ? parseFloat(((prodForAchievement / targetForAchievement) * 100).toFixed(1)) 
      : 0;

    const balanceKg = Math.max(0, (totalTarget > 0 ? totalTarget : bulkTarget) - prodForAchievement);
    
    // Efficiency comparison vs 85.0% standard benchmark
    const targetEfficiency = 85.0;
    const efficiencyDiff = parseFloat((efficiency - targetEfficiency).toFixed(1));

    // In-House Machine Utilization %
    const inHouseUtilPct = inHouseTotalMachines > 0 
      ? parseFloat(((inHouseRunningMachines / inHouseTotalMachines) * 100).toFixed(1))
      : (appliedUnit.toLowerCase().includes('sub') ? 0 : 77.9);
    const inHouseIdleMC = Math.max(0, inHouseTotalMachines - inHouseRunningMachines);

    // Quality percentages
    const qualityProdBase = totalProdCombined > 0 ? totalProdCombined : bulkProduction;
    const qualityRejectPct = qualityProdBase > 0 ? parseFloat(((qualityReject / qualityProdBase) * 100).toFixed(2)) : 0;
    const qualityHoldPct = qualityProdBase > 0 ? parseFloat(((qualityHold / qualityProdBase) * 100).toFixed(2)) : 0;
    const qualityJhutePct = qualityProdBase > 0 ? parseFloat(((qualityJhute / qualityProdBase) * 100).toFixed(2)) : 0;
    const cumulativeScrapPct = parseFloat((qualityRejectPct + qualityHoldPct + qualityJhutePct).toFixed(2));
    const qualityPassRate = qualityProdBase > 0 
      ? Math.max(0, Math.min(100, parseFloat((100 - cumulativeScrapPct).toFixed(1))))
      : 100;

    return {
      totalTarget,
      primaryTarget,
      bulkTarget,
      inHouseTarget,
      inHouseBulkTarget,
      subContactTarget,
      bulkProduction,
      totalProdCombined,
      sampleProduction,
      inHouseSampleProd,
      subContactSampleProd,
      inHouseProd,
      inHouseTotalProd,
      subContactProd,
      subContactTotalProd,
      balanceKg,
      achievementPct,
      efficiency,
      targetEfficiency,
      efficiencyDiff,
      capacity,
      totalDailyCapacity,
      periodTotalCapacity,
      inHouseTotalMachines,
      inHouseRunningMachines,
      inHouseBulkRunning,
      inHouseSampleRunning,
      inHouseUtilPct,
      inHouseIdleMC,
      qualityPassRate,
      qualityReject,
      qualityRejectPct,
      qualityHold,
      qualityHoldPct,
      qualityJhute,
      qualityJhutePct,
      matchingCount: filteredRows.length
    };
  }, [filteredRows, floors, filterState]);

  const handleResetFilter = () => {
    if (onFilterChange) {
      onFilterChange({
        unit: 'all',
        dateMode: 'single',
        singleDate: productionDateMeta.isoDate,
        dateFrom: '2026-08-01',
        dateTo: productionDateMeta.isoDate,
        month: '2026-08',
        year: '2026'
      });
    }
  };

  return (
    <div 
      id="production-control-top-panel"
      className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-linear-to-br from-[#060D1A] via-[#0B1728] to-[#0A192F] p-3.5 sm:p-4 md:p-5 text-white shadow-xl"
    >
      {/* Ambient background glows */}
      <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-cyan-500/5 blur-3xl pointer-events-none" />
      <div className="absolute right-1/3 bottom-0 h-48 w-48 rounded-full bg-indigo-500/5 blur-2xl pointer-events-none" />

      {/* ================================================================= */}
      {/* 1. HEADER ROW */}
      {/* ================================================================= */}
      <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-blue-500/15 pb-3 mb-3">
        {/* Title & Subtitle */}
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-400/20 px-2 py-0.5 text-[10.5px] font-semibold text-blue-300 backdrop-blur-xs">
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>Knitting Plant Live System</span>
          </div>
          <h1 className="font-sans text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            Production Control
          </h1>
          <p className="text-[11px] sm:text-xs font-medium text-slate-300">
            Live bulk production performance connected with Production Ledger.
          </p>
        </div>

        {/* Top-Right: LIVE & ACTIVE FILTER CONTEXT BADGE */}
        <div className="shrink-0 flex flex-wrap items-center gap-2">
          {/* Active Filter Pill */}
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900/90 border border-blue-500/30 px-3 py-1.5 shadow-inner backdrop-blur-md">
            {/* Live Indicator */}
            <div className="inline-flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[10px] font-black tracking-wider text-emerald-400 uppercase">
                LIVE
              </span>
            </div>

            <span className="text-slate-600 font-bold text-xs">│</span>

            {/* Filter / Production Date context */}
            <div className="text-[11px] font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
              <Filter className="h-3 w-3 text-cyan-400" />
              <span className="font-mono text-cyan-300 font-bold">{filterContextLabel}</span>
              <span className="text-[10px] text-slate-400 font-medium font-mono">({metrics.matchingCount} entries)</span>
            </div>

            {isFiltered && (
              <button
                type="button"
                onClick={handleResetFilter}
                className="ml-1 text-[10px] text-amber-400 hover:text-amber-300 hover:underline cursor-pointer flex items-center gap-0.5"
                title="Reset to All Units / Latest Date"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. MAIN KPI SECTION - ALL 7 COLUMNS FIT IN A SINGLE ROW (XL+) */}
      {/* ================================================================= */}
      {metrics.matchingCount === 0 ? (
        <div className="rounded-xl bg-slate-900/80 border border-amber-500/30 p-6 text-center space-y-2 my-2">
          <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Production Ledger records found for this filter</h3>
          <p className="text-xs text-slate-300 max-w-md mx-auto">
            The selected date or unit criteria has no recorded ledger entries. Switch to the latest active production date or reset filters.
          </p>
          <button
            type="button"
            onClick={handleResetFilter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-all cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Show Latest Production (26 AUG 2026)</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 my-0.5">
          
          {/* COLUMN 1: BULK TARGET */}
          <div className="rounded-xl bg-slate-900/80 hover:bg-slate-900/95 border border-blue-500/20 hover:border-blue-400/40 p-3 transition-all duration-200 shadow-sm backdrop-blur-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-blue-500/10">
              <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 truncate">
                <Target className="h-3 w-3 text-blue-400 shrink-0" />
                <span className="truncate">BULK TARGET</span>
              </span>
              <span className="text-[9.5px] font-bold text-blue-300 bg-blue-500/10 border border-blue-400/20 px-1 py-0.5 rounded shrink-0">
                Plan
              </span>
            </div>

            <div className="my-1.5">
              <div className="font-mono text-xl xl:text-[21px] 2xl:text-2xl font-black text-white tracking-tight">
                {metrics.bulkTarget.toLocaleString()} <span className="text-[11px] font-bold text-slate-400">Kg</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">In-House:</span>
                <span className="font-mono font-semibold text-slate-100">{metrics.inHouseBulkTarget.toLocaleString()} Kg</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Sub-Contract:</span>
                <span className="font-mono font-semibold text-slate-100">{metrics.subContactTarget.toLocaleString()} Kg</span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: BULK PRODUCTION */}
          <div className="rounded-xl bg-slate-900/80 hover:bg-slate-900/95 border border-blue-500/20 hover:border-emerald-400/40 p-3 transition-all duration-200 shadow-sm backdrop-blur-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-blue-500/10">
              <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 truncate">
                <Factory className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="truncate">BULK PROD</span>
              </span>
              <span className="text-[9.5px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-1 py-0.5 rounded shrink-0">
                Actual
              </span>
            </div>

            <div className="my-1.5">
              <div className="font-mono text-xl xl:text-[21px] 2xl:text-2xl font-black text-emerald-400 tracking-tight">
                {metrics.bulkProduction.toLocaleString()} <span className="text-[11px] font-bold text-slate-400">Kg</span>
              </div>
            </div>

            {/* Breakdown */}
            <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">In-House:</span>
                <span className="font-mono font-semibold text-slate-100">{metrics.inHouseProd.toLocaleString()} Kg</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Sub-Contact:</span>
                <span className="font-mono font-semibold text-slate-100">{metrics.subContactProd.toLocaleString()} Kg</span>
              </div>
              <div className="flex items-center justify-between text-indigo-300/90 pt-0.5 border-t border-slate-800/50">
                <span className="text-indigo-400 font-medium">Sample Prod:</span>
                <span className="font-mono font-bold text-indigo-200">{metrics.sampleProduction.toLocaleString()} Kg</span>
              </div>
            </div>
          </div>

          {/* COLUMN 3: ACHIEVEMENT */}
          <div className="rounded-xl bg-slate-900/80 hover:bg-slate-900/95 border border-blue-500/20 hover:border-cyan-400/40 p-3 transition-all duration-200 shadow-sm backdrop-blur-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-1.5 border-b border-blue-500/10">
              <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 truncate">
                <Percent className="h-3 w-3 text-cyan-400 shrink-0" />
                <span className="truncate">% ACHIEVEMENT</span>
              </span>
              <span className="text-[9.5px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-400/20 px-1 py-0.5 rounded shrink-0">
                Rate
              </span>
            </div>

            <div className="my-1 flex items-center justify-between gap-1">
              <div className="font-mono text-xl xl:text-[21px] 2xl:text-2xl font-black text-cyan-300 tracking-tight">
                {metrics.achievementPct.toFixed(1)}%
              </div>
              <CircularProgressRing percentage={metrics.achievementPct} />
            </div>

            {/* Breakdown */}
            <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 truncate mr-1">Prod / Plan:</span>
                <span className="font-mono font-semibold text-slate-100 shrink-0">
                  {Math.round(metrics.totalProdCombined / 1000)}K / {Math.round((metrics.totalTarget || metrics.bulkTarget) / 1000)}K
                </span>
              </div>
              <div className="flex items-center justify-between text-amber-300/90">
                <span className="text-slate-400 truncate mr-1">Remaining:</span>
                <span className="font-mono font-semibold text-amber-400 shrink-0">
                  {metrics.balanceKg.toLocaleString()} Kg
                </span>
              </div>
            </div>
          </div>

          {/* COLUMN 4: EFFICIENCY */}
          <div className="rounded-xl bg-slate-900/80 hover:bg-slate-900/95 border border-blue-500/20 hover:border-indigo-400/40 p-3 transition-all duration-200 shadow-sm backdrop-blur-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-1 border-b border-blue-500/10">
              <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 truncate">
                <Activity className="h-3 w-3 text-indigo-400 shrink-0" />
                <span className="truncate">EFFICIENCY</span>
              </span>
              <span className="text-[9px] font-bold text-slate-300 bg-slate-800/90 border border-slate-700/60 px-1.5 py-0.5 rounded shrink-0">
                Overall
              </span>
            </div>

            {/* Middle Row: Left big value + Right Semicircular Speedometer Gauge */}
            <div className="my-0.5 flex items-center justify-between gap-1">
              <div className="font-mono text-xl xl:text-[21px] 2xl:text-2xl font-black text-indigo-200 tracking-tight shrink-0">
                {metrics.efficiency.toFixed(1)}%
              </div>
              <SpeedometerGauge value={metrics.efficiency} target={85} gaugeId="eff" />
            </div>

            {/* Breakdown / Target & Variance */}
            <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Target:</span>
                <span className="font-mono font-bold text-white">{metrics.targetEfficiency.toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Variance:</span>
                <span className={`font-mono font-bold inline-flex items-center gap-0.5 text-[10.5px] ${
                  metrics.efficiencyDiff >= 0 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {metrics.efficiencyDiff >= 0 ? (
                    <TrendingUp className="h-2.5 w-2.5 inline shrink-0" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5 inline shrink-0" />
                  )}
                  <span>{metrics.efficiencyDiff >= 0 ? `+${metrics.efficiencyDiff}%` : `${metrics.efficiencyDiff}%`}</span>
                </span>
              </div>
            </div>
          </div>

          {/* COLUMN 5: CAPACITY UTILIZATION */}
          <div className="rounded-xl bg-slate-900/80 hover:bg-slate-900/95 border border-blue-500/20 hover:border-cyan-400/40 p-3 transition-all duration-200 shadow-sm backdrop-blur-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-1 border-b border-blue-500/10">
              <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 truncate">
                <Gauge className="h-3 w-3 text-cyan-400 shrink-0" />
                <span className="truncate">CAPACITY</span>
              </span>
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border shrink-0 ${
                metrics.capacity >= 85 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                  : metrics.capacity >= 60 
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              }`}>
                {metrics.capacity >= 85 ? 'OPTIMAL' : metrics.capacity >= 60 ? 'NORMAL' : 'LOW'}
              </span>
            </div>

            {/* Middle Row: Left big value + Right Semicircular Speedometer Gauge */}
            <div className="my-0.5 flex items-center justify-between gap-1">
              <div className="font-mono text-xl xl:text-[21px] 2xl:text-2xl font-black text-cyan-200 tracking-tight shrink-0">
                {metrics.capacity.toFixed(1)}%
              </div>
              <SpeedometerGauge value={metrics.capacity} target={85} gaugeId="cap" />
            </div>

            {/* Breakdown: Available & Prod / Capacity */}
            <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Available:</span>
                <span className="font-mono font-bold text-cyan-300">{(100 - metrics.capacity).toFixed(1)}%</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400 truncate mr-1">Prod / Cap:</span>
                <span className="font-mono font-bold text-slate-200 shrink-0">
                  {Math.round(metrics.inHouseTotalProd / 1000)}K / {Math.round(metrics.periodTotalCapacity / 1000)}K
                </span>
              </div>
            </div>
          </div>

          {/* COLUMN 6: IN-HOUSE MACHINE UTILIZATION */}
          <div className="rounded-xl bg-slate-900/80 hover:bg-slate-900/95 border border-blue-500/20 hover:border-sky-400/40 p-3 transition-all duration-200 shadow-sm backdrop-blur-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-1 border-b border-blue-500/10">
              <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 truncate">
                <Cpu className="h-3 w-3 text-sky-400 shrink-0" />
                <span className="truncate">IN-HOUSE M/C</span>
              </span>
              <span className="text-[9px] font-bold text-sky-300 bg-sky-500/10 border border-sky-400/20 px-1.5 py-0.5 rounded shrink-0">
                {metrics.inHouseRunningMachines} Active
              </span>
            </div>

            {/* Middle Row: Left big value + Right Semicircular Speedometer Gauge */}
            <div className="my-0.5 flex items-center justify-between gap-1">
              <div className="font-mono text-xl xl:text-[21px] 2xl:text-2xl font-black text-sky-200 tracking-tight shrink-0">
                {metrics.inHouseUtilPct.toFixed(1)}%
              </div>
              <SpeedometerGauge 
                value={metrics.inHouseUtilPct} 
                target={85} 
                gaugeId="ih_mc" 
                startColor="#38BDF8"
                midColor="#0EA5E9"
                endColor="#10B981"
              />
            </div>

            {/* Breakdown: Bulk vs Sample vs Idle */}
            <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Bulk / Sample:</span>
                <span className="font-mono font-semibold text-slate-100">{metrics.inHouseBulkRunning} / {metrics.inHouseSampleRunning} M/C</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Total / Idle:</span>
                <span className="font-mono font-semibold text-amber-300">{metrics.inHouseTotalMachines} ({metrics.inHouseIdleMC} Idle)</span>
              </div>
            </div>
          </div>

          {/* COLUMN 7: QUALITY STATUS */}
          <div className="rounded-xl bg-slate-900/80 hover:bg-slate-900/95 border border-blue-500/20 hover:border-emerald-400/40 p-3 transition-all duration-200 shadow-sm backdrop-blur-xs flex flex-col justify-between min-w-0">
            <div className="flex items-center justify-between pb-1 border-b border-blue-500/10">
              <span className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1 truncate">
                <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                <span className="truncate">QUALITY</span>
              </span>
              <span className="text-[9px] font-black text-emerald-300 bg-emerald-500/10 border border-emerald-400/20 px-1.5 py-0.5 rounded shrink-0">
                {metrics.qualityPassRate >= 98 ? 'EXCELLENT' : 'PASS'}
              </span>
            </div>

            {/* Middle Row: Left big value + Right Semicircular Speedometer Gauge */}
            <div className="my-0.5 flex items-center justify-between gap-1">
              <div className="font-mono text-xl xl:text-[21px] 2xl:text-2xl font-black text-emerald-300 tracking-tight shrink-0">
                {metrics.qualityPassRate.toFixed(1)}%
              </div>
              <SpeedometerGauge 
                value={metrics.qualityPassRate} 
                target={98} 
                gaugeId="qual" 
                startColor="#3B82F6"
                midColor="#10B981"
                endColor="#059669"
              />
            </div>

            {/* Breakdown: Reject & Hold */}
            <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Pass Rate:</span>
                <span className="font-mono font-semibold text-emerald-400">{metrics.qualityPassRate}% Passed</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span className="text-slate-400">Reject / Hold:</span>
                <span className="font-mono font-semibold text-rose-300">{metrics.qualityRejectPct}% / {metrics.qualityHoldPct}%</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ================================================================= */}
      {/* 3. BOTTOM STATUS BAR */}
      {/* ================================================================= */}
      <div className="mt-3.5 pt-3 border-t border-blue-500/15 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-300 font-medium">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {/* System Online & Syncing */}
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-200 text-[11px]">
              System: <strong className="text-emerald-400 font-semibold">Online & Live Linked</strong>
            </span>
          </div>

          <span className="text-slate-600 hidden sm:inline">│</span>

          {/* Database connection status */}
          <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
            <Database className="h-3 w-3 text-blue-400" />
            <span>
              Production Ledger: <strong className="font-mono text-cyan-300 font-bold">{ledger.length}</strong> records loaded
            </span>
          </div>

          <span className="text-slate-600 hidden sm:inline">│</span>

          {/* Last Updated Time */}
          <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
            <RefreshCw className="h-3 w-3 text-cyan-400" />
            <span>
              Last Updated: <strong className="font-mono text-white font-bold">{currentTimeStr}</strong>
            </span>
          </div>

          <span className="text-slate-600 hidden sm:inline">│</span>

          {/* Floor Updates Status (Photo 3 requirement) */}
          <div className="flex items-center gap-1.5 text-slate-300 text-[11px] flex-wrap">
            {floorUpdateStatus.isNoneUpdated ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
                <span>No Update today</span>
                <span className="text-[10px] text-amber-400/80 font-mono">(7 Floors Pending)</span>
              </span>
            ) : floorUpdateStatus.isAllUpdated ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>All 7 Floors Updated</span>
                <span className="text-[10px] text-emerald-400 font-mono">(7/7)</span>
              </span>
            ) : (
              <div className="inline-flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-cyan-400" />
                  <span>Floor Update:</span>
                  <strong className="text-emerald-400 font-mono font-bold">{floorUpdateStatus.updatedCount}/7</strong>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span>Pending ({floorUpdateStatus.pendingCount}):</span>
                </span>
                <div className="inline-flex items-center gap-1 flex-wrap">
                  {floorUpdateStatus.pendingFloors.map(f => (
                    <span 
                      key={f.id} 
                      className="px-1.5 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold"
                      title={`${f.name} update is pending`}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Far Right Action Button: Open Production Ledger */}
        <button
          onClick={() => onNavigate('Production Ledger')}
          id="welcome-open-ledger-btn"
          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 hover:border-cyan-500/50 px-2.5 py-1 rounded-lg transition-all shadow-xs cursor-pointer ml-auto"
        >
          <span>Open Production Ledger</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
