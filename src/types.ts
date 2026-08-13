/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SyncMetadata {
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  syncStatus?: 'synced' | 'pending' | 'conflict' | 'error';
  lastSyncTime?: string;
  version?: number;
}

export interface KPIMetric {
  id: string;
  label: string;
  value: string | number;
  unit?: string;
  description: string;
  change: string; // e.g. "+2.4%" or "-0.8%"
  isPositive: boolean;
  color: 'blue' | 'green' | 'orange' | 'red';
  iconName: string;
}

export interface FactoryFloor {
  id: string;
  name: string;
  longName: string;
  status: 'optimal' | 'warning' | 'critical';
  targetKg: number;
  productionKg: number;
  achievementPct: number;
  runningMachines: number;
  totalMachines: number;
  idleMachines: number;
  efficiencyPct: number;
  rejectPct: number;
  lastUpdated: string;
}

export interface ProductionEntry extends SyncMetadata {
  id: string;
  floorId: string;
  timestamp: string;
  machineId: string;
  operatorName: string;
  shift: 'A' | 'B' | 'C';
  yarnType: string;
  fabricType: string;
  productionKg: number;
  rejectKg: number;
  remarks?: string;
  date?: string;
}

export interface ActivityLog extends SyncMetadata {
  id: string;
  timestamp: string;
  floorId?: string;
  type: 'production' | 'alert' | 'maintenance' | 'system';
  message: string;
  status: 'info' | 'success' | 'warning' | 'danger';
}

export interface ChartDataPoint {
  label: string;
  value1: number; // Target / Primary value
  value2?: number; // Actual / Secondary value
  value3?: number; // Reject / Tertiary value
}

export interface LedgerRecord extends SyncMetadata {
  id: string;
  date: string;       // YYYY-MM-DD
  floor: string;      // EKL, EFL, EFL-2, Auto Stripe, EFL-Extension, ESL-Extension, Sub-Contact
  month: string;      // Month name
  year: number;       // Year

  // Production
  target: number;
  shiftA: number;
  shiftB: number;
  shiftC: number;
  totalProduction: number;

  // Machine Performance
  runningMachine: number;
  idleMachine: number;
  machineUtilization: number;  // (runningMachine / total) * 100
  idleMachinePct: number;      // (idleMachine / total) * 100
  idleProduction: number;      // lost production
  efficiency: number;          // totalProduction / target * 100
  productionPerMachine: number;// totalProduction / runningMachine

  // Quality
  reject: number;
  rejectPct: number;           // reject / totalProduction * 100
  hold: number;
  holdPct: number;             // hold / totalProduction * 100

  // Consumables
  needleBroken: number;
  needlePerKg: number;         // needleBroken / totalProduction
  sinkerBroken: number;
  oilConsumption: number;

  // Performance
  productionLossForEfficiency: number; // target - totalProduction (0 if negative)
  capacityUtilization: number;         // capacity percentage

  // Manpower
  totalOperator: number;
  absent: number;
  absentPct: number;           // absent / totalOperator * 100

  // Other
  setChange: number;
  remarks: string;

  // Sub-Contact specific fields
  productionFlatKnit?: number;
  yarnIssued?: number;
  runningFactories?: number;
  fabricReturn?: number;
}

export interface SyncConflictLog {
  id: string;
  recordId: string;
  collectionName: string;
  firestoreUpdatedAt: string;
  sheetsUpdatedAt: string;
  winner: 'firestore' | 'sheets';
  details: string;
  createdAt: string;
  resolved: boolean;
}

export interface OrderPlan extends SyncMetadata {
  id: string;
  planMonth: string;
  planType: string;
  ewo: string;
  buyer: string;
  color: string;
  knitStart: string;
  knitEnd: string;
  target: number;
  targetNextMonth: number;
  allocationStart: string;
  allocationEnd: string;
  allocatedQty: number;
  allocatedBal: number;
  greyReq: number;
  knitPro: number;
  knitBal: number;
  aKnitStart: string;
  lastProductionDate: string;
  avgProdDay: number;
  expectedKnitEnd: string;
  knitStartOtd: 'Passed' | 'Failed' | 'Pending';
  knitEndOtd: 'Passed' | 'Failed' | 'Pending';
  knitStartRemarks: string;
  knitEndRemarks: string;
  knitTeamLeaders: string;
}


