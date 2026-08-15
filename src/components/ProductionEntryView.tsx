/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Plus, 
  Calendar, 
  Check, 
  Trash2, 
  AlertCircle, 
  CheckCircle2, 
  Cpu, 
  Users, 
  Wrench, 
  Layers, 
  Settings, 
  Search, 
  FileSpreadsheet, 
  Calculator, 
  FileText,
  Clock,
  Briefcase,
  TrendingUp,
  RotateCcw,
  X
} from 'lucide-react';
import { FactoryFloor, ProductionEntry, LedgerRecord } from '../types';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { UserRecord } from './UserManagementView';

interface ProductionEntryViewProps {
  floors: FactoryFloor[];
  onSubmitEntry: (entry: Omit<ProductionEntry, 'id' | 'timestamp'>) => void;
  currentUser?: UserRecord | null;
}

// Custom interface for our premium detailed daily logs
interface DailyProductionLog {
  id: string;
  unit: string;
  date: string;
  day: string;
  targetKg: number;
  productionShiftA: number;
  productionShiftB: number;
  productionShiftC: number;
  totalProductionKg: number;
  runningMachines: number;
  rejectKg: number;
  holdKg: number;
  setChange: number;
  needleBrokenPcs: number;
  sinkerBrokenPcs: number;
  oilConsumptionLtr: number;
  totalOperators: number;
  absentOperators: number;
  presentOperators: number;
  remarks: string;
}

// Initial robust sample data for production supervisor daily entries
const INITIAL_DAILY_LOGS: DailyProductionLog[] = [
  {
    id: 'log-1',
    unit: 'EKL',
    date: '2026-07-10',
    day: 'Friday',
    targetKg: 25000,
    productionShiftA: 8200,
    productionShiftB: 8100,
    productionShiftC: 7850,
    totalProductionKg: 24150,
    runningMachines: 45,
    rejectKg: 120,
    holdKg: 80,
    setChange: 3,
    needleBrokenPcs: 14,
    sinkerBrokenPcs: 22,
    oilConsumptionLtr: 12,
    totalOperators: 50,
    absentOperators: 2,
    presentOperators: 48,
    remarks: 'Maintained steady pressure. Minor needle replacement during shift change B.',
  },
  {
    id: 'log-2',
    unit: 'EFL',
    date: '2026-07-09',
    day: 'Thursday',
    targetKg: 20000,
    productionShiftA: 6600,
    productionShiftB: 6500,
    productionShiftC: 6300,
    totalProductionKg: 19400,
    runningMachines: 38,
    rejectKg: 95,
    holdKg: 40,
    setChange: 2,
    needleBrokenPcs: 8,
    sinkerBrokenPcs: 12,
    oilConsumptionLtr: 10,
    totalOperators: 42,
    absentOperators: 1,
    presentOperators: 41,
    remarks: 'Yarn tension stabilized. High grade combed cotton verified.',
  },
  {
    id: 'log-3',
    unit: 'Auto Stripe',
    date: '2026-07-08',
    day: 'Wednesday',
    targetKg: 12000,
    productionShiftA: 3900,
    productionShiftB: 4000,
    productionShiftC: 3620,
    totalProductionKg: 11520,
    runningMachines: 18,
    rejectKg: 55,
    holdKg: 20,
    setChange: 4,
    needleBrokenPcs: 6,
    sinkerBrokenPcs: 8,
    oilConsumptionLtr: 6,
    totalOperators: 22,
    absentOperators: 0,
    presentOperators: 22,
    remarks: 'Auto strip alignment verified with high consistency. No critical machine stops.',
  },
];

export default function ProductionEntryView({ floors, onSubmitEntry, currentUser }: ProductionEntryViewProps) {
  const isAdmin = currentUser?.userType === 'Admin';
  // Modal Open State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form Field States
  const [unit, setUnit] = useState('EKL');
  const [productionDate, setProductionDate] = useState('2026-07-10');
  
  // Section 2: Production
  const [targetKg, setTargetKg] = useState('20000');
  const [shiftA, setShiftA] = useState('6500');
  const [shiftB, setShiftB] = useState('6800');
  const [shiftC, setShiftC] = useState('6200');

  // Section 3: Machine Performance
  const [runningMachines, setRunningMachines] = useState('35');
  const [rejectKg, setRejectKg] = useState('110');
  const [holdKg, setHoldKg] = useState('75');
  const [setChange, setSetChange] = useState('2');

  // Section 4: Consumables
  const [needleBroken, setNeedleBroken] = useState('6');
  const [sinkerBroken, setSinkerBroken] = useState('10');
  const [oilConsumption, setOilConsumption] = useState('12');

  // Section 5: Manpower
  const [totalOperators, setTotalOperators] = useState('45');
  const [absentOperators, setAbsentOperators] = useState('2');

  // Section 6: Remarks
  const [remarks, setRemarks] = useState('');

  // Local Table State for beautiful visual integration
  const [dailyLogs, setDailyLogs] = useState<DailyProductionLog[]>(INITIAL_DAILY_LOGS);

  // Subscribe to real-time Firestore ledger records for multi-device synchronization across Mobile/Tablet/Desktop
  useEffect(() => {
    const unsubscribe = FirestoreSyncService.subscribeToLedgerRecords((records) => {
      if (records && Array.isArray(records) && records.length > 0) {
        const mapped: DailyProductionLog[] = records.map(r => {
          const dateObj = new Date(r.date);
          const dayName = !isNaN(dateObj.getTime()) ? dateObj.toLocaleDateString('en-US', { weekday: 'long' }) : 'Monday';
          return {
            id: r.id,
            unit: r.floor,
            date: r.date,
            day: dayName,
            targetKg: r.target || 0,
            productionShiftA: r.shiftA || 0,
            productionShiftB: r.shiftB || 0,
            productionShiftC: r.shiftC || 0,
            totalProductionKg: r.totalProduction || (r.shiftA + r.shiftB + r.shiftC) || 0,
            runningMachines: r.runningMachine || 0,
            rejectKg: r.reject || 0,
            holdKg: r.hold || 0,
            setChange: r.setChange || 0,
            needleBrokenPcs: r.needleBroken || 0,
            sinkerBrokenPcs: r.sinkerBroken || 0,
            oilConsumptionLtr: r.oilConsumption || 0,
            totalOperators: r.totalOperator || 45,
            absentOperators: r.absent || 0,
            presentOperators: Math.max(0, (r.totalOperator || 45) - (r.absent || 0)),
            remarks: r.remarks || ''
          };
        });
        setDailyLogs(mapped);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Validation Errors State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Search filter list of units
  const availableUnits = ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension'];
  
  // Search state for Unit selection searchable dropdown
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const [unitSearchQuery, setUnitSearchQuery] = useState('');

  const filteredUnits = useMemo(() => {
    return availableUnits.filter(u => u.toLowerCase().includes(unitSearchQuery.toLowerCase()));
  }, [unitSearchQuery]);

  // Derived: Day of the week auto-generation based on selected date
  const derivedDay = useMemo(() => {
    if (!productionDate) return '';
    try {
      const parsedDate = new Date(productionDate);
      if (isNaN(parsedDate.getTime())) return '';
      return parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
    } catch {
      return '';
    }
  }, [productionDate]);

  // Derived: Total Production (A + B + C)
  const totalProduction = useMemo(() => {
    const a = parseFloat(shiftA) || 0;
    const b = parseFloat(shiftB) || 0;
    const c = parseFloat(shiftC) || 0;
    return a + b + c;
  }, [shiftA, shiftB, shiftC]);

  // Derived: Present Operators (Total - Absent)
  const presentOperators = useMemo(() => {
    const total = parseInt(totalOperators) || 0;
    const absent = parseInt(absentOperators) || 0;
    return Math.max(0, total - absent);
  }, [totalOperators, absentOperators]);

  // Validate form inputs
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!unit) {
      newErrors.unit = 'Unit selection is required.';
    }
    if (!productionDate) {
      newErrors.productionDate = 'Production Date is required.';
    }

    const targetVal = parseFloat(targetKg);
    if (isNaN(targetVal) || targetVal <= 0) {
      newErrors.targetKg = 'Target weight must be a positive number.';
    }

    const aVal = parseFloat(shiftA);
    const bVal = parseFloat(shiftB);
    const cVal = parseFloat(shiftC);
    if (isNaN(aVal) || aVal < 0) newErrors.shiftA = 'Shift A production must be 0 or greater.';
    if (isNaN(bVal) || bVal < 0) newErrors.shiftB = 'Shift B production must be 0 or greater.';
    if (isNaN(cVal) || cVal < 0) newErrors.shiftC = 'Shift C production must be 0 or greater.';

    const runMach = parseInt(runningMachines);
    if (isNaN(runMach) || runMach < 0) {
      newErrors.runningMachines = 'Running machines must be 0 or greater.';
    }

    const rej = parseFloat(rejectKg);
    if (isNaN(rej) || rej < 0) {
      newErrors.rejectKg = 'Reject quantity must be 0 or greater.';
    }

    const hold = parseFloat(holdKg);
    if (isNaN(hold) || hold < 0) {
      newErrors.holdKg = 'Hold quantity must be 0 or greater.';
    }

    const sChange = parseInt(setChange);
    if (isNaN(sChange) || sChange < 0) {
      newErrors.setChange = 'Set change must be 0 or greater.';
    }

    const needle = parseInt(needleBroken);
    if (isNaN(needle) || needle < 0) {
      newErrors.needleBroken = 'Needle broken must be 0 or greater.';
    }

    const sinker = parseInt(sinkerBroken);
    if (isNaN(sinker) || sinker < 0) {
      newErrors.sinkerBroken = 'Sinker broken must be 0 or greater.';
    }

    const oil = parseFloat(oilConsumption);
    if (isNaN(oil) || oil < 0) {
      newErrors.oilConsumption = 'Oil consumption must be 0 or greater.';
    }

    const operators = parseInt(totalOperators);
    if (isNaN(operators) || operators <= 0) {
      newErrors.totalOperators = 'Total operator count must be a positive number.';
    }

    const absent = parseInt(absentOperators);
    if (isNaN(absent) || absent < 0) {
      newErrors.absentOperators = 'Absent operators count must be 0 or greater.';
    } else if (absent > operators) {
      newErrors.absentOperators = 'Absent operators cannot exceed total operators.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClearForm = () => {
    setUnit('EKL');
    setProductionDate('2026-07-10');
    setTargetKg('20000');
    setShiftA('0');
    setShiftB('0');
    setShiftC('0');
    setRunningMachines('0');
    setRejectKg('0');
    setHoldKg('0');
    setSetChange('0');
    setNeedleBroken('0');
    setSinkerBroken('0');
    setOilConsumption('0');
    setTotalOperators('40');
    setAbsentOperators('0');
    setRemarks('');
    setErrors({});
    setUnitSearchQuery('');
  };

  const handleSaveProduction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    const newLog: DailyProductionLog = {
      id: `log-${Date.now()}`,
      unit,
      date: productionDate,
      day: derivedDay,
      targetKg: parseFloat(targetKg) || 0,
      productionShiftA: parseFloat(shiftA) || 0,
      productionShiftB: parseFloat(shiftB) || 0,
      productionShiftC: parseFloat(shiftC) || 0,
      totalProductionKg: totalProduction,
      runningMachines: parseInt(runningMachines) || 0,
      rejectKg: parseFloat(rejectKg) || 0,
      holdKg: parseFloat(holdKg) || 0,
      setChange: parseInt(setChange) || 0,
      needleBrokenPcs: parseInt(needleBroken) || 0,
      sinkerBrokenPcs: parseInt(sinkerBroken) || 0,
      oilConsumptionLtr: parseFloat(oilConsumption) || 0,
      totalOperators: parseInt(totalOperators) || 0,
      absentOperators: parseInt(absentOperators) || 0,
      presentOperators: presentOperators,
      remarks: remarks.trim()
    };

    // Prepend to our list of daily logs for premium visual history
    setDailyLogs(prev => [newLog, ...prev]);

    // Push to Firestore (which broadcasts to all devices via onSnapshot) and sync to Google Sheets
    const dateObj = new Date(productionDate);
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthStr = monthNames[dateObj.getMonth()] || 'July';

    const tgt = parseFloat(targetKg) || 1;
    const runM = parseInt(runningMachines) || 0;
    const totM = 40;
    const idleM = Math.max(0, totM - runM);
    const rej = parseFloat(rejectKg) || 0;
    const hld = parseFloat(holdKg) || 0;
    const totOp = parseInt(totalOperators) || 0;
    const absOp = parseInt(absentOperators) || 0;
    const needle = parseInt(needleBroken) || 0;

    const ledgerPayload: LedgerRecord = {
      id: newLog.id,
      date: productionDate,
      floor: unit,
      month: monthStr,
      year: dateObj.getFullYear() || 2026,
      target: tgt,
      shiftA: parseFloat(shiftA) || 0,
      shiftB: parseFloat(shiftB) || 0,
      shiftC: parseFloat(shiftC) || 0,
      totalProduction: totalProduction,
      runningMachine: runM,
      idleMachine: idleM,
      machineUtilization: totM > 0 ? parseFloat(((runM / totM) * 100).toFixed(1)) : 0,
      idleMachinePct: totM > 0 ? parseFloat(((idleM / totM) * 100).toFixed(1)) : 0,
      idleProduction: idleM * 260,
      efficiency: tgt > 0 ? parseFloat(((totalProduction / tgt) * 100).toFixed(1)) : 0,
      productionPerMachine: parseFloat((totalProduction / Math.max(1, runM)).toFixed(1)),
      reject: rej,
      rejectPct: parseFloat(((rej / Math.max(1, totalProduction)) * 100).toFixed(2)),
      hold: hld,
      holdPct: parseFloat(((hld / Math.max(1, totalProduction)) * 100).toFixed(2)),
      needleBroken: needle,
      needlePerKg: parseFloat((needle / Math.max(1, totalProduction)).toFixed(5)),
      sinkerBroken: parseInt(sinkerBroken) || 0,
      oilConsumption: parseFloat(oilConsumption) || 0,
      productionLossForEfficiency: Math.max(0, tgt - totalProduction),
      capacityUtilization: totM > 0 ? parseFloat(((runM / totM) * 100).toFixed(1)) : 0,
      totalOperator: totOp,
      absent: absOp,
      absentPct: parseFloat(((absOp / Math.max(1, totOp)) * 100).toFixed(1)),
      setChange: parseInt(setChange) || 0,
      remarks: remarks.trim()
    };

    FirestoreSyncService.saveLedgerRecord(ledgerPayload).catch(err => {
      console.warn("Firestore/Sheets ledger save notice:", err);
    });

    // Also call standard onSubmitEntry prop for overall dashboard live updates
    // Map selected Unit's lowercase representation to floorId (e.g. EFL-2 -> efl-2)
    const normalizedFloorId = unit.toLowerCase().replace(' ', '-');
    onSubmitEntry({
      floorId: normalizedFloorId,
      shift: 'C', // Default composite
      fabricType: 'Single Jersey',
      yarnType: '30s Cotton Combed',
      machineId: `M-COMP`,
      productionKg: totalProduction,
      rejectKg: parseFloat(rejectKg) || 0,
      operatorName: 'System Supervisor',
      remarks: `Daily aggregate logged. Remarks: ${remarks}`
    });

    // Reset and close modal
    setIsModalOpen(false);
    
    // Show beautiful green toast notification
    setSuccessToast(`Daily production log for unit ${unit} on ${productionDate} successfully saved to enterprise ERP ledger!`);
    setTimeout(() => {
      setSuccessToast(null);
    }, 6000);
  };

  // Filter the table records
  const filteredLogs = useMemo(() => {
    return dailyLogs.filter(log => {
      const matchSearch = log.unit.toLowerCase().includes(searchText.toLowerCase()) || 
                          log.remarks.toLowerCase().includes(searchText.toLowerCase()) ||
                          log.day.toLowerCase().includes(searchText.toLowerCase()) ||
                          log.date.includes(searchText);
      return matchSearch;
    });
  }, [dailyLogs, searchText]);

  const handleDeleteLog = async (id: string) => {
    if (window.confirm('Are you sure you want to discard this production entry record from the view and delete it from Google Sheets?')) {
      setDailyLogs(prev => prev.filter(log => log.id !== id));
      try {
        await GasClient.deleteProductionEntry(id);
      } catch (err) {
        console.warn("GAS production delete notice:", err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md rounded-xl border border-emerald-100 bg-white p-4 shadow-xl flex items-start gap-3 animate-slide-up">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900">ERP Ledger Sync Successful</h4>
            <p className="mt-1 text-xs font-semibold text-gray-500 leading-normal">{successToast}</p>
          </div>
        </div>
      )}

      {/* Page Title & Floating CTA Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-100 pb-5">
        <div>
          <h1 className="font-sans text-2xl font-black tracking-tight text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-7 w-7 text-[#0F4C81]" />
            Production Entry
          </h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
            Add Daily Knitting Production Performance
          </p>
        </div>

        {/* Floating CTA Button (Top-Right) */}
        <button
          onClick={() => {
            handleClearForm();
            setIsModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F4C81] hover:bg-[#0b3860] px-5 py-3 text-sm font-bold text-white shadow-md hover:shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 cursor-pointer"
          id="btn-add-production"
        >
          <Plus className="h-5 w-5" />
          <span>Add Production</span>
        </button>
      </div>

      {/* Ledger Table / Entry Listing */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-xs overflow-hidden">
            {/* Table Search bar & stats header */}
            <div className="p-4 bg-gray-50/50 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Enterprise Knitting Production logs
              </span>
              <div className="relative max-w-xs w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder="Search by unit, date, day..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3.5 text-xs font-bold text-gray-800 transition-all focus:border-[#0F4C81] focus:outline-hidden"
                />
              </div>
            </div>

            {/* List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">Unit</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">Date & Day</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-right">Target</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-right">Actual Output</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">Defects (Rej/Hold)</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-center">Manpower</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider">Remarks</th>
                    <th className="px-5 py-3 text-[10px] font-black uppercase text-gray-400 tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-xs font-bold text-gray-400 uppercase">
                        No production logs match the filter
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const achievementPct = log.targetKg > 0 ? Math.round((log.totalProductionKg / log.targetKg) * 100) : 0;
                      return (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-all">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-[#0F4C81]">
                              {log.unit}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="font-sans text-xs font-bold text-gray-800">{log.date}</div>
                            <div className="text-[10px] font-semibold text-gray-400 uppercase">{log.day}</div>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className="font-mono text-xs font-bold text-gray-600">
                              {log.targetKg.toLocaleString()} Kg
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <div className="font-mono text-xs font-black text-[#16A34A]">
                              {log.totalProductionKg.toLocaleString()} Kg
                            </div>
                            <div className="text-[10px] font-bold text-gray-400 mt-0.5">
                              {achievementPct}% of target
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center whitespace-nowrap">
                            <div className="text-xs font-semibold text-gray-700">
                              Rej: <span className="font-mono font-bold text-red-500">{log.rejectKg} Kg</span>
                            </div>
                            <div className="text-[10px] font-semibold text-gray-500">
                              Hold: <span className="font-mono font-bold text-amber-500">{log.holdKg} Kg</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center whitespace-nowrap">
                            <div className="text-xs font-bold text-emerald-600">
                              {log.presentOperators}/{log.totalOperators} Operators
                            </div>
                            <div className="text-[10px] text-gray-400 font-bold">
                              {log.absentOperators} Absent
                            </div>
                          </td>
                          <td className="px-5 py-4 max-w-xs">
                            <p className="text-xs text-gray-500 font-semibold truncate" title={log.remarks}>
                              {log.remarks || <span className="italic text-gray-300">No remarks logged</span>}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

      {/* ========================================================== */}
      {/* POPUP (MODAL) : ADD DAILY PRODUCTION */}
      {/* ========================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-gray-100 flex flex-col max-h-[95vh] animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 bg-gray-50/50 rounded-t-2xl">
              <div>
                <h2 className="font-sans text-lg font-black text-[#0F4C81]">
                  Add Daily Production
                </h2>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">
                  Record multi-shift metrics, machine frequency & material losses
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Two Column Grid on Desktop, Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <form onSubmit={handleSaveProduction} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* LEFT COLUMN */}
                  <div className="space-y-6">
                    
                    {/* SECTION 1 : GENERAL INFORMATION */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-4">
                      <h3 className="font-sans text-xs font-black text-[#0F4C81] uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                        <Briefcase className="h-4 w-4" />
                        Section 1 : General Information
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Unit Searchable Dropdown */}
                        <div className="space-y-1 relative">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Unit <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                              className={`w-full rounded-lg border text-left px-3.5 py-2 text-xs font-bold text-gray-800 transition-colors bg-white flex items-center justify-between ${
                                errors.unit ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                              }`}
                            >
                              <span>{unit}</span>
                              <span className="text-gray-400 text-xs">▼</span>
                            </button>

                            {/* Dropdown element */}
                            {isUnitDropdownOpen && (
                              <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-2 space-y-2">
                                <div className="relative">
                                  <input
                                    type="text"
                                    placeholder="Search unit..."
                                    value={unitSearchQuery}
                                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                                    className="w-full text-xs font-semibold p-1.5 pl-7 border border-gray-200 rounded-md focus:outline-hidden focus:border-[#0F4C81]"
                                  />
                                  <Search className="h-3 w-3 text-gray-400 absolute left-2 top-2.5" />
                                </div>
                                <div className="max-h-32 overflow-y-auto divide-y divide-gray-50">
                                  {filteredUnits.length === 0 ? (
                                    <div className="p-2 text-[10px] text-gray-400 text-center uppercase">No units found</div>
                                  ) : (
                                    filteredUnits.map((u) => (
                                      <button
                                        key={u}
                                        type="button"
                                        onClick={() => {
                                          setUnit(u);
                                          setIsUnitDropdownOpen(false);
                                          setUnitSearchQuery('');
                                        }}
                                        className="w-full text-left px-2.5 py-1.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-[#0F4C81] transition-colors rounded-sm"
                                      >
                                        {u}
                                      </button>
                                    ))
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          {errors.unit && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.unit}</p>}
                        </div>

                        {/* Production Date */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Production Date <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              required
                              value={productionDate}
                              onChange={(e) => setProductionDate(e.target.value)}
                              className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                                errors.productionDate ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                              }`}
                            />
                          </div>
                          {errors.productionDate && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.productionDate}</p>}
                        </div>
                      </div>

                      {/* Day Auto-generated */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                          Day (Auto-Generated)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={derivedDay || 'Select valid date'}
                          className="w-full rounded-lg border border-gray-100 bg-gray-100 px-3 py-1.5 text-xs font-black text-gray-500 uppercase tracking-wider outline-hidden"
                        />
                      </div>
                    </div>

                    {/* SECTION 2 : PRODUCTION */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-4">
                      <h3 className="font-sans text-xs font-black text-[#0F4C81] uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                        <Layers className="h-4 w-4" />
                        Section 2 : Production
                      </h3>

                      {/* Total Target */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                          Total Target (Kg) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            required
                            step="any"
                            value={targetKg}
                            onChange={(e) => setTargetKg(e.target.value)}
                            className={`w-full rounded-lg border bg-white py-1.5 pl-3 pr-10 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                              errors.targetKg ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                            }`}
                          />
                          <span className="absolute inset-y-0 right-3 flex items-center font-mono text-[10px] font-bold text-gray-400">Kg</span>
                        </div>
                        {errors.targetKg && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.targetKg}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Shift A */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-500">Shift A (Kg)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={shiftA}
                              onChange={(e) => setShiftA(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-2.5 pr-8 text-xs font-bold text-gray-800 focus:border-[#0F4C81] focus:outline-hidden ${
                                errors.shiftA ? 'border-red-500' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[9px] text-gray-400">Kg</span>
                          </div>
                          {errors.shiftA && <p className="text-[9px] font-bold text-red-500">{errors.shiftA}</p>}
                        </div>

                        {/* Shift B */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-500">Shift B (Kg)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={shiftB}
                              onChange={(e) => setShiftB(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-2.5 pr-8 text-xs font-bold text-gray-800 focus:border-[#0F4C81] focus:outline-hidden ${
                                errors.shiftB ? 'border-red-500' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[9px] text-gray-400">Kg</span>
                          </div>
                          {errors.shiftB && <p className="text-[9px] font-bold text-red-500">{errors.shiftB}</p>}
                        </div>

                        {/* Shift C */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-500">Shift C (Kg)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={shiftC}
                              onChange={(e) => setShiftC(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-2.5 pr-8 text-xs font-bold text-gray-800 focus:border-[#0F4C81] focus:outline-hidden ${
                                errors.shiftC ? 'border-red-500' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[9px] text-gray-400">Kg</span>
                          </div>
                          {errors.shiftC && <p className="text-[9px] font-bold text-red-500">{errors.shiftC}</p>}
                        </div>
                      </div>

                      {/* Total Production Read-Only */}
                      <div className="space-y-1 bg-[#0F4C81]/5 rounded-lg p-2.5 border border-[#0F4C81]/10 flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-[#0F4C81]">Total Production (Calculated)</span>
                          <span className="text-[9px] text-gray-400 font-bold">Shift A + Shift B + Shift C</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-black text-[#0F4C81]">
                            {totalProduction.toLocaleString()} Kg
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* SECTION 5 : MANPOWER */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-4">
                      <h3 className="font-sans text-xs font-black text-[#0F4C81] uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                        <Users className="h-4 w-4" />
                        Section 5 : Manpower
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Total Operator */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Total Operator <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            value={totalOperators}
                            onChange={(e) => setTotalOperators(e.target.value)}
                            className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                              errors.totalOperators ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                            }`}
                          />
                          {errors.totalOperators && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.totalOperators}</p>}
                        </div>

                        {/* Absent */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Absent
                          </label>
                          <input
                            type="number"
                            value={absentOperators}
                            onChange={(e) => setAbsentOperators(e.target.value)}
                            className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                              errors.absentOperators ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                            }`}
                          />
                          {errors.absentOperators && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.absentOperators}</p>}
                        </div>
                      </div>

                      {/* Present Operator Read-Only */}
                      <div className="space-y-1 bg-[#16A34A]/5 rounded-lg p-2.5 border border-[#16A34A]/10 flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] font-black uppercase tracking-wider text-[#16A34A]">Present Operator</span>
                          <span className="text-[9px] text-gray-400 font-bold">Total Operator - Absent</span>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-base font-black text-[#16A34A]">
                            {presentOperators} Operators
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT COLUMN */}
                  <div className="space-y-6">
                    
                    {/* SECTION 3 : MACHINE PERFORMANCE */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-4">
                      <h3 className="font-sans text-xs font-black text-[#0F4C81] uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                        <Cpu className="h-4 w-4" />
                        Section 3 : Machine Performance
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Running Machine */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Running Machine <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            required
                            value={runningMachines}
                            onChange={(e) => setRunningMachines(e.target.value)}
                            className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                              errors.runningMachines ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                            }`}
                          />
                          {errors.runningMachines && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.runningMachines}</p>}
                        </div>

                        {/* Set Change */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Set Change
                          </label>
                          <input
                            type="number"
                            value={setChange}
                            onChange={(e) => setSetChange(e.target.value)}
                            className={`w-full rounded-lg border bg-white px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                              errors.setChange ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                            }`}
                          />
                          {errors.setChange && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.setChange}</p>}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Reject Quantity */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Reject Quantity (Kg)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={rejectKg}
                              onChange={(e) => setRejectKg(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-3 pr-10 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                                errors.rejectKg ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-3 flex items-center font-mono text-[10px] font-bold text-gray-400">Kg</span>
                          </div>
                          {errors.rejectKg && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.rejectKg}</p>}
                        </div>

                        {/* Hold Quantity */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">
                            Hold Quantity (Kg)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={holdKg}
                              onChange={(e) => setHoldKg(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-3 pr-10 text-xs font-bold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden ${
                                errors.holdKg ? 'border-red-500 ring-1 ring-red-200' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-3 flex items-center font-mono text-[10px] font-bold text-gray-400">Kg</span>
                          </div>
                          {errors.holdKg && <p className="text-[10px] font-bold text-red-500 mt-1">{errors.holdKg}</p>}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 4 : CONSUMABLES */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-4">
                      <h3 className="font-sans text-xs font-black text-[#0F4C81] uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                        <Wrench className="h-4 w-4" />
                        Section 4 : Consumables
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Needle Broken */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-500">Needle Broken</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={needleBroken}
                              onChange={(e) => setNeedleBroken(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-2 pr-9 text-xs font-bold text-gray-800 focus:outline-hidden focus:border-[#0F4C81] ${
                                errors.needleBroken ? 'border-red-500' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-2 flex items-center text-[8px] font-bold text-gray-400">PCS</span>
                          </div>
                          {errors.needleBroken && <p className="text-[8px] font-bold text-red-500">{errors.needleBroken}</p>}
                        </div>

                        {/* Sinker Broken */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-500">Sinker Broken</label>
                          <div className="relative">
                            <input
                              type="number"
                              value={sinkerBroken}
                              onChange={(e) => setSinkerBroken(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-2 pr-9 text-xs font-bold text-gray-800 focus:outline-hidden focus:border-[#0F4C81] ${
                                errors.sinkerBroken ? 'border-red-500' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-2 flex items-center text-[8px] font-bold text-gray-400">PCS</span>
                          </div>
                          {errors.sinkerBroken && <p className="text-[8px] font-bold text-red-500">{errors.sinkerBroken}</p>}
                        </div>

                        {/* Oil Consumption */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-extrabold uppercase text-gray-500">Oil (Ltr)</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              value={oilConsumption}
                              onChange={(e) => setOilConsumption(e.target.value)}
                              className={`w-full rounded-lg border bg-white py-1.5 pl-2 pr-9 text-xs font-bold text-gray-800 focus:outline-hidden focus:border-[#0F4C81] ${
                                errors.oilConsumption ? 'border-red-500' : 'border-gray-200'
                              }`}
                            />
                            <span className="absolute inset-y-0 right-2 flex items-center text-[8px] font-bold text-gray-400">Ltr</span>
                          </div>
                          {errors.oilConsumption && <p className="text-[8px] font-bold text-red-500">{errors.oilConsumption}</p>}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 6 : REMARKS */}
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4 space-y-3">
                      <h3 className="font-sans text-xs font-black text-[#0F4C81] uppercase tracking-wider border-b border-gray-100 pb-1.5 flex items-center gap-1.5">
                        <FileText className="h-4 w-4" />
                        Section 6 : Remarks
                      </h3>

                      <div className="space-y-1">
                        <textarea
                          rows={4}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Enter any production issues, machine breakdowns, maintenance notes, yarn shortage, power failure, or additional remarks..."
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 transition-colors focus:border-[#0F4C81] focus:outline-hidden placeholder:text-gray-400"
                        />
                      </div>
                    </div>
                  </div>

                </div>

                {/* ========================================================== */}
                {/* BOTTOM ACTION BAR */}
                {/* ========================================================== */}
                <div className="border-t border-gray-100 pt-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 justify-between">
                  {/* Left Side */}
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto rounded-lg border border-gray-200 hover:bg-gray-50 px-5 py-2 text-xs font-bold text-gray-500 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  {/* Center */}
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1 rounded-lg border border-[#F59E0B]/25 hover:bg-amber-50 px-5 py-2 text-xs font-bold text-[#F59E0B] transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Clear Form</span>
                  </button>

                  {/* Right Side */}
                  <button
                    type="submit"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#0F4C81] hover:bg-[#0b3860] px-6 py-2.5 text-xs font-bold text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                    id="btn-save-production"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save Production</span>
                  </button>
                </div>

              </form>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
