/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FactoryFloor } from '../types';
import { 
  Play, 
  Search, 
  CheckCircle, 
  AlertCircle,
  Gauge,
  TrendingUp,
  Percent,
  Cpu,
  Trash2,
  Wrench,
  Droplet,
  Shuffle,
  ChevronDown,
  Building2,
  Check,
  Calendar
} from 'lucide-react';
import { FilterState } from './DashboardFilterToolbar';
import { LedgerRecord } from '../types';
import { generateInitialLedger } from './ProductionLedgerView';

const getRelativeDateString = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface FloorDashboardViewProps {
  floors: FactoryFloor[];
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string | null) => void;
  filterState?: FilterState;
  isLoading?: boolean;
}

// Knitting machines list per floor (for drilldown)
interface KnittingMachine {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'maintenance' | 'stopped';
  rpm: number;
  gsm: number;
  fabricType: string;
  efficiency: number;
  stopReason?: string;
}

const MACHINE_TEMPLATES: KnittingMachine[] = [
  { id: 'm01', name: 'M-01 (Mayer & Cie)', status: 'running', rpm: 22, gsm: 160, fabricType: 'Single Jersey', efficiency: 96.4 },
  { id: 'm02', name: 'M-02 (Mayer & Cie)', status: 'running', rpm: 21, gsm: 180, fabricType: '1x1 Rib', efficiency: 94.2 },
  { id: 'm03', name: 'M-03 (Terrot)', status: 'running', rpm: 20, gsm: 220, fabricType: 'Interlock', efficiency: 95.8 },
  { id: 'm04', name: 'M-04 (Terrot)', status: 'idle', rpm: 0, gsm: 240, fabricType: 'French Terry', efficiency: 82.0, stopReason: 'Awaiting Yarn' },
  { id: 'm05', name: 'M-05 (Fukuhara)', status: 'running', rpm: 23, gsm: 140, fabricType: 'Single Jersey', efficiency: 97.1 },
  { id: 'm06', name: 'M-06 (Fukuhara)', status: 'maintenance', rpm: 0, gsm: 0, fabricType: 'None', efficiency: 0.0, stopReason: 'Sinker Replacement' },
  { id: 'm07', name: 'M-07 (Pai Lung)', status: 'running', rpm: 18, gsm: 300, fabricType: 'Fleece', efficiency: 91.5 },
  { id: 'm08', name: 'M-08 (Pai Lung)', status: 'stopped', rpm: 0, gsm: 160, fabricType: 'Single Jersey', efficiency: 45.0, stopReason: 'Needle Breakage' },
];

// Stylized Epyllion Logo
const EpyllionLogo = () => (
  <svg width="150" height="42" viewBox="0 0 150 42" className="mr-3" id="epyllion-svg-logo">
    {/* Sun with rays + green petal */}
    <g transform="translate(4, 3)">
      {/* Sun rays */}
      <path d="M 19,10 C 23,6 27,3 31,2" stroke="#F39C12" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M 22,14 C 28,10 33,6 37,5" stroke="#F39C12" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M 23,19 C 30,15 36,11 40,9" stroke="#F39C12" strokeWidth="2" strokeLinecap="round" fill="none" />
      
      {/* Green leaf shape */}
      <path d="M 5,22 C 3,12 13,2 21,10 C 23,12 25,15 23,22 C 17,24 11,24 5,22 Z" fill="#27AE60" />
      <path d="M 7,22 C 11,18 17,18 21,22" stroke="#FFFFFF" strokeWidth="1.2" fill="none" />
    </g>
    {/* Text EPYLLION */}
    <text x="46" y="22" fontFamily="sans-serif" fontSize="15" fontWeight="900" fill="#27AE60" letterSpacing="0.8">
      EPYLLION
    </text>
    {/* Text GROUP */}
    <text x="46" y="32" fontFamily="sans-serif" fontSize="7" fontWeight="bold" fill="#7F8C8D" letterSpacing="4.5">
      G R O U P
    </text>
  </svg>
);

// High-Fidelity Speedometer Gauge Component
interface GaugeProps {
  value: number;
  color: string;
  max: number;
}

const SemiCircleGauge = ({ value, color = '#F39C12', max = 100 }: GaugeProps) => {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const radius = 48;
  const strokeWidth = 14;
  const cx = 60;
  const cy = 55;
  
  const circ = Math.PI * radius;
  const strokeDashoffset = circ - (percentage * circ);

  // Angular rotation for pointer needle
  const angle = 180 + percentage * 180;
  const rad = (angle * Math.PI) / 180;
  const needleLen = radius - 8;
  const nx = cx + needleLen * Math.cos(rad);
  const ny = cy + needleLen * Math.sin(rad);

  return (
    <div className="relative w-full flex flex-col items-center justify-center">
      <svg width="120" height="65" viewBox="0 0 120 65" className="overflow-visible">
        {/* Gray Arc Sectors */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Dynamic Highlight Arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circ}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
        {/* Gauge Center & Pointer Needle */}
        <g>
          <line
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke="#2C3E50"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="5" fill="#2C3E50" />
          <circle cx={cx} cy={cy} r="2" fill="#FFFFFF" />
        </g>
      </svg>
      {/* Bold Value Overlay */}
      <span className="text-xl font-extrabold text-slate-800 font-mono -mt-1">
        {value}%
      </span>
    </div>
  );
};

// Donut Chart for Operator Attendance
interface DonutProps {
  absentPct: number;
  presentPct: number;
}

const DonutChart = ({ absentPct = 0, presentPct = 100 }: DonutProps) => {
  const radius = 35;
  const cx = 50;
  const cy = 50;
  const strokeWidth = 14;
  const circ = 2 * Math.PI * radius;
  
  const absentCirc = (absentPct / 100) * circ;

  return (
    <div className="relative w-full flex items-center justify-center">
      <svg width="115" height="115" viewBox="0 0 100 100">
        {/* Present Segment (Orange Core) */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#E67E22"
          strokeWidth={strokeWidth}
        />
        {/* Absent Segment (Teal Overlay) */}
        {absentPct > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#16A085"
            strokeWidth={strokeWidth}
            strokeDasharray={`${absentCirc} ${circ}`}
            strokeDashoffset={0}
            transform="rotate(-90 50 50)"
            className="transition-all duration-700"
          />
        )}
        {/* Percentage Labels Inside Donut */}
        {absentPct > 0 ? (
          <text x="50" y="32" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="black" fontFamily="sans-serif">
            {absentPct.toFixed(2)}%
          </text>
        ) : (
          <text x="50" y="44" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="black" fontFamily="sans-serif">
            0.00%
          </text>
        )}
        <text x="50" y="58" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="black" fontFamily="sans-serif">
          {presentPct.toFixed(2)}%
        </text>
      </svg>
    </div>
  );
};

// Custom SVG Bar Chart
interface BarChartData {
  label: string;
  target: number;
  actual: number;
}

const SvgBarChart = ({ data }: { data: BarChartData[] }) => {
  const height = 150;
  const paddingLeft = 32;
  const paddingRight = 10;
  const paddingTop = 22;
  const paddingBottom = 22;
  
  const maxVal = Math.max(...data.flatMap(d => [d.target, d.actual]), 100) * 1.15;
  const width = 480;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[400px] h-[190px] relative">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Y-Axis Grid Lines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const val = Math.round((maxVal / 4) * i);
            const y = height - paddingBottom - ((height - paddingTop - paddingBottom) / 4) * i;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#EBF0F5"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#7F8C8D"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Draw Columns */}
          {data.map((d, index) => {
            const chartWidth = width - paddingLeft - paddingRight;
            const groupWidth = chartWidth / data.length;
            const xGroup = paddingLeft + groupWidth * index;
            
            const barWidth = groupWidth * 0.3;
            const gap = groupWidth * 0.05;
            
            const xTarget = xGroup + groupWidth * 0.18;
            const xActual = xTarget + barWidth + gap;
            
            const plotHeight = height - paddingTop - paddingBottom;
            const hTarget = (d.target / maxVal) * plotHeight;
            const hActual = (d.actual / maxVal) * plotHeight;
            
            const yTarget = height - paddingBottom - hTarget;
            const yActual = height - paddingBottom - hActual;

            return (
              <g key={index}>
                {/* Target Bar (Deep Teal) */}
                <rect
                  x={xTarget}
                  y={yTarget}
                  width={barWidth}
                  height={hTarget}
                  fill="#0E6251"
                  rx="1"
                />
                <text
                  x={xTarget + barWidth / 2}
                  y={yTarget - 3}
                  textAnchor="middle"
                  fill="#7F8C8D"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {d.target}
                </text>

                {/* Production Bar (Orange) */}
                <rect
                  x={xActual}
                  y={yActual}
                  width={barWidth}
                  height={hActual}
                  fill="#E67E22"
                  rx="1"
                />
                <text
                  x={xActual + barWidth / 2}
                  y={yActual - 3}
                  textAnchor="middle"
                  fill="#E67E22"
                  fontSize="8"
                  fontWeight="bold"
                >
                  {d.actual}
                </text>

                {/* Day Labels */}
                <text
                  x={xGroup + groupWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fill="#2C3E50"
                  fontSize="8.5"
                  fontWeight="bold"
                >
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// Custom SVG Line Chart with Label Markers
interface LineSeries {
  name: string;
  color: string;
  data: number[];
}

interface SvgLineChartProps {
  labels: string[];
  series: LineSeries[];
  percentage?: boolean;
  minY?: number;
  maxY?: number;
}

const SvgLineChart = ({ labels, series, percentage = false, minY = 0, maxY }: SvgLineChartProps) => {
  const height = 150;
  const paddingLeft = 38;
  const paddingRight = 15;
  const paddingTop = 22;
  const paddingBottom = 22;
  const width = 480;

  const allVals = series.flatMap(s => s.data);
  const calculatedMax = Math.max(...allVals, 1) * 1.15;
  const finalMaxY = maxY !== undefined ? maxY : calculatedMax;
  const finalMinY = minY;

  const chartWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[400px] h-[190px] relative">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 1, 2, 3, 4].map((i) => {
            const val = finalMinY + ((finalMaxY - finalMinY) / 4) * i;
            const y = height - paddingBottom - (plotHeight / 4) * i;
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="#EBF0F5"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#7F8C8D"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {percentage ? `${val.toFixed(2)}%` : val.toFixed(val < 10 && val > 0 ? 1 : 0)}
                </text>
              </g>
            );
          })}

          {/* Lines & Markers */}
          {series.map((s, seriesIdx) => {
            const points = s.data.map((val, idx) => {
              const x = paddingLeft + (chartWidth / (labels.length - 1)) * idx;
              const ratio = finalMaxY - finalMinY > 0 ? (val - finalMinY) / (finalMaxY - finalMinY) : 0;
              const y = height - paddingBottom - ratio * plotHeight;
              return { x, y, val };
            });

            const pathD = points.reduce((acc, p, idx) => {
              return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
            }, '');

            return (
              <g key={seriesIdx}>
                {/* Line Path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  className="transition-all duration-500"
                />
                {/* Dots & Numeric floating labels */}
                {points.map((p, idx) => (
                  <g key={idx}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r="4"
                      fill={s.color}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                    <text
                      x={p.x}
                      y={p.y - 7}
                      textAnchor="middle"
                      fill={s.color}
                      fontSize="8"
                      fontWeight="bold"
                    >
                      {percentage ? `${p.val.toFixed(2)}%` : p.val}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {/* Day Label Tags */}
          {labels.map((l, idx) => {
            const x = paddingLeft + (chartWidth / (labels.length - 1)) * idx;
            return (
              <text
                key={idx}
                x={x}
                y={height - 6}
                textAnchor="middle"
                fill="#2C3E50"
                fontSize="8.5"
                fontWeight="bold"
              >
                {l}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// Custom Horizontal Bar Chart
interface HorizontalBarData {
  label: string;
  value: number;
}

const SvgHorizontalBarChart = ({ data }: { data: HorizontalBarData[] }) => {
  const height = 150;
  const paddingLeft = 45;
  const paddingRight = 32;
  const paddingTop = 12;
  const paddingBottom = 15;
  const width = 480;
  
  const chartWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const barHeight = (plotHeight / data.length) * 0.55;

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[380px] h-[190px] relative">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Scale benchmarks: 65%, 70%, 75%, 80%, 85% */}
          {[65, 70, 75, 80, 85].map((gridVal, i) => {
            const x = paddingLeft + ((gridVal - 65) / 20) * chartWidth;
            return (
              <g key={i}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={height - paddingBottom}
                  stroke="#EBF0F5"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={height - 4}
                  textAnchor="middle"
                  fill="#7F8C8D"
                  fontSize="8.5"
                  fontFamily="monospace"
                >
                  {gridVal}%
                </text>
              </g>
            );
          })}

          {/* Draw bars */}
          {data.map((d, idx) => {
            const y = paddingTop + (plotHeight / data.length) * idx + (plotHeight / data.length - barHeight) / 2;
            // Scale value relative to 65% base min, 85% max
            const barPct = Math.max(0, Math.min((d.value - 65) / 20, 1));
            const barWidth = barPct * chartWidth;
            
            return (
              <g key={idx}>
                {/* Horizontal label on left */}
                <text
                  x={paddingLeft - 5}
                  y={y + barHeight / 2 + 3}
                  textAnchor="end"
                  fill="#2C3E50"
                  fontSize="8.5"
                  fontWeight="bold"
                >
                  {d.label}
                </text>

                {/* Rounded Bar */}
                <rect
                  x={paddingLeft}
                  y={y}
                  width={Math.max(barWidth, 4)}
                  height={barHeight}
                  fill="#0F4C81"
                  rx="1"
                />

                {/* Floating percentage text on right */}
                <text
                  x={paddingLeft + Math.max(barWidth, 4) + 5}
                  y={y + barHeight / 2 + 3}
                  textAnchor="start"
                  fill="#2C3E50"
                  fontSize="8.5"
                  fontWeight="black"
                >
                  {d.value}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

// Procedural metric engine seeded by selected floor and active date, integrated with the actual production ledger!
const getMetricsForUnitAndDate = (unitId: string, dateStr: string) => {
  // 1. Map unitId to Ledger Floor name
  const unitToLedgerFloor: Record<string, string> = {
    'ekl': 'EKL',
    'efl': 'EFL',
    'efl-2': 'EFL-2',
    'auto-stripe': 'Auto Stripe',
    'efl-ext': 'EFL-Extension',
    'esl-ext': 'ESL-Extension',
    'sub-contact': 'Sub-Contact'
  };
  const ledgerFloorName = unitToLedgerFloor[unitId] || 'EKL';

  // 2. Fetch the current ledger list from initial memory ledger generator
  const ledgerRecords: LedgerRecord[] = generateInitialLedger();

  // 3. Find target record for (ledgerFloorName, dateStr)
  const currentRecord = ledgerRecords.find(r => r.floor === ledgerFloorName && r.date === dateStr);

  // Helper to subtract 1 day from YYYY-MM-DD
  const getYesterdayDate = (dtStr: string): string => {
    const d = new Date(dtStr);
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const yesterdayDateStr = getYesterdayDate(dateStr);
  const yesterdayRecord = ledgerRecords.find(r => r.floor === ledgerFloorName && r.date === yesterdayDateStr);

  // If we have a record for the specified date, use its actual values!
  if (currentRecord) {
    const target = currentRecord.target || 0;
    const production = currentRecord.totalProduction || 0;
    const achievement = currentRecord.efficiency !== undefined ? currentRecord.efficiency : (target > 0 ? parseFloat(((production / target) * 100).toFixed(1)) : 0);
    const runningMachines = currentRecord.runningMachine || 0;
    const idleMachine = currentRecord.idleMachine !== undefined ? currentRecord.idleMachine : (currentRecord.idleMc || 0);
    const totalMachines = runningMachines + idleMachine || 12;
    const idlePct = currentRecord.idleMachinePct !== undefined ? currentRecord.idleMachinePct : (currentRecord.idleMcPct || 0);
    const capacity = currentRecord.capacityUtilization || 0;
    const efficiency = currentRecord.efficiency || 0;
    const operators = currentRecord.totalOperator || 0;
    const absentCount = currentRecord.absent || 0;
    const absentPct = currentRecord.absentPct || 0;
    const presentPct = 100 - absentPct;

    // Compare with yesterday's record
    const targetVsYesterday = yesterdayRecord ? (yesterdayRecord.target || 0) : 0;
    const targetChange = targetVsYesterday > 0 ? parseFloat((((target - targetVsYesterday) / targetVsYesterday) * 100).toFixed(1)) : 0;

    const productionVsYesterday = yesterdayRecord ? (yesterdayRecord.totalProduction || 0) : 0;
    const productionChange = productionVsYesterday > 0 ? parseFloat((((production - productionVsYesterday) / productionVsYesterday) * 100).toFixed(1)) : 0;

    const achievementVsYesterday = yesterdayRecord ? (yesterdayRecord.efficiency || 0) : 0;
    const achievementChange = parseFloat(((achievement || 0) - (achievementVsYesterday || 0)).toFixed(1));

    const machineVsYesterday = yesterdayRecord ? (yesterdayRecord.runningMachine || 0) : 0;
    const machineChange = machineVsYesterday > 0 ? parseFloat((((runningMachines - machineVsYesterday) / machineVsYesterday) * 100).toFixed(1)) : 0;

    return {
      target,
      targetVsYesterday,
      targetChange: isNaN(targetChange) ? 0 : targetChange,
      production,
      productionVsYesterday,
      productionChange: isNaN(productionChange) ? 0 : productionChange,
      achievement: isNaN(achievement) ? 0 : achievement,
      achievementVsYesterday: isNaN(achievementVsYesterday) ? 0 : achievementVsYesterday,
      achievementChange: isNaN(achievementChange) ? 0 : achievementChange,
      totalMachines,
      runningMachines,
      idlePct: isNaN(idlePct) ? 0 : idlePct,
      machineVsYesterday,
      machineChange: isNaN(machineChange) ? 0 : machineChange,
      capacity,
      efficiency,
      operators,
      absentCount: isNaN(absentCount) ? 0 : absentCount,
      absentPct: isNaN(absentPct) ? 0 : absentPct,
      presentPct: isNaN(presentPct) ? 100 : presentPct
    };
  }

  // 4. If NO record exists for the selected date, return zero/empty metrics!
  // This honors the user's remark: "I don't have any data in 14 July 2026 in Production Ledger so how is the dashboard getting data."
  const defaultTotalMachines = {
    'EKL': 48,
    'EFL': 40,
    'EFL-2': 35,
    'Auto Stripe': 20,
    'EFL-Extension': 25,
    'ESL-Extension': 16,
    'Sub-Contact': 0
  }[ledgerFloorName] || 48;

  const defaultTotalOperators = {
    'EKL': 53,
    'EFL': 51,
    'EFL-2': 50,
    'Auto Stripe': 48,
    'EFL-Extension': 49,
    'ESL-Extension': 52,
    'Sub-Contact': 0
  }[ledgerFloorName] || 51;

  return {
    target: 0,
    targetVsYesterday: 0,
    targetChange: 0,
    production: 0,
    productionVsYesterday: 0,
    productionChange: 0,
    achievement: 0,
    achievementVsYesterday: 0,
    achievementChange: 0,
    totalMachines: defaultTotalMachines,
    runningMachines: 0,
    idlePct: 0,
    machineVsYesterday: 0,
    machineChange: 0,
    capacity: 0,
    efficiency: 0,
    operators: defaultTotalOperators,
    absentCount: 0,
    absentPct: 0,
    presentPct: 0
  };
};

export default function FloorDashboardView({ 
  floors, 
  selectedFloorId, 
  onSelectFloor,
  filterState,
  isLoading = false
}: FloorDashboardViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'idle' | 'warning'>('all');

  // Convert Floor Units
  const mapUnitToFloorId = (unit: string): string => {
    const mapping: Record<string, string> = {
      'EKL': 'ekl',
      'EFL': 'efl',
      'EFL-2': 'efl-2',
      'Auto Stripe': 'auto-stripe',
      'EFL-Extension': 'efl-ext',
      'ESL-Extension': 'esl-ext',
      'Sub-Contact': 'sub-contact'
    };
    return mapping[unit] || 'ekl';
  };

  const mapFloorIdToUnit = (floorId: string): string => {
    const mapping: Record<string, string> = {
      'ekl': 'EKL',
      'efl': 'EFL',
      'efl-2': 'EFL-2',
      'auto-stripe': 'Auto Stripe',
      'efl-ext': 'EFL-Extension',
      'esl-ext': 'ESL-Extension',
      'sub-contact': 'Sub-Contact'
    };
    return mapping[floorId] || 'EKL';
  };

  const mapFloorIdToSubName = (floorId: string): string => {
    const mapping: Record<string, string> = {
      'ekl': 'Epyllion Knitting LTD.-(EKL Main Floor)',
      'efl': 'Epyllion Fabrics LTD.-(Floor 1)',
      'efl-2': 'Epyllion Fabrics LTD.-(Floor 2)',
      'auto-stripe': 'Epyllion Fabrics LTD.-(Auto Stripe)',
      'efl-ext': 'Epyllion Fabrics LTD.-(EFL Extension)',
      'esl-ext': 'ESL-Extension Knitting Unit-(ESL Extension)',
      'sub-contact': 'Sub-Contact Knitting Unit'
    };
    return mapping[floorId] || 'Epyllion Knitting LTD.-(EKL Main Floor)';
  };

  const fullFloors = [...floors];
  if (!fullFloors.some(f => f.id === 'sub-contact')) {
    fullFloors.push({
      id: 'sub-contact',
      name: 'Sub-Contact',
      longName: 'Sub-Contact Knitting Unit',
      status: 'warning',
      targetKg: 8000,
      productionKg: 7420,
      achievementPct: 92.8,
      runningMachines: 12,
      totalMachines: 14,
      idleMachines: 2,
      efficiencyPct: 90.2,
      rejectPct: 1.5,
      lastUpdated: '1 hour ago'
    });
  }

  // Local state for interactive Floor Dropdown
  const [floorDropdownOpen, setFloorDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  
  // Local active floor (syncs on prop change, but can be updated locally)
  const [localFloorId, setLocalFloorId] = useState<string>(selectedFloorId || 'ekl');
  
  // Date modes: 'dates' | 'months' | 'year'
  const [localDateMode, setLocalDateMode] = useState<'dates' | 'months' | 'year'>('dates');
  
  // Multi-date selection (array of selected date strings)
  const [selectedDates, setSelectedDates] = useState<string[]>(() => [getRelativeDateString(1)]);
  const [dateInputVal, setDateInputVal] = useState<string>(() => getRelativeDateString(1));
  
  // Multi-month selection (array of selected months like 'YYYY-MM')
  const [selectedMonths, setSelectedMonths] = useState<string[]>(() => [getRelativeDateString(1).substring(0, 7)]);
  const [monthInputVal, setMonthInputVal] = useState<string>(() => getRelativeDateString(1).substring(0, 7));
  
  // Year selection
  const [selectedYear, setSelectedYear] = useState<string>(() => getRelativeDateString(1).substring(0, 4));

  // Sync state if default changes
  React.useEffect(() => {
    if (selectedFloorId) {
      setLocalFloorId(selectedFloorId);
    }
  }, [selectedFloorId]);

  React.useEffect(() => {
    if (filterState?.singleDate) {
      setSelectedDates([filterState.singleDate]);
      setDateInputVal(filterState.singleDate);
    }
    if (filterState?.month) {
      setSelectedMonths([filterState.month]);
      setMonthInputVal(filterState.month);
    }
    if (filterState?.year) {
      setSelectedYear(filterState.year);
    }
    if (filterState?.dateMode) {
      if (filterState.dateMode === 'single' || filterState.dateMode === 'range') {
        setLocalDateMode('dates');
        if (filterState.dateMode === 'range') {
          setSelectedDates([filterState.dateFrom, filterState.dateTo]);
        }
      } else if (filterState.dateMode === 'month') {
        setLocalDateMode('months');
      } else if (filterState.dateMode === 'year') {
        setLocalDateMode('year');
      }
    }
  }, [filterState]);

  const handleFloorChange = (floorId: string) => {
    setLocalFloorId(floorId);
    onSelectFloor(floorId);
  };

  // Helper to aggregate metrics over multiple dates
  const aggregateMetrics = (floorId: string, dateStrings: string[]) => {
    const dates = dateStrings.length > 0 ? dateStrings : ['2026-06-28'];
    const results = dates.map(d => getMetricsForUnitAndDate(floorId, d));
    
    const totalTarget = results.reduce((sum, r) => sum + (r.target || 0), 0);
    const totalProduction = results.reduce((sum, r) => sum + (r.production || 0), 0);
    const totalTargetVsYesterday = results.reduce((sum, r) => sum + (r.targetVsYesterday || 0), 0);
    const totalProductionVsYesterday = results.reduce((sum, r) => sum + (r.productionVsYesterday || 0), 0);
    const totalRunningMachines = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.runningMachines || 0), 0) / results.length) : 0;
    const avgCapacity = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.capacity || 0), 0) / results.length) : 0;
    const avgEfficiency = results.length > 0 ? Math.round(results.reduce((sum, r) => sum + (r.efficiency || 0), 0) / results.length) : 0;
    const avgAbsentPct = results.length > 0 ? results.reduce((sum, r) => sum + (r.absentPct || 0), 0) / results.length : 0;
    const avgPresentPct = 100 - (avgAbsentPct || 0);
    const operators = results[0]?.operators || 20;
    
    const targetChange = totalTargetVsYesterday > 0 
      ? parseFloat((((totalTarget - totalTargetVsYesterday) / totalTargetVsYesterday) * 100).toFixed(1))
      : 0;
    const productionChange = totalProductionVsYesterday > 0
      ? parseFloat((((totalProduction - totalProductionVsYesterday) / totalProductionVsYesterday) * 100).toFixed(1))
      : 0;
    
    const achievement = totalTarget > 0 ? parseFloat(((totalProduction / totalTarget) * 100).toFixed(2)) : 0;
    const achievementVsYesterday = totalTargetVsYesterday > 0 ? parseFloat(((totalProductionVsYesterday / totalTargetVsYesterday) * 100).toFixed(2)) : 0;
    const achievementChange = parseFloat(((achievement || 0) - (achievementVsYesterday || 0)).toFixed(1));

    const totalMacs = results[0]?.totalMachines || 12;
    const idlePctVal = totalMacs > 0 ? parseFloat((((totalMacs - totalRunningMachines) / totalMacs) * 100).toFixed(2)) : 0;

    return {
      target: totalTarget,
      targetVsYesterday: totalTargetVsYesterday,
      targetChange: isNaN(targetChange) ? 0 : targetChange,
      production: totalProduction,
      productionVsYesterday: totalProductionVsYesterday,
      productionChange: isNaN(productionChange) ? 0 : productionChange,
      achievement: isNaN(achievement) ? 0 : achievement,
      achievementVsYesterday: isNaN(achievementVsYesterday) ? 0 : achievementVsYesterday,
      achievementChange: isNaN(achievementChange) ? 0 : achievementChange,
      totalMachines: totalMacs,
      runningMachines: totalRunningMachines,
      idlePct: isNaN(idlePctVal) ? 0 : idlePctVal,
      machineVsYesterday: results[0]?.machineVsYesterday || 10,
      machineChange: 0,
      capacity: avgCapacity,
      efficiency: avgEfficiency,
      operators: operators,
      absentCount: isNaN(Math.round(((avgAbsentPct || 0) / 100) * operators)) ? 0 : Math.round(((avgAbsentPct || 0) / 100) * operators),
      absentPct: isNaN(avgAbsentPct) ? 0 : parseFloat((avgAbsentPct || 0).toFixed(2)),
      presentPct: isNaN(avgPresentPct) ? 100 : parseFloat((avgPresentPct || 100).toFixed(2))
    };
  };

  const currentFloor = fullFloors.find(f => f.id === localFloorId) || fullFloors[0];

  // Derive active date list based on mode
  const activeDates = React.useMemo(() => {
    if (localDateMode === 'dates') {
      if (selectedDates.length === 0) {
        return ['2026-06-28'];
      }
      if (selectedDates.length === 1) {
        return selectedDates;
      }
      // Sort to find the chronological start and end date
      const sorted = [...selectedDates].sort();
      const firstStr = sorted[0];
      const lastStr = sorted[sorted.length - 1];
      
      const parseLocalDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      
      const startDate = parseLocalDate(firstStr);
      const endDate = parseLocalDate(lastStr);
      
      const datesList: string[] = [];
      let current = new Date(startDate);
      let safetyCounter = 0;
      
      while (current <= endDate && safetyCounter < 366) {
        const yyyy = current.getFullYear();
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const dd = String(current.getDate()).padStart(2, '0');
        datesList.push(`${yyyy}-${mm}-${dd}`);
        
        current.setDate(current.getDate() + 1);
        safetyCounter++;
      }
      return datesList;
    } else if (localDateMode === 'months') {
      const dates: string[] = [];
      selectedMonths.forEach(m => {
        dates.push(`${m}-28`);
        dates.push(`${m}-15`);
        dates.push(`${m}-05`);
      });
      return dates.length > 0 ? dates : ['2026-06-28'];
    } else {
      return [`${selectedYear}-06-28`, `${selectedYear}-05-28`, `${selectedYear}-04-28`, `${selectedYear}-03-28`].map(d => d);
    }
  }, [localDateMode, selectedDates, selectedMonths, selectedYear]);

  // Primary raw date string used for 7-day labels chart seed (just the first date in selection)
  const rawDateStr = activeDates[0] || '2026-06-28';

  const formatDateForHeader = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '28-Jun-2026';
      const day = d.getDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[d.getMonth()];
      const year = d.getFullYear();
      return `${day < 10 ? '0' + day : day}-${month}-${year}`;
    } catch {
      return '28-Jun-2026';
    }
  };

  const getMonthName = (monthStr: string) => {
    try {
      const [y, m] = monthStr.split('-');
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const idx = parseInt(m, 10) - 1;
      return `${monthNames[idx]} ${y}`;
    } catch {
      return monthStr;
    }
  };

  const headerDateStr = React.useMemo(() => {
    if (localDateMode === 'dates') {
      if (selectedDates.length === 1) {
        return formatDateForHeader(selectedDates[0]);
      } else if (selectedDates.length > 1) {
        const sorted = [...selectedDates].sort();
        const startFormatted = formatDateForHeader(sorted[0]);
        const endFormatted = formatDateForHeader(sorted[sorted.length - 1]);
        return `${startFormatted} to ${endFormatted} (${activeDates.length} Days)`;
      }
      return '28-Jun-2026';
    } else if (localDateMode === 'months') {
      if (selectedMonths.length === 1) {
        return getMonthName(selectedMonths[0]);
      } else if (selectedMonths.length > 1) {
        return `${selectedMonths.length} Months [${selectedMonths.map(m => getMonthName(m).split(' ')[0]).join(', ')}]`;
      }
      return 'June 2026';
    } else {
      return `Year ${selectedYear}`;
    }
  }, [localDateMode, selectedDates, selectedMonths, selectedYear, activeDates]);

  // Dynamically aggregate metric values
  const metrics = React.useMemo(() => {
    return aggregateMetrics(currentFloor.id, activeDates);
  }, [currentFloor.id, activeDates]);

  // Dynamic timeline dataset generator based on date-wise / month-wise selections
  const chartDataSets = React.useMemo(() => {
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Default image dataset values for Auto Stripe & 28-Jun-2026
    const isImage = (currentFloor.id === 'auto-stripe');
    if (isImage && localDateMode === 'dates' && selectedDates.length === 1 && selectedDates[0] === '2026-06-28') {
      return {
        labels: ['22-JUN', '23-JUN', '24-JUN', '25-JUN', '26-JUN', '27-JUN', '28-JUN'],
        productionData: [
          { label: '22-JUN', target: 848, actual: 675 },
          { label: '23-JUN', target: 1057, actual: 613 },
          { label: '24-JUN', target: 1028, actual: 780 },
          { label: '25-JUN', target: 946, actual: 747 },
          { label: '26-JUN', target: 874, actual: 643 },
          { label: '27-JUN', target: 721, actual: 481 },
          { label: '28-JUN', target: 984, actual: 751 }
        ],
        holdData: [0.00, 0.00, 4.23, 0.00, 0.00, 0.00, 0.00],
        rejectData: [0.00, 0.57, 0.47, 0.00, 0.58, 0.00, 0.00],
        efficiencyData: [58.49, 53.12, 67.59, 64.73, 55.72, 41.68, 65.08],
        capacityData: [
          { label: '22-JUN', value: 70 },
          { label: '23-JUN', value: 70 },
          { label: '24-JUN', value: 70 },
          { label: '25-JUN', value: 80 },
          { label: '26-JUN', value: 70 },
          { label: '27-JUN', value: 70 },
          { label: '28-JUN', value: 80 }
        ],
        needles: [26, 7, 17, 17, 19, 36, 14],
        sinkers: [0, 0, 0, 0, 3, 0, 0],
        oils: [2.5, 1.2, 2.9, 2.0, 2.9, 1.2, 3.2],
        setChanges: [0, 0, 0, 0, 0, 0, 0]
      };
    }

    if (localDateMode === 'dates') {
      // If only 1 date is selected, show 7-day trend leading up to that date
      if (selectedDates.length === 1) {
        const end = new Date(selectedDates[0]);
        const labels: string[] = [];
        const dateStrings: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(end);
          d.setDate(end.getDate() - i);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const dateStr = `${yyyy}-${mm}-${dd}`;
          dateStrings.push(dateStr);
          
          const day = d.getDate();
          const month = monthsShort[d.getMonth()].toUpperCase();
          labels.push(`${day < 10 ? '0' + day : day}-${month}`);
        }
        
        // Fetch real data from the production ledger for each date
        const productionData = labels.map((label, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]);
          return { label, target: m.target, actual: m.production };
        });
        const holdData = labels.map((_, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]);
          return parseFloat(((m.production % 13) / 4).toFixed(2));
        });
        const rejectData = labels.map((_, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]);
          return parseFloat((0.8 + (m.production % 7) * 0.3).toFixed(2));
        });
        const efficiencyData = labels.map((_, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]);
          return m.efficiency;
        });
        const capacityData = labels.map((label, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]);
          return { label, value: m.capacity };
        });

        return {
          labels,
          productionData,
          holdData,
          rejectData,
          efficiencyData,
          capacityData,
          needles: labels.map((_, i) => Math.round(10 + (getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]).production % 25))),
          sinkers: labels.map((_, i) => (getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]).production % 8 === 0 ? 3 : 0)),
          oils: labels.map((_, i) => parseFloat((1.5 + (getMetricsForUnitAndDate(currentFloor.id, dateStrings[i]).production % 4) * 0.5).toFixed(1))),
          setChanges: labels.map(() => 0)
        };
      } else {
        // Multiple dates (all dates in activeDates range)
        const sortedDates = [...activeDates].sort();
        const labels = sortedDates.map(dateStr => {
          const d = new Date(dateStr);
          const day = d.getDate();
          const month = monthsShort[d.getMonth()].toUpperCase();
          return `${day < 10 ? '0' + day : day}-${month}`;
        });
        
        const productionData = labels.map((label, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]);
          return { label, target: m.target, actual: m.production };
        });
        const holdData = labels.map((_, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]);
          return parseFloat(((m.production % 13) / 4).toFixed(2));
        });
        const rejectData = labels.map((_, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]);
          return parseFloat((0.8 + (m.production % 7) * 0.3).toFixed(2));
        });
        const efficiencyData = labels.map((_, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]);
          return m.efficiency;
        });
        const capacityData = labels.map((label, i) => {
          const m = getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]);
          return { label, value: m.capacity };
        });

        return {
          labels,
          productionData,
          holdData,
          rejectData,
          efficiencyData,
          capacityData,
          needles: labels.map((_, i) => Math.round(10 + (getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]).production % 25))),
          sinkers: labels.map((_, i) => (getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]).production % 8 === 0 ? 3 : 0)),
          oils: labels.map((_, i) => parseFloat((1.5 + (getMetricsForUnitAndDate(currentFloor.id, sortedDates[i]).production % 4) * 0.5).toFixed(1))),
          setChanges: labels.map(() => 0)
        };
      }
    } else if (localDateMode === 'months') {
      let targetMonths = [...selectedMonths].sort();
      if (targetMonths.length === 1) {
        const [year, month] = targetMonths[0].split('-').map(Number);
        const list: string[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(year, month - 1 - i, 1);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          list.push(`${yyyy}-${mm}`);
        }
        targetMonths = list;
      }
      
      const labels = targetMonths.map(mStr => {
        const [yyyy, mm] = mStr.split('-');
        const mIdx = parseInt(mm, 10) - 1;
        return `${monthsShort[mIdx]} ${yyyy.substring(2)}`;
      });

      const getMonthAggregatedMetrics = (floorId: string, yearMonthStr: string) => {
        const sampleDays = ['05', '12', '19', '26'];
        const dates = sampleDays.map(d => `${yearMonthStr}-${d}`);
        const results = dates.map(dt => getMetricsForUnitAndDate(floorId, dt));
        
        const avgTarget = Math.round(results.reduce((s, r) => s + r.target, 0) / results.length);
        const avgProduction = Math.round(results.reduce((s, r) => s + r.production, 0) / results.length);
        const avgHold = results.reduce((s, r) => s + ((r.production % 13) / 4), 0) / results.length;
        const avgReject = results.reduce((s, r) => s + (0.8 + (r.production % 7) * 0.3), 0) / results.length;
        const avgEfficiency = Math.round(results.reduce((s, r) => s + r.efficiency, 0) / results.length);
        const avgCapacity = Math.round(results.reduce((s, r) => s + r.capacity, 0) / results.length);

        return {
          target: avgTarget,
          production: avgProduction,
          hold: parseFloat(avgHold.toFixed(2)),
          reject: parseFloat(avgReject.toFixed(2)),
          efficiency: avgEfficiency,
          capacity: avgCapacity
        };
      };

      const monthlyMetrics = targetMonths.map(mStr => getMonthAggregatedMetrics(currentFloor.id, mStr));

      const productionData = labels.map((label, i) => ({
        label,
        target: monthlyMetrics[i].target,
        actual: monthlyMetrics[i].production
      }));
      const holdData = monthlyMetrics.map(m => m.hold);
      const rejectData = monthlyMetrics.map(m => m.reject);
      const efficiencyData = monthlyMetrics.map(m => m.efficiency);
      const capacityData = labels.map((label, i) => ({ label, value: monthlyMetrics[i].capacity }));

      return {
        labels,
        productionData,
        holdData,
        rejectData,
        efficiencyData,
        capacityData,
        needles: labels.map((_, i) => Math.round(80 + (monthlyMetrics[i].production % 40))),
        sinkers: labels.map((_, i) => Math.round(10 + (monthlyMetrics[i].production % 15))),
        oils: labels.map((_, i) => parseFloat((15.5 + (monthlyMetrics[i].production % 10) * 0.8).toFixed(1))),
        setChanges: labels.map(() => 0)
      };

    } else {
      // Year mode: Show 12 months for selectedYear
      const list: string[] = [];
      for (let i = 1; i <= 12; i++) {
        const mm = String(i).padStart(2, '0');
        list.push(`${selectedYear}-${mm}`);
      }

      const labels = list.map((_, i) => monthsShort[i]);

      const getMonthAggregatedMetrics = (floorId: string, yearMonthStr: string) => {
        const sampleDays = ['05', '12', '19', '26'];
        const dates = sampleDays.map(d => `${yearMonthStr}-${d}`);
        const results = dates.map(dt => getMetricsForUnitAndDate(floorId, dt));
        
        const avgTarget = Math.round(results.reduce((s, r) => s + r.target, 0) / results.length);
        const avgProduction = Math.round(results.reduce((s, r) => s + r.production, 0) / results.length);
        const avgHold = results.reduce((s, r) => s + ((r.production % 13) / 4), 0) / results.length;
        const avgReject = results.reduce((s, r) => s + (0.8 + (r.production % 7) * 0.3), 0) / results.length;
        const avgEfficiency = Math.round(results.reduce((s, r) => s + r.efficiency, 0) / results.length);
        const avgCapacity = Math.round(results.reduce((s, r) => s + r.capacity, 0) / results.length);

        return {
          target: avgTarget,
          production: avgProduction,
          hold: parseFloat(avgHold.toFixed(2)),
          reject: parseFloat(avgReject.toFixed(2)),
          efficiency: avgEfficiency,
          capacity: avgCapacity
        };
      };

      const monthlyMetrics = list.map(mStr => getMonthAggregatedMetrics(currentFloor.id, mStr));

      const productionData = labels.map((label, i) => ({
        label,
        target: monthlyMetrics[i].target,
        actual: monthlyMetrics[i].production
      }));
      const holdData = monthlyMetrics.map(m => m.hold);
      const rejectData = monthlyMetrics.map(m => m.reject);
      const efficiencyData = monthlyMetrics.map(m => m.efficiency);
      const capacityData = labels.map((label, i) => ({ label, value: monthlyMetrics[i].capacity }));

      return {
        labels,
        productionData,
        holdData,
        rejectData,
        efficiencyData,
        capacityData,
        needles: labels.map((_, i) => Math.round(80 + (monthlyMetrics[i].production % 40))),
        sinkers: labels.map((_, i) => Math.round(10 + (monthlyMetrics[i].production % 15))),
        oils: labels.map((_, i) => parseFloat((15.5 + (monthlyMetrics[i].production % 10) * 0.8).toFixed(1))),
        setChanges: labels.map(() => 0)
      };
    }
  }, [localDateMode, selectedDates, selectedMonths, selectedYear, activeDates, currentFloor.id]);

  // Machine metrics drilldown array
  const getFloorMachines = (floorId: string): KnittingMachine[] => {
    return MACHINE_TEMPLATES.map((m, index) => {
      let finalStatus = m.status;
      let finalRpm = m.rpm;
      let finalEfficiency = m.efficiency;
      let stopReason = m.stopReason;

      let mSeed = 0;
      const combined = `${floorId}_m_${index}_${rawDateStr}`;
      for (let i = 0; i < combined.length; i++) {
        mSeed = combined.charCodeAt(i) + ((mSeed << 5) - mSeed);
      }
      mSeed = Math.abs(mSeed);

      if (floorId === 'efl-ext' && (index === 2 || index === 4 || index === 7)) {
        finalStatus = 'stopped';
        finalRpm = 0;
        finalEfficiency = 30;
        stopReason = 'Lycra feed break';
      } else if (floorId === 'efl-2' && index === 5) {
        finalStatus = 'idle';
        finalRpm = 0;
        finalEfficiency = 70;
        stopReason = 'Clean and oiling';
      } else if (floorId === 'sub-contact' && (index === 3 || index === 6)) {
        finalStatus = 'idle';
        finalRpm = 0;
        finalEfficiency = 65;
        stopReason = 'Yarn shortage';
      } else if (m.status === 'running') {
        finalRpm = Math.max(16, Math.min(24, Math.round(m.rpm + (mSeed % 3) - 1)));
        finalEfficiency = parseFloat(Math.min(100, Math.max(78, m.efficiency + (mSeed % 5) - 2)).toFixed(1));
      }

      return {
        ...m,
        status: finalStatus,
        rpm: finalRpm,
        efficiency: finalEfficiency,
        stopReason
      };
    });
  };

  const machines = getFloorMachines(currentFloor.id);

  const filteredMachines = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          m.fabricType.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (m.stopReason && m.stopReason.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'running') return matchesSearch && m.status === 'running';
    if (statusFilter === 'idle') return matchesSearch && m.status === 'idle';
    if (statusFilter === 'warning') return matchesSearch && (m.status === 'stopped' || m.status === 'maintenance');
    return matchesSearch;
  });

  // Calculate dynamic line chart metrics headers and text label
  const timelineLabel = React.useMemo(() => {
    if (localDateMode === 'dates') {
      if (selectedDates.length === 1) {
        return 'Last 7 Days';
      } else {
        return 'Selected Period';
      }
    } else if (localDateMode === 'months') {
      if (selectedMonths.length === 1) {
        return 'Last 6 Months';
      } else {
        return 'Selected Months';
      }
    } else {
      return `Year ${selectedYear}`;
    }
  }, [localDateMode, selectedDates, selectedMonths, selectedYear]);

  const totalHold = chartDataSets.holdData.reduce((sum, v) => sum + v, 0);
  const totalReject = chartDataSets.rejectData.reduce((sum, v) => sum + v, 0);

  // Shimmer skeleton loading
  if (isLoading) {
    return (
      <div className="space-y-6" id="floor-dashboard-loading-skeleton">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-150 pb-3">
          <div className="space-y-2">
            <div className="h-6 w-56 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-40 rounded bg-gray-150 animate-pulse" />
          </div>
          <div className="h-10 w-64 rounded bg-gray-200 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-gray-100 animate-pulse border border-gray-200 p-4" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-xl bg-gray-100 animate-pulse border" />
          <div className="h-64 rounded-xl bg-gray-100 animate-pulse border" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="floor-dashboard-console-panel">
      {/* 1. Floor Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-2.5">
        <div>
          <h2 className="font-sans text-xl font-black tracking-tight text-gray-900 dark:text-slate-100" id="floor-dashboard-heading">
            Floor wise Production Monitoring Dashboard
          </h2>
          <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
            Consolidated Knitting performance and secondary element updates.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Floor Selection Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setFloorDropdownOpen(!floorDropdownOpen);
                setDateDropdownOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-extrabold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
            >
              <Building2 className="h-4 w-4 text-[#0F4C81] dark:text-blue-400" />
              <span>Unit: <strong className="text-gray-900 dark:text-white font-black">{currentFloor.name}</strong></span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {floorDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFloorDropdownOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-xl z-20 animate-fade-in">
                  <div className="px-2 py-1.5 border-b border-gray-50 dark:border-slate-700 mb-1.5">
                    <span className="text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-wider">Select Factory Floor</span>
                  </div>
                  <div className="space-y-0.5 max-h-60 overflow-y-auto scrollbar-none">
                    {fullFloors.map((f) => {
                      const isSelected = f.id === currentFloor.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => {
                            handleFloorChange(f.id);
                            setFloorDropdownOpen(false);
                          }}
                          className={`w-full rounded-lg px-2.5 py-2 text-xs font-semibold text-left flex items-center justify-between transition ${
                            isSelected 
                              ? 'bg-blue-50 dark:bg-blue-950/50 text-[#0F4C81] dark:text-blue-300 font-bold' 
                              : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-[11px]">{f.name}</span>
                            <span className="text-[9px] text-gray-400 dark:text-slate-500 truncate max-w-[180px]">{f.longName}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Date Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setDateDropdownOpen(!dateDropdownOpen);
                setFloorDropdownOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-extrabold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition shadow-2xs cursor-pointer"
            >
              <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Period: <strong className="text-gray-900 dark:text-white font-black">{headerDateStr}</strong></span>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {dateDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDateDropdownOpen(false)} />
                <div className="absolute right-0 mt-1.5 w-80 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-xl z-20 animate-fade-in max-h-[420px] overflow-y-auto scrollbar-none">
                  
                  {/* Mode Selector Tabs inside Date Dropdown */}
                  <div className="flex rounded-lg bg-gray-100 dark:bg-slate-900 p-0.5 border border-gray-250/20 mb-3">
                    {(['dates', 'months', 'year'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setLocalDateMode(mode)}
                        className={`flex-1 rounded-md py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                          localDateMode === mode
                            ? 'bg-white dark:bg-slate-700 text-blue-950 dark:text-white shadow-xs'
                            : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        {mode === 'dates' ? 'Multiple Dates' : mode === 'months' ? 'Months' : 'Year'}
                      </button>
                    ))}
                  </div>

                  {/* Mode Content: MULTIPLE DATES */}
                  {localDateMode === 'dates' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Add Date to Selection
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={dateInputVal}
                            onChange={(e) => setDateInputVal(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-250 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (dateInputVal && !selectedDates.includes(dateInputVal)) {
                                setSelectedDates([...selectedDates, dateInputVal]);
                              }
                            }}
                            className="rounded-lg bg-[#0F4C81] dark:bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800 transition cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Quick presets for multiple dates */}
                      <div>
                        <span className="block text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">Quick Presets</span>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDates([getRelativeDateString(1)]);
                            }}
                            className="rounded px-2 py-0.5 text-[9px] font-black bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-250 cursor-pointer"
                          >
                            Yesterday's Production
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDates([
                                getRelativeDateString(1),
                                getRelativeDateString(2),
                                getRelativeDateString(3)
                              ]);
                            }}
                            className="rounded px-2 py-0.5 text-[9px] font-black bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-250 cursor-pointer"
                          >
                            Last 3 Days
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDates([
                                getRelativeDateString(1),
                                getRelativeDateString(2),
                                getRelativeDateString(3),
                                getRelativeDateString(4),
                                getRelativeDateString(5),
                                getRelativeDateString(6),
                                getRelativeDateString(7)
                              ]);
                            }}
                            className="rounded px-2 py-0.5 text-[9px] font-black bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-250 cursor-pointer"
                          >
                            Last 7 Days
                          </button>
                        </div>
                      </div>

                      {/* Active Selected Dates List */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="block text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                            Selected Dates ({selectedDates.length})
                          </span>
                          {selectedDates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSelectedDates([getRelativeDateString(1)])}
                              className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                        {selectedDates.length > 1 && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mb-1.5 leading-tight bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30">
                            Note: Collects all {activeDates.length} days from {formatDateForHeader(activeDates[0])} to {formatDateForHeader(activeDates[activeDates.length - 1])}.
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border border-gray-100 dark:border-slate-800 p-1.5 rounded-lg bg-gray-50/50 dark:bg-slate-900/20">
                          {selectedDates.map((dateStr) => (
                            <span 
                              key={dateStr}
                              className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/30 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300"
                            >
                              <span>{formatDateForHeader(dateStr)}</span>
                              <button 
                                type="button" 
                                onClick={() => {
                                  if (selectedDates.length > 1) {
                                    setSelectedDates(selectedDates.filter(d => d !== dateStr));
                                  }
                                }}
                                className="text-blue-400 hover:text-red-500 cursor-pointer"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode Content: MONTHS */}
                  {localDateMode === 'months' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Add Month to Selection
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="month"
                            value={monthInputVal}
                            onChange={(e) => setMonthInputVal(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-250 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-900/40 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (monthInputVal && !selectedMonths.includes(monthInputVal)) {
                                setSelectedMonths([...selectedMonths, monthInputVal]);
                              }
                            }}
                            className="rounded-lg bg-[#0F4C81] dark:bg-blue-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-blue-800 transition cursor-pointer"
                          >
                            Add
                          </button>
                        </div>
                      </div>

                      {/* Active Selected Months List */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="block text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                            Selected Months ({selectedMonths.length})
                          </span>
                          {selectedMonths.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setSelectedMonths(['2026-06'])}
                              className="text-[9px] font-bold text-red-500 hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto border border-gray-100 dark:border-slate-800 p-1.5 rounded-lg bg-gray-50/50 dark:bg-slate-900/20">
                          {selectedMonths.map((mStr) => (
                            <span 
                              key={mStr}
                              className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300"
                            >
                              <span>{getMonthName(mStr)}</span>
                              <button 
                                type="button" 
                                onClick={() => {
                                  if (selectedMonths.length > 1) {
                                    setSelectedMonths(selectedMonths.filter(m => m !== mStr));
                                  }
                                }}
                                className="text-emerald-400 hover:text-red-500 cursor-pointer"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Mode Content: YEAR */}
                  {localDateMode === 'year' && (
                    <div className="space-y-3">
                      <div>
                        <span className="block text-[10px] font-extrabold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-2">Select Active Year</span>
                        <div className="space-y-1.5">
                          {['2026', '2025', '2024'].map((yr) => (
                            <button
                              key={yr}
                              type="button"
                              onClick={() => setSelectedYear(yr)}
                              className={`w-full rounded-lg px-3 py-2 text-xs font-bold text-left flex items-center justify-between transition ${
                                selectedYear === yr 
                                  ? 'bg-blue-50 dark:bg-blue-950/50 text-[#0F4C81] dark:text-blue-300' 
                                  : 'text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700/50'
                              }`}
                            >
                              <span>Year {yr}</span>
                              {selectedYear === yr && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dropdown Footer Actions */}
                  <div className="mt-4 pt-2.5 border-t border-gray-100 dark:border-slate-800 flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setDateDropdownOpen(false)}
                      className="rounded-lg bg-[#0F4C81] hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 px-4 py-1.5 text-[10px] font-extrabold text-white transition shadow-sm cursor-pointer"
                    >
                      Apply Period
                    </button>
                  </div>
                  
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. Main Epyllion Style Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-2 border-slate-700 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-xs gap-4">
        {/* Logo and performance heading */}
        <div className="flex items-center gap-2">
          <EpyllionLogo />
          <div className="border-l-2 border-slate-300 pl-4 py-1">
            <h3 className="font-sans text-lg font-black tracking-tight text-slate-800 dark:text-slate-100 leading-snug">
              Knitting Floor Performance of {headerDateStr}
            </h3>
          </div>
        </div>

        {/* Corporate Address & Subtitle */}
        <div className="text-left md:text-right font-sans">
          <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
            {mapFloorIdToSubName(currentFloor.id)}
          </h4>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-sm leading-normal font-medium">
            Janglia Para (Bangla Bazar), Vawal, Mirzapur | Gazipur Sadar | Gazipur - I703 | Bangladesh
          </p>
        </div>
      </div>

      {/* 3. Double-Border KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5" id="epyllion-kpis-container">
        
        {/* KPI 1: Target (Kg) */}
        <div className="border border-[#FF5B5B] bg-white dark:bg-slate-900 rounded-lg p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-red-50 dark:bg-red-950/20 text-[#FF5B5B]">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
            <span className="text-xs font-black text-[#FF5B5B] uppercase tracking-wider">Target (Kg)</span>
          </div>
          <div className="my-2.5 text-center">
            <span className="font-mono text-3xl font-black text-slate-800 dark:text-slate-100 leading-none">
              {metrics.target}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] border-t border-gray-100 dark:border-slate-800 pt-1.5">
            <span className="font-bold text-slate-500">VS Yesterday <strong className="font-semibold text-slate-800 dark:text-slate-200">{metrics.targetVsYesterday}</strong></span>
            <span className="inline-flex items-center font-black text-[#27AE60]">
              ▲ {metrics.targetChange}%
            </span>
          </div>
        </div>

        {/* KPI 2: Production (Kg) */}
        <div className="border border-[#2ECC71] bg-white dark:bg-slate-900 rounded-lg p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/20 text-[#2ECC71]">
              <CheckCircle className="h-4.5 w-4.5" />
            </div>
            <span className="text-xs font-black text-[#2ECC71] uppercase tracking-wider">Production (Kg)</span>
          </div>
          <div className="my-2.5 text-center">
            <span className="font-mono text-3xl font-black text-slate-800 dark:text-slate-100 leading-none">
              {metrics.production}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] border-t border-gray-100 dark:border-slate-800 pt-1.5">
            <span className="font-bold text-slate-500">VS Yesterday <strong className="font-semibold text-slate-800 dark:text-slate-200">{metrics.productionVsYesterday}</strong></span>
            <span className="inline-flex items-center font-black text-[#27AE60]">
              ▲ {metrics.productionChange}%
            </span>
          </div>
        </div>

        {/* KPI 3: Achievement (%) */}
        <div className="border border-[#E67E22] bg-white dark:bg-slate-900 rounded-lg p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-orange-50 dark:bg-orange-950/20 text-[#E67E22]">
              <Percent className="h-4.5 w-4.5" />
            </div>
            <span className="text-xs font-black text-[#E67E22] uppercase tracking-wider">Achievement (%)</span>
          </div>
          <div className="my-2.5 text-center">
            <span className="font-mono text-3xl font-black text-slate-800 dark:text-slate-100 leading-none">
              {metrics.achievement}%
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] border-t border-gray-100 dark:border-slate-800 pt-1.5">
            <span className="font-bold text-slate-500">VS Yesterday <strong className="font-semibold text-slate-800 dark:text-slate-200">{metrics.achievementVsYesterday}%</strong></span>
            <span className="inline-flex items-center font-black text-[#E67E22]">
              ▲ {metrics.achievementChange}%
            </span>
          </div>
        </div>

        {/* KPI 4: Total Machine */}
        <div className="border border-[#3498DB] bg-white dark:bg-slate-900 rounded-lg p-3.5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/20 text-[#3498DB]">
              <Cpu className="h-4.5 w-4.5" />
            </div>
            <span className="text-xs font-black text-[#3498DB] uppercase tracking-wider">Total Machine</span>
          </div>
          <div className="my-1.5 text-center">
            <span className="font-mono text-xl font-black text-slate-800 dark:text-slate-100 block">
              {metrics.totalMachines} PCS
            </span>
            <div className="flex items-center justify-center gap-2 mt-1 text-[9px] font-bold uppercase tracking-wide">
              <span className="flex items-center gap-1 text-[#3498DB]">
                <Play className="h-2 w-2 fill-current" /> Run {metrics.runningMachines} PCS
              </span>
              <span className="text-red-500">
                Idle {metrics.idlePct.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] border-t border-gray-100 dark:border-slate-800 pt-1.5">
            <span className="font-bold text-slate-500">VS Yesterday <strong className="font-semibold text-slate-800 dark:text-slate-200">{metrics.machineVsYesterday} PCS</strong></span>
            <span className="inline-flex items-center font-black text-blue-600">
              ▲ {metrics.machineChange}%
            </span>
          </div>
        </div>

        {/* KPI 5: Capacity Utilization Gauge */}
        <div className="border border-[#27AE60] bg-white dark:bg-slate-900 rounded-lg p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-50 dark:border-slate-800">
            <span className="text-[10px] font-black text-[#27AE60] uppercase tracking-wider">Capacity Utilization</span>
          </div>
          <div className="mt-2 flex items-center justify-center">
            <SemiCircleGauge value={metrics.capacity} color="#F1C40F" max={100} />
          </div>
        </div>

        {/* KPI 6: Efficiency Gauge */}
        <div className="border border-slate-700 bg-white dark:bg-slate-900 rounded-lg p-3 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-gray-50 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">Efficiency</span>
          </div>
          <div className="mt-2 flex items-center justify-center">
            <SemiCircleGauge value={metrics.efficiency} color="#7F8C8D" max={100} />
          </div>
        </div>

      </div>

      {/* 4. Charts Block Row 1 (Production Timeline vs Hold & Reject Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" id="charts-row-1">
        
        {/* Chart 1: Production Timeline */}
        <div className="border border-slate-700 rounded-xl overflow-hidden shadow-xs flex flex-col bg-white dark:bg-slate-900">
          <div className="bg-[#2E4A62] text-white text-center py-2 px-3 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
            <span>{timelineLabel} Production Timeline</span>
          </div>
          <div className="p-4 flex-1">
            {/* Custom chart legend */}
            <div className="flex items-center gap-4 mb-3 text-xs font-bold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-[#0E6251] rounded-xs" /> Target Production
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-[#E67E22] rounded-xs" /> Production
              </span>
            </div>
            <SvgBarChart data={chartDataSets.productionData} />
          </div>
        </div>

        {/* Chart 2: Hold & Reject Status */}
        <div className="border border-slate-700 rounded-xl overflow-hidden shadow-xs flex flex-col bg-white dark:bg-slate-900">
          <div className="bg-[#2E4A62] text-white text-center py-2 px-3 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2">
            <span>Hold & Reject Status {timelineLabel}</span>
            <span className="text-[10px] text-orange-200 lowercase font-medium">
              (Hold {totalHold.toFixed(2)}% , Reject {totalReject.toFixed(2)}%)
            </span>
          </div>
          <div className="p-4 flex-1">
            {/* Custom chart legend */}
            <div className="flex items-center gap-4 mb-3 text-xs font-bold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-[#0F4C81] rounded-xs" /> Hold %
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-[#E67E22] rounded-xs" /> Reject %
              </span>
            </div>
            <SvgLineChart 
              labels={chartDataSets.labels}
              series={[
                { name: 'Hold %', color: '#0F4C81', data: chartDataSets.holdData },
                { name: 'Reject %', color: '#E67E22', data: chartDataSets.rejectData }
              ]}
              percentage
              maxY={5.00}
            />
          </div>
        </div>

      </div>

      {/* 5. Charts Block Row 2 (Efficiency, Capacity Utilization, Absenteeism Ratio) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5" id="charts-row-2">
        
        {/* Chart 3: Efficiency */}
        <div className="border border-slate-700 rounded-xl overflow-hidden shadow-xs flex flex-col bg-white dark:bg-slate-900">
          <div className="bg-[#2E4A62] text-white text-center py-2 px-3 font-bold text-xs uppercase tracking-wider">
            {timelineLabel} Efficiency
          </div>
          <div className="p-4 flex-1">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-[#0F4C81]">
              <span className="h-3 w-3 bg-[#0F4C81] rounded-xs" /> Efficiency Trend
            </div>
            <SvgLineChart 
              labels={chartDataSets.labels}
              series={[
                { name: 'Efficiency', color: '#0F4C81', data: chartDataSets.efficiencyData }
              ]}
              percentage
              minY={0}
              maxY={100}
            />
          </div>
        </div>

        {/* Chart 4: Capacity Utilization */}
        <div className="border border-slate-700 rounded-xl overflow-hidden shadow-xs flex flex-col bg-white dark:bg-slate-900">
          <div className="bg-[#2E4A62] text-white text-center py-2 px-3 font-bold text-xs uppercase tracking-wider">
            {timelineLabel} Capacity Utilization
          </div>
          <div className="p-4 flex-1">
            <div className="flex items-center gap-2 mb-3 text-xs font-bold text-[#0F4C81]">
              <span className="h-3 w-3 bg-[#0F4C81] rounded-xs" /> Capacity Log
            </div>
            <SvgHorizontalBarChart data={chartDataSets.capacityData} />
          </div>
        </div>

        {/* Chart 5: Absentism Ratio & Team Size */}
        <div className="border border-slate-700 rounded-xl overflow-hidden shadow-xs flex flex-col bg-white dark:bg-slate-900">
          <div className="bg-[#2E4A62] text-white text-center py-2 px-3 font-bold text-xs uppercase tracking-wider">
            Absentism Ratio
          </div>
          <div className="p-4 flex-1 flex flex-col justify-between">
            {/* Custom chart legend */}
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-[#16A085] rounded-xs" /> Absent %
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 bg-[#E67E22] rounded-xs" /> Present %
              </span>
            </div>

            {/* Layout Split: Donut on Left, Corporate Stats Table on Right */}
            <div className="grid grid-cols-2 items-center gap-2 mt-2">
              <DonutChart absentPct={metrics.absentPct} presentPct={metrics.presentPct} />
              
              <div className="space-y-3 font-sans">
                {/* Total Operators */}
                <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Operators</span>
                  <span className="text-2xl font-black text-slate-800 dark:text-slate-100 block text-right">
                    {metrics.operators}
                  </span>
                </div>
                {/* Absent Person count */}
                <div className="border-b border-gray-100 dark:border-slate-800 pb-1.5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Absent Person %</span>
                  <span className="text-sm font-black text-[#E67E22] block text-right">
                    {metrics.absentCount} & {metrics.absentPct.toFixed(2)}%
                  </span>
                </div>
                {/* VS Yesterday comparisons */}
                <div>
                  <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wider">VS Yesterday</span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 block text-right">
                    0 & 0.00%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 6. Secondary Element Consumption Panel (Full Width Box enclosing 4 line charts) */}
      <div className="border border-slate-700 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900" id="secondary-element-consumption">
        <div className="bg-[#2E4A62] text-white text-center py-2.5 px-4 font-black text-sm uppercase tracking-wider">
          Secondary Element Consumption
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-300">
          
          {/* Subchart 1: Needle Broken */}
          <div className="p-4">
            <h4 className="bg-[#2E4A62] text-white text-center py-1.5 px-3 font-bold text-xs uppercase tracking-wider rounded-md mb-3">
              Last 7 Days Needle Broken (pcs)
            </h4>
            <SvgLineChart 
              labels={chartDataSets.labels}
              series={[{ name: 'Needles', color: '#1A759F', data: chartDataSets.needles }]}
            />
          </div>

          {/* Subchart 2: Sinker Broken */}
          <div className="p-4">
            <h4 className="bg-[#2E4A62] text-white text-center py-1.5 px-3 font-bold text-xs uppercase tracking-wider rounded-md mb-3">
              Last 7 Days Sinker Broken (pcs)
            </h4>
            <SvgLineChart 
              labels={chartDataSets.labels}
              series={[{ name: 'Sinkers', color: '#27AE60', data: chartDataSets.sinkers }]}
              maxY={4}
            />
          </div>

          {/* Subchart 3: Oil Consumption */}
          <div className="p-4">
            <h4 className="bg-[#2E4A62] text-white text-center py-1.5 px-3 font-bold text-xs uppercase tracking-wider rounded-md mb-3">
              Last 7 Days Oil Consumption (Ltr)
            </h4>
            <SvgLineChart 
              labels={chartDataSets.labels}
              series={[{ name: 'Oil (Ltr)', color: '#F39C12', data: chartDataSets.oils }]}
              maxY={5.0}
            />
          </div>

          {/* Subchart 4: Set Change */}
          <div className="p-4">
            <h4 className="bg-[#2E4A62] text-white text-center py-1.5 px-3 font-bold text-xs uppercase tracking-wider rounded-md mb-3">
              Last 7 Days Set Change
            </h4>
            <SvgLineChart 
              labels={chartDataSets.labels}
              series={[{ name: 'Set Changes', color: '#2C3E50', data: chartDataSets.setChanges }]}
              maxY={1}
            />
          </div>

        </div>
      </div>

      {/* 7. Interactive Machine Matrix (Polished Drilldown) */}
      <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs" id="machine-matrix-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="font-sans text-sm font-black text-gray-900 dark:text-white uppercase" id="machine-matrix-title">
              Interactive Machine Matrix ({filteredMachines.length} frames)
            </h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
              Real-time monitoring of specific physical cylinders
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3" id="machine-matrix-filters-group">
            {/* Search inputs */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder="Search machine structure..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-950/20 py-1.5 pl-9 pr-3.5 text-xs font-semibold text-gray-700 dark:text-slate-300 transition-colors focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
                id="machine-matrix-search"
              />
            </div>

            {/* Status filters */}
            <div className="flex gap-1.5 rounded-lg bg-gray-50 dark:bg-slate-950/30 p-1 border border-gray-200 dark:border-slate-700" id="machine-matrix-tabs">
              {(['all', 'running', 'idle', 'warning'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStatusFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    statusFilter === f 
                      ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs' 
                      : 'text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-350'
                  }`}
                  id={`machine-filter-tab-${f}`}
                >
                  {f === 'all' ? 'All' : f === 'warning' ? 'Alerts' : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Machine cards grid */}
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4" id="machine-grid-container">
          {filteredMachines.map((m) => {
            const machineStatus = {
              running: {
                border: 'border-emerald-100 hover:border-emerald-300 dark:border-emerald-950/30 dark:hover:border-emerald-700 bg-linear-to-b from-white to-emerald-50/10 dark:from-slate-900 dark:to-emerald-950/5',
                statusDot: 'bg-emerald-500',
                statusText: 'Running',
              },
              idle: {
                border: 'border-amber-100 hover:border-amber-300 dark:border-amber-950/30 dark:hover:border-amber-700 bg-linear-to-b from-white to-amber-50/10 dark:from-slate-900 dark:to-amber-950/5',
                statusDot: 'bg-amber-500',
                statusText: m.stopReason || 'Idle',
              },
              maintenance: {
                border: 'border-red-100 hover:border-red-300 dark:border-red-950/30 dark:hover:border-red-700 bg-linear-to-b from-white to-red-50/10 dark:from-slate-900 dark:to-red-950/5',
                statusDot: 'bg-red-500',
                statusText: m.stopReason || 'Maintenance',
              },
              stopped: {
                border: 'border-red-100 hover:border-red-300 dark:border-red-950/30 dark:hover:border-red-700 bg-linear-to-b from-white to-red-50/10 dark:from-slate-900 dark:to-red-950/5',
                statusDot: 'bg-red-500',
                statusText: m.stopReason || 'Alert Stop',
              }
            }[m.status];

            return (
              <div 
                key={m.id}
                className={`rounded-xl border p-4 shadow-2xs transition-all duration-200 hover:-translate-y-1 bg-white dark:bg-slate-900 ${machineStatus.border}`}
                id={`machine-card-${m.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-xs font-black text-gray-900 dark:text-slate-100">{m.name}</span>
                  <div className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${machineStatus.statusDot}`} />
                    <span className="text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase">{machineStatus.statusText}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-b border-gray-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-400 dark:text-slate-500 font-medium">Structure:</span>
                    <span className="text-gray-800 dark:text-slate-200">{m.fabricType !== 'None' ? m.fabricType : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-400 dark:text-slate-500 font-medium">Cylinder Speed:</span>
                    <span className="text-gray-800 dark:text-slate-200 font-mono flex items-center gap-1">
                      <Gauge className="h-3 w-3 text-blue-500" />
                      {m.rpm} RPM
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-400 dark:text-slate-500 font-medium">Density (GSM):</span>
                    <span className="text-gray-800 dark:text-slate-200 font-mono">{m.gsm !== 0 ? `${m.gsm}g` : '—'}</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <span className="block text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase">Efficiency Ratio</span>
                    <span className="font-mono text-xs font-black text-gray-900 dark:text-white">{m.efficiency}%</span>
                  </div>
                  <div className="h-1.5 w-20 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${m.efficiency >= 90 ? 'bg-emerald-500' : m.efficiency >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
                      style={{ width: `${m.efficiency}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredMachines.length === 0 && (
            <div className="col-span-full py-12 text-center text-xs font-bold text-gray-400 dark:text-slate-500" id="no-machinery-message">
              No machinery match the specified parameters. Try clearing the search filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
