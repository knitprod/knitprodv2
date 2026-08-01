/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { UserRecord } from './UserManagementView';
import { 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  SlidersHorizontal, 
  Edit2, 
  Trash2, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  TrendingUp, 
  Users, 
  Cpu, 
  Percent, 
  Lock,
  ChevronLeft,
  ChevronRight,
  Printer,
  ChevronDown,
  Info,
  Layers2,
  Wrench,
  Droplet,
  Trash,
  Settings,
  ShieldAlert,
  ArrowRight,
  Plus,
  RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LedgerRecord } from '../types';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';


const getLocalStorageTarget = (floorName: string, defaultVal: number) => {
  return defaultVal;
};

const getLocalStorageMachines = (floorName: string, defaultVal: number) => {
  return defaultVal;
};

const formatDateFriendly = (dateStr: string) => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parts[0];
  const monthNum = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[monthNum - 1] || parts[1];
  return `${day} ${monthName} ${year}`;
};

// Helper to generate realistic data from July 1st to July 13th for all 6 floors
export const generateInitialLedger = (): LedgerRecord[] => {
  const records: LedgerRecord[] = [];
  const floorsData = [
    { name: 'EKL', target: getLocalStorageTarget('EKL', 7500), machines: getLocalStorageMachines('EKL', 48), operators: 110 },
    { name: 'EFL', target: getLocalStorageTarget('EFL', 15000), machines: getLocalStorageMachines('EFL', 40), operators: 95 },
    { name: 'EFL-2', target: getLocalStorageTarget('EFL-2', 15000), machines: getLocalStorageMachines('EFL-2', 35), operators: 85 },
    { name: 'Auto Stripe', target: getLocalStorageTarget('Auto Stripe', 12000), machines: getLocalStorageMachines('Auto Stripe', 20), operators: 50 },
    { name: 'EFL-Extension', target: getLocalStorageTarget('EFL-Extension', 15000), machines: getLocalStorageMachines('EFL-Extension', 25), operators: 65 },
    { name: 'ESL-Extension', target: getLocalStorageTarget('ESL-Extension', 10000), machines: getLocalStorageMachines('ESL-Extension', 16), operators: 40 },
  ];

  // July 1 to July 13
  for (let day = 13; day >= 1; day--) {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `2026-07-${dayStr}`;
    const seed = day * 3.5;

    floorsData.forEach((floor, idx) => {
      const targetVariation = Math.round((1 + Math.sin(seed + idx) * 0.04) * floor.target);
      const isEFLExtCritical = floor.name === 'EFL-Extension' && day === 10;
      const factor = isEFLExtCritical ? 0.65 : (0.92 + Math.cos(seed - idx) * 0.05);

      const totalProduction = Math.round(targetVariation * factor);
      const shiftA = Math.round(totalProduction * 0.35);
      const shiftB = Math.round(totalProduction * 0.35);
      const shiftC = totalProduction - shiftA - shiftB;

      const runningMachine = isEFLExtCritical ? 15 : Math.round(floor.machines * (0.85 + Math.sin(seed) * 0.06));
      const idleMachine = floor.machines - runningMachine;
      const machineUtilization = parseFloat(((runningMachine / floor.machines) * 100).toFixed(1));
      const idleMachinePct = parseFloat(((idleMachine / floor.machines) * 100).toFixed(1));
      const idleProduction = idleMachine * 260;

      const efficiency = parseFloat(((totalProduction / targetVariation) * 100).toFixed(1));
      const productionPerMachine = parseFloat((totalProduction / (runningMachine || 1)).toFixed(1));

      // Quality
      const reject = Math.round(totalProduction * (0.012 + Math.sin(seed + idx) * 0.005));
      const rejectPct = parseFloat(((reject / totalProduction) * 100).toFixed(2));
      const hold = Math.round(totalProduction * (0.015 + Math.cos(seed) * 0.007));
      const holdPct = parseFloat(((hold / totalProduction) * 100).toFixed(2));

      // Consumables
      const needleBroken = Math.round(8 + Math.sin(seed * 1.5) * 3 + idx * 2);
      const needlePerKg = parseFloat((needleBroken / totalProduction).toFixed(5));
      const sinkerBroken = Math.round(4 + Math.cos(seed) * 1.5 + idx);
      const oilConsumption = Math.round(15 + Math.sin(seed) * 2 + idx * 2);

      // Performance
      const productionLossForEfficiency = Math.max(0, targetVariation - totalProduction);
      const capacityUtilization = parseFloat(((runningMachine / floor.machines) * 100).toFixed(1));

      // Manpower
      const absent = Math.round(floor.operators * (0.03 + Math.sin(seed + idx) * 0.025));
      const absentPct = parseFloat(((absent / floor.operators) * 100).toFixed(1));

      const setChange = Math.round(1 + (seed % 3));
      const remarksArr = [
        "Normal operation, target achieved.",
        "Minor Lycra breakages sorted out.",
        "Good quality yarn allocation, standard run.",
        "High machine efficiency observed.",
        "Awaiting set setup in morning shift.",
        "Yarn feeding delay in shift C resolved."
      ];
      const remarks = isEFLExtCritical
        ? "Motor malfunction in group B circular frames. Resumed after maintenance."
        : remarksArr[Math.floor((seed + idx) % remarksArr.length)];

      records.push({
        id: `rec-${dateStr}-${floor.name.toLowerCase().replace(' ', '-')}`,
        date: dateStr,
        floor: floor.name,
        month: 'July',
        year: 2026,
        target: targetVariation,
        shiftA,
        shiftB,
        shiftC,
        totalProduction,
        runningMachine,
        idleMachine,
        machineUtilization,
        idleMachinePct,
        idleProduction,
        efficiency,
        productionPerMachine,
        reject,
        rejectPct,
        hold,
        holdPct,
        needleBroken,
        needlePerKg,
        sinkerBroken,
        oilConsumption,
        productionLossForEfficiency,
        capacityUtilization,
        totalOperator: floor.operators,
        absent,
        absentPct,
        setChange,
        remarks
      });
    });
  }
  return records;
};

const ensureUniqueIds = <T extends { id: string }>(items: T[], prefix: string): T[] => {
  const seen = new Set<string>();
  let modified = false;
  const result = items.map((item, idx) => {
    let uniqueId = item.id || `${prefix}-${Date.now()}-${idx}`;
    if (seen.has(uniqueId)) {
      uniqueId = `${uniqueId}-${idx}-${Math.floor(Math.random() * 1000)}`;
      modified = true;
      seen.add(uniqueId);
      return { ...item, id: uniqueId };
    }
    seen.add(uniqueId);
    if (!item.id) {
      modified = true;
      return { ...item, id: uniqueId };
    }
    return item;
  });
  return modified ? result : items;
};

interface ProductionLedgerViewProps {
  currentUser?: UserRecord | null;
}

export default function ProductionLedgerView({ currentUser }: ProductionLedgerViewProps = {}) {
  const isAdmin = currentUser?.userType === 'Admin';
  const [isGasMode, setIsGasMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ledgerGasError, setLedgerGasError] = useState<string | null>(null);

  // Master database state
  const [ledger, setLedgerRaw] = useState<LedgerRecord[]>(() => {
    return generateInitialLedger();
  });

  const setLedger = (value: LedgerRecord[] | ((prev: LedgerRecord[]) => LedgerRecord[])) => {
    setLedgerRaw((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      return ensureUniqueIds(next, 'rec');
    });
  };

  const loadGasLedger = async () => {
    try {
      setLedgerGasError(null);
      const records = await GasClient.fetchLedgerList();
      if (records && Array.isArray(records) && records.length > 0) {
        setLedger(records);
      }
    } catch (e: any) {
      console.warn("Failed to load GAS ledger in background:", e);
      const errMsg = e.message || "Failed to load from Google Sheets.";
      setLedgerGasError(errMsg);
    }
  };

  // 1. Subscribe to Firestore for real-time multi-device ledger sync across mobile/tablet/desktop
  React.useEffect(() => {
    const unsubscribe = FirestoreSyncService.subscribeToLedgerRecords((records) => {
      if (records && Array.isArray(records) && records.length > 0) {
        setLedger(records);
      }
    });

    // Seed initial ledger into Firestore if empty
    const initial = generateInitialLedger();
    FirestoreSyncService.seedInitialDataIfEmpty([], [], initial).catch(err => {
      console.warn("Firestore ledger initial seed check notice:", err);
    });

    return () => unsubscribe();
  }, []);

  // 2. Load mode configuration & fetch GAS records
  React.useEffect(() => {
    const initAndLoad = async () => {
      const config = await GasClient.fetchServerConfig();
      const activeMode = config.databaseMode || GasClient.getDatabaseMode();
      const activeUrl = config.gasWebAppUrl || GasClient.getWebAppUrl();

      if (activeMode === 'gas' && activeUrl) {
        setIsGasMode(true);
        loadGasLedger();
      } else {
        // Fallback: sync with central server DB
        const db = await GasClient.fetchServerDb();
        if (db && Array.isArray(db.ledger) && db.ledger.length > 0) {
          setLedger(db.ledger);
        }
      }
    };
    initAndLoad();
  }, []);

  // 3. Debounced server DB backup to prevent mobile main-thread lag
  React.useEffect(() => {
    if (typeof window !== 'undefined' && ledger.length > 0) {
      const timer = setTimeout(() => {
        GasClient.saveServerDb({ ledger: ledger });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [ledger]);

  // Helper to dynamically fetch total machines per floor unit
  const getTotalMachinesForFloor = (floorName: string) => {
    if (floorName === 'Sub-Contact') return 0;
    
    const defaults: Record<string, number> = {
      'EKL': 48,
      'EFL': 40,
      'EFL-2': 35,
      'Auto Stripe': 20,
      'EFL-Extension': 25,
      'ESL-Extension': 16,
    };
    return defaults[floorName] || 30;
  };

  const getTargetForFloor = (floorName: string) => {
    if (floorName === 'Sub-Contact') return 5000;
    
    const defaults: Record<string, number> = {
      'EKL': 7500,
      'EFL': 15000,
      'EFL-2': 15000,
      'Auto Stripe': 12000,
      'EFL-Extension': 15000,
      'ESL-Extension': 10000,
    };
    return defaults[floorName] || 15000;
  };

  // Helper to centralize all production, quality, manpower, and machine formulas
  const recalculateRecordFields = (record: LedgerRecord): LedgerRecord => {
    const isSubContact = record.floor === 'Sub-Contact';
    const totalM = isSubContact ? 0 : getTotalMachinesForFloor(record.floor);
    const unitTargetCap = getTargetForFloor(record.floor);
    
    // Total production
    const totalProduction = isSubContact ? (record.totalProduction ?? 0) : (record.shiftA + record.shiftB + record.shiftC);
    
    // Idle machine
    const idleMachine = isSubContact ? 0 : Math.max(0, totalM - record.runningMachine);
    
    // Machine utilization %
    const machineUtilization = (!isSubContact && totalM > 0) ? parseFloat(((record.runningMachine / totalM) * 100).toFixed(1)) : 0;
    
    // Idle machine %
    const idleMachinePct = (!isSubContact && totalM > 0) ? parseFloat(((idleMachine / totalM) * 100).toFixed(1)) : 0;
    
    // Idle Production
    const idleProduction = (!isSubContact && idleMachine > 0 && unitTargetCap > 0)
      ? parseFloat(((totalProduction / idleMachine) * (totalM / unitTargetCap)).toFixed(2))
      : 0;
    
    // Production/Machine
    const productionPerMachine = record.runningMachine > 0 ? parseFloat((totalProduction / record.runningMachine).toFixed(1)) : 0;
    
    // Efficiency %: For Sub-Contact, Achievement % = (Total Production ÷ Target) * 100
    let efficiency = 0;
    if (isSubContact) {
      efficiency = record.target > 0 ? parseFloat(((totalProduction / record.target) * 100).toFixed(1)) : 0;
    } else {
      const denom = record.runningMachine * (unitTargetCap / (totalM || 1));
      efficiency = denom > 0 ? parseFloat(((totalProduction / denom) * 100).toFixed(1)) : 0;
    }
    
    // Capacity Utilization %
    const capacityUtilization = isSubContact ? 0 : (unitTargetCap > 0 ? parseFloat(((totalProduction / unitTargetCap) * 100).toFixed(1)) : 0);
    
    // Quality
    const rejectPct = totalProduction > 0 ? parseFloat(((record.reject / totalProduction) * 100).toFixed(2)) : 0;
    const holdPct = totalProduction > 0 ? parseFloat(((record.hold / totalProduction) * 100).toFixed(2)) : 0;
    
    // Consumables
    const needlePerKg = totalProduction > 0 ? parseFloat((record.needleBroken / totalProduction).toFixed(5)) : 0;
    
    // Manpower
    const absentPct = record.totalOperator > 0 ? parseFloat(((record.absent / record.totalOperator) * 100).toFixed(1)) : 0;
    
    // Performance
    const productionLossForEfficiency = Math.max(0, record.target - totalProduction);

    return {
      ...record,
      totalProduction,
      idleMachine,
      machineUtilization,
      idleMachinePct,
      idleProduction,
      productionPerMachine,
      efficiency,
      capacityUtilization,
      rejectPct,
      holdPct,
      needlePerKg,
      absentPct,
      productionLossForEfficiency
    };
  };

  // Enriched ledger state mapping live settings onto all records dynamically
  const enrichedLedger = useMemo(() => {
    return ledger.map(recalculateRecordFields);
  }, [ledger]);

  // Filter States - Defaulting to no date range filtration applied initially
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  // Applied values (so changes only lock in on clicking "Apply Filter")
  const [appliedUnit, setAppliedUnit] = useState<string>('all');
  const [appliedFromDate, setAppliedFromDate] = useState<string>('');
  const [appliedToDate, setAppliedToDate] = useState<string>('');

  // Grid/UI states
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [sortField, setSortField] = useState<keyof LedgerRecord>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Edit / Delete states
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<LedgerRecord | null>(null);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  // Create state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [creatingRecord, setCreatingRecord] = useState<LedgerRecord | null>(null);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  // Success Notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Role check - Only Admin users can delete records
  const userHasDeletePermission = isAdmin;

  // Trigger brief alert notification
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ----------------------------------------------------
  // FILTER BEHAVIOR & ROW QUERY COMPUTATION
  // ----------------------------------------------------
  const filteredRecords = useMemo(() => {
    return enrichedLedger.filter((r) => {
      // Unit filter
      const matchesUnit = appliedUnit === 'all' || r.floor === appliedUnit;

      // Date range filter
      let matchesDate = true;
      if (appliedFromDate && appliedToDate) {
        matchesDate = r.date >= appliedFromDate && r.date <= appliedToDate;
      } else if (appliedFromDate) {
        matchesDate = r.date >= appliedFromDate;
      } else if (appliedToDate) {
        matchesDate = r.date <= appliedToDate;
      }

      // Global Search filter (searches by Date, Floor, Remarks, Month, Year)
      let matchesSearch = true;
      if (globalSearch.trim() !== '') {
        const query = globalSearch.toLowerCase();
        matchesSearch = 
          r.date.toLowerCase().includes(query) ||
          r.floor.toLowerCase().includes(query) ||
          r.remarks.toLowerCase().includes(query) ||
          r.month.toLowerCase().includes(query) ||
          r.year.toString().includes(query);
      }

      return matchesUnit && matchesDate && matchesSearch;
    });
  }, [ledger, appliedUnit, appliedFromDate, appliedToDate, globalSearch]);

  // ----------------------------------------------------
  // SORT LOGIC
  // ----------------------------------------------------
  const sortedRecords = useMemo(() => {
    const data = [...filteredRecords];
    data.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        // Numeric sorting
        return sortAsc 
          ? (valA as number) - (valB as number) 
          : (valB as number) - (valA as number);
      }
    });
    return data;
  }, [filteredRecords, sortField, sortAsc]);

  // ----------------------------------------------------
  // PAGINATION COMPUTATION
  // ----------------------------------------------------
  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, currentPage, pageSize]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [appliedUnit, appliedFromDate, appliedToDate, globalSearch, pageSize]);

  // ----------------------------------------------------
  // DYNAMIC TOP SUMMARY & KPI CALCULATIONS
  // ----------------------------------------------------
  const summaryKPIs = useMemo(() => {
    const totalTarget = filteredRecords.reduce((sum, r) => sum + r.target, 0);
    const totalProduction = filteredRecords.reduce((sum, r) => sum + r.totalProduction, 0);
    const achievementPct = totalTarget > 0 ? parseFloat(((totalProduction / totalTarget) * 100).toFixed(1)) : 0;

    const runningMachine = filteredRecords.reduce((sum, r) => sum + r.runningMachine, 0);
    const idleMachine = filteredRecords.reduce((sum, r) => sum + r.idleMachine, 0);
    const totalMachines = runningMachine + idleMachine;
    const machineUtilization = totalMachines > 0 ? parseFloat(((runningMachine / totalMachines) * 100).toFixed(1)) : 0;

    const totalReject = filteredRecords.reduce((sum, r) => sum + r.reject, 0);
    const rejectPct = totalProduction > 0 ? parseFloat(((totalReject / totalProduction) * 100).toFixed(2)) : 0;
    const totalHold = filteredRecords.reduce((sum, r) => sum + r.hold, 0);
    const holdPct = totalProduction > 0 ? parseFloat(((totalHold / totalProduction) * 100).toFixed(2)) : 0;

    const totalOperators = filteredRecords.reduce((sum, r) => sum + r.totalOperator, 0);
    const totalAbsent = filteredRecords.reduce((sum, r) => sum + r.absent, 0);
    const absentPct = totalOperators > 0 ? parseFloat(((totalAbsent / totalOperators) * 100).toFixed(1)) : 0;

    return {
      totalTarget,
      totalProduction,
      achievementPct,
      runningMachine,
      idleMachine,
      machineUtilization,
      totalReject,
      rejectPct,
      totalHold,
      holdPct,
      totalOperators,
      totalAbsent,
      absentPct
    };
  }, [filteredRecords]);

  // ----------------------------------------------------
  // FLOOR-WISE PERFORMANCE CARD COMPUTATIONS
  // ----------------------------------------------------
  const floorSummaries = useMemo(() => {
    const floorsList = ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension', 'Sub-Contact'];
    
    return floorsList.map((floorName) => {
      const floorRows = filteredRecords.filter((r) => r.floor === floorName);
      
      const target = floorRows.reduce((sum, r) => sum + r.target, 0);
      const production = floorRows.reduce((sum, r) => sum + r.totalProduction, 0);
      const achievementPct = target > 0 ? parseFloat(((production / target) * 100).toFixed(1)) : 0;

      const runningMachine = floorRows.reduce((sum, r) => sum + r.runningMachine, 0);
      const idleMachine = floorRows.reduce((sum, r) => sum + r.idleMachine, 0);
      
      const reject = floorRows.reduce((sum, r) => sum + r.reject, 0);
      const hold = floorRows.reduce((sum, r) => sum + r.hold, 0);
      const absent = floorRows.reduce((sum, r) => sum + r.absent, 0);
      const totalOperator = floorRows.reduce((sum, r) => sum + r.totalOperator, 0);
      const absentPct = totalOperator > 0 ? parseFloat(((absent / totalOperator) * 100).toFixed(1)) : 0;

      const lastUpdated = floorRows.length > 0 ? 'Verified' : 'N/A';

      return {
        name: floorName,
        target,
        production,
        achievementPct,
        runningMachine,
        idleMachine,
        reject,
        hold,
        absent,
        totalOperator,
        absentPct,
        lastUpdated
      };
    });
  }, [filteredRecords]);

  // ----------------------------------------------------
  // HANDLERS: FILTER ACTIONS
  // ----------------------------------------------------
  const handleApplyFilters = () => {
    setAppliedUnit(filterUnit);
    setAppliedFromDate(filterFromDate);
    setAppliedToDate(filterToDate);
    triggerToast("Ledger criteria successfully applied.");
  };

  const handleResetFilters = () => {
    setFilterUnit('all');
    setFilterFromDate('');
    setFilterToDate('');
    setAppliedUnit('all');
    setAppliedFromDate('');
    setAppliedToDate('');
    setGlobalSearch('');
    triggerToast("Ledger criteria reset to show all historical dates.");
  };

  // ----------------------------------------------------
  // HANDLERS: CREATE RECORD FORM
  // ----------------------------------------------------
  const getInitialNewRecord = (floor: string = 'EKL', date: string = '2026-07-13'): LedgerRecord => {
    const floorsMap: Record<string, { machines: number, operators: number, target: number }> = {
      'EKL': { machines: getTotalMachinesForFloor('EKL'), operators: 110, target: getTargetForFloor('EKL') },
      'EFL': { machines: getTotalMachinesForFloor('EFL'), operators: 95, target: getTargetForFloor('EFL') },
      'EFL-2': { machines: getTotalMachinesForFloor('EFL-2'), operators: 85, target: getTargetForFloor('EFL-2') },
      'Auto Stripe': { machines: getTotalMachinesForFloor('Auto Stripe'), operators: 50, target: getTargetForFloor('Auto Stripe') },
      'EFL-Extension': { machines: getTotalMachinesForFloor('EFL-Extension'), operators: 65, target: getTargetForFloor('EFL-Extension') },
      'ESL-Extension': { machines: getTotalMachinesForFloor('ESL-Extension'), operators: 40, target: getTargetForFloor('ESL-Extension') },
      'Sub-Contact': { machines: 0, operators: 0, target: 5000 },
    };
    const fInfo = floorsMap[floor] || { machines: 40, operators: 90, target: 20000 };
    
    // Extract month and year
    const dateParts = date.split('-');
    const yearNum = dateParts.length === 3 ? parseInt(dateParts[0]) : 2026;
    const monthNum = dateParts.length === 3 ? parseInt(dateParts[1]) : 7;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = months[monthNum - 1] || 'July';

    const initial: LedgerRecord = {
      id: `rec-${Date.now()}`,
      date,
      floor,
      month: monthName,
      year: yearNum,
      target: fInfo.target,
      shiftA: 0,
      shiftB: 0,
      shiftC: 0,
      totalProduction: 0,
      runningMachine: fInfo.machines,
      idleMachine: 0,
      machineUtilization: 100,
      idleMachinePct: 0,
      idleProduction: 0,
      efficiency: 0,
      productionPerMachine: 0,
      reject: 0,
      rejectPct: 0,
      hold: 0,
      holdPct: 0,
      needleBroken: 0,
      needlePerKg: 0,
      sinkerBroken: 0,
      oilConsumption: 0,
      productionLossForEfficiency: fInfo.target,
      capacityUtilization: 100,
      totalOperator: fInfo.operators,
      absent: 0,
      absentPct: 0,
      setChange: 0,
      remarks: '',
      productionFlatKnit: 0,
      yarnIssued: 0,
      runningFactories: 0,
      fabricReturn: 0
    };

    return recalculateRecordFields(initial);
  };

  const handleCreateChange = (field: keyof LedgerRecord, value: any) => {
    if (!creatingRecord) return;
    
    let updated = { ...creatingRecord, [field]: value };

    if (field === 'date') {
      const dateParts = value.split('-');
      if (dateParts.length === 3) {
         const yearNum = parseInt(dateParts[0]);
         const monthNum = parseInt(dateParts[1]);
         const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
         updated.month = months[monthNum - 1] || 'July';
         updated.year = yearNum;
      }
    } else if (field === 'floor') {
      const floorsMap: Record<string, { machines: number, operators: number, target: number }> = {
        'EKL': { machines: getTotalMachinesForFloor('EKL'), operators: 110, target: getTargetForFloor('EKL') },
        'EFL': { machines: getTotalMachinesForFloor('EFL'), operators: 95, target: getTargetForFloor('EFL') },
        'EFL-2': { machines: getTotalMachinesForFloor('EFL-2'), operators: 85, target: getTargetForFloor('EFL-2') },
        'Auto Stripe': { machines: getTotalMachinesForFloor('Auto Stripe'), operators: 50, target: getTargetForFloor('Auto Stripe') },
        'EFL-Extension': { machines: getTotalMachinesForFloor('EFL-Extension'), operators: 65, target: getTargetForFloor('EFL-Extension') },
        'ESL-Extension': { machines: getTotalMachinesForFloor('ESL-Extension'), operators: 40, target: getTargetForFloor('ESL-Extension') },
        'Sub-Contact': { machines: 0, operators: 0, target: 5000 },
      };
      const fInfo = floorsMap[value] || { machines: 40, operators: 90, target: 20000 };
      updated.target = fInfo.target;
      updated.totalOperator = fInfo.operators;
      updated.runningMachine = fInfo.machines;
      
      // Initialize sub-contact fields if floor changes to Sub-Contact
      if (value === 'Sub-Contact') {
        updated.productionFlatKnit = updated.productionFlatKnit ?? 0;
        updated.yarnIssued = updated.yarnIssued ?? 0;
        updated.runningFactories = updated.runningFactories ?? 0;
        updated.fabricReturn = updated.fabricReturn ?? 0;
      }
    }

    updated = recalculateRecordFields(updated);
    setCreatingRecord(updated);
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingRecord) return;

    // Basic Validation
    const errors: Record<string, string> = {};
    if (!creatingRecord.date) errors.date = "Production date is required.";
    if (!creatingRecord.floor) errors.floor = "Floor / Unit is required.";
    if (creatingRecord.target <= 0) errors.target = "Target quantity must be positive.";
    
    if (creatingRecord.floor !== 'Sub-Contact') {
      if (creatingRecord.shiftA < 0) errors.shiftA = "Value cannot be negative.";
      if (creatingRecord.shiftB < 0) errors.shiftB = "Value cannot be negative.";
      if (creatingRecord.shiftC < 0) errors.shiftC = "Value cannot be negative.";
    } else {
      if (creatingRecord.totalProduction < 0) errors.totalProduction = "Value cannot be negative.";
      if ((creatingRecord.productionFlatKnit ?? 0) < 0) errors.productionFlatKnit = "Value cannot be negative.";
      if ((creatingRecord.yarnIssued ?? 0) < 0) errors.yarnIssued = "Value cannot be negative.";
      if ((creatingRecord.runningFactories ?? 0) < 0) errors.runningFactories = "Value cannot be negative.";
      if ((creatingRecord.fabricReturn ?? 0) < 0) errors.fabricReturn = "Value cannot be negative.";
    }
    
    if (creatingRecord.runningMachine < 0) errors.runningMachine = "Value cannot be negative.";
    if (creatingRecord.idleMachine < 0) errors.idleMachine = "Value cannot be negative.";
    if (creatingRecord.reject < 0) errors.reject = "Value cannot be negative.";
    if (creatingRecord.hold < 0) errors.hold = "Value cannot be negative.";

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    if (isGasMode) {
      const cleanFloor = (creatingRecord.floor || 'unit').toLowerCase().replace(/[^a-z0-9]/g, '-');
      const tempId = `rec-${creatingRecord.date || '2026-01-01'}-${cleanFloor}-${Date.now()}`;
      const recordWithTempId = { ...creatingRecord, id: tempId };

      setLedger((prev) => [recordWithTempId, ...prev]);
      setIsCreateModalOpen(false);
      setCreatingRecord(null);
      triggerToast(`Production record for ${creatingRecord.floor} on ${creatingRecord.date} saved & syncing across all devices and Google Sheets.`);

      FirestoreSyncService.saveLedgerRecord(recordWithTempId, currentUser?.userName || 'Manager')
        .catch((err: any) => {
          console.warn("Background ledger save notice:", err);
        });
    } else {
      // Add to list and Firestore
      setLedger((prev) => [creatingRecord, ...prev]);
      setIsCreateModalOpen(false);
      FirestoreSyncService.saveLedgerRecord(creatingRecord, currentUser?.userName || 'Manager').catch(err => {
        console.warn("Firestore ledger save notice:", err);
      });
      setCreatingRecord(null);
      triggerToast(`Production record for ${creatingRecord.floor} on ${creatingRecord.date} has been successfully added.`);
    }
  };

  // ----------------------------------------------------
  // HANDLERS: EDIT RECORD FORM
  // ----------------------------------------------------
  const handleOpenEdit = (record: LedgerRecord) => {
    setEditingRecord({ ...record });
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditChange = (field: keyof LedgerRecord, value: any) => {
    if (!editingRecord) return;
    
    let updated = { ...editingRecord, [field]: value };

    if (field === 'date') {
      const dateParts = value.split('-');
      if (dateParts.length === 3) {
        const yearNum = parseInt(dateParts[0]);
        const monthNum = parseInt(dateParts[1]);
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        updated.month = months[monthNum - 1] || 'July';
        updated.year = yearNum;
      }
    }

    updated = recalculateRecordFields(updated);
    setEditingRecord(updated);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    // Basic Validation
    const errors: Record<string, string> = {};
    if (!editingRecord.date) errors.date = "Production date is required.";
    if (editingRecord.target <= 0) errors.target = "Target quantity must be positive.";
    
    if (editingRecord.floor !== 'Sub-Contact') {
      if (editingRecord.shiftA < 0) errors.shiftA = "Value cannot be negative.";
      if (editingRecord.shiftB < 0) errors.shiftB = "Value cannot be negative.";
      if (editingRecord.shiftC < 0) errors.shiftC = "Value cannot be negative.";
    } else {
      if (editingRecord.totalProduction < 0) errors.totalProduction = "Value cannot be negative.";
      if ((editingRecord.productionFlatKnit ?? 0) < 0) errors.productionFlatKnit = "Value cannot be negative.";
      if ((editingRecord.yarnIssued ?? 0) < 0) errors.yarnIssued = "Value cannot be negative.";
      if ((editingRecord.runningFactories ?? 0) < 0) errors.runningFactories = "Value cannot be negative.";
      if ((editingRecord.fabricReturn ?? 0) < 0) errors.fabricReturn = "Value cannot be negative.";
    }
    
    if (editingRecord.runningMachine < 0) errors.runningMachine = "Value cannot be negative.";
    if (editingRecord.idleMachine < 0) errors.idleMachine = "Value cannot be negative.";
    if (editingRecord.reject < 0) errors.reject = "Value cannot be negative.";
    if (editingRecord.hold < 0) errors.hold = "Value cannot be negative.";

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    const recordToSave = { ...editingRecord };
    setLedger((prev) => prev.map((r) => (r.id === recordToSave.id ? recordToSave : r)));
    setIsEditModalOpen(false);
    setEditingRecord(null);
    triggerToast(`Production record for ${recordToSave.floor} on ${recordToSave.date} updated & syncing across devices.`);

    FirestoreSyncService.saveLedgerRecord(recordToSave, currentUser?.userName || 'Manager')
      .catch((err: any) => {
        console.warn("Background ledger update notice:", err);
      });
  };

  // ----------------------------------------------------
  // HANDLERS: DELETE RECORD
  // ----------------------------------------------------
  const handleOpenDelete = (id: string) => {
    if (!userHasDeletePermission) {
      triggerToast("Access Denied: Delete action requires Administrator rights.");
      return;
    }
    setDeletingRecordId(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingRecordId) return;

    const targetId = deletingRecordId;
    const targetRecord = ledger.find(r => r.id === targetId);
    const details = targetRecord ? `${targetRecord.floor} on ${targetRecord.date}` : '';

    setLedger((prev) => prev.filter((r) => r.id !== targetId));
    setIsDeleteConfirmOpen(false);
    setDeletingRecordId(null);
    triggerToast(`Production record for ${details} deleted & syncing across devices.`);

    FirestoreSyncService.deleteLedgerRecord(targetId)
      .catch((err: any) => {
        console.warn("Background ledger delete notice:", err);
      });
  };

  // ----------------------------------------------------
  // HANDLERS: EXPORT EXCEL
  // ----------------------------------------------------
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      triggerToast("No records available to export for the applied filter.");
      return;
    }

    // Double row header configuration
    const headers = [
      [
        "General Information", "", "", "",
        "Production Data", "", "", "", "", "",
        "Machine Performance Logs", "", "", "", "", "", "",
        "Quality Indices", "", "", "",
        "Consumables Ledger", "", "", "",
        "Efficiency Loss Projections", "",
        "Manpower Roster", "", "",
        "Other Operational Parameters", "",
        "Sub-Contact Parameters", "", "", "", ""
      ],
      [
        "Calendar Year", "Month Name", "Date (DD MMM YYYY)", "Floor / Unit",
        "Target Output (Kg)", "Shift A Output (Kg)", "Shift B Output (Kg)", "Shift C Output (Kg)", "Cumulative Yield (Kg)", "Achievement (%)",
        "Active Machines", "Idle Machines", "Utilization Rate (%)", "Idle Rate (%)", "Idle Production Lost (Kg)", "Net Efficiency (%)", "Production per Active Frame (Kg)",
        "Reject Scrap (Kg)", "Reject Rate (%)", "Hold Scrap (Kg)", "Hold Rate (%)",
        "Needles Broken (Pcs)", "Needle Rate (Pcs/Kg)", "Sinkers Broken (Pcs)", "Lubricating Oil (Liters)",
        "Yield Deficit vs Plan (Kg)", "Installed Capacity Ratio (%)",
        "Roster Active Operators", "Operators Absent", "Absenteeism Rate (%)",
        "Set Changes Completed", "Shift Handover Remarks",
        "Production Flat Knit (PCS)", "Yarn Issued (Kg)", "Running Factories", "Running Machine", "Fabric Return (Kg)"
      ]
    ];

    const rows = filteredRecords.map(r => {
      const ach = r.target > 0 ? parseFloat(((r.totalProduction / r.target) * 100).toFixed(1)) : 0;
      const isSC = r.floor === 'Sub-Contact';
      return [
        r.year, r.month, formatDateFriendly(r.date), r.floor,
        r.target, r.shiftA, r.shiftB, r.shiftC, r.totalProduction, ach,
        isSC ? "" : r.runningMachine, isSC ? "" : r.idleMachine, isSC ? "" : r.machineUtilization, isSC ? "" : r.idleMachinePct, isSC ? "" : r.idleProduction, r.efficiency, r.productionPerMachine,
        r.reject, r.rejectPct, r.hold, r.holdPct,
        r.needleBroken, r.needlePerKg, r.sinkerBroken, r.oilConsumption,
        r.productionLossForEfficiency, r.capacityUtilization,
        r.totalOperator, r.absent, r.absentPct,
        r.setChange, r.remarks,
        isSC ? (r.productionFlatKnit ?? 0) : "",
        isSC ? (r.yarnIssued ?? 0) : "",
        isSC ? (r.runningFactories ?? 0) : "",
        isSC ? (r.runningMachine ?? 0) : "",
        isSC ? (r.fabricReturn ?? 0) : ""
      ];
    });

    const worksheetData = [...headers, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Merge group category headers
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // General Information
      { s: { r: 0, c: 4 }, e: { r: 0, c: 9 } }, // Production Data
      { s: { r: 0, c: 10 }, e: { r: 0, c: 16 } }, // Machine Performance
      { s: { r: 0, c: 17 }, e: { r: 0, c: 20 } }, // Quality Indices
      { s: { r: 0, c: 21 }, e: { r: 0, c: 24 } }, // Consumables
      { s: { r: 0, c: 25 }, e: { r: 0, c: 26 } }, // Efficiency Loss
      { s: { r: 0, c: 27 }, e: { r: 0, c: 29 } }, // Manpower Roster
      { s: { r: 0, c: 30 }, e: { r: 0, c: 31 } }, // Other Parameters
      { s: { r: 0, c: 32 }, e: { r: 0, c: 36 } }  // Sub-Contact Parameters
    ];

    // Set precise column widths to look incredibly tidy
    const colWidths = [
      { wch: 8 }, { wch: 12 }, { wch: 15 }, { wch: 18 },
      { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
      { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 22 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
      { wch: 24 }, { wch: 24 },
      { wch: 18 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 35 },
      { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Production Ledger");

    // Dynamic clean naming rules
    let filename = `Production_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
    if (appliedUnit !== 'all') {
      const cleanUnitName = appliedUnit.replace(/\s+/g, '_');
      if (appliedFromDate && appliedToDate) {
        filename = `${cleanUnitName}_Production_${appliedFromDate}_to_${appliedToDate}.xlsx`;
      } else {
        filename = `${cleanUnitName}_Production_Ledger_${new Date().toISOString().split('T')[0]}.xlsx`;
      }
    } else if (appliedFromDate && appliedToDate) {
      filename = `Production_Ledger_${appliedFromDate}_to_${appliedToDate}.xlsx`;
    }

    XLSX.writeFile(workbook, filename);
    triggerToast(`Successfully generated and dispatched Excel sheet: ${filename}`);
  };



  return (
    <div className="space-y-6">
      {/* 1. Header Section */}
      <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-sans text-2xl font-black tracking-tight text-gray-950 dark:text-white">
              Production Update Ledger
            </h1>
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">
              Monitor, Search, Edit and Manage Daily Production Records
            </p>
            {appliedUnit === 'all' && appliedFromDate === '2026-07-12' && appliedToDate === '2026-07-12' && (
              <div className="mt-2 flex">
                <span className="text-[10px] font-black bg-emerald-500/15 text-emerald-800 dark:text-emerald-400 px-3 py-1 rounded-full uppercase border border-emerald-500/25 animate-pulse">
                  Viewing Default: Yesterday
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isGasMode && (
              <button
                onClick={loadGasLedger}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg hover:bg-blue-100/50 dark:hover:bg-blue-900/40 disabled:opacity-50 transition-colors cursor-pointer"
                title="Synchronize ledger with Google Sheets"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Google Sheet'}</span>
              </button>
            )}
            <span className="text-[10px] font-black uppercase bg-[#0F4C81]/15 text-[#0F4C81] dark:text-blue-300 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-[#0F4C81]/20">
              {isGasMode ? 'Database: Google Sheets (Live)' : 'Database: Local Mock DB'}
            </span>
            <span className="text-[10px] font-black uppercase bg-[#0F4C81]/15 text-[#0F4C81] dark:text-blue-300 dark:bg-blue-950/40 px-3 py-1 rounded-full border border-[#0F4C81]/20">
              Role: Sr. Production Manager
            </span>
          </div>
        </div>
      </div>

      {/* Success/Action notification popup banner */}
      {toastMessage && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-sm flex items-center gap-2.5 animate-fade-in">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. Top Summary KPI Row (Displays Yesterday's Data by default, or Filtered Data if criteria matches) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5" id="ledger-kpi-dashboard">
        {/* Metric 1: Total Target */}
        <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">🎯 Total Target</span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[#0F4C81] dark:text-blue-300">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1">
            <span className="font-mono text-xl font-black text-gray-950 dark:text-white">
              {summaryKPIs.totalTarget.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-gray-400 ml-1">Kg</span>
          </div>
          <p className="text-[10px] font-semibold text-gray-400 mt-1 whitespace-nowrap">
            {appliedFromDate === '2026-07-12' && appliedToDate === '2026-07-12' && appliedUnit === 'all'
              ? "Plan target for Yesterday"
              : "Plan target for selected filters"}
          </p>
        </div>

        {/* Metric 2: Total Production */}
        <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">🏭 Total Production</span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
              <Layers2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1">
            <span className="font-mono text-xl font-black text-gray-950 dark:text-white">
              {summaryKPIs.totalProduction.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-gray-400 ml-1">Kg</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-sm ${
              summaryKPIs.achievementPct >= 95 
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' 
                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
            }`}>
              {summaryKPIs.achievementPct}% Achieved
            </span>
          </div>
        </div>

        {/* Metric 3: Machine Status */}
        <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">⚙ Machine Status</span>
            <div className="h-7 w-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-lg font-black text-gray-950 dark:text-white" title="Running">
              {summaryKPIs.runningMachine}
            </span>
            <span className="text-[10px] font-bold text-emerald-600">Active</span>
            <span className="text-gray-300 dark:text-slate-700 font-mono">/</span>
            <span className="font-mono text-lg font-black text-gray-400 dark:text-slate-500" title="Idle">
              {summaryKPIs.idleMachine}
            </span>
            <span className="text-[10px] font-bold text-amber-500">Idle</span>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <div className="w-full bg-gray-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-[#0F4C81] h-full rounded-full transition-all"
                style={{ width: `${summaryKPIs.machineUtilization}%` }}
              />
            </div>
            <span className="font-mono text-[9px] font-black text-gray-600 dark:text-slate-400 whitespace-nowrap">
              {summaryKPIs.machineUtilization}% Util
            </span>
          </div>
        </div>

        {/* Metric 4: Quality Status */}
        <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">✅ Quality Status</span>
            <div className="h-7 w-7 rounded-lg bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-300">
              <ShieldAlert className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1 flex justify-between">
            <div>
              <span className="font-mono text-sm font-black text-red-600 dark:text-red-400">
                {summaryKPIs.totalReject.toLocaleString()}
              </span>
              <span className="text-[9px] font-semibold text-gray-400 block">Reject ({summaryKPIs.rejectPct}%)</span>
            </div>
            <div className="w-px bg-gray-100 dark:bg-slate-800 mx-1.5" />
            <div>
              <span className="font-mono text-sm font-black text-amber-600 dark:text-amber-400">
                {summaryKPIs.totalHold.toLocaleString()}
              </span>
              <span className="text-[9px] font-semibold text-gray-400 block">Hold ({summaryKPIs.holdPct}%)</span>
            </div>
          </div>
          <p className="text-[9px] font-bold text-gray-400 mt-2 text-right">
            Cumulative Scrap: {(summaryKPIs.rejectPct + summaryKPIs.holdPct).toFixed(2)}%
          </p>
        </div>

        {/* Metric 5: Attendance */}
        <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">👥 Attendance</span>
            <div className="h-7 w-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-600 dark:text-orange-300">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-1">
            <span className="font-mono text-xl font-black text-gray-950 dark:text-white">
              {summaryKPIs.totalOperators.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-gray-400 ml-1">Total Staff</span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px]">
            <span className="font-semibold text-red-600 dark:text-red-400">
              {summaryKPIs.totalAbsent} Absent
            </span>
            <span className="font-mono font-bold bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-1 py-0.5 rounded-xs">
              {summaryKPIs.absentPct}% Absent
            </span>
          </div>
        </div>
      </div>

      {/* 5. Floor Performance Breakdowns */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-1.5">
          <Layers className="h-4.5 w-4.5 text-[#0F4C81]" />
          <h2 className="font-sans text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Floor wise Production update.
          </h2>
        </div>

        <div className="flex flex-row overflow-x-auto gap-4 pb-3 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-slate-850">
          {floorSummaries.map((f) => (
            <div 
              key={f.name}
              className="rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4.5 shadow-xs hover:shadow-md transition-all duration-200 w-80 flex-shrink-0"
            >
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800 pb-2 mb-2.5">
                <span className="text-xs font-black text-gray-900 dark:text-white tracking-wide">{f.name} Unit</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm ${
                  f.achievementPct >= 95 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                    : f.achievementPct >= 80 
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' 
                      : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                }`}>
                  {f.achievementPct}% Achieved
                </span>
              </div>

              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Target</span>
                  <span className="font-mono font-black text-gray-800 dark:text-slate-200">
                    {f.target.toLocaleString()} <span className="text-[9px] text-gray-400">Kg</span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Production</span>
                  <span className="font-mono font-black text-gray-900 dark:text-white">
                    {f.production.toLocaleString()} <span className="text-[9px] text-gray-400">Kg</span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Running M/C</span>
                  <span className="font-mono font-semibold text-gray-800 dark:text-slate-200">
                    {f.runningMachine} <span className="text-[9px] text-gray-400">Active</span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Idle M/C</span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {f.idleMachine} <span className="text-[9px] text-gray-400">Setup</span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">QA Reject / Hold</span>
                  <span className="font-mono font-semibold text-red-600 dark:text-red-400">
                    {f.reject} <span className="text-gray-400 text-[9px]">/</span> {f.hold} <span className="text-[9px] text-gray-400">Kg</span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase font-bold block">Absent Operators</span>
                  <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                    {f.absent} <span className="text-[9px] text-gray-400">({f.absentPct}%)</span>
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-50 dark:border-slate-800 pt-2 mt-3 flex items-center justify-between text-[10px] font-bold text-gray-400">
                <span>Database Allocation: Online</span>
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Fully Synced
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Filter Criteria Panel */}
      <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[#0F4C81]" />
            <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
              Ledger Query Filter Panel
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 items-end">
          {/* Unit selection */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">🏭 Factory Floor / Unit</label>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-slate-200 transition-colors focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
              id="filter-unit-dropdown"
            >
              <option value="all">All Units</option>
              <option value="EKL">EKL</option>
              <option value="EFL">EFL</option>
              <option value="EFL-2">EFL-2</option>
              <option value="Auto Stripe">Auto Stripe</option>
              <option value="EFL-Extension">EFL-Extension</option>
              <option value="ESL-Extension">ESL-Extension</option>
              <option value="Sub-Contact">Sub-Contact</option>
            </select>
          </div>

          {/* From Date picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">📅 From Date</label>
            <div className="relative">
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-slate-200 transition-colors focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
                id="filter-from-date-input"
              />
            </div>
          </div>

          {/* To Date picker */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">📅 To Date</label>
            <div className="relative">
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-700 dark:text-slate-200 transition-colors focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
                id="filter-to-date-input"
              />
            </div>
          </div>

          {/* Action buttons (Adjusted fully responsive for mobile stacking) */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C81] hover:bg-[#0b3861] text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer w-full"
              id="apply-ledger-filter-btn"
            >
              <Filter className="h-4 w-4" />
              <span>Apply Criteria</span>
            </button>
            <button
              onClick={handleResetFilters}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 px-4 py-2.5 text-xs font-bold transition-all cursor-pointer w-full"
              id="reset-ledger-filter-btn"
            >
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Production Update Ledger Table Widget */}
      <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        {/* Table Top bar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-gray-50 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-[#0F4C81]" />
            <div>
              <h2 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
                Daily Records Spreadsheet ({sortedRecords.length} items found)
              </h2>
              <p className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase">
                Consolidated raw metrics matching query rules
              </p>
            </div>
          </div>

          {/* Table Actions without Search Box */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto">
            {/* Add Production Entry Button */}
            <button
              onClick={() => {
                setCreatingRecord(getInitialNewRecord());
                setCreateErrors({});
                setIsCreateModalOpen(true);
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F4C81] hover:bg-[#0b3861] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
              id="add-production-entry-btn"
            >
              <Plus className="h-4 w-4" />
              <span>Add Production Entry</span>
            </button>

            {/* Export To Excel Button */}
            <button
              onClick={handleExportExcel}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#16A34A] hover:bg-[#11823b] text-white px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
              id="export-excel-btn"
            >
              <Download className="h-4 w-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Dynamic Pagination sizing */}
        <div className="flex items-center justify-between text-xs text-gray-500 font-semibold">
          <div className="flex items-center gap-1.5">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value))}
              className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-slate-200 outline-hidden focus:border-[#0F4C81]"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>records per page</span>
          </div>
          <div>
            <span>Showing {sortedRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedRecords.length)} of {sortedRecords.length} entries</span>
          </div>
        </div>

        {/* Grouped Header Data Table with Sticky Column */}
        <div className="overflow-x-auto border border-gray-100 dark:border-slate-800 rounded-xl max-h-[500px]">
          <table className="w-full text-left text-[11px] font-semibold border-collapse">
            {/* Double Row Grouped Headers */}
            <thead className="sticky top-0 z-20 bg-gray-50 dark:bg-slate-800 shadow-sm">
              <tr className="border-b border-gray-100 dark:border-slate-700 text-[10px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-wider text-center divide-x divide-gray-100 dark:divide-slate-700">
                <th colSpan={4} className="px-3 py-2 bg-blue-50/50 dark:bg-slate-900/60">General Information</th>
                <th colSpan={8} className="px-3 py-2 bg-emerald-50/20 dark:bg-slate-900/40">Production</th>
                <th colSpan={7} className="px-3 py-2 bg-blue-50/50 dark:bg-slate-900/60">Machine Performance</th>
                <th colSpan={4} className="px-3 py-2 bg-red-50/20 dark:bg-slate-900/40">Quality Standards</th>
                <th colSpan={4} className="px-3 py-2 bg-blue-50/50 dark:bg-slate-900/60">Consumables</th>
                <th colSpan={1} className="px-3 py-2 bg-orange-50/20 dark:bg-slate-900/40">Performance Projections</th>
                <th colSpan={3} className="px-3 py-2 bg-blue-50/50 dark:bg-slate-900/60">Manpower Status</th>
                <th colSpan={2} className="px-3 py-2 bg-emerald-50/20 dark:bg-slate-900/40">Other Variables</th>
                <th colSpan={5} className="px-3 py-2 bg-indigo-50/30 dark:bg-slate-900/50">Sub-Contact Parameters</th>
                <th rowSpan={2} className="px-4 py-2 bg-gray-100 dark:bg-slate-850 text-gray-500 font-bold sticky right-0 z-30">Actions</th>
              </tr>
              <tr className="border-b border-gray-100 dark:border-slate-700 text-[9px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap divide-x divide-gray-100 dark:divide-slate-700">
                {/* General */}
                <th className="px-2.5 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-left" onClick={() => { setSortField('year'); setSortAsc(!sortAsc); }}>Year {sortField === 'year' && (sortAsc ? '▲' : '▼')}</th>
                <th className="px-2.5 py-2.5 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700 text-left" onClick={() => { setSortField('month'); setSortAsc(!sortAsc); }}>Month {sortField === 'month' && (sortAsc ? '▲' : '▼')}</th>
                <th className="px-3.5 py-2.5 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('date'); setSortAsc(!sortAsc); }}>Date (DD MMM YYYY) {sortField === 'date' && (sortAsc ? '▲' : '▼')}</th>
                <th className="px-3.5 py-2.5 text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('floor'); setSortAsc(!sortAsc); }}>Unit {sortField === 'floor' && (sortAsc ? '▲' : '▼')}</th>
                {/* Production */}
                <th className="px-3 py-2.5 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('target'); setSortAsc(!sortAsc); }}>Target (Kg)</th>
                <th className="px-2.5 py-2.5 text-right">Shift A</th>
                <th className="px-2.5 py-2.5 text-right">Shift B</th>
                <th className="px-2.5 py-2.5 text-right">Shift C</th>
                <th className="px-3 py-2.5 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('totalProduction'); setSortAsc(!sortAsc); }}>Total Prod (Kg) {sortField === 'totalProduction' && (sortAsc ? '▲' : '▼')}</th>
                <th className="px-3 py-2.5 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('efficiency'); setSortAsc(!sortAsc); }}>Achievement % {sortField === 'efficiency' && (sortAsc ? '▲' : '▼')}</th>
                <th className="px-2.5 py-2.5 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('efficiency'); setSortAsc(!sortAsc); }}>Efficiency %</th>
                <th className="px-2.5 py-2.5 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('capacityUtilization'); setSortAsc(!sortAsc); }}>Cap Util %</th>
                {/* Machine */}
                <th className="px-2.5 py-2.5 text-center">Total M/C</th>
                <th className="px-2.5 py-2.5 text-center">Running</th>
                <th className="px-2.5 py-2.5 text-center">Idle</th>
                <th className="px-2.5 py-2.5 text-center">Machine Util %</th>
                <th className="px-2.5 py-2.5 text-center">Idle Machine %</th>
                <th className="px-2.5 py-2.5 text-right">Idle Prod Loss (Kg)</th>
                <th className="px-2.5 py-2.5 text-right">Prod/Machine</th>
                {/* Quality */}
                <th className="px-2.5 py-2.5 text-right">Reject (Kg)</th>
                <th className="px-2.5 py-2.5 text-right">Reject %</th>
                <th className="px-2.5 py-2.5 text-right">Hold (Kg)</th>
                <th className="px-2.5 py-2.5 text-right">Hold %</th>
                {/* Consumables */}
                <th className="px-2.5 py-2.5 text-center">Needle Broken</th>
                <th className="px-2.5 py-2.5 text-center">Needle / Kg</th>
                <th className="px-2.5 py-2.5 text-center">Sinker Broken</th>
                <th className="px-2.5 py-2.5 text-center">Oil Cons (Ltr)</th>
                {/* Performance */}
                <th className="px-2.5 py-2.5 text-right">Loss for Efficiency</th>
                {/* Manpower */}
                <th className="px-2.5 py-2.5 text-center">Total Staff</th>
                <th className="px-2.5 py-2.5 text-center">Absent</th>
                <th className="px-2.5 py-2.5 text-center">Absent %</th>
                {/* Other */}
                <th className="px-2.5 py-2.5 text-center">Set Change</th>
                <th className="px-4 py-2.5 text-left">Remarks</th>
                {/* Sub-Contact */}
                <th className="px-2.5 py-2.5 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('productionFlatKnit'); setSortAsc(!sortAsc); }}>Flat Knit (PCS)</th>
                <th className="px-2.5 py-2.5 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('yarnIssued'); setSortAsc(!sortAsc); }}>Yarn Issued (Kg)</th>
                <th className="px-2.5 py-2.5 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('runningFactories'); setSortAsc(!sortAsc); }}>Running Factories</th>
                <th className="px-2.5 py-2.5 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('runningMachine'); setSortAsc(!sortAsc); }}>Running Machine</th>
                <th className="px-2.5 py-2.5 text-right cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => { setSortField('fabricReturn'); setSortAsc(!sortAsc); }}>Fabric Return (Kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-700 dark:text-slate-300">
              {paginatedRecords.map((r, index) => (
                <tr 
                  key={r.id} 
                  className={`hover:bg-blue-50/20 dark:hover:bg-slate-800/40 transition-colors divide-x divide-gray-50 dark:divide-slate-800 ${
                    index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/30 dark:bg-slate-900/50'
                  }`}
                >
                  {/* General */}
                  <td className="px-2.5 py-3 text-gray-400 font-mono whitespace-nowrap">{r.year}</td>
                  <td className="px-2.5 py-3 text-gray-400 whitespace-nowrap">{r.month}</td>
                  <td className="px-3.5 py-3 font-mono font-bold whitespace-nowrap text-gray-900 dark:text-slate-100">{formatDateFriendly(r.date)}</td>
                  <td className="px-3.5 py-3 font-black whitespace-nowrap text-gray-900 dark:text-slate-100">{r.floor}</td>

                  {/* Production */}
                  <td className="px-3 py-3 font-mono font-semibold text-right whitespace-nowrap text-gray-500">{r.target.toLocaleString()}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-gray-500">{r.shiftA.toLocaleString()}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-gray-500">{r.shiftB.toLocaleString()}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-gray-500">{r.shiftC.toLocaleString()}</td>
                  <td className="px-3 py-3 font-mono font-black text-right whitespace-nowrap text-[#0F4C81] dark:text-blue-300">{r.totalProduction.toLocaleString()}</td>
                  <td className="px-3 py-3 font-mono font-black text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">{(r.target > 0 ? (r.totalProduction / r.target) * 100 : 0).toFixed(1)}%</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-sm font-black text-[10px] ${
                      r.efficiency >= 95 
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' 
                        : r.efficiency >= 85 
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' 
                          : 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                    }`}>
                      {r.efficiency}%
                    </span>
                  </td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.capacityUtilization}%</td>

                  {/* Machine */}
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-400">{getTotalMachinesForFloor(r.floor)}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-emerald-600 font-bold">{r.runningMachine}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-400">{r.idleMachine}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap font-bold text-gray-800 dark:text-slate-200">{r.machineUtilization}%</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-400">{r.idleMachinePct}%</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-gray-400">{r.idleProduction.toLocaleString()}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-gray-500">{r.productionPerMachine}</td>

                  {/* Quality */}
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-red-600 font-bold">{r.reject.toLocaleString()}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-red-500">{r.rejectPct}%</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-amber-600">{r.hold.toLocaleString()}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-amber-500">{r.holdPct}%</td>

                  {/* Consumables */}
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.needleBroken}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-400">{r.needlePerKg.toFixed(4)}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.sinkerBroken}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.oilConsumption}</td>

                  {/* Performance */}
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-red-500">{r.productionLossForEfficiency.toLocaleString()}</td>

                  {/* Manpower */}
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.totalOperator}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-red-500">{r.absent}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-red-400">{r.absentPct}%</td>

                  {/* Other */}
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.setChange}</td>
                  <td className="px-4 py-3 whitespace-normal max-w-xs text-gray-500 truncate" title={r.remarks}>{r.remarks}</td>

                  {/* Sub-Contact */}
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.floor === 'Sub-Contact' ? (r.productionFlatKnit ?? 0).toLocaleString() : ''}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-gray-500">{r.floor === 'Sub-Contact' ? (r.yarnIssued ?? 0).toLocaleString() : ''}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.floor === 'Sub-Contact' ? (r.runningFactories ?? 0).toLocaleString() : ''}</td>
                  <td className="px-2.5 py-3 font-mono text-center whitespace-nowrap text-gray-500">{r.floor === 'Sub-Contact' ? (r.runningMachine ?? 0).toLocaleString() : ''}</td>
                  <td className="px-2.5 py-3 font-mono text-right whitespace-nowrap text-gray-500">{r.floor === 'Sub-Contact' ? (r.fabricReturn ?? 0).toLocaleString() : ''}</td>

                  {/* Sticky right actions row */}
                  <td className="px-4 py-3 text-center whitespace-nowrap sticky right-0 bg-white dark:bg-slate-900 z-10">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(r)}
                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[#0F4C81] hover:bg-[#0F4C81]/10 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                        title="Edit entry details"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handleOpenDelete(r.id)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {sortedRecords.length === 0 && (
                <tr>
                  <td colSpan={38} className="py-16 text-center text-xs font-black text-gray-400 uppercase tracking-widest">
                    No active daily logs found matching query filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-gray-400">
          <span>Page {currentPage} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 disabled:opacity-40 transition-all hover:bg-gray-50 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              // Sliding window of page numbers
              let pageNum = i + 1;
              if (currentPage > 3 && totalPages > 5) {
                if (currentPage + 2 > totalPages) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-8 w-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentPage === pageNum 
                      ? 'bg-[#0F4C81] text-white shadow-sm' 
                      : 'border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 disabled:opacity-40 transition-all hover:bg-gray-50 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 7. POPUP MODAL: EDIT PRODUCTION RECORD */}
      {isEditModalOpen && editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-[#0F4C81]" />
                <div>
                  <h3 className="font-sans text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider">
                    Edit Production Record
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">
                    Mutate values for {editingRecord.floor} on {editingRecord.date}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setIsEditModalOpen(false); setEditingRecord(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {editingRecord.floor === 'Sub-Contact' ? (
                /* Sub-Contact Data Entry Form */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* General Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> General Information
                    </h4>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Production Date</label>
                      <input
                        type="date"
                        value={editingRecord.date}
                        onChange={(e) => handleEditChange('date', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Floor Unit</label>
                      <input
                        type="text"
                        readOnly
                        value={editingRecord.floor}
                        className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-gray-500 tracking-wider outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Production Weights Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Production Weights
                    </h4>
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Target (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.target}
                          onChange={(e) => handleEditChange('target', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Total Prod (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.totalProduction}
                          onChange={(e) => handleEditChange('totalProduction', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Achievement %</label>
                      <input
                        type="text"
                        readOnly
                        value={`${editingRecord.target > 0 ? Math.round((editingRecord.totalProduction / editingRecord.target) * 100) : 0}%`}
                        className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Quality Standards Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" /> Quality Indices
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Reject (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.reject}
                          onChange={(e) => handleEditChange('reject', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Hold (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.hold}
                          onChange={(e) => handleEditChange('hold', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-gray-400 block uppercase font-bold">Reject rate</span>
                        <span className="font-mono font-black text-red-600">{editingRecord.rejectPct}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-bold">Hold rate</span>
                        <span className="font-mono font-black text-amber-600">{editingRecord.holdPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-Contact Custom Parameters Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" /> Sub-Contact Parameters
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Flat Knit (PCS)</label>
                        <input
                          type="number"
                          value={editingRecord.productionFlatKnit ?? 0}
                          onChange={(e) => handleEditChange('productionFlatKnit', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Yarn Issued (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.yarnIssued ?? 0}
                          onChange={(e) => handleEditChange('yarnIssued', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Running Factories</label>
                        <input
                          type="number"
                          value={editingRecord.runningFactories ?? 0}
                          onChange={(e) => handleEditChange('runningFactories', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Running Machine</label>
                        <input
                          type="number"
                          value={editingRecord.runningMachine}
                          onChange={(e) => handleEditChange('runningMachine', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Fabric Return (Kg)</label>
                      <input
                        type="number"
                        value={editingRecord.fabricReturn ?? 0}
                        onChange={(e) => handleEditChange('fabricReturn', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* Grid sections inside popup modal */
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  
                  {/* Block 1: General Info */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> General Information
                    </h4>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Production Date</label>
                      <input
                        type="date"
                        value={editingRecord.date}
                        onChange={(e) => handleEditChange('date', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Floor Unit</label>
                      <input
                        type="text"
                        readOnly
                        value={editingRecord.floor}
                        className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-black text-gray-500 tracking-wider outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Block 2: Production metrics */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Production Weights
                    </h4>
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold text-gray-500 uppercase">Target (Kg)</label>
                      <input
                        type="number"
                        value={editingRecord.target}
                        onChange={(e) => handleEditChange('target', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase">Shift A</label>
                        <input
                          type="number"
                          value={editingRecord.shiftA}
                          onChange={(e) => handleEditChange('shiftA', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase">Shift B</label>
                        <input
                          type="number"
                          value={editingRecord.shiftB}
                          onChange={(e) => handleEditChange('shiftB', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase">Shift C</label>
                        <input
                          type="number"
                          value={editingRecord.shiftC}
                          onChange={(e) => handleEditChange('shiftC', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Total Production</label>
                        <input
                          type="number"
                          readOnly
                          value={editingRecord.totalProduction}
                          className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-black text-[#0F4C81] dark:text-blue-300 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Achievement %</label>
                        <input
                          type="text"
                          readOnly
                          value={`${editingRecord.target > 0 ? Math.round((editingRecord.totalProduction / editingRecord.target) * 100) : 0}%`}
                          className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Block 3: Machine Status */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" /> Machine Status
                    </h4>
                    
                    {/* Grid for Inputs & Outputs in requested sequence */}
                    <div className="space-y-3">
                      {/* 1. Total Machine */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block">Total Machine</label>
                        <input
                          type="number"
                          readOnly
                          value={getTotalMachinesForFloor(editingRecord.floor)}
                          className="w-full rounded-lg bg-gray-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-mono font-bold text-gray-500 dark:text-slate-400 outline-none cursor-not-allowed border border-transparent"
                          title="Calculated from system settings"
                        />
                      </div>

                      {/* 2. Running Machine (Manual Entry) */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block">Running Machine (Manual Entry)</label>
                        <input
                          type="number"
                          value={editingRecord.runningMachine}
                          onChange={(e) => handleEditChange('runningMachine', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                          placeholder="Enter active machine count"
                        />
                      </div>

                      {/* 3. Idle machine */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block">Idle machine</label>
                        <input
                          type="number"
                          readOnly
                          value={editingRecord.idleMachine}
                          className="w-full rounded-lg bg-gray-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-mono font-black text-amber-600 dark:text-amber-400 outline-none cursor-not-allowed border border-transparent"
                          title="Auto-calculated (Total - Running)"
                        />
                      </div>

                      {/* Calculations array: Utilization Rate, Production Loss, Production Efficiency */}
                      <div className="grid grid-cols-3 gap-2 border-t border-dashed border-gray-250 dark:border-slate-800 pt-3 text-[10px]">
                        {/* 4. Utilization Rate */}
                        <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                          <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Utilization Rate</span>
                          <span className="font-mono text-xs font-black text-gray-950 dark:text-white">{editingRecord.machineUtilization}%</span>
                        </div>

                        {/* 5. Production Loss */}
                        <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                          <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Production Loss</span>
                          <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">{editingRecord.idleProduction} Kg</span>
                        </div>

                        {/* 6. Production Efficiency */}
                        <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                          <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Production Efficiency</span>
                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">{editingRecord.efficiency}%</span>
                        </div>
                      </div>

                      {/* 7. Set Change (Manual Entry) */}
                      <div className="space-y-1 border-t border-dashed border-gray-250 dark:border-slate-800 pt-3">
                        <label className="text-[10px] font-bold text-gray-400 uppercase block">Set Change (Manual Entry)</label>
                        <input
                          type="number"
                          value={editingRecord.setChange}
                          onChange={(e) => handleEditChange('setChange', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                          placeholder="Enter completed set changes"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Block 4: Quality controls */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" /> Quality Indices
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Reject (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.reject}
                          onChange={(e) => handleEditChange('reject', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Hold (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.hold}
                          onChange={(e) => handleEditChange('hold', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-gray-400 block uppercase font-bold">Reject rate</span>
                        <span className="font-mono font-black text-red-600">{editingRecord.rejectPct}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-bold">Hold rate</span>
                        <span className="font-mono font-black text-amber-600">{editingRecord.holdPct}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Block 5: Secondary Element Consumption */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5" /> Secondary Element Consumption
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Needle Broken</label>
                        <input
                          type="number"
                          value={editingRecord.needleBroken}
                          onChange={(e) => handleEditChange('needleBroken', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Sinker Broken</label>
                        <input
                          type="number"
                          value={editingRecord.sinkerBroken}
                          onChange={(e) => handleEditChange('sinkerBroken', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Oil Consumed (Liters)</label>
                      <input
                        type="number"
                        value={editingRecord.oilConsumption}
                        onChange={(e) => handleEditChange('oilConsumption', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Block 6: Manpower roster */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> Manpower & Other
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Total Operators</label>
                        <input
                          type="number"
                          value={editingRecord.totalOperator}
                          onChange={(e) => handleEditChange('totalOperator', parseInt(e.target.value) || 1)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Absent Operators</label>
                        <input
                          type="number"
                          value={editingRecord.absent}
                          onChange={(e) => handleEditChange('absent', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                        />
                      </div>
                    </div>
                    <div className="mt-2 text-[10px]">
                      <span className="text-gray-400 block uppercase font-bold">Absent Rate</span>
                      <span className="font-mono font-black text-red-600">{editingRecord.absentPct}%</span>
                    </div>
                  </div>

                </div>
              )}

              {/* Remarks block */}
              <div className="space-y-1 rounded-xl border border-gray-100 dark:border-slate-800 p-4 bg-gray-50/50 dark:bg-slate-800/10">
                <label className="text-[10px] font-black uppercase text-[#0F4C81] dark:text-blue-300 block mb-1">Shift Handover Remarks</label>
                <textarea
                  value={editingRecord.remarks}
                  onChange={(e) => handleEditChange('remarks', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                  placeholder="Record minor machine updates, raw thread deliveries..."
                />
              </div>

              {/* Display errors if any */}
              {Object.keys(editErrors).length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-bold text-red-600 space-y-0.5">
                  {Object.values(editErrors).map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}

              {/* Buttons (Fully responsive layout) */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-gray-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setEditingRecord(null); }}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 text-gray-700 dark:text-slate-200 px-5 py-2 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#0F4C81] hover:bg-[#0b3861] text-white px-6 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 7.5. POPUP MODAL: ADD PRODUCTION RECORD */}
      {isCreateModalOpen && creatingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-[#0F4C81]" />
                <div>
                  <h3 className="font-sans text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider">
                    Add Production Record
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">
                    Create a new production log entry for the ledger
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => { setIsCreateModalOpen(false); setCreatingRecord(null); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="space-y-4">
              {creatingRecord.floor === 'Sub-Contact' ? (
                /* Sub-Contact Data Entry Form */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* General Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" /> General Information
                    </h4>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Production Date</label>
                      <input
                        type="date"
                        value={creatingRecord.date}
                        onChange={(e) => handleCreateChange('date', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Floor Unit</label>
                      <select
                        value={creatingRecord.floor}
                        onChange={(e) => handleCreateChange('floor', e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                      >
                        <option value="EKL">EKL</option>
                        <option value="EFL">EFL</option>
                        <option value="EFL-2">EFL-2</option>
                        <option value="Auto Stripe">Auto Stripe</option>
                        <option value="EFL-Extension">EFL-Extension</option>
                        <option value="ESL-Extension">ESL-Extension</option>
                        <option value="Sub-Contact">Sub-Contact</option>
                      </select>
                    </div>
                  </div>

                  {/* Production Weights Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Production Weights
                    </h4>
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Target (Kg)</label>
                        <input
                          type="number"
                          value={creatingRecord.target}
                          onChange={(e) => handleCreateChange('target', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Total Production (Kg)</label>
                        <input
                          type="number"
                          value={creatingRecord.totalProduction}
                          onChange={(e) => handleCreateChange('totalProduction', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Secondary Sub-Contact Details Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Settings className="h-3.5 w-3.5" /> Sub-Contact Metrics
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Flat Knit (PCS)</label>
                        <input
                          type="number"
                          value={creatingRecord.productionFlatKnit ?? 0}
                          onChange={(e) => handleCreateChange('productionFlatKnit', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Yarn Issued (Kg)</label>
                        <input
                          type="number"
                          value={creatingRecord.yarnIssued ?? 0}
                          onChange={(e) => handleCreateChange('yarnIssued', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase">Running Factories</label>
                        <input
                          type="number"
                          value={creatingRecord.runningFactories ?? 0}
                          onChange={(e) => handleCreateChange('runningFactories', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase">Running Machine</label>
                        <input
                          type="number"
                          value={creatingRecord.runningMachine ?? 0}
                          onChange={(e) => handleCreateChange('runningMachine', parseInt(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-gray-500 uppercase">Fabric Return (Kg)</label>
                        <input
                          type="number"
                          value={creatingRecord.fabricReturn ?? 0}
                          onChange={(e) => handleCreateChange('fabricReturn', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                    </div>
                    <div className="mt-1 text-[10px]">
                      <span className="text-gray-400 block uppercase font-bold">Achievement %</span>
                      <span className="font-mono font-black text-emerald-600">
                        {creatingRecord.target > 0 ? Math.round((creatingRecord.totalProduction / creatingRecord.target) * 100) : 0}%
                      </span>
                    </div>
                  </div>

                  {/* Quality & Status Metrics Block */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-red-700 dark:text-red-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5" /> Quality Indices & Status
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Reject (Kg)</label>
                        <input
                          type="number"
                          value={creatingRecord.reject}
                          onChange={(e) => handleCreateChange('reject', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Hold (Kg)</label>
                        <input
                          type="number"
                          value={creatingRecord.hold}
                          onChange={(e) => handleCreateChange('hold', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="text-[10px]">
                        <span className="text-gray-400 block uppercase font-bold">Reject rate</span>
                        <span className="font-mono font-black text-red-600">{creatingRecord.rejectPct}%</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block uppercase font-bold">Hold rate</span>
                        <span className="font-mono font-black text-amber-600">{creatingRecord.holdPct}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Standard Floor Data Entry Form */
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                
                {/* Block 1: General Info */}
                <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                  <h4 className="font-sans text-[11px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> General Information
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Production Date</label>
                    <input
                      type="date"
                      value={creatingRecord.date}
                      onChange={(e) => handleCreateChange('date', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Floor Unit</label>
                    <select
                      value={creatingRecord.floor}
                      onChange={(e) => handleCreateChange('floor', e.target.value)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    >
                      <option value="EKL">EKL</option>
                      <option value="EFL">EFL</option>
                      <option value="EFL-2">EFL-2</option>
                      <option value="Auto Stripe">Auto Stripe</option>
                      <option value="EFL-Extension">EFL-Extension</option>
                      <option value="ESL-Extension">ESL-Extension</option>
                      <option value="Sub-Contact">Sub-Contact</option>
                    </select>
                  </div>
                </div>

                {/* Block 2: Production metrics */}
                <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                  <h4 className="font-sans text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Production Weights
                  </h4>
                  <div className="space-y-1">
                    <label className="text-[10px] font-extrabold text-gray-500 uppercase">Target (Kg)</label>
                    <input
                      type="number"
                      value={creatingRecord.target}
                      onChange={(e) => handleCreateChange('target', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase">Shift A</label>
                      <input
                        type="number"
                        value={creatingRecord.shiftA}
                        onChange={(e) => handleCreateChange('shiftA', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase">Shift B</label>
                      <input
                        type="number"
                        value={creatingRecord.shiftB}
                        onChange={(e) => handleCreateChange('shiftB', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-extrabold text-gray-500 uppercase">Shift C</label>
                      <input
                        type="number"
                        value={creatingRecord.shiftC}
                        onChange={(e) => handleCreateChange('shiftC', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Total Production</label>
                      <input
                        type="number"
                        readOnly
                        value={creatingRecord.totalProduction}
                        className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-black text-[#0F4C81] dark:text-blue-300 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Achievement %</label>
                      <input
                        type="text"
                        readOnly
                        value={`${creatingRecord.target > 0 ? Math.round((creatingRecord.totalProduction / creatingRecord.target) * 100) : 0}%`}
                        className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* Block 3: Machine Status */}
                <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                  <h4 className="font-sans text-[11px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5" /> Machine Status
                  </h4>
                  
                  {/* Grid for Inputs & Outputs in requested sequence */}
                  <div className="space-y-3">
                    {/* 1. Total Machine */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Total Machine</label>
                      <input
                        type="number"
                        readOnly
                        value={getTotalMachinesForFloor(creatingRecord.floor)}
                        className="w-full rounded-lg bg-gray-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-mono font-bold text-gray-500 dark:text-slate-400 outline-none cursor-not-allowed border border-transparent"
                        title="Calculated from system settings"
                      />
                    </div>

                    {/* 2. Running Machine (Manual Entry) */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Running Machine (Manual Entry)</label>
                      <input
                        type="number"
                        value={creatingRecord.runningMachine}
                        onChange={(e) => handleCreateChange('runningMachine', parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                        placeholder="Enter active machine count"
                      />
                    </div>

                    {/* 3. Idle machine */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Idle machine</label>
                      <input
                        type="number"
                        readOnly
                        value={creatingRecord.idleMachine}
                        className="w-full rounded-lg bg-gray-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-mono font-black text-amber-600 dark:text-amber-400 outline-none cursor-not-allowed border border-transparent"
                        title="Auto-calculated (Total - Running)"
                      />
                    </div>

                    {/* Calculations array: Utilization Rate, Production Loss, Production Efficiency */}
                    <div className="grid grid-cols-3 gap-2 border-t border-dashed border-gray-250 dark:border-slate-800 pt-3 text-[10px]">
                      {/* 4. Utilization Rate */}
                      <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                        <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Utilization Rate</span>
                        <span className="font-mono text-xs font-black text-gray-950 dark:text-white">{creatingRecord.machineUtilization}%</span>
                      </div>

                      {/* 5. Production Loss */}
                      <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                        <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Production Loss</span>
                        <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">{creatingRecord.idleProduction} Kg</span>
                      </div>

                      {/* 6. Production Efficiency */}
                      <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                        <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Production Efficiency</span>
                        <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">{creatingRecord.efficiency}%</span>
                      </div>
                    </div>

                    {/* 7. Set Change (Manual Entry) */}
                    <div className="space-y-1 border-t border-dashed border-gray-250 dark:border-slate-800 pt-3">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Set Change (Manual Entry)</label>
                      <input
                        type="number"
                        value={creatingRecord.setChange}
                        onChange={(e) => handleCreateChange('setChange', parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                        placeholder="Enter completed set changes"
                      />
                    </div>
                  </div>
                </div>

                {/* Block 4: Quality controls */}
                <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                  <h4 className="font-sans text-[11px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" /> Quality Indices
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Reject (Kg)</label>
                      <input
                        type="number"
                        value={creatingRecord.reject}
                        onChange={(e) => handleCreateChange('reject', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Hold (Kg)</label>
                      <input
                        type="number"
                        value={creatingRecord.hold}
                        onChange={(e) => handleCreateChange('hold', parseFloat(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-gray-400 block uppercase font-bold">Reject rate</span>
                      <span className="font-mono font-black text-red-600">{creatingRecord.rejectPct}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block uppercase font-bold">Hold rate</span>
                      <span className="font-mono font-black text-amber-600">{creatingRecord.holdPct}%</span>
                    </div>
                  </div>
                </div>

                {/* Block 5: Secondary Element Consumption */}
                <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                  <h4 className="font-sans text-[11px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5" /> Secondary Element Consumption
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Needle Broken</label>
                      <input
                        type="number"
                        value={creatingRecord.needleBroken}
                        onChange={(e) => handleCreateChange('needleBroken', parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Sinker Broken</label>
                      <input
                        type="number"
                        value={creatingRecord.sinkerBroken}
                        onChange={(e) => handleCreateChange('sinkerBroken', parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Oil Consumed (Liters)</label>
                    <input
                      type="number"
                      value={creatingRecord.oilConsumption}
                      onChange={(e) => handleCreateChange('oilConsumption', parseFloat(e.target.value) || 0)}
                      className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                    />
                  </div>
                </div>

                {/* Block 6: Manpower roster & Remarks */}
                <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                  <h4 className="font-sans text-[11px] font-black text-[#0F4C81] dark:text-blue-300 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Manpower & Other
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Total Operators</label>
                      <input
                        type="number"
                        value={creatingRecord.totalOperator}
                        onChange={(e) => handleCreateChange('totalOperator', parseInt(e.target.value) || 1)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Absent Operators</label>
                      <input
                        type="number"
                        value={creatingRecord.absent}
                        onChange={(e) => handleCreateChange('absent', parseInt(e.target.value) || 0)}
                        className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="mt-2 text-[10px]">
                    <span className="text-gray-400 block uppercase font-bold">Absent Rate</span>
                    <span className="font-mono font-black text-red-600">{creatingRecord.absentPct}%</span>
                  </div>
                </div>

              </div>)}

              {/* Remarks block */}
              <div className="space-y-1 rounded-xl border border-gray-100 dark:border-slate-800 p-4 bg-gray-50/50 dark:bg-slate-800/10">
                <label className="text-[10px] font-black uppercase text-[#0F4C81] dark:text-blue-300 block mb-1">Shift Handover Remarks</label>
                <textarea
                  value={creatingRecord.remarks}
                  onChange={(e) => handleCreateChange('remarks', e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 outline-hidden focus:border-[#0F4C81]"
                  placeholder="Record minor machine updates, raw thread deliveries..."
                />
              </div>

              {/* Display errors if any */}
              {Object.keys(createErrors).length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-[10px] font-bold text-red-600 space-y-0.5">
                  {Object.values(createErrors).map((err, idx) => (
                    <div key={idx}>• {err}</div>
                  ))}
                </div>
              )}

              {/* Buttons (Fully responsive layout) */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-gray-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => { setIsCreateModalOpen(false); setCreatingRecord(null); }}
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 text-gray-700 dark:text-slate-200 px-5 py-2 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#0F4C81] hover:bg-[#0b3861] text-white px-6 py-2 text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  Create Entry
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 8. CONFIRM DIALOG: DELETE RECORD */}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-sans text-sm font-black text-gray-950 dark:text-white uppercase tracking-wider">
                  Delete Production Record
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed font-medium">
                  Are you sure you want to permanently delete this production record? This action cannot be undone and will purge the ledger data from historical computations.
                </p>
              </div>
            </div>

            {/* Buttons (Fluid layout matching specifications) */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-gray-50 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => { setIsDeleteConfirmOpen(false); setDeletingRecordId(null); }}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 text-gray-700 dark:text-slate-200 px-4 py-2 text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-700 text-white px-5 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
