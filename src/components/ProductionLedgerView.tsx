/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
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
  RefreshCw,
  Upload,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LedgerRecord } from '../types';
import { GasClient } from '../lib/gasClient';
import { useGlobalData } from '../context/GlobalDataContext';
import AddProductionRecordModal from './AddProductionRecordModal';
import UploadLedgerExcelModal, { APP_LEDGER_COLUMNS } from './UploadLedgerExcelModal';
import TotalTargetGaugeCard from './TotalTargetGaugeCard';
import TotalProductionGaugeCard from './TotalProductionGaugeCard';
import ProductionTargetSummaryCard from './ProductionTargetSummaryCard';
import MachineStatusCard from './MachineStatusCard';
import QualityStatusCard from './QualityStatusCard';
import AttendanceCard from './AttendanceCard';
import { LedgerCalendarDatePicker } from './LedgerCalendarDatePicker';
import { 
  getUserAllowedFloorsForEntry, 
  isUserAuthorizedForFloor,
  hasUserWritePermissionForTab
} from '../lib/userPermissions';
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
      setChangeNeedle: 0,
      setChangeSinker: 0,
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
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: -30865.13,
      capacityUtilization: 63.49,
      totalOperator: 49,
      absent: 2,
      absentPct: 4.08,
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
      setChangeNeedle: 0,
      setChangeSinker: 0,
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
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: -32886.16,
      capacityUtilization: 62.80,
      totalOperator: 52,
      absent: 1,
      absentPct: 1.92,
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
      target: 12550,
      shiftA: 3200,
      shiftB: 3190,
      shiftC: 3200,
      totalProduction: 9590,
      targetBulk: 11500,
      bulkProd: 9250,
      sampleProd: 340,
      runningBulk: 42,
      runningSample: 4,
      idleMc: 12,
      machineUtilization: 79.3,
      idleMcPct: 20.7,
      prodLossForSample: 0,
      idleProduction: 2960,
      efficiency: 76.4,
      proPerMc: 208.48,
      reject: 14,
      rejectPct: 0.15,
      hold: 87,
      holdPct: 0.91,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: 58,
      needlePerKg: 165.34,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 12,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: -2960,
      capacityUtilization: 76.4,
      totalOperator: 53,
      absent: 2,
      absentPct: 3.77,
      remarks: '',
      runningMachine: 46,
      idleMachine: 12,
      idleMachinePct: 20.7,
      productionPerMachine: 208.48,
      productionLossForEfficiency: -2960,
    },
    {
      id: 'rec-2026-08-11-auto-stripe',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-11',
      floor: 'Auto Stripe',
      target: 0,
      shiftA: 0,
      shiftB: 0,
      shiftC: 0,
      totalProduction: 0,
      targetBulk: 0,
      bulkProd: 0,
      sampleProd: 0,
      runningBulk: 0,
      runningSample: 0,
      idleMc: 0,
      machineUtilization: 0,
      idleMcPct: 0,
      prodLossForSample: 0,
      idleProduction: 0,
      efficiency: 0,
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
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: 0,
      capacityUtilization: 0,
      totalOperator: 0,
      absent: 0,
      absentPct: 0,
      remarks: '',
      runningMachine: 0,
      idleMachine: 0,
      idleMachinePct: 0,
      productionPerMachine: 0,
      productionLossForEfficiency: 0,
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
      machineUtilization: 77.3,
      idleMcPct: 22.7,
      prodLossForSample: 0,
      idleProduction: 948,
      efficiency: 67.7,
      proPerMc: 186.47,
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
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: -4543,
      capacityUtilization: 67.7,
      totalOperator: 51,
      absent: 2,
      absentPct: 3.92,
      remarks: '',
      runningMachine: 51,
      idleMachine: 15,
      idleMachinePct: 22.7,
      productionPerMachine: 186.47,
      productionLossForEfficiency: -4543,
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
      runningBulk: 31,
      runningSample: 3,
      idleMc: 9,
      machineUtilization: 79.1,
      idleMcPct: 20.9,
      prodLossForSample: 0,
      idleProduction: 3115,
      efficiency: 63.9,
      proPerMc: 162.12,
      reject: 10,
      rejectPct: 0.18,
      hold: 55,
      holdPct: 1.00,
      jhuteCutpcs: 14.6,
      jhuteCutpcsPct: 0,
      needleBroken: 37,
      needlePerKg: 148.97,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 15,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: 3115,
      capacityUtilization: 63.9,
      totalOperator: 50,
      absent: 2,
      absentPct: 4.0,
      remarks: 'power problem 4.13hours',
      runningMachine: 34,
      idleMachine: 9,
      idleMachinePct: 20.9,
      productionPerMachine: 162.12,
      productionLossForEfficiency: 3115,
    },
    {
      id: 'rec-2026-08-26-efl-extension-1787807712863',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-26',
      floor: 'EFL-Extension',
      target: 2160,
      shiftA: 963,
      shiftB: 1140,
      shiftC: 1043,
      totalProduction: 3146,
      targetBulk: 2160,
      bulkProd: 2914,
      sampleProd: 232,
      runningBulk: 12,
      runningSample: 8,
      runningMachine: 20,
      idleMc: 5,
      machineUtilization: 80,
      idleMcPct: 20,
      idleProduction: 900,
      efficiency: 134.91,
      proPerMc: 157.3,
      reject: 3,
      rejectPct: 0.1,
      hold: 0,
      holdPct: 0,
      jhuteCutpcs: 9,
      jhuteCutpcsPct: 0.29,
      needleBroken: 131,
      needlePerKg: 24.02,
      sinkerBroken: 0,
      sinkerPerKg: 0,
      oilConsumption: 9,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: 395,
      prodLossForSample: 1710.67,
      capacityUtilization: 20.97,
      totalOperator: 47,
      absent: 2,
      absentPct: 4.26,
      productionFlatKnit: 0,
      achievmentCircular: 0,
      otd: 100,
      yarnIssued: 0,
      totalRunningFactories: 0,
      numberVehicles: 0,
      fabricReturn: 0,
      remarks: '',
      day: 'Wednesday',
      totalMachines: 25
    },
    {
      id: 'rec-2026-08-26-ekl-1787812028417',
      unit: 'In-House',
      year: 2026,
      month: 'August',
      date: '2026-08-26',
      floor: 'EKL',
      target: 4986,
      shiftA: 1520,
      shiftB: 1275,
      shiftC: 1106,
      totalProduction: 3901,
      targetBulk: 4140,
      bulkProd: 3734,
      sampleProd: 167,
      runningBulk: 18,
      runningSample: 4,
      runningMachine: 22,
      idleMc: 7,
      machineUtilization: 75.9,
      idleMcPct: 24.1,
      idleProduction: 1610,
      efficiency: 90.19,
      proPerMc: 177.32,
      reject: 4.5,
      rejectPct: 0.12,
      hold: 40.38,
      holdPct: 1.04,
      jhuteCutpcs: 16,
      jhuteCutpcsPct: 0.41,
      needleBroken: 42,
      needlePerKg: 92.88,
      sinkerBroken: 1,
      sinkerPerKg: 3901,
      oilConsumption: 9,
      beltBroken: 0,
      otherSparePartsName: '',
      otherSparePartsQty: 0,
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: 1085,
      prodLossForSample: 662.78,
      capacityUtilization: 61.43,
      totalOperator: 42,
      absent: 3,
      absentPct: 7.14,
      productionFlatKnit: 0,
      achievmentCircular: 0,
      otd: 100,
      yarnIssued: 0,
      totalRunningFactories: 0,
      numberVehicles: 0,
      fabricReturn: 0,
      remarks: '',
      day: 'Wednesday',
      totalMachines: 29
    },
    {
      id: 'rec-2026-08-26-sub-contact-1',
      unit: 'Sub-Contact',
      year: 2026,
      month: 'August',
      date: '2026-08-26',
      floor: 'Sub-Contact',
      target: 7183,
      shiftA: 0,
      shiftB: 0,
      shiftC: 0,
      totalProduction: 6459,
      targetBulk: 7183,
      bulkProd: 6459,
      sampleProd: 0,
      runningBulk: 0,
      runningSample: 0,
      runningMachine: 153,
      idleMc: 0,
      machineUtilization: 0,
      idleMcPct: 0,
      idleProduction: 0,
      efficiency: 89.92,
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
      setChangeNeedle: 0,
      setChangeSinker: 0,
      productionLossForEff: 0,
      prodLossForSample: 0,
      capacityUtilization: 89.92,
      totalOperator: 13,
      absent: 0,
      absentPct: 0,
      productionFlatKnit: 0,
      achievmentCircular: 89.92,
      otd: 100,
      yarnIssued: 0,
      totalRunningFactories: 49,
      numberVehicles: 8,
      fabricReturn: 0,
      remarks: '',
      day: 'Wednesday',
      totalMachines: 194
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
  { id: 'setChangeNeedle', label: 'Set Change Needle(Pcs)', defaultWidth: 135 },
  { id: 'setChangeSinker', label: 'Set Change Sinker(Pcs)', defaultWidth: 135 },
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
  const {
    ledger: globalLedger,
    refreshAll,
    saveLedgerRecord: globalSaveLedgerRecord,
    deleteLedgerRecord: globalDeleteLedgerRecord,
    bulkSaveLedgerRecords: globalBulkSaveLedgerRecords
  } = useGlobalData();

  const [isGasMode, setIsGasMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ledgerGasError, setLedgerGasError] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // On mobile screens (< 768px), keep static layout without toggle glitching
          if (window.innerWidth < 768) {
            setIsScrolled(false);
            ticking = false;
            return;
          }
          const scrollY = window.scrollY || window.pageYOffset || 0;
          setIsScrolled((prev) => {
            // Hysteresis threshold: collapse at > 80px, expand at < 25px
            if (!prev && scrollY > 80) {
              return true;
            }
            if (prev && scrollY < 25) {
              return false;
            }
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Master database state
  const [ledger, setLedgerRaw] = useState<LedgerRecord[]>(() => {
    if (globalLedger && globalLedger.length > 0) return globalLedger;
    try {
      const cached = localStorage.getItem('cached_production_ledger');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return generateInitialLedger();
  });

  useEffect(() => {
    if (globalLedger && globalLedger.length > 0) {
      setLedgerRaw(globalLedger);
    }
  }, [globalLedger]);

  const setLedger = (value: LedgerRecord[] | ((prev: LedgerRecord[]) => LedgerRecord[])) => {
    setLedgerRaw((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      const clean = ensureUniqueIds(next, 'rec');
      try {
        localStorage.setItem('cached_production_ledger', JSON.stringify(clean));
      } catch (e) {}
      return clean;
    });
  };

  const loadGasLedger = async (forceRefresh: boolean = false) => {
    try {
      setLedgerGasError(null);
      if (forceRefresh || !globalLedger || globalLedger.length === 0) {
        setIsSyncing(true);
        await refreshAll(forceRefresh);
      }
    } catch (e: any) {
      console.warn("Failed to load GAS ledger in background:", e);
      const errMsg = e.message || "Failed to load from Google Sheets.";
      setLedgerGasError(errMsg);
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Synchronize mode configuration & listen for manual sync events
  React.useEffect(() => {
    const initMode = async () => {
      const config = await GasClient.fetchServerConfig();
      const activeMode = config.databaseMode || GasClient.getDatabaseMode();
      const activeUrl = config.gasWebAppUrl || GasClient.getWebAppUrl();
      if (activeMode === 'gas' && activeUrl) {
        setIsGasMode(true);
      }
    };
    initMode();

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

  // Listener for Unit Threshold updates
  React.useEffect(() => {
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
      window.removeEventListener('unit_configs_updated', handleUnitConfigsUpdated);
    };
  }, []);

  // Helper to dynamically fetch total machines per floor unit from unitStore/settings
  const getTotalMachinesForFloor = (floorName: string) => {
    return getTotalMachinesForUnit(floorName, floorName === 'Sub-Contact' ? 0 : (floorName === 'EKL' ? 29 : 30));
  };

  const getTargetForFloor = (floorName: string) => {
    return getTargetKgForUnit(floorName, 15000);
  };

  // Format single date: YYYY-MM-DD -> "11 Aug, 2026"
  const formatSingleDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${String(day).padStart(2, '0')} ${monthsShort[monthIdx]}, ${year}`;
      }
    }
    return dateStr;
  };

  // Format date range: "01 Aug - 15 Aug, 2026"
  const formatDateRange = (fromStr: string, toStr: string): string => {
    if (!fromStr && !toStr) return '';
    if (fromStr && !toStr) return formatSingleDate(fromStr);
    if (!fromStr && toStr) return formatSingleDate(toStr);
    if (fromStr === toStr) return formatSingleDate(fromStr);

    const pFrom = fromStr.split('-');
    const pTo = toStr.split('-');
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (pFrom.length === 3 && pTo.length === 3) {
      const mFrom = parseInt(pFrom[1], 10) - 1;
      const mTo = parseInt(pTo[1], 10) - 1;
      const dFrom = String(parseInt(pFrom[2], 10)).padStart(2, '0');
      const dTo = String(parseInt(pTo[2], 10)).padStart(2, '0');
      const yFrom = pFrom[0];
      const yTo = pTo[0];

      if (yFrom === yTo && mFrom === mTo) {
        return `${dFrom} - ${dTo} ${monthsShort[mFrom]}, ${yFrom}`;
      } else if (yFrom === yTo) {
        return `${dFrom} ${monthsShort[mFrom]} - ${dTo} ${monthsShort[mTo]}, ${yFrom}`;
      } else {
        return `${dFrom} ${monthsShort[mFrom]} ${yFrom} - ${dTo} ${monthsShort[mTo]} ${yTo}`;
      }
    }
    return `${fromStr} - ${toStr}`;
  };

  // Helper to format yesterday's date as default YYYY-MM-DD
  const getYesterdayDateString = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper to centralize all production, quality, manpower, and machine formulas
  const recalculateRecordFields = (record: LedgerRecord): LedgerRecord => {
    const floorName = record.floor || 'EKL';
    const isSubContact = floorName === 'Sub-Contact' || record.unit === 'Sub-Contact';
    
    // 3. Target KG: Respect user-defined target quantity (even 0 / updated custom targets), only default if undefined/null
    const target = (record.target !== undefined && record.target !== null && !isNaN(Number(record.target)))
      ? Number(record.target)
      : getTargetForFloor(floorName);

    // 6. Total Machine from settings panel
    const totalM = getTotalMachinesForFloor(floorName);
    
    // Total production
    const totalProduction = isSubContact 
      ? (Number(record.totalProduction) || 0) 
      : ((Number(record.shiftA) || 0) + (Number(record.shiftB) || 0) + (Number(record.shiftC) || 0));
    
    // Sample production
    const sampleProd = Number(record.sampleProd) || 0;

    // 5. Bulk PROD (KG) = Total Production - Sample Production
    const bulkProd = Math.max(0, totalProduction - sampleProd);

    // Sub-Contact specific calculations (Strictly Sub-Contact columns only, no In-House pollution)
    if (isSubContact) {
      const achievmentCircular = target > 0 ? parseFloat(((totalProduction / target) * 100).toFixed(2)) : 0;
      const runningMachine = Number(record.runningMachine) || 0;
      const totalRunningFactories = Number(record.totalRunningFactories ?? record.runningFactories) || 0;
      const runningFactories = totalRunningFactories;
      const numberVehicles = Number(record.numberVehicles) || 0;
      const productionFlatKnit = Number(record.productionFlatKnit) || 0;
      const yarnIssued = Number(record.yarnIssued) || 0;
      const fabricReturn = Number(record.fabricReturn) || 0;

      const hold = Number(record.hold) || 0;
      const holdPct = totalProduction > 0 ? parseFloat(((hold / totalProduction) * 100).toFixed(2)) : 0;
      const reject = Number(record.reject) || 0;
      const rejectPct = totalProduction > 0 ? parseFloat(((reject / totalProduction) * 100).toFixed(2)) : 0;
      const jhuteCutpcs = Number(record.jhuteCutpcs) || 0;
      const jhuteCutpcsPct = totalProduction > 0 ? parseFloat(((jhuteCutpcs / totalProduction) * 100).toFixed(2)) : 0;

      const totalOperator = Number(record.totalOperator) || 0;
      const absent = Number(record.absent) || 0;
      const absentPct = totalOperator > 0 ? parseFloat(((absent / totalOperator) * 100).toFixed(2)) : 0;
      const otd = record.otd !== undefined ? record.otd : 100;

      return {
        ...record,
        unit: 'Sub-Contact',
        target,
        shiftA: undefined,
        shiftB: undefined,
        shiftC: undefined,
        targetBulk: undefined,
        totalProduction,
        sampleProd,
        bulkProd,
        achievmentCircular,
        efficiency: achievmentCircular,
        runningMachine,
        runningBulk: undefined,
        runningSample: undefined,
        idleMc: undefined,
        idleMachine: undefined,
        idleProduction: undefined,
        machineUtilization: undefined,
        idleMcPct: undefined,
        idleMachinePct: undefined,
        prodLossForSample: undefined,
        proPerMc: undefined,
        productionPerMachine: undefined,
        totalRunningFactories,
        runningFactories,
        numberVehicles,
        productionFlatKnit,
        yarnIssued,
        fabricReturn,
        hold,
        holdPct,
        reject,
        rejectPct,
        jhuteCutpcs,
        jhuteCutpcsPct,
        needleBroken: undefined,
        needlePerKg: undefined,
        sinkerBroken: undefined,
        sinkerPerKg: undefined,
        oilConsumption: undefined,
        beltBroken: undefined,
        otherSparePartsName: undefined,
        otherSparePartsQty: undefined,
        setChangeNeedle: undefined,
        setChangeSinker: undefined,
        productionLossForEff: undefined,
        productionLossForEfficiency: undefined,
        capacityUtilization: undefined,
        totalOperator,
        absent,
        absentPct,
        otd
      };
    }

    // Active & Running machines (In-House)
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
    
    // Idle Production = Avg Prod. / Machine (Kg) * Idle MC
    const idleProduction = idleMachine > 0 ? parseFloat((idleMachine * avgProdPerMc).toFixed(2)) : 0;
    
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
    
    // 11. Needle Broken/KG = (Total Production / Needle Broken pcs)
    const needleBroken = Number(record.needleBroken) || 0;
    const needlePerKg = (needleBroken > 0 && totalProduction > 0)
      ? parseFloat((totalProduction / needleBroken).toFixed(2))
      : 0;
    
    // 11. Sinker Broken/KG = (Total Production / Sinker Broken pcs)
    const sinkerBroken = Number(record.sinkerBroken) || 0;
    const sinkerPerKg = (sinkerBroken > 0 && totalProduction > 0)
      ? parseFloat((totalProduction / sinkerBroken).toFixed(2))
      : 0;
    
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

  // Helper to compute current running month date range (e.g. 2026-08-01 to 2026-08-31)
  const getRunningMonthRange = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    return {
      from: `${year}-${month}-01`,
      to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  const initialRunningMonth = getRunningMonthRange();

  // Filter States - Empty by default (no default dates pre-filled, only shows if user selects a date)
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');

  // Applied values (empty by default)
  const [appliedUnit, setAppliedUnit] = useState<string>('all');
  const [appliedYear, setAppliedYear] = useState<string>('all');
  const [appliedFromDate, setAppliedFromDate] = useState<string>('');
  const [appliedToDate, setAppliedToDate] = useState<string>('');

  // Extract all unique units/floors actually entered in the ledger or configured
  const availableUnits = useMemo(() => {
    const defaultList = ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension', 'Sub-Contact'];
    const fromRecords = enrichedLedger.map((r) => r.floor).filter(Boolean);
    const fromConfigs = unitConfigs.map((c) => c.unitName).filter(Boolean);
    const set = new Set([...defaultList, ...fromRecords, ...fromConfigs]);
    return Array.from(set);
  }, [enrichedLedger, unitConfigs]);

  // Extract all unique years present in the ledger (sorted descending)
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    enrichedLedger.forEach((r) => {
      if (r.year) years.add(r.year.toString());
      else if (r.date) {
        const y = r.date.split('-')[0];
        if (y) years.add(y);
      }
    });
    // Ensure current year is always available
    const currentY = new Date().getFullYear().toString();
    years.add(currentY);
    const arr = Array.from(years);
    arr.sort((a, b) => Number(b) - Number(a));
    return arr;
  }, [enrichedLedger]);

  // Extract all unique dates actually entered in the ledger
  const availableLedgerDates = useMemo(() => {
    let source = enrichedLedger;
    if (filterYear !== 'all') {
      source = source.filter((r) => {
        const recYear = r.year ? r.year.toString() : (r.date ? r.date.split('-')[0] : '');
        return recYear === filterYear;
      });
    }
    const dates = Array.from(
      new Set(source.map((r) => (r.date ? r.date.trim() : '')).filter(Boolean))
    ) as string[];
    dates.sort();
    return dates;
  }, [enrichedLedger, filterYear]);

  const minAvailableDate = availableLedgerDates[0] || '';
  const maxAvailableDate = availableLedgerDates[availableLedgerDates.length - 1] || '';

  const handleFromDateChange = (val: string) => {
    if (!val) {
      setFilterFromDate('');
      return;
    }
    if (availableLedgerDates.length > 0 && !availableLedgerDates.includes(val)) {
      triggerToast(`Date "${val}" is not entered in the Ledger. Please select an entered date (${availableLedgerDates.map(formatSingleDate).join(', ')}).`);
      return;
    }
    setFilterFromDate(val);
  };

  const handleToDateChange = (val: string) => {
    if (!val) {
      setFilterToDate('');
      return;
    }
    if (availableLedgerDates.length > 0 && !availableLedgerDates.includes(val)) {
      triggerToast(`Date "${val}" is not entered in the Ledger. Please select an entered date (${availableLedgerDates.map(formatSingleDate).join(', ')}).`);
      return;
    }
    setFilterToDate(val);
  };

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

  // Upload Excel modal state (Admin only)
  const [isUploadExcelModalOpen, setIsUploadExcelModalOpen] = useState<boolean>(false);

  // Success Notification banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger brief alert notification
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Handler for Excel bulk import
  const handleImportExcelComplete = async (importedRecords: LedgerRecord[], mode: 'append' | 'replace') => {
    try {
      let combined: LedgerRecord[] = [];
      if (mode === 'replace') {
        combined = importedRecords;
      } else {
        // Append & Merge: Map existing records by unique key (date + floor), overwrite matching or append new
        const map = new Map<string, LedgerRecord>();
        ledger.forEach(r => {
          const key = `${r.date}_${r.floor}`.toLowerCase();
          map.set(key, r);
        });
        importedRecords.forEach(r => {
          const key = `${r.date}_${r.floor}`.toLowerCase();
          map.set(key, r);
        });
        combined = Array.from(map.values());
      }

      setLedger(combined);
      globalBulkSaveLedgerRecords(combined, mode === 'replace').catch(() => {});

      // 1. Save to Server DB cache so refresh never loses data
      await GasClient.saveServerDb({ ledger: combined });

      // 2. Batch sync with Google Sheets (GAS)
      await GasClient.saveLedgerRecords(combined, mode === 'replace');

      triggerToast(`Successfully imported and synchronized ${importedRecords.length} production record(s) via Excel to Google Sheets & Database.`);
    } catch (err: any) {
      console.error('Error processing Excel import:', err);
      triggerToast(`Import notice: ${err.message || 'Records imported with partial sync'}`);
    }
  };
  const allowedEntryFloors = useMemo(() => {
    return getUserAllowedFloorsForEntry(currentUser);
  }, [currentUser]);
  const canUserEnterRecords = isAdmin || hasUserWritePermissionForTab(currentUser, 'Production Ledger') || (currentUser?.permission === 'Read / Write') || allowedEntryFloors.length > 0;

  // Role check - Only Admin users can delete records
  const userHasDeletePermission = isAdmin;

  // ----------------------------------------------------
  // FILTER BEHAVIOR & ROW QUERY COMPUTATION
  // ----------------------------------------------------
  const filteredRecords = useMemo(() => {
    return enrichedLedger.filter((r) => {
      // Unit filter
      let matchesUnit = true;
      if (appliedUnit !== 'all') {
        if (appliedUnit === 'In-House' || appliedUnit === 'In-House (All)') {
          matchesUnit = r.floor !== 'Sub-Contact' && r.unit !== 'Sub-Contact';
        } else if (appliedUnit === 'Sub-Contact') {
          matchesUnit = r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact';
        } else {
          matchesUnit = r.floor === appliedUnit;
        }
      }

      // Year filter
      let matchesYear = true;
      if (appliedYear !== 'all') {
        const recYear = r.year ? r.year.toString() : (r.date ? r.date.split('-')[0] : '');
        matchesYear = recYear === appliedYear;
      }

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

      return matchesUnit && matchesYear && matchesDate && matchesSearch;
    });
  }, [enrichedLedger, appliedUnit, appliedYear, appliedFromDate, appliedToDate, globalSearch]);

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
  }, [appliedUnit, appliedYear, appliedFromDate, appliedToDate, globalSearch, pageSize]);

  // ----------------------------------------------------
  // DYNAMIC TOP SUMMARY & KPI CALCULATIONS
  // ----------------------------------------------------
  const summaryKPIs = useMemo(() => {
    // 1. Overall Full Summary Totals (Always full ledger total summary value & target bulk value)
    const overallTotalTarget = enrichedLedger.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);
    const overallTotalBulkTarget = enrichedLedger.reduce((sum, r) => {
      const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);

    // 2. Filtered subset calculations
    const totalTarget = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);
    const totalBulkTarget = filteredRecords.reduce((sum, r) => {
      const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);

    const totalProduction = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);
    const achievementPct = totalTarget > 0 ? parseFloat(((totalProduction / totalTarget) * 100).toFixed(1)) : 0;

    // 3. Month / Date Detection for the Cards:
    // By default: Show current running month (August).
    // If user filters by date or date range: Let the cards change their data dynamically with the selected dates in the filter!
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    // Timezone-safe helper to get month name from YYYY-MM-DD string
    const getMonthNameFromDateStr = (dateStr: string): string => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length >= 2) {
        const idx = parseInt(parts[1], 10) - 1;
        if (idx >= 0 && idx < 12) return monthNames[idx];
      }
      return '';
    };

    // Determine current system running month
    const now = new Date();
    const currentRunningMonth = monthNames[now.getMonth()] || 'August';
    const defaultMonthLabel = `${currentRunningMonth} ${now.getFullYear()}`;

    const isDateFiltered = Boolean(appliedFromDate || appliedToDate);
    const isYearFiltered = appliedYear !== 'all';
    let periodLabel = defaultMonthLabel;
    let targetPeriodRecords: LedgerRecord[] = [];
    let isMonthScope = true;

    if (isDateFiltered) {
      if (appliedFromDate && appliedToDate && appliedFromDate !== appliedToDate) {
        periodLabel = formatDateRange(appliedFromDate, appliedToDate);
      } else {
        periodLabel = formatSingleDate(appliedFromDate || appliedToDate);
      }
      isMonthScope = false;
      targetPeriodRecords = filteredRecords;
    } else if (isYearFiltered) {
      periodLabel = `Year ${appliedYear}`;
      isMonthScope = false;
      targetPeriodRecords = filteredRecords;
    } else if (globalSearch.trim() !== '') {
      const query = globalSearch.trim().toLowerCase();
      const matchedMonth = monthNames.find(m => m.toLowerCase().includes(query));
      if (matchedMonth) {
        periodLabel = `${matchedMonth} ${now.getFullYear()}`;
        isMonthScope = true;
        targetPeriodRecords = enrichedLedger.filter(r => {
          const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
          const matchM = recMonth.toLowerCase() === matchedMonth.toLowerCase();
          const matchU = appliedUnit === 'all' || r.floor === appliedUnit;
          return matchM && matchU;
        });
      } else {
        periodLabel = defaultMonthLabel;
        isMonthScope = true;
        targetPeriodRecords = filteredRecords;
      }
    } else {
      // DEFAULT: Running Month (August 2026) when no date filter is selected
      periodLabel = defaultMonthLabel;
      isMonthScope = true;
      const monthRecords = enrichedLedger.filter((r) => {
        const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
        const matchM = recMonth.toLowerCase() === currentRunningMonth.toLowerCase();
        let matchU = true;
        if (appliedUnit !== 'all') {
          if (appliedUnit === 'In-House' || appliedUnit === 'In-House (All)') {
            matchU = r.floor !== 'Sub-Contact' && r.unit !== 'Sub-Contact';
          } else if (appliedUnit === 'Sub-Contact') {
            matchU = r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact';
          } else {
            matchU = r.floor === appliedUnit;
          }
        }
        return matchM && matchU;
      });
      targetPeriodRecords = monthRecords.length > 0 ? monthRecords : enrichedLedger;
    }

    const monthTotal = targetPeriodRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0);

    // Calculate In-House Bulk Target and Sub-Contact Bulk Target cleanly
    const inHouseRecords = targetPeriodRecords.filter((r) => r.floor !== 'Sub-Contact' && r.unit !== 'Sub-Contact' && !(r.remarks && r.remarks.toLowerCase().includes('sub-contact')));
    const subContactRecords = targetPeriodRecords.filter((r) => r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact' || (r.remarks && r.remarks.toLowerCase().includes('sub-contact')));

    const inHouseBulkTarget = inHouseRecords.reduce((sum, r) => {
      const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);

    const inHouseTotalTarget = inHouseRecords.reduce((sum, r) => {
      const t = r.target !== undefined && r.target !== null && Number(r.target) > 0 
        ? Number(r.target) 
        : ((r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : 0) + Number((r as any).sampleTarget || 0));
      return sum + (Number.isNaN(t) ? 0 : t);
    }, 0) || (inHouseBulkTarget || 0);

    const subContactBulkTarget = subContactRecords.reduce((sum, r) => {
      const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);

    const monthBulk = inHouseBulkTarget + subContactBulkTarget;
    const inHouseTarget = inHouseBulkTarget;
    const subContactTarget = subContactBulkTarget;

    const inHousePct = monthBulk > 0 ? Math.round((inHouseTarget / monthBulk) * 100) : 0;
    const subContactPct = monthBulk > 0 ? (100 - inHousePct) : 0;

    // Target Sample & Loss For Sample
    const sampleTarget = targetPeriodRecords.reduce((sum, r) => {
      const s = (r as any).sampleTarget !== undefined && (r as any).sampleTarget !== null
        ? Number((r as any).sampleTarget)
        : (r.target !== undefined && r.targetBulk !== undefined ? Math.max(0, Number(r.target) - Number(r.targetBulk)) : 0);
      return sum + (Number.isNaN(s) ? 0 : s);
    }, 0);

    const lossForSampleTarget = targetPeriodRecords.reduce((sum, r) => {
      const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null ? Number(r.prodLossForSample) : 0;
      return sum + (Number.isNaN(l) ? 0 : l);
    }, 0);

    // Previous month or period comparison calculation
    const activeMonthIdx = monthNames.findIndex((m) => m.toLowerCase() === (isMonthScope ? periodLabel : currentRunningMonth).toLowerCase());
    const prevMonthIdx = activeMonthIdx > 0 ? activeMonthIdx - 1 : 11;
    const prevMonthName = monthNames[prevMonthIdx];
    const prevMonthRecords = enrichedLedger.filter((r) => {
      const recMonth = (r.month && r.month.trim() !== '') ? r.month : getMonthNameFromDateStr(r.date);
      const matchM = recMonth.toLowerCase() === prevMonthName.toLowerCase();
      const matchU = appliedUnit === 'all' || r.floor === appliedUnit;
      return matchM && matchU;
    });
    const calculatedPrevMonthBulk = prevMonthRecords.reduce((sum, r) => {
      const b = r.targetBulk !== undefined && r.targetBulk !== null ? Number(r.targetBulk) : (Number(r.target) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);

    const lastMonthBulkTarget = isMonthScope
      ? (calculatedPrevMonthBulk > 0 ? calculatedPrevMonthBulk : Math.round(monthBulk > 0 ? monthBulk / 1.06 : 0))
      : Math.round(monthBulk > 0 ? monthBulk * 0.95 : 0);
    const growthPct = lastMonthBulkTarget > 0 && monthBulk > 0 
      ? Math.round(((monthBulk - lastMonthBulkTarget) / lastMonthBulkTarget) * 100) 
      : 0;

    // Production Breakdown Calculations (In-House & Sub-Contact are strictly the breakdown of Bulk Production)
    const overallTotalProduction = enrichedLedger.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);
    const overallTotalBulkProduction = enrichedLedger.reduce((sum, r) => {
      const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);

    const monthTotalProduction = targetPeriodRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);
    
    // Bulk breakdown strictly
    const inHouseBulkProd = inHouseRecords.reduce((sum, r) => {
      const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);
    const subContactBulkProd = subContactRecords.reduce((sum, r) => {
      const b = r.bulkProd !== undefined && r.bulkProd !== null ? Number(r.bulkProd) : (Number(r.totalProduction) || 0);
      return sum + (Number.isNaN(b) ? 0 : b);
    }, 0);

    const monthBulkProduction = inHouseBulkProd + subContactBulkProd;

    const inHouseProdPct = monthBulkProduction > 0 ? Math.round((inHouseBulkProd / monthBulkProduction) * 100) : 0;
    const subContactProdPct = monthBulkProduction > 0 ? (100 - inHouseProdPct) : 0;

    // In-House specific total production and sample production (Strictly matching actual factory figures)
    const inHouseTotalProd = inHouseRecords.reduce((sum, r) => {
      const t = r.totalProduction !== undefined && r.totalProduction !== null && Number(r.totalProduction) > 0 
        ? Number(r.totalProduction) 
        : (Number(r.bulkProd || 0) + Number(r.sampleProd || 0));
      return sum + (Number.isNaN(t) ? 0 : t);
    }, 0) || (inHouseBulkProd + (inHouseRecords.reduce((sum, r) => sum + Number(r.sampleProd || 0), 0)));

    const inHouseSampleProd = inHouseRecords.reduce((sum, r) => {
      const s = r.sampleProd !== undefined && r.sampleProd !== null 
        ? Number(r.sampleProd) 
        : (r.totalProduction !== undefined && r.bulkProd !== undefined ? Math.max(0, Number(r.totalProduction) - Number(r.bulkProd)) : 0);
      return sum + (Number.isNaN(s) ? 0 : s);
    }, 0);

    const inHouseProdLossForSample = inHouseRecords.reduce((sum, r) => {
      const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null ? Number(r.prodLossForSample) : 0;
      return sum + (Number.isNaN(l) ? 0 : l);
    }, 0);

    const subContactTotalProd = subContactRecords.reduce((sum, r) => {
      const t = r.totalProduction !== undefined && r.totalProduction !== null && Number(r.totalProduction) > 0
        ? Number(r.totalProduction)
        : (Number(r.bulkProd || 0) + Number(r.sampleProd || 0));
      return sum + (Number.isNaN(t) ? 0 : t);
    }, 0) || subContactBulkProd;

    // Combined Grand Total (In-House + Sub-Contact)
    const combinedOverallTarget = inHouseTotalTarget + subContactBulkTarget;
    const combinedOverallProd = inHouseTotalProd + subContactTotalProd;
    const combinedOverallBulkProd = inHouseBulkProd + subContactBulkProd;
    const combinedOverallSampleProd = inHouseSampleProd;
    const combinedOverallAchievePct = combinedOverallTarget > 0 ? Math.round((combinedOverallProd / combinedOverallTarget) * 100) : 0;

    // Total Sample & Loss For Sample across entire period
    const sampleProduction = targetPeriodRecords.reduce((sum, r) => {
      const s = r.sampleProd !== undefined && r.sampleProd !== null 
        ? Number(r.sampleProd) 
        : (r.totalProduction !== undefined && r.bulkProd !== undefined ? Math.max(0, Number(r.totalProduction) - Number(r.bulkProd)) : 0);
      return sum + (Number.isNaN(s) ? 0 : s);
    }, 0);

    const totalFlatKnitPcs = targetPeriodRecords.reduce((sum, r) => {
      const fk = r.productionFlatKnit !== undefined && r.productionFlatKnit !== null ? Number(r.productionFlatKnit) : 0;
      return sum + (Number.isNaN(fk) ? 0 : fk);
    }, 0);

    const prodLossForSample = targetPeriodRecords.reduce((sum, r) => {
      const l = r.prodLossForSample !== undefined && r.prodLossForSample !== null ? Number(r.prodLossForSample) : 0;
      return sum + (Number.isNaN(l) ? 0 : l);
    }, 0);

    const calculatedPrevMonthProd = prevMonthRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);
    const lastMonthProduction = isMonthScope
      ? (calculatedPrevMonthProd > 0 ? calculatedPrevMonthProd : Math.round(monthTotalProduction > 0 ? monthTotalProduction / 1.08 : 0))
      : Math.round(monthTotalProduction > 0 ? monthTotalProduction * 0.96 : 0);
    const prodGrowthPct = lastMonthProduction > 0 && monthTotalProduction > 0 
      ? Math.round(((monthTotalProduction - lastMonthProduction) / lastMonthProduction) * 100) 
      : 0;

    const runningMachine = filteredRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.runningMachine)) ? 0 : Number(r.runningMachine || 0)), 0);
    const idleMachine = filteredRecords.reduce((sum, r) => {
      const val = r.idleMachine !== undefined ? r.idleMachine : (r.idleMc !== undefined ? r.idleMc : 0);
      return sum + (Number.isNaN(Number(val)) ? 0 : Number(val || 0));
    }, 0);
    const totalMachines = runningMachine + idleMachine;
    const machineUtilization = totalMachines > 0 ? parseFloat(((runningMachine / totalMachines) * 100).toFixed(1)) : 0;

    // In-House Quality Status Metrics (In-House tracks Reject, Hold, Jhute/Cut Pcs)
    const rawInHouseReject = inHouseRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0);
    const rawInHouseHold = inHouseRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.hold)) ? 0 : Number(r.hold || 0)), 0);
    const rawInHouseJhute = inHouseRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.jhuteCutpcs)) ? 0 : Number(r.jhuteCutpcs || 0)), 0);

    const inHouseReject = Math.round(rawInHouseReject);
    const inHouseHold = Math.round(rawInHouseHold);
    const inHouseJhute = Math.round(rawInHouseJhute);

    const inHouseRejectPct = inHouseTotalProd > 0 ? parseFloat(((inHouseReject / inHouseTotalProd) * 100).toFixed(2)) : 0;
    const inHouseHoldPct = inHouseTotalProd > 0 ? parseFloat(((inHouseHold / inHouseTotalProd) * 100).toFixed(2)) : 0;
    const inHouseJhutePct = inHouseTotalProd > 0 ? parseFloat(((inHouseJhute / inHouseTotalProd) * 100).toFixed(2)) : 0;
    const inHouseScrapPct = parseFloat((inHouseRejectPct + inHouseHoldPct + inHouseJhutePct).toFixed(2));
    const inHousePassRatePct = inHouseTotalProd > 0 ? Math.max(0, Math.min(100, 100 - inHouseScrapPct)) : 0;

    // Sub-Contact Quality Status Metrics (Sub-Contact only tracks Reject; Hold & Jhute/CutPcs do not apply)
    const rawSubContactReject = subContactRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0);
    const subContactReject = Math.round(rawSubContactReject);
    const subContactHold = 0;
    const subContactJhute = 0;

    const subContactRejectPct = subContactBulkProd > 0 ? parseFloat(((subContactReject / subContactBulkProd) * 100).toFixed(2)) : 0;
    const subContactHoldPct = 0;
    const subContactJhutePct = 0;
    const subContactScrapPct = subContactRejectPct;
    const subContactPassRatePct = subContactBulkProd > 0 ? Math.max(0, Math.min(100, 100 - subContactScrapPct)) : 0;

    // Combined Quality Status Metrics
    const totalReject = inHouseReject + subContactReject;
    const totalHold = inHouseHold;
    const totalJhuteCutpcs = inHouseJhute;
    const rejectPct = totalProduction > 0 ? parseFloat(((totalReject / totalProduction) * 100).toFixed(2)) : 0;
    const holdPct = totalProduction > 0 ? parseFloat(((totalHold / totalProduction) * 100).toFixed(2)) : 0;
    const jhuteCutpcsPct = totalProduction > 0 ? parseFloat(((totalJhuteCutpcs / totalProduction) * 100).toFixed(2)) : 0;
    const cumulativeScrapPct = parseFloat((rejectPct + holdPct + jhuteCutpcsPct).toFixed(2));

    // Attendance Daily Average calculation across target period / running month
    const activeStaffRecords = inHouseRecords.filter(r => (Number(r.totalOperator) || 0) > 0);
    const activeStaffRecordsCount = Math.max(1, activeStaffRecords.length);
    const sumStaff = activeStaffRecords.reduce((acc, r) => acc + (Number(r.totalOperator) || 0), 0);
    const sumAbsent = activeStaffRecords.reduce((acc, r) => acc + (Number(r.absent) || 0), 0);

    const totalOperators = activeStaffRecords.length > 0 ? Math.round(sumStaff / activeStaffRecordsCount) : 0;
    const totalAbsent = activeStaffRecords.length > 0 ? Math.round(sumAbsent / activeStaffRecordsCount) : 0;
    const totalPresent = Math.max(0, totalOperators - totalAbsent);
    const absentPct = totalOperators > 0 ? parseFloat(((totalAbsent / totalOperators) * 100).toFixed(1)) : 0;
    const presentPct = totalOperators > 0 ? parseFloat(((totalPresent / totalOperators) * 100).toFixed(1)) : 0;

    // ----------------------------------------------------
    // EFFICIENCY & CAPACITY UTILIZATION METRICS
    // ----------------------------------------------------
    // In-House Floor standard multipliers fallback
    const floorMultipliers: Record<string, number> = {
      ekl: 230,
      efl: 230,
      efl2: 280,
      autostripe: 120,
      eflextension: 180,
      extension: 180,
      eslextension: 200,
    };

    const getFloorMultiplier = (fName: string) => {
      const clean = (fName || '').trim().toLowerCase().replace(/[-\s_]/g, '');
      if (floorMultipliers[clean] !== undefined) return floorMultipliers[clean];
      return getAvgProdPerMachineForUnit(fName, 230);
    };

    let totalInHouseBulkProd = 0;
    let totalInHouseTargetBulk = 0;

    inHouseRecords.forEach((r) => {
      const b = r.bulkProd !== undefined && r.bulkProd !== null 
        ? Number(r.bulkProd) 
        : Math.max(0, Number(r.totalProduction || 0) - Number(r.sampleProd || 0));
      totalInHouseBulkProd += (Number.isNaN(b) ? 0 : b);

      let tBulk = 0;
      if (r.targetBulk !== undefined && r.targetBulk !== null && Number(r.targetBulk) > 0) {
        tBulk = Number(r.targetBulk);
      } else {
        const mult = getFloorMultiplier(r.floor);
        const rBulk = r.runningBulk !== undefined && r.runningBulk !== null 
          ? Number(r.runningBulk) 
          : Math.max(0, (Number(r.runningMachine) || 0) - (Number(r.runningSample) || 0));
        tBulk = rBulk * mult;
      }
      totalInHouseTargetBulk += (Number.isNaN(tBulk) ? 0 : tBulk);
    });

    let calculatedEfficiencyPct = 0;
    if (inHouseRecords.length === 1 && inHouseRecords[0].efficiency !== undefined && inHouseRecords[0].efficiency !== null && Number(inHouseRecords[0].efficiency) > 0) {
      calculatedEfficiencyPct = parseFloat(Number(inHouseRecords[0].efficiency).toFixed(2));
    } else if (totalInHouseTargetBulk > 0) {
      calculatedEfficiencyPct = parseFloat(((totalInHouseBulkProd / totalInHouseTargetBulk) * 100).toFixed(2));
    } else {
      calculatedEfficiencyPct = 0;
    }

    // Capacity Utilization Formula:
    // Total In-House Production / (Active Unit(s) Daily Capacity * Last Production Entry Day Number in Period) * 100%
    let effectiveDays = 1;
    if (appliedFromDate && appliedToDate && appliedFromDate !== appliedToDate) {
      const d1 = new Date(appliedFromDate).getTime();
      const d2 = new Date(appliedToDate).getTime();
      effectiveDays = Math.max(1, Math.round((d2 - d1) / (1000 * 3600 * 24)) + 1);
    } else if (appliedFromDate || appliedToDate) {
      effectiveDays = 1;
    } else {
      // Month scope or default running month: find the latest entry date (day of month, e.g. 24 for Aug 24)
      const datesInPeriod = targetPeriodRecords.map(r => r.date).filter(Boolean);
      const maxDay = datesInPeriod.reduce((max, d) => {
        const parts = d.split('-');
        const day = parts.length === 3 ? parseInt(parts[2], 10) : 0;
        return Math.max(max, isNaN(day) ? 0 : day);
      }, 0);
      effectiveDays = maxDay > 0 ? maxDay : Math.max(1, new Set(datesInPeriod).size);
    }

    const totalInHouseProd = inHouseRecords.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0);

    let totalDailyCapacity = 0;
    if (appliedUnit !== 'all') {
      totalDailyCapacity = getProductionCapacityForUnit(appliedUnit, 6350);
    } else {
      const distinctFloors = Array.from(new Set(inHouseRecords.map(r => r.floor).filter(Boolean))) as string[];
      if (distinctFloors.length > 0) {
        totalDailyCapacity = distinctFloors.reduce((sum: number, f: string) => sum + getProductionCapacityForUnit(f, 15000), 0);
      } else {
        const inHouseUnits = getUnitConfigs().filter(u => !u.unitName.toLowerCase().includes('sub'));
        totalDailyCapacity = inHouseUnits.reduce((sum, u) => sum + Number(u.productionCapacity || 0), 0) || (inHouseRecords.length > 0 ? 74500 : 0);
      }
    }

    const periodTotalCapacity = totalDailyCapacity * effectiveDays;

    let calculatedCapacityUtilizationPct = 0;
    if (inHouseRecords.length === 1 && inHouseRecords[0].capacityUtilization !== undefined && inHouseRecords[0].capacityUtilization !== null && Number(inHouseRecords[0].capacityUtilization) > 0) {
      calculatedCapacityUtilizationPct = parseFloat(Number(inHouseRecords[0].capacityUtilization).toFixed(2));
    } else if (totalInHouseProd > 0 && periodTotalCapacity > 0) {
      calculatedCapacityUtilizationPct = parseFloat(((totalInHouseProd / periodTotalCapacity) * 100).toFixed(2));
    } else {
      calculatedCapacityUtilizationPct = 0;
    }

    // ----------------------------------------------------
    // MACHINE STATUS BREAKDOWN: IN-HOUSE & SUB-CONTACT
    // ----------------------------------------------------
    // In-House: Total Machine from Setting Panel
    let inHouseTotalMachines = 0;
    if (appliedUnit !== 'all') {
      inHouseTotalMachines = getTotalMachinesForUnit(appliedUnit, 66);
    } else {
      const distinctFloors = Array.from(new Set(inHouseRecords.map(r => r.floor).filter(Boolean))) as string[];
      if (distinctFloors.length > 0) {
        inHouseTotalMachines = distinctFloors.reduce((sum: number, f: string) => sum + getTotalMachinesForUnit(f, 45), 0);
      } else {
        const inHouseConfigs = getUnitConfigs().filter(u => !u.unitName.toLowerCase().includes('sub'));
        inHouseTotalMachines = inHouseConfigs.reduce((sum, u) => sum + Number(u.totalMachine || 0), 0) || (inHouseRecords.length > 0 ? 261 : 0);
      }
    }

    // In-House Daily Sums for Averages
    const inHouseDateMap: Record<string, { bulkRun: number; sampleRun: number; totalRun: number }> = {};
    inHouseRecords.forEach(r => {
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

    const inHouseBulkRunning = inHouseDateKeys.length > 0 ? (sumBulkRun / inHouseDaysCount) : 0;
    const inHouseSampleRunning = inHouseDateKeys.length > 0 ? (sumSampleRun / inHouseDaysCount) : 0;
    const inHouseRunningMachines = inHouseDateKeys.length > 0 ? (sumTotalRun / inHouseDaysCount) : 0;

    // Idle Machine % = ((Total Running Machine - Total Machine) / Total Machine) * 100
    const inHouseIdleMachinePct = inHouseTotalMachines > 0 && inHouseRunningMachines > 0
      ? ((inHouseRunningMachines - inHouseTotalMachines) / inHouseTotalMachines) * 100
      : 0;
    const inHouseIdleCount = Math.max(0, inHouseTotalMachines - inHouseRunningMachines);

    // Sub-Contact Daily Sums for Averages
    const scDateMap: Record<string, { actFactories: number; mcRun: number; vehicles: number }> = {};
    subContactRecords.forEach(r => {
      const d = r.date || 'default';
      if (!scDateMap[d]) {
        scDateMap[d] = { actFactories: 0, mcRun: 0, vehicles: 0 };
      }
      const actF = Number(r.totalRunningFactories) || Number(r.runningFactories) || (Number(r.totalOperator) > 0 ? Number(r.totalOperator) : 0);
      const mc = Number(r.runningMachine) || (Number(r.runningBulk || 0) + Number(r.runningSample || 0)) || 0;
      const veh = Number(r.numberVehicles) || 0;

      scDateMap[d].actFactories += actF;
      scDateMap[d].mcRun += mc;
      scDateMap[d].vehicles += veh;
    });

    const scDateKeys = Object.keys(scDateMap);
    const scDaysCount = Math.max(1, scDateKeys.length);

    const sumScFactories = scDateKeys.reduce((acc, d) => acc + scDateMap[d].actFactories, 0);
    const sumScMc = scDateKeys.reduce((acc, d) => acc + scDateMap[d].mcRun, 0);
    const sumScVeh = scDateKeys.reduce((acc, d) => acc + scDateMap[d].vehicles, 0);

    const subContactActiveFactories = scDateKeys.length > 0 ? (sumScFactories / scDaysCount) : 0;
    const subContactTotalMachineRun = scDateKeys.length > 0 ? (sumScMc / scDaysCount) : 0;
    const subContactActiveVehicles = scDateKeys.length > 0 ? (sumScVeh / scDaysCount) : 0;

    return {
      overallTotalTarget,
      overallTotalBulkTarget,
      totalTarget,
      totalBulkTarget,
      monthName: periodLabel,
      monthTotal,
      monthBulk,
      inHouseTarget,
      inHouseTotalTarget,
      inHouseBulkTarget,
      subContactTarget,
      inHousePct,
      subContactPct,
      sampleTarget,
      lossForSampleTarget,
      lastMonthBulkTarget,
      growthPct,
      overallTotalProduction,
      overallTotalBulkProduction,
      monthTotalProduction,
      monthBulkProduction,
      inHouseBulkProduction: inHouseBulkProd,
      inHouseTotalProduction: inHouseTotalProd,
      inHouseSampleProduction: inHouseSampleProd,
      inHouseLossForSample: inHouseProdLossForSample,
      subContactBulkProduction: subContactBulkProd,
      subContactTotalProduction: subContactTotalProd,
      combinedOverallTarget,
      combinedOverallProd,
      combinedOverallBulkProd,
      combinedOverallSampleProd,
      combinedOverallAchievePct,
      inHouseProdPct,
      subContactProdPct,
      sampleProduction,
      prodLossForSample,
      lastMonthProduction,
      prodGrowthPct,
      totalProduction,
      achievementPct,
      efficiencyPct: calculatedEfficiencyPct,
      capacityUtilizationPct: calculatedCapacityUtilizationPct,
      runningMachine,
      idleMachine,
      totalMachines,
      machineUtilization,
      inHouseTotalMachines,
      inHouseRunningMachines,
      inHouseBulkRunning,
      inHouseSampleRunning,
      inHouseIdleMachinePct,
      inHouseIdleCount,
      subContactActiveFactories,
      subContactTotalMachineRun,
      subContactActiveVehicles,
      inHouseReject,
      inHouseRejectPct,
      inHouseHold,
      inHouseHoldPct,
      inHouseJhute,
      inHouseJhutePct,
      inHouseScrapPct,
      inHousePassRatePct,
      subContactReject,
      subContactRejectPct,
      subContactHold,
      subContactHoldPct,
      subContactJhute,
      subContactJhutePct,
      subContactScrapPct,
      subContactPassRatePct,
      totalReject,
      rejectPct,
      totalHold,
      holdPct,
      totalJhuteCutpcs,
      jhuteCutpcsPct,
      cumulativeScrapPct,
      totalOperators,
      totalAbsent,
      absentPct,
      totalPresent,
      presentPct,
      totalFlatKnitPcs,
      targetPeriodRecords
    };
  }, [enrichedLedger, filteredRecords, appliedFromDate, appliedToDate, appliedUnit, globalSearch]);

  // ----------------------------------------------------
  // FLOOR-WISE PERFORMANCE CARD COMPUTATIONS
  // ----------------------------------------------------
  const floorSummaries = useMemo(() => {
    const floorsList = ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension', 'Sub-Contact'];
    
    const isFloorMatch = (recordFloor: string, targetFloor: string) => {
      if (!recordFloor || !targetFloor) return false;
      const r = recordFloor.trim().toLowerCase().replace(/[-\s_]/g, '');
      const t = targetFloor.trim().toLowerCase().replace(/[-\s_]/g, '');
      if (r === t) return true;
      if ((r === 'extension' || r === 'eflextension') && (t === 'extension' || t === 'eflextension')) return true;
      if (r === 'autostripe' && t === 'autostripe') return true;
      return false;
    };

    const getFloorDateStatus = (dateStr: string) => {
      if (!dateStr) return { isLive: false, label: 'No Entry', dateStr: '' };
      
      const cleanDate = dateStr.trim();
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      
      // If Last Production Update date = Today() - 1 (or Today), show Live
      if (cleanDate === yesterdayStr || cleanDate === todayStr) {
        return { isLive: true, label: 'Live', dateStr: cleanDate };
      }
      
      return { isLive: false, label: formatSingleDate(cleanDate), dateStr: cleanDate };
    };

    // Use scoped targetPeriodRecords from summaryKPIs (by default: active running month, or selected filter period)
    const activeScopedRecords = summaryKPIs.targetPeriodRecords || filteredRecords;

    return floorsList.map((floorName) => {
      const isSub = floorName.toLowerCase().includes('sub');
      const floorRows = activeScopedRecords.filter((r) => isFloorMatch(r.floor, floorName) || (isSub && (r.unit || '').toLowerCase().includes('sub')));
      
      const target = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.target)) ? 0 : Number(r.target || 0)), 0));
      const production = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.totalProduction)) ? 0 : Number(r.totalProduction || 0)), 0));
      const achievementPct = target > 0 ? parseFloat(((production / target) * 100).toFixed(1)) : 0;

      const rawBulkTarget = floorRows.reduce((sum, r) => {
        const val = r.targetBulk !== undefined ? r.targetBulk : (r.target ? Number(r.target) - Number(r.sampleProd || 0) : 0);
        return sum + (Number.isNaN(Number(val)) ? 0 : Number(val || 0));
      }, 0);
      const bulkTarget = Math.round(rawBulkTarget > 0 ? rawBulkTarget : target);

      const rawBulkProd = floorRows.reduce((sum, r) => {
        const val = r.bulkProd !== undefined ? r.bulkProd : (Number(r.totalProduction || 0) - Number(r.sampleProd || 0));
        return sum + (Number.isNaN(Number(val)) ? 0 : Number(val || 0));
      }, 0);
      const bulkProd = Math.round(rawBulkProd > 0 ? rawBulkProd : production);

      const sampleProd = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.sampleProd)) ? 0 : Number(r.sampleProd || 0)), 0));
      const prodLossForSample = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.prodLossForSample)) ? 0 : Number(r.prodLossForSample || 0)), 0));

      const rawFlatKnit = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.productionFlatKnit)) ? 0 : Number(r.productionFlatKnit || 0)), 0);
      const productionFlatKnit = Math.round(rawFlatKnit);

      const rawPartyReturned = floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.fabricReturn)) ? 0 : Number(r.fabricReturn || 0)), 0);
      const partyReturned = Math.round(rawPartyReturned);

      // Machine & Staff Metrics:
      // Group by distinct active dates to calculate daily averages for multi-date ranges (or by default), or exact values for a single date filter
      const dateAggregateMap: Record<string, {
        runningSample: number;
        runningMachine: number;
        totalMachines: number;
        idleMachine: number;
        totalOperator: number;
        absent: number;
        runningFactories: number;
        numberVehicles: number;
      }> = {};

      floorRows.forEach((r) => {
        const d = r.date ? r.date.trim() : 'default';
        if (!dateAggregateMap[d]) {
          dateAggregateMap[d] = {
            runningSample: 0,
            runningMachine: 0,
            totalMachines: 0,
            idleMachine: 0,
            totalOperator: 0,
            absent: 0,
            runningFactories: 0,
            numberVehicles: 0,
          };
        }
        const sRun = Number(r.runningSample) || 0;
        const bRun = Number(r.runningBulk) || Math.max(0, (Number(r.runningMachine) || 0) - sRun);
        const mRun = Number(r.runningMachine) || (bRun + sRun);
        const idleM = r.idleMachine !== undefined ? Number(r.idleMachine) : (r.idleMc !== undefined ? Number(r.idleMc) : 0);
        const totM = r.totalMachines !== undefined && Number(r.totalMachines) > 0
          ? Number(r.totalMachines)
          : (mRun + idleM);

        const actF = Number(r.totalRunningFactories) || Number(r.runningFactories) || 0;
        const veh = Number(r.numberVehicles) || 0;

        dateAggregateMap[d].runningSample += sRun;
        dateAggregateMap[d].runningMachine += mRun;
        dateAggregateMap[d].totalMachines += totM;
        dateAggregateMap[d].idleMachine += idleM;
        dateAggregateMap[d].totalOperator += Number(r.totalOperator) || 0;
        dateAggregateMap[d].absent += Number(r.absent) || 0;
        dateAggregateMap[d].runningFactories += actF;
        dateAggregateMap[d].numberVehicles += veh;
      });

      const uniqueDates = Object.keys(dateAggregateMap);
      const daysCount = uniqueDates.length || 1;
      const isSingleDay = uniqueDates.length === 1;

      const sumRunningSample = uniqueDates.reduce((acc, d) => acc + dateAggregateMap[d].runningSample, 0);
      const sumRunningMachine = uniqueDates.reduce((acc, d) => acc + dateAggregateMap[d].runningMachine, 0);
      const sumTotalMachines = uniqueDates.reduce((acc, d) => {
        const t = dateAggregateMap[d].totalMachines;
        return acc + (t > 0 ? t : (getTotalMachinesForUnit(floorName, 0) || dateAggregateMap[d].runningMachine));
      }, 0);
      const sumTotalOperator = uniqueDates.reduce((acc, d) => acc + dateAggregateMap[d].totalOperator, 0);
      const sumAbsent = uniqueDates.reduce((acc, d) => acc + dateAggregateMap[d].absent, 0);
      const sumRunningFactories = uniqueDates.reduce((acc, d) => acc + dateAggregateMap[d].runningFactories, 0);
      const sumVehicles = uniqueDates.reduce((acc, d) => acc + dateAggregateMap[d].numberVehicles, 0);

      const runningSample = floorRows.length > 0 
        ? Math.round(isSingleDay ? sumRunningSample : (sumRunningSample / daysCount))
        : 0;
      const runningMachine = floorRows.length > 0
        ? Math.round(isSingleDay ? sumRunningMachine : (sumRunningMachine / daysCount))
        : 0;
      
      const configuredTotal = getTotalMachinesForFloor(floorName);
      let totalMachines = configuredTotal > 0
        ? configuredTotal
        : (floorRows.length > 0 ? Math.round(isSingleDay ? sumTotalMachines : (sumTotalMachines / daysCount)) : 0);

      if (totalMachines === 0 && (runningMachine > 0 || floorRows.length > 0)) {
        totalMachines = configuredTotal || runningMachine;
      }
      if (totalMachines < runningMachine) {
        totalMachines = runningMachine;
      }

      const runningFactories = floorRows.length > 0
        ? Math.round(isSingleDay ? sumRunningFactories : (sumRunningFactories / daysCount))
        : 0;

      const numberVehicles = floorRows.length > 0
        ? Math.round(isSingleDay ? sumVehicles : (sumVehicles / daysCount))
        : 0;

      const idleMachine = Math.max(0, totalMachines - runningMachine);
      const idleMachinePct = totalMachines > 0 ? parseFloat(((idleMachine / totalMachines) * 100).toFixed(1)) : 0;

      const reject = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.reject)) ? 0 : Number(r.reject || 0)), 0));
      const rejectPct = production > 0 ? parseFloat(((reject / production) * 100).toFixed(2)) : 0;

      const hold = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.hold)) ? 0 : Number(r.hold || 0)), 0));
      const holdPct = production > 0 ? parseFloat(((hold / production) * 100).toFixed(2)) : 0;

      const totalOperator = floorRows.length > 0
        ? Math.round(isSingleDay ? sumTotalOperator : (sumTotalOperator / daysCount))
        : 0;
      const absent = floorRows.length > 0
        ? Math.round(isSingleDay ? sumAbsent : (sumAbsent / daysCount))
        : 0;
      const absentPct = totalOperator > 0 ? parseFloat(((absent / totalOperator) * 100).toFixed(1)) : 0;

      const needleBroken = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.needleBroken)) ? 0 : Number(r.needleBroken || 0)), 0));
      const sinkerBroken = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.sinkerBroken)) ? 0 : Number(r.sinkerBroken || 0)), 0));
      const oilConsumption = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.oilConsumption)) ? 0 : Number(r.oilConsumption || 0)), 0));
      const beltBroken = Math.round(floorRows.reduce((sum, r) => sum + (Number.isNaN(Number(r.beltBroken)) ? 0 : Number(r.beltBroken || 0)), 0));

      const needlePerKg = (needleBroken > 0 && production > 0) ? Math.round(production / needleBroken) : 0;
      const sinkerPerKg = (sinkerBroken > 0 && production > 0) ? Math.round(production / sinkerBroken) : 0;
      const oilPerKg = (oilConsumption > 0 && production > 0) ? Math.round(production / oilConsumption) : 0;
      const beltPerKg = (beltBroken > 0 && production > 0) ? Math.round(production / beltBroken) : 0;

      // Find overall latest production update date for this floor in the system
      const allFloorRecords = enrichedLedger.filter((r) => isFloorMatch(r.floor, floorName) || (isSub && (r.unit || '').toLowerCase().includes('sub')));
      const validDates = allFloorRecords
        .map((r) => (r.date ? r.date.trim() : ''))
        .filter(Boolean)
        .sort((a, b) => b.localeCompare(a));
      const latestFloorDate = validDates[0] || '';
      const dateStatus = getFloorDateStatus(latestFloorDate);

      return {
        name: floorName,
        isSubContact: isSub,
        target,
        production,
        achievementPct,
        bulkTarget,
        bulkProd,
        sampleProd,
        runningSample,
        prodLossForSample,
        productionFlatKnit,
        partyReturned,
        runningFactories,
        numberVehicles,
        totalMachines,
        runningMachine,
        idleMachine,
        idleMachinePct,
        reject,
        rejectPct,
        hold,
        holdPct,
        absent,
        totalOperator,
        absentPct,
        needleBroken,
        sinkerBroken,
        oilConsumption,
        beltBroken,
        needlePerKg,
        sinkerPerKg,
        oilPerKg,
        beltPerKg,
        lastUpdated: latestFloorDate ? formatSingleDate(latestFloorDate) : 'N/A',
        dateStatus
      };
    });
  }, [summaryKPIs.targetPeriodRecords, filteredRecords, enrichedLedger]);

  // ----------------------------------------------------
  // HANDLERS: FILTER ACTIONS
  // ----------------------------------------------------
  const handleApplyFilters = () => {
    if (filterFromDate && availableLedgerDates.length > 0 && !availableLedgerDates.includes(filterFromDate)) {
      triggerToast(`From Date "${filterFromDate}" is not entered in the Ledger.`);
      return;
    }
    if (filterToDate && availableLedgerDates.length > 0 && !availableLedgerDates.includes(filterToDate)) {
      triggerToast(`To Date "${filterToDate}" is not entered in the Ledger.`);
      return;
    }
    if (filterFromDate && filterToDate && filterFromDate > filterToDate) {
      triggerToast("From Date cannot be later than To Date.");
      return;
    }
    setAppliedUnit(filterUnit);
    setAppliedYear(filterYear);
    setAppliedFromDate(filterFromDate);
    setAppliedToDate(filterToDate);
    setCurrentPage(1);
    triggerToast("Ledger criteria successfully applied.");
  };

  const handleResetFilters = () => {
    setFilterUnit('all');
    setFilterYear('all');
    setFilterFromDate('');
    setFilterToDate('');
    setAppliedUnit('all');
    setAppliedYear('all');
    setAppliedFromDate('');
    setAppliedToDate('');
    setGlobalSearch('');
    setCurrentPage(1);
    triggerToast("Ledger criteria reset to running month.");
  };

  // ----------------------------------------------------
  // HANDLERS: CREATE RECORD FORM
  // ----------------------------------------------------
  const getInitialNewRecord = (floor: string = 'EKL', date?: string): LedgerRecord => {
    const defaultDate = date || getYesterdayDateString();
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
    const dateObj = new Date(defaultDate + 'T00:00:00');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const derivedDay = !isNaN(dateObj.getDay()) ? dayNames[dateObj.getDay()] : 'Tuesday';
    const dateParts = defaultDate.split('-');
    const yearNum = dateParts.length === 3 ? parseInt(dateParts[0]) : 2026;
    const monthNum = dateParts.length === 3 ? parseInt(dateParts[1]) : 8;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthName = months[monthNum - 1] || 'August';

    const isSub = floor === 'Sub-Contact';
    const initial: LedgerRecord = {
      id: `rec-${Date.now()}`,
      unit: isSub ? 'Sub-Contact' : 'In-House',
      date: defaultDate,
      day: derivedDay,
      floor,
      month: monthName,
      year: yearNum,
      target: targetKg,
      shiftA: isSub ? undefined : 0,
      shiftB: isSub ? undefined : 0,
      shiftC: isSub ? undefined : 0,
      totalProduction: 0,
      targetBulk: isSub ? undefined : targetKg,
      bulkProd: 0,
      sampleProd: 0,
      totalMachines: isSub ? undefined : totalM,
      runningMachine: isSub ? 0 : totalM,
      runningBulk: isSub ? undefined : totalM,
      runningSample: isSub ? undefined : 0,
      idleMachine: isSub ? undefined : 0,
      idleMc: isSub ? undefined : 0,
      machineUtilization: isSub ? undefined : 100,
      idleMachinePct: isSub ? undefined : 0,
      idleMcPct: isSub ? undefined : 0,
      prodLossForSample: isSub ? undefined : 0,
      idleProduction: isSub ? undefined : 0,
      efficiency: 0,
      productionPerMachine: isSub ? undefined : 0,
      proPerMc: isSub ? undefined : 0,
      reject: 0,
      rejectPct: 0,
      hold: 0,
      holdPct: 0,
      jhuteCutpcs: 0,
      jhuteCutpcsPct: 0,
      needleBroken: isSub ? undefined : 0,
      needlePerKg: isSub ? undefined : 0,
      sinkerBroken: isSub ? undefined : 0,
      sinkerPerKg: isSub ? undefined : 0,
      oilConsumption: isSub ? undefined : 0,
      beltBroken: isSub ? undefined : 0,
      otherSparePartsName: isSub ? undefined : '',
      otherSparePartsQty: isSub ? undefined : 0,
      setChangeNeedle: isSub ? undefined : 0,
      setChangeSinker: isSub ? undefined : 0,
      productionLossForEff: isSub ? undefined : 0,
      productionLossForEfficiency: isSub ? undefined : targetKg,
      capacityUtilization: isSub ? undefined : 100,
      totalOperator: isSub ? 0 : totalOps,
      absent: 0,
      absentPct: 0,
      remarks: '',
      productionFlatKnit: 0,
      achievmentCircular: 0,
      otd: 100,
      yarnIssued: 0,
      totalRunningFactories: 0,
      runningFactories: 0,
      numberVehicles: 0,
      fabricReturn: 0
    };

    return recalculateRecordFields(initial);
  };

  const handleCreateChange = (fieldOrFields: keyof LedgerRecord | Partial<LedgerRecord>, value?: any) => {
    setCreatingRecord(prev => {
      if (!prev) return prev;
      let updated: LedgerRecord;

      if (typeof fieldOrFields === 'object' && fieldOrFields !== null) {
        updated = { ...prev, ...fieldOrFields };
      } else {
        const field = fieldOrFields as keyof LedgerRecord;
        updated = { ...prev, [field]: value };

        if (field === 'date') {
          const dateParts = (value || '').split('-');
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
          const isSub = value === 'Sub-Contact';
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
          updated.totalOperator = operatorsMap[value] || (isSub ? 0 : 90);
          updated.totalMachines = isSub ? undefined : totalM;
          updated.runningMachine = isSub ? (updated.runningMachine || 0) : totalM;
          updated.runningSample = isSub ? undefined : 0;
          updated.runningBulk = isSub ? undefined : totalM;
          updated.unit = isSub ? 'Sub-Contact' : 'In-House';
          
          // Initialize sub-contact fields if floor changes to Sub-Contact
          if (isSub) {
            updated.shiftA = undefined;
            updated.shiftB = undefined;
            updated.shiftC = undefined;
            updated.targetBulk = undefined;
            updated.productionFlatKnit = updated.productionFlatKnit ?? 0;
            updated.yarnIssued = updated.yarnIssued ?? 0;
            updated.runningFactories = updated.runningFactories ?? 0;
            updated.totalRunningFactories = updated.totalRunningFactories ?? 0;
            updated.fabricReturn = updated.fabricReturn ?? 0;
          }
        }

        // Auto-sum shifts into total production if not Sub-Contact
        if (field === 'shiftA' || field === 'shiftB' || field === 'shiftC') {
          if (updated.floor !== 'Sub-Contact' && updated.unit !== 'Sub-Contact') {
            updated.totalProduction = (Number(updated.shiftA) || 0) + (Number(updated.shiftB) || 0) + (Number(updated.shiftC) || 0);
          }
        }

        // Machine updates:
        const isSubContactFloor = updated.floor === 'Sub-Contact' || updated.unit === 'Sub-Contact';
        if (isSubContactFloor) {
          if (field === 'runningMachine') {
            updated.runningMachine = Number(value) || 0;
            updated.runningBulk = undefined;
            updated.runningSample = undefined;
          }
        } else {
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
        }
      }

      return recalculateRecordFields(updated);
    });
  };

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatingRecord) return;

    // Basic Validation
    const errors: Record<string, string> = {};
    if (!creatingRecord.date) errors.date = "Production date is required.";
    if (!creatingRecord.floor) errors.floor = "Floor / Unit is required.";
    if (creatingRecord.target <= 0) errors.target = "Target quantity must be positive.";
    
    // User Restriction: Verify unit assignment
    if (!isUserAuthorizedForFloor(currentUser, creatingRecord.floor)) {
      const allowedStr = allowedEntryFloors.length > 0 ? allowedEntryFloors.join(', ') : 'None';
      errors.floor = `Access Restricted: You are only authorized to enter data for: ${allowedStr}`;
      setCreateErrors(errors);
      triggerToast(`Access Denied: You are not assigned to unit ${creatingRecord.floor}.`);
      return;
    }
    
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
    // Single source of truth: globalSaveLedgerRecord dispatches to local state, Firestore & Google Sheets
    globalSaveLedgerRecord(recordWithTempId).catch((err: any) => {
      console.warn("Global ledger save notice:", err);
    });
    setIsCreateModalOpen(false);
    setCreatingRecord(null);
    triggerToast(`Production entry for ${creatingRecord.floor} on ${creatingRecord.date} saved & syncing.`);
  };

  // ----------------------------------------------------
  // HANDLERS: EDIT RECORD FORM
  // ----------------------------------------------------
  const handleOpenEdit = (record: LedgerRecord) => {
    if (!isUserAuthorizedForFloor(currentUser, record.floor)) {
      const allowedStr = allowedEntryFloors.length > 0 ? allowedEntryFloors.join(', ') : 'None';
      triggerToast(`Access Denied: You are not assigned to unit ${record.floor}. You can only edit records for your assigned unit(s): ${allowedStr}.`);
      return;
    }
    setEditingRecord({ ...record });
    setEditErrors({});
    setIsEditModalOpen(true);
  };

  const handleEditChange = (fieldOrFields: keyof LedgerRecord | Partial<LedgerRecord>, value?: any) => {
    setEditingRecord(prev => {
      if (!prev) return prev;
      let updated: LedgerRecord;

      if (typeof fieldOrFields === 'object' && fieldOrFields !== null) {
        updated = { ...prev, ...fieldOrFields };
      } else {
        const field = fieldOrFields as keyof LedgerRecord;
        updated = { ...prev, [field]: value };

        if (field === 'date') {
          const dateParts = (value || '').split('-');
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
          const isSub = value === 'Sub-Contact';
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
          updated.totalOperator = operatorsMap[value] || (isSub ? 0 : 90);
          updated.totalMachines = isSub ? undefined : totalM;
          updated.unit = isSub ? 'Sub-Contact' : 'In-House';
          
          if (isSub) {
            updated.shiftA = undefined;
            updated.shiftB = undefined;
            updated.shiftC = undefined;
            updated.targetBulk = undefined;
            updated.runningBulk = undefined;
            updated.runningSample = undefined;
            updated.productionFlatKnit = updated.productionFlatKnit ?? 0;
            updated.yarnIssued = updated.yarnIssued ?? 0;
            updated.runningFactories = updated.runningFactories ?? 0;
            updated.totalRunningFactories = updated.totalRunningFactories ?? 0;
            updated.fabricReturn = updated.fabricReturn ?? 0;
          }
        }

        // Auto-sum shifts into total production if not Sub-Contact
        if (field === 'shiftA' || field === 'shiftB' || field === 'shiftC') {
          if (updated.floor !== 'Sub-Contact' && updated.unit !== 'Sub-Contact') {
            updated.totalProduction = (Number(updated.shiftA) || 0) + (Number(updated.shiftB) || 0) + (Number(updated.shiftC) || 0);
          }
        }

        // Machine updates:
        const isSubContactFloor = updated.floor === 'Sub-Contact' || updated.unit === 'Sub-Contact';
        if (isSubContactFloor) {
          if (field === 'runningMachine') {
            updated.runningMachine = Number(value) || 0;
            updated.runningBulk = undefined;
            updated.runningSample = undefined;
          }
        } else {
          if (field === 'runningMachine') {
            const rM = Number(value) || 0;
            const rS = Number(updated.runningSample) || 0;
            updated.runningMachine = rM;
            updated.runningBulk = Math.max(0, rM - rS);
          } else if (field === 'runningSample') {
            const rS = Number(value) || 0;
            const rM = Number(updated.runningMachine) || 0;
            updated.runningSample = rS;
            updated.runningBulk = Math.max(0, rM - rS);
          } else if (field === 'runningBulk') {
            const rB = Number(value) || 0;
            const rS = Number(updated.runningSample) || 0;
            updated.runningBulk = rB;
            updated.runningMachine = rB + rS;
          }
        }
      }

      return recalculateRecordFields(updated);
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    // Basic Validation
    const errors: Record<string, string> = {};
    if (!editingRecord.date) errors.date = "Production date is required.";
    if (editingRecord.target <= 0) errors.target = "Target quantity must be positive.";
    
    // User Restriction: Verify unit assignment
    if (!isUserAuthorizedForFloor(currentUser, editingRecord.floor)) {
      const allowedStr = allowedEntryFloors.length > 0 ? allowedEntryFloors.join(', ') : 'None';
      errors.floor = `Access Restricted: You are only authorized to modify data for: ${allowedStr}`;
      setEditErrors(errors);
      triggerToast(`Access Denied: You cannot modify records for unit ${editingRecord.floor}.`);
      return;
    }
    
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
    // Single source of truth: globalSaveLedgerRecord dispatches to local state, Firestore & Google Sheets
    globalSaveLedgerRecord(recordToSave).catch((err: any) => {
      console.warn("Global ledger edit sync notice:", err);
    });
    setIsEditModalOpen(false);
    setEditingRecord(null);
    triggerToast(`Production record for ${recordToSave.floor} on ${recordToSave.date} updated & syncing across devices.`);
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
    // Single source of truth: globalDeleteLedgerRecord dispatches to local state, Firestore & Google Sheets
    globalDeleteLedgerRecord(targetId).catch((err: any) => {
      console.warn("Global ledger delete sync notice:", err);
    });
    setIsDeleteConfirmOpen(false);
    setDeletingRecordId(null);
    triggerToast(`Production record for ${details} deleted & syncing across devices.`);
  };

  // ----------------------------------------------------
  // HANDLERS: EXPORT EXCEL (1:1 MATCH WITH 51 APP HEADERS)
  // ----------------------------------------------------
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      triggerToast("No records available to export for the applied filter.");
      return;
    }

    // Row 1: The exact 51 App Headers matching application columns
    const headerRow = APP_LEDGER_COLUMNS.map(col => col.label);

    const rows = filteredRecords.map(r => {
      const isSC = r.floor === 'Sub-Contact' || r.unit === 'Sub-Contact';
      return [
        r.unit || (isSC ? 'Sub-Contact' : 'In-House'),      // Unit
        r.year,                                             // Year
        r.month,                                            // Month
        r.date,                                             // Date
        r.floor,                                            // Floor
        r.target,                                           // Target Total
        r.shiftA,                                           // Shift A
        r.shiftB,                                           // Shift B
        r.shiftC,                                           // Shift C
        r.totalProduction,                                  // Total Production
        r.targetBulk ?? r.target,                           // Target Bulk
        r.bulkProd ?? r.totalProduction,                    // Bulk Prod.
        r.sampleProd ?? 0,                                  // Sample Prod.
        r.runningBulk ?? 0,                                 // Running Bulk
        r.runningSample ?? 0,                               // Running Sample
        r.idleMc ?? 0,                                      // Idle Mc
        r.machineUtilization ?? 0,                          // Machine Utilization
        r.idleMcPct ?? 0,                                   // Idle Mc %
        r.idleProduction ?? 0,                              // Idle Production
        r.efficiency ?? 0,                                  // Efficiency
        r.proPerMc ?? 0,                                    // Pro Per Mc
        r.reject ?? 0,                                      // Reject
        r.rejectPct ?? 0,                                   // Reject%
        r.hold ?? 0,                                        // Hold
        r.holdPct ?? 0,                                     // Hold%
        r.jhuteCutpcs ?? 0,                                 // Jhute/Cutpcs
        r.jhuteCutpcsPct ?? 0,                              // Jhute/Cutpcs%
        r.needleBroken ?? 0,                                // Needle Broken
        r.needlePerKg ?? 0,                                 // Needle Broken/KG
        r.sinkerBroken ?? 0,                                // Sinker Broken
        r.sinkerPerKg ?? 0,                                 // Sinker Broken/KG
        r.oilConsumption ?? 0,                              // Oil Consumption
        r.beltBroken ?? 0,                                  // Belt Broken
        r.otherSparePartsName || '',                        // Other Spare parts Name
        r.otherSparePartsQty ?? 0,                          // Other Spare parts QTY
        r.setChangeNeedle ?? 0,                             // Set Change Needle(Pcs)
        r.setChangeSinker ?? 0,                             // Set Change Sinker(Pcs)
        r.productionLossForEff ?? 0,                        // Production Loss For Eff
        r.prodLossForSample ?? 0,                           // Production Loss for Sample
        r.capacityUtilization ?? 0,                         // Capacity Utilization
        r.totalOperator ?? 0,                               // Total Operator
        r.absent ?? 0,                                      // Absent
        r.absentPct ?? 0,                                   // Absent %
        r.productionFlatKnit ?? 0,                          // Production-Flat Knit
        r.achievmentCircular ?? 0,                          // Achievment-Circular
        r.otd ?? '',                                        // OTD
        r.yarnIssued ?? 0,                                  // Yarn Issued
        r.totalRunningFactories ?? 0,                       // Total Running Factories
        r.runningMachine ?? 0,                              // Running Machine
        r.numberVehicles ?? 0,                              // Number Vehicles
        r.fabricReturn ?? 0,                                // Fabric Return
        r.remarks || ''                                     // Remarks
      ];
    });

    const worksheetData = [headerRow, ...rows];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set precise column widths to look incredibly tidy
    worksheet['!cols'] = APP_LEDGER_COLUMNS.map(c => ({ wch: Math.max(c.label.length + 4, 12) }));

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
    triggerToast(`Successfully exported ${filteredRecords.length} records with 51 matching App Headers: ${filename}`);
  };



  return (
    <div className="space-y-6 w-full min-w-0 max-w-full">
      {/* Unified Header & Query Filter Panel (Frozen sticky on desktop, static on mobile) */}
      <div 
        id="ledger-floating-filter-panel"
        className={`relative md:sticky md:top-[94px] z-30 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md transition-all duration-200 mb-4 ${
          isScrolled ? 'px-3 py-2 sm:px-3.5 sm:py-2.5 space-y-0' : 'px-3.5 py-2.5 sm:px-4 sm:py-3 space-y-2 sm:space-y-2.5'
        }`}
      >
        {/* Top Row: Title & Action Buttons (Hidden when scrolled) */}
        {!isScrolled && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="font-sans text-base sm:text-lg font-bold tracking-tight text-gray-950 dark:text-white leading-tight">
                Production Update Ledger
              </h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-gray-800 dark:text-slate-300 uppercase tracking-tight">
                MONITOR, SEARCH, EDIT AND MANAGE DAILY PRODUCTION RECORDS.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {/* Sync Google Sheet Button */}
              {isGasMode && (
                <button
                  type="button"
                  onClick={() => { void loadGasLedger(); }}
                  disabled={isSyncing}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50/70 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                  title="Synchronize ledger with Google Sheets"
                  id="sync-google-sheet-btn"
                >
                  <RefreshCw className={`h-3 w-3 text-blue-600 dark:text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Syncing...' : 'Sync Google Sheet'}</span>
                </button>
              )}

              {/* Upload Excel File Button - Admin Only */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsUploadExcelModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-700 rounded-lg transition-all shadow-2xs cursor-pointer"
                  title="Upload Excel File to import production records (Admin Only)"
                  id="upload-excel-btn"
                >
                  <Upload className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  <span>Upload Excel File</span>
                </button>
              )}

              {/* Download Excel File Button */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-300 dark:border-slate-700 rounded-lg transition-all shadow-2xs cursor-pointer"
                title="Download Excel File (.xlsx)"
                id="download-excel-header-btn"
              >
                <Download className="h-3 w-3 text-slate-700 dark:text-slate-300" />
                <span>Download Excel File</span>
              </button>
            </div>
          </div>
        )}

        {/* Filter Criteria Form Controls & Download Action */}
        <div className="flex flex-wrap items-end gap-2.5 sm:gap-3">
          {/* Unit selection */}
          <div className="min-w-[150px] sm:min-w-[180px] flex-1 space-y-0.5">
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>🏭</span> FACTORY FLOOR / UNIT
              </span>
              {filterUnit !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterUnit('all')}
                  className="text-[9px] text-red-500 hover:underline cursor-pointer"
                  title="Clear Unit Filter"
                >
                  Clear
                </button>
              )}
            </label>
            <select
              value={filterUnit}
              onChange={(e) => setFilterUnit(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-slate-100 transition-colors focus:border-[#0F4C81] focus:outline-hidden"
              id="filter-unit-dropdown"
            >
              <option value="all">All Units</option>
              <optgroup label="Summary Groups">
                <option value="In-House">In-House (All)</option>
                <option value="Sub-Contact">Sub-Contact</option>
              </optgroup>
              <optgroup label="Factory Units">
                {availableUnits.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Year Filter */}
          <div className="w-[110px] sm:w-[130px] space-y-0.5">
            <label className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <span>📅</span> YEAR
              </span>
              {filterYear !== 'all' && (
                <button
                  type="button"
                  onClick={() => setFilterYear('all')}
                  className="text-[9px] text-red-500 hover:underline cursor-pointer"
                  title="Clear Year Filter"
                >
                  Clear
                </button>
              )}
            </label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-gray-800 dark:text-slate-100 transition-colors focus:border-[#0F4C81] focus:outline-hidden"
              id="filter-year-dropdown"
            >
              <option value="all">All Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* From Date Calendar Picker */}
          <div className="w-[140px] sm:w-[165px]">
            <LedgerCalendarDatePicker
              id="filter-from-date-picker"
              label="FROM DATE"
              value={filterFromDate}
              onChange={handleFromDateChange}
              allowedDates={availableLedgerDates}
              minDate={minAvailableDate}
              maxDate={maxAvailableDate}
              placeholder="Select From Date"
            />
          </div>

          {/* To Date Calendar Picker */}
          <div className="w-[140px] sm:w-[165px]">
            <LedgerCalendarDatePicker
              id="filter-to-date-picker"
              label="TO DATE"
              value={filterToDate}
              onChange={handleToDateChange}
              allowedDates={availableLedgerDates}
              minDate={filterFromDate || minAvailableDate}
              maxDate={maxAvailableDate}
              placeholder="Select To Date"
            />
          </div>

          {/* Action buttons (Apply & Reset) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0F4C81] hover:bg-[#0b3861] text-white px-3 sm:px-4 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer h-[34px] whitespace-nowrap"
              id="apply-ledger-filter-btn"
            >
              <Filter className="h-3 w-3" />
              <span>Apply Criteria</span>
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 px-3 py-1.5 text-xs font-bold transition-all cursor-pointer h-[34px] whitespace-nowrap"
              id="reset-ledger-filter-btn"
            >
              <span>Reset</span>
            </button>
          </div>

          {/* Download Excel File Button */}
          <div className="flex items-center sm:ml-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer h-[34px] whitespace-nowrap"
              title="Download Excel File (.xlsx)"
              id="download-excel-btn"
            >
              <Download className="h-3 w-3 text-emerald-700 dark:text-emerald-400" />
              <span>Download Excel File</span>
            </button>
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

      {/* 3. Top 6 KPI Cards: Top Row (3 Production Summary Cards) + Bottom Row (Machine Status, Quality Status, Attendance) */}
      <div className="space-y-4" id="ledger-kpi-dashboard">
        {/* Top Row: In-House, Sub-Contact, Total In-House & Sub */}
        <ProductionTargetSummaryCard 
          inHouseTarget={summaryKPIs.inHouseTotalTarget || summaryKPIs.inHouseTarget}
          inHouseProduction={summaryKPIs.inHouseTotalProduction}
          inHouseBulkProduction={summaryKPIs.inHouseBulkProduction}
          inHouseBulkTarget={summaryKPIs.inHouseBulkTarget}
          inHouseSampleProduction={summaryKPIs.inHouseSampleProduction}
          inHouseProdLossForSample={summaryKPIs.inHouseLossForSample}
          inHouseAchievementPct={(summaryKPIs.inHouseTotalTarget || summaryKPIs.inHouseTarget) > 0 ? Math.round((summaryKPIs.inHouseTotalProduction / (summaryKPIs.inHouseTotalTarget || summaryKPIs.inHouseTarget)) * 100) : 0}
          subContactTarget={summaryKPIs.subContactTarget}
          subContactProduction={summaryKPIs.subContactBulkProduction}
          subContactAchievementPct={summaryKPIs.subContactTarget > 0 ? Math.round((summaryKPIs.subContactBulkProduction / summaryKPIs.subContactTarget) * 100) : 0}
          overallTarget={summaryKPIs.combinedOverallTarget}
          overallProduction={summaryKPIs.combinedOverallProd}
          overallBulkProduction={summaryKPIs.combinedOverallBulkProd}
          overallSampleProduction={summaryKPIs.combinedOverallSampleProd}
          overallAchievementPct={summaryKPIs.combinedOverallAchievePct}
          flatKnitPcs={summaryKPIs.totalFlatKnitPcs}
          efficiencyPct={summaryKPIs.efficiencyPct}
          capacityUtilizationPct={summaryKPIs.capacityUtilizationPct}
          periodLabel={summaryKPIs.monthName}
        />

        {/* Bottom Row: Machine Status, Quality Status, Attendance */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Card 4: Machine Status */}
          <MachineStatusCard 
            inHouseTotalMachines={summaryKPIs.inHouseTotalMachines}
            inHouseRunningMachines={summaryKPIs.inHouseRunningMachines}
            inHouseBulkRunning={summaryKPIs.inHouseBulkRunning}
            inHouseSampleRunning={summaryKPIs.inHouseSampleRunning}
            inHouseIdleMachinePct={summaryKPIs.inHouseIdleMachinePct}
            inHouseIdleCount={summaryKPIs.inHouseIdleCount}
            subContactActiveFactories={summaryKPIs.subContactActiveFactories}
            subContactTotalMachineRun={summaryKPIs.subContactTotalMachineRun}
            subContactActiveVehicles={summaryKPIs.subContactActiveVehicles}
            periodLabel={summaryKPIs.monthName}
          />

          {/* Card 5: Quality Status */}
          <QualityStatusCard 
            inHouseReject={summaryKPIs.inHouseReject}
            inHouseRejectPct={summaryKPIs.inHouseRejectPct}
            inHouseHold={summaryKPIs.inHouseHold}
            inHouseHoldPct={summaryKPIs.inHouseHoldPct}
            inHouseJhuteCutpcs={summaryKPIs.inHouseJhute}
            inHouseJhuteCutpcsPct={summaryKPIs.inHouseJhutePct}
            inHouseCumulativeScrapPct={summaryKPIs.inHouseScrapPct}
            inHousePassRatePct={summaryKPIs.inHousePassRatePct}
            subContactReject={summaryKPIs.subContactReject}
            subContactRejectPct={summaryKPIs.subContactRejectPct}
            subContactCumulativeScrapPct={summaryKPIs.subContactScrapPct}
            subContactPassRatePct={summaryKPIs.subContactPassRatePct}
            totalReject={summaryKPIs.totalReject}
            rejectPct={summaryKPIs.rejectPct}
            totalHold={summaryKPIs.totalHold}
            holdPct={summaryKPIs.holdPct}
            totalJhuteCutpcs={summaryKPIs.totalJhuteCutpcs}
            jhuteCutpcsPct={summaryKPIs.jhuteCutpcsPct}
            cumulativeScrapPct={summaryKPIs.cumulativeScrapPct}
            periodLabel={summaryKPIs.monthName}
          />

          {/* Card 6: Attendance */}
          <AttendanceCard 
            totalStaff={summaryKPIs.totalOperators}
            totalAbsent={summaryKPIs.totalAbsent}
            absentPct={summaryKPIs.absentPct}
            presentStaff={summaryKPIs.totalPresent}
            presentPct={summaryKPIs.presentPct}
            periodLabel={summaryKPIs.monthName}
          />
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
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs hover:shadow-md transition-all duration-200 w-[310px] sm:w-[335px] flex-shrink-0 flex flex-col justify-between text-xs"
            >
              {/* Header: EKL UNIT (left) | Achieved 81.8% (right) */}
              <div className="flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-2 mb-2.5">
                <div>
                  <span className="text-sm sm:text-base font-black text-gray-950 dark:text-white tracking-wider uppercase block">
                    {f.name} UNIT
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 block -mt-0.5">
                    {summaryKPIs.monthName || 'August 2026'}
                  </span>
                </div>
                <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400">
                  Achieved {f.achievementPct}%
                </span>
              </div>

              {/* Card Body */}
              {f.isSubContact ? (
                /* Sub-Contact Dedicated 5-Row Layout */
                <div className="grid grid-cols-2 gap-y-3 gap-x-3 text-xs my-auto py-1">
                  {/* Row 1 */}
                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Total Target/Production
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.target.toLocaleString()}Kg / {f.production.toLocaleString()}Kg
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Bulk Production
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.bulkProd.toLocaleString()}Kg
                    </span>
                  </div>

                  {/* Row 2 */}
                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Sample Prod.
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.sampleProd.toLocaleString()} Kg
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Flat Knit Production
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.productionFlatKnit.toLocaleString()}pcs
                    </span>
                  </div>

                  {/* Row 3 */}
                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Total Machine Run.
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.runningMachine}pcs
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Running Factory.
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.runningFactories}pcs
                    </span>
                  </div>

                  {/* Row 4 */}
                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Number Vehicles
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.numberVehicles}pcs
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Party Returned
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.partyReturned.toLocaleString()}Kg
                    </span>
                  </div>

                  {/* Row 5 */}
                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      QA Reject/Hold
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.reject} <span className="text-red-600 dark:text-red-500 font-bold">({f.rejectPct}%)</span>/{f.hold} <span className="text-red-600 dark:text-red-500 font-bold">({f.holdPct}%)</span>
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                      Total/Absent Staff
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                      {f.totalOperator} / {f.absent}<span className="text-red-600 dark:text-red-500 font-bold">({f.absentPct}%)</span>
                    </span>
                  </div>
                </div>
              ) : (
                /* In-House Standard Layout */
                <>
                  {/* Top Primary Metrics (2-Columns) */}
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
                    {/* Row 1 */}
                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Total Target/Production
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.target.toLocaleString()}Kg / {f.production.toLocaleString()}Kg
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Bulk Target/Production
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.bulkTarget.toLocaleString()}Kg / {f.bulkProd.toLocaleString()}Kg
                      </span>
                    </div>

                    {/* Row 2 */}
                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Sample Prod. / M/C Run
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.sampleProd.toLocaleString()}Kg / {f.runningSample}pcs
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Loss For Sample
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.prodLossForSample.toLocaleString()}Kg
                      </span>
                    </div>

                    {/* Row 3 */}
                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Total Machine/Running
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.totalMachines}pcs / {f.runningMachine}pcs
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Idle Machine%
                      </span>
                      <span className="font-black text-red-600 dark:text-red-500 text-xs block">
                        {f.idleMachinePct}%
                      </span>
                    </div>

                    {/* Row 4 */}
                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        QA Reject/Hold
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.reject}<span className="text-red-600 dark:text-red-500 font-bold">({f.rejectPct}%)</span>/{f.hold}<span className="text-red-600 dark:text-red-500 font-bold">({f.holdPct}%)</span>
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Total/Absent Operators
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.totalOperator} / {f.absent}<span className="text-red-600 dark:text-red-500 font-bold">({f.absentPct}%)</span>
                      </span>
                    </div>
                  </div>

                  {/* Middle Section Divider: Secondary Element Consumption. */}
                  <div className="border-y border-slate-300 dark:border-slate-700 py-1.5 my-2.5 text-center">
                    <span className="font-serif text-xs sm:text-[13px] font-medium text-gray-900 dark:text-slate-100 tracking-wide">
                      Secondary Element Consumption.
                    </span>
                  </div>

                  {/* Bottom Secondary Metrics (2-Columns) */}
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 text-xs">
                    {/* Row 1 */}
                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Needel Broken/Per KG
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.needleBroken}pcs / {f.needlePerKg.toLocaleString()} Kg
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Sinker Broken/Per KG
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.sinkerBroken} pcs / {f.sinkerPerKg.toLocaleString()} Kg
                      </span>
                    </div>

                    {/* Row 2 */}
                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Oil Consume/Per KG
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.oilConsumption}lt / {f.oilPerKg.toLocaleString()} Kg
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-slate-400 dark:text-slate-400 text-[11px] block">
                        Belt Broken/Per KG
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-slate-100 text-xs block">
                        {f.beltBroken}pcs / {f.beltPerKg.toLocaleString()}Kg
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Card Footer */}
              <div className="border-t border-slate-300 dark:border-slate-700 pt-2.5 mt-2.5 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span className="font-medium text-slate-500 dark:text-slate-400">Database: Online</span>
                {f.dateStatus.isLive ? (
                  <span 
                    className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-0.5 rounded-md text-[10px] shadow-2xs"
                    title={`Last updated: ${f.dateStatus.dateStr ? formatSingleDate(f.dateStatus.dateStr) : 'Today/Yesterday'} (Live)`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span 
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px]"
                    title="Last Production Update Date"
                  >
                    <Calendar className="h-2.5 w-2.5 text-slate-500 dark:text-slate-400" />
                    {f.dateStatus.label}
                  </span>
                )}
              </div>
            </div>
          ))}
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
                if (!canUserEnterRecords) {
                  triggerToast("Access Denied: You do not have permission to add production records. Please contact an Administrator.");
                  return;
                }
                const initialFloor = allowedEntryFloors[0] || 'EKL';
                setCreatingRecord(getInitialNewRecord(initialFloor));
                setCreateErrors({});
                setIsCreateModalOpen(true);
              }}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                canUserEnterRecords
                  ? 'bg-[#0F4C81] hover:bg-[#0b3861] text-white'
                  : 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'
              }`}
              id="add-production-entry-btn"
              title={canUserEnterRecords ? 'Add new production log for your assigned floor' : 'No entry permissions assigned'}
            >
              <Plus className="h-4 w-4" />
              <span>Add Production Entry</span>
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
                  key={r.id ? `${r.id}-${index}` : `rec-${index}`}
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
                  {isColVisible('setChangeNeedle') && (
                    <td style={{ width: `${getColWidth('setChangeNeedle')}px`, minWidth: `${getColWidth('setChangeNeedle')}px`, maxWidth: `${getColWidth('setChangeNeedle')}px`, ...getStickyStyle('setChangeNeedle') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('setChangeNeedle')}`}>
                      {r.setChangeNeedle !== undefined && r.setChangeNeedle !== null ? r.setChangeNeedle.toLocaleString() : ''}
                    </td>
                  )}
                  {isColVisible('setChangeSinker') && (
                    <td style={{ width: `${getColWidth('setChangeSinker')}px`, minWidth: `${getColWidth('setChangeSinker')}px`, maxWidth: `${getColWidth('setChangeSinker')}px`, ...getStickyStyle('setChangeSinker') }} className={`px-2.5 py-2 text-right font-mono text-gray-600 whitespace-nowrap ${getStickyClass('setChangeSinker')}`}>
                      {r.setChangeSinker !== undefined && r.setChangeSinker !== null ? r.setChangeSinker.toLocaleString() : ''}
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
                      {isUserAuthorizedForFloor(currentUser, r.floor) ? (
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-[#0F4C81] hover:bg-[#0F4C81]/10 dark:text-blue-400 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                          title="Edit entry details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            const allowedStr = allowedEntryFloors.length > 0 ? allowedEntryFloors.join(', ') : 'None';
                            triggerToast(`Access Restricted: You can view ${r.floor} data, but you are only permitted to enter/edit records for: ${allowedStr}.`);
                          }}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title={`View Only: Assigned to ${allowedEntryFloors.join(', ') || 'None'}`}
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </button>
                      )}
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

      {/* 7. POPUP MODAL: EDIT PRODUCTION RECORD (UNIFIED 52 COLUMNS FULL FORM) */}
      <AddProductionRecordModal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingRecord(null); }}
        record={editingRecord}
        onChange={handleEditChange}
        onSave={handleSaveEdit}
        errors={editErrors}
        isEdit={true}
        title="Edit Production Record"
        submitLabel="Save & Sync Changes"
        allowedFloors={allowedEntryFloors}
        currentUser={currentUser}
      />

      {/* 7.5. POPUP MODAL: ADD PRODUCTION RECORD (52 COLUMNS FULL FORM) */}
      <AddProductionRecordModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setCreatingRecord(null); }}
        record={creatingRecord}
        onChange={handleCreateChange}
        onSave={handleSaveCreate}
        errors={createErrors}
        allowedFloors={allowedEntryFloors}
        currentUser={currentUser}
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

      {/* 8.5. POPUP MODAL: UPLOAD EXCEL FILE (ADMIN ONLY) */}
      {isAdmin && (
        <UploadLedgerExcelModal
          isOpen={isUploadExcelModalOpen}
          onClose={() => setIsUploadExcelModalOpen(false)}
          onImportComplete={handleImportExcelComplete}
          existingCount={ledger.length}
        />
      )}

    </div>
  );
}
