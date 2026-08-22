/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  Plus, 
  Edit2,
  Calendar, 
  Layers, 
  Cpu, 
  AlertTriangle, 
  Wrench, 
  Users, 
  X,
  TrendingUp,
  Calculator,
  Truck
} from 'lucide-react';
import { LedgerRecord } from '../types';
import { 
  getTargetKgForUnit, 
  getTotalMachinesForUnit, 
  getAvgProdPerMachineForUnit, 
  getProductionCapacityForUnit,
  getUnitConfigs,
  saveUnitConfigs,
  UnitThresholdConfig
} from '../lib/unitStore';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { UserRecord } from './UserManagementView';
import { ShieldCheck, Lock } from 'lucide-react';

interface AddProductionRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: LedgerRecord | null;
  onChange: (field: keyof LedgerRecord, value: any) => void;
  onSave: (e: React.FormEvent) => void;
  errors: Record<string, string>;
  isEdit?: boolean;
  title?: string;
  submitLabel?: string;
  allowedFloors?: string[];
  currentUser?: UserRecord | null;
}

export default function AddProductionRecordModal({
  isOpen,
  onClose,
  record,
  onChange,
  onSave,
  errors,
  isEdit = false,
  title,
  submitLabel,
  allowedFloors,
  currentUser
}: AddProductionRecordModalProps) {
  // Subscribe to reactive unit settings (Hooks MUST be called unconditionally at top)
  const [unitConfigs, setUnitConfigs] = React.useState<UnitThresholdConfig[]>(() => getUnitConfigs());

  React.useEffect(() => {
    const unsubscribe = FirestoreSyncService.subscribeToSettings((remoteSettings) => {
      if (remoteSettings && remoteSettings.unitConfigs && Array.isArray(remoteSettings.unitConfigs) && remoteSettings.unitConfigs.length > 0) {
        setUnitConfigs(remoteSettings.unitConfigs);
        saveUnitConfigs(remoteSettings.unitConfigs);
      }
    });

    const handleUpdate = () => {
      setUnitConfigs(getUnitConfigs());
    };
    window.addEventListener('unit_configs_updated', handleUpdate);
    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('unit_configs_updated', handleUpdate);
    };
  }, []);

  if (!isOpen || !record) return null;

  const allFloors = ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'Extension', 'ESL-Extension', 'Sub-Contact'];
  const isAdmin = currentUser?.userType === 'Admin';
  
  // Filter floors by user assigned units if not admin
  const floors = (allowedFloors && allowedFloors.length > 0)
    ? allFloors.filter(f => allowedFloors.some(af => af.toLowerCase().replace(/[-\s_]/g, '') === f.toLowerCase().replace(/[-\s_]/g, '')))
    : (isAdmin ? allFloors : (record.floor ? [record.floor] : allFloors));

  // Current floor setting values for live preview calculation
  const currentFloor = record.floor || 'EKL';
  const isSubContact = currentFloor === 'Sub-Contact' || record.unit === 'Sub-Contact';
  const unitCapacity = getProductionCapacityForUnit(currentFloor);
  const avgProdPerMc = getAvgProdPerMachineForUnit(currentFloor);
  const totalM = getTotalMachinesForUnit(currentFloor) || record.totalMachines || 30;

  // 1. Shifts & Total Production
  const shiftA = Number(record.shiftA) || 0;
  const shiftB = Number(record.shiftB) || 0;
  const shiftC = Number(record.shiftC) || 0;
  const totalProduction = isSubContact
    ? (Number(record.totalProduction) || 0)
    : (shiftA + shiftB + shiftC);

  // 2. Sample & Bulk Production
  const sampleProd = Number(record.sampleProd) || 0;
  const bulkProd = Math.max(0, totalProduction - sampleProd);

  // 3. Machines & Utilization
  const runningSample = Number(record.runningSample) || 0;
  const runningBulk = record.runningBulk !== undefined ? Number(record.runningBulk) : Math.max(0, totalM - runningSample);
  const runningActiveMachines = runningBulk + runningSample;
  const idleMc = Math.max(0, totalM - runningActiveMachines);
  const machineUtilization = totalM > 0 ? parseFloat(((runningActiveMachines / totalM) * 100).toFixed(2)) : 0;
  const idleMcPct = totalM > 0 ? parseFloat(((idleMc / totalM) * 100).toFixed(2)) : 0;

  // 4. Target Bulk, Efficiency, Idle Production & Production Loss
  const targetBulk = Number((runningBulk * avgProdPerMc).toFixed(2));
  const efficiency = targetBulk > 0 ? parseFloat(((bulkProd / targetBulk) * 100).toFixed(2)) : 0;
  const capacityUtilization = unitCapacity > 0 ? parseFloat(((totalProduction / unitCapacity) * 100).toFixed(2)) : 0;
  const prodLossForSample = runningBulk > 0
    ? parseFloat((((bulkProd / runningBulk) * runningSample) - sampleProd).toFixed(2))
    : 0;
  const idleProduction = idleMc > 0 ? parseFloat((idleMc * avgProdPerMc).toFixed(2)) : 0;
  const productionLossForEff = Math.max(0, parseFloat((targetBulk - bulkProd).toFixed(2)));
  const proPerMc = runningActiveMachines > 0 ? parseFloat((totalProduction / runningActiveMachines).toFixed(2)) : 0;

  // 5. Quality, Hold & Scrap
  const reject = Number(record.reject) || 0;
  const rejectPct = totalProduction > 0 ? parseFloat(((reject / totalProduction) * 100).toFixed(2)) : 0;
  const hold = Number(record.hold) || 0;
  const holdPct = totalProduction > 0 ? parseFloat(((hold / totalProduction) * 100).toFixed(2)) : 0;
  const jhuteCutpcs = Number(record.jhuteCutpcs) || 0;
  const jhuteCutpcsPct = totalProduction > 0 ? parseFloat(((jhuteCutpcs / totalProduction) * 100).toFixed(2)) : 0;

  // 6. Needles & Sinkers
  const needleBroken = Number(record.needleBroken) || 0;
  const needlePerKg = needleBroken > 0 && totalProduction > 0
    ? parseFloat((totalProduction / needleBroken).toFixed(2))
    : 0;
  const sinkerBroken = Number(record.sinkerBroken) || 0;
  const sinkerPerKg = sinkerBroken > 0 && totalProduction > 0
    ? parseFloat((totalProduction / sinkerBroken).toFixed(2))
    : 0;

  // 7. Manpower
  const totalOperator = Number(record.totalOperator) || 0;
  const absent = Number(record.absent) || 0;
  const absentPct = totalOperator > 0 ? parseFloat(((absent / totalOperator) * 100).toFixed(2)) : 0;

  // 8. Sub-Contact Achievment-Circular live calculation
  const subTarget = Number(record.target) || 0;
  const autoAchievment = subTarget > 0 ? parseFloat(((totalProduction / subTarget) * 100).toFixed(2)) : 0;
  const achievmentCircular = record.achievmentCircular !== undefined && record.achievmentCircular !== null
    ? Number(record.achievmentCircular)
    : autoAchievment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
              isEdit 
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' 
                : 'bg-blue-50 dark:bg-blue-950/50 text-[#0F4C81] dark:text-blue-400'
            }`}>
              {isEdit ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-sans text-sm sm:text-base font-black text-gray-950 dark:text-white uppercase tracking-wider flex items-center gap-2">
                {title || (isEdit ? 'Edit Production Record' : 'Add Production Record')}
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  isEdit
                    ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-[#0F4C81]/10 text-[#0F4C81] dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                  {isEdit ? 'Full Edit Mode' : 'Settings-Integrated Form'}
                </span>
              </h3>
              <p className="text-[10px] text-gray-400 uppercase font-semibold">
                {isEdit 
                  ? `Editing complete production parameters for ${record.floor} on ${record.date}`
                  : 'Shift output, automated machine capacity, quality indices, consumables and manpower logs'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Live KPI Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-gray-200/60 dark:border-slate-800 shrink-0">
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase">Total Prod</div>
            <div className="text-xs font-mono font-black text-[#0F4C81] dark:text-blue-400">
              {(totalProduction ?? 0).toLocaleString()} <span className="text-[9px]">Kg</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase">Target Total</div>
            <div className="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400">
              {((isSubContact ? subTarget : (Number(record.target) || 0)) ?? 0).toLocaleString()} <span className="text-[9px]">Kg</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase">Sample Prod</div>
            <div className="text-xs font-mono font-black text-amber-600 dark:text-amber-400">
              {(sampleProd ?? 0).toLocaleString()} <span className="text-[9px]">Kg</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase">Bulk Prod</div>
            <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
              {(bulkProd ?? 0).toLocaleString()} <span className="text-[9px]">Kg</span>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase">
              {isSubContact ? 'Achievment %' : 'Efficiency'}
            </div>
            <div className={`text-xs font-mono font-black ${
              (isSubContact ? achievmentCircular : efficiency) >= 90 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {isSubContact ? achievmentCircular : efficiency}%
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[9px] font-bold text-gray-400 uppercase">
              {isSubContact ? 'Running Mills' : 'Running Bulk'}
            </div>
            <div className="text-xs font-mono font-black text-gray-800 dark:text-slate-100">
              {isSubContact 
                ? (record.totalRunningFactories ?? record.runningFactories ?? 0)
                : `${runningBulk} / ${totalM || record.totalMachines || 0}`}
              <span className="text-[9px] text-gray-400 font-normal"> {isSubContact ? 'Mills' : 'MC'}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Form Body with Organized Sections */}
        <form onSubmit={onSave} className="space-y-4 overflow-y-auto pr-1 flex-1">
          
          {/* SECTION 1: GENERAL & DATES (Date, Floor, Month, Year) */}
          <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
            <h4 className="font-sans text-[11px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> 1. General & Scheduling Information
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Date *</label>
                <input
                  type="date"
                  value={record.date ?? ''}
                  onChange={(e) => onChange('date', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                  required
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Floor *</label>
                  {!isAdmin && allowedFloors && allowedFloors.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded">
                      <ShieldCheck className="h-2.5 w-2.5" /> Assigned
                    </span>
                  )}
                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </div>
                <select
                  value={record.floor ?? (floors[0] || 'EKL')}
                  onChange={(e) => onChange('floor', e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                >
                  {floors.map((fl) => (
                    <option key={fl} value={fl}>{fl}</option>
                  ))}
                </select>
                {floors.length === 1 && !isAdmin && (
                  <p className="text-[9px] text-gray-500 dark:text-slate-400 italic">
                    Restricted to your assigned floor: {floors[0]}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Month</label>
                <input
                  type="text"
                  value={record.month || 'August'}
                  readOnly
                  className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-400">Year</label>
                <input
                  type="number"
                  value={record.year || 2026}
                  readOnly
                  className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                />
              </div>
            </div>
          </div>

          {!isSubContact ? (
            /* ========================================================================= */
            /* IN-HOUSE FLOORS ONLY: EKL, EFL, EFL-2, Auto Stripe, Extension, ESL-Extension */
            /* ========================================================================= */
            <>
              {/* SECTION 2: PRODUCTION & SHIFTS (Target Total, Shift A, Shift B, Shift C, Total Production, Target Bulk, Bulk Prod., Sample Prod.) */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> 2. Production Weights & Shift Output
                  </span>
                  <span className="text-[9px] font-bold text-gray-400 lowercase">
                    Target Total (Customizable)
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Target Total (Kg) *</span>
                      <span className="text-[8px] text-blue-600 dark:text-blue-400 font-normal">Editable</span>
                    </label>
                    <input
                      type="number"
                      value={record.target === 0 || record.target === undefined ? (record.target === 0 ? 0 : '') : record.target}
                      onChange={(e) => {
                        const val = e.target.value;
                        onChange('target', val === '' ? 0 : (parseFloat(val) || 0));
                      }}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      placeholder="e.g. 15000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Shift A</label>
                    <input
                      type="number"
                      value={record.shiftA ?? 0}
                      onChange={(e) => onChange('shiftA', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Shift B</label>
                    <input
                      type="number"
                      value={record.shiftB ?? 0}
                      onChange={(e) => onChange('shiftB', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Shift C</label>
                    <input
                      type="number"
                      value={record.shiftC ?? 0}
                      onChange={(e) => onChange('shiftC', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-[#0F4C81] dark:text-blue-400 uppercase flex items-center justify-between">
                      <span>Total Production</span>
                      <span className="text-[8px] text-blue-600 dark:text-blue-400 font-normal">(Shift A+B+C)</span>
                    </label>
                    <input
                      type="number"
                      value={record.totalProduction ?? totalProduction}
                      readOnly
                      className="w-full rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/30 px-3 py-1.5 text-xs font-mono font-bold text-[#0F4C81] dark:text-blue-300 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Target Bulk</span>
                      <span className="text-[8px] text-blue-600 dark:text-blue-400 font-normal">(Running Bulk × Avg)</span>
                    </label>
                    <input
                      type="number"
                      value={record.targetBulk ?? targetBulk}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-700 dark:text-slate-200 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Bulk Prod.</span>
                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-normal">(Total - Sample)</span>
                    </label>
                    <input
                      type="number"
                      value={record.bulkProd ?? bulkProd}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-700 dark:text-slate-200 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Sample Prod.</label>
                    <input
                      type="number"
                      value={record.sampleProd ?? 0}
                      onChange={(e) => onChange('sampleProd', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: MACHINES & PERFORMANCE (Running Bulk, Running Sample, Idle Mc, Machine Utilization, Idle Mc %, Prod. Loss For Sample, Idle Production, Efficiency, Pro Per Mc, Production Loss For Eff, Capacity Utilization) */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> 3. Machine Capacity, Utilization & Efficiency
                  </span>
                  <span className="text-[9px] font-bold text-gray-400 lowercase">
                    {totalM} total machines in unit configuration
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Running Bulk</span>
                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-normal">Active Bulk Mc</span>
                    </label>
                    <input
                      type="number"
                      value={record.runningBulk !== undefined ? record.runningBulk : runningBulk}
                      onChange={(e) => onChange('runningBulk', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Running Sample</label>
                    <input
                      type="number"
                      value={record.runningSample ?? 0}
                      onChange={(e) => onChange('runningSample', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Idle Mc</label>
                    <input
                      type="number"
                      value={record.idleMc !== undefined ? record.idleMc : (record.idleMachine !== undefined ? record.idleMachine : idleMc)}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Machine Utilization</label>
                    <input
                      type="number"
                      value={record.machineUtilization ?? machineUtilization}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Idle Mc %</label>
                    <input
                      type="number"
                      value={record.idleMcPct !== undefined ? record.idleMcPct : (record.idleMachinePct !== undefined ? record.idleMachinePct : idleMcPct)}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Prod. Loss For Sample</span>
                      <span className="text-[8px] text-amber-600 dark:text-amber-400 font-normal">Kg</span>
                    </label>
                    <input
                      type="number"
                      value={record.prodLossForSample ?? prodLossForSample}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Idle Production</span>
                      <span className="text-[8px] text-gray-400 font-normal">Kg</span>
                    </label>
                    <input
                      type="number"
                      value={record.idleProduction ?? idleProduction}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Efficiency</span>
                      <span className="text-[8px] text-emerald-600 dark:text-emerald-400 font-normal">%</span>
                    </label>
                    <input
                      type="number"
                      value={record.efficiency ?? efficiency}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Pro Per Mc</label>
                    <input
                      type="number"
                      value={record.proPerMc !== undefined ? record.proPerMc : (record.productionPerMachine !== undefined ? record.productionPerMachine : proPerMc)}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-700 dark:text-slate-300 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Production Loss For Eff</label>
                    <input
                      type="number"
                      value={record.productionLossForEff !== undefined ? record.productionLossForEff : (record.productionLossForEfficiency !== undefined ? record.productionLossForEfficiency : productionLossForEff)}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Capacity Utilization</label>
                    <input
                      type="number"
                      value={record.capacityUtilization ?? capacityUtilization}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: QUALITY, HOLD, SCRAP & SET CHANGE (Reject, Reject%, Hold, Hold%, Jhute/Cutpcs, Jhute/Cutpcs%, Set Change(Pcs)) */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> 4. Quality Rejection, Hold, Jhute & Set Change
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Reject</label>
                    <input
                      type="number"
                      value={record.reject ?? 0}
                      onChange={(e) => onChange('reject', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Reject%</label>
                    <input
                      type="number"
                      value={record.rejectPct ?? rejectPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Hold</label>
                    <input
                      type="number"
                      value={record.hold ?? 0}
                      onChange={(e) => onChange('hold', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Hold%</label>
                    <input
                      type="number"
                      value={record.holdPct ?? holdPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Jhute/Cutpcs</label>
                    <input
                      type="number"
                      value={record.jhuteCutpcs ?? 0}
                      onChange={(e) => onChange('jhuteCutpcs', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Jhute/Cutpcs%</label>
                    <input
                      type="number"
                      value={record.jhuteCutpcsPct ?? jhuteCutpcsPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-gray-600 dark:text-slate-300 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Set Change(Pcs)</label>
                    <input
                      type="number"
                      value={record.setChangePcs !== undefined ? record.setChangePcs : (record.setChange !== undefined ? record.setChange : 0)}
                      onChange={(e) => onChange('setChangePcs', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: CONSUMABLES & SPARES (Needle Broken, Needle/Per Kg, Sinker Broken, Sinker/Per Kg, Oil Consumption, Belt Broken, Other Spare parts Name, Other Spare parts QTY) */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <Wrench className="h-3.5 w-3.5" /> 5. Consumables, Needles, Sinkers & Spare Parts
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Needle Broken</label>
                    <input
                      type="number"
                      value={record.needleBroken ?? 0}
                      onChange={(e) => onChange('needleBroken', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Needle/Per Kg</span>
                      <span className="text-[8px] text-purple-600 dark:text-purple-400 font-normal">(Prod / Broken)</span>
                    </label>
                    <input
                      type="number"
                      value={record.needlePerKg ?? needlePerKg}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-purple-600 dark:text-purple-400 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Sinker Broken</label>
                    <input
                      type="number"
                      value={record.sinkerBroken ?? 0}
                      onChange={(e) => onChange('sinkerBroken', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Sinker/Per Kg</span>
                      <span className="text-[8px] text-purple-600 dark:text-purple-400 font-normal">(Prod / Broken)</span>
                    </label>
                    <input
                      type="number"
                      value={record.sinkerPerKg ?? sinkerPerKg}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-purple-600 dark:text-purple-400 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Oil Consumption</label>
                    <input
                      type="number"
                      value={record.oilConsumption ?? 0}
                      onChange={(e) => onChange('oilConsumption', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Belt Broken</label>
                    <input
                      type="number"
                      value={record.beltBroken ?? 0}
                      onChange={(e) => onChange('beltBroken', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Other Spare parts Name</label>
                    <input
                      type="text"
                      value={record.otherSparePartsName ?? ''}
                      onChange={(e) => onChange('otherSparePartsName', e.target.value)}
                      placeholder="e.g. Bearing 6002"
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Other Spare parts QTY</label>
                    <input
                      type="number"
                      value={record.otherSparePartsQty ?? 0}
                      onChange={(e) => onChange('otherSparePartsQty', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 6: MANPOWER ROSTER (Total Operator, Absent, Absent %) */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> 6. Manpower Roster & Attendance
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Total Operator</label>
                    <input
                      type="number"
                      value={record.totalOperator ?? 0}
                      onChange={(e) => onChange('totalOperator', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Absent</label>
                    <input
                      type="number"
                      value={record.absent ?? 0}
                      onChange={(e) => onChange('absent', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Absent %</label>
                    <input
                      type="number"
                      value={record.absentPct ?? absentPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-teal-600 dark:text-teal-400 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* ========================================================================= */
            /* SUB-CONTACT SPECIFIC FIELDS (Strict 23 Columns) */
            /* ========================================================================= */
            <>
              {/* SECTION 2: SUB-CONTRACT PRODUCTION & OUTPUT */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> 2. Sub-Contract Targets & Production Weights
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Target Total (Kg) *</span>
                      <span className="text-[8px] text-blue-600 dark:text-blue-400 font-normal">Editable</span>
                    </label>
                    <input
                      type="number"
                      value={record.target === 0 || record.target === undefined ? (record.target === 0 ? 0 : '') : record.target}
                      onChange={(e) => {
                        const val = e.target.value;
                        onChange('target', val === '' ? 0 : (parseFloat(val) || 0));
                      }}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      placeholder="e.g. 25000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-[#0F4C81] dark:text-blue-400 uppercase">Total Production (Kg)</label>
                    <input
                      type="number"
                      value={record.totalProduction ?? 0}
                      onChange={(e) => onChange('totalProduction', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-[#0F4C81] dark:text-blue-400 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Sample Prod. (Kg)</label>
                    <input
                      type="number"
                      value={record.sampleProd ?? 0}
                      onChange={(e) => onChange('sampleProd', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Bulk Prod. (Kg)</span>
                      <span className="text-[9px] text-gray-400 lowercase font-normal">auto</span>
                    </label>
                    <input
                      type="number"
                      value={record.bulkProd ?? bulkProd}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Production-Flat Knit (Kg)</label>
                    <input
                      type="number"
                      value={record.productionFlatKnit ?? 0}
                      onChange={(e) => onChange('productionFlatKnit', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Achievment-Circular %</span>
                      <span className="text-[9px] text-gray-400 lowercase font-normal">auto</span>
                    </label>
                    <input
                      type="number"
                      value={record.achievmentCircular ?? achievmentCircular}
                      onChange={(e) => onChange('achievmentCircular', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">OTD</label>
                    <input
                      type="text"
                      value={record.otd ?? '100'}
                      onChange={(e) => onChange('otd', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      placeholder="e.g. 100 or 98.5%"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: SUB-CONTRACT LOGISTICS & OUTSIDE MILLS */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> 3. Sub-Contract Logistics, Factories & Machines
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Yarn Issued (Kg)</label>
                    <input
                      type="number"
                      value={record.yarnIssued ?? 0}
                      onChange={(e) => onChange('yarnIssued', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Total Running Factories</label>
                    <input
                      type="number"
                      value={record.totalRunningFactories ?? record.runningFactories ?? 0}
                      onChange={(e) => onChange('totalRunningFactories', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Running Machine</label>
                    <input
                      type="number"
                      value={record.runningMachine ?? 0}
                      onChange={(e) => onChange('runningMachine', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Number Vehicles</label>
                    <input
                      type="number"
                      value={record.numberVehicles ?? 0}
                      onChange={(e) => onChange('numberVehicles', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Fabric Return (Kg)</label>
                    <input
                      type="number"
                      value={record.fabricReturn ?? 0}
                      onChange={(e) => onChange('fabricReturn', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: SUB-CONTRACT QUALITY & DEFECTS */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-rose-700 dark:text-rose-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> 4. Sub-Contract Quality, Hold, Reject & Jhute
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Hold (Kg)</label>
                    <input
                      type="number"
                      value={record.hold ?? 0}
                      onChange={(e) => onChange('hold', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Hold%</span>
                      <span className="text-[9px] text-gray-400 lowercase font-normal">auto</span>
                    </label>
                    <input
                      type="number"
                      value={record.holdPct ?? holdPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-amber-600 dark:text-amber-400 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Reject (Kg)</label>
                    <input
                      type="number"
                      value={record.reject ?? 0}
                      onChange={(e) => onChange('reject', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Reject%</span>
                      <span className="text-[9px] text-gray-400 lowercase font-normal">auto</span>
                    </label>
                    <input
                      type="number"
                      value={record.rejectPct ?? rejectPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-rose-600 dark:text-rose-400 outline-hidden"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Jhute/Cut Pcs (Kg)</label>
                    <input
                      type="number"
                      value={record.jhuteCutpcs ?? 0}
                      onChange={(e) => onChange('jhuteCutpcs', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-orange-600 dark:text-orange-400 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Jhute/Cut Pcs%</span>
                      <span className="text-[9px] text-gray-400 lowercase font-normal">auto</span>
                    </label>
                    <input
                      type="number"
                      value={record.jhuteCutpcsPct ?? jhuteCutpcsPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-orange-600 dark:text-orange-400 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: SUB-CONTRACT MANPOWER ROSTER */}
              <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3">
                <h4 className="font-sans text-[11px] font-black text-teal-700 dark:text-teal-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1.5 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> 5. Manpower & Attendance
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Total Manpower</label>
                    <input
                      type="number"
                      value={record.totalOperator ?? 0}
                      onChange={(e) => onChange('totalOperator', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Absent</label>
                    <input
                      type="number"
                      value={record.absent ?? 0}
                      onChange={(e) => onChange('absent', parseInt(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase flex items-center justify-between">
                      <span>Absent %</span>
                      <span className="text-[9px] text-gray-400 lowercase font-normal">auto</span>
                    </label>
                    <input
                      type="number"
                      value={record.absentPct ?? absentPct}
                      readOnly
                      className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100/70 dark:bg-slate-800/50 px-3 py-1.5 text-xs font-mono font-bold text-teal-600 dark:text-teal-400 outline-hidden"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* SECTION 7: REMARKS (Remarks) */}
          <div className="space-y-1 rounded-xl border border-gray-100 dark:border-slate-800 p-4 bg-gray-50/50 dark:bg-slate-800/10">
            <label className="text-[10px] font-black uppercase text-[#0F4C81] dark:text-blue-300 block mb-1">
              Remarks (Shift Handover & Production Notes)
            </label>
            <textarea
              value={record.remarks ?? ''}
              onChange={(e) => onChange('remarks', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
              placeholder="Record shift updates, raw material arrivals, technical downtime notes..."
            />
          </div>

          {/* Display errors if any */}
          {Object.keys(errors).length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-bold text-red-600 space-y-0.5">
              {Object.values(errors).map((err, idx) => (
                <div key={idx}>• {err}</div>
              ))}
            </div>
          )}

          {/* Form Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-gray-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 text-gray-700 dark:text-slate-200 px-5 py-2 text-xs font-bold transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`w-full sm:w-auto inline-flex items-center justify-center rounded-xl px-6 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer text-white ${
                isEdit
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-[#0F4C81] hover:bg-[#0b3861]'
              }`}
            >
              {submitLabel || (isEdit ? 'Update & Save Record' : 'Create Entry')}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
