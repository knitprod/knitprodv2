/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { UserRecord } from './UserManagementView';
import { formatDisplayDate } from './YarnAllocationView';
import SearchableSelect from './SearchableSelect';
import { useTableColumns, ColumnCustomizerDropdown, ResizableTh, ColumnDef } from './TableColumnCustomizer';
import { 
  ClipboardList, 
  Target, 
  Layers, 
  CalendarCheck, 
  Calendar,
  Search, 
  Filter, 
  Plus, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Package, 
  TrendingUp, 
  X, 
  FileSpreadsheet,
  ArrowUpDown,
  ChevronDown,
  Trash2,
  Edit,
  Info,
  AlertCircle,
  RefreshCw,
  Shield,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Users,
} from 'lucide-react';

export const getYesterdayDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDisplayDate(d.toISOString());
};

export function isSameDateStr(d1: string | null | undefined, d2: string | null | undefined): boolean {
  if (d1 === d2) return true;
  if (!d1 || !d2) return false;
  if (d1 === 'All' || d2 === 'All') return true;
  
  const n1 = formatDisplayDate(d1).toLowerCase();
  const n2 = formatDisplayDate(d2).toLowerCase();
  if (n1 === n2 && n1 !== '-' && n1 !== '') return true;

  const dt1 = parseDateString(d1);
  const dt2 = parseDateString(d2);
  if (dt1 && dt2 && dt1.getFullYear() === dt2.getFullYear() && dt1.getMonth() === dt2.getMonth() && dt1.getDate() === dt2.getDate()) {
    return true;
  }
  return false;
}

export interface OrderPlan {
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

/**
 * Safely parse date strings like "27-Jun-26", "2026-06-27", "27/06/2026"
 */
function parseDateString(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  if (!str || str === '-' || str === 'Pending') return null;

  // Try standard Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // Try parsing "27-Jun-26" or "27-Jun-2026"
  const parts = str.split(/[-/ ]/);
  if (parts.length === 3) {
    let day = parseInt(parts[0], 10);
    let monthStr = parts[1];
    let year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;

    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };

    let month = -1;
    if (!isNaN(parseInt(monthStr, 10))) {
      month = parseInt(monthStr, 10) - 1;
    } else {
      month = monthMap[monthStr.toLowerCase().slice(0, 3)] ?? -1;
    }

    if (month >= 0 && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }

  return null;
}

/**
 * Calculates variance in days = (plannedDate - actualDate)
 * +X Days = Early / Ahead of schedule
 * -X Days = Delayed / Late
 * 0 Days = On time
 */
function calculateDateVariance(plannedStr: string, actualStr: string) {
  const planDate = parseDateString(plannedStr);
  const actualDate = parseDateString(actualStr);

  if (!planDate || !actualDate) {
    return { days: null, formatted: '-', status: 'none' as const };
  }

  const diffMs = planDate.getTime() - actualDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { days: diffDays, formatted: `+${diffDays} Days`, status: 'early' as const };
  } else if (diffDays < 0) {
    return { days: diffDays, formatted: `${diffDays} Days`, status: 'delay' as const };
  } else {
    return { days: 0, formatted: '0 Days', status: 'ontime' as const };
  }
}

const INITIAL_ORDERS: OrderPlan[] = [
  {
    id: 'ord-aug-12-1',
    planMonth: 'August',
    planType: 'Confirm',
    ewo: '271890',
    buyer: 'Vogue Sourcin',
    color: 'Navy Blue',
    knitStart: '12-August-2026',
    knitEnd: '25-August-2026',
    target: 1500,
    targetNextMonth: 0,
    allocationStart: '01-August-2026',
    allocationEnd: '10-August-2026',
    allocatedQty: 1600,
    allocatedBal: 0,
    greyReq: 1550,
    knitPro: 450,
    knitBal: 1050,
    aKnitStart: '12-August-2026',
    lastProductionDate: '12-August-2026',
    avgProdDay: 150,
    expectedKnitEnd: '22-August-2026',
    knitStartOtd: 'Passed',
    knitEndOtd: 'Pending',
    knitStartRemarks: 'On time start',
    knitEndRemarks: '',
    knitTeamLeaders: ''
  },
  {
    id: 'ord-aug-12-2',
    planMonth: 'August',
    planType: 'Confirm',
    ewo: '271891',
    buyer: 'S.Oliver',
    color: 'Olive Green',
    knitStart: '12-August-2026',
    knitEnd: '28-August-2026',
    target: 2400,
    targetNextMonth: 0,
    allocationStart: '02-August-2026',
    allocationEnd: '11-August-2026',
    allocatedQty: 2500,
    allocatedBal: 0,
    greyReq: 2450,
    knitPro: 800,
    knitBal: 1600,
    aKnitStart: '12-August-2026',
    lastProductionDate: '12-August-2026',
    avgProdDay: 200,
    expectedKnitEnd: '26-August-2026',
    knitStartOtd: 'Passed',
    knitEndOtd: 'Pending',
    knitStartRemarks: 'On time start',
    knitEndRemarks: '',
    knitTeamLeaders: ''
  },
  {
    id: 'ord-270258-1',
    planMonth: 'July',
    planType: 'Confirm',
    ewo: '270258',
    buyer: 'Vogue Sourcin',
    color: 'Mid Blue',
    knitStart: '27-Jun-26',
    knitEnd: '15-Jul-26',
    target: 314,
    targetNextMonth: 0,
    allocationStart: '5-May-26',
    allocationEnd: '5-May-26',
    allocatedQty: 336,
    allocatedBal: 0,
    greyReq: 334,
    knitPro: 20,
    knitBal: 314,
    aKnitStart: '22-Jun-26',
    lastProductionDate: '15-Jul-26',
    avgProdDay: 5,
    expectedKnitEnd: '23-Sep-26',
    knitStartOtd: 'Passed',
    knitEndOtd: 'Passed',
    knitStartRemarks: '',
    knitEndRemarks: '',
    knitTeamLeaders: ''
  },
  {
    id: 'ord-270258-2',
    planMonth: 'July',
    planType: 'Confirm',
    ewo: '270258',
    buyer: 'Vogue Sourcin',
    color: 'Blue Marl',
    knitStart: '27-Jun-26',
    knitEnd: '15-Jul-26',
    target: 3866,
    targetNextMonth: 0,
    allocationStart: '7-May-26',
    allocationEnd: '15-Jul-26',
    allocatedQty: 6253,
    allocatedBal: 2,
    greyReq: 5787,
    knitPro: 3106,
    knitBal: 2681,
    aKnitStart: '29-Jun-26',
    lastProductionDate: '21-Jul-26',
    avgProdDay: 80,
    expectedKnitEnd: '25-Aug-26',
    knitStartOtd: 'Failed',
    knitEndOtd: 'Failed',
    knitStartRemarks: '',
    knitEndRemarks: '',
    knitTeamLeaders: ''
  },
  {
    id: 'ord-270418',
    planMonth: 'July',
    planType: 'Confirm',
    ewo: '270418',
    buyer: 'Vogue Sourcin',
    color: 'Next Black',
    knitStart: '10-Jun-26',
    knitEnd: '25-Jun-26',
    target: 282,
    targetNextMonth: 0,
    allocationStart: '14-May-26',
    allocationEnd: '24-May-26',
    allocatedQty: 3124,
    allocatedBal: 0,
    greyReq: 2960,
    knitPro: 2600,
    knitBal: 359,
    aKnitStart: '19-Jun-26',
    lastProductionDate: '20-Jul-26',
    avgProdDay: 65,
    expectedKnitEnd: '28-Jul-26',
    knitStartOtd: 'Failed',
    knitEndOtd: 'Failed',
    knitStartRemarks: '',
    knitEndRemarks: '',
    knitTeamLeaders: ''
  },
  {
    id: 'ord-270435',
    planMonth: 'July',
    planType: 'Confirm',
    ewo: '270435',
    buyer: 'S.Oliver',
    color: 'S.Oliver-9999',
    knitStart: '16-Jul-26',
    knitEnd: '20-Jul-26',
    target: 730,
    targetNextMonth: 0,
    allocationStart: '',
    allocationEnd: '',
    allocatedQty: 0,
    allocatedBal: 0,
    greyReq: 730,
    knitPro: 0,
    knitBal: 730,
    aKnitStart: '',
    lastProductionDate: '',
    avgProdDay: 0,
    expectedKnitEnd: '',
    knitStartOtd: 'Pending',
    knitEndOtd: 'Pending',
    knitStartRemarks: '',
    knitEndRemarks: '',
    knitTeamLeaders: ''
  }
];

export interface YarnAllocationRecord {
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

export const INITIAL_YARN_ALLOCATIONS: YarnAllocationRecord[] = [
  {
    id: 'ya-1',
    actualRequisitionDate: '28-Jun-25',
    buyer: 'C&A',
    orderNumber: '260796',
    fabricsType: 'Fleece',
    fabricShade: 'JS200049',
    fabricGsm: 260,
    yarnRequired: '24CC-PT',
    lotRef: '',
    allocatedYarn: '24OC NPOP OCS',
    lotNo: 'GO8124A805',
    spinnersName: 'Maral',
    allocationStatus: 'Allocated',
    yarnStockStatus: 'Stock Available',
    yarnDeliveryStatus: 'Completed',
    proposedAllocationDate: '',
    allocationDateRange: '29-Jun-2025 To 08-Jul-2025',
    allocationNo: 'A7288',
    yarnRqQty: 463,
    allocatedQty: 463,
    balance: 0,
    remarks: 'As per quality confirmation'
  },
  {
    id: 'ya-2',
    actualRequisitionDate: '28-Jun-25',
    buyer: 'C&A',
    orderNumber: '260796',
    fabricsType: 'Fleece',
    fabricShade: 'JS200049',
    fabricGsm: 260,
    yarnRequired: '30CC-Color-Melange-Traceable-JS200049',
    lotRef: 'Do allocate from 260320',
    allocatedYarn: '30CM-JS200049 100% BCI',
    lotNo: 'ABM309695F',
    spinnersName: 'Winsome',
    allocationStatus: 'Allocated',
    yarnStockStatus: 'Stock Available',
    yarnDeliveryStatus: 'Completed',
    proposedAllocationDate: '',
    allocationDateRange: '01-Jul-2025 To 08-Jul-2025',
    allocationNo: 'A7296',
    yarnRqQty: 2110,
    allocatedQty: 2087,
    balance: 23,
    remarks: 'ok'
  },
  {
    id: 'ya-3',
    actualRequisitionDate: '28-Jun-25',
    buyer: 'C&A',
    orderNumber: '260796',
    fabricsType: 'Ottoman Rib',
    fabricShade: 'JS200049',
    fabricGsm: 250,
    yarnRequired: '34CC-Color-Melange-Traceable-JS200049',
    lotRef: 'Do allocate from 260320',
    allocatedYarn: '34CM-JS200049 100% BCI',
    lotNo: 'ABM342286F',
    spinnersName: 'Winsome',
    allocationStatus: 'Allocated',
    yarnStockStatus: 'Stock Available',
    yarnDeliveryStatus: 'Completed',
    proposedAllocationDate: '',
    allocationDateRange: '01-Jul-2025 To 08-Jul-2025',
    allocationNo: 'A7293',
    yarnRqQty: 347,
    allocatedQty: 347,
    balance: 0,
    remarks: ''
  },
  {
    id: 'ya-4',
    actualRequisitionDate: '28-Jun-25',
    buyer: 'C&A',
    orderNumber: '260796',
    fabricsType: 'Single Jersey',
    fabricShade: 'JS200049',
    fabricGsm: 160,
    yarnRequired: '30CC-Color-Melange-Traceable-JS200049',
    lotRef: 'Do allocate from 260320',
    allocatedYarn: '30CM-JS200049 100% BCI',
    lotNo: 'ABM309695F',
    spinnersName: 'Winsome',
    allocationStatus: 'Allocated',
    yarnStockStatus: 'Stock Available',
    yarnDeliveryStatus: 'Completed',
    proposedAllocationDate: '',
    allocationDateRange: '02-Jul-2025 To 08-Jul-2025',
    allocationNo: 'A7296',
    yarnRqQty: 122,
    allocatedQty: 122,
    balance: 0,
    remarks: ''
  },
  {
    id: 'ya-5',
    actualRequisitionDate: '5-Jul-25',
    buyer: 'C&A',
    orderNumber: '260796',
    fabricsType: 'Fleece',
    fabricShade: 'JS200049',
    fabricGsm: 260,
    yarnRequired: '24CC-PT',
    lotRef: '',
    allocatedYarn: '24OC NPOP OCS',
    lotNo: 'GO8124A805',
    spinnersName: 'Maral',
    allocationStatus: 'Allocated',
    yarnStockStatus: 'Stock Available',
    yarnDeliveryStatus: 'Completed',
    proposedAllocationDate: '',
    allocationDateRange: '08-Jul-2025 To 08-Jul-2025',
    allocationNo: 'A7308',
    yarnRqQty: -463,
    allocatedQty: -135,
    balance: -328,
    remarks: 'ok'
  }
];

function formatYarnQty(val: number): string {
  if (val === undefined || val === null || isNaN(val) || val === 0) return '-';
  const rounded = Math.round(val);
  if (rounded === 0) return '-';
  if (rounded < 0) return `(${Math.abs(rounded).toLocaleString()})`;
  return rounded.toLocaleString();
}

interface PlanOrderFollowupViewProps {
  initialSubTab?: 'team_leader' | 'buyer' | 'summary' | 'delivery';
  currentUser?: UserRecord | null;
}

const PLAN_ORDER_COLUMNS: ColumnDef[] = [
  { id: 'planMonth', label: 'Plan Month', defaultWidth: 120 },
  { id: 'planType', label: 'Plan Type', defaultWidth: 110 },
  { id: 'ewo', label: 'EWO', defaultWidth: 110 },
  { id: 'buyer', label: 'Buyer', defaultWidth: 160 },
  { id: 'color', label: 'Color', defaultWidth: 140 },
  { id: 'knitStart', label: 'Knit Start', defaultWidth: 120 },
  { id: 'knitEnd', label: 'Knit End', defaultWidth: 120 },
  { id: 'target', label: 'Target (Kg)', defaultWidth: 110 },
  { id: 'targetNextMonth', label: 'Target Next Month', defaultWidth: 130 },
  { id: 'allocationStart', label: 'Allocation Start', defaultWidth: 120 },
  { id: 'allocationEnd', label: 'Allocation End', defaultWidth: 120 },
  { id: 'allocatedQty', label: 'Allocated QTY', defaultWidth: 110 },
  { id: 'allocatedBal', label: 'Allocated Bal.', defaultWidth: 110 },
  { id: 'greyReq', label: 'GREY REQ.', defaultWidth: 110 },
  { id: 'knitPro', label: 'KNIT PRO.', defaultWidth: 110 },
  { id: 'knitBal', label: 'KNIT BAL.', defaultWidth: 110 },
  { id: 'aKnitStart', label: 'A.Knit Start', defaultWidth: 120 },
  { id: 'startVariance', label: 'Knit Start VS A. Knit Start', defaultWidth: 180 },
  { id: 'lastProductionDate', label: 'A. Knit End/Last Prod Date', defaultWidth: 160 },
  { id: 'endVariance', label: 'Knit End VS A. Knit End', defaultWidth: 180 },
  { id: 'avgProdDay', label: 'Avg Prod/Day', defaultWidth: 110 },
  { id: 'expectedKnitEnd', label: 'Expected Knit End', defaultWidth: 130 },
  { id: 'knitStartOTD', label: 'Knit Start OTD', defaultWidth: 120 },
  { id: 'knitEndOTD', label: 'Knit End OTD', defaultWidth: 120 },
  { id: 'knitStartRemarks', label: 'Knit Start Remarks', defaultWidth: 150 },
  { id: 'knitEndRemarks', label: 'Knit End Remarks', defaultWidth: 150 },
  { id: 'knitTeamLeaders', label: 'Knit Team Leader', defaultWidth: 140 },
  { id: 'action', label: 'Action', defaultWidth: 90, alwaysVisible: true },
];

export default function PlanOrderFollowupView({ initialSubTab = 'summary', currentUser }: PlanOrderFollowupViewProps) {
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
  } = useTableColumns('plan_order_followup', currentUser?.uid || 'guest', PLAN_ORDER_COLUMNS, 5);

  const [orders, setOrders] = useState<OrderPlan[]>(INITIAL_ORDERS);
  const [activeSubTab, setActiveSubTab] = useState<'team_leader' | 'buyer' | 'summary' | 'delivery'>(
    initialSubTab || 'team_leader'
  );

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('All');
  const [teamLeaderFilter, setTeamLeaderFilter] = useState('All');
  const [planMonthFilter, setPlanMonthFilter] = useState('All');
  const [otdFilter, setOtdFilter] = useState('All');
  const [knitStartSelect, setKnitStartSelect] = useState<string>(() => getYesterdayDateString());
  const [knitEndSelect, setKnitEndSelect] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state for creating new row
  const [formPlanMonth, setFormPlanMonth] = useState('July');
  const [formPlanType, setFormPlanType] = useState('Confirm');
  const [formEwo, setFormEwo] = useState('');
  const [formBuyer, setFormBuyer] = useState('Vogue Sourcin');
  const [formColor, setFormColor] = useState('');
  const [formKnitStart, setFormKnitStart] = useState('');
  const [formKnitEnd, setFormKnitEnd] = useState('');
  const [formTarget, setFormTarget] = useState('1000');
  const [formAllocatedQty, setFormAllocatedQty] = useState('1000');
  const [formGreyReq, setFormGreyReq] = useState('1000');

  // Edit state for editing an existing row
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<OrderPlan | null>(null);
  const [editPlanMonth, setEditPlanMonth] = useState('July');
  const [editPlanType, setEditPlanType] = useState('Confirm');
  const [editEwo, setEditEwo] = useState('');
  const [editBuyer, setEditBuyer] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editKnitStart, setEditKnitStart] = useState('');
  const [editKnitEnd, setEditKnitEnd] = useState('');
  const [editTarget, setEditTarget] = useState('0');
  const [editAllocationStart, setEditAllocationStart] = useState('');
  const [editAllocationEnd, setEditAllocationEnd] = useState('');
  const [editAllocatedQty, setEditAllocatedQty] = useState('0');
  const [editGreyReq, setEditGreyReq] = useState('0');
  const [editKnitPro, setEditKnitPro] = useState('0');
  const [editAKnitStart, setEditAKnitStart] = useState('');
  const [editLastProductionDate, setEditLastProductionDate] = useState('');
  const [editKnitStartOtd, setEditKnitStartOtd] = useState<'Passed' | 'Failed' | 'Pending'>('Pending');
  const [editKnitEndOtd, setEditKnitEndOtd] = useState<'Passed' | 'Failed' | 'Pending'>('Pending');
  const [editKnitStartRemarks, setEditKnitStartRemarks] = useState('');
  const [editKnitEndRemarks, setEditKnitEndRemarks] = useState('');
  const [editKnitTeamLeaders, setEditKnitTeamLeaders] = useState('');

  // Yarn Allocation state & filters
  const [yarnAllocations, setYarnAllocations] = useState<YarnAllocationRecord[]>(INITIAL_YARN_ALLOCATIONS);
  const [yarnSearchQuery, setYarnSearchQuery] = useState('');
  const [yarnBuyerFilter, setYarnBuyerFilter] = useState('All');
  const [yarnFabricFilter, setYarnFabricFilter] = useState('All');
  const [yarnSpinnerFilter, setYarnSpinnerFilter] = useState('All');
  const [yarnStatusFilter, setYarnStatusFilter] = useState('All');

  // Add/Edit Yarn Allocation Modal state
  const [showAddYarnModal, setShowAddYarnModal] = useState(false);
  const [showEditYarnModal, setShowEditYarnModal] = useState(false);
  const [editingYarn, setEditingYarn] = useState<YarnAllocationRecord | null>(null);

  // Form states for Yarn Allocation
  const [yaRequisitionDate, setYaRequisitionDate] = useState('28-Jun-25');
  const [yaBuyer, setYaBuyer] = useState('C&A');
  const [yaOrderNumber, setYaOrderNumber] = useState('260796');
  const [yaFabricsType, setYaFabricsType] = useState('Fleece');
  const [yaFabricShade, setYaFabricShade] = useState('JS200049');
  const [yaFabricGsm, setYaFabricGsm] = useState('260');
  const [yaYarnRequired, setYaYarnRequired] = useState('24CC-PT');
  const [yaLotRef, setYaLotRef] = useState('');
  const [yaAllocatedYarn, setYaAllocatedYarn] = useState('24OC NPOP OCS');
  const [yaLotNo, setYaLotNo] = useState('GO8124A805');
  const [yaSpinnersName, setYaSpinnersName] = useState('Maral');
  const [yaAllocationStatus, setYaAllocationStatus] = useState('Allocated');
  const [yaYarnStockStatus, setYaYarnStockStatus] = useState('Stock Available');
  const [yaYarnDeliveryStatus, setYaYarnDeliveryStatus] = useState('Completed');
  const [yaProposedAllocationDate, setYaProposedAllocationDate] = useState('');
  const [yaAllocationDateRange, setYaAllocationDateRange] = useState('29-Jun-2025 To 08-Jul-2025');
  const [yaAllocationNo, setYaAllocationNo] = useState('A7288');
  const [yaYarnRqQty, setYaYarnRqQty] = useState('463');
  const [yaAllocatedQty, setYaAllocatedQty] = useState('463');
  const [yaBalance, setYaBalance] = useState('0');
  const [yaRemarks, setYaRemarks] = useState('');

  const filteredYarnAllocations = useMemo(() => {
    return yarnAllocations.filter(item => {
      const q = yarnSearchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        String(item.orderNumber || '').toLowerCase().includes(q) ||
        String(item.buyer || '').toLowerCase().includes(q) ||
        String(item.fabricsType || '').toLowerCase().includes(q) ||
        String(item.yarnRequired || '').toLowerCase().includes(q) ||
        String(item.allocatedYarn || '').toLowerCase().includes(q) ||
        String(item.lotNo || '').toLowerCase().includes(q) ||
        String(item.spinnersName || '').toLowerCase().includes(q) ||
        String(item.allocationNo || '').toLowerCase().includes(q) ||
        String(item.remarks || '').toLowerCase().includes(q);

      const matchesBuyer = yarnBuyerFilter === 'All' || item.buyer === yarnBuyerFilter;
      const matchesFabric = yarnFabricFilter === 'All' || item.fabricsType === yarnFabricFilter;
      const matchesSpinner = yarnSpinnerFilter === 'All' || item.spinnersName === yarnSpinnerFilter;
      const matchesStatus = yarnStatusFilter === 'All' || item.allocationStatus === yarnStatusFilter;

      return matchesSearch && matchesBuyer && matchesFabric && matchesSpinner && matchesStatus;
    });
  }, [yarnAllocations, yarnSearchQuery, yarnBuyerFilter, yarnFabricFilter, yarnSpinnerFilter, yarnStatusFilter]);

  const yarnTotals = useMemo(() => {
    return filteredYarnAllocations.reduce((acc, curr) => ({
      yarnRqQty: acc.yarnRqQty + (Number(curr.yarnRqQty) || 0),
      allocatedQty: acc.allocatedQty + (Number(curr.allocatedQty) || 0),
      balance: acc.balance + (Number(curr.balance) || 0),
    }), { yarnRqQty: 0, allocatedQty: 0, balance: 0 });
  }, [filteredYarnAllocations]);

  const uniqueOrdersCount = useMemo(() => {
    return new Set(filteredYarnAllocations.map(item => String(item.orderNumber || '').trim()).filter(Boolean)).size;
  }, [filteredYarnAllocations]);

  const handleExportYarnExcel = () => {
    const exportData = filteredYarnAllocations.map(item => ({
      'Actual Yarn Requisition date': item.actualRequisitionDate,
      'Buyer': item.buyer,
      'Order Number': item.orderNumber,
      'Fabrics Type': item.fabricsType,
      'Fabric Shade': item.fabricShade,
      'Fabric GSM': item.fabricGsm,
      'Yarn Required': item.yarnRequired,
      'Lot Ref': item.lotRef,
      'Allocated Yarn': item.allocatedYarn,
      'Lot #': item.lotNo,
      "Spinner's Name": item.spinnersName,
      'Allocation Status': item.allocationStatus,
      'Yarn Stock Status': item.yarnStockStatus,
      'Yarn Delivery Status': item.yarnDeliveryStatus,
      'Proposed Allocation Date': item.proposedAllocationDate,
      'Allocation Sart Date to End Date': item.allocationDateRange,
      'Allocation No': item.allocationNo,
      'Yarn Rq Qty': item.yarnRqQty,
      'Allocated Qty': item.allocatedQty,
      'Balance': item.balance === 0 ? '-' : item.balance,
      'Remarks': item.remarks
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Yarn Allocation');
    XLSX.writeFile(workbook, `Yarn_Allocation_Summary_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const loadYarnAllocations = async (forceRefresh: boolean = false) => {
    try {
      const remoteData = await GasClient.fetchYarnAllocations(forceRefresh);
      if (remoteData && remoteData.length > 0) {
        setYarnAllocations(remoteData as YarnAllocationRecord[]);
      }
    } catch (err) {
      console.warn("Could not load yarn allocations in PlanOrderFollowupView:", err);
    }
  };

  const loadOrders = async (forceRefresh: boolean = false) => {
    setIsSyncing(true);
    try {
      const sheetsOrders = await GasClient.fetchOrderPlans(forceRefresh);
      if (sheetsOrders && sheetsOrders.length > 0) {
        setOrders(sheetsOrders);
      } else {
        setOrders(prev => prev.length > 0 ? prev : INITIAL_ORDERS);
      }
    } catch (err) {
      console.warn("Could not load order plans from server/GAS:", err);
      setOrders(prev => prev.length > 0 ? prev : INITIAL_ORDERS);
    } finally {
      setIsSyncing(false);
    }
  };

  // Load cached order plans and yarn allocations on mount and listen for real-time Firestore sync & manual events
  useEffect(() => {
    loadOrders(false);
    loadYarnAllocations(false);

    // Real-time Firestore listener for order plan & yarn allocation updates across devices
    const unsubscribe = FirestoreSyncService.subscribeToSettings((settings) => {
      if (settings && (settings.last_order_plan_updated || settings.master_order_upload_info)) {
        loadOrders(true);
      }
      if (settings && (settings.last_yarn_allocation_updated || settings.master_yarn_upload_info)) {
        loadYarnAllocations(true);
      }
    });

    const handleSync = () => {
      loadOrders(true);
      loadYarnAllocations(true);
    };
    window.addEventListener('gas_data_synced', handleSync);

    return () => {
      unsubscribe();
      window.removeEventListener('gas_data_synced', handleSync);
    };
  }, []);

  // Pagination state (default 100 per page for fast performance)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(100);

  // Reset to page 1 whenever filters or page size change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, buyerFilter, teamLeaderFilter, planMonthFilter, otdFilter, knitStartSelect, knitEndSelect, itemsPerPage]);

  // User-based Buyer Access Restriction
  const userAssignedBuyers = useMemo(() => {
    if (currentUser && currentUser.assignedBuyers && Array.isArray(currentUser.assignedBuyers) && currentUser.assignedBuyers.length > 0) {
      return currentUser.assignedBuyers;
    }
    return null;
  }, [currentUser]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      // User-based Buyer Access Restriction
      if (userAssignedBuyers && !userAssignedBuyers.includes(ord.buyer)) {
        return false;
      }

      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        ord.ewo.toLowerCase().includes(q) ||
        ord.buyer.toLowerCase().includes(q) ||
        ord.color.toLowerCase().includes(q) ||
        ord.planMonth.toLowerCase().includes(q) ||
        ord.planType.toLowerCase().includes(q) ||
        (ord.knitStart && ord.knitStart.toLowerCase().includes(q)) ||
        (ord.knitEnd && ord.knitEnd.toLowerCase().includes(q)) ||
        (ord.knitTeamLeaders && ord.knitTeamLeaders.toLowerCase().includes(q));
      
      const matchesBuyer = buyerFilter === 'All' || ord.buyer === buyerFilter;
      const matchesTeamLeader = teamLeaderFilter === 'All' ||
        (teamLeaderFilter === 'Unassigned'
          ? (!ord.knitTeamLeaders || ord.knitTeamLeaders.trim() === '')
          : ord.knitTeamLeaders?.trim() === teamLeaderFilter);
      const matchesMonth = planMonthFilter === 'All' || ord.planMonth === planMonthFilter;
      
      const matchesOtd = 
        otdFilter === 'All' ||
        (otdFilter === 'KnitEndPassed' && ord.knitEndOtd === 'Passed') ||
        (otdFilter === 'KnitEndFailed' && ord.knitEndOtd === 'Failed') ||
        (otdFilter === 'KnitEndPending' && ord.knitEndOtd === 'Pending') ||
        (otdFilter === 'KnitStartPassed' && ord.knitStartOtd === 'Passed') ||
        (otdFilter === 'KnitStartFailed' && ord.knitStartOtd === 'Failed') ||
        (otdFilter === 'KnitStartPending' && ord.knitStartOtd === 'Pending') ||
        (otdFilter === 'BothPassed' && ord.knitStartOtd === 'Passed' && ord.knitEndOtd === 'Passed') ||
        (otdFilter === 'Passed' && (ord.knitStartOtd === 'Passed' || ord.knitEndOtd === 'Passed')) ||
        (otdFilter === 'Failed' && (ord.knitStartOtd === 'Failed' || ord.knitEndOtd === 'Failed')) ||
        (otdFilter === 'Pending' && (ord.knitStartOtd === 'Pending' || ord.knitEndOtd === 'Pending'));

      const matchesKnitStartSel = knitStartSelect === 'All' || isSameDateStr(ord.knitStart, knitStartSelect);
      const matchesKnitEndSel = knitEndSelect === 'All' || isSameDateStr(ord.knitEnd, knitEndSelect);

      return matchesSearch && matchesBuyer && matchesTeamLeader && matchesMonth && matchesOtd && matchesKnitStartSel && matchesKnitEndSel;
    });
  }, [orders, searchQuery, buyerFilter, teamLeaderFilter, planMonthFilter, otdFilter, knitStartSelect, knitEndSelect, userAssignedBuyers]);

  const totalPages = useMemo(() => {
    return itemsPerPage > 0 ? Math.ceil(filteredOrders.length / itemsPerPage) || 1 : 1;
  }, [filteredOrders.length, itemsPerPage]);

  const paginatedOrders = useMemo(() => {
    if (itemsPerPage <= 0) return filteredOrders;
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOrders.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOrders, currentPage, itemsPerPage]);

  // Unique lists for filters
  const teamLeadersList = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      const tl = o.knitTeamLeaders?.trim();
      if (tl) {
        set.add(tl);
      } else {
        set.add('Unassigned');
      }
    });
    return Array.from(set).sort();
  }, [orders]);

  const teamLeaderOptions = useMemo(() => {
    return teamLeadersList.map(tl => ({ label: `TL: ${tl}`, value: tl }));
  }, [teamLeadersList]);

  const buyersList = useMemo(() => {
    const set = new Set(
      orders
        .filter(o => !userAssignedBuyers || userAssignedBuyers.includes(o.buyer))
        .map(o => o.buyer)
        .filter(Boolean)
    );
    return Array.from(set);
  }, [orders, userAssignedBuyers]);

  const monthsList = useMemo(() => {
    const set = new Set(orders.map(o => o.planMonth).filter(Boolean));
    return Array.from(set);
  }, [orders]);

  const planMonthOptions = useMemo(() => {
    return monthsList.map(m => ({ label: `Month: ${m}`, value: m }));
  }, [monthsList]);

  const knitStartsList = useMemo(() => {
    const set = new Set(orders.map(o => formatDisplayDate(o.knitStart) || o.knitStart).filter(Boolean));
    return Array.from(set).sort();
  }, [orders]);

  const knitEndsList = useMemo(() => {
    const set = new Set(orders.map(o => formatDisplayDate(o.knitEnd) || o.knitEnd).filter(Boolean));
    return Array.from(set).sort();
  }, [orders]);

  const knitStartOptions = useMemo(() => {
    const yesterdayStr = getYesterdayDateString();
    const opts = knitStartsList.map(ks => ({
      label: `Knit Start: ${ks}${isSameDateStr(ks, yesterdayStr) ? ' (Yesterday)' : ''}`,
      value: ks
    }));

    const exists = knitStartsList.some(ks => isSameDateStr(ks, knitStartSelect));
    if (knitStartSelect !== 'All' && !exists) {
      opts.unshift({ 
        label: `Knit Start: ${knitStartSelect}${isSameDateStr(knitStartSelect, yesterdayStr) ? ' (Yesterday)' : ''}`, 
        value: knitStartSelect 
      });
    }
    return opts;
  }, [knitStartsList, knitStartSelect]);

  const knitEndOptions = useMemo(() => {
    return knitEndsList.map(ke => ({ label: `Knit End: ${ke}`, value: ke }));
  }, [knitEndsList]);

  const otdOptions = useMemo(() => [
    { label: 'Knit End OTD: Passed', value: 'KnitEndPassed' },
    { label: 'Knit End OTD: Failed', value: 'KnitEndFailed' },
    { label: 'Knit End OTD: Pending', value: 'KnitEndPending' },
    { label: 'Knit Start OTD: Passed', value: 'KnitStartPassed' },
    { label: 'Knit Start OTD: Failed', value: 'KnitStartFailed' },
    { label: 'Knit Start OTD: Pending', value: 'KnitStartPending' },
    { label: 'Both Start & End Passed', value: 'BothPassed' },
    { label: 'Any Passed (Start or End Passed)', value: 'Passed' },
    { label: 'Any Failed (Start or End Failed)', value: 'Failed' },
    { label: 'Any Pending (Start or End Pending)', value: 'Pending' },
  ], []);

  // KPIs dynamically respond to active filter selections
  const totalTarget = filteredOrders.reduce((sum, o) => sum + (o.target || 0), 0);
  const totalGreyReq = filteredOrders.reduce((sum, o) => sum + (o.greyReq || 0), 0);
  const totalKnitPro = filteredOrders.reduce((sum, o) => sum + (o.knitPro || 0), 0);
  const totalKnitBal = filteredOrders.reduce((sum, o) => sum + (o.knitBal || 0), 0);
  const otdPassedCount = filteredOrders.filter(
    o => o.knitStartOtd !== 'Failed' && o.knitEndOtd !== 'Failed' && (o.knitStartOtd === 'Passed' || o.knitEndOtd === 'Passed')
  ).length;
  const otdFailedCount = filteredOrders.filter(
    o => o.knitStartOtd === 'Failed' || o.knitEndOtd === 'Failed'
  ).length;
  const otdPendingCount = filteredOrders.filter(
    o => o.knitStartOtd === 'Pending' && o.knitEndOtd === 'Pending'
  ).length;
  const otdTotalCount = otdPassedCount + otdFailedCount;
  const otdRate = otdTotalCount > 0 ? Math.round((otdPassedCount / otdTotalCount) * 100) : 100;

  // Add order submission
  const handleAddOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEwo.trim() || !formColor.trim()) return;

    const targetVal = parseFloat(formTarget) || 0;
    const greyVal = parseFloat(formGreyReq) || targetVal;
    const allocVal = parseFloat(formAllocatedQty) || targetVal;

    const newEntry: OrderPlan = {
      id: `ord-${Date.now()}`,
      planMonth: formPlanMonth,
      planType: formPlanType,
      ewo: formEwo.trim(),
      buyer: formBuyer,
      color: formColor.trim(),
      knitStart: formKnitStart || '01-Jul-26',
      knitEnd: formKnitEnd || '15-Jul-26',
      target: targetVal,
      targetNextMonth: 0,
      allocationStart: '',
      allocationEnd: '',
      allocatedQty: allocVal,
      allocatedBal: 0,
      greyReq: greyVal,
      knitPro: 0,
      knitBal: greyVal,
      aKnitStart: '',
      lastProductionDate: '',
      avgProdDay: 0,
      expectedKnitEnd: '',
      knitStartOtd: 'Pending',
      knitEndOtd: 'Pending',
      knitStartRemarks: '',
      knitEndRemarks: '',
      knitTeamLeaders: ''
    };

    const updated = [newEntry, ...orders];
    setOrders(updated);
    GasClient.saveOrderPlans([newEntry]).catch(err => console.warn('GAS order plan save warning:', err));
    setShowAddModal(false);
    setFormEwo('');
    setFormColor('');
  };

  const handleOpenEditModal = (ord: OrderPlan) => {
    setEditingOrder(ord);
    setEditPlanMonth(ord.planMonth || 'July');
    setEditPlanType(ord.planType || 'Confirm');
    setEditEwo(ord.ewo || '');
    setEditBuyer(ord.buyer || '');
    setEditColor(ord.color || '');
    setEditKnitStart(ord.knitStart || '');
    setEditKnitEnd(ord.knitEnd || '');
    setEditTarget(ord.target ? ord.target.toString() : '0');
    setEditAllocationStart(ord.allocationStart || '');
    setEditAllocationEnd(ord.allocationEnd || '');
    setEditAllocatedQty(ord.allocatedQty ? ord.allocatedQty.toString() : '0');
    setEditGreyReq(ord.greyReq ? ord.greyReq.toString() : '0');
    setEditKnitPro(ord.knitPro ? ord.knitPro.toString() : '0');
    setEditAKnitStart(ord.aKnitStart || '');
    setEditLastProductionDate(ord.lastProductionDate || '');
    setEditKnitStartOtd(ord.knitStartOtd || 'Pending');
    setEditKnitEndOtd(ord.knitEndOtd || 'Pending');
    setEditKnitStartRemarks(ord.knitStartRemarks || '');
    setEditKnitEndRemarks(ord.knitEndRemarks || '');
    setEditKnitTeamLeaders(ord.knitTeamLeaders || '');
    setShowEditModal(true);
  };

  const handleSaveEditOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const updatedOrder: OrderPlan = {
      ...editingOrder,
      planMonth: editPlanMonth,
      planType: editPlanType,
      ewo: editEwo,
      buyer: editBuyer,
      color: editColor,
      knitStart: editKnitStart,
      knitEnd: editKnitEnd,
      target: parseFloat(editTarget) || 0,
      allocationStart: editAllocationStart,
      allocationEnd: editAllocationEnd,
      allocatedQty: parseFloat(editAllocatedQty) || 0,
      greyReq: parseFloat(editGreyReq) || 0,
      knitPro: parseFloat(editKnitPro) || 0,
      aKnitStart: editAKnitStart,
      lastProductionDate: editLastProductionDate,
      knitStartOtd: editKnitStartOtd,
      knitEndOtd: editKnitEndOtd,
      knitStartRemarks: editKnitStartRemarks.trim(),
      knitEndRemarks: editKnitEndRemarks.trim(),
      knitTeamLeaders: editKnitTeamLeaders.trim(),
    };

    const updatedList = orders.map(o => o.id === editingOrder.id ? updatedOrder : o);
    setOrders(updatedList);
    GasClient.saveOrderPlans([updatedOrder]).catch(err => console.warn('GAS order plan edit save warning:', err));
    setShowEditModal(false);
    setEditingOrder(null);
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this Order Plan record?')) {
      const updated = orders.filter(o => o.id !== id);
      setOrders(updated);
      try {
        await GasClient.deleteOrderPlan(id);
      } catch (err) {
        console.warn("Error deleting order plan:", err);
      }
    }
  };

  // Export to Excel (.xlsx)
  const exportToExcel = () => {
    const headers = [
      "Plan Month","Plan Type","EWO","Buyer","Color","Knit Start","Knit End",
      "Target","Target Next Month","Allocation Start","Allocation End","Allocated QTY",
      "Allocated Bal.","GREY REQ.","KNIT PRO.","KNIT BAL.","A.Knit Start",
      "Knit Start VS A. Knit Start","A. Knit End/Last Production Date","Knit End VS A. Knit End",
      "Avg Prod/Day","Expected Knit End","Knit Start OTD",
      "Knit End OTD","Knit Start Remarks","Knit End Remarks","Knit Team Leader"
    ];

    const rows = filteredOrders.map(o => {
      const startVar = calculateDateVariance(o.knitStart, o.aKnitStart);
      const endVar = calculateDateVariance(o.knitEnd, o.lastProductionDate);

      return [
        o.planMonth, o.planType, o.ewo, o.buyer, o.color, o.knitStart, o.knitEnd,
        o.target, o.targetNextMonth, o.allocationStart, o.allocationEnd, o.allocatedQty,
        o.allocatedBal, o.greyReq, o.knitPro, o.knitBal, o.aKnitStart,
        startVar.formatted, o.lastProductionDate, endVar.formatted,
        o.avgProdDay, o.expectedKnitEnd, o.knitStartOtd,
        o.knitEndOtd, o.knitStartRemarks, o.knitEndRemarks, o.knitTeamLeaders || ''
      ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Order Plan Status");
    XLSX.writeFile(workbook, `Order_Plan_Status_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-5 pb-8">
      {/* Top Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <FileSpreadsheet className="h-5 w-5" />
            </span>
            <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              Plan Order Followup & Status
            </h1>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            Real-time Order Status, Allocation Schedules, Knit Production & OTD Performance Matrix
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadOrders(true)}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-60"
            title="Force refresh data from Google Sheet"
          >
            <RefreshCw className={`h-4 w-4 text-blue-600 dark:text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
          </button>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
            id="export-excel-btn"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Target</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">{Math.round(totalTarget).toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grey Requirement</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{Math.round(totalGreyReq).toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Knit Produced</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{Math.round(totalKnitPro).toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Knit Balance</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">{Math.round(totalKnitBal).toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs" title={`OTD Breakdown out of ${filteredOrders.length} Total Orders: ${otdPassedCount} Passed, ${otdFailedCount} Failed, ${otdPendingCount} Pending`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OTD Pass Rate</span>
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md" title={`${otdTotalCount} evaluated out of ${filteredOrders.length} total orders`}>
              {otdTotalCount.toLocaleString()} / {filteredOrders.length.toLocaleString()} Orders
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{otdRate}%</span>
            <span className="text-[10px] font-bold text-slate-400">On-Time</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 flex-wrap">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{otdPassedCount.toLocaleString()} Passed</span>
            <span>•</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">{otdFailedCount.toLocaleString()} Failed</span>
            {otdPendingCount > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-600 dark:text-amber-400">{otdPendingCount.toLocaleString()} Pending</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('team_leader')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'team_leader' || activeSubTab === 'delivery'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>1. Team Leader OTD Status</span>
        </button>

        <button
          onClick={() => setActiveSubTab('buyer')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'buyer'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>2. Buyerwise OTD Status</span>
        </button>

        <button
          onClick={() => setActiveSubTab('summary')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'summary'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>3. Orderwise OTD Status</span>
        </button>
      </div>

      {/* SUB-TAB 1: TEAM LEADER OTD STATUS */}
      {(activeSubTab === 'team_leader' || activeSubTab === 'delivery') && (() => {
        const displayTeamLeaders = teamLeaderFilter === 'All'
          ? teamLeadersList
          : teamLeadersList.filter(tl => tl === teamLeaderFilter);

        const yesterdayStr = getYesterdayDateString();

        return (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Filter Toolbar inside Team Leader OTD Status */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search EWO, Buyer, Team Leader, Color, Month..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:flex xl:flex-wrap items-center gap-2 w-full lg:w-auto">
                <SearchableSelect
                  value={teamLeaderFilter}
                  onChange={setTeamLeaderFilter}
                  options={teamLeaderOptions}
                  allLabel="All Team Leaders"
                  placeholder="Search Team Leader..."
                />

                <SearchableSelect
                  value={buyerFilter}
                  onChange={setBuyerFilter}
                  options={buyersList}
                  allLabel="All Buyers"
                  placeholder="Search Buyers..."
                />

                <SearchableSelect
                  value={planMonthFilter}
                  onChange={setPlanMonthFilter}
                  options={planMonthOptions}
                  allLabel="All Plan Months"
                  placeholder="Search Month..."
                />

                <SearchableSelect
                  value={knitStartSelect}
                  onChange={setKnitStartSelect}
                  options={knitStartOptions}
                  allLabel="All Knit Start Dates"
                  placeholder="Search Knit Start..."
                />

                <SearchableSelect
                  value={knitEndSelect}
                  onChange={setKnitEndSelect}
                  options={knitEndOptions}
                  allLabel="All Knit End Dates"
                  placeholder="Search Knit End..."
                />

                <SearchableSelect
                  value={otdFilter}
                  onChange={setOtdFilter}
                  options={otdOptions}
                  allLabel="All OTD Status"
                  placeholder="Search OTD Status..."
                />

                {(searchQuery !== '' || buyerFilter !== 'All' || teamLeaderFilter !== 'All' || planMonthFilter !== 'All' || knitStartSelect !== 'All' || knitEndSelect !== 'All' || otdFilter !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setBuyerFilter('All');
                      setTeamLeaderFilter('All');
                      setPlanMonthFilter('All');
                      setKnitStartSelect('All');
                      setKnitEndSelect('All');
                      setOtdFilter('All');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs w-full sm:w-auto"
                    title="Clear all active filters"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear All Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notice banner if pre-selected Yesterday date has no matching orders */}
            {isSameDateStr(knitStartSelect, yesterdayStr) && filteredOrders.length === 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Default Knit Start Date filter applied: <strong>Yesterday ({yesterdayStr})</strong>. No orders match Yesterday in current dataset.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setKnitStartSelect('All')}
                  className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  View All Dates
                </button>
              </div>
            )}

            {/* Team Leader Cards Grid */}
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
                <Users className="h-10 w-10 text-slate-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Orders Found for Selected Filters</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  There are no orders matching your current filter criteria. Try changing the Knit Start Date filter to "All Knit Start Dates" or reset all active filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setBuyerFilter('All');
                    setTeamLeaderFilter('All');
                    setPlanMonthFilter('All');
                    setKnitStartSelect('All');
                    setKnitEndSelect('All');
                    setOtdFilter('All');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-xs"
                >
                  <X className="h-4 w-4" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {displayTeamLeaders.map(tl => {
                  const tlOrders = filteredOrders.filter(o => {
                    const leader = o.knitTeamLeaders?.trim() || 'Unassigned';
                    return leader === tl;
                  });
                  if (tlOrders.length === 0 && teamLeaderFilter === 'All') return null;

                  const totalOrders = tlOrders.length;
                  const targetQty = tlOrders.reduce((sum, o) => sum + (o.target || 0), 0);
                  const allocatedQty = tlOrders.reduce((sum, o) => sum + (o.allocatedQty || 0), 0);
                  const greyQty = tlOrders.reduce((sum, o) => sum + (o.greyReq || 0), 0);
                  const knitPro = tlOrders.reduce((sum, o) => sum + (o.knitPro || 0), 0);
                  const balance = tlOrders.reduce((sum, o) => sum + (o.knitBal || 0), 0);
                  const knitPct = targetQty > 0 ? Math.min(100, Math.round((knitPro / targetQty) * 100)) : 0;

                  // Knit Start OTD
                  const ksEval = tlOrders.filter(o => o.knitStartOtd !== 'Pending');
                  const ksPassed = tlOrders.filter(o => o.knitStartOtd === 'Passed').length;
                  const ksPassRate = ksEval.length > 0 ? Math.round((ksPassed / ksEval.length) * 100) : 100;

                  // Knit End OTD
                  const keEval = tlOrders.filter(o => o.knitEndOtd !== 'Pending');
                  const kePassed = tlOrders.filter(o => o.knitEndOtd === 'Passed').length;
                  const kePassRate = keEval.length > 0 ? Math.round((kePassed / keEval.length) * 100) : 100;

                  // Pending Order Count
                  const pendingOrdersCount = tlOrders.filter(
                    o => o.knitStartOtd === 'Pending' || o.knitEndOtd === 'Pending'
                  ).length;

                  // Overall Failed Orders & Rate
                  const totalFailedOrders = tlOrders.filter(
                    o => o.knitStartOtd === 'Failed' || o.knitEndOtd === 'Failed'
                  );
                  const totalFailedCount = totalFailedOrders.length;
                  const totalEvalCount = tlOrders.filter(
                    o => o.knitStartOtd !== 'Pending' || o.knitEndOtd !== 'Pending'
                  ).length;
                  const failedRate = totalEvalCount > 0
                    ? Math.round((totalFailedCount / totalEvalCount) * 100)
                    : (totalOrders > 0 ? Math.round((totalFailedCount / totalOrders) * 100) : 0);

                  // Extract Major Reason for Failing
                  const failureReasonsMap: Record<string, number> = {};
                  totalFailedOrders.forEach(o => {
                    const remarks = [o.knitStartRemarks, o.knitEndRemarks].filter(r => r && r.trim().length > 0);
                    if (remarks.length === 0) {
                      failureReasonsMap['Delay Reason Pending Review'] = (failureReasonsMap['Delay Reason Pending Review'] || 0) + 1;
                    } else {
                      remarks.forEach(r => {
                        const cleaned = r.trim();
                        failureReasonsMap[cleaned] = (failureReasonsMap[cleaned] || 0) + 1;
                      });
                    }
                  });

                  const sortedReasons = Object.entries(failureReasonsMap).sort((x, y) => y[1] - x[1]);
                  const majorReason = sortedReasons.length > 0
                    ? `${sortedReasons[0][0]} (${sortedReasons[0][1]} order${sortedReasons[0][1] > 1 ? 's' : ''})`
                    : 'No Failures (100% On-Time)';

                  return (
                    <div key={tl} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                      {/* Team Leader Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">Team Leader: {tl}</h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              Total Orders in Plan: <strong className="text-slate-900 dark:text-white font-bold">{totalOrders.toLocaleString()} Orders</strong>
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Production Completion</span>
                          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{knitPct}%</span>
                        </div>
                      </div>

                      {/* Quantities Breakdown Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Target QTY</span>
                          <span className="text-xs font-black text-slate-900 dark:text-white block">{targetQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Allocated QTY</span>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block">{allocatedQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Grey QTY</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">{greyQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Knit Prod.</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">{knitPro.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Balance QTY</span>
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400 block">{balance.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>Knitted: {knitPro.toLocaleString()} Kg</span>
                          <span>Target: {targetQty.toLocaleString()} Kg</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 transition-all duration-300" 
                            style={{ width: `${knitPct}%` }} 
                          />
                        </div>
                      </div>

                      {/* OTD Performance Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {/* Knit Start OTD */}
                        <div className="p-2.5 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Knit Start OTD</span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{ksPassRate}%</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded-md">
                              {ksPassed}/{ksEval.length} Passed
                            </span>
                          </div>
                        </div>

                        {/* Knit End OTD */}
                        <div className="p-2.5 rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20">
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Knit End OTD</span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-black text-blue-700 dark:text-blue-300">{kePassRate}%</span>
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded-md">
                              {kePassed}/{keEval.length} Passed
                            </span>
                          </div>
                        </div>

                        {/* Failed & Pending Summary */}
                        <div className="p-2.5 rounded-xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">OTD Failed Rate</span>
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              {pendingOrdersCount} Pending
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-black text-rose-700 dark:text-rose-300">{failedRate}%</span>
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded-md">
                              {totalFailedCount} Failed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Major Reason for Failing */}
                      <div className="p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 flex items-start gap-2 text-xs">
                        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Major Reason for Failing</span>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={majorReason}>
                            {majorReason}
                          </p>
                        </div>
                      </div>

                      {/* Footer Row */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>{tlOrders.length} matching order rows</span>
                        <button
                          type="button"
                          className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          onClick={() => {
                            setTeamLeaderFilter(tl);
                            setActiveSubTab('summary');
                          }}
                        >
                          View Orderwise Rows →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* SUB-TAB 2: BUYERWISE OTD STATUS */}
      {activeSubTab === 'buyer' && (() => {
        const displayBuyers = buyerFilter === 'All'
          ? buyersList
          : buyersList.filter(b => b === buyerFilter);

        const yesterdayStr = getYesterdayDateString();

        return (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Filter Toolbar inside Buyerwise OTD Status */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="relative w-full lg:max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search EWO, Buyer, Team Leader, Color, Month..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:flex xl:flex-wrap items-center gap-2 w-full lg:w-auto">
                <SearchableSelect
                  value={teamLeaderFilter}
                  onChange={setTeamLeaderFilter}
                  options={teamLeaderOptions}
                  allLabel="All Team Leaders"
                  placeholder="Search Team Leader..."
                />

                <SearchableSelect
                  value={buyerFilter}
                  onChange={setBuyerFilter}
                  options={buyersList}
                  allLabel="All Buyers"
                  placeholder="Search Buyers..."
                />

                <SearchableSelect
                  value={planMonthFilter}
                  onChange={setPlanMonthFilter}
                  options={planMonthOptions}
                  allLabel="All Plan Months"
                  placeholder="Search Month..."
                />

                <SearchableSelect
                  value={knitStartSelect}
                  onChange={setKnitStartSelect}
                  options={knitStartOptions}
                  allLabel="All Knit Start Dates"
                  placeholder="Search Knit Start..."
                />

                <SearchableSelect
                  value={knitEndSelect}
                  onChange={setKnitEndSelect}
                  options={knitEndOptions}
                  allLabel="All Knit End Dates"
                  placeholder="Search Knit End..."
                />

                <SearchableSelect
                  value={otdFilter}
                  onChange={setOtdFilter}
                  options={otdOptions}
                  allLabel="All OTD Status"
                  placeholder="Search OTD Status..."
                />

                {(searchQuery !== '' || buyerFilter !== 'All' || teamLeaderFilter !== 'All' || planMonthFilter !== 'All' || knitStartSelect !== 'All' || knitEndSelect !== 'All' || otdFilter !== 'All') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setBuyerFilter('All');
                      setTeamLeaderFilter('All');
                      setPlanMonthFilter('All');
                      setKnitStartSelect('All');
                      setKnitEndSelect('All');
                      setOtdFilter('All');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs w-full sm:w-auto"
                    title="Clear all active filters"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Clear All Filters</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notice banner if pre-selected Yesterday date has no matching orders */}
            {isSameDateStr(knitStartSelect, yesterdayStr) && filteredOrders.length === 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>
                    Default Knit Start Date filter applied: <strong>Yesterday ({yesterdayStr})</strong>. No orders match Yesterday in current dataset.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setKnitStartSelect('All')}
                  className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all cursor-pointer shadow-2xs"
                >
                  View All Dates
                </button>
              </div>
            )}

            {/* Buyer Cards Grid */}
            {filteredOrders.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
                <Target className="h-10 w-10 text-slate-400 mx-auto" />
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">No Orders Found for Selected Filters</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  There are no orders matching your current filter criteria. Try changing the Knit Start Date filter to "All Knit Start Dates" or reset all active filters.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setBuyerFilter('All');
                    setTeamLeaderFilter('All');
                    setPlanMonthFilter('All');
                    setKnitStartSelect('All');
                    setKnitEndSelect('All');
                    setOtdFilter('All');
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all cursor-pointer shadow-xs"
                >
                  <X className="h-4 w-4" />
                  <span>Reset All Filters</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {displayBuyers.map(b => {
                  const buyerOrders = filteredOrders.filter(o => o.buyer === b);
                  if (buyerOrders.length === 0 && buyerFilter === 'All') return null;

                  const totalOrders = buyerOrders.length;
                  const targetQty = buyerOrders.reduce((sum, o) => sum + (o.target || 0), 0);
                  const allocatedQty = buyerOrders.reduce((sum, o) => sum + (o.allocatedQty || 0), 0);
                  const greyQty = buyerOrders.reduce((sum, o) => sum + (o.greyReq || 0), 0);
                  const knitPro = buyerOrders.reduce((sum, o) => sum + (o.knitPro || 0), 0);
                  const balance = buyerOrders.reduce((sum, o) => sum + (o.knitBal || 0), 0);
                  const knitPct = targetQty > 0 ? Math.min(100, Math.round((knitPro / targetQty) * 100)) : 0;

                  // Knit Start OTD
                  const ksEval = buyerOrders.filter(o => o.knitStartOtd !== 'Pending');
                  const ksPassed = buyerOrders.filter(o => o.knitStartOtd === 'Passed').length;
                  const ksPassRate = ksEval.length > 0 ? Math.round((ksPassed / ksEval.length) * 100) : 100;

                  // Knit End OTD
                  const keEval = buyerOrders.filter(o => o.knitEndOtd !== 'Pending');
                  const kePassed = buyerOrders.filter(o => o.knitEndOtd === 'Passed').length;
                  const kePassRate = keEval.length > 0 ? Math.round((kePassed / keEval.length) * 100) : 100;

                  // Pending Order Count
                  const pendingOrdersCount = buyerOrders.filter(
                    o => o.knitStartOtd === 'Pending' || o.knitEndOtd === 'Pending'
                  ).length;

                  // Overall Failed Orders & Rate
                  const totalFailedOrders = buyerOrders.filter(
                    o => o.knitStartOtd === 'Failed' || o.knitEndOtd === 'Failed'
                  );
                  const totalFailedCount = totalFailedOrders.length;
                  const totalEvalCount = buyerOrders.filter(
                    o => o.knitStartOtd !== 'Pending' || o.knitEndOtd !== 'Pending'
                  ).length;
                  const failedRate = totalEvalCount > 0
                    ? Math.round((totalFailedCount / totalEvalCount) * 100)
                    : (totalOrders > 0 ? Math.round((totalFailedCount / totalOrders) * 100) : 0);

                  // Extract Major Reason for Failing
                  const failureReasonsMap: Record<string, number> = {};
                  totalFailedOrders.forEach(o => {
                    const remarks = [o.knitStartRemarks, o.knitEndRemarks].filter(r => r && r.trim().length > 0);
                    if (remarks.length === 0) {
                      failureReasonsMap['Delay Reason Pending Review'] = (failureReasonsMap['Delay Reason Pending Review'] || 0) + 1;
                    } else {
                      remarks.forEach(r => {
                        const cleaned = r.trim();
                        failureReasonsMap[cleaned] = (failureReasonsMap[cleaned] || 0) + 1;
                      });
                    }
                  });

                  const sortedReasons = Object.entries(failureReasonsMap).sort((x, y) => y[1] - x[1]);
                  const majorReason = sortedReasons.length > 0
                    ? `${sortedReasons[0][0]} (${sortedReasons[0][1]} order${sortedReasons[0][1] > 1 ? 's' : ''})`
                    : 'No Failures (100% On-Time)';

                  return (
                    <div key={b} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                      {/* Buyer Header */}
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold">
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">{b}</h3>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                              Total Orders in Plan: <strong className="text-slate-900 dark:text-white font-bold">{totalOrders.toLocaleString()} Orders</strong>
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Production Completion</span>
                          <span className="text-xl font-black text-blue-600 dark:text-blue-400">{knitPct}%</span>
                        </div>
                      </div>

                      {/* Quantities Breakdown Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 bg-slate-50/80 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Target QTY</span>
                          <span className="text-xs font-black text-slate-900 dark:text-white block">{targetQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Allocated QTY</span>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 block">{allocatedQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Grey QTY</span>
                          <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">{greyQty.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Knit Prod.</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">{knitPro.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">Balance QTY</span>
                          <span className="text-xs font-black text-amber-600 dark:text-amber-400 block">{balance.toLocaleString()} <span className="text-[9px] font-normal text-slate-400">Kg</span></span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          <span>Knitted: {knitPro.toLocaleString()} Kg</span>
                          <span>Target: {targetQty.toLocaleString()} Kg</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div 
                            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300" 
                            style={{ width: `${knitPct}%` }} 
                          />
                        </div>
                      </div>

                      {/* OTD Performance Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        {/* Knit Start OTD */}
                        <div className="p-2.5 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Knit Start OTD</span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-black text-emerald-700 dark:text-emerald-300">{ksPassRate}%</span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded-md">
                              {ksPassed}/{ksEval.length} Passed
                            </span>
                          </div>
                        </div>

                        {/* Knit End OTD */}
                        <div className="p-2.5 rounded-xl border border-blue-200/70 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20">
                          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Knit End OTD</span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-black text-blue-700 dark:text-blue-300">{kePassRate}%</span>
                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.5 rounded-md">
                              {kePassed}/{keEval.length} Passed
                            </span>
                          </div>
                        </div>

                        {/* Failed & Pending Summary */}
                        <div className="p-2.5 rounded-xl border border-rose-200/70 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">OTD Failed Rate</span>
                            <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              {pendingOrdersCount} Pending
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-base font-black text-rose-700 dark:text-rose-300">{failedRate}%</span>
                            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded-md">
                              {totalFailedCount} Failed
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Major Reason for Failing */}
                      <div className="p-2.5 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/10 flex items-start gap-2 text-xs">
                        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Major Reason for Failing</span>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={majorReason}>
                            {majorReason}
                          </p>
                        </div>
                      </div>

                      {/* Footer Row */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-medium">
                        <span>{buyerOrders.length} matching order rows</span>
                        <button
                          type="button"
                          className="text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          onClick={() => {
                            setBuyerFilter(b);
                            setActiveSubTab('summary');
                          }}
                        >
                          View Orderwise Rows →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* SUB-TAB 3: ORDERWISE OTD STATUS */}
      {activeSubTab === 'summary' && (
        <div className="space-y-3">
          {/* Controls toolbar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search EWO, Buyer, Team Leader, Color, Month..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:flex xl:flex-wrap items-center gap-2 w-full lg:w-auto">
              <SearchableSelect
                value={teamLeaderFilter}
                onChange={setTeamLeaderFilter}
                options={teamLeaderOptions}
                allLabel="All Team Leaders"
                placeholder="Search Team Leader..."
              />

              <SearchableSelect
                value={buyerFilter}
                onChange={setBuyerFilter}
                options={buyersList}
                allLabel="All Buyers"
                placeholder="Search Buyers..."
              />

              <SearchableSelect
                value={planMonthFilter}
                onChange={setPlanMonthFilter}
                options={planMonthOptions}
                allLabel="All Plan Months"
                placeholder="Search Month..."
              />

              <SearchableSelect
                value={knitStartSelect}
                onChange={setKnitStartSelect}
                options={knitStartOptions}
                allLabel="All Knit Start Dates"
                placeholder="Search Knit Start..."
              />

              <SearchableSelect
                value={knitEndSelect}
                onChange={setKnitEndSelect}
                options={knitEndOptions}
                allLabel="All Knit End Dates"
                placeholder="Search Knit End..."
              />

              <SearchableSelect
                value={otdFilter}
                onChange={setOtdFilter}
                options={otdOptions}
                allLabel="All OTD Status"
                placeholder="Search OTD Status..."
              />

              <ColumnCustomizerDropdown
                tableId="plan_order_followup"
                columns={PLAN_ORDER_COLUMNS}
                hiddenColumns={hiddenColumns}
                onToggleColumn={toggleColumn}
                onResetColumns={resetColumns}
                isFrozen={isFrozen}
                freezeCount={freezeCount}
                onToggleFreeze={toggleFreeze}
                onSetFreezeCount={setFreezeCount}
              />

              {(searchQuery !== '' || buyerFilter !== 'All' || teamLeaderFilter !== 'All' || planMonthFilter !== 'All' || knitStartSelect !== 'All' || knitEndSelect !== 'All' || otdFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setBuyerFilter('All');
                    setTeamLeaderFilter('All');
                    setPlanMonthFilter('All');
                    setKnitStartSelect('All');
                    setKnitEndSelect('All');
                    setOtdFilter('All');
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs w-full sm:w-auto"
                  title="Clear all active filters"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Clear All Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* MODERN WEB APPLICATION DASHBOARD TABLE DESIGN */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[2500px]">
                <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800">
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/80 dark:border-slate-800">
                    {isColVisible('planMonth') && (
                      <ResizableTh width={getColWidth('planMonth')} onWidthChange={(w) => setColumnWidth('planMonth', w)} isSticky={isColFrozen('planMonth')} stickyLeft={getStickyLeft('planMonth')} isLastFrozen={'planMonth' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Plan Month</ResizableTh>
                    )}
                    {isColVisible('planType') && (
                      <ResizableTh width={getColWidth('planType')} onWidthChange={(w) => setColumnWidth('planType', w)} isSticky={isColFrozen('planType')} stickyLeft={getStickyLeft('planType')} isLastFrozen={'planType' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Plan Type</ResizableTh>
                    )}
                    {isColVisible('ewo') && (
                      <ResizableTh width={getColWidth('ewo')} onWidthChange={(w) => setColumnWidth('ewo', w)} isSticky={isColFrozen('ewo')} stickyLeft={getStickyLeft('ewo')} isLastFrozen={'ewo' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-center">EWO</ResizableTh>
                    )}
                    {isColVisible('buyer') && (
                      <ResizableTh width={getColWidth('buyer')} onWidthChange={(w) => setColumnWidth('buyer', w)} isSticky={isColFrozen('buyer')} stickyLeft={getStickyLeft('buyer')} isLastFrozen={'buyer' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Buyer</ResizableTh>
                    )}
                    {isColVisible('color') && (
                      <ResizableTh width={getColWidth('color')} onWidthChange={(w) => setColumnWidth('color', w)} isSticky={isColFrozen('color')} stickyLeft={getStickyLeft('color')} isLastFrozen={'color' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Color</ResizableTh>
                    )}
                    {isColVisible('knitStart') && (
                      <ResizableTh width={getColWidth('knitStart')} onWidthChange={(w) => setColumnWidth('knitStart', w)} isSticky={isColFrozen('knitStart')} stickyLeft={getStickyLeft('knitStart')} isLastFrozen={'knitStart' === lastFrozenColId} className={`px-3.5 py-3.5 whitespace-nowrap transition-colors ${
                        knitStartSelect !== 'All'
                          ? 'bg-blue-200/80 dark:bg-blue-900/60 text-blue-900 dark:text-blue-100 font-black'
                          : ''
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <span>Knit Start</span>
                          {knitStartSelect !== 'All' && (
                            <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" title="Knit Start Filter Active" />
                          )}
                        </div>
                      </ResizableTh>
                    )}
                    {isColVisible('knitEnd') && (
                      <ResizableTh width={getColWidth('knitEnd')} onWidthChange={(w) => setColumnWidth('knitEnd', w)} isSticky={isColFrozen('knitEnd')} stickyLeft={getStickyLeft('knitEnd')} isLastFrozen={'knitEnd' === lastFrozenColId} className={`px-3.5 py-3.5 whitespace-nowrap transition-colors ${
                        knitEndSelect !== 'All'
                          ? 'bg-indigo-200/80 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-100 font-black'
                          : ''
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <span>Knit End</span>
                          {knitEndSelect !== 'All' && (
                            <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse" title="Knit End Filter Active" />
                          )}
                        </div>
                      </ResizableTh>
                    )}
                    {isColVisible('target') && (
                      <ResizableTh width={getColWidth('target')} onWidthChange={(w) => setColumnWidth('target', w)} isSticky={isColFrozen('target')} stickyLeft={getStickyLeft('target')} isLastFrozen={'target' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">Target (Kg)</ResizableTh>
                    )}
                    {isColVisible('targetNextMonth') && (
                      <ResizableTh width={getColWidth('targetNextMonth')} onWidthChange={(w) => setColumnWidth('targetNextMonth', w)} isSticky={isColFrozen('targetNextMonth')} stickyLeft={getStickyLeft('targetNextMonth')} isLastFrozen={'targetNextMonth' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">Target Next Month</ResizableTh>
                    )}
                    {isColVisible('allocationStart') && (
                      <ResizableTh width={getColWidth('allocationStart')} onWidthChange={(w) => setColumnWidth('allocationStart', w)} isSticky={isColFrozen('allocationStart')} stickyLeft={getStickyLeft('allocationStart')} isLastFrozen={'allocationStart' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Allocation Start</ResizableTh>
                    )}
                    {isColVisible('allocationEnd') && (
                      <ResizableTh width={getColWidth('allocationEnd')} onWidthChange={(w) => setColumnWidth('allocationEnd', w)} isSticky={isColFrozen('allocationEnd')} stickyLeft={getStickyLeft('allocationEnd')} isLastFrozen={'allocationEnd' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Allocation End</ResizableTh>
                    )}
                    {isColVisible('allocatedQty') && (
                      <ResizableTh width={getColWidth('allocatedQty')} onWidthChange={(w) => setColumnWidth('allocatedQty', w)} isSticky={isColFrozen('allocatedQty')} stickyLeft={getStickyLeft('allocatedQty')} isLastFrozen={'allocatedQty' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">Allocated QTY</ResizableTh>
                    )}
                    {isColVisible('allocatedBal') && (
                      <ResizableTh width={getColWidth('allocatedBal')} onWidthChange={(w) => setColumnWidth('allocatedBal', w)} isSticky={isColFrozen('allocatedBal')} stickyLeft={getStickyLeft('allocatedBal')} isLastFrozen={'allocatedBal' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">Allocated Bal.</ResizableTh>
                    )}
                    {isColVisible('greyReq') && (
                      <ResizableTh width={getColWidth('greyReq')} onWidthChange={(w) => setColumnWidth('greyReq', w)} isSticky={isColFrozen('greyReq')} stickyLeft={getStickyLeft('greyReq')} isLastFrozen={'greyReq' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">GREY REQ.</ResizableTh>
                    )}
                    {isColVisible('knitPro') && (
                      <ResizableTh width={getColWidth('knitPro')} onWidthChange={(w) => setColumnWidth('knitPro', w)} isSticky={isColFrozen('knitPro')} stickyLeft={getStickyLeft('knitPro')} isLastFrozen={'knitPro' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">KNIT PRO.</ResizableTh>
                    )}
                    {isColVisible('knitBal') && (
                      <ResizableTh width={getColWidth('knitBal')} onWidthChange={(w) => setColumnWidth('knitBal', w)} isSticky={isColFrozen('knitBal')} stickyLeft={getStickyLeft('knitBal')} isLastFrozen={'knitBal' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">KNIT BAL.</ResizableTh>
                    )}
                    {isColVisible('aKnitStart') && (
                      <ResizableTh width={getColWidth('aKnitStart')} onWidthChange={(w) => setColumnWidth('aKnitStart', w)} isSticky={isColFrozen('aKnitStart')} stickyLeft={getStickyLeft('aKnitStart')} isLastFrozen={'aKnitStart' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">A.Knit Start</ResizableTh>
                    )}
                    {isColVisible('startVariance') && (
                      <ResizableTh width={getColWidth('startVariance')} onWidthChange={(w) => setColumnWidth('startVariance', w)} isSticky={isColFrozen('startVariance')} stickyLeft={getStickyLeft('startVariance')} isLastFrozen={'startVariance' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                        <div className="flex flex-col items-center">
                          <span>Knit Start VS A. Knit Start</span>
                          <span className="text-[9px] font-normal normal-case text-blue-500 dark:text-blue-400">(Knit Start - A. Knit Start)</span>
                        </div>
                      </ResizableTh>
                    )}
                    {isColVisible('lastProductionDate') && (
                      <ResizableTh width={getColWidth('lastProductionDate')} onWidthChange={(w) => setColumnWidth('lastProductionDate', w)} isSticky={isColFrozen('lastProductionDate')} stickyLeft={getStickyLeft('lastProductionDate')} isLastFrozen={'lastProductionDate' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">A. Knit End/Last Production Date</ResizableTh>
                    )}
                    {isColVisible('endVariance') && (
                      <ResizableTh width={getColWidth('endVariance')} onWidthChange={(w) => setColumnWidth('endVariance', w)} isSticky={isColFrozen('endVariance')} stickyLeft={getStickyLeft('endVariance')} isLastFrozen={'endVariance' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-center bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300">
                        <div className="flex flex-col items-center">
                          <span>Knit End VS A. Knit End</span>
                          <span className="text-[9px] font-normal normal-case text-indigo-500 dark:text-indigo-400">(Knit End - A. Knit End)</span>
                        </div>
                      </ResizableTh>
                    )}
                    {isColVisible('avgProdDay') && (
                      <ResizableTh width={getColWidth('avgProdDay')} onWidthChange={(w) => setColumnWidth('avgProdDay', w)} isSticky={isColFrozen('avgProdDay')} stickyLeft={getStickyLeft('avgProdDay')} isLastFrozen={'avgProdDay' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-right">Avg Prod/Day</ResizableTh>
                    )}
                    {isColVisible('expectedKnitEnd') && (
                      <ResizableTh width={getColWidth('expectedKnitEnd')} onWidthChange={(w) => setColumnWidth('expectedKnitEnd', w)} isSticky={isColFrozen('expectedKnitEnd')} stickyLeft={getStickyLeft('expectedKnitEnd')} isLastFrozen={'expectedKnitEnd' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Expected Knit End</ResizableTh>
                    )}
                    {isColVisible('knitStartOTD') && (
                      <ResizableTh width={getColWidth('knitStartOTD')} onWidthChange={(w) => setColumnWidth('knitStartOTD', w)} isSticky={isColFrozen('knitStartOTD')} stickyLeft={getStickyLeft('knitStartOTD')} isLastFrozen={'knitStartOTD' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-x border-slate-200/60 dark:border-slate-700/60 font-bold">Knit Start OTD</ResizableTh>
                    )}
                    {isColVisible('knitEndOTD') && (
                      <ResizableTh width={getColWidth('knitEndOTD')} onWidthChange={(w) => setColumnWidth('knitEndOTD', w)} isSticky={isColFrozen('knitEndOTD')} stickyLeft={getStickyLeft('knitEndOTD')} isLastFrozen={'knitEndOTD' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-x border-slate-200/60 dark:border-slate-700/60 font-bold">Knit End OTD</ResizableTh>
                    )}
                    {isColVisible('knitStartRemarks') && (
                      <ResizableTh width={getColWidth('knitStartRemarks')} onWidthChange={(w) => setColumnWidth('knitStartRemarks', w)} isSticky={isColFrozen('knitStartRemarks')} stickyLeft={getStickyLeft('knitStartRemarks')} isLastFrozen={'knitStartRemarks' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Knit Start Remarks</ResizableTh>
                    )}
                    {isColVisible('knitEndRemarks') && (
                      <ResizableTh width={getColWidth('knitEndRemarks')} onWidthChange={(w) => setColumnWidth('knitEndRemarks', w)} isSticky={isColFrozen('knitEndRemarks')} stickyLeft={getStickyLeft('knitEndRemarks')} isLastFrozen={'knitEndRemarks' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Knit End Remarks</ResizableTh>
                    )}
                    {isColVisible('knitTeamLeaders') && (
                      <ResizableTh width={getColWidth('knitTeamLeaders')} onWidthChange={(w) => setColumnWidth('knitTeamLeaders', w)} isSticky={isColFrozen('knitTeamLeaders')} stickyLeft={getStickyLeft('knitTeamLeaders')} isLastFrozen={'knitTeamLeaders' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap">Knit Team Leader</ResizableTh>
                    )}
                    {isColVisible('action') && (
                      <ResizableTh width={getColWidth('action')} onWidthChange={(w) => setColumnWidth('action', w)} isSticky={isColFrozen('action')} stickyLeft={getStickyLeft('action')} isLastFrozen={'action' === lastFrozenColId} className="px-3.5 py-3.5 whitespace-nowrap text-center">Action</ResizableTh>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={28} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No order plans match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map(ord => {
                      const startVar = calculateDateVariance(ord.knitStart, ord.aKnitStart);
                      const endVar = calculateDateVariance(ord.knitEnd, ord.lastProductionDate);

                      return (
                        <tr key={ord.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                          {isColVisible('planMonth') && (
                            <td style={{ width: `${getColWidth('planMonth')}px`, minWidth: `${getColWidth('planMonth')}px`, maxWidth: `${getColWidth('planMonth')}px`, ...getStickyStyle('planMonth') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap ${getStickyClass('planMonth')}`}>
                              <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] inline-block">
                                {ord.planMonth}
                              </span>
                            </td>
                          )}
                          {isColVisible('planType') && (
                            <td style={{ width: `${getColWidth('planType')}px`, minWidth: `${getColWidth('planType')}px`, maxWidth: `${getColWidth('planType')}px`, ...getStickyStyle('planType') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap ${getStickyClass('planType')}`}>
                              <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                                ord.planType === 'Confirm' 
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50' 
                                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50'
                              }`}>
                                {ord.planType}
                              </span>
                            </td>
                          )}
                          {isColVisible('ewo') && (
                            <td style={{ width: `${getColWidth('ewo')}px`, minWidth: `${getColWidth('ewo')}px`, maxWidth: `${getColWidth('ewo')}px`, ...getStickyStyle('ewo') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center ${getStickyClass('ewo')}`}>
                              <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 inline-block shadow-2xs">
                                {ord.ewo}
                              </span>
                            </td>
                          )}
                          {isColVisible('buyer') && (
                            <td style={{ width: `${getColWidth('buyer')}px`, minWidth: `${getColWidth('buyer')}px`, maxWidth: `${getColWidth('buyer')}px`, ...getStickyStyle('buyer') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 break-words font-semibold text-slate-900 dark:text-white overflow-hidden ${getStickyClass('buyer')}`}>
                              {ord.buyer}
                            </td>
                          )}
                          {isColVisible('color') && (
                            <td style={{ width: `${getColWidth('color')}px`, minWidth: `${getColWidth('color')}px`, maxWidth: `${getColWidth('color')}px`, ...getStickyStyle('color') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden ${getStickyClass('color')}`}>
                              <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 px-2.5 py-1 rounded-lg text-xs block w-full max-w-full break-words whitespace-normal">
                                {ord.color}
                              </span>
                            </td>
                          )}
                          {isColVisible('knitStart') && (
                            <td style={{ width: `${getColWidth('knitStart')}px`, minWidth: `${getColWidth('knitStart')}px`, maxWidth: `${getColWidth('knitStart')}px`, ...getStickyStyle('knitStart') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-300 font-semibold ${getStickyClass('knitStart')}`}>{formatDisplayDate(ord.knitStart)}</td>
                          )}
                          {isColVisible('knitEnd') && (
                            <td style={{ width: `${getColWidth('knitEnd')}px`, minWidth: `${getColWidth('knitEnd')}px`, maxWidth: `${getColWidth('knitEnd')}px`, ...getStickyStyle('knitEnd') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-300 font-semibold ${getStickyClass('knitEnd')}`}>{formatDisplayDate(ord.knitEnd)}</td>
                          )}
                          {isColVisible('target') && (
                            <td style={{ width: `${getColWidth('target')}px`, minWidth: `${getColWidth('target')}px`, maxWidth: `${getColWidth('target')}px`, ...getStickyStyle('target') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-extrabold text-slate-900 dark:text-white ${getStickyClass('target')}`}>
                              {ord.target.toLocaleString()}
                            </td>
                          )}
                          {isColVisible('targetNextMonth') && (
                            <td style={{ width: `${getColWidth('targetNextMonth')}px`, minWidth: `${getColWidth('targetNextMonth')}px`, maxWidth: `${getColWidth('targetNextMonth')}px`, ...getStickyStyle('targetNextMonth') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right text-slate-500 ${getStickyClass('targetNextMonth')}`}>{ord.targetNextMonth}</td>
                          )}
                          {isColVisible('allocationStart') && (
                            <td style={{ width: `${getColWidth('allocationStart')}px`, minWidth: `${getColWidth('allocationStart')}px`, maxWidth: `${getColWidth('allocationStart')}px`, ...getStickyStyle('allocationStart') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-400 ${getStickyClass('allocationStart')}`}>{formatDisplayDate(ord.allocationStart)}</td>
                          )}
                          {isColVisible('allocationEnd') && (
                            <td style={{ width: `${getColWidth('allocationEnd')}px`, minWidth: `${getColWidth('allocationEnd')}px`, maxWidth: `${getColWidth('allocationEnd')}px`, ...getStickyStyle('allocationEnd') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-400 ${getStickyClass('allocationEnd')}`}>{formatDisplayDate(ord.allocationEnd)}</td>
                          )}
                          {isColVisible('allocatedQty') && (
                            <td style={{ width: `${getColWidth('allocatedQty')}px`, minWidth: `${getColWidth('allocatedQty')}px`, maxWidth: `${getColWidth('allocatedQty')}px`, ...getStickyStyle('allocatedQty') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-semibold text-slate-700 dark:text-slate-300 ${getStickyClass('allocatedQty')}`}>
                              {ord.allocatedQty ? ord.allocatedQty.toLocaleString() : '-'}
                            </td>
                          )}
                          {isColVisible('allocatedBal') && (
                            <td style={{ width: `${getColWidth('allocatedBal')}px`, minWidth: `${getColWidth('allocatedBal')}px`, maxWidth: `${getColWidth('allocatedBal')}px`, ...getStickyStyle('allocatedBal') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right text-slate-500 ${getStickyClass('allocatedBal')}`}>{ord.allocatedBal}</td>
                          )}
                          {isColVisible('greyReq') && (
                            <td style={{ width: `${getColWidth('greyReq')}px`, minWidth: `${getColWidth('greyReq')}px`, maxWidth: `${getColWidth('greyReq')}px`, ...getStickyStyle('greyReq') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-extrabold text-slate-900 dark:text-slate-100 ${getStickyClass('greyReq')}`}>
                              {ord.greyReq ? ord.greyReq.toLocaleString() : '-'}
                            </td>
                          )}
                          {isColVisible('knitPro') && (
                            <td style={{ width: `${getColWidth('knitPro')}px`, minWidth: `${getColWidth('knitPro')}px`, maxWidth: `${getColWidth('knitPro')}px`, ...getStickyStyle('knitPro') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right ${getStickyClass('knitPro')}`}>
                              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 px-2.5 py-1 rounded-lg inline-block">
                                {ord.knitPro ? ord.knitPro.toLocaleString() : '0'}
                              </span>
                            </td>
                          )}
                          {isColVisible('knitBal') && (
                            <td style={{ width: `${getColWidth('knitBal')}px`, minWidth: `${getColWidth('knitBal')}px`, maxWidth: `${getColWidth('knitBal')}px`, ...getStickyStyle('knitBal') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right ${getStickyClass('knitBal')}`}>
                              <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/50 px-2.5 py-1 rounded-lg inline-block">
                                {ord.knitBal ? ord.knitBal.toLocaleString() : '-'}
                              </span>
                            </td>
                          )}
                          {isColVisible('aKnitStart') && (
                            <td style={{ width: `${getColWidth('aKnitStart')}px`, minWidth: `${getColWidth('aKnitStart')}px`, maxWidth: `${getColWidth('aKnitStart')}px`, ...getStickyStyle('aKnitStart') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium ${getStickyClass('aKnitStart')}`}>
                              {formatDisplayDate(ord.aKnitStart)}
                            </td>
                          )}
                          {isColVisible('startVariance') && (
                            <td style={{ width: `${getColWidth('startVariance')}px`, minWidth: `${getColWidth('startVariance')}px`, maxWidth: `${getColWidth('startVariance')}px`, ...getStickyStyle('startVariance') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center bg-blue-50/20 dark:bg-blue-950/10 ${getStickyClass('startVariance')}`}>
                              {startVar.status === 'early' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-0.5 text-[11px] font-extrabold shadow-2xs">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  {startVar.formatted}
                                </span>
                              )}
                              {startVar.status === 'delay' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 px-2.5 py-0.5 text-[11px] font-extrabold shadow-2xs">
                                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                  {startVar.formatted}
                                </span>
                              )}
                              {startVar.status === 'ontime' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 px-2.5 py-0.5 text-[11px] font-extrabold shadow-2xs">
                                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                                  0 Days
                                </span>
                              )}
                              {startVar.status === 'none' && <span className="text-slate-400 font-normal">-</span>}
                            </td>
                          )}
                          {isColVisible('lastProductionDate') && (
                            <td style={{ width: `${getColWidth('lastProductionDate')}px`, minWidth: `${getColWidth('lastProductionDate')}px`, maxWidth: `${getColWidth('lastProductionDate')}px`, ...getStickyStyle('lastProductionDate') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium ${getStickyClass('lastProductionDate')}`}>
                              {formatDisplayDate(ord.lastProductionDate)}
                            </td>
                          )}
                          {isColVisible('endVariance') && (
                            <td style={{ width: `${getColWidth('endVariance')}px`, minWidth: `${getColWidth('endVariance')}px`, maxWidth: `${getColWidth('endVariance')}px`, ...getStickyStyle('endVariance') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center bg-indigo-50/20 dark:bg-indigo-950/10 ${getStickyClass('endVariance')}`}>
                              {endVar.status === 'early' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 px-2.5 py-0.5 text-[11px] font-extrabold shadow-2xs">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  {endVar.formatted}
                                </span>
                              )}
                              {endVar.status === 'delay' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60 px-2.5 py-0.5 text-[11px] font-extrabold shadow-2xs">
                                  <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />
                                  {endVar.formatted}
                                </span>
                              )}
                              {endVar.status === 'ontime' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60 px-2.5 py-0.5 text-[11px] font-extrabold shadow-2xs">
                                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                                  0 Days
                                </span>
                              )}
                              {endVar.status === 'none' && <span className="text-slate-400 font-normal">-</span>}
                            </td>
                          )}
                          {isColVisible('avgProdDay') && (
                            <td style={{ width: `${getColWidth('avgProdDay')}px`, minWidth: `${getColWidth('avgProdDay')}px`, maxWidth: `${getColWidth('avgProdDay')}px`, ...getStickyStyle('avgProdDay') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-semibold text-slate-700 dark:text-slate-300 ${getStickyClass('avgProdDay')}`}>
                              {ord.avgProdDay || '-'}
                            </td>
                          )}
                          {isColVisible('expectedKnitEnd') && (
                            <td style={{ width: `${getColWidth('expectedKnitEnd')}px`, minWidth: `${getColWidth('expectedKnitEnd')}px`, maxWidth: `${getColWidth('expectedKnitEnd')}px`, ...getStickyStyle('expectedKnitEnd') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-400 ${getStickyClass('expectedKnitEnd')}`}>
                              {formatDisplayDate(ord.expectedKnitEnd)}
                            </td>
                          )}
                          {isColVisible('knitStartOTD') && (
                            <td style={{ width: `${getColWidth('knitStartOTD')}px`, minWidth: `${getColWidth('knitStartOTD')}px`, maxWidth: `${getColWidth('knitStartOTD')}px`, ...getStickyStyle('knitStartOTD') }} className={`px-3.5 py-3 border-b whitespace-nowrap text-center transition-colors ${getStickyClass('knitStartOTD')} ${
                              ord.knitStartOtd === 'Passed'
                                ? 'bg-emerald-500/20 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-100 border-emerald-300 dark:border-emerald-800/80'
                                : ord.knitStartOtd === 'Failed'
                                ? 'bg-rose-500/20 dark:bg-rose-950/80 text-rose-950 dark:text-rose-100 border-rose-300 dark:border-rose-800/80'
                                : 'border-slate-100 dark:border-slate-800/60 text-slate-500 bg-slate-50/50 dark:bg-slate-800/20'
                            }`}>
                              {ord.knitStartOtd === 'Passed' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 text-white font-extrabold text-xs shadow-xs">
                                  <span className="h-2 w-2 rounded-full bg-white"></span>
                                  Passed
                                </span>
                              )}
                              {ord.knitStartOtd === 'Failed' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 text-white font-extrabold text-xs shadow-xs">
                                  <span className="h-2 w-2 rounded-full bg-white"></span>
                                  Failed
                                </span>
                              )}
                              {ord.knitStartOtd === 'Pending' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 font-bold text-[11px]">
                                  Pending
                                </span>
                              )}
                            </td>
                          )}
                          {isColVisible('knitEndOTD') && (
                            <td style={{ width: `${getColWidth('knitEndOTD')}px`, minWidth: `${getColWidth('knitEndOTD')}px`, maxWidth: `${getColWidth('knitEndOTD')}px`, ...getStickyStyle('knitEndOTD') }} className={`px-3.5 py-3 border-b whitespace-nowrap text-center transition-colors ${getStickyClass('knitEndOTD')} ${
                              ord.knitEndOtd === 'Passed'
                                ? 'bg-emerald-500/20 dark:bg-emerald-950/80 text-emerald-950 dark:text-emerald-100 border-emerald-300 dark:border-emerald-800/80'
                                : ord.knitEndOtd === 'Failed'
                                ? 'bg-rose-500/20 dark:bg-rose-950/80 text-rose-950 dark:text-rose-100 border-rose-300 dark:border-rose-800/80'
                                : 'border-slate-100 dark:border-slate-800/60 text-slate-500 bg-slate-50/50 dark:bg-slate-800/20'
                            }`}>
                              {ord.knitEndOtd === 'Passed' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-600 text-white font-extrabold text-xs shadow-xs">
                                  <span className="h-2 w-2 rounded-full bg-white"></span>
                                  Passed
                                </span>
                              )}
                              {ord.knitEndOtd === 'Failed' && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-600 text-white font-extrabold text-xs shadow-xs">
                                  <span className="h-2 w-2 rounded-full bg-white"></span>
                                  Failed
                                </span>
                              )}
                              {ord.knitEndOtd === 'Pending' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300 font-bold text-[11px]">
                                  Pending
                                </span>
                              )}
                            </td>
                          )}
                          {isColVisible('knitStartRemarks') && (
                            <td style={{ width: `${getColWidth('knitStartRemarks')}px`, minWidth: `${getColWidth('knitStartRemarks')}px`, maxWidth: `${getColWidth('knitStartRemarks')}px`, ...getStickyStyle('knitStartRemarks') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden ${getStickyClass('knitStartRemarks')}`}>
                              {ord.knitStartRemarks ? (
                                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold block w-full max-w-full break-words whitespace-normal ${
                                  ord.knitStartOtd === 'Failed'
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800/60'
                                    : ord.knitStartOtd === 'Passed'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`} title={ord.knitStartRemarks}>
                                  {ord.knitStartRemarks}
                                </span>
                              ) : ord.knitStartOtd === 'Failed' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-800/60 max-w-full break-words whitespace-normal">
                                  ⚠️ Remarks Needed
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">-</span>
                              )}
                            </td>
                          )}
                          {isColVisible('knitEndRemarks') && (
                            <td style={{ width: `${getColWidth('knitEndRemarks')}px`, minWidth: `${getColWidth('knitEndRemarks')}px`, maxWidth: `${getColWidth('knitEndRemarks')}px`, ...getStickyStyle('knitEndRemarks') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden ${getStickyClass('knitEndRemarks')}`}>
                              {ord.knitEndRemarks ? (
                                <span className={`px-2.5 py-1 rounded-md text-xs font-semibold block w-full max-w-full break-words whitespace-normal ${
                                  ord.knitEndOtd === 'Failed'
                                    ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800/60'
                                    : ord.knitEndOtd === 'Passed'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                    : 'text-slate-700 dark:text-slate-300'
                                }`} title={ord.knitEndRemarks}>
                                  {ord.knitEndRemarks}
                                </span>
                              ) : ord.knitEndOtd === 'Failed' ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-800/60 max-w-full break-words whitespace-normal">
                                  ⚠️ Remarks Needed
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">-</span>
                              )}
                            </td>
                          )}
                          {isColVisible('knitTeamLeaders') && (
                            <td style={{ width: `${getColWidth('knitTeamLeaders')}px`, minWidth: `${getColWidth('knitTeamLeaders')}px`, maxWidth: `${getColWidth('knitTeamLeaders')}px`, ...getStickyStyle('knitTeamLeaders') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 overflow-hidden ${getStickyClass('knitTeamLeaders')}`}>
                              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate block" title={ord.knitTeamLeaders || '-'}>
                                {ord.knitTeamLeaders || '-'}
                              </span>
                            </td>
                          )}
                          {isColVisible('action') && (
                            <td style={{ width: `${getColWidth('action')}px`, minWidth: `${getColWidth('action')}px`, maxWidth: `${getColWidth('action')}px` }} className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-1">
                              {!(ord.knitStartOtd === 'Passed' && ord.knitEndOtd === 'Passed') && (
                                <button
                                  onClick={() => handleOpenEditModal(ord)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                                  title="Edit Order Plan"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleDeleteOrder(ord.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                                  title="Delete Order Plan"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PAGINATION CONTROL BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs text-xs font-semibold text-slate-700 dark:text-slate-300">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-slate-500 dark:text-slate-400">
                Showing <strong className="text-slate-900 dark:text-white">{filteredOrders.length === 0 ? 0 : (currentPage - 1) * (itemsPerPage || filteredOrders.length) + 1}</strong> to <strong className="text-slate-900 dark:text-white">{itemsPerPage <= 0 ? filteredOrders.length : Math.min(currentPage * itemsPerPage, filteredOrders.length)}</strong> of <strong className="text-slate-900 dark:text-white">{filteredOrders.length}</strong> orders
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-slate-500 text-[11px]">Rows per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <option value={50}>50</option>
                  <option value={100}>100 (Default)</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                  <option value={0}>All Data</option>
                </select>
              </div>
            </div>

            {itemsPerPage > 0 && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Prev</span>
                </button>

                <div className="flex items-center gap-1 px-2">
                  <span className="text-slate-500 font-medium">Page</span>
                  <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {currentPage}
                  </span>
                  <span className="text-slate-500 font-medium">of {totalPages}</span>
                </div>

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Order Plan Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New Order Plan Row</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Plan Month</label>
                  <select
                    value={formPlanMonth}
                    onChange={(e) => setFormPlanMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Plan Type</label>
                  <select
                    value={formPlanType}
                    onChange={(e) => setFormPlanType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="Confirm">Confirm</option>
                    <option value="Tentative">Tentative</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">EWO #</label>
                  <input
                    type="text"
                    value={formEwo}
                    onChange={(e) => setFormEwo(e.target.value)}
                    placeholder="e.g. 270450"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Buyer Name</label>
                  <input
                    type="text"
                    value={formBuyer}
                    onChange={(e) => setFormBuyer(e.target.value)}
                    placeholder="e.g. Vogue Sourcin"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Color</label>
                  <input
                    type="text"
                    value={formColor}
                    onChange={(e) => setFormColor(e.target.value)}
                    placeholder="e.g. Mid Blue"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Knit Start</label>
                  <input
                    type="text"
                    value={formKnitStart}
                    onChange={(e) => setFormKnitStart(e.target.value)}
                    placeholder="e.g. 27-Jun-26"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Knit End</label>
                  <input
                    type="text"
                    value={formKnitEnd}
                    onChange={(e) => setFormKnitEnd(e.target.value)}
                    placeholder="e.g. 15-Jul-26"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target (Kg)</label>
                  <input
                    type="number"
                    value={formTarget}
                    onChange={(e) => setFormTarget(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Allocated QTY (Kg)</label>
                  <input
                    type="number"
                    value={formAllocatedQty}
                    onChange={(e) => setFormAllocatedQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Grey Req. (Kg)</label>
                  <input
                    type="number"
                    value={formGreyReq}
                    onChange={(e) => setFormGreyReq(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow-md transition-all"
                >
                  Save Order Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Edit Order Plan Modal */}
      {showEditModal && editingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Edit Order Plan: <span className="font-mono text-blue-600">{editingOrder.ewo}</span>
                </h3>
              </div>
              <button 
                onClick={() => { setShowEditModal(false); setEditingOrder(null); }}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditOrder} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {editKnitStartOtd === 'Failed' || editKnitEndOtd === 'Failed' ? (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2 shadow-2xs font-semibold">
                  <Info className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                  <span><strong>Failed OTD Status:</strong> Please provide Knit Start / End remarks explaining the delay or reason for failure.</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/50 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2 shadow-2xs">
                  <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  <span>Only <strong>Knit Start Remarks</strong> and <strong>Knit End Remarks</strong> can be edited. Remarks are optional for Passed orders.</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plan Month</label>
                  <select
                    value={editPlanMonth}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  >
                    <option value="January">January</option>
                    <option value="February">February</option>
                    <option value="March">March</option>
                    <option value="April">April</option>
                    <option value="May">May</option>
                    <option value="June">June</option>
                    <option value="July">July</option>
                    <option value="August">August</option>
                    <option value="September">September</option>
                    <option value="October">October</option>
                    <option value="November">November</option>
                    <option value="December">December</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Plan Type</label>
                  <select
                    value={editPlanType}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  >
                    <option value="Confirm">Confirm</option>
                    <option value="Tentative">Tentative</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">EWO #</label>
                  <input
                    type="text"
                    value={editEwo}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Buyer Name</label>
                  <input
                    type="text"
                    value={editBuyer}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Color</label>
                  <input
                    type="text"
                    value={editColor}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Planned Knit Start</label>
                  <input
                    type="text"
                    value={editKnitStart}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Planned Knit End</label>
                  <input
                    type="text"
                    value={editKnitEnd}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Target (Kg)</label>
                  <input
                    type="text"
                    value={editTarget}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Allocated QTY (Kg)</label>
                  <input
                    type="text"
                    value={editAllocatedQty}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Grey Req. (Kg)</label>
                  <input
                    type="text"
                    value={editGreyReq}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Knit Produced (Kg)</label>
                  <input
                    type="text"
                    value={editKnitPro}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Actual Knit Start Date</label>
                  <input
                    type="text"
                    value={editAKnitStart}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Last Production Date / Actual End</label>
                  <input
                    type="text"
                    value={editLastProductionDate}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Allocation Start</label>
                  <input
                    type="text"
                    value={editAllocationStart}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Allocation End</label>
                  <input
                    type="text"
                    value={editAllocationEnd}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Knit Start OTD Status</label>
                  <select
                    value={editKnitStartOtd}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  >
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Knit End OTD Status</label>
                  <select
                    value={editKnitEndOtd}
                    disabled
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 cursor-not-allowed opacity-80"
                  >
                    <option value="Passed">Passed</option>
                    <option value="Failed">Failed</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              {/* Editable Remarks Section */}
              <div className={`p-3.5 rounded-2xl border space-y-3 transition-colors ${
                editKnitStartOtd === 'Failed' || editKnitEndOtd === 'Failed'
                  ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
                  : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-900/40'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Edit className={`h-4 w-4 ${
                      editKnitStartOtd === 'Failed' || editKnitEndOtd === 'Failed'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-blue-600 dark:text-blue-400'
                    }`} />
                    <span className={`text-xs font-bold ${
                      editKnitStartOtd === 'Failed' || editKnitEndOtd === 'Failed'
                        ? 'text-rose-900 dark:text-rose-200'
                        : 'text-blue-900 dark:text-blue-200'
                    }`}>Editable Remarks</span>
                  </div>
                  {(editKnitStartOtd === 'Failed' || editKnitEndOtd === 'Failed') && (
                    <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs">
                      Remarks Recommended for Failed OTD
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Knit Start Remarks</label>
                    <input
                      type="text"
                      value={editKnitStartRemarks}
                      onChange={(e) => setEditKnitStartRemarks(e.target.value)}
                      placeholder={editKnitStartOtd === 'Failed' ? 'Enter reason for start delay...' : 'Remarks for start (optional)'}
                      className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:outline-hidden transition-all shadow-xs ${
                        editKnitStartOtd === 'Failed'
                          ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                          : 'border-blue-300 dark:border-blue-600/80 focus:ring-blue-500/20'
                      }`}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Knit End Remarks</label>
                    <input
                      type="text"
                      value={editKnitEndRemarks}
                      onChange={(e) => setEditKnitEndRemarks(e.target.value)}
                      placeholder={editKnitEndOtd === 'Failed' ? 'Enter reason for completion delay...' : 'Remarks for completion (optional)'}
                      className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:outline-hidden transition-all shadow-xs ${
                        editKnitEndOtd === 'Failed'
                          ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500/20'
                          : 'border-blue-300 dark:border-blue-600/80 focus:ring-blue-500/20'
                      }`}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">Knit Team Leader</label>
                    <input
                      type="text"
                      value={editKnitTeamLeaders}
                      onChange={(e) => setEditKnitTeamLeaders(e.target.value)}
                      placeholder="e.g. Leader Name"
                      className="w-full rounded-xl border border-blue-300 dark:border-blue-600/80 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 focus:outline-hidden transition-all shadow-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingOrder(null); }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit className="h-4 w-4" />
                  <span>Update Remarks</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT YARN ALLOCATION MODAL */}
      {(showAddYarnModal || showEditYarnModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {showEditYarnModal ? 'Edit Yarn Allocation Record' : 'Add New Yarn Allocation'}
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Manage yarn requisition, lot specs, spinner and allocation quantities</p>
                </div>
              </div>
              <button
                onClick={() => { setShowAddYarnModal(false); setShowEditYarnModal(false); setEditingYarn(null); }}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const record: YarnAllocationRecord = {
                  id: editingYarn ? editingYarn.id : `ya-${Date.now()}`,
                  actualRequisitionDate: yaRequisitionDate,
                  buyer: yaBuyer,
                  orderNumber: yaOrderNumber,
                  fabricsType: yaFabricsType,
                  fabricShade: yaFabricShade,
                  fabricGsm: yaFabricGsm,
                  yarnRequired: yaYarnRequired,
                  lotRef: yaLotRef,
                  allocatedYarn: yaAllocatedYarn,
                  lotNo: yaLotNo,
                  spinnersName: yaSpinnersName,
                  allocationStatus: yaAllocationStatus,
                  yarnStockStatus: yaYarnStockStatus,
                  yarnDeliveryStatus: yaYarnDeliveryStatus,
                  proposedAllocationDate: yaProposedAllocationDate,
                  allocationDateRange: yaAllocationDateRange,
                  allocationNo: yaAllocationNo,
                  yarnRqQty: parseFloat(yaYarnRqQty) || 0,
                  allocatedQty: parseFloat(yaAllocatedQty) || 0,
                  balance: parseFloat(yaBalance) || 0,
                  remarks: yaRemarks
                };

                if (editingYarn) {
                  setYarnAllocations(prev => prev.map(a => a.id === editingYarn.id ? record : a));
                } else {
                  setYarnAllocations(prev => [record, ...prev]);
                }

                setShowAddYarnModal(false);
                setShowEditYarnModal(false);
                setEditingYarn(null);
              }}
              className="mt-4 space-y-4 max-h-[75vh] overflow-y-auto pr-1"
            >
              {/* Section 1: Order & Requisition Info */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">1. Requisition & Order Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Requisition Date</label>
                    <input
                      type="text"
                      value={yaRequisitionDate}
                      onChange={(e) => setYaRequisitionDate(e.target.value)}
                      placeholder="e.g. 28-Jun-25"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Buyer</label>
                    <input
                      type="text"
                      value={yaBuyer}
                      onChange={(e) => setYaBuyer(e.target.value)}
                      placeholder="e.g. C&A"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Order Number</label>
                    <input
                      type="text"
                      value={yaOrderNumber}
                      onChange={(e) => setYaOrderNumber(e.target.value)}
                      placeholder="e.g. 260796"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Fabrics Type</label>
                    <input
                      type="text"
                      value={yaFabricsType}
                      onChange={(e) => setYaFabricsType(e.target.value)}
                      placeholder="e.g. Fleece / Single Jersey"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Fabric Specs */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">2. Fabric Specifications & Yarn Required</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Fabric Shade</label>
                    <input
                      type="text"
                      value={yaFabricShade}
                      onChange={(e) => setYaFabricShade(e.target.value)}
                      placeholder="e.g. JS200049"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Fabric GSM</label>
                    <input
                      type="text"
                      value={yaFabricGsm}
                      onChange={(e) => setYaFabricGsm(e.target.value)}
                      placeholder="e.g. 260"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Yarn Required</label>
                    <input
                      type="text"
                      value={yaYarnRequired}
                      onChange={(e) => setYaYarnRequired(e.target.value)}
                      placeholder="e.g. 24CC-PT"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Lot Ref</label>
                    <input
                      type="text"
                      value={yaLotRef}
                      onChange={(e) => setYaLotRef(e.target.value)}
                      placeholder="e.g. Do allocate from 260320"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Yarn Allocation & Spinner Specs */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">3. Allocated Yarn & Lot Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Allocated Yarn Description</label>
                    <input
                      type="text"
                      value={yaAllocatedYarn}
                      onChange={(e) => setYaAllocatedYarn(e.target.value)}
                      placeholder="e.g. 24OC NPOP OCS"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Lot #</label>
                    <input
                      type="text"
                      value={yaLotNo}
                      onChange={(e) => setYaLotNo(e.target.value)}
                      placeholder="e.g. GO8124A805"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Spinner's Name</label>
                    <input
                      type="text"
                      value={yaSpinnersName}
                      onChange={(e) => setYaSpinnersName(e.target.value)}
                      placeholder="e.g. Maral / Winsome"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Allocation Status</label>
                    <select
                      value={yaAllocationStatus}
                      onChange={(e) => setYaAllocationStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    >
                      <option value="Allocated">Allocated</option>
                      <option value="Pending">Pending</option>
                      <option value="Partial">Partial</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 4: Stock & Delivery Status */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">4. Dates, Allocation No & Stock Status</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Allocation No</label>
                    <input
                      type="text"
                      value={yaAllocationNo}
                      onChange={(e) => setYaAllocationNo(e.target.value)}
                      placeholder="e.g. A7288"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Start To End Date Range</label>
                    <input
                      type="text"
                      value={yaAllocationDateRange}
                      onChange={(e) => setYaAllocationDateRange(e.target.value)}
                      placeholder="e.g. 29-Jun-2025 To 08-Jul-2025"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Stock / Delivery Status</label>
                    <input
                      type="text"
                      value={yaYarnStockStatus}
                      onChange={(e) => setYaYarnStockStatus(e.target.value)}
                      placeholder="Stock Available"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: Quantities & Remarks */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">5. Quantities (Kg) & Remarks</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Yarn Rq Qty (Kg)</label>
                    <input
                      type="number"
                      value={yaYarnRqQty}
                      onChange={(e) => {
                        const rq = parseFloat(e.target.value) || 0;
                        const al = parseFloat(yaAllocatedQty) || 0;
                        setYaYarnRqQty(e.target.value);
                        setYaBalance(String(rq - al));
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Allocated Qty (Kg)</label>
                    <input
                      type="number"
                      value={yaAllocatedQty}
                      onChange={(e) => {
                        const al = parseFloat(e.target.value) || 0;
                        const rq = parseFloat(yaYarnRqQty) || 0;
                        setYaAllocatedQty(e.target.value);
                        setYaBalance(String(rq - al));
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold font-mono"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Balance (Kg)</label>
                    <input
                      type="number"
                      value={yaBalance}
                      onChange={(e) => setYaBalance(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold font-mono text-amber-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Remarks</label>
                    <input
                      type="text"
                      value={yaRemarks}
                      onChange={(e) => setYaRemarks(e.target.value)}
                      placeholder="e.g. As per quality confirmation / ok"
                      className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => { setShowAddYarnModal(false); setShowEditYarnModal(false); setEditingYarn(null); }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Package className="h-4 w-4" />
                  <span>{editingYarn ? 'Update Allocation' : 'Save Allocation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
