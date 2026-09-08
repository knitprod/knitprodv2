/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { GasClient } from '../lib/gasClient';
import { SupabaseSync } from '../lib/supabaseClient';
import { UserRecord } from './UserManagementView';
import { formatDisplayDate } from './YarnAllocationView';
import SearchableSelect from './SearchableSelect';
import { useTableColumns, ColumnCustomizerDropdown, ResizableTh, ColumnDef } from './TableColumnCustomizer';
import { useGlobalData } from '../context/GlobalDataContext';
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
  Upload,
  UploadCloud,
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
  ShieldAlert,
  ShieldCheck,
  Database,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Building2,
  Users,
  Check,
  ArrowRight,
  Copy,
  ChevronUp,
  Sparkles,
  History,
  ListChecks,
} from 'lucide-react';
import { 
  formatExcelDate, 
  isDateOrTimestampString, 
  sanitizeRemarksValue, 
  sanitizeOrderPlanRemarks,
  deduplicateOrderPlans,
  getOrderPlanCanonicalId,
  normOrderNum,
  normColorName
} from '../lib/knittingStatusStore';

export const getYesterdayDateString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDisplayDate(d);
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

// Field Diff & Change Summary Types for Upload
export interface OrderFieldDiff {
  fieldKey: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  isFilledBlank: boolean;
}

export interface OrderChangeRecord {
  orderId: string;
  ewo: string;
  color: string;
  buyer: string;
  planMonth?: string;
  isNew: boolean;
  changes: OrderFieldDiff[];
}

/**
 * Safely parse date strings like "27-Jun-26", "2026-06-27", "27/06/2026"
 */
function parseDateString(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  const str = dateStr.toString().trim();
  if (!str || str === '-' || str === 'Pending') return null;

  // 1) Try parsing ISO "YYYY-MM-DD" or "YYYY/MM/DD"
  const isoMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    if (m >= 0 && m < 12 && !isNaN(d) && !isNaN(y)) {
      return new Date(y, m, d);
    }
  }

  // 2) Try parsing "27-Jun-26" or "27-Jun-2026" or "06-September-2026"
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

  // 3) Fallback to standard Date parsing
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

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

const INITIAL_ORDERS: OrderPlan[] = [];

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

  const {
    orderPlans: globalOrders,
    yarnAllocations: globalYarn,
    refreshAll,
    saveOrderPlan: globalSaveOrderPlan,
    deleteOrderPlan: globalDeleteOrderPlan,
    clearAllOrderPlans,
    bulkSaveOrderPlans,
    saveYarnAllocation: globalSaveYarnAllocation,
    deleteYarnAllocation: globalDeleteYarnAllocation
  } = useGlobalData();

  const [orders, setOrders] = useState<OrderPlan[]>(() => {
    const base = globalOrders && globalOrders.length > 0 
      ? globalOrders.filter(o => !o.id.startsWith('ord-aug-12-'))
      : [];
    return deduplicateOrderPlans(base);
  });
  useEffect(() => {
    if (globalOrders && globalOrders.length > 0) {
      // 1. Filter out mock INITIAL_ORDERS (ord-aug-12-* hardcoded test IDs)
      let cleaned = globalOrders.filter(o => !o.id.startsWith('ord-aug-12-'));

      // 2. Auto-clean any orders where actual dates were erroneously cloned from planned dates
      // (exact signature of the former parser cross-matching: aKnitStart === knitStart && lastProductionDate === knitEnd)
      let datesFixed = false;
      cleaned = cleaned.map(o => {
        let order = sanitizeOrderPlanRemarks(o);
        if (
          order.aKnitStart && 
          order.knitStart && 
          order.aKnitStart === order.knitStart && 
          order.lastProductionDate && 
          order.knitEnd && 
          order.lastProductionDate === order.knitEnd
        ) {
          datesFixed = true;
          return {
            ...order,
            aKnitStart: '',
            lastProductionDate: ''
          };
        }
        return order;
      });

      const deduplicated = deduplicateOrderPlans(cleaned);
      setOrders(deduplicated);
    } else {
      setOrders([]);
    }
  }, [globalOrders]);
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

  // Yarn Allocation state & filters (Powered by Firebase Firestore)
  const [yarnAllocations, setYarnAllocations] = useState<YarnAllocationRecord[]>(() => {
    if (globalYarn && globalYarn.length > 0) return globalYarn;
    return [];
  });
  useEffect(() => {
    if (globalYarn && globalYarn.length > 0) {
      setYarnAllocations(globalYarn);
    }
  }, [globalYarn]);
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
      await refreshAll(forceRefresh);
    } catch (err) {
      console.warn("Could not load yarn allocations in PlanOrderFollowupView:", err);
    }
  };

  const loadOrders = async (forceRefresh: boolean = false) => {
    setIsSyncing(true);
    setDownloadProgress({
      isDownloading: true,
      loaded: 0,
      total: orders.length || 0,
      percent: 0,
      stage: 'Connecting to Supabase cloud database...'
    });

    try {
      const data = await SupabaseSync.fetchOrderPlans((loaded, total, percent) => {
        setDownloadProgress({
          isDownloading: true,
          loaded,
          total,
          percent,
          stage: total > 0
            ? `Downloading ${loaded.toLocaleString()} of ${total.toLocaleString()} order plans from Supabase...`
            : `Downloading ${loaded.toLocaleString()} records...`
        });
      });

      if (data && Array.isArray(data) && data.length > 0) {
        const cleaned = deduplicateOrderPlans(data);
        setOrders(cleaned);
        try {
          localStorage.setItem('cached_order_plans', JSON.stringify(cleaned));
        } catch (e) {}
      } else if (Array.isArray(data) && SupabaseSync.isConfigured()) {
        // Supabase database has 0 records (e.g. user purged/deleted all codes)
        setOrders([]);
        try { localStorage.removeItem('cached_order_plans'); } catch (e) {}
      } else {
        await refreshAll(forceRefresh);
      }

      const now = new Date();
      setUploadInfo(prev => {
        const updated = {
          ...prev,
          lastUpdatedDate: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          lastUpdateTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          totalRecords: data?.length || orders.length,
          status: 'Success' as const
        };
        try { localStorage.setItem('order_plan_upload_info', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
    } catch (err) {
      console.warn("Could not load order plans from Supabase:", err);
      try {
        await refreshAll(forceRefresh);
      } catch (e) {}
    } finally {
      setIsSyncing(false);
      setDownloadProgress(prev => ({ ...prev, percent: 100, stage: 'Download complete!' }));
      setTimeout(() => {
        setDownloadProgress(prev => ({ ...prev, isDownloading: false }));
      }, 800);
    }
  };

  // Sync with global store; listener for real-time Firestore sync & manual events
  useEffect(() => {
    if (globalOrders && globalOrders.length > 0) {
      setOrders(globalOrders);
    }
    if (globalYarn && globalYarn.length > 0) {
      setYarnAllocations(globalYarn);
    }
  }, [globalOrders, globalYarn]);

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
      const orderNumStr = String(ord.ewo || (ord as any).orderNumber || (ord as any).orderNo || '').toLowerCase();
      const matchesSearch = 
        !q ||
        orderNumStr.includes(q) ||
        String(ord.buyer || '').toLowerCase().includes(q) ||
        String(ord.color || '').toLowerCase().includes(q) ||
        String(ord.planMonth || '').toLowerCase().includes(q) ||
        String(ord.planType || '').toLowerCase().includes(q) ||
        String(ord.knitStart || '').toLowerCase().includes(q) ||
        String(ord.knitEnd || '').toLowerCase().includes(q) ||
        String(ord.knitTeamLeaders || '').toLowerCase().includes(q);
      
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
      id: getOrderPlanCanonicalId({ ewo: formEwo.trim(), color: formColor.trim() }),
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

    const updated = deduplicateOrderPlans([newEntry, ...orders]);
    setOrders(updated);
    globalSaveOrderPlan(newEntry).catch(err => console.warn('Global save order plan warning:', err));
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
    globalSaveOrderPlan(updatedOrder).catch(err => console.warn('Global save order plan warning:', err));
    setShowEditModal(false);
    setEditingOrder(null);
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this Order Plan record?')) {
      const updated = orders.filter(o => o.id !== id);
      setOrders(updated);
      try {
        await globalDeleteOrderPlan(id);
      } catch (err) {
        console.warn("Error deleting order plan:", err);
      }
    }
  };

  // Upload, Merge & Admin Overwrite State
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const overwriteInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [isDraggingPage, setIsDraggingPage] = useState<boolean>(false);
  const [isDraggingDropzone, setIsDraggingDropzone] = useState<boolean>(false);

  // Staged Upload State for Confirmation / Save & Cancel Flow
  interface StagedUploadData {
    fileName: string;
    fileSize: string;
    totalRows: number;
    mergedOrders: OrderPlan[];
    changedOrders: OrderPlan[];
    changesList: OrderChangeRecord[];
    stats: {
      totalRowsProcessed: number;
      matchedOrdersCount: number;
      updatedOrdersCount: number;
      filledBlanksCount: number;
      newOrdersCount: number;
      unalteredCount: number;
      totalFieldsChanged: number;
    };
  }
  const [stagedUpload, setStagedUpload] = useState<StagedUploadData | null>(null);
  const [isSavingStaged, setIsSavingStaged] = useState<boolean>(false);

  // Status and progress bar tracking (matches YarnAllocationView parity)
  const [downloadProgress, setDownloadProgress] = useState<{
    isDownloading: boolean;
    loaded: number;
    total: number;
    percent: number;
    stage: string;
  }>({
    isDownloading: false,
    loaded: 0,
    total: 0,
    percent: 0,
    stage: ''
  });

  const [uploadProgress, setUploadProgress] = useState<{
    isUploading: boolean;
    loaded: number;
    total: number;
    percent: number;
    stage: string;
  }>({
    isUploading: false,
    loaded: 0,
    total: 0,
    percent: 0,
    stage: ''
  });

  const [exportProgress, setExportProgress] = useState<{
    isExporting: boolean;
    percent: number;
    message: string;
  }>({
    isExporting: false,
    percent: 0,
    message: ''
  });

  const [uploadInfo, setUploadInfo] = useState<{
    lastUpdatedDate: string;
    lastUpdateTime: string;
    userName: string;
    totalRecords: number;
    status: 'Success' | 'Pending' | 'Failed';
    errorMessage?: string;
  }>(() => {
    try {
      const cached = localStorage.getItem('order_plan_upload_info');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    const now = new Date();
    return {
      lastUpdatedDate: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      lastUpdateTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      userName: 'Md. Raihan Hossain Antu',
      totalRecords: 0,
      status: 'Success'
    };
  });

  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [uploadProgressStage, setUploadProgressStage] = useState<string>('');
  const [uploadProgressDetail, setUploadProgressDetail] = useState<string>('');
  const [uploadFileName, setUploadFileName] = useState<string>('');
  const [uploadFileSize, setUploadFileSize] = useState<string>('');
  const [showUploadChoiceModal, setShowUploadChoiceModal] = useState<boolean>(false);
  const [showAdminOverwriteModal, setShowAdminOverwriteModal] = useState<boolean>(false);
  const [overwriteConfirmedCheckbox, setOverwriteConfirmedCheckbox] = useState<boolean>(false);
  const [showPurgeModal, setShowPurgeModal] = useState<boolean>(false);
  const [isPurging, setIsPurging] = useState<boolean>(false);
  const [purgeConfirmationText, setPurgeConfirmationText] = useState<string>('');
  const [uploadFeedback, setUploadFeedback] = useState<{
    show: boolean;
    title: string;
    message: string;
    mode?: 'merge' | 'overwrite';
    stats?: {
      totalRowsProcessed: number;
      matchedOrdersCount: number;
      updatedOrdersCount: number;
      filledBlanksCount: number;
      newOrdersCount: number;
      unalteredCount: number;
      purgedCount?: number;
      totalFieldsChanged?: number;
    };
    changesList?: OrderChangeRecord[];
  } | null>(null);

  // Upload Summary Modal Controls
  const [changeSearchQuery, setChangeSearchQuery] = useState<string>('');
  const [changeCategoryFilter, setChangeCategoryFilter] = useState<'all' | 'dates' | 'progress' | 'remarks' | 'new'>('all');
  const [changeTab, setChangeTab] = useState<'changes' | 'overview'>('changes');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());
  const [copiedSummary, setCopiedSummary] = useState<boolean>(false);

  // Flexible Excel Column Resolution Helpers
  const normalizeKey = (str: string): string => {
    return String(str || '').toLowerCase().replace(/[\r\n\t_.\-/\s]+/g, '');
  };

  const parseExcelNumber = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') {
      return isNaN(val) ? undefined : val;
    }
    const str = String(val).trim().replace(/,/g, '').replace(/[^\d.-]/g, '');
    if (!str || str === '-' || str === '.') return undefined;
    const num = parseFloat(str);
    return isNaN(num) ? undefined : num;
  };

  const parseExcelRoundUpNumber = (val: any): number | undefined => {
    return parseExcelNumber(val);
  };

  const normalizeOtdValue = (val: any): 'Passed' | 'Failed' | 'Pending' | undefined => {
    if (val === undefined || val === null) return undefined;
    const s = String(val).trim().toLowerCase();
    if (!s || s === '-' || s === 'n/a') return undefined;
    if (s === 'passed' || s === 'pass' || s === 'on time' || s === 'ontime' || s === 'ok' || s === 'yes' || s === 'done' || s === 'achieved') return 'Passed';
    if (s === 'failed' || s === 'fail' || s === 'delay' || s === 'delayed' || s === 'late' || s === 'no') return 'Failed';
    if (s === 'pending' || s === 'in progress' || s === 'running' || s === 'hold') return 'Pending';
    return undefined;
  };

  interface ExcelRowLookupOptions {
    forbiddenWords?: string[];
    mustContain?: string[];
    exactMatchOnly?: boolean;
  }

  const getExcelRowValue = (
    row: Record<string, any>, 
    candidateKeys: string[], 
    defaultValue: any = '',
    options?: ExcelRowLookupOptions
  ): any => {
    if (!row) return defaultValue;

    const isHeaderAllowed = (headerKey: string): boolean => {
      const lower = String(headerKey || '').toLowerCase().trim();
      const norm = normalizeKey(headerKey);

      if (options?.forbiddenWords && options.forbiddenWords.length > 0) {
        for (const rawF of options.forbiddenWords) {
          const fClean = rawF.toLowerCase().trim();
          if (!fClean) continue;
          if (fClean === 'a.' || fClean === 'a_' || fClean === 'a ') {
            // Strictly forbid actual/a. prefixes, NEVER match general letters
            if (/^a[._\s]/i.test(lower) || /\ba[._\s]/i.test(lower) || norm.startsWith('aknit')) {
              return false;
            }
          } else {
            const fNorm = normalizeKey(fClean);
            if (fNorm.length >= 3 && norm.includes(fNorm)) {
              return false;
            }
            const escaped = fClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(`(^|\\b|_)${escaped}(\\b|_|$)`, 'i').test(lower)) {
              return false;
            }
          }
        }
      }

      if (options?.mustContain && options.mustContain.length > 0) {
        let hasMust = false;
        for (const rawM of options.mustContain) {
          const mClean = rawM.toLowerCase().trim();
          if (!mClean) continue;
          if (mClean === 'a.' || mClean === 'a_' || mClean === 'a ') {
            if (/^a[._\s]/i.test(lower) || /\ba[._\s]/i.test(lower) || norm.startsWith('aknit') || lower.includes('actual')) {
              hasMust = true;
              break;
            }
          } else {
            const mNorm = normalizeKey(mClean);
            if (mNorm.length >= 3 && norm.includes(mNorm)) {
              hasMust = true;
              break;
            }
            const escaped = mClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(`(^|\\b|_)${escaped}(\\b|_|$)`, 'i').test(lower)) {
              hasMust = true;
              break;
            }
          }
        }
        if (!hasMust) return false;
      }

      return true;
    };

    // 1. Direct exact candidate match
    for (const k of candidateKeys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        if (isHeaderAllowed(k)) {
          return row[k];
        }
      }
    }

    const rowKeys = Object.keys(row);
    const normalizedRowMap = new Map<string, string>();
    for (const rk of rowKeys) {
      if (!isHeaderAllowed(rk)) continue;
      const norm = normalizeKey(rk);
      if (!normalizedRowMap.has(norm)) {
        normalizedRowMap.set(norm, rk);
      }
    }

    // 2. Normalized exact match
    for (const candidate of candidateKeys) {
      const normCand = normalizeKey(candidate);
      const matchedKey = normalizedRowMap.get(normCand);
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
        return row[matchedKey];
      }
    }

    if (options?.exactMatchOnly) {
      return defaultValue;
    }

    // 3. Substring inclusion match (Excel header contains candidate)
    for (const candidate of candidateKeys) {
      const normCand = normalizeKey(candidate);
      if (normCand.length < 3) continue;
      for (const [normRk, origRk] of normalizedRowMap.entries()) {
        if (normRk.includes(normCand)) {
          if (row[origRk] !== undefined && row[origRk] !== null && String(row[origRk]).trim() !== '') {
            return row[origRk];
          }
        }
      }
    }
    return defaultValue;
  };

  // Helper to robustly extract order plan rows across all sheets with flexible header detection
  const extractRowsFromWorkbook = (wb: XLSX.WorkBook): any[] => {
    const extractedRows: any[] = [];
    const orderHeaderKeywords = [
      'ewo', 'order', 'buyer', 'color', 'colour', 'target', 'grey', 'knit', 'alloc', 
      'month', 'plan', 'prod', 'balance', 'req', 'leader', 'otd', 'remarks'
    ];

    wb.SheetNames.forEach(sName => {
      const sheet = wb.Sheets[sName];
      if (!sheet) return;
      
      const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!Array.isArray(matrix) || matrix.length === 0) return;

      // Handle merged header cells if sheet['!merges'] exists
      if (sheet['!merges'] && Array.isArray(sheet['!merges'])) {
        for (const m of sheet['!merges']) {
          if (m.s.r < 10) { // only for top header rows
            const masterVal = matrix[m.s.r]?.[m.s.c];
            if (masterVal !== undefined && masterVal !== '') {
              for (let r = m.s.r; r <= m.e.r; r++) {
                if (!matrix[r]) matrix[r] = [];
                for (let c = m.s.c; c <= m.e.c; c++) {
                  if (r === m.s.r && c === m.s.c) continue;
                  if (matrix[r][c] === undefined || String(matrix[r][c]).trim() === '') {
                    matrix[r][c] = masterVal;
                  }
                }
              }
            }
          }
        }
      }

      let bestHeaderIndex = -1;
      let maxScore = 0;

      for (let r = 0; r < Math.min(matrix.length, 30); r++) {
        const row = matrix[r];
        if (!Array.isArray(row)) continue;
        const rowStr = row.map(cell => String(cell || '').toLowerCase()).join(' ');
        let score = 0;
        for (const kw of orderHeaderKeywords) {
          if (rowStr.includes(kw)) score++;
        }
        const textCellsCount = row.filter(c => typeof c === 'string' && c.trim().length > 0).length;
        const totalScore = score * 2 + Math.min(textCellsCount, 15);
        if (totalScore > maxScore && score >= 2) {
          maxScore = totalScore;
          bestHeaderIndex = r;
        }
      }

      if (bestHeaderIndex >= 0) {
        // Check if next row also contains sub-headers (e.g. 2-tier header)
        let isTwoTierHeader = false;
        if (bestHeaderIndex + 1 < matrix.length) {
          const nextRow = matrix[bestHeaderIndex + 1];
          if (Array.isArray(nextRow)) {
            const nextRowStr = nextRow.map(c => String(c || '').toLowerCase()).join(' ');
            let subScore = 0;
            for (const kw of ['start', 'end', 'qty', 'bal', 'req', 'pro', 'prod', 'otd', 'remarks', 'leader', 'actual', 'target']) {
              if (nextRowStr.includes(kw)) subScore++;
            }
            if (subScore >= 3) {
              isTwoTierHeader = true;
            }
          }
        }

        const topRow = matrix[bestHeaderIndex] || [];
        const subRow = isTwoTierHeader ? (matrix[bestHeaderIndex + 1] || []) : [];
        const maxCols = Math.max(topRow.length, subRow.length);
        const headers: string[] = [];

        for (let c = 0; c < maxCols; c++) {
          const topH = String(topRow[c] || '').replace(/[\r\n]+/g, ' ').replace(/\u00a0/g, ' ').trim();
          const subH = isTwoTierHeader ? String(subRow[c] || '').replace(/[\r\n]+/g, ' ').replace(/\u00a0/g, ' ').trim() : '';

          let combined = '';
          if (topH && subH && topH.toLowerCase() !== subH.toLowerCase()) {
            if (subH.toLowerCase().startsWith(topH.toLowerCase())) {
              combined = subH;
            } else if (topH.toLowerCase().endsWith(subH.toLowerCase())) {
              combined = topH;
            } else {
              combined = `${topH} ${subH}`;
            }
          } else {
            combined = topH || subH;
          }

          headers.push(combined);
        }

        const dataStartRow = isTwoTierHeader ? bestHeaderIndex + 2 : bestHeaderIndex + 1;

        for (let r = dataStartRow; r < matrix.length; r++) {
          const row = matrix[r];
          if (!Array.isArray(row) || row.every(c => String(c || '').trim() === '')) continue;
          
          const rowObj: Record<string, any> = {};
          let hasContent = false;
          for (let c = 0; c < headers.length; c++) {
            const h = headers[c];
            if (!h) continue;
            const cellAddress = XLSX.utils.encode_cell({ r, c });
            const cell = sheet[cellAddress];
            let val: any = '';
            if (cell) {
              if (cell.w !== undefined && String(cell.w).trim() !== '') {
                val = cell.w;
              } else if (cell.v !== undefined) {
                val = cell.v;
              }
            }
            if ((val === undefined || val === '') && row[c] !== undefined) {
              val = row[c];
            }
            rowObj[h] = val;
            if (String(val).trim() !== '') hasContent = true;
          }
          if (hasContent) {
            extractedRows.push(rowObj);
          }
        }
      } else {
        const standard = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
        if (Array.isArray(standard) && standard.length > 0) {
          extractedRows.push(...standard);
        }
      }
    });

    return extractedRows;
  };

  // Smart Upload & Non-destructive Merge Handler
  const processSmartUploadFile = async (file: File) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      alert('Please select a valid Excel spreadsheet (.xlsx, .xls) or CSV file.');
      return;
    }

    setShowUploadModal(true);
    setIsUploading(true);
    setUploadFileName(file.name);
    setUploadFileSize(file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : (file.size / 1024).toFixed(1) + ' KB');
    setUploadProgressPercent(8);
    setUploadProgressStage('Reading Spreadsheet File');
    setUploadProgressDetail(`Opening "${file.name}"...`);

    await new Promise(r => setTimeout(r, 60));

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setUploadProgressPercent(20);
        setUploadProgressStage('Parsing Worksheets');
        setUploadProgressDetail('Extracting sheets, columns and data cells...');
        await new Promise(r => setTimeout(r, 60));

        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });

        const allRows = extractRowsFromWorkbook(wb);

        if (allRows.length === 0) {
          setShowUploadModal(false);
          setIsUploading(false);
          setUploadFeedback({
            show: true,
            title: 'Empty Spreadsheet',
            message: 'The selected Excel file contains no valid data rows.'
          });
          return;
        }

        setUploadProgressPercent(32);
        setUploadProgressStage('Analyzing Spreadsheet Structure');
        setUploadProgressDetail(`Found ${allRows.length} data rows across ${wb.SheetNames.length} sheet(s)...`);
        await new Promise(r => setTimeout(r, 60));

        const totalRows = allRows.length;
        const progressBatchSize = Math.max(10, Math.floor(totalRows / 25));

        // -------------------------------------------------------------
        // SMART AUTO-PROCESS: Automatically matches orders by EWO + Color,
        // fills blank fields, updates changed values, and appends new orders.
        // Stages results for review before committing to database.
        // -------------------------------------------------------------
        let updatedOrdersCount = 0;
        let filledBlanksCount = 0;
        let newOrdersCount = 0;
        let matchedOrdersCount = 0;
        let totalFieldsChangedCount = 0;

        // Clone current orders to avoid direct state mutation
        const mergedOrders = [...orders];

        // Group existing orders by EWO + Color so multiple line items can be matched in order
        const existingIndicesByKey = new Map<string, number[]>();
        mergedOrders.forEach((o, index) => {
          const ordKey = normOrderNum(o.ewo || o.id);
          const colKey = normColorName(o.color);
          const key = `${ordKey}___${colKey}`;
          if (!existingIndicesByKey.has(key)) existingIndicesByKey.set(key, []);
          existingIndicesByKey.get(key)!.push(index);
        });

        const usedExistingIndices = new Set<number>();
        const uploadOccurrenceMap = new Map<string, number>();

        const modifiedIndices = new Set<number>();
        const newOrderIndices = new Set<number>();
        const changesByOrderId = new Map<string, OrderChangeRecord>();

        for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
          const row = allRows[rowIdx];

          if (rowIdx % progressBatchSize === 0 || rowIdx === totalRows - 1) {
            const currentPct = Math.min(80, Math.round(35 + ((rowIdx + 1) / totalRows) * 45));
            setUploadProgressPercent(currentPct);
            setUploadProgressStage('Matching & Merging Orders');
            setUploadProgressDetail(`Processing row ${rowIdx + 1} of ${totalRows}...`);
            if (rowIdx % (progressBatchSize * 2) === 0) {
              await new Promise(r => setTimeout(r, 0));
            }
          }

          const rawEwo = getExcelRowValue(row, [
            'EWO', 'EWO No', 'EWO No.', 'EWO#', 'Order No.', 'Order No', 'Order', 'Order Number', 'Order#', 'orderNo', 'OrderNo', 'Job No', 'Job#', 'Job No.'
          ]);
          const ewo = String(rawEwo || '').trim().replace(/^#+/, '');
          if (!ewo) continue; // Skip invalid rows without order number

          const rawColor = getExcelRowValue(row, [
            'Color', 'Colour', 'Fabric Color', 'Fabric Colour', 'Fabric Shade', 'Shade', 'Item Color', 'Item Colour', 'Color Name', 'Colour Name', 'Colorway', 'Y/D Stripe', 'Color / Stripe', 'Colour / Stripe', 'Stripe'
          ]);
          const color = String(rawColor || '').trim();

          const rawSl = getExcelRowValue(row, [
            'SL', 'SL.', 'Sl No', 'Sl. No.', 'Sl', 'SL#', 'Serial', 'Serial No', 'Line', 'Line No', 'Line#', 'Item', 'Item No', 'Item#'
          ]);

          const ordKey = normOrderNum(ewo);
          const colKey = normColorName(color);
          const primaryKey = `${ordKey}___${colKey}`;

          const occ = (uploadOccurrenceMap.get(primaryKey) || 0) + 1;
          uploadOccurrenceMap.set(primaryKey, occ);

          // Find candidate target index:
          let targetIndex: number | undefined = undefined;

          // 1. Check if there is an unused existing order for this exact EWO+Color
          const candidateIndices = existingIndicesByKey.get(primaryKey) || [];
          for (const idx of candidateIndices) {
            if (!usedExistingIndices.has(idx)) {
              targetIndex = idx;
              usedExistingIndices.add(idx);
              break;
            }
          }

          // 2. If no exact match and color is blank, try unused existing order with blank color
          if (targetIndex === undefined && !colKey) {
            const blankCandidates = existingIndicesByKey.get(`${ordKey}___`) || [];
            for (const idx of blankCandidates) {
              if (!usedExistingIndices.has(idx)) {
                targetIndex = idx;
                usedExistingIndices.add(idx);
                break;
              }
            }
          }

          // 3. Fallback: Check unused existing orders matching this EWO
          if (targetIndex === undefined) {
            const matchingIndices: number[] = [];
            mergedOrders.forEach((o, idx) => {
              if (!usedExistingIndices.has(idx) && normOrderNum(o.ewo || o.id) === ordKey) {
                matchingIndices.push(idx);
              }
            });

            if (matchingIndices.length === 1) {
              targetIndex = matchingIndices[0];
              usedExistingIndices.add(targetIndex);
            } else if (matchingIndices.length > 1) {
              if (!colKey) {
                targetIndex = matchingIndices[0];
                usedExistingIndices.add(targetIndex);
              } else {
                const matchedByColor = matchingIndices.find(idx => {
                  const existCol = normColorName(mergedOrders[idx].color);
                  return existCol.includes(colKey) || colKey.includes(existCol);
                });
                if (matchedByColor !== undefined) {
                  targetIndex = matchedByColor;
                  usedExistingIndices.add(targetIndex);
                }
              }
            }
          }

          // Extract values from uploaded row with comprehensive candidate synonyms
          const upBuyer = String(getExcelRowValue(row, ['Buyer', 'Buyer Name', 'Buyer\nName', 'Brand', 'Customer', 'BuyerName']) || '').trim();
          const upPlanMonth = String(getExcelRowValue(row, ['Plan Month', 'PlanMonth', 'Month', 'Month Name']) || '').trim();
          const upPlanType = String(getExcelRowValue(row, ['Plan Type', 'PlanType', 'Type', 'Order Type']) || '').trim();
          
          const rawKnitStart = getExcelRowValue(row, ['Knit Start', 'Knit Start Date', 'Planned Knit Start', 'Plan Knit Start', 'KnitStart', 'Start Date', 'Knit_Start'], '', { forbiddenWords: ['actual', 'a.', 'last', 'prod'] });
          const upKnitStart = rawKnitStart ? formatExcelDate(rawKnitStart) : '';

          const rawKnitEnd = getExcelRowValue(row, ['Knit End', 'Knit End Date', 'Planned Knit End', 'Plan Knit End', 'KnitEnd', 'End Date', 'Knit_End'], '', { forbiddenWords: ['actual', 'a.', 'last', 'prod'] });
          const upKnitEnd = rawKnitEnd ? formatExcelDate(rawKnitEnd) : '';

          const rawTarget = getExcelRowValue(row, ['Target', 'Target (Kg)', 'Target(Kg)', 'Target Qty', 'Order Target', 'Plan Target', 'Target_Kg']);
          const upTarget = parseExcelRoundUpNumber(rawTarget);

          const rawTargetNext = getExcelRowValue(row, ['Target  Next Month', 'Target Next Month', 'Target Next', 'Next Month Target', 'Next Target', 'Next Target (Kg)', 'NextMonthTarget']);
          const upTargetNextMonth = parseExcelRoundUpNumber(rawTargetNext);

          const rawAllocStart = getExcelRowValue(row, ['Allocation Start', 'Allocation Start Date', 'Alloc Start', 'Alloc. Start', 'AllocationStartDate']);
          const upAllocStart = rawAllocStart ? formatExcelDate(rawAllocStart) : '';

          const rawAllocEnd = getExcelRowValue(row, ['Allocation End', 'Allocation End Date', 'Alloc End', 'Alloc. End', 'AllocationEndDate']);
          const upAllocEnd = rawAllocEnd ? formatExcelDate(rawAllocEnd) : '';

          const rawAllocQty = getExcelRowValue(row, ['Allocated QTY', 'Allocated Qty', 'Allocated', 'Alloc Qty', 'Alloc. Qty', 'Allocated Quantity', 'AllocatedQty']);
          const upAllocQty = parseExcelNumber(rawAllocQty);

          const rawAllocBal = getExcelRowValue(row, ['Allocated Bal.', 'Allocated Bal', 'Alloc Bal', 'Alloc. Bal', 'Allocated Balance', 'AllocatedBal']);
          const upAllocBal = parseExcelNumber(rawAllocBal);

          const rawGreyReq = getExcelRowValue(row, ['GREY REQ.', 'GREY REQ', 'Grey Req.', 'Grey Req', 'Grey Requirement', 'Grey Qty', 'GreyQty', 'Grey Required', 'Grey Demand', 'GREY_REQ', 'GreyReq']);
          const upGreyReq = parseExcelNumber(rawGreyReq);

          const rawKnitPro = getExcelRowValue(row, ['KNIT PRO.', 'KNIT PRO', 'Knit Pro.', 'Knit Pro', 'Knitting Production', 'Knit Prod.', 'Knit Prod', 'Production', 'Total Prod', 'Total Production', 'Actual Knit Pro', 'KNIT_PRO', 'KnitPro']);
          const upKnitPro = parseExcelNumber(rawKnitPro);

          const rawKnitBal = getExcelRowValue(row, ['KNIT BAL.', 'KNIT BAL', 'Knit Bal.', 'Knit Bal', 'Knitting Balance', 'Knit Balance', 'Balance', 'Total Balance', 'Remaining Knit', 'KNIT_BAL', 'KnitBal']);
          const upKnitBal = parseExcelNumber(rawKnitBal);

          const rawAKnitStart = getExcelRowValue(row, ['A.Knit Start', 'A. Knit Start', 'A.Knit Start Date', 'A. Knit Start Date', 'Actual Knit Start', 'Actual Start', 'A. Knit Star', 'Actual Knit Start Date', 'A Knit Start', 'A_Knit_Start', 'AKnit Start', 'AKnitStart'], '', { forbiddenWords: ['planned', 'plan'], mustContain: ['actual', 'a.', 'aknit'] });
          const upAKnitStart = rawAKnitStart ? formatExcelDate(rawAKnitStart) : '';

          const rawLastProd = getExcelRowValue(row, [
            'Last Production Date',
            'Last Prod Date',
            'Last Prod. Date',
            'Last Prod',
            'Last Prod.',
            'A. Knit End/Last Production Date',
            'A. Knit End / Last Production Date',
            'A. Knit End/Last Prod Date',
            'A. Knit End / Last Prod Date',
            'A. Knit End/Last Prod',
            'A. Knit End / Last Prod',
            'A.Knit End/Last Production Date',
            'A.Knit End / Last Production Date',
            'A.Knit End/Last Prod Date',
            'A.Knit End / Last Prod',
            'Last Knitted Date',
            'Last Knit Date',
            'Latest Production Date',
            'Latest Prod Date',
            'A. Knit End',
            'A.Knit End',
            'Actual Knit End',
            'Actual Knit End Date',
            'A. Knit End Date',
            'A.Knit End Date',
            'LastProductionDate'
          ], '', { forbiddenWords: ['planned', 'plan'], mustContain: ['last', 'prod', 'actual', 'a.', 'aknit'] });
          const upLastProd = rawLastProd ? formatExcelDate(rawLastProd) : '';

          const rawAvgProd = getExcelRowValue(row, ['Avg Prod/Day', 'Avg. Prod/Day', 'Avg Prod / Day', 'Avg Prod', 'Avg.Prod/Day', 'Daily Avg Prod', 'Avg. Prod', 'Average Production/Day', 'AvgProdDay', 'Avg Prod Day']);
          const upAvgProd = parseExcelNumber(rawAvgProd);

          const rawExpEnd = getExcelRowValue(row, ['Expected Knit End', 'Exp Knit End', 'Expected End', 'Exp. Knit End', 'Exp Knit End Date', 'Expected Knit End Date', 'ExpectedKnitEnd'], '', { mustContain: ['exp'] });
          const upExpEnd = rawExpEnd ? formatExcelDate(rawExpEnd) : '';

          const rawKnitStartOtd = getExcelRowValue(row, ['Knit Start OTD', 'Start OTD', 'Knit Start Status', 'KnitStartOTD', 'StartOTD', 'Knit Start Otd']);
          const upKnitStartOtd = normalizeOtdValue(rawKnitStartOtd);

          const rawKnitEndOtd = getExcelRowValue(row, ['Knit End OTD', 'End OTD', 'Knit End Status', 'KnitEndOTD', 'EndOTD', 'Knit End Otd']);
          const upKnitEndOtd = normalizeOtdValue(rawKnitEndOtd);

          const upKnitStartRemarks = sanitizeRemarksValue(getExcelRowValue(row, ['Knit Start Remarks', 'Knit Start Delay Reason', 'Start Remarks', 'Start Delay Reason', 'Start Reason', 'Knit Start Remark', 'Start Remark', 'KnitStartRemarks']));
          const upKnitEndRemarks = sanitizeRemarksValue(getExcelRowValue(row, ['Knit End Remarks', 'Knit End Delay Reason', 'End Remarks', 'End Delay Reason', 'End Reason', 'Knit End Remark', 'End Remark', 'KnitEndRemarks']));
          const upTeamLeaders = String(getExcelRowValue(row, ['Knit Team Leaders', 'Knit Team Leader', 'Team Leaders', 'Team Leader', 'Team\nLeaders', 'Team\nLeader', 'TeamLeaders', 'TeamLeader', 'Leader', 'Leaders', 'Assigned Leader', 'KnitTeamLeaders']) || '').trim();

          if (targetIndex !== undefined) {
            // MATCHED EXISTING ORDER: SMART UPDATE & FILL BLANKS WITH DETAILED CHANGE TRACKING
            matchedOrdersCount++;
            const existing = mergedOrders[targetIndex];
            let rowChanged = false;
            const updated = { ...existing };
            const orderDiffs: OrderFieldDiff[] = [];

            // Helper for Date Fields with normalized display formatting comparison
            const applyDateField = (fieldName: keyof OrderPlan, uploadVal: string, fieldLabel: string) => {
              if (!uploadVal) return;
              const currentRaw = String(existing[fieldName] || '').trim();
              const currentFormatted = currentRaw ? formatDisplayDate(currentRaw) : '';
              const uploadFormatted = formatDisplayDate(uploadVal);

              if (!currentFormatted || currentFormatted === '-' || currentFormatted.toLowerCase() === 'pending') {
                (updated as any)[fieldName] = uploadVal;
                filledBlanksCount++;
                rowChanged = true;
                totalFieldsChangedCount++;
                orderDiffs.push({
                  fieldKey: fieldName,
                  fieldLabel,
                  oldValue: currentRaw || '(Blank)',
                  newValue: uploadFormatted,
                  isFilledBlank: true
                });
              } else if (currentFormatted !== uploadFormatted) {
                (updated as any)[fieldName] = uploadVal;
                rowChanged = true;
                totalFieldsChangedCount++;
                orderDiffs.push({
                  fieldKey: fieldName,
                  fieldLabel,
                  oldValue: currentFormatted,
                  newValue: uploadFormatted,
                  isFilledBlank: false
                });
              }
            };

            // Helper to apply string field: fill if blank, update if new in upload, keep if blank in upload
            const applyStringField = (fieldName: keyof OrderPlan, uploadVal: string, fieldLabel: string) => {
              if (!uploadVal) return; // Do not overwrite existing data with empty cells
              const currentVal = String(existing[fieldName] || '').trim();
              if (!currentVal) {
                (updated as any)[fieldName] = uploadVal;
                filledBlanksCount++;
                rowChanged = true;
                totalFieldsChangedCount++;
                orderDiffs.push({
                  fieldKey: fieldName,
                  fieldLabel,
                  oldValue: '(Blank)',
                  newValue: uploadVal,
                  isFilledBlank: true
                });
              } else if (currentVal !== uploadVal) {
                (updated as any)[fieldName] = uploadVal;
                rowChanged = true;
                totalFieldsChangedCount++;
                orderDiffs.push({
                  fieldKey: fieldName,
                  fieldLabel,
                  oldValue: currentVal,
                  newValue: uploadVal,
                  isFilledBlank: false
                });
              }
            };

            // Helper to apply numeric field: fill if 0, update if different
            const applyNumberField = (fieldName: keyof OrderPlan, uploadVal: number | undefined, fieldLabel: string) => {
              if (uploadVal === undefined || isNaN(uploadVal)) return;
              const currentVal = Number(existing[fieldName]) || 0;
              if (currentVal === 0 && uploadVal > 0) {
                (updated as any)[fieldName] = uploadVal;
                filledBlanksCount++;
                rowChanged = true;
                totalFieldsChangedCount++;
                orderDiffs.push({
                  fieldKey: fieldName,
                  fieldLabel,
                  oldValue: '0',
                  newValue: uploadVal.toLocaleString(),
                  isFilledBlank: true
                });
              } else if (currentVal !== uploadVal) {
                (updated as any)[fieldName] = uploadVal;
                rowChanged = true;
                totalFieldsChangedCount++;
                orderDiffs.push({
                  fieldKey: fieldName,
                  fieldLabel,
                  oldValue: currentVal.toLocaleString(),
                  newValue: uploadVal.toLocaleString(),
                  isFilledBlank: false
                });
              }
            };

            applyStringField('color', color, 'Color');
            applyStringField('buyer', upBuyer, 'Buyer');
            applyStringField('planMonth', upPlanMonth, 'Plan Month');
            applyStringField('planType', upPlanType, 'Plan Type');
            applyDateField('knitStart', upKnitStart, 'Knit Start (Planned)');
            applyDateField('knitEnd', upKnitEnd, 'Knit End (Planned)');
            applyNumberField('target', upTarget, 'Target (Kg)');
            applyNumberField('targetNextMonth', upTargetNextMonth, 'Target Next Month');
            applyDateField('allocationStart', upAllocStart, 'Allocation Start');
            applyDateField('allocationEnd', upAllocEnd, 'Allocation End');
            applyNumberField('allocatedQty', upAllocQty, 'Allocated QTY');
            applyNumberField('allocatedBal', upAllocBal, 'Allocated Bal.');
            applyNumberField('greyReq', upGreyReq, 'GREY REQ. (Kg)');
            applyNumberField('knitPro', upKnitPro, 'KNIT PRO. (Kg)');
            applyNumberField('knitBal', upKnitBal, 'KNIT BAL. (Kg)');
            applyDateField('aKnitStart', upAKnitStart, 'A. Knit Start (Actual)');
            applyDateField('lastProductionDate', upLastProd, 'A. Knit End/Last Production Date');
            applyNumberField('avgProdDay', upAvgProd, 'Avg Prod/Day');
            applyDateField('expectedKnitEnd', upExpEnd, 'Expected Knit End');
            
            if (upKnitStartOtd && existing.knitStartOtd !== upKnitStartOtd) {
              orderDiffs.push({
                fieldKey: 'knitStartOtd',
                fieldLabel: 'Knit Start OTD',
                oldValue: existing.knitStartOtd || 'Pending',
                newValue: upKnitStartOtd,
                isFilledBlank: !existing.knitStartOtd || existing.knitStartOtd === 'Pending'
              });
              updated.knitStartOtd = upKnitStartOtd;
              rowChanged = true;
              totalFieldsChangedCount++;
            }
            if (upKnitEndOtd && existing.knitEndOtd !== upKnitEndOtd) {
              orderDiffs.push({
                fieldKey: 'knitEndOtd',
                fieldLabel: 'Knit End OTD',
                oldValue: existing.knitEndOtd || 'Pending',
                newValue: upKnitEndOtd,
                isFilledBlank: !existing.knitEndOtd || existing.knitEndOtd === 'Pending'
              });
              updated.knitEndOtd = upKnitEndOtd;
              rowChanged = true;
              totalFieldsChangedCount++;
            }
            applyStringField('knitStartRemarks', upKnitStartRemarks, 'Knit Start Remarks');
            applyStringField('knitEndRemarks', upKnitEndRemarks, 'Knit End Remarks');
            applyStringField('knitTeamLeaders', upTeamLeaders, 'Team Leader');

            // Re-evaluate knit balance if production or greyReq updated and knitBal wasn't explicitly given
            if (upKnitBal === undefined && (upKnitPro !== undefined || upGreyReq !== undefined)) {
              const newBal = Math.max(0, (updated.greyReq || 0) - (updated.knitPro || 0));
              if (updated.knitBal !== newBal) {
                orderDiffs.push({
                  fieldKey: 'knitBal',
                  fieldLabel: 'KNIT BAL. (Auto-calculated)',
                  oldValue: (existing.knitBal || 0).toLocaleString(),
                  newValue: newBal.toLocaleString(),
                  isFilledBlank: false
                });
                updated.knitBal = newBal;
                rowChanged = true;
                totalFieldsChangedCount++;
              }
            }

            if (rowChanged) {
              mergedOrders[targetIndex] = updated;
              modifiedIndices.add(targetIndex);
              updatedOrdersCount++;

              const recKey = existing.id || getOrderPlanCanonicalId({ ewo: existing.ewo || ewo, color: existing.color || color });
              const existingRec = changesByOrderId.get(recKey);
              if (existingRec) {
                orderDiffs.forEach(diff => {
                  const dIdx = existingRec.changes.findIndex(c => c.fieldKey === diff.fieldKey);
                  if (dIdx >= 0) {
                    existingRec.changes[dIdx].newValue = diff.newValue;
                  } else {
                    existingRec.changes.push(diff);
                  }
                });
              } else {
                changesByOrderId.set(recKey, {
                  orderId: recKey,
                  ewo: existing.ewo || ewo,
                  color: updated.color || existing.color || '-',
                  buyer: updated.buyer || existing.buyer || '-',
                  planMonth: updated.planMonth || existing.planMonth,
                  isNew: false,
                  changes: orderDiffs
                });
              }
            }
          } else {
            // NEW ORDER / LINE ITEM: ADD IT WHILE PRESERVING ALL EXISTING DATA
            const cleanSl = rawSl && String(rawSl).trim() ? String(rawSl).trim().replace(/[^a-zA-Z0-9_-]/g, '') : '';
            const assignedId = cleanSl
              ? `${getOrderPlanCanonicalId({ ewo, color })}-SL${cleanSl}`
              : (occ === 1
                  ? getOrderPlanCanonicalId({ ewo, color })
                  : `${getOrderPlanCanonicalId({ ewo, color })}-LINE${occ}`);

            const newOrder: OrderPlan = {
              id: assignedId,
              planMonth: upPlanMonth || 'August',
              planType: upPlanType || 'Confirm',
              ewo,
              buyer: upBuyer || '',
              color: color || '',
              knitStart: upKnitStart || '',
              knitEnd: upKnitEnd || '',
              target: upTarget || 0,
              targetNextMonth: upTargetNextMonth || 0,
              allocationStart: upAllocStart || '',
              allocationEnd: upAllocEnd || '',
              allocatedQty: upAllocQty || 0,
              allocatedBal: upAllocBal || 0,
              greyReq: upGreyReq || 0,
              knitPro: upKnitPro || 0,
              knitBal: upKnitBal !== undefined ? upKnitBal : (upGreyReq || 0),
              aKnitStart: upAKnitStart || '',
              lastProductionDate: upLastProd || '',
              avgProdDay: upAvgProd || 0,
              expectedKnitEnd: upExpEnd || '',
              knitStartOtd: upKnitStartOtd || 'Pending',
              knitEndOtd: upKnitEndOtd || 'Pending',
              knitStartRemarks: upKnitStartRemarks || '',
              knitEndRemarks: upKnitEndRemarks || '',
              knitTeamLeaders: upTeamLeaders || ''
            };

            const newOrderIndex = mergedOrders.length;
            mergedOrders.push(newOrder);
            newOrderIndices.add(newOrderIndex);
            newOrdersCount++;

            const newOrderDiffs: OrderFieldDiff[] = [];
            if (upPlanMonth) newOrderDiffs.push({ fieldKey: 'planMonth', fieldLabel: 'Plan Month', oldValue: '(New)', newValue: upPlanMonth, isFilledBlank: true });
            if (upBuyer) newOrderDiffs.push({ fieldKey: 'buyer', fieldLabel: 'Buyer', oldValue: '(New)', newValue: upBuyer, isFilledBlank: true });
            if (color) newOrderDiffs.push({ fieldKey: 'color', fieldLabel: 'Color', oldValue: '(New)', newValue: color, isFilledBlank: true });
            if (upTarget) newOrderDiffs.push({ fieldKey: 'target', fieldLabel: 'Target (Kg)', oldValue: '(New)', newValue: upTarget.toLocaleString(), isFilledBlank: true });
            if (upGreyReq) newOrderDiffs.push({ fieldKey: 'greyReq', fieldLabel: 'GREY REQ. (Kg)', oldValue: '(New)', newValue: upGreyReq.toLocaleString(), isFilledBlank: true });
            if (upKnitPro) newOrderDiffs.push({ fieldKey: 'knitPro', fieldLabel: 'KNIT PRO. (Kg)', oldValue: '(New)', newValue: upKnitPro.toLocaleString(), isFilledBlank: true });
            if (upLastProd) newOrderDiffs.push({ fieldKey: 'lastProductionDate', fieldLabel: 'A. Knit End/Last Production Date', oldValue: '(New)', newValue: formatDisplayDate(upLastProd), isFilledBlank: true });
            if (upAKnitStart) newOrderDiffs.push({ fieldKey: 'aKnitStart', fieldLabel: 'A. Knit Start (Actual)', oldValue: '(New)', newValue: formatDisplayDate(upAKnitStart), isFilledBlank: true });

            changesByOrderId.set(newOrder.id, {
              orderId: newOrder.id,
              ewo,
              color: color || '-',
              buyer: upBuyer || '-',
              planMonth: upPlanMonth,
              isNew: true,
              changes: newOrderDiffs
            });
          }
        }

        setUploadProgressPercent(85);
        setUploadProgressStage('Calculating Metrics & Variance');
        setUploadProgressDetail('Applying deduplication & OTD analysis...');
        await new Promise(r => setTimeout(r, 60));

        const finalOrders = deduplicateOrderPlans(mergedOrders);
        const allChangedIndices = new Set([...newOrderIndices, ...modifiedIndices]);
        const changedOrders = deduplicateOrderPlans(
          Array.from(allChangedIndices).map(idx => mergedOrders[idx]).filter(Boolean)
        );
        const unalteredCount = Math.max(0, mergedOrders.length - allChangedIndices.size);
        const allChangesRecords = Array.from(changesByOrderId.values());

        // Auto-expand all updated/new orders initially for easy inspection
        const defaultExpanded = new Set<string>();
        allChangesRecords.forEach(r => defaultExpanded.add(r.orderId));
        setExpandedOrderIds(defaultExpanded);
        setChangeTab('changes');
        setChangeCategoryFilter('all');
        setChangeSearchQuery('');

        setUploadProgressPercent(100);
        setUploadProgressStage('Analysis Ready for Review');
        setUploadProgressDetail(`Found ${allChangesRecords.length} orders with updates or additions.`);
        await new Promise(r => setTimeout(r, 200));

        // Stage the parsed upload in memory — DO NOT save to database yet!
        // The user must explicitly confirm with "Save & Apply" or abort with "Cancel Upload".
        setStagedUpload({
          fileName: file.name,
          fileSize: file.size > 1024 * 1024 ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' : (file.size / 1024).toFixed(1) + ' KB',
          totalRows: allRows.length,
          mergedOrders: finalOrders,
          changedOrders,
          changesList: allChangesRecords,
          stats: {
            totalRowsProcessed: allRows.length,
            matchedOrdersCount,
            updatedOrdersCount,
            filledBlanksCount,
            newOrdersCount,
            unalteredCount,
            totalFieldsChanged: totalFieldsChangedCount
          }
        });
      } catch (err: any) {
        console.error('Smart file upload error:', err);
        setShowUploadModal(false);
        setStagedUpload(null);
        setUploadFeedback({
          show: true,
          title: 'Upload Failed',
          message: `Error reading file: ${err.message || String(err)}`
        });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Save Staged Upload: Commits all changed orders to Supabase cloud and updates local state
  const handleSaveStagedUpload = async () => {
    if (!stagedUpload) return;
    setIsSavingStaged(true);
    setUploadProgress({
      isUploading: true,
      loaded: 0,
      total: stagedUpload.mergedOrders.length,
      percent: 0,
      stage: 'Initiating upload to Supabase cloud database...'
    });

    try {
      const recordsToSave = stagedUpload.mergedOrders;
      await bulkSaveOrderPlans(recordsToSave, false, (processed, total, pct, stage) => {
        setUploadProgress({
          isUploading: true,
          loaded: processed,
          total,
          percent: pct,
          stage: stage || `Saving order plans to Supabase (${processed}/${total})...`
        });
      });
      setOrders(stagedUpload.mergedOrders);

      const now = new Date();
      setUploadInfo(prev => {
        const updated = {
          ...prev,
          lastUpdatedDate: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          lastUpdateTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          totalRecords: stagedUpload.mergedOrders.length,
          status: 'Success' as const
        };
        try { localStorage.setItem('order_plan_upload_info', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });

      setUploadProgress(prev => ({ ...prev, percent: 100, stage: 'Upload completed successfully!' }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, isUploading: false }));
      }, 1000);

      setUploadFeedback({
        show: true,
        title: 'Upload Saved Successfully',
        message: stagedUpload.stats.updatedOrdersCount > 0 || stagedUpload.stats.newOrdersCount > 0
          ? `Successfully saved ${stagedUpload.stats.updatedOrdersCount} updated orders (${stagedUpload.stats.totalFieldsChanged} fields) and ${stagedUpload.stats.newOrdersCount} new orders to the database.`
          : `Verified ${stagedUpload.stats.totalRowsProcessed} rows. Database is fully up to date with no differences found.`,
        mode: 'merge',
        stats: stagedUpload.stats,
        changesList: stagedUpload.changesList
      });

      setStagedUpload(null);
      setShowUploadModal(false);
    } catch (err: any) {
      console.error('Error saving staged upload:', err);
      setUploadProgress(prev => ({ ...prev, isUploading: false }));
      setUploadInfo(prev => ({ ...prev, status: 'Failed', errorMessage: err.message || String(err) }));
      alert('Failed to save orders to database: ' + (err.message || String(err)));
    } finally {
      setIsSavingStaged(false);
    }
  };

  // Cancel Staged Upload: Discard staged data completely without modifying the database
  const handleCancelStagedUpload = () => {
    setStagedUpload(null);
    setShowUploadModal(false);
    setIsUploading(false);
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
  };

  // Admin: Overwrite entire database with staged file data
  const handleAdminOverwriteWithStaged = async () => {
    if (!stagedUpload || !isAdmin) return;
    const confirmMsg = `Admin Overwrite Confirmation:\n\nAre you sure you want to completely PURGE all ${orders.length} current orders in the database and replace them with the ${stagedUpload.mergedOrders.length} orders from "${stagedUpload.fileName}"?\n\nThis action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsSavingStaged(true);
    setUploadProgress({
      isUploading: true,
      loaded: 0,
      total: stagedUpload.mergedOrders.length,
      percent: 0,
      stage: 'Purging database & overwriting with uploaded file...'
    });

    try {
      await bulkSaveOrderPlans(stagedUpload.mergedOrders, true, (processed, total, pct, stage) => {
        setUploadProgress({
          isUploading: true,
          loaded: processed,
          total,
          percent: pct,
          stage: stage || `Overwriting database in Supabase (${processed}/${total})...`
        });
      });
      setOrders(stagedUpload.mergedOrders);

      const now = new Date();
      setUploadInfo(prev => {
        const updated = {
          ...prev,
          lastUpdatedDate: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          lastUpdateTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          totalRecords: stagedUpload.mergedOrders.length,
          status: 'Success' as const
        };
        try { localStorage.setItem('order_plan_upload_info', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });

      setUploadProgress(prev => ({ ...prev, percent: 100, stage: 'Database overwrite completed!' }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, isUploading: false }));
      }, 1000);

      setUploadFeedback({
        show: true,
        title: 'Master Database Overwritten (Admin)',
        message: `Database purged and replaced with ${stagedUpload.mergedOrders.length} orders from "${stagedUpload.fileName}".`,
        mode: 'overwrite',
        stats: {
          totalRowsProcessed: stagedUpload.stats.totalRowsProcessed,
          matchedOrdersCount: 0,
          updatedOrdersCount: 0,
          filledBlanksCount: 0,
          newOrdersCount: stagedUpload.mergedOrders.length,
          unalteredCount: 0,
          purgedCount: orders.length
        }
      });

      setStagedUpload(null);
      setShowUploadModal(false);
    } catch (err: any) {
      console.error('Error overwriting database:', err);
      setUploadProgress(prev => ({ ...prev, isUploading: false }));
      setUploadInfo(prev => ({ ...prev, status: 'Failed', errorMessage: err.message || String(err) }));
      alert('Failed to overwrite database: ' + (err.message || String(err)));
    } finally {
      setIsSavingStaged(false);
    }
  };

  // Dedicated Purge All Codes & Database Reset Handler
  const handlePurgeAllWebData = async () => {
    setIsPurging(true);
    const prevCount = orders.length;
    setUploadProgress({
      isUploading: true,
      loaded: 0,
      total: prevCount,
      percent: 30,
      stage: 'Deleting all order codes from Supabase cloud database...'
    });

    try {
      await clearAllOrderPlans();
      setOrders([]);
      
      const now = new Date();
      setUploadInfo(prev => {
        const updated = {
          ...prev,
          totalRecords: 0,
          lastUpdatedDate: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          lastUpdateTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          status: 'Success' as const
        };
        try { localStorage.setItem('order_plan_upload_info', JSON.stringify(updated)); } catch (e) {}
        return updated;
      });
      try {
        localStorage.removeItem('cached_order_plans');
      } catch (e) {}

      setUploadProgress(prev => ({ ...prev, percent: 100, stage: 'Database purge completed!' }));
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, isUploading: false }));
      }, 700);

      setShowPurgeModal(false);
      setPurgeConfirmationText('');
      setUploadFeedback({
        show: true,
        title: 'All Database Codes Deleted Successfully',
        message: `Successfully deleted all ${prevCount.toLocaleString()} order plans and codes from the Supabase database. The database is now empty (0 records). You can now click "Upload Excel" to upload your data completely fresh.`,
        mode: 'overwrite',
        stats: {
          totalRowsProcessed: 0,
          matchedOrdersCount: 0,
          updatedOrdersCount: 0,
          filledBlanksCount: 0,
          newOrdersCount: 0,
          unalteredCount: 0,
          purgedCount: prevCount
        }
      });
    } catch (err: any) {
      console.error('Failed to purge database:', err);
      setUploadProgress(prev => ({ ...prev, isUploading: false }));
      alert('Error clearing database: ' + (err.message || String(err)));
    } finally {
      setIsPurging(false);
    }
  };

  const handleSmartFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSmartUploadFile(file);
    }
    if (e.target) e.target.value = '';
  };

  // Admin-Only Master Database Overwrite Handler
  const handleAdminOverwriteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAdmin) {
      alert("Access Denied: Only administrators are authorized to overwrite the database.");
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadProgressStage('Reading file for master database overwrite...');
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const allRows = extractRowsFromWorkbook(wb);

        if (allRows.length === 0) {
          setUploadFeedback({
            show: true,
            title: 'Empty Spreadsheet',
            message: 'The selected Excel file contains no valid data rows.',
            mode: 'overwrite'
          });
          setIsUploading(false);
          return;
        }

        const previousCount = orders.length;
        setUploadProgressStage(`Parsing ${allRows.length} rows...`);

        const replacementOrders: OrderPlan[] = [];
        const occurrenceCount = new Map<string, number>();

        allRows.forEach((row, rowIdx) => {
          const rawEwo = getExcelRowValue(row, [
            'EWO', 'Order No.', 'Order No', 'Order', 'Order Number', 'Order#', 'EWO No', 'EWO#', 'orderNo', 'OrderNo', 'Job No', 'Job#', 'Job No.'
          ]);
          const ewo = String(rawEwo || '').trim().replace(/^#+/, '');
          if (!ewo) return;

          const rawColor = getExcelRowValue(row, [
            'Color', 'Colour', 'Fabric Color', 'Fabric Colour', 'Fabric Shade', 'Shade', 'Item Color', 'Item Colour', 'Color Name', 'Colour Name', 'Colorway', 'Y/D Stripe', 'Color / Stripe', 'Colour / Stripe', 'Stripe'
          ]);
          const color = String(rawColor || '').trim();

          const rawSl = getExcelRowValue(row, [
            'SL', 'SL.', 'Sl No', 'Sl. No.', 'Sl', 'SL#', 'Serial', 'Serial No', 'Line', 'Line No', 'Line#', 'Item', 'Item No', 'Item#'
          ]);

          const ordKey = normOrderNum(ewo);
          const colKey = normColorName(color);
          const primaryKey = `${ordKey}___${colKey}`;

          const upBuyer = String(getExcelRowValue(row, ['Buyer', 'Buyer Name', 'Buyer\nName', 'Brand', 'Customer', 'BuyerName']) || '').trim();
          const upPlanMonth = String(getExcelRowValue(row, ['Plan Month', 'PlanMonth', 'Month', 'Month Name']) || '').trim();
          const upPlanType = String(getExcelRowValue(row, ['Plan Type', 'PlanType', 'Type', 'Order Type']) || '').trim();

          const rawKnitStart = getExcelRowValue(row, ['Knit Start', 'Knit Start Date', 'Planned Knit Start', 'Plan Knit Start', 'KnitStart', 'Start Date', 'Knit_Start'], '', { forbiddenWords: ['actual', 'a.', 'last', 'prod'] });
          const upKnitStart = rawKnitStart ? formatExcelDate(rawKnitStart) : '';

          const rawKnitEnd = getExcelRowValue(row, ['Knit End', 'Knit End Date', 'Planned Knit End', 'Plan Knit End', 'KnitEnd', 'End Date', 'Knit_End'], '', { forbiddenWords: ['actual', 'a.', 'last', 'prod'] });
          const upKnitEnd = rawKnitEnd ? formatExcelDate(rawKnitEnd) : '';

          const rawTarget = getExcelRowValue(row, ['Target', 'Target (Kg)', 'Target(Kg)', 'Target Qty', 'Order Target', 'Plan Target', 'Target_Kg']);
          const upTarget = parseExcelRoundUpNumber(rawTarget);

          const rawTargetNext = getExcelRowValue(row, ['Target  Next Month', 'Target Next Month', 'Target Next', 'Next Month Target', 'Next Target', 'Next Target (Kg)', 'NextMonthTarget']);
          const upTargetNextMonth = parseExcelRoundUpNumber(rawTargetNext);

          const rawAllocStart = getExcelRowValue(row, ['Allocation Start', 'Allocation Start Date', 'Alloc Start', 'Alloc. Start', 'AllocationStartDate']);
          const upAllocStart = rawAllocStart ? formatExcelDate(rawAllocStart) : '';

          const rawAllocEnd = getExcelRowValue(row, ['Allocation End', 'Allocation End Date', 'Alloc End', 'Alloc. End', 'AllocationEndDate']);
          const upAllocEnd = rawAllocEnd ? formatExcelDate(rawAllocEnd) : '';

          const rawAllocQty = getExcelRowValue(row, ['Allocated QTY', 'Allocated Qty', 'Allocated', 'Alloc Qty', 'Alloc. Qty', 'Allocated Quantity', 'AllocatedQty']);
          const upAllocQty = parseExcelNumber(rawAllocQty);

          const rawAllocBal = getExcelRowValue(row, ['Allocated Bal.', 'Allocated Bal', 'Alloc Bal', 'Alloc. Bal', 'Allocated Balance', 'AllocatedBal']);
          const upAllocBal = parseExcelNumber(rawAllocBal);

          const rawGreyReq = getExcelRowValue(row, ['GREY REQ.', 'GREY REQ', 'Grey Req.', 'Grey Req', 'Grey Requirement', 'Grey Qty', 'GreyQty', 'Grey Required', 'Grey Demand', 'GREY_REQ', 'GreyReq']);
          const upGreyReq = parseExcelNumber(rawGreyReq);

          const rawKnitPro = getExcelRowValue(row, ['KNIT PRO.', 'KNIT PRO', 'Knit Pro.', 'Knit Pro', 'Knitting Production', 'Knit Prod.', 'Knit Prod', 'Production', 'Total Prod', 'Total Production', 'Actual Knit Pro', 'KNIT_PRO', 'KnitPro']);
          const upKnitPro = parseExcelNumber(rawKnitPro);

          const rawKnitBal = getExcelRowValue(row, ['KNIT BAL.', 'KNIT BAL', 'Knit Bal.', 'Knit Bal', 'Knitting Balance', 'Knit Balance', 'Balance', 'Total Balance', 'Remaining Knit', 'KNIT_BAL', 'KnitBal']);
          const upKnitBal = parseExcelNumber(rawKnitBal) !== undefined
            ? parseExcelNumber(rawKnitBal)
            : (upGreyReq !== undefined ? Math.max(0, (upGreyReq || 0) - (upKnitPro || 0)) : undefined);

          const rawAKnitStart = getExcelRowValue(row, [
            'A.Knit Start', 'A. Knit Start', 'A.Knit Start Date', 'A. Knit Start Date', 'Actual Knit Start', 'Actual Start', 'A. Knit Star', 'Actual Knit Start Date', 'A Knit Start', 'A_Knit_Start', 'AKnit Start', 'AKnitStart'
          ], '', { forbiddenWords: ['planned', 'plan'], mustContain: ['actual', 'a.', 'aknit'] });
          const upAKnitStart = rawAKnitStart ? formatExcelDate(rawAKnitStart) : '';

          const rawLastProd = getExcelRowValue(row, [
            'Last Production Date',
            'Last Prod Date',
            'Last Prod. Date',
            'Last Prod',
            'Last Prod.',
            'A. Knit End/Last Production Date',
            'A. Knit End / Last Production Date',
            'A. Knit End/Last Prod Date',
            'A. Knit End / Last Prod Date',
            'A. Knit End/Last Prod',
            'A. Knit End / Last Prod',
            'A.Knit End/Last Production Date',
            'A.Knit End / Last Production Date',
            'A.Knit End/Last Prod Date',
            'A.Knit End / Last Prod',
            'Last Knitted Date',
            'Last Knit Date',
            'Latest Production Date',
            'Latest Prod Date',
            'A. Knit End',
            'A.Knit End',
            'Actual Knit End',
            'Actual Knit End Date',
            'A. Knit End Date',
            'A.Knit End Date',
            'LastProductionDate'
          ], '', { forbiddenWords: ['planned', 'plan'], mustContain: ['last', 'prod', 'actual', 'a.', 'aknit'] });
          const upLastProd = rawLastProd ? formatExcelDate(rawLastProd) : '';

          const rawAvgProd = getExcelRowValue(row, ['Avg Prod/Day', 'Avg. Prod/Day', 'Avg Prod / Day', 'Avg Prod', 'Avg.Prod/Day', 'Daily Avg Prod', 'Avg. Prod', 'Average Production/Day', 'AvgProdDay', 'Avg Prod Day']);
          const upAvgProd = parseExcelNumber(rawAvgProd);

          const rawExpEnd = getExcelRowValue(row, ['Expected Knit End', 'Exp Knit End', 'Expected End', 'Exp. Knit End', 'Exp Knit End Date', 'Expected Knit End Date', 'ExpectedKnitEnd'], '', { mustContain: ['exp'] });
          const upExpEnd = rawExpEnd ? formatExcelDate(rawExpEnd) : '';

          const rawKnitStartOtd = getExcelRowValue(row, ['Knit Start OTD', 'Start OTD', 'Knit Start Status', 'KnitStartOTD', 'StartOTD', 'Knit Start Otd']);
          const upKnitStartOtd = normalizeOtdValue(rawKnitStartOtd);

          const rawKnitEndOtd = getExcelRowValue(row, ['Knit End OTD', 'End OTD', 'Knit End Status', 'KnitEndOTD', 'EndOTD', 'Knit End Otd']);
          const upKnitEndOtd = normalizeOtdValue(rawKnitEndOtd);

          const upKnitStartRemarks = sanitizeRemarksValue(getExcelRowValue(row, ['Knit Start Remarks', 'Knit Start Delay Reason', 'Start Remarks', 'Start Delay Reason', 'Start Reason', 'Knit Start Remark', 'Start Remark', 'KnitStartRemarks']));
          const upKnitEndRemarks = sanitizeRemarksValue(getExcelRowValue(row, ['Knit End Remarks', 'Knit End Delay Reason', 'End Remarks', 'End Delay Reason', 'End Reason', 'Knit End Remark', 'End Remark', 'KnitEndRemarks']));
          const upTeamLeaders = String(getExcelRowValue(row, ['Knit Team Leaders', 'Knit Team Leader', 'Team Leaders', 'Team Leader', 'Team\nLeaders', 'Team\nLeader', 'TeamLeaders', 'TeamLeader', 'Leader', 'Leaders', 'Assigned Leader', 'KnitTeamLeaders']) || '').trim();

          const count = (occurrenceCount.get(primaryKey) || 0) + 1;
          occurrenceCount.set(primaryKey, count);
          const assignedId = count === 1 
            ? getOrderPlanCanonicalId({ ewo, color }) 
            : `${getOrderPlanCanonicalId({ ewo, color })}-LINE${count}`;

          const newOrder: OrderPlan = {
            id: assignedId,
            planMonth: upPlanMonth || 'August',
            planType: upPlanType || 'Confirm',
            ewo,
            buyer: upBuyer || '',
            color: color || '',
            knitStart: upKnitStart || '',
            knitEnd: upKnitEnd || '',
            target: upTarget || 0,
            targetNextMonth: upTargetNextMonth || 0,
            allocationStart: upAllocStart || '',
            allocationEnd: upAllocEnd || '',
            allocatedQty: upAllocQty || 0,
            allocatedBal: upAllocBal || 0,
            greyReq: upGreyReq || 0,
            knitPro: upKnitPro || 0,
            knitBal: upKnitBal !== undefined ? upKnitBal : (upGreyReq || 0),
            aKnitStart: upAKnitStart || '',
            lastProductionDate: upLastProd || '',
            avgProdDay: upAvgProd || 0,
            expectedKnitEnd: upExpEnd || '',
            knitStartOtd: upKnitStartOtd || 'Pending',
            knitEndOtd: upKnitEndOtd || 'Pending',
            knitStartRemarks: upKnitStartRemarks || '',
            knitEndRemarks: upKnitEndRemarks || '',
            knitTeamLeaders: upTeamLeaders || ''
          };

          replacementOrders.push(newOrder);
        });

        setUploadProgressStage(`Purging ${previousCount} old records and persisting ${replacementOrders.length} replacement records...`);
        setUploadProgress({
          isUploading: true,
          loaded: 0,
          total: replacementOrders.length,
          percent: 0,
          stage: `Purging ${previousCount} old records and persisting ${replacementOrders.length} records...`
        });

        // OVERWRITE: execute with replace: true to purge and replace
        const cleanReplacements = deduplicateOrderPlans(replacementOrders);
        await bulkSaveOrderPlans(cleanReplacements, true, (processed, total, pct, stage) => {
          setUploadProgress({
            isUploading: true,
            loaded: processed,
            total,
            percent: pct,
            stage: stage || `Overwriting database in Supabase (${processed}/${total})...`
          });
        });
        setOrders(cleanReplacements);

        const now = new Date();
        setUploadInfo(prev => {
          const updated = {
            ...prev,
            lastUpdatedDate: now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            lastUpdateTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
            totalRecords: cleanReplacements.length,
            status: 'Success' as const
          };
          try { localStorage.setItem('order_plan_upload_info', JSON.stringify(updated)); } catch (e) {}
          return updated;
        });

        setUploadProgress(prev => ({ ...prev, percent: 100, stage: 'Database overwrite completed!' }));
        setTimeout(() => {
          setUploadProgress(prev => ({ ...prev, isUploading: false }));
        }, 1000);

        setUploadFeedback({
          show: true,
          title: 'Master Database Overwritten (Admin)',
          message: `The database has been completely replaced with ${replacementOrders.length} records parsed from your uploaded file. All ${previousCount} previous records have been purged.`,
          mode: 'overwrite',
          stats: {
            totalRowsProcessed: allRows.length,
            matchedOrdersCount: 0,
            updatedOrdersCount: 0,
            filledBlanksCount: 0,
            newOrdersCount: replacementOrders.length,
            unalteredCount: 0,
            purgedCount: previousCount
          }
        });
      } catch (err: any) {
        console.error('Admin overwrite upload error:', err);
        setUploadProgress(prev => ({ ...prev, isUploading: false }));
        setUploadInfo(prev => ({ ...prev, status: 'Failed', errorMessage: err.message || String(err) }));
        setUploadFeedback({
          show: true,
          title: 'Database Overwrite Failed',
          message: `Error during database overwrite: ${err.message || String(err)}`,
          mode: 'overwrite'
        });
      } finally {
        setIsUploading(false);
        setUploadProgressStage('');
        setShowAdminOverwriteModal(false);
        setOverwriteConfirmedCheckbox(false);
        if (e.target) e.target.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  // Export to Excel (.xlsx) with granular progress tracking
  const exportToExcel = async () => {
    setExportProgress({
      isExporting: true,
      percent: 15,
      message: 'Preparing dataset for export...'
    });

    await new Promise(r => setTimeout(r, 60));

    setExportProgress({
      isExporting: true,
      percent: 35,
      message: `Formatting ${filteredOrders.length.toLocaleString()} order plan records...`
    });

    const headers = [
      "Plan Month","Plan Type","EWO","Buyer","Color","Planned Knit Start","Planned Knit End",
      "Target (Kg)","Target Next Month (Kg)","Allocation Start","Allocation End","Allocated Qty (Kg)",
      "Allocated Bal (Kg)","Grey Req (Kg)","Knit Pro (Kg)","Knit Bal (Kg)","A. Knit Start (Actual)",
      "Start Variance","A. Knit End/Last Production Date","End Variance",
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
        o.avgProdDay, ((o.knitBal !== undefined && o.knitBal !== null && !isNaN(Number(o.knitBal)) && Number(o.knitBal) < 0) ? '' : formatDisplayDate(o.expectedKnitEnd)), o.knitStartOtd,
        o.knitEndOtd, o.knitStartRemarks, o.knitEndRemarks, o.knitTeamLeaders || ''
      ];
    });

    setExportProgress({
      isExporting: true,
      percent: 70,
      message: 'Generating Excel workbook...'
    });
    await new Promise(r => setTimeout(r, 60));

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Order Plan Status");

    setExportProgress({
      isExporting: true,
      percent: 90,
      message: 'Writing file to browser...'
    });
    await new Promise(r => setTimeout(r, 60));

    XLSX.writeFile(workbook, `Order_Plan_Status_${new Date().toISOString().slice(0,10)}.xlsx`);

    setExportProgress({
      isExporting: true,
      percent: 100,
      message: 'Excel Export Completed!'
    });
    setTimeout(() => {
      setExportProgress(prev => ({ ...prev, isExporting: false }));
    }, 1000);
  };

  // Upload Summary Modal Computed Filter & Actions (supports staged review & feedback)
  const activeChangesList = stagedUpload?.changesList || uploadFeedback?.changesList || [];
  const activeStats = stagedUpload?.stats || uploadFeedback?.stats;

  const filteredUploadChanges = useMemo(() => {
    if (!activeChangesList || activeChangesList.length === 0) return [];
    return activeChangesList.filter(item => {
      // 1. Search Query Filter
      if (changeSearchQuery.trim()) {
        const q = changeSearchQuery.toLowerCase().trim();
        const matchOrder = item.ewo.toLowerCase().includes(q) ||
          item.buyer.toLowerCase().includes(q) ||
          item.color.toLowerCase().includes(q) ||
          (item.planMonth && item.planMonth.toLowerCase().includes(q));
        const matchField = item.changes.some(c => 
          c.fieldLabel.toLowerCase().includes(q) ||
          String(c.oldValue).toLowerCase().includes(q) ||
          String(c.newValue).toLowerCase().includes(q)
        );
        if (!matchOrder && !matchField) return false;
      }

      // 2. Category Filter
      if (changeCategoryFilter === 'new') {
        return item.isNew;
      }
      if (changeCategoryFilter === 'dates') {
        return item.changes.some(c => 
          c.fieldKey === 'lastProductionDate' ||
          c.fieldKey === 'aKnitStart' ||
          c.fieldKey === 'knitStart' ||
          c.fieldKey === 'knitEnd' ||
          c.fieldKey === 'expectedKnitEnd' ||
          c.fieldKey === 'allocationStart' ||
          c.fieldKey === 'allocationEnd'
        );
      }
      if (changeCategoryFilter === 'progress') {
        return item.changes.some(c => 
          c.fieldKey === 'knitPro' ||
          c.fieldKey === 'knitBal' ||
          c.fieldKey === 'greyReq' ||
          c.fieldKey === 'target' ||
          c.fieldKey === 'allocatedQty' ||
          c.fieldKey === 'allocatedBal' ||
          c.fieldKey === 'avgProdDay'
        );
      }
      if (changeCategoryFilter === 'remarks') {
        return item.changes.some(c => 
          c.fieldKey === 'knitStartRemarks' ||
          c.fieldKey === 'knitEndRemarks' ||
          c.fieldKey === 'knitTeamLeaders' ||
          c.fieldKey === 'knitStartOtd' ||
          c.fieldKey === 'knitEndOtd'
        );
      }
      return true;
    });
  }, [activeChangesList, changeSearchQuery, changeCategoryFilter]);

  const handleCopyChangeSummary = () => {
    if (!activeChangesList || activeChangesList.length === 0) return;
    let text = `=== EXCEL UPLOAD FIELD CHANGE SUMMARY ===\n`;
    text += `Time: ${new Date().toLocaleString()}\n`;
    text += `Rows Processed: ${activeStats?.totalRowsProcessed || 0}\n`;
    text += `Orders Updated: ${activeStats?.updatedOrdersCount || 0}\n`;
    text += `Total Fields Modified: ${activeStats?.totalFieldsChanged || 0}\n`;
    text += `New Orders Added: ${activeStats?.newOrdersCount || 0}\n`;
    text += `Unaltered Orders: ${activeStats?.unalteredCount || 0}\n\n`;

    activeChangesList.forEach((rec, idx) => {
      text += `[${rec.isNew ? 'NEW ORDER' : 'UPDATED'}] #${idx + 1} EWO: ${rec.ewo} | Buyer: ${rec.buyer} | Color: ${rec.color}\n`;
      rec.changes.forEach(ch => {
        text += `   • ${ch.fieldLabel}: ${ch.oldValue} -> ${ch.newValue} ${ch.isFilledBlank ? '(Filled Blank)' : ''}\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const toggleExpandOrder = (orderId: string) => {
    setExpandedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (!activeChangesList || activeChangesList.length === 0) return;
    if (expandedOrderIds.size === activeChangesList.length) {
      setExpandedOrderIds(new Set());
    } else {
      const all = new Set<string>();
      activeChangesList.forEach(c => all.add(c.orderId));
      setExpandedOrderIds(all);
    }
  };

  return (
    <div 
      className="space-y-5 pb-8 relative"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          setIsDraggingPage(true);
        }
      }}
    >
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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={uploadInputRef}
            onChange={handleSmartFileUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
            id="plan-order-excel-file-input"
          />

          <input
            type="file"
            ref={overwriteInputRef}
            onChange={handleAdminOverwriteUpload}
            accept=".xlsx, .xls, .csv"
            className="hidden"
            id="plan-order-admin-overwrite-input"
          />

          {/* Merged Upload Excel Button (Opens upload modal with Smart Merge, Exclusive Dataset, and Admin Overwrite DB) */}
          <button
            onClick={() => setShowUploadModal(true)}
            disabled={isUploading}
            className="flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-60"
            title="Upload Excel (Smart Merge or Admin Master Overwrite)"
            id="smart-upload-order-btn"
          >
            <Upload className={`h-4 w-4 text-blue-600 dark:text-blue-400 ${isUploading ? 'animate-bounce' : ''}`} />
            <span>{isUploading ? (uploadProgressStage || 'Updating...') : 'Upload Excel'}</span>
          </button>

          <button
            onClick={() => loadOrders(true)}
            disabled={isSyncing}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs disabled:opacity-60"
            title="Download and refresh data from Supabase web database"
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

      {/* DOWNLOAD PROGRESS BAR (SUPABASE STREAMING) */}
      {downloadProgress.isDownloading && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50/90 via-blue-50/70 to-indigo-50/90 dark:from-indigo-950/60 dark:via-slate-900 dark:to-indigo-950/60 p-4 shadow-sm animate-pulse-subtle">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                  Downloading Order Plans from Supabase
                </span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block font-medium">
                  {downloadProgress.stage || 'Loading records via paginated streaming...'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black font-mono text-indigo-700 dark:text-indigo-300">
                {downloadProgress.percent}%
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
                {downloadProgress.loaded.toLocaleString()}{downloadProgress.total > 0 ? ` / ${downloadProgress.total.toLocaleString()}` : ''} rows
              </span>
            </div>
          </div>
          {/* Progress track */}
          <div className="w-full bg-indigo-100 dark:bg-indigo-950/80 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(5, downloadProgress.percent))}%` }}
            />
          </div>
        </div>
      )}

      {/* UPLOAD PROGRESS BAR (SUPABASE MASTER UPLOAD) */}
      {uploadProgress.isUploading && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-blue-50/90 dark:from-blue-950/60 dark:via-slate-900 dark:to-blue-950/60 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <UploadCloud className="h-4 w-4 animate-bounce" />
              </div>
              <div>
                <span className="text-xs font-bold text-blue-950 dark:text-blue-200 block">
                  Uploading Dataset to Supabase Database
                </span>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 block font-medium">
                  {uploadProgress.stage || 'Saving chunks...'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black font-mono text-blue-700 dark:text-blue-300">
                {uploadProgress.percent}%
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-mono">
                {uploadProgress.loaded.toLocaleString()} / {uploadProgress.total.toLocaleString()} rows
              </span>
            </div>
          </div>
          {/* Progress track */}
          <div className="w-full bg-blue-100 dark:bg-blue-950/80 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(4, uploadProgress.percent))}%` }}
            />
          </div>
        </div>
      )}

      {/* EXPORT PROGRESS BAR (EXCEL FILE GENERATION) */}
      {exportProgress.isExporting && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/50 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Download className="h-4 w-4 animate-pulse" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 block">
                  Exporting Excel Spreadsheet
                </span>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">
                  {exportProgress.message}
                </span>
              </div>
            </div>
            <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">
              {exportProgress.percent}%
            </span>
          </div>
          <div className="w-full bg-emerald-100 dark:bg-emerald-950/80 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-emerald-600 h-2.5 rounded-full transition-all duration-200 ease-out"
              style={{ width: `${exportProgress.percent}%` }}
            />
          </div>
        </div>
      )}

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
                {displayTeamLeaders.map((tl, tlIdx) => {
                  const tlOrders = filteredOrders.filter(o => {
                    const leader = o.knitTeamLeaders?.trim() || 'Unassigned';
                    return leader === tl;
                  });
                  if (tlOrders.length === 0 && teamLeaderFilter === 'All') return null;

                  const totalOrders = tlOrders.length;
                  const targetQty = tlOrders.reduce((sum, o) => sum + Math.ceil(o.target || 0), 0);
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
                    <div key={`${tl}-${tlIdx}`} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
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
                {displayBuyers.map((b, bIdx) => {
                  const buyerOrders = filteredOrders.filter(o => o.buyer === b);
                  if (buyerOrders.length === 0 && buyerFilter === 'All') return null;

                  const totalOrders = buyerOrders.length;
                  const targetQty = buyerOrders.reduce((sum, o) => sum + Math.ceil(o.target || 0), 0);
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
                    <div key={`${b}-${bIdx}`} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all">
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

              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 transition-all cursor-pointer shadow-2xs w-full sm:w-auto disabled:opacity-60"
                title="Upload Excel to update data & fill blanks"
              >
                <Upload className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ${isUploading ? 'animate-bounce' : ''}`} />
                <span>{isUploading ? 'Updating...' : 'Upload Excel'}</span>
              </button>

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
                    paginatedOrders.map((ord, ordIdx) => {
                      const startVar = calculateDateVariance(ord.knitStart, ord.aKnitStart);
                      const endVar = calculateDateVariance(ord.knitEnd, ord.lastProductionDate);

                      return (
                        <tr key={ord.id ? `${ord.id}-${ordIdx}` : `ord-${ordIdx}`} className="group hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
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
                                {ord.ewo || (ord as any).orderNumber || (ord as any).orderNo || (ord as any).bookingNo || '-'}
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
                              {ord.target ? Math.ceil(ord.target).toLocaleString() : '0'}
                            </td>
                          )}
                          {isColVisible('targetNextMonth') && (
                            <td style={{ width: `${getColWidth('targetNextMonth')}px`, minWidth: `${getColWidth('targetNextMonth')}px`, maxWidth: `${getColWidth('targetNextMonth')}px`, ...getStickyStyle('targetNextMonth') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right text-slate-500 ${getStickyClass('targetNextMonth')}`}>
                              {ord.targetNextMonth ? Math.ceil(Number(ord.targetNextMonth)).toLocaleString() : '-'}
                            </td>
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
                            <td style={{ width: `${getColWidth('allocatedBal')}px`, minWidth: `${getColWidth('allocatedBal')}px`, maxWidth: `${getColWidth('allocatedBal')}px`, ...getStickyStyle('allocatedBal') }} className={`px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right text-slate-500 ${getStickyClass('allocatedBal')}`}>
                              {ord.allocatedBal !== undefined && ord.allocatedBal !== null ? ord.allocatedBal.toLocaleString() : '-'}
                            </td>
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
                              {(ord.knitBal !== undefined && ord.knitBal !== null && !isNaN(Number(ord.knitBal)) && Number(ord.knitBal) < 0) ? '-' : formatDisplayDate(ord.expectedKnitEnd)}
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

      {/* SMART UPLOAD EXCEL MODAL WITH AUTO-MATCH & STAGED SAVE/CANCEL FLOW */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          {stagedUpload ? (
            /* STAGED REVIEW & CONFIRMATION SCREEN (Explicit Save & Cancel Buttons) */
            <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-fade-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-2xs">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Review Staged Changes: {stagedUpload.fileName}
                      </h3>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                        Pending Save
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      {stagedUpload.fileSize} • {stagedUpload.totalRows} rows analyzed • Verify changes before saving to database
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelStagedUpload}
                  disabled={isSavingStaged}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title="Close & discard staged changes"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* 4 Key Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">Total Rows Analyzed</span>
                    <span className="text-xl font-extrabold font-mono text-slate-900 dark:text-white block mt-0.5">
                      {stagedUpload.stats.totalRowsProcessed}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40">
                    <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 block">Orders to Update</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-extrabold font-mono text-blue-900 dark:text-blue-100">
                        {stagedUpload.stats.updatedOrdersCount}
                      </span>
                      <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">
                        ({stagedUpload.stats.totalFieldsChanged} fields)
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
                    <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 block">Blanks to Fill</span>
                    <span className="text-xl font-extrabold font-mono text-amber-900 dark:text-amber-100 block mt-0.5">
                      {stagedUpload.stats.filledBlanksCount}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">New Orders Found</span>
                    <span className="text-xl font-extrabold font-mono text-emerald-900 dark:text-emerald-100 block mt-0.5">
                      {stagedUpload.stats.newOrdersCount}
                    </span>
                  </div>
                </div>

                {/* Staged Confirmation Warning Banner */}
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Action Required:</strong> These changes are currently staged in memory and have <strong>NOT</strong> been saved to your database. Review the changes below, then click <strong>"Save & Apply to Database"</strong> to save them, or click <strong>"Cancel Upload"</strong> to discard them without touching any existing data.
                  </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={changeSearchQuery}
                      onChange={(e) => setChangeSearchQuery(e.target.value)}
                      placeholder="Search order #, buyer, color, field..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        changeCategoryFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      All ({activeChangesList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('dates')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        changeCategoryFilter === 'dates'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Dates
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('progress')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        changeCategoryFilter === 'progress'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Progress / Balances
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('new')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        changeCategoryFilter === 'new'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      New Orders ({stagedUpload.stats.newOrdersCount})
                    </button>

                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      className="ml-auto px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
                    >
                      {expandedOrderIds.size === activeChangesList.length ? 'Collapse All' : 'Expand All'}
                    </button>

                    <button
                      type="button"
                      onClick={handleCopyChangeSummary}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center gap-1"
                      title="Copy diff summary to clipboard"
                    >
                      {copiedSummary ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedSummary ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Changed Orders Accordion List (Constrained scrollable height to comfortably fit viewport) */}
                <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1.5 scrollbar-thin">
                  {filteredUploadChanges.length === 0 ? (
                    <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {stagedUpload.changesList.length === 0
                          ? 'No differences found: All data in this file exactly matches the current database.'
                          : 'No orders match your filter criteria.'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {stagedUpload.changesList.length === 0
                          ? 'You can still click Save to verify, or Cancel to dismiss.'
                          : 'Try changing the filter or search query.'}
                      </p>
                    </div>
                  ) : (
                    filteredUploadChanges.map((rec) => {
                      const isExpanded = expandedOrderIds.has(rec.orderId);
                      return (
                        <div
                          key={rec.orderId}
                          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 overflow-hidden shadow-2xs"
                        >
                          {/* Card Header */}
                          <div
                            onClick={() => toggleExpandOrder(rec.orderId)}
                            className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                              <span className="font-mono font-black text-xs px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                                {rec.ewo}
                              </span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {rec.color}
                              </span>
                              {rec.buyer && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  ({rec.buyer})
                                </span>
                              )}
                              {rec.isNew ? (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300">
                                  New Order
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {rec.changes.length} {rec.changes.length === 1 ? 'field update' : 'fields updated'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Card Diff Table (Constrained height with inner scrolling) */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-3 max-h-60 overflow-y-auto scrollbar-thin">
                              <div className="space-y-1.5">
                                {rec.changes.map((ch, cIdx) => (
                                  <div
                                    key={cIdx}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-slate-700 dark:text-slate-300">
                                        {ch.fieldLabel}
                                      </span>
                                      {ch.isFilledBlank && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
                                          Blank Filled
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[11px]">
                                      <span className="text-slate-400 line-through">
                                        {String(ch.oldValue ?? '') || '(blank)'}
                                      </span>
                                      <ArrowRight className="h-3 w-3 text-slate-400" />
                                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                        {String(ch.newValue ?? '') || '(blank)'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Footer with Explicit Save and Cancel Buttons */}
              <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleCancelStagedUpload}
                  disabled={isSavingStaged}
                  className="px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                  id="cancel-upload-staged-btn"
                >
                  <X className="h-4 w-4 text-rose-500" />
                  <span>Cancel Upload (Discard Changes)</span>
                </button>

                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleAdminOverwriteWithStaged}
                      disabled={isSavingStaged}
                      className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Admin: Purge existing records and overwrite completely with this file"
                    >
                      <Database className="h-3.5 w-3.5" />
                      <span>Overwrite All (Admin)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveStagedUpload}
                    disabled={isSavingStaged}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    id="save-upload-staged-btn"
                  >
                    {isSavingStaged ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Saving Changes to Database...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Save & Apply to Database</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* COMPACT INITIAL DROPZONE MODAL (No huge columns or manual options) */
            <div className="w-full max-w-md max-h-[85vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col animate-fade-in">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-2xs">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Upload Order Plan Spreadsheet
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Smart match, preview & verify before saving
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!isUploading) {
                      setShowUploadModal(false);
                      setIsDraggingDropzone(false);
                    }
                  }}
                  disabled={isUploading}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto">
                {isUploading ? (
                  /* Uploading & Processing State: Progress Bar */
                  <div className="py-2 space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/50">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileSpreadsheet className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{uploadFileName || 'Spreadsheet file'}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">{uploadFileSize || 'Processing'}</p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-blue-600 text-white shadow-xs">
                        {uploadProgressPercent}%
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 text-xs">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                          </span>
                          <span>{uploadProgressStage || 'Analyzing rows...'}</span>
                        </span>
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold text-xs">{uploadProgressPercent}%</span>
                      </div>

                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-700 shadow-inner">
                        <div
                          className="h-full rounded-full bg-linear-to-r from-blue-600 via-indigo-600 to-sky-500 transition-all duration-300 ease-out shadow-xs relative"
                          style={{ width: `${Math.max(4, uploadProgressPercent)}%` }}
                        />
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate pt-0.5">
                        {uploadProgressDetail || 'Comparing orders and staging differences...'}
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] font-bold">
                      <div className={`p-1.5 rounded-lg border transition-all ${uploadProgressPercent >= 20 ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800'}`}>
                        1. Read
                      </div>
                      <div className={`p-1.5 rounded-lg border transition-all ${uploadProgressPercent >= 40 ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800'}`}>
                        2. Match
                      </div>
                      <div className={`p-1.5 rounded-lg border transition-all ${uploadProgressPercent >= 80 ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800'}`}>
                        3. Diff
                      </div>
                      <div className={`p-1.5 rounded-lg border transition-all ${uploadProgressPercent >= 95 ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300' : 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800'}`}>
                        4. Review
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Compact Drag & Drop Zone */
                  <>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingDropzone(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingDropzone(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingDropzone(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          processSmartUploadFile(e.dataTransfer.files[0]);
                        }
                      }}
                      onClick={() => uploadInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl py-6 px-4 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 group ${
                        isDraggingDropzone
                          ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 ring-4 ring-blue-500/20 scale-[1.01]'
                          : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-blue-50/20'
                      }`}
                      id="order-plan-upload-dropzone"
                    >
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-2xs ${
                        isDraggingDropzone 
                          ? 'bg-blue-600 text-white animate-bounce' 
                          : 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400'
                      }`}>
                        <UploadCloud className="h-5 w-5" />
                      </div>

                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {isDraggingDropzone ? 'Release file to start Smart Upload' : 'Click to browse or drag & drop Excel file'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">
                          Supports .xlsx, .xls, and .csv formats
                        </span>
                      </div>
                    </div>

                    {/* Smart Auto-Detection Callout */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-200">
                      <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        <strong>Smart Auto-Match:</strong> The app automatically compares spreadsheet rows against existing orders by Order # and Color. It updates differing figures, fills blank dates, and appends new orders safely.
                      </p>
                    </div>

                    {/* Safe Preview Guarantee */}
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        <strong>Preview & Confirm:</strong> Nothing is saved immediately. You can review all detected differences and click <strong>Save</strong> or <strong>Cancel</strong> before anything touches your database.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!isUploading && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-5 py-3 bg-slate-50/80 dark:bg-slate-800/40 shrink-0">
                  <div className="flex items-center gap-2">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowUploadModal(false);
                          setOverwriteConfirmedCheckbox(false);
                          setShowAdminOverwriteModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Purge database and overwrite completely with a new Excel file"
                      >
                        <Database className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                        <span>Overwrite DB (Admin)</span>
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="px-4 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* FULL PAGE DRAG & DROP OVERLAY */}
      {isDraggingPage && (
        <div 
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDraggingPage(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingPage(false);
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              processSmartUploadFile(e.dataTransfer.files[0]);
            }
          }}
          className="fixed inset-0 z-50 bg-blue-900/70 backdrop-blur-xs flex flex-col items-center justify-center p-6 border-4 border-dashed border-blue-400 animate-fade-in text-white cursor-pointer"
        >
          <div className="h-20 w-20 rounded-3xl bg-white/20 flex items-center justify-center mb-4 shadow-2xl animate-bounce">
            <UploadCloud className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-2xl font-black mb-1.5 tracking-tight">Drop Excel spreadsheet here</h2>
          <p className="text-sm text-blue-100 font-medium">Release to start Smart Upload & merge orders</p>
          <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-200 bg-white/10 px-4 py-2 rounded-full backdrop-blur-xs">
            <span>Supports .xlsx, .xls, .csv</span>
          </div>
        </div>
      )}

      {/* ADMIN FULL DATABASE OVERWRITE CONFIRMATION MODAL */}
      {showAdminOverwriteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-rose-500/50 dark:border-rose-500/40 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-950/60 px-6 py-4 bg-rose-50/80 dark:bg-rose-950/40">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950 dark:text-rose-100 flex items-center gap-1.5">
                    <span>Admin Database Overwrite</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                      Restricted
                    </span>
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Master database replacement operation</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAdminOverwriteModal(false);
                  setOverwriteConfirmedCheckbox(false);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  <strong className="font-bold">Permanent Replacement:</strong> This operation will purge all <strong className="underline">{orders.length} current orders</strong> in the database and fully replace them with the spreadsheet records. Unlike normal upload, this does <strong className="underline">not</strong> merge.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between font-bold">
                  <span>Current Database Orders:</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{orders.length.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span>Authorized User:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">Admin Privileges Active</span>
                </div>
              </div>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={overwriteConfirmedCheckbox}
                  onChange={(e) => setOverwriteConfirmedCheckbox(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 select-none">
                  I understand that this action will permanently purge existing orders and replace the database with the uploaded file.
                </span>
              </label>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminOverwriteModal(false);
                    setOverwriteConfirmedCheckbox(false);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!overwriteConfirmedCheckbox || isUploading}
                  onClick={() => {
                    overwriteInputRef.current?.click();
                  }}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 px-5 py-2 text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Database className="h-4 w-4" />
                  <span>Select File & Overwrite Database</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ALL CODES / RESET WEB DATABASE CONFIRMATION MODAL */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-rose-500/50 dark:border-rose-500/40 shadow-2xl overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-950/60 px-6 py-4 bg-rose-50/90 dark:bg-rose-950/50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                  <Trash2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-950 dark:text-rose-100 flex items-center gap-1.5">
                    <span>Delete All Order Codes</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                      Cloud Reset
                    </span>
                  </h3>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                    Purge cloud database to start a fresh upload
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isPurging) {
                    setShowPurgeModal(false);
                    setPurgeConfirmationText('');
                  }
                }}
                disabled={isPurging}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                  <strong className="font-bold">Permanent Cloud Purge:</strong> This will delete all <strong className="underline">{orders.length.toLocaleString()} order plans</strong> from the Supabase database and local state. Use this when upload/download has discrepancies and you wish to upload your latest Excel spreadsheet completely clean.
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-center justify-between font-bold">
                  <span>Current Database Records:</span>
                  <span className="font-mono font-black text-rose-600 dark:text-rose-400 text-sm">{orders.length.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between font-bold">
                  <span>After Deletion:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">0 Records (Clean Slate)</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  To confirm, type <span className="font-mono font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">DELETE</span> below:
                </label>
                <input
                  type="text"
                  value={purgeConfirmationText}
                  onChange={(e) => setPurgeConfirmationText(e.target.value)}
                  placeholder="Type DELETE to enable purge"
                  disabled={isPurging}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:font-sans placeholder:font-normal focus:outline-hidden focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
                  id="purge-confirm-input"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowPurgeModal(false);
                    setPurgeConfirmationText('');
                  }}
                  disabled={isPurging}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={purgeConfirmationText.trim().toUpperCase() !== 'DELETE' || isPurging}
                  onClick={handlePurgeAllWebData}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white disabled:text-slate-500 px-5 py-2 text-xs font-bold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                  id="confirm-purge-btn"
                >
                  {isPurging ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Deleting Database Codes...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      <span>Delete All Codes & Reset</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SMART UPLOAD / OVERWRITE FEEDBACK & FIELD CHANGES SUMMARY MODAL */}
      {uploadFeedback?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          <div className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className={`flex items-center justify-between border-b px-5 py-4 ${
              uploadFeedback.mode === 'overwrite'
                ? 'border-rose-100 dark:border-rose-950/60 bg-rose-50/50 dark:bg-rose-950/30'
                : 'border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shadow-xs ${
                  uploadFeedback.mode === 'overwrite'
                    ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400'
                    : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                }`}>
                  {uploadFeedback.mode === 'overwrite' ? (
                    <ShieldCheck className="h-5 w-5" />
                  ) : (
                    <ListChecks className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {uploadFeedback.title}
                    </h3>
                    {uploadFeedback.mode === 'overwrite' ? (
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Master Overwrite
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                        Live Field Summary
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                    {uploadFeedback.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {uploadFeedback.changesList && uploadFeedback.changesList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyChangeSummary}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    title="Copy changes to clipboard"
                  >
                    {copiedSummary ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>
                )}
                <button 
                  onClick={() => setUploadFeedback(null)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            {uploadFeedback.stats && (
              <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rows Processed</span>
                    <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                      {uploadFeedback.stats.totalRowsProcessed.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 shadow-2xs">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Orders Updated</span>
                    <p className="text-base font-black text-blue-700 dark:text-blue-300 mt-0.5">
                      {uploadFeedback.stats.updatedOrdersCount.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-900/40 shadow-2xs">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      <span>Fields Changed</span>
                    </span>
                    <p className="text-base font-black text-indigo-700 dark:text-indigo-300 mt-0.5">
                      {(uploadFeedback.stats.totalFieldsChanged || 0).toLocaleString()}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Blanks Filled</span>
                    <p className="text-base font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {uploadFeedback.stats.filledBlanksCount.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-900/40 shadow-2xs">
                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">New Orders</span>
                    <p className="text-base font-black text-purple-700 dark:text-purple-300 mt-0.5">
                      {uploadFeedback.stats.newOrdersCount.toLocaleString()}
                    </p>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 shadow-2xs">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Preserved Intact</span>
                    <p className="text-base font-black text-slate-700 dark:text-slate-300 mt-0.5">
                      {uploadFeedback.stats.unalteredCount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Filter and Search Controls (if changes exist) */}
            {uploadFeedback.changesList && uploadFeedback.changesList.length > 0 && (
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={changeSearchQuery}
                      onChange={(e) => setChangeSearchQuery(e.target.value)}
                      placeholder="Filter EWO, buyer, color, or field..."
                      className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 w-56 sm:w-64"
                    />
                    {changeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setChangeSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        changeCategoryFilter === 'all'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      All ({uploadFeedback.changesList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('dates')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        changeCategoryFilter === 'dates'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <Calendar className="h-3 w-3" />
                      <span>Dates & Milestones</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('progress')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        changeCategoryFilter === 'progress'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <TrendingUp className="h-3 w-3" />
                      <span>Production & Balances</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeCategoryFilter('remarks')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        changeCategoryFilter === 'remarks'
                          ? 'bg-blue-600 text-white shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      <ClipboardList className="h-3 w-3" />
                      <span>Remarks & Leaders</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-bold px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    {expandedOrderIds.size === uploadFeedback.changesList.length ? 'Collapse All' : 'Expand All'}
                  </button>
                </div>
              </div>
            )}

            {/* Scrollable Changes List Area */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {uploadFeedback.changesList && uploadFeedback.changesList.length > 0 ? (
                filteredUploadChanges.length > 0 ? (
                  filteredUploadChanges.map((rec, recIdx) => {
                    const isExpanded = expandedOrderIds.has(rec.orderId);
                    return (
                      <div 
                        key={`${rec.orderId || 'rec'}-${recIdx}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 shadow-2xs overflow-hidden transition-all"
                      >
                        {/* Order Accordion Header */}
                        <div 
                          onClick={() => toggleExpandOrder(rec.orderId)}
                          className="flex items-center justify-between px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900 dark:text-white">
                                EWO: #{rec.ewo}
                              </span>
                              {rec.isNew ? (
                                <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950 px-2 py-0.5 rounded-full">
                                  New Order Added
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                                  {rec.changes.length} {rec.changes.length === 1 ? 'Field Changed' : 'Fields Changed'}
                                </span>
                              )}
                            </div>

                            <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold">
                              Buyer: <strong className="text-slate-900 dark:text-white">{rec.buyer || '-'}</strong>
                            </span>

                            <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold flex items-center gap-1">
                              <span>Color:</span>
                              <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-bold">
                                {rec.color || 'Unspecified'}
                              </span>
                            </span>

                            {rec.planMonth && (
                              <span className="text-[11px] font-semibold text-slate-400">
                                ({rec.planMonth})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Order Changes Table (When Expanded) */}
                        {isExpanded && (
                          <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/80">
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs">
                                <thead>
                                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    <th className="pb-2 pl-1">Field Name</th>
                                    <th className="pb-2">Previous Value</th>
                                    <th className="pb-2 w-8 text-center"></th>
                                    <th className="pb-2">New Uploaded Value</th>
                                    <th className="pb-2 text-right pr-1">Change Type</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                  {rec.changes.map((ch, chIdx) => {
                                    const isDate = ch.fieldKey.toLowerCase().includes('date') || ch.fieldKey.toLowerCase().includes('start') || ch.fieldKey.toLowerCase().includes('end');
                                    return (
                                      <tr key={`${ch.fieldKey}-${chIdx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                        <td className="py-2.5 pl-1 font-bold text-slate-800 dark:text-slate-200">
                                          {ch.fieldLabel}
                                        </td>
                                        <td className="py-2.5">
                                          {ch.oldValue === '(Blank)' || ch.oldValue === '(New)' ? (
                                            <span className="text-slate-400 italic">
                                              {ch.oldValue}
                                            </span>
                                          ) : (
                                            <span className="line-through text-slate-400 dark:text-slate-500 font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                                              {ch.oldValue}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 text-center text-blue-500">
                                          <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                                        </td>
                                        <td className="py-2.5">
                                          <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800/60 font-mono text-xs shadow-2xs">
                                            {ch.newValue}
                                          </span>
                                        </td>
                                        <td className="py-2.5 text-right pr-1">
                                          {ch.isFilledBlank ? (
                                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                                              Filled Blank
                                            </span>
                                          ) : (
                                            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                                              Updated
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
                    <Search className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      No matching changes found
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Try clearing your search query or switching the category filter.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setChangeSearchQuery('');
                        setChangeCategoryFilter('all');
                      }}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Reset Filter
                    </button>
                  </div>
                )
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                    All Existing Data is 100% Up to Date
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                    The uploaded spreadsheet was verified against existing orders. Every value matched your existing database records, and no new differing values were found.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Changes are safely synced to the database and reflected in the table.</span>
              </div>

              <div className="flex items-center gap-2">
                {uploadFeedback.changesList && uploadFeedback.changesList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyChangeSummary}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  >
                    {copiedSummary ? 'Copied to Clipboard' : 'Copy Change Log'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setUploadFeedback(null)}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
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
                globalSaveYarnAllocation(record).catch(err => console.warn('Global save yarn allocation warning:', err));

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
