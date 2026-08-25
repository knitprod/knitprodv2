/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserRecord extends SyncMetadata {
  id: string;
  userName: string;
  userType: 'Admin' | 'General';
  designation: string;
  uid: string;
  password?: string;
  department: 'Knitting' | 'Dyeing' | 'Finishing';
  assignedUnits: string[];
  assignedBuyers?: string[];
  permission: 'Read' | 'Read / Write' | 'Hide';
  status: 'Active' | 'Inactive';
  lastUpdated: string;
  allowedTabs?: string[];
  tabPermissions?: Record<string, 'View Only' | 'Full Access' | 'No Access'>;
  phone?: string;
  email?: string;
  lastLogin?: string;
}

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
  unit?: string;                  // Unit (Sub-Contact, In-House)
  year: number;                   // Year (e.g. 2026)
  month: string;                  // Month (e.g. August)
  date: string;                   // Date (e.g. 8/11/2026 or YYYY-MM-DD)
  day?: string;                   // Day of week (e.g. Monday)
  floor: string;                  // Floor (Extension, ESL-Extension, Sub-Contact, EKL, Auto-Stripe, EFL, EFL-2)
  target: number;                 // Target Total
  shiftA: number;                 // Shift A
  shiftB: number;                 // Shift B
  shiftC: number;                 // Shift C
  totalProduction: number;        // Total Production
  targetBulk?: number;            // Target Bulk
  bulkProd?: number;              // Bulk Prod.
  sampleProd?: number;            // Sample Prod.
  totalMachines?: number;         // Total Machines Allocated
  runningMachine?: number;        // Running Machine
  runningBulk?: number;           // Running Bulk
  runningSample?: number;         // Running Sample
  idleMc?: number;                // Idle Mc
  machineUtilization?: number;    // Machine Utilization %
  idleMcPct?: number;             // Idle Mc %
  prodLossForSample?: number;     // Prod. Loss For Sample
  idleProduction?: number;        // Idle Production
  efficiency?: number;            // Efficiency %
  proPerMc?: number;              // Pro Per Mc
  reject?: number;                // Reject
  rejectPct?: number;             // Reject%
  hold?: number;                  // Hold
  holdPct?: number;               // Hold%
  jhuteCutpcs?: number;            // Jhute/Cutpcs
  jhuteCutpcsPct?: number;         // Jhute/Cutpcs%
  needleBroken?: number;          // Needle Broken
  needlePerKg?: number;           // Needle/Per Kg
  sinkerBroken?: number;          // Sinker Broken
  sinkerPerKg?: number;           // Sinker/Per Kg
  oilConsumption?: number;        // Oil Consumption
  beltBroken?: number;            // Belt Broken
  otherSparePartsName?: string;   // Other Spare parts Name
  otherSparePartsQty?: number;    // Other Spare parts QTY
  setChangePcs?: number;          // Set Change(Pcs)
  productionLossForEff?: number;  // Production Loss For Eff
  capacityUtilization?: number;   // Capacity Utilization %
  totalOperator?: number;         // Total Operator
  absent?: number;                // Absent
  absentPct?: number;             // Absent %
  productionFlatKnit?: number;    // Production-Flat Knit
  achievmentCircular?: number;    // Achievment-Circular
  otd?: number | string;          // OTD
  yarnIssued?: number;            // Yarn Issued
  totalRunningFactories?: number; // Total Running Factories
  numberVehicles?: number;        // Number Vehicles
  fabricReturn?: number;          // Fabric Return
  remarks?: string;               // Remarks

  // Backward compatibility aliases
  idleMachine?: number;
  idleMachinePct?: number;
  productionPerMachine?: number;
  productionLossForEfficiency?: number;
  setChange?: number;
  runningFactories?: number;
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

export interface YarnAllocationRecord extends SyncMetadata {
  id: string;
  actualRequisitionDate: string;
  buyer: string;
  orderNumber: string;
  fabricsType: string;
  fabricShade: string;
  fabricGsm: number | string;
  yarnRequired: string;
  lotRef: string;
  allocatedYarn: string;
  lotNo: string;
  spinnersName: string;
  allocationStatus: string;
  yarnStockStatus: string;
  yarnDeliveryStatus: string;
  proposedAllocationDate: string;
  allocationDateRange: string;
  allocationNo: string;
  yarnRqQty: number;
  allocatedQty: number;
  balance: number;
  remarks: string;
}



