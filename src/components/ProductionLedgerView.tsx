/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { UserRecord } from './UserManagementView';
import { useTableColumns, ColumnCustomizerDropdown, ResizableTh, ColumnDef } from './TableColumnCustomizer';
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
import AddProductionRecordModal from './AddProductionRecordModal';
import { 
  getTargetKgForUnit, 
  getTotalMachinesForUnit, 
  getAvgProdPerMachineForUnit, 
  getProductionCapacityForUnit,
  getUnitConfigs,
  saveUnitConfigs,
  UnitThresholdConfig
} from '../lib/unitStore';

const getLocalStorageTarget = (floorName: string, defaultVal: number) => {
  return getTargetKgForUnit(floorName, defaultVal);
};

const getLocalStorageMachines = (floorName: string, defaultVal: number) => {
  return getTotalMachinesForUnit(floorName, defaultVal);
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
  const aug11Records: LedgerRecord[] = [
    {
      id: 'rec-2026-08-11-sub-contact-1',
      unit: 'Sub-Contact',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'Sub-Contact',
      target: 25000,
      shiftA: 0,
      shiftB: 0,
      shiftC: 0,
      totalProduction: 20259,
      targetBulk: 20259,
      bulkProd: 20259,
      sampleProd: 0,
      runningBulk: 0,
      runningSample: 0,
      idleMc: 0,
      machineUtilization: 0,
      idleMcPct: 0,
      prodLossForSample: 0,
      idleProduction: 0,
      efficiency: 81.04,
      proPerMc: 0,
      reject: 0,
      rejectPct: 0,
      hold: 0,
      holdPct: 0,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 0,
      needlePerKg: 0,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 0,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: 0,
      capacityUtilization: 81.04,
      totalOperator: 13,
      absent: 0,
      absentPct: 0,
      yarnIssued: 49,
      runningMachine: 153,
      numberVehicles: 8,
      remarks: '',
      idleMachine: 0,
      idleMachinePct: 0,
      productionPerMachine: 0,
      productionLossForEfficiency: 0,
    },
    {
      id: 'rec-2026-08-11-extension',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'Extension',
      target: 4787,
      shiftA: 1377,
      shiftB: 1502,
      shiftC: 1324,
      totalProduction: 4203,
      targetBulk: 3960,
      bulkProd: 4023,
      sampleProd: 180,
      runningBulk: 22,
      runningSample: 4,
      idleMc: 12,
      machineUtilization: 58,
      idleMcPct: 32,
      prodLossForSample: 0,
      idleProduction: 552,
      efficiency: 102,
      proPerMc: 191.05,
      reject: 2,
      rejectPct: 0.05,
      hold: 61,
      holdPct: 1.45,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 201,
      needlePerKg: 20.9,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 10,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: -30865.13,
      capacityUtilization: 63.49,
      totalOperator: 49,
      absent: 4,
      absentPct: 8.16,
      remarks: '',
      idleMachine: 12,
      idleMachinePct: 32,
      productionPerMachine: 191.05,
      productionLossForEfficiency: -30865.13,
    },
    {
      id: 'rec-2026-08-11-sub-contact-2',
      unit: 'Sub-Contact',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'Sub-Contact',
      target: 25000,
      shiftA: 0,
      shiftB: 0,
      shiftC: 0,
      totalProduction: 27290,
      targetBulk: 27290,
      bulkProd: 27290,
      sampleProd: 0,
      runningBulk: 0,
      runningSample: 0,
      idleMc: 0,
      machineUtilization: 0,
      idleMcPct: 0,
      prodLossForSample: 0,
      idleProduction: 0,
      efficiency: 109.16,
      proPerMc: 0,
      reject: 0,
      rejectPct: 0,
      hold: 0,
      holdPct: 0,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 0,
      needlePerKg: 0,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 0,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: 0,
      capacityUtilization: 109.16,
      totalOperator: 0,
      absent: 0,
      absentPct: 0,
      yarnIssued: 49,
      runningMachine: 153,
      numberVehicles: 9,
      remarks: '',
      idleMachine: 0,
      idleMachinePct: 0,
      productionPerMachine: 0,
      productionLossForEfficiency: 0,
    },
    {
      id: 'rec-2026-08-11-esl-extension',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'ESL-Extension',
      target: 5500,
      shiftA: 1568,
      shiftB: 1455,
      shiftC: 1731,
      totalProduction: 4754,
      targetBulk: 5600,
      bulkProd: 4635,
      sampleProd: 119,
      runningBulk: 28,
      runningSample: 7,
      idleMc: 1,
      machineUtilization: 78,
      idleMcPct: 3,
      prodLossForSample: 0,
      idleProduction: 1043,
      efficiency: 83,
      proPerMc: 169.79,
      reject: 5.5,
      rejectPct: 0.12,
      hold: 73,
      holdPct: 1.54,
      jhuteCutpcs: 9,
      jhuteCutpcsPct: 0,
      needleBroken: 26,
      needlePerKg: 182.8,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 5,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: -32886.16,
      capacityUtilization: 62.80,
      totalOperator: 52,
      absent: 0,
      absentPct: 0,
      remarks: '',
      idleMachine: 1,
      idleMachinePct: 3,
      productionPerMachine: 169.79,
      productionLossForEfficiency: -32886.16,
    },
    {
      id: 'rec-2026-08-11-ekl',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'EKL',
      target: 5863,
      shiftA: 1836,
      shiftB: 1630,
      shiftC: 1502,
      totalProduction: 4968,
      targetBulk: 5520,
      bulkProd: 4672,
      sampleProd: 296,
      runningBulk: 24,
      runningSample: 3,
      idleMc: 2,
      machineUtilization: 83,
      idleMcPct: 7,
      prodLossForSample: 0,
      idleProduction: 289,
      efficiency: 90,
      proPerMc: 207.00,
      reject: 0,
      rejectPct: 0,
      hold: 114.58,
      holdPct: 2.31,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 123,
      needlePerKg: 40.4,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 9,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: -43943.86,
      capacityUtilization: 78.24,
      totalOperator: 44,
      absent: 1,
      absentPct: 2.27,
      remarks: '',
      idleMachine: 2,
      idleMachinePct: 7,
      productionPerMachine: 207.00,
      productionLossForEfficiency: -43943.86,
    },
    {
      id: 'rec-2026-08-11-auto-stripe',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'Auto-Stripe',
      target: 773,
      shiftA: 159,
      shiftB: 137,
      shiftC: 217,
      totalProduction: 513,
      targetBulk: 720,
      bulkProd: 466,
      sampleProd: 47,
      runningBulk: 6,
      runningSample: 1,
      idleMc: 3,
      machineUtilization: 60,
      idleMcPct: 30,
      prodLossForSample: 0,
      idleProduction: 30.67,
      efficiency: 61,
      proPerMc: 85.50,
      reject: 0,
      rejectPct: 0,
      hold: 87,
      holdPct: 16.96,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 30,
      needlePerKg: 17.1,
      sinkerBroken: 2,
      sinkerPerKg: 256.50,
      oilConsumption: 3.2,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: -8063,
      capacityUtilization: 51.30,
      totalOperator: 17,
      absent: 0,
      absentPct: 0,
      remarks: '',
      idleMachine: 3,
      idleMachinePct: 30,
      productionPerMachine: 85.50,
      productionLossForEfficiency: -8063,
    },
    {
      id: 'rec-2026-08-11-efl',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'EFL',
      target: 14053,
      shiftA: 3177,
      shiftB: 2909,
      shiftC: 3424,
      totalProduction: 9510,
      targetBulk: 10350,
      bulkProd: 9228,
      sampleProd: 282,
      runningBulk: 45,
      runningSample: 6,
      idleMc: 15,
      machineUtilization: 68,
      idleMcPct: 23,
      prodLossForSample: 0,
      idleProduction: 948,
      efficiency: 89,
      proPerMc: 211.33,
      reject: 13,
      rejectPct: 0.14,
      hold: 77,
      holdPct: 0.81,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 54,
      needlePerKg: 176.1,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 7,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: -45050.61,
      capacityUtilization: 58.92,
      totalOperator: 96,
      absent: 4,
      absentPct: 4.17,
      remarks: '',
      idleMachine: 15,
      idleMachinePct: 23,
      productionPerMachine: 211.33,
      productionLossForEfficiency: -45050.61,
    },
    {
      id: 'rec-2026-08-11-efl-2',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'EFL-2',
      target: 8627,
      shiftA: 1644,
      shiftB: 1516,
      shiftC: 2352,
      totalProduction: 5512,
      targetBulk: 8960,
      bulkProd: 5376,
      sampleProd: 136,
      runningBulk: 32,
      runningSample: 3,
      idleMc: 8,
      machineUtilization: 81,
      idleMcPct: 19,
      prodLossForSample: 0,
      idleProduction: 368,
      efficiency: 60,
      proPerMc: 172.25,
      reject: 0,
      rejectPct: 0,
      hold: 94.34,
      holdPct: 1.75,
      jhuteCutpcs: 14.6,
      jhuteCutpcsPct: 0,
      needleBroken: 37,
      needlePerKg: 149.0,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 15,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      productionLossForEff: 5548,
      capacityUtilization: 44.74,
      totalOperator: 63,
      absent: 1,
      absentPct: 1.59,
      remarks: 'power problem 4.13hours',
      idleMachine: 8,
      idleMachinePct: 19,
      productionPerMachine: 172.25,
      productionLossForEfficiency: 5548,
    }
  ];

  return aug11Records;
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

const PRODUCTION_LEDGER_COLUMNS: ColumnDef[] = [
  { id: 'unit', label: 'Unit', defaultWidth: 95 },
  { id: 'year', label: 'Year', defaultWidth: 65 },
  { id: 'month', label: 'Month', defaultWidth: 80 },
  { id: 'date', label: 'Date', defaultWidth: 90 },
  { id: 'floor', label: 'Floor', defaultWidth: 105 },
  { id: 'target', label: 'Target Total', defaultWidth: 95 },
  { id: 'shiftA', label: 'Shift A', defaultWidth: 80 },
  { id: 'shiftB', label: 'Shift B', defaultWidth: 80 },
  { id: 'shiftC', label: 'Shift C', defaultWidth: 80 },
  { id: 'totalProduction', label: 'Total Production', defaultWidth: 110 },
  { id: 'targetBulk', label: 'Target Bulk', defaultWidth: 95 },
  { id: 'bulkProd', label: 'Bulk Prod.', defaultWidth: 90 },
  { id: 'sampleProd', label: 'Sample Prod.', defaultWidth: 90 },
  { id: 'runningBulk', label: 'Running Bulk', defaultWidth: 90 },
  { id: 'runningSample', label: 'Running Sample', defaultWidth: 100 },
  { id: 'idleMc', label: 'Idle Mc', defaultWidth: 75 },
  { id: 'machineUtilization', label: 'Machine Utilization', defaultWidth: 120 },
  { id: 'idleMcPct', label: 'Idle Mc %', defaultWidth: 85 },
  { id: 'idleProduction', label: 'Idle Production', defaultWidth: 105 },
  { id: 'efficiency', label: 'Efficiency', defaultWidth: 90 },
  { id: 'proPerMc', label: 'Pro Per Mc', defaultWidth: 90 },
  { id: 'reject', label: 'Reject', defaultWidth: 75 },
  { id: 'rejectPct', label: 'Reject%', defaultWidth: 75 },
  { id: 'hold', label: 'Hold', defaultWidth: 75 },
  { id: 'holdPct', label: 'Hold%', defaultWidth: 75 },
  { id: 'jhuteCutpcs', label: 'Jhute/Cutpcs', defaultWidth: 95 },
  { id: 'jhuteCutpcsPct', label: 'Jhute/Cutpcs%', defaultWidth: 95 },
  { id: 'needleBroken', label: 'Needle Broken', defaultWidth: 95 },
  { id: 'needlePerKg', label: 'Needle Broken/KG', defaultWidth: 115 },
  { id: 'sinkerBroken', label: 'Sinker Broken', defaultWidth: 95 },
  { id: 'sinkerPerKg', label: 'Sinker Broken/KG', defaultWidth: 115 },
  { id: 'oilConsumption', label: 'Oil Consumption', defaultWidth: 105 },
  { id: 'beltBroken', label: 'Belt Broken', defaultWidth: 90 },
  { id: 'otherSparePartsName', label: 'Other Spare parts Name', defaultWidth: 135 },
  { id: 'otherSparePartsQty', label: 'Other Spare parts QTY', defaultWidth: 125 },
  { id: 'setChangePcs', label: 'Set Change(Pcs)', defaultWidth: 105 },
  { id: 'productionLossForEff', label: 'Production Loss For Eff', defaultWidth: 130 },
  { id: 'prodLossForSample', label: 'Production Loss for Sample', defaultWidth: 135 },
  { id: 'capacityUtilization', label: 'Capacity Utilization', defaultWidth: 120 },
  { id: 'totalOperator', label: 'Total Operator', defaultWidth: 95 },
  { id: 'absent', label: 'Absent', defaultWidth: 75 },
  { id: 'absentPct', label: 'Absent %', defaultWidth: 80 },
  { id: 'productionFlatKnit', label: 'Production-Flat Knit', defaultWidth: 120 },
  { id: 'achievmentCircular', label: 'Achievment-Circular', defaultWidth: 125 },
  { id: 'otd', label: 'OTD', defaultWidth: 75 },
  { id: 'yarnIssued', label: 'Yarn Issued', defaultWidth: 95 },
  { id: 'totalRunningFactories', label: 'Total Running Factories', defaultWidth: 130 },
  { id: 'runningMachine', label: 'Running Machine', defaultWidth: 105 },
  { id: 'numberVehicles', label: 'Number Vehicles', defaultWidth: 105 },
  { id: 'fabricReturn', label: 'Fabric Return', defaultWidth: 100 },
  { id: 'remarks', label: 'Remarks', defaultWidth: 160 },
  { id: 'action', label: 'Actions', defaultWidth: 85, alwaysVisible: true },
];

export default function ProductionLedgerView({ currentUser }: ProductionLedgerViewProps = {}) {
  const isAdmin = currentUser?.userType === 'Admin';

  const {
    hiddenColumns,
    toggleColumn,
    resetColumns,
    setColumnWidth,
    isColVisible,
    getColWidth,
    isFrozen,
    freezeCount,
    toggleFreeze,
    setFreezeCount,
    getStickyStyle,
    getStickyClass,
    isColFrozen,
    getStickyLeft,
    lastFrozenColId,
  } = useTableColumns('production_ledger', currentUser?.uid || 'guest', PRODUCTION_LEDGER_COLUMNS, 4);
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

  const loadGasLedger = async (forceRefresh: boolean = false) => {
    try {
      setLedgerGasError(null);
      const records = await GasClient.fetchLedgerList(forceRefresh);
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

  // 2. Load mode configuration & fetch GAS records & listen for sync events
  React.useEffect(() => {
    const initAndLoad = async () => {
      const config = await GasClient.fetchServerConfig();
      const activeMode = config.databaseMode || GasClient.getDatabaseMode();
      const activeUrl = config.gasWebAppUrl || GasClient.getWebAppUrl();

      if (activeMode === 'gas' && activeUrl) {
        setIsGasMode(true);
        loadGasLedger(false);
      } else {
        // Fallback: sync with central server DB
        const db = await GasClient.fetchServerDb();
        if (db && Array.isArray(db.ledger) && db.ledger.length > 0) {
          setLedger(db.ledger);
        }
      }
    };
    initAndLoad();

    const handleSync = () => loadGasLedger(true);
    window.addEventListener('gas_data_synced', handleSync);
    return () => window.removeEventListener('gas_data_synced', handleSync);
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

  // Unit settings reactive state
  const [unitConfigs, setUnitConfigs] = useState<UnitThresholdConfig[]>(() => getUnitConfigs());

  // Real-time listener for Settings and Unit Threshold updates
  React.useEffect(() => {
    const unsubscribeSettings = FirestoreSyncService.subscribeToSettings((remoteSettings) => {
      if (remoteSettings && remoteSettings.unitConfigs && Array.isArray(remoteSettings.unitConfigs) && remoteSettings.unitConfigs.length > 0) {
        setUnitConfigs(remoteSettings.unitConfigs);
        saveUnitConfigs(remoteSettings.unitConfigs);
      }
    });

    const handleUnitConfigsUpdated = (e: Event) => {
      const customEv = e as CustomEvent<UnitThresholdConfig[]>;
      if (customEv.detail) {
        setUnitConfigs(customEv.detail);
      } else {
        setUnitConfigs(getUnitConfigs());
      }
    };
    window.addEventListener('unit_configs_updated', handleUnitConfigsUpdated);

    return () => {
      if (unsubscribeSettings) unsubscribeSettings();
      window.removeEventListener('unit_configs_updated', handleUnitConfigsUpdated);
    };
  }, []);

  // Helper to dynamically fetch total machines per floor unit from unitStore/settings
  const getTotalMachinesForFloor = (floorName: string) => {
    return getTotalMachinesForUnit(floorName, floorName === 'Sub-Contact' ? 0 : 30);
  };

  const getTargetForFloor = (floorName: string) => {
    return getTargetKgForUnit(floorName, 15000);
  };

  // Helper to centralize all production, quality, manpower, and machine formulas
  const recalculateRecordFields = (record: LedgerRecord): LedgerRecord => {
    const floorName = record.floor || 'EKL';
    const isSubContact = floorName === 'Sub-Contact';
    
    // 3. Target KG from settings panel unit by unit
    const target = record.target > 0 ? record.target : getTargetForFloor(floorName);

    // 6. Total Machine from settings panel
    const totalM = getTotalMachinesForFloor(floorName);
    
    // Total production
    const totalProduction = isSubContact 
      ? (record.totalProduction ?? 0) 
      : ((Number(record.shiftA) || 0) + (Number(record.shiftB) || 0) + (Number(record.shiftC) || 0));
    
    // Sample production
    const sampleProd = Number(record.sampleProd) || 0;

    // 5. Bulk PROD (KG) = Total Production - Sample Production
    const bulkProd = Math.max(0, totalProduction - sampleProd);

    // Active & Running machines
    const runningMachine = Number(record.runningMachine) || 0;
    const runningSample = Number(record.runningSample) || 0;

    // 7. Running Bulk = Running Machine - Running Sample Machine
    const runningBulk = Math.max(0, runningMachine - runningSample);

    // Avg Prod / Machine (Kg) from settings panel
    const avgProdPerMc = getAvgProdPerMachineForUnit(floorName);

    // 4. Target Bulk = Running Bulk (MC) * Avg Prod. / Machine (Kg)
    const targetBulk = Number((runningBulk * avgProdPerMc).toFixed(2));

    // Idle machine
    const idleMachine = Math.max(0, totalM - runningMachine);
    const idleMc = idleMachine;
    
    // Machine utilization %
    const machineUtilization = totalM > 0 ? parseFloat(((runningMachine / totalM) * 100).toFixed(1)) : 0;
    
    // Idle machine %
    const idleMachinePct = totalM > 0 ? parseFloat(((idleMachine / totalM) * 100).toFixed(1)) : 0;
    const idleMcPct = idleMachinePct;
    
    // Idle Production
    const idleProduction = (idleMachine > 0 && target > 0 && totalM > 0)
      ? parseFloat(((totalProduction / idleMachine) * (totalM / target)).toFixed(2))
      : 0;
    
    // Production/Machine
    const productionPerMachine = runningMachine > 0 ? parseFloat((totalProduction / runningMachine).toFixed(2)) : 0;
    const proPerMc = productionPerMachine;
    
    // 8. Efficiency = (Bulk Prod (Kg) / Target Bulk (Kg)) * 100
    let efficiency = 0;
    if (targetBulk > 0) {
      efficiency = parseFloat(((bulkProd / targetBulk) * 100).toFixed(2));
    } else if (target > 0) {
      efficiency = parseFloat(((totalProduction / target) * 100).toFixed(2));
    }
    
    // 9. Capacity Utilization = (Total Production / Production Capacity) * 100
    const prodCapacity = getProductionCapacityForUnit(floorName, target);
    const capacityUtilization = prodCapacity > 0 ? parseFloat(((totalProduction / prodCapacity) * 100).toFixed(2)) : 0;
    
    // 10. Production Loss for Sample: (((Bulk Prod. / Running Bulk (MC)) * Running Sample (Mc)) - Sample Prod (Kg))
    const prodLossForSample = (runningBulk > 0)
      ? parseFloat((((bulkProd / runningBulk) * runningSample) - sampleProd).toFixed(2))
      : 0;

    // Quality
    const reject = Number(record.reject) || 0;
    const rejectPct = totalProduction > 0 ? parseFloat(((reject / totalProduction) * 100).toFixed(2)) : 0;
    const hold = Number(record.hold) || 0;
    const holdPct = totalProduction > 0 ? parseFloat(((hold / totalProduction) * 100).toFixed(2)) : 0;
    const jhuteCutpcs = Number(record.jhuteCutpcs) || 0;
    const jhuteCutpcsPct = totalProduction > 0 ? parseFloat(((jhuteCutpcs / totalProduction) * 100).toFixed(2)) : 0;
    
    // 11. Needle Broken/KG = (Needle Broken pcs / Total Production)
    const needleBroken = Number(record.needleBroken) || 0;
    const needlePerKg = totalProduction > 0 ? parseFloat((needleBroken / totalProduction).toFixed(4)) : 0;
    
    // 11. Sinker Broken/KG = (Sinker Broken pcs / Total Production)
    const sinkerBroken = Number(record.sinkerBroken) || 0;
    const sinkerPerKg = totalProduction > 0 ? parseFloat((sinkerBroken / totalProduction).toFixed(4)) : 0;
    
    // Manpower
    const totalOperator = Number(record.totalOperator) || 0;
    const absent = Number(record.absent) || 0;
    const absentPct = totalOperator > 0 ? parseFloat(((absent / totalOperator) * 100).toFixed(2)) : 0;
    
    // Performance
    const productionLossForEff = Math.max(0, target - totalProduction);
    const productionLossForEfficiency = productionLossForEff;

    return {
      ...record,
      target,
      totalProduction,
      sampleProd,
      bulkProd,
      runningMachine,
      runningSample,
      runningBulk,
      targetBulk,
      totalMachines: totalM,
      idleMachine,
      idleMc,
      machineUtilization,
      idleMachinePct,
      idleMcPct,
      idleProduction,
      productionPerMachine,
      proPerMc,
      efficiency,
      capacityUtilization,
      prodLossForSample,
      reject,
      rejectPct,
      hold,
      holdPct,
      jhuteCutpcs,
      jhuteCutpcsPct,
      needleBroken,
      needlePerKg,
      sinkerBroken,
      sinkerPerKg,
      totalOperator,
      absent,
      absentPct,
      productionLossForEff,
      productionLossForEfficiency
    };
  };

  // Enriched ledger state mapping live settings onto all records dynamically
  const enrichedLedger = useMemo(() => {
    return ledger.map(recalculateRecordFields);
  }, [ledger, unitConfigs]);

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
  const [createModalTab, setCreateModalTab] = useState<'all' | 'general' | 'production' | 'machine' | 'quality' | 'consumables' | 'manpower'>('all');

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
  }, [enrichedLedger, appliedUnit, appliedFromDate, appliedToDate, globalSearch]);

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
    const totalTarget = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);
    const totalProduction = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);
    const achievementPct = totalTarget > 0 ? parseFloat(((totalProduction / totalTarget) * 100).toFixed(1)) : 0;

    const runningMachine = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.runningMachine)) ? 0 : Number(r.runningMachine || 0)), 0);
    const idleMachine = filteredRecords.reduce((sum, r) => {
      const val = r.idleMachine !== undefined ? r.idleMachine : (r.idleMc !== undefined ? r.idleMc : 0);
      return sum + (Number.isNaN(Number(val)) ? 0 : Number(val || 0));
    }, 0);
    const totalMachines = runningMachine + idleMachine;
    const machineUtilization = totalMachines > 0 ? parseFloat(((runningMachine / totalMachines) * 100).toFixed(1)) : 0;

    const totalReject = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0);
    const rejectPct = totalProduction > 0 ? parseFloat(((totalReject / totalProduction) * 100).toFixed(2)) : 0;
    const totalHold = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.hold)) ? 0 : Number(r.hold || 0)), 0);
    const holdPct = totalProduction > 0 ? parseFloat(((totalHold / totalProduction) * 100).toFixed(2)) : 0;

    const totalOperators = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalOperator)) ? 0 : Number(r.totalOperator || 0)), 0);
    const totalAbsent = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.absent)) ? 0 : Number(r.absent || 0)), 0);
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
      
      const target = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);
      const production = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);
      const achievementPct = target > 0 ? parseFloat(((production / target) * 100).toFixed(1)) : 0;

      const runningMachine = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.runningMachine)) ? 0 : Number(r.runningMachine || 0)), 0);
      const idleMachine = floorRows.reduce((sum, r) => {
        const val = r.idleMachine !== undefined ? r.idleMachine : (r.idleMc !== undefined ? r.idleMc : 0);
        return sum + (Number.isNaN(Number(val)) ? 0 : Number(val || 0));
      }, 0);
      
      const reject = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0);
      const hold = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.hold)) ? 0 : Number(r.hold || 0)), 0);
      const absent = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.absent)) ? 0 : Number(r.absent || 0)), 0);
      const totalOperator = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalOperator)) ? 0 : Number(r.totalOperator || 0)), 0);
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
  const getInitialNewRecord = (floor: string = 'EKL', date: string = '2026-08-11'): LedgerRecord => {
    const totalM = getTotalMachinesForFloor(floor);
    const targetKg = getTargetForFloor(floor);
    const operatorsMap: Record<string, number> = {
      'EKL': 110,
      'EFL': 95,
      'EFL-2': 85,
      'Auto Stripe': 50,
      'EFL-Extension': 65,
      'ESL-Extension': 40,
      'Sub-Contact': 0,
    };
    const totalOps = operatorsMap[floor] || 90;
    
    // Extract month, year, and day of week
    const dateObj = new Date(date + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const derivedDay = !isNaN(dateObj.getDay()) ? dayNames[dateObj.getDay()] : 'Tuesday';
    const dateParts = date.split('-');
    const yearNum = dateParts.length === 3 ? parseInt(dateParts[0]) : 2026;
    const monthNum = dateParts.length === 3 ? parseInt(dateParts[1]) : 8;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = months[monthNum - 1] || 'August';

    const initial: LedgerRecord = {
      id: `rec-${Date.now()}`,
      unit: floor === 'Sub-Contact' ? 'Sub-Contact' : 'In-House',
      date,
      day: derivedDay,
      floor,
      month: monthName,
      year: yearNum,
      target: targetKg,
      shiftA: 0,
      shiftB: 0,
      shiftC: 0,
      totalProduction: 0,
      targetBulk: targetKg,
      bulkProd: 0,
      sampleProd: 0,
      totalMachines: totalM,
      runningMachine: totalM,
      runningBulk: totalM,
      runningSample: 0,
      idleMachine: 0,
      idleMc: 0,
      machineUtilization: 100,
      idleMachinePct: 0,
      idleMcPct: 0,
      prodLossForSample: 0,
      idleProduction: 0,
      efficiency: 0,
      productionPerMachine: 0,
      proPerMc: 0,
      reject: 0,
      rejectPct: 0,
      hold: 0,
      holdPct: 0,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 0,
      needlePerKg: 0,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 0,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangePcs: 0,
      setChange: 0,
      productionLossForEff: 0,
      productionLossForEfficiency: targetKg,
      capacityUtilization: 100,
      totalOperator: totalOps,
      absent: 0,
      absentPct: 0,
      remarks: '',
      productionFlatKnit: 0,
      achievmentCircular: 0,
      otd: 100,
      yarnIssued: 0,
      totalRunningFactories: 0,
      numberVehicles: 0,
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
         updated.month = months[monthNum - 1] || 'August';
         updated.year = yearNum;
         const dObj = new Date(value + 'T00:00:00');
         const dNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
         if (!isNaN(dObj.getDay())) {
           updated.day = dNames[dObj.getDay()];
         }
      }
    } else if (field === 'floor') {
      const targetKg = getTargetForFloor(value);
      const totalM = getTotalMachinesForFloor(value);
      const operatorsMap: Record<string, number> = {
        'EKL': 110,
        'EFL': 95,
        'EFL-2': 85,
        'Auto Stripe': 50,
        'EFL-Extension': 65,
        'ESL-Extension': 40,
        'Sub-Contact': 0,
      };
      updated.target = targetKg;
      updated.totalOperator = operatorsMap[value] || 90;
      updated.totalMachines = totalM;
      updated.runningMachine = totalM;
      updated.runningSample = 0;
      updated.runningBulk = totalM;
      updated.unit = value === 'Sub-Contact' ? 'Sub-Contact' : 'In-House';
      
      // Initialize sub-contact fields if floor changes to Sub-Contact
      if (value === 'Sub-Contact') {
        updated.productionFlatKnit = updated.productionFlatKnit ?? 0;
        updated.yarnIssued = updated.yarnIssued ?? 0;
        updated.runningFactories = updated.runningFactories ?? 0;
        updated.fabricReturn = updated.fabricReturn ?? 0;
      }
    }

    // Auto-sum shifts into total production if not Sub-Contact
    if (field === 'shiftA' || field === 'shiftB' || field === 'shiftC') {
      if (updated.floor !== 'Sub-Contact') {
        updated.totalProduction = (Number(updated.shiftA) || 0) + (Number(updated.shiftB) || 0) + (Number(updated.shiftC) || 0);
      }
    }

    // Machine updates:
    // If Running Sample changes, Running Bulk (MC) adjusts (Running Bulk = Running Machine - Running Sample)
    // and Total Active Running Machine remains unchanged!
    if (field === 'runningMachine') {
      const rM = Number(value) || 0;
      const rS = Number(updated.runningSample) || 0;
      updated.runningMachine = rM;
      updated.runningBulk = Math.max(0, rM - rS);
    } else if (field === 'runningSample') {
      const rS = Number(value) || 0;
      const rM = Number(updated.runningMachine) || 0;
      updated.runningSample = rS;
      // Changes should be made in Running Bulk (MC) instead of changing Total Active Machine
      updated.runningBulk = Math.max(0, rM - rS);
    } else if (field === 'runningBulk') {
      const rB = Number(value) || 0;
      const rS = Number(updated.runningSample) || 0;
      updated.runningBulk = rB;
      updated.runningMachine = rB + rS;
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

    const cleanFloor = (creatingRecord.floor || 'unit').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const tempId = `rec-${creatingRecord.date || '2026-08-11'}-${cleanFloor}-${Date.now()}`;
    const recordWithTempId: LedgerRecord = { ...creatingRecord, id: tempId };

    // Update local state immediately
    setLedger((prev) => [recordWithTempId, ...prev]);
    setIsCreateModalOpen(false);
    setCreatingRecord(null);
    triggerToast(`Production entry for ${creatingRecord.floor} on ${creatingRecord.date} saved & syncing.`);

    // 1. Sync with Firestore
    FirestoreSyncService.saveLedgerRecord(recordWithTempId, currentUser?.userName || 'Manager')
      .catch((err: any) => {
        console.warn("Background ledger save notice:", err);
      });

    // 2. Sync with GAS / Google Sheets
    GasClient.addLedgerEntry(recordWithTempId)
      .catch((gasErr: any) => {
        console.warn("GAS submission notice:", gasErr);
      });
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
    } else if (field === 'floor') {
      const targetKg = getTargetForFloor(value);
      const totalM = getTotalMachinesForFloor(value);
      updated.target = targetKg;
      updated.totalMachines = totalM;
    }

    // Auto-sum shifts into total production if not Sub-Contact
    if (field === 'shiftA' || field === 'shiftB' || field === 'shiftC') {
      if (updated.floor !== 'Sub-Contact') {
        updated.totalProduction = (Number(updated.shiftA) || 0) + (Number(updated.shiftB) || 0) + (Number(updated.shiftC) || 0);
      }
    }

    // Machine updates:
    // If Running Sample changes, Running Bulk (MC) adjusts (Running Bulk = Running Machine - Running Sample)
    // and Total Active Running Machine remains unchanged!
    if (field === 'runningMachine') {
      const rM = Number(value) || 0;
      const rS = Number(updated.runningSample) || 0;
      updated.runningMachine = rM;
      updated.runningBulk = Math.max(0, rM - rS);
    } else if (field === 'runningSample') {
      const rS = Number(value) || 0;
      const rM = Number(updated.runningMachine) || 0;
      updated.runningSample = rS;
      // Changes should be made in Running Bulk (MC) instead of changing Total Active Machine
      updated.runningBulk = Math.max(0, rM - rS);
    } else if (field === 'runningBulk') {
      const rB = Number(value) || 0;
      const rS = Number(updated.runningSample) || 0;
      updated.runningBulk = rB;
      updated.runningMachine = rB + rS;
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
        "Consumables Ledger", "", "", "", "",
        "Efficiency Loss Projections", "", "",
        "Manpower Roster", "", "",
        "Other Operational Parameters", "",
        "Sub-Contact Parameters", "", "", "", ""
      ],
      [
        "Calendar Year", "Month Name", "Date (DD MMM YYYY)", "Floor / Unit",
        "Target Output (Kg)", "Shift A Output (Kg)", "Shift B Output (Kg)", "Shift C Output (Kg)", "Cumulative Yield (Kg)", "Achievement (%)",
        "Active Machines", "Idle Machines", "Utilization Rate (%)", "Idle Rate (%)", "Idle Production Lost (Kg)", "Net Efficiency (%)", "Production per Active Frame (Kg)",
        "Reject Scrap (Kg)", "Reject Rate (%)", "Hold Scrap (Kg)", "Hold Rate (%)",
        "Needles Broken (Pcs)", "Needle Broken/KG", "Sinkers Broken (Pcs)", "Sinker Broken/KG", "Lubricating Oil (Liters)",
        "Yield Deficit vs Plan (Kg)", "Production Loss for Sample (Kg)", "Installed Capacity Ratio (%)",
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
        r.needleBroken, r.needlePerKg, r.sinkerBroken, r.sinkerPerKg, r.oilConsumption,
        r.productionLossForEfficiency, r.prodLossForSample, r.capacityUtilization,
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
      { s: { r: 0, c: 21 }, e: { r: 0, c: 25 } }, // Consumables
      { s: { r: 0, c: 26 }, e: { r: 0, c: 28 } }, // Efficiency Loss
      { s: { r: 0, c: 29 }, e: { r: 0, c: 31 } }, // Manpower Roster
      { s: { r: 0, c: 32 }, e: { r: 0, c: 33 } }, // Other Parameters
      { s: { r: 0, c: 34 }, e: { r: 0, c: 38 } }  // Sub-Contact Parameters
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
    <div className="space-y-6 w-full min-w-0 max-w-full">
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
            Cumulative Scrap: {(((summaryKPIs.rejectPct || 0) + (summaryKPIs.holdPct || 0)) || 0).toFixed(2)}%
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

            <ColumnCustomizerDropdown
              tableId="production_ledger"
              columns={PRODUCTION_LEDGER_COLUMNS}
              hiddenColumns={hiddenColumns}
              onToggleColumn={toggleColumn}
              onResetColumns={resetColumns}
              isFrozen={isFrozen}
              freezeCount={freezeCount}
              onToggleFreeze={toggleFreeze}
              onSetFreezeCount={setFreezeCount}
            />
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
        <div className="overflow-x-auto border border-gray-100 dark:border-slate-800 rounded-xl max-h-[550px]">
          <table className="w-full text-left text-[11px] font-semibold border-collapse">
            <thead className="sticky top-0 z-30 bg-[#0e4a68] dark:bg-[#083348] text-white shadow-md">
              <tr className="border-b border-[#0a3a52] text-[10px] font-bold uppercase tracking-wider divide-x divide-[#13597d]">
                {PRODUCTION_LEDGER_COLUMNS.map((col) => {
                  if (col.id === 'action') {
                    return (
                      <th key={col.id} className="px-3 py-2.5 bg-[#0a3950] text-center text-white font-bold sticky right-0 z-40 whitespace-nowrap">
                        Actions
                      </th>
                    );
                  }
                  if (!isColVisible(col.id)) return null;

                  const isSticky = isColFrozen(col.id);
                  const stickyLeft = getStickyLeft(col.id);
                  const isLastFrozen = col.id === lastFrozenColId;

                  return (
                    <ResizableTh
                      key={col.id}
                      width={getColWidth(col.id)}
                      onWidthChange={(w) => setColumnWidth(col.id, w)}
                      isSticky={isSticky}
                      stickyLeft={stickyLeft}
                      isLastFrozen={isLastFrozen}
                      stickyBgClass="bg-[#0e4a68] dark:bg-[#083348]"
                      className="px-2.5 py-2.5 cursor-pointer hover:bg-[#13597d] transition-colors text-white bg-[#0e4a68] dark:bg-[#083348] align-middle"
                      onClick={() => {
                        setSortField(col.id as any);
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <div className="flex items-center justify-between gap-1 w-full text-left">
                        <span className="whitespace-normal break-words leading-tight">{col.label}</span>
                        <ChevronDown className="h-3 w-3 text-cyan-200/80 shrink-0 ml-0.5" />
                      </div>
                    </ResizableTh>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-[11px] text-gray-700 dark:text-slate-300 font-semibold">
              {paginatedRecords.map((r, index) => (
                <tr
                  key={r.id}
                  className={`hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors divide-x divide-gray-100 dark:divide-slate-800 ${
                    index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/30 dark:bg-slate-900/50'
                  }`}
                >
                  {isColVisible('unit') && (
                    <td style={{ width: `${getColWidth('unit')}px`, minWidth: `${getColWidth('unit')}px`, maxWidth: `${getColWidth('unit')}px`, ...getStickyStyle('unit') }} className={`px-2.5 py-2 text-left whitespace-nowrap font-medium ${getStickyClass('unit')}`}>
                      {r.unit || (r.floor === 'Sub-Contact' ? 'Sub-Contact' : 'In-House')}
                    </td>
                  )}
                  {isColVisible('year') && (
                    <td style={{ width: `${getColWidth('year')}px`, minWidth: `${getColWidth('year')}px`, maxWidth: `${getColWidth('year')}px`, ...getStickyStyle('year') }} className={`px-2.5 py-2 text-center font-mono text-gray-500 whitespace-nowrap ${getStickyClass('year')}`}>
                      {r.year}
                    </td>
                  )}
                  {isColVisible('month') && (
                    <td style={{ width: `${getColWidth('month')}px`, minWidth: `${getColWidth('month')}px`, maxWidth: `${getColWidth('month')}px`, ...getStickyStyle('month') }} className={`px-2.5 py-2 text-left text-gray-600 whitespace-nowrap ${getStickyClass('month')}`}>
                      {r.month}
                    </td>
                  )}
                  {isColVisible('date') && (
                    <td style={{ width: `${getColWidth('date')}px`, minWidth: `${getColWidth('date')}px`, maxWidth: `${getColWidth('date')}px`, ...getStickyStyle('date') }} className={`px-2.5 py-2 text-center font-mono font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap ${getStickyClass('date')}`}>
                      {formatDateFriendly(r.date)}
                    </td>
                  )}
                  {isColVisible('floor') && (
                    <td style={{ width: `${getColWidth('floor')}px`, minWidth: `${getColWidth('floor')}px`, maxWidth: `${getColWidth('floor')}px`, ...getStickyStyle('floor') }} className={`px-2.5 py-2 text-left font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap ${getStickyClass('floor')}`}>
                      {r.floor}
                    </td>
                  )}
                  {isColVisible('target') && (
                    <td style={{ width: `${getColWidth('target')}px`, minWidth: `${getColWidth('target')}px`, maxWidth: `${getColWidth('target')}px`, ...getStickyStyle('target') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('target')}`}>
                      {r.target !== undefined && r.target !== null ? r.target.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('shiftA') && (
                    <td style={{ width: `${getColWidth('shiftA')}px`, minWidth: `${getColWidth('shiftA')}px`, maxWidth: `${getColWidth('shiftA')}px`, ...getStickyStyle('shiftA') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('shiftA')}`}>
                      {r.shiftA !== undefined && r.shiftA !== null ? r.shiftA.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('shiftB') && (
                    <td style={{ width: `${getColWidth('shiftB')}px`, minWidth: `${getColWidth('shiftB')}px`, maxWidth: `${getColWidth('shiftB')}px`, ...getStickyStyle('shiftB') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('shiftB')}`}>
                      {r.shiftB !== undefined && r.shiftB !== null ? r.shiftB.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('shiftC') && (
                    <td style={{ width: `${getColWidth('shiftC')}px`, minWidth: `${getColWidth('shiftC')}px`, maxWidth: `${getColWidth('shiftC')}px`, ...getStickyStyle('shiftC') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('shiftC')}`}>
                      {r.shiftC !== undefined && r.shiftC !== null ? r.shiftC.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('totalProduction') && (
                    <td style={{ width: `${getColWidth('totalProduction')}px`, minWidth: `${getColWidth('totalProduction')}px`, maxWidth: `${getColWidth('totalProduction')}px`, ...getStickyStyle('totalProduction') }} className={`px-2.5 py-2 text-right font-mono font-bold text-[#0F4C81] dark:text-blue-300 whitespace-nowrap ${getStickyClass('totalProduction')}`}>
                      {r.totalProduction !== undefined && r.totalProduction !== null ? r.totalProduction.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('targetBulk') && (
                    <td style={{ width: `${getColWidth('targetBulk')}px`, minWidth: `${getColWidth('targetBulk')}px`, maxWidth: `${getColWidth('targetBulk')}px`, ...getStickyStyle('targetBulk') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('targetBulk')}`}>
                      {r.targetBulk !== undefined && r.targetBulk !== null ? r.targetBulk.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('bulkProd') && (
                    <td style={{ width: `${getColWidth('bulkProd')}px`, minWidth: `${getColWidth('bulkProd')}px`, maxWidth: `${getColWidth('bulkProd')}px`, ...getStickyStyle('bulkProd') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('bulkProd')}`}>
                      {r.bulkProd !== undefined && r.bulkProd !== null ? r.bulkProd.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('sampleProd') && (
                    <td style={{ width: `${getColWidth('sampleProd')}px`, minWidth: `${getColWidth('sampleProd')}px`, maxWidth: `${getColWidth('sampleProd')}px`, ...getStickyStyle('sampleProd') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('sampleProd')}`}>
                      {r.sampleProd !== undefined && r.sampleProd !== null ? r.sampleProd.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('runningBulk') && (
                    <td style={{ width: `${getColWidth('runningBulk')}px`, minWidth: `${getColWidth('runningBulk')}px`, maxWidth: `${getColWidth('runningBulk')}px`, ...getStickyStyle('runningBulk') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('runningBulk')}`}>
                      {r.runningBulk !== undefined && r.runningBulk !== null ? r.runningBulk.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('runningSample') && (
                    <td style={{ width: `${getColWidth('runningSample')}px`, minWidth: `${getColWidth('runningSample')}px`, maxWidth: `${getColWidth('runningSample')}px`, ...getStickyStyle('runningSample') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('runningSample')}`}>
                      {r.runningSample !== undefined && r.runningSample !== null ? r.runningSample.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('idleMc') && (
                    <td style={{ width: `${getColWidth('idleMc')}px`, minWidth: `${getColWidth('idleMc')}px`, maxWidth: `${getColWidth('idleMc')}px`, ...getStickyStyle('idleMc') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('idleMc')}`}>
                      {r.idleMc !== undefined ? r.idleMc : (r.idleMachine ?? '')}
                    </td>
                  )}
                  {isColVisible('machineUtilization') && (
                    <td style={{ width: `${getColWidth('machineUtilization')}px`, minWidth: `${getColWidth('machineUtilization')}px`, maxWidth: `${getColWidth('machineUtilization')}px`, ...getStickyStyle('machineUtilization') }} className={`px-2.5 py-2 text-center font-mono font-semibold text-gray-800 dark:text-slate-200 whitespace-nowrap ${getStickyClass('machineUtilization')}`}>
                      {r.machineUtilization !== undefined ? `${r.machineUtilization}%` : ''}
                    </td>
                  )}
                  {isColVisible('idleMcPct') && (
                    <td style={{ width: `${getColWidth('idleMcPct')}px`, minWidth: `${getColWidth('idleMcPct')}px`, maxWidth: `${getColWidth('idleMcPct')}px`, ...getStickyStyle('idleMcPct') }} className={`px-2.5 py-2 text-center font-mono text-gray-500 whitespace-nowrap ${getStickyClass('idleMcPct')}`}>
                      {r.idleMcPct !== undefined ? `${r.idleMcPct}%` : (r.idleMachinePct !== undefined ? `${r.idleMachinePct}%` : '')}
                    </td>
                  )}
                  {isColVisible('idleProduction') && (
                    <td style={{ width: `${getColWidth('idleProduction')}px`, minWidth: `${getColWidth('idleProduction')}px`, maxWidth: `${getColWidth('idleProduction')}px`, ...getStickyStyle('idleProduction') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('idleProduction')}`}>
                      {r.idleProduction !== undefined && r.idleProduction !== null ? r.idleProduction.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('efficiency') && (
                    <td style={{ width: `${getColWidth('efficiency')}px`, minWidth: `${getColWidth('efficiency')}px`, maxWidth: `${getColWidth('efficiency')}px`, ...getStickyStyle('efficiency') }} className={`px-2.5 py-2 text-right font-mono font-bold whitespace-nowrap ${getStickyClass('efficiency')}`}>
                      {r.efficiency !== undefined ? `${r.efficiency}%` : ''}
                    </td>
                  )}
                  {isColVisible('proPerMc') && (
                    <td style={{ width: `${getColWidth('proPerMc')}px`, minWidth: `${getColWidth('proPerMc')}px`, maxWidth: `${getColWidth('proPerMc')}px`, ...getStickyStyle('proPerMc') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('proPerMc')}`}>
                      {r.proPerMc !== undefined ? r.proPerMc : (r.productionPerMachine !== undefined ? r.productionPerMachine : '')}
                    </td>
                  )}
                  {isColVisible('reject') && (
                    <td style={{ width: `${getColWidth('reject')}px`, minWidth: `${getColWidth('reject')}px`, maxWidth: `${getColWidth('reject')}px`, ...getStickyStyle('reject') }} className={`px-2.5 py-2 text-right font-mono text-red-600 font-bold whitespace-nowrap ${getStickyClass('reject')}`}>
                      {r.reject !== undefined && r.reject !== null ? r.reject.toLocaleString() : '0'}
                    </td>
                  )}
                  {isColVisible('rejectPct') && (
                    <td style={{ width: `${getColWidth('rejectPct')}px`, minWidth: `${getColWidth('rejectPct')}px`, maxWidth: `${getColWidth('rejectPct')}px`, ...getStickyStyle('rejectPct') }} className={`px-2.5 py-2 text-right font-mono text-red-500 whitespace-nowrap ${getStickyClass('rejectPct')}`}>
                      {r.rejectPct !== undefined ? `${r.rejectPct}%` : ''}
                    </td>
                  )}
                  {isColVisible('hold') && (
                    <td style={{ width: `${getColWidth('hold')}px`, minWidth: `${getColWidth('hold')}px`, maxWidth: `${getColWidth('hold')}px`, ...getStickyStyle('hold') }} className={`px-2.5 py-2 text-right font-mono text-amber-600 whitespace-nowrap ${getStickyClass('hold')}`}>
                      {r.hold !== undefined && r.hold !== null ? r.hold.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('holdPct') && (
                    <td style={{ width: `${getColWidth('holdPct')}px`, minWidth: `${getColWidth('holdPct')}px`, maxWidth: `${getColWidth('holdPct')}px`, ...getStickyStyle('holdPct') }} className={`px-2.5 py-2 text-right font-mono text-amber-500 whitespace-nowrap ${getStickyClass('holdPct')}`}>
                      {r.holdPct !== undefined ? `${r.holdPct}%` : ''}
                    </td>
                  )}
                  {isColVisible('jhuteCutpcs') && (
                    <td style={{ width: `${getColWidth('jhuteCutpcs')}px`, minWidth: `${getColWidth('jhuteCutpcs')}px`, maxWidth: `${getColWidth('jhuteCutpcs')}px`, ...getStickyStyle('jhuteCutpcs') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('jhuteCutpcs')}`}>
                      {r.jhuteCutpcs !== undefined && r.jhuteCutpcs !== null ? r.jhuteCutpcs.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('jhuteCutpcsPct') && (
                    <td style={{ width: `${getColWidth('jhuteCutpcsPct')}px`, minWidth: `${getColWidth('jhuteCutpcsPct')}px`, maxWidth: `${getColWidth('jhuteCutpcsPct')}px`, ...getStickyStyle('jhuteCutpcsPct') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('jhuteCutpcsPct')}`}>
                      {r.jhuteCutpcsPct !== undefined ? `${r.jhuteCutpcsPct}%` : ''}
                    </td>
                  )}
                  {isColVisible('needleBroken') && (
                    <td style={{ width: `${getColWidth('needleBroken')}px`, minWidth: `${getColWidth('needleBroken')}px`, maxWidth: `${getColWidth('needleBroken')}px`, ...getStickyStyle('needleBroken') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('needleBroken')}`}>
                      {r.needleBroken !== undefined && r.needleBroken !== null ? r.needleBroken.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('needlePerKg') && (
                    <td style={{ width: `${getColWidth('needlePerKg')}px`, minWidth: `${getColWidth('needlePerKg')}px`, maxWidth: `${getColWidth('needlePerKg')}px`, ...getStickyStyle('needlePerKg') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('needlePerKg')}`}>
                      {r.needlePerKg !== undefined ? r.needlePerKg : ''}
                    </td>
                  )}
                  {isColVisible('sinkerBroken') && (
                    <td style={{ width: `${getColWidth('sinkerBroken')}px`, minWidth: `${getColWidth('sinkerBroken')}px`, maxWidth: `${getColWidth('sinkerBroken')}px`, ...getStickyStyle('sinkerBroken') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('sinkerBroken')}`}>
                      {r.sinkerBroken !== undefined && r.sinkerBroken !== null ? r.sinkerBroken.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('sinkerPerKg') && (
                    <td style={{ width: `${getColWidth('sinkerPerKg')}px`, minWidth: `${getColWidth('sinkerPerKg')}px`, maxWidth: `${getColWidth('sinkerPerKg')}px`, ...getStickyStyle('sinkerPerKg') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('sinkerPerKg')}`}>
                      {r.sinkerPerKg !== undefined ? r.sinkerPerKg : ''}
                    </td>
                  )}
                  {isColVisible('oilConsumption') && (
                    <td style={{ width: `${getColWidth('oilConsumption')}px`, minWidth: `${getColWidth('oilConsumption')}px`, maxWidth: `${getColWidth('oilConsumption')}px`, ...getStickyStyle('oilConsumption') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('oilConsumption')}`}>
                      {r.oilConsumption !== undefined && r.oilConsumption !== null ? r.oilConsumption.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('beltBroken') && (
                    <td style={{ width: `${getColWidth('beltBroken')}px`, minWidth: `${getColWidth('beltBroken')}px`, maxWidth: `${getColWidth('beltBroken')}px`, ...getStickyStyle('beltBroken') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('beltBroken')}`}>
                      {r.beltBroken !== undefined && r.beltBroken !== null ? r.beltBroken.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('otherSparePartsName') && (
                    <td style={{ width: `${getColWidth('otherSparePartsName')}px`, minWidth: `${getColWidth('otherSparePartsName')}px`, maxWidth: `${getColWidth('otherSparePartsName')}px`, ...getStickyStyle('otherSparePartsName') }} className={`px-2.5 py-2 text-left text-gray-600 whitespace-nowrap ${getStickyClass('otherSparePartsName')}`}>
                      {r.otherSparePartsName || ''}
                    </td>
                  )}
                  {isColVisible('otherSparePartsQty') && (
                    <td style={{ width: `${getColWidth('otherSparePartsQty')}px`, minWidth: `${getColWidth('otherSparePartsQty')}px`, maxWidth: `${getColWidth('otherSparePartsQty')}px`, ...getStickyStyle('otherSparePartsQty') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('otherSparePartsQty')}`}>
                      {r.otherSparePartsQty !== undefined && r.otherSparePartsQty !== null ? r.otherSparePartsQty.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('setChangePcs') && (
                    <td style={{ width: `${getColWidth('setChangePcs')}px`, minWidth: `${getColWidth('setChangePcs')}px`, maxWidth: `${getColWidth('setChangePcs')}px`, ...getStickyStyle('setChangePcs') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('setChangePcs')}`}>
                      {r.setChangePcs !== undefined ? r.setChangePcs.toLocaleString() : (r.setChange !== undefined ? r.setChange.toLocaleString() : '')}
                    </td>
                  )}
                  {isColVisible('productionLossForEff') && (
                    <td style={{ width: `${getColWidth('productionLossForEff')}px`, minWidth: `${getColWidth('productionLossForEff')}px`, maxWidth: `${getColWidth('productionLossForEff')}px`, ...getStickyStyle('productionLossForEff') }} className={`px-2.5 py-2 text-right font-mono whitespace-nowrap ${r.productionLossForEff && r.productionLossForEff < 0 ? 'text-green-600 font-semibold' : 'text-gray-600'} ${getStickyClass('productionLossForEff')}`}>
                      {r.productionLossForEff !== undefined ? r.productionLossForEff.toLocaleString() : (r.productionLossForEfficiency !== undefined ? r.productionLossForEfficiency.toLocaleString() : '')}
                    </td>
                  )}
                  {isColVisible('prodLossForSample') && (
                    <td style={{ width: `${getColWidth('prodLossForSample')}px`, minWidth: `${getColWidth('prodLossForSample')}px`, maxWidth: `${getColWidth('prodLossForSample')}px`, ...getStickyStyle('prodLossForSample') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('prodLossForSample')}`}>
                      {r.prodLossForSample !== undefined && r.prodLossForSample !== null ? r.prodLossForSample.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('capacityUtilization') && (
                    <td style={{ width: `${getColWidth('capacityUtilization')}px`, minWidth: `${getColWidth('capacityUtilization')}px`, maxWidth: `${getColWidth('capacityUtilization')}px`, ...getStickyStyle('capacityUtilization') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('capacityUtilization')}`}>
                      {r.capacityUtilization !== undefined ? `${r.capacityUtilization}%` : ''}
                    </td>
                  )}
                  {isColVisible('totalOperator') && (
                    <td style={{ width: `${getColWidth('totalOperator')}px`, minWidth: `${getColWidth('totalOperator')}px`, maxWidth: `${getColWidth('totalOperator')}px`, ...getStickyStyle('totalOperator') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('totalOperator')}`}>
                      {r.totalOperator !== undefined && r.totalOperator !== null ? r.totalOperator.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('absent') && (
                    <td style={{ width: `${getColWidth('absent')}px`, minWidth: `${getColWidth('absent')}px`, maxWidth: `${getColWidth('absent')}px`, ...getStickyStyle('absent') }} className={`px-2.5 py-2 text-right font-mono text-red-500 whitespace-nowrap ${getStickyClass('absent')}`}>
                      {r.absent !== undefined && r.absent !== null ? r.absent.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('absentPct') && (
                    <td style={{ width: `${getColWidth('absentPct')}px`, minWidth: `${getColWidth('absentPct')}px`, maxWidth: `${getColWidth('absentPct')}px`, ...getStickyStyle('absentPct') }} className={`px-2.5 py-2 text-right font-mono text-red-400 whitespace-nowrap ${getStickyClass('absentPct')}`}>
                      {r.absentPct !== undefined ? `${r.absentPct}%` : ''}
                    </td>
                  )}
                  {isColVisible('productionFlatKnit') && (
                    <td style={{ width: `${getColWidth('productionFlatKnit')}px`, minWidth: `${getColWidth('productionFlatKnit')}px`, maxWidth: `${getColWidth('productionFlatKnit')}px`, ...getStickyStyle('productionFlatKnit') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('productionFlatKnit')}`}>
                      {r.productionFlatKnit !== undefined && r.productionFlatKnit !== null ? r.productionFlatKnit.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('achievmentCircular') && (
                    <td style={{ width: `${getColWidth('achievmentCircular')}px`, minWidth: `${getColWidth('achievmentCircular')}px`, maxWidth: `${getColWidth('achievmentCircular')}px`, ...getStickyStyle('achievmentCircular') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('achievmentCircular')}`}>
                      {r.achievmentCircular !== undefined && r.achievmentCircular !== null ? r.achievmentCircular.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('otd') && (
                    <td style={{ width: `${getColWidth('otd')}px`, minWidth: `${getColWidth('otd')}px`, maxWidth: `${getColWidth('otd')}px`, ...getStickyStyle('otd') }} className={`px-2.5 py-2 text-center font-mono text-gray-600 whitespace-nowrap ${getStickyClass('otd')}`}>
                      {r.otd || ''}
                    </td>
                  )}
                  {isColVisible('yarnIssued') && (
                    <td style={{ width: `${getColWidth('yarnIssued')}px`, minWidth: `${getColWidth('yarnIssued')}px`, maxWidth: `${getColWidth('yarnIssued')}px`, ...getStickyStyle('yarnIssued') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('yarnIssued')}`}>
                      {r.yarnIssued !== undefined && r.yarnIssued !== null ? r.yarnIssued.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('totalRunningFactories') && (
                    <td style={{ width: `${getColWidth('totalRunningFactories')}px`, minWidth: `${getColWidth('totalRunningFactories')}px`, maxWidth: `${getColWidth('totalRunningFactories')}px`, ...getStickyStyle('totalRunningFactories') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('totalRunningFactories')}`}>
                      {r.totalRunningFactories !== undefined ? r.totalRunningFactories.toLocaleString() : (r.runningFactories ? r.runningFactories.toLocaleString() : '')}
                    </td>
                  )}
                  {isColVisible('runningMachine') && (
                    <td style={{ width: `${getColWidth('runningMachine')}px`, minWidth: `${getColWidth('runningMachine')}px`, maxWidth: `${getColWidth('runningMachine')}px`, ...getStickyStyle('runningMachine') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('runningMachine')}`}>
                      {r.runningMachine !== undefined && r.runningMachine !== null ? r.runningMachine.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('numberVehicles') && (
                    <td style={{ width: `${getColWidth('numberVehicles')}px`, minWidth: `${getColWidth('numberVehicles')}px`, maxWidth: `${getColWidth('numberVehicles')}px`, ...getStickyStyle('numberVehicles') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('numberVehicles')}`}>
                      {r.numberVehicles !== undefined && r.numberVehicles !== null ? r.numberVehicles.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('fabricReturn') && (
                    <td style={{ width: `${getColWidth('fabricReturn')}px`, minWidth: `${getColWidth('fabricReturn')}px`, maxWidth: `${getColWidth('fabricReturn')}px`, ...getStickyStyle('fabricReturn') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('fabricReturn')}`}>
                      {r.fabricReturn !== undefined && r.fabricReturn !== null ? r.fabricReturn.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('remarks') && (
                    <td style={{ width: `${getColWidth('remarks')}px`, minWidth: `${getColWidth('remarks')}px`, maxWidth: `${getColWidth('remarks')}px`, ...getStickyStyle('remarks') }} className={`px-3 py-2 text-left font-normal text-gray-600 dark:text-slate-300 whitespace-nowrap truncate ${getStickyClass('remarks')}`} title={r.remarks}>
                      {r.remarks || ''}
                    </td>
                  )}

                  {/* Sticky right actions cell */}
                  <td className="px-3 py-2 text-center whitespace-nowrap sticky right-0 bg-white dark:bg-slate-900 z-10">
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
                  <td colSpan={52} className="py-16 text-center text-xs font-black text-gray-400 uppercase tracking-widest">
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

                  {/* Block 2: Production weights */}
                  <div className="rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 p-4 space-y-3.5">
                    <h4 className="font-sans text-[11px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest border-b border-gray-100 dark:border-slate-800 pb-1 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" /> Production Weights
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
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
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase">Target Bulk (Kg)</label>
                        <input
                          type="number"
                          readOnly
                          value={editingRecord.targetBulk ?? 0}
                          className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-blue-700 dark:text-blue-400 outline-none cursor-not-allowed"
                          title="Auto-calculated (Running Bulk * Avg Prod / Mc)"
                        />
                      </div>
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
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Total Prod</label>
                        <input
                          type="number"
                          readOnly
                          value={editingRecord.totalProduction}
                          className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-black text-[#0F4C81] dark:text-blue-300 outline-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Sample (Kg)</label>
                        <input
                          type="number"
                          value={editingRecord.sampleProd ?? 0}
                          onChange={(e) => handleEditChange('sampleProd', parseFloat(e.target.value) || 0)}
                          className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 outline-hidden focus:border-[#0F4C81]"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Bulk (Kg)</label>
                        <input
                          type="number"
                          readOnly
                          value={editingRecord.bulkProd ?? 0}
                          className="w-full rounded-lg bg-gray-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono font-black text-emerald-700 dark:text-emerald-400 outline-hidden"
                          title="Auto: Total Production - Sample Production"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-dashed border-gray-200 dark:border-slate-800 text-[10px]">
                      <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                        <span className="text-gray-400 uppercase font-bold block leading-tight mb-0.5">Capacity Util %</span>
                        <span className="font-mono text-xs font-black text-indigo-700 dark:text-indigo-400">{editingRecord.capacityUtilization ?? 0}%</span>
                      </div>
                      <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                        <span className="text-gray-400 uppercase font-bold block leading-tight mb-0.5">Prod Loss Sample</span>
                        <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">{editingRecord.prodLossForSample ?? 0} Kg</span>
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
                      {/* Total Machine & Running Machine */}
                      <div className="grid grid-cols-2 gap-2">
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
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase block">Running (Total Active)</label>
                          <input
                            type="number"
                            value={editingRecord.runningMachine}
                            onChange={(e) => handleEditChange('runningMachine', parseInt(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-mono font-bold text-gray-800 dark:text-slate-100 outline-none focus:border-indigo-500"
                            placeholder="Active count"
                          />
                        </div>
                      </div>

                      {/* Running Sample & Running Bulk */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase block">Running Sample (Mc)</label>
                          <input
                            type="number"
                            value={editingRecord.runningSample ?? 0}
                            onChange={(e) => handleEditChange('runningSample', parseInt(e.target.value) || 0)}
                            className="w-full rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-1.5 text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300 outline-none focus:border-indigo-500"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase block">Running Bulk (Mc)</label>
                          <input
                            type="number"
                            value={editingRecord.runningBulk ?? 0}
                            onChange={(e) => handleEditChange('runningBulk', parseInt(e.target.value) || 0)}
                            className="w-full rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 px-3 py-1.5 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 outline-none focus:border-emerald-500"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Idle machine */}
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

                      {/* Calculations array: Utilization Rate, Efficiency, Prod Loss EFF */}
                      <div className="grid grid-cols-3 gap-2 border-t border-dashed border-gray-250 dark:border-slate-800 pt-3 text-[10px]">
                        {/* Utilization Rate */}
                        <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                          <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Utilization</span>
                          <span className="font-mono text-xs font-black text-gray-950 dark:text-white">{editingRecord.machineUtilization}%</span>
                        </div>

                        {/* Production Loss EFF */}
                        <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                          <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Loss for EFF</span>
                          <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400">{editingRecord.productionLossForEff ?? 0} Kg</span>
                        </div>

                        {/* Efficiency */}
                        <div className="bg-white dark:bg-slate-900/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
                          <span className="text-gray-400 uppercase font-bold block leading-tight mb-1">Efficiency</span>
                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">{editingRecord.efficiency}%</span>
                        </div>
                      </div>

                      {/* Set Change (Manual Entry) */}
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

      {/* 7.5. POPUP MODAL: ADD PRODUCTION RECORD (52 COLUMNS FULL FORM) */}
      <AddProductionRecordModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setCreatingRecord(null); }}
        record={creatingRecord}
        onChange={handleCreateChange}
        onSave={handleSaveCreate}
        errors={createErrors}
      />

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
