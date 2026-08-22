/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  Search, 
  Download, 
  UploadCloud, 
  Package, 
  Layers, 
  CheckCircle2, 
  TrendingUp, 
  X, 
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  FileText,
  Shield,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { useTableColumns, ColumnCustomizerDropdown, ResizableTh, ColumnDef } from './TableColumnCustomizer';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { useGlobalData } from '../context/GlobalDataContext';

export interface MasterUploadInfo {
  lastUploadedAt: string | null;
  lastUpdatedDate?: string | null;
  lastUpdateTime?: string | null;
  uploadedBy?: string | null;
  userName?: string | null;
  fileName: string | null;
  totalRecords: number;
  status: 'Success' | 'Failed' | 'No upload yet';
  errorMessage?: string;
}

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
    lotRef: 'Do allocate from 260320',
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
    remarks: 'ok'
  },
  {
    id: 'ya-2',
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
    allocationDateRange: '08-Jul-2025 To 08-Jul-2025',
    allocationNo: 'A7308',
    yarnRqQty: 0,
    allocatedQty: 135,
    balance: -135,
    remarks: ''
  },
  {
    id: 'ya-3',
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
    allocationDateRange: '29-Jun-2025 To 08-Jul-2025',
    allocationNo: 'A7288',
    yarnRqQty: -463,
    allocatedQty: -463,
    balance: 0,
    remarks: ''
  },
  {
    id: 'ya-4',
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
    allocationDateRange: '29-Jun-2025 To 08-Jul-2025',
    allocationNo: 'A7288',
    yarnRqQty: 463,
    allocatedQty: 463,
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

export function formatDisplayDate(val: any): string {
  if (!val && val !== 0) return '-';
  const str = String(val).trim();
  if (!str || str === '-' || str === 'Pending') return str || '-';

  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (/\s+to\s+/i.test(str)) {
    const parts = str.split(/\s+to\s+/i);
    return parts.map(p => formatDisplayDate(p)).join(' To ');
  }

  // 1) Match ISO format YYYY-MM-DD... (e.g. 2026-07-04T18:00:00.000Z or 2026-07-04)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const yr = isoMatch[1];
    const mIdx = parseInt(isoMatch[2], 10) - 1;
    const dy = isoMatch[3].padStart(2, '0');
    if (mIdx >= 0 && mIdx < 12) {
      return `${dy}-${fullMonths[mIdx]}-${yr}`;
    }
  }

  // 2) Match DD-MMM-YY or DD-Month-YYYY (e.g. 28-Jun-25, 4-July-2026, 04-Jul-2026)
  const dmyMatch = str.match(/^(\d{1,2})[-/\s]([A-Za-z]+)[-/\s](\d{2,4})$/);
  if (dmyMatch) {
    const dy = dmyMatch[1].padStart(2, '0');
    const mStr = dmyMatch[2].toLowerCase();
    let yr = dmyMatch[3];
    if (yr.length === 2) {
      yr = `20${yr}`;
    }
    const mIdx = fullMonths.findIndex(m => m.toLowerCase().startsWith(mStr.slice(0, 3)));
    if (mIdx !== -1) {
      return `${dy}-${fullMonths[mIdx]}-${yr}`;
    }
  }

  // 3) Try JS Date parsing
  const dObj = new Date(str);
  if (!isNaN(dObj.getTime())) {
    const dy = String(dObj.getDate()).padStart(2, '0');
    const mName = fullMonths[dObj.getMonth()];
    const yr = dObj.getFullYear();
    return `${dy}-${mName}-${yr}`;
  }

  return str;
}

function parseExcelDate(val: any): string {
  if (!val && val !== 0) return '';
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      const fullMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const mStr = fullMonths[dateObj.m - 1] || 'January';
      const yr = String(dateObj.y).length === 2 ? `20${dateObj.y}` : String(dateObj.y);
      const dy = String(dateObj.d).padStart(2, '0');
      return `${dy}-${mStr}-${yr}`;
    }
  }
  if (val instanceof Date) {
    return formatDisplayDate(val.toISOString());
  }
  return formatDisplayDate(String(val).trim());
}

function getColValue(row: Record<string, any>, possibleKeys: string[]): any {
  const keys = Object.keys(row);
  for (const pk of possibleKeys) {
    const pkClean = pk.toLowerCase().trim();
    // 1. Exact match
    let foundKey = keys.find(k => k.trim().toLowerCase() === pkClean);
    // 2. Starts with match
    if (!foundKey) {
      foundKey = keys.find(k => k.trim().toLowerCase().startsWith(pkClean));
    }
    // 3. Includes match
    if (!foundKey && pkClean.length > 3) {
      foundKey = keys.find(k => k.trim().toLowerCase().includes(pkClean));
    }
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && row[foundKey] !== '') {
      return row[foundKey];
    }
  }
  return '';
}

function parseToDate(val: any): Date | null {
  if (!val && val !== 0) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj && dateObj.y && dateObj.m && dateObj.d) {
      return new Date(dateObj.y, dateObj.m - 1, dateObj.d);
    }
  }
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'pending') return null;

  // Standard ISO or YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const yr = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10) - 1;
    const d = parseInt(isoMatch[3], 10);
    const date = new Date(yr, m, d);
    if (!isNaN(date.getTime())) return date;
  }

  // DD-MMM-YYYY or DD-MMM-YY or D-M-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/\s]([A-Za-z0-9]+)[-/\s](\d{2,4})$/);
  if (dmyMatch) {
    const dy = parseInt(dmyMatch[1], 10);
    const mStr = dmyMatch[2].toLowerCase();
    let yr = parseInt(dmyMatch[3], 10);
    if (yr < 100) yr += 2000;
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let mIdx = months.findIndex(m => mStr.startsWith(m));
    if (mIdx === -1) {
      mIdx = parseInt(mStr, 10) - 1;
    }
    if (mIdx >= 0 && mIdx < 12) {
      const date = new Date(yr, mIdx, dy);
      if (!isNaN(date.getTime())) return date;
    }
  }

  const standard = new Date(str);
  if (!isNaN(standard.getTime())) return standard;

  return null;
}

function formatDDMMMYYYY(d: Date): string {
  const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dy = String(d.getDate()).padStart(2, '0');
  const mName = mNames[d.getMonth()];
  const yr = d.getFullYear();
  return `${dy}-${mName}-${yr}`;
}

interface YarnAllocationViewProps {
  currentUser?: UserRecord | null;
}

const YARN_ALLOCATION_COLUMNS: ColumnDef[] = [
  { id: 'actualRequisitionDate', label: 'Actual Yarn Requisition Date', defaultWidth: 150 },
  { id: 'buyer', label: 'Buyer', defaultWidth: 110 },
  { id: 'orderNumber', label: 'Order Number', defaultWidth: 120 },
  { id: 'fabricsType', label: 'Fabrics Type', defaultWidth: 130 },
  { id: 'fabricShade', label: 'Fabric Shade', defaultWidth: 120 },
  { id: 'fabricGsm', label: 'Fabric GSM', defaultWidth: 100 },
  { id: 'yarnRequired', label: 'Yarn Required', defaultWidth: 180 },
  { id: 'lotRef', label: 'Lot Ref', defaultWidth: 160 },
  { id: 'allocatedYarn', label: 'Allocated Yarn', defaultWidth: 180 },
  { id: 'lotNo', label: 'Lot #', defaultWidth: 100 },
  { id: 'spinnersName', label: "Spinner's Name", defaultWidth: 140 },
  { id: 'allocationStatus', label: 'Allocation Status', defaultWidth: 120 },
  { id: 'yarnStockStatus', label: 'Yarn Stock Status', defaultWidth: 120 },
  { id: 'yarnDeliveryStatus', label: 'Yarn Delivery Status', defaultWidth: 130 },
  { id: 'proposedAllocationDate', label: 'Proposed Allocation Date', defaultWidth: 140 },
  { id: 'existingRange', label: 'Allocation Start Date to End Date', defaultWidth: 160 },
  { id: 'allocationNo', label: 'Allocation No', defaultWidth: 110 },
  { id: 'yarnRqQty', label: 'Yarn Rq Qty', defaultWidth: 110 },
  { id: 'allocatedQty', label: 'Allocated Qty', defaultWidth: 110 },
  { id: 'balance', label: 'Balance', defaultWidth: 100 },
  { id: 'remarks', label: 'Remarks', defaultWidth: 160 },
];

export default function YarnAllocationView({ currentUser }: YarnAllocationViewProps) {
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
  } = useTableColumns('yarn_allocation', currentUser?.uid || 'guest', YARN_ALLOCATION_COLUMNS, 4);

  const {
    yarnAllocations: globalYarn,
    refreshAll,
    saveYarnAllocation: globalSaveYarnAllocation,
    deleteYarnAllocation: globalDeleteYarnAllocation,
    bulkSaveYarnAllocations: globalBulkSaveYarnAllocations
  } = useGlobalData();

  const [yarnAllocations, setYarnAllocations] = useState<YarnAllocationRecord[]>(() => {
    if (globalYarn && globalYarn.length > 0) return globalYarn;
    return [];
  });

  useEffect(() => {
    if (globalYarn && globalYarn.length > 0) {
      setYarnAllocations(globalYarn);
      setUploadInfo(prev => ({
        ...prev,
        totalRecords: globalYarn.length
      }));
    }
  }, [globalYarn]);
  const [yarnSearchQuery, setYarnSearchQuery] = useState('');
  const [yarnBuyerFilter, setYarnBuyerFilter] = useState('All');
  const [yarnFabricFilter, setYarnFabricFilter] = useState('All');
  const [yarnSpinnerFilter, setYarnSpinnerFilter] = useState('All');

  // Wrap text state (defaults to true so long yarn specifications wrap neatly)
  const [isWrapText, setIsWrapText] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('yarn_alloc_wrap_text');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('yarn_alloc_wrap_text', JSON.stringify(isWrapText));
    } catch (e) {}
  }, [isWrapText]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Master upload metadata state
  const [uploadInfo, setUploadInfo] = useState<MasterUploadInfo>(() => {
    try {
      const saved = localStorage.getItem('master_yarn_upload_info');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      lastUploadedAt: `${dateStr}, ${timeStr}`,
      lastUpdatedDate: dateStr,
      lastUpdateTime: timeStr,
      uploadedBy: currentUser?.userName || 'Md. Raihan Hossain Antu',
      userName: currentUser?.userName || 'Md. Raihan Hossain Antu',
      fileName: 'Master_Yarn_Allocation.xlsx',
      totalRecords: globalYarn?.length || 0,
      status: 'Success',
    };
  });

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState<YarnAllocationRecord[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessBanner, setUploadSuccessBanner] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  // Load saved yarn allocations from server database on mount if global context is still empty
  useEffect(() => {
    let isMounted = true;
    if (!globalYarn || globalYarn.length === 0) {
      setIsLoadingSaved(true);
      GasClient.fetchYarnAllocations()
        .then(data => {
          if (isMounted && data && Array.isArray(data) && data.length > 0) {
            setYarnAllocations(data);
          }
        })
        .catch(err => {
          console.warn("Failed to load saved yarn allocations:", err);
        })
        .finally(() => {
          if (isMounted) setIsLoadingSaved(false);
        });
    }

    return () => { isMounted = false; };
  }, [globalYarn]);

  // User-based Buyer Access Restriction (Only restrict if non-admin and assigned buyers explicitly configured)
  const userAssignedBuyers = useMemo(() => {
    if (!currentUser || currentUser.userType === 'Admin') return null;
    if (currentUser.assignedBuyers && Array.isArray(currentUser.assignedBuyers) && currentUser.assignedBuyers.length > 0) {
      const trimmed = currentUser.assignedBuyers.map(b => b.trim().toLowerCase()).filter(Boolean);
      if (trimmed.includes('all') || trimmed.length === 0) return null;
      return trimmed;
    }
    return null;
  }, [currentUser]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [yarnSearchQuery, yarnBuyerFilter, yarnFabricFilter, yarnSpinnerFilter, pageSize]);

  const uniqueBuyers = useMemo(() => {
    const set = new Set(
      yarnAllocations
        .filter(a => {
          if (!userAssignedBuyers) return true;
          if (!a.buyer) return false;
          const bNorm = a.buyer.trim().toLowerCase();
          return userAssignedBuyers.some(ub => ub === bNorm || bNorm.includes(ub) || ub.includes(bNorm));
        })
        .map(a => a.buyer)
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [yarnAllocations, userAssignedBuyers]);

  const uniqueFabrics = useMemo(() => {
    return Array.from(new Set(yarnAllocations.map(a => a.fabricsType))).filter(Boolean).sort();
  }, [yarnAllocations]);

  const uniqueSpinners = useMemo(() => {
    return Array.from(new Set(yarnAllocations.map(a => a.spinnersName))).filter(Boolean).sort();
  }, [yarnAllocations]);

  const filteredYarnAllocations = useMemo(() => {
    const q = yarnSearchQuery.trim().toLowerCase();

    return yarnAllocations.filter(item => {
      // User-based Buyer Access Restriction
      if (userAssignedBuyers && item.buyer) {
        const itemBuyerNorm = item.buyer.trim().toLowerCase();
        const isAllowed = userAssignedBuyers.some(ub => ub === itemBuyerNorm || itemBuyerNorm.includes(ub) || ub.includes(itemBuyerNorm));
        if (!isAllowed) return false;
      }

      const matchesBuyer = yarnBuyerFilter === 'All' || item.buyer === yarnBuyerFilter;
      if (!matchesBuyer) return false;

      const matchesFabric = yarnFabricFilter === 'All' || item.fabricsType === yarnFabricFilter;
      if (!matchesFabric) return false;

      const matchesSpinner = yarnSpinnerFilter === 'All' || item.spinnersName === yarnSpinnerFilter;
      if (!matchesSpinner) return false;

      if (!q) return true;

      return (
        (item.orderNumber && item.orderNumber.toLowerCase().includes(q)) ||
        (item.buyer && item.buyer.toLowerCase().includes(q)) ||
        (item.fabricsType && item.fabricsType.toLowerCase().includes(q)) ||
        (item.yarnRequired && item.yarnRequired.toLowerCase().includes(q)) ||
        (item.allocatedYarn && item.allocatedYarn.toLowerCase().includes(q)) ||
        (item.lotNo && item.lotNo.toLowerCase().includes(q)) ||
        (item.spinnersName && item.spinnersName.toLowerCase().includes(q)) ||
        (item.allocationNo && item.allocationNo.toLowerCase().includes(q)) ||
        (item.remarks && item.remarks.toLowerCase().includes(q))
      );
    });
  }, [yarnAllocations, yarnSearchQuery, yarnBuyerFilter, yarnFabricFilter, yarnSpinnerFilter, userAssignedBuyers]);

  const totalPages = Math.max(1, Math.ceil(filteredYarnAllocations.length / (pageSize === 0 ? 1 : pageSize)));

  const paginatedYarnAllocations = useMemo(() => {
    if (pageSize === 0) return filteredYarnAllocations;
    const start = (currentPage - 1) * pageSize;
    return filteredYarnAllocations.slice(start, start + pageSize);
  }, [filteredYarnAllocations, currentPage, pageSize]);

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

  const formatYarnMetadata = () => {
    let updateDate = uploadInfo.lastUpdatedDate;
    let updateTime = uploadInfo.lastUpdateTime;
    const userName = uploadInfo.uploadedBy || uploadInfo.userName || currentUser?.userName || 'Md. Raihan Hossain Antu';

    if (!updateDate || !updateTime) {
      if (uploadInfo.lastUploadedAt && uploadInfo.lastUploadedAt !== 'Synced') {
        if (uploadInfo.lastUploadedAt.includes(',')) {
          const parts = uploadInfo.lastUploadedAt.split(',');
          updateDate = updateDate || parts[0]?.trim();
          updateTime = updateTime || parts.slice(1).join(',').trim();
        } else {
          try {
            const d = new Date(uploadInfo.lastUploadedAt);
            if (!isNaN(d.getTime())) {
              updateDate = updateDate || d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
              updateTime = updateTime || d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            }
          } catch (e) {}
        }
      }
    }

    if (!updateDate) {
      const now = new Date();
      updateDate = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    if (!updateTime) {
      const now = new Date();
      updateTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    return { updateDate, updateTime, userName };
  };

  const { updateDate, updateTime, userName } = formatYarnMetadata();

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

  const processSelectedFile = (file: File) => {
    setUploadFile(file);
    setUploadError(null);
    setIsParsing(true);
    setParsedData(null);

    const fileNameLower = file.name.toLowerCase();
    if (!fileNameLower.endsWith('.xlsx') && !fileNameLower.endsWith('.xls')) {
      const errMsg = 'Invalid file format. Please upload an Excel file (.xlsx or .xls).';
      setUploadError(errMsg);
      setIsParsing(false);
      return;
    }

    // Deferred execution to allow UI loading spinner render
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            const errMsg = 'No sheets found in the uploaded file.';
            setUploadError(errMsg);
            setIsParsing(false);
            return;
          }
          const worksheet = workbook.Sheets[firstSheetName];
          const rawMatrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

          if (!rawMatrix || rawMatrix.length === 0) {
            const errMsg = 'The uploaded Excel sheet is empty.';
            setUploadError(errMsg);
            setIsParsing(false);
            return;
          }

          // Find actual header row by scanning top 15 rows for matching header keywords
          let headerRowIndex = 0;
          let maxMatches = 0;
          const headerKeywords = ['booking', 'yarn', 'buyer', 'alloc', 'shade', 'gsm', 'count', 'lot', 'spinner', 'req', 'qty', 'balance', 'date', 'type'];

          for (let r = 0; r < Math.min(15, rawMatrix.length); r++) {
            const rowArr = rawMatrix[r];
            if (!Array.isArray(rowArr)) continue;
            let matches = 0;
            for (const cell of rowArr) {
              const cellStr = String(cell || '').toLowerCase();
              if (headerKeywords.some(kw => cellStr.includes(kw))) {
                matches++;
              }
            }
            if (matches > maxMatches) {
              maxMatches = matches;
              headerRowIndex = r;
            }
          }

          const headerRow = rawMatrix[headerRowIndex] || [];
          const headers: string[] = headerRow.map((cell: any) => 
            String(cell || '').replace(/[\r\n]+/g, ' ').replace(/\u00a0/g, ' ').trim()
          );

          // Fast, flexible, multi-pass header column lookup map
          const findHeaderKey = (possibleKeys: string[]): string => {
            // Pass 1: Exact match on normalized header text
            for (const pk of possibleKeys) {
              const pkNorm = pk.toLowerCase().trim();
              for (const h of headers) {
                if (!h) continue;
                if (h.toLowerCase().trim() === pkNorm) return h;
              }
            }

            // Pass 2: Clean alphanumeric match (ignore symbols, brackets, spaces, e.g. 'Fabric GSM (g/m2)' -> 'fabricgsmgm2')
            for (const pk of possibleKeys) {
              const pkClean = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!pkClean) continue;
              for (const h of headers) {
                if (!h) continue;
                const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (hClean === pkClean) return h;
              }
            }

            // Pass 3: Clean alphanumeric startsWith / includes match
            for (const pk of possibleKeys) {
              const pkClean = pk.toLowerCase().replace(/[^a-z0-9]/g, '');
              if (!pkClean) continue;
              for (const h of headers) {
                if (!h) continue;
                const hClean = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (hClean.startsWith(pkClean) || pkClean.startsWith(hClean)) return h;
                if (hClean.includes(pkClean) || (pkClean.length >= 3 && pkClean.includes(hClean))) return h;
              }
            }

            // Pass 4: Fallback partial keyword match for multi-token keys
            for (const pk of possibleKeys) {
              const pkTokens = pk.toLowerCase().split(/\s+/).filter(t => t.length >= 2);
              if (pkTokens.length === 0) continue;
              for (const h of headers) {
                if (!h) continue;
                const hNorm = h.toLowerCase();
                if (pkTokens.every(t => hNorm.includes(t))) return h;
              }
            }

            return '';
          };

          const colMap = {
            orderNumber: findHeaderKey(['fabric booking no', 'fabric booking number', 'fabric booking #', 'order number', 'order no', 'order #', 'booking no', 'booking number', 'booking #', 'booking', 'ewo', 'ewo no', 'ewo number', 'job no', 'po no', 'style no', 'fabric booking']),
            fabricsType: findHeaderKey(['fabrics type', 'fabric type', 'fabrics name', 'fabric name', 'fabric description', 'fabric desc', 'fabric details', 'fabric', 'fabrics']),
            fabricShade: findHeaderKey(['fabric shade', 'shade name', 'shade no', 'shade', 'color name', 'color no', 'color', 'colour', 'garment color', 'pantone']),
            fabricGsm: findHeaderKey(['fabric gsm', 'finished gsm', 'fin gsm', 'fin. gsm', 'f.gsm', 'f gsm', 'fgsm', 'fabric_gsm', 'gsm (g/m2)', 'gsm (g/m²)', 'gsm/oz', 'req gsm', 'target gsm', 'gsm/weight', 'fabric gsm (g/m2)', 'gsm']),
            yarnRequired: findHeaderKey(['yarn category', 'yarn required', 'yarn requirement', 'yarn description', 'as per fr', 'as per f.r', 'yarn cat', 'category', 'yarn details', 'required yarn', 'yarn spec', 'yarn count required']),
            allocatedYarn: findHeaderKey(['yarn count physical', 'allocated yarn', 'count physical', 'physical count', 'allocated yarn count', 'yarn req', 'count', 'allocated count', 'physical yarn count', 'allocated yarn description', 'yarn count']),
            lotNo: findHeaderKey(['lot #', 'lot no', 'lot number', 'lot', 'yarn lot', 'yarn lot no', 'yarn lot #', 'lot code', 'batch no', 'lotid']),
            spinnersName: findHeaderKey(["spinner's name", 'spinners name', 'spinner name', 'spinner', 'spinning mill', 'mill name', 'mill', 'supplier', 'yarn supplier']),
            buyer: findHeaderKey(['buyer name', 'buyer', 'brand', 'customer', 'customer name']),
            lotRef: findHeaderKey(['lot reference', 'lot ref', 'ref no', 'ref', 'lot reference no']),
            allocationStatus: findHeaderKey(['allocation status', 'alloc status', 'status']),
            yarnStockStatus: findHeaderKey(['yarn stock status', 'stock status', 'yarn status']),
            yarnDeliveryStatus: findHeaderKey(['yarn delivery status', 'delivery status']),
            proposedAllocationDate: findHeaderKey(['proposed allocation date', 'proposed alloc date', 'prop alloc date', 'prop. alloc date', 'proposed date']),
            actualRequisitionDate: findHeaderKey(['actual yarn requisition date', 'actual requisition date', 'requisition date', 'req date', 'req. date', 'rq date', 'actual req date', 'actual rq date']),
            allocationNo: findHeaderKey(['allocation no', 'allocation #', 'allocation number', 'alloc no', 'alloc #']),
            remarks: findHeaderKey(['remarks', 'comment', 'comments', 'note', 'notes']),
            yarnRqQty: findHeaderKey([
              'yarn requisition qty', 'yarn requisition quantity', 'yarn rq qty', 'yarn rq quantity',
              'yarn req qty', 'yarn req quantity', 'yarn requirement qty', 'yarn requirement quantity',
              'yarn requirement', 'yarn required qty', 'yarn required quantity', 'requisition qty',
              'requisition quantity', 'req qty', 'req quantity', 'req. qty', 'rq qty', 'rq quantity',
              'required qty', 'required quantity', 'yarn qty', 'yarn quantity', 'allocation req qty', 'allocation requisition qty'
            ]),
            allocatedQty: findHeaderKey(['allocated qty', 'allocated quantity', 'allocation qty', 'allocation quantity', 'alloc qty', 'alloc quantity', 'allocated weight', 'alc qty', 'allocated (kg)', 'alloc (kg)']),
            balance: findHeaderKey(['balance qty', 'balance quantity', 'balance', 'bal qty', 'bal quantity', 'bal', 'yarn balance', 'unallocated qty']),
            allocationDate: findHeaderKey(['allocation date', 'alloc date', 'allocation d', 'alloc d', 'date', 'allocation start date']),
            existingRange: findHeaderKey(['allocation sart date to end date', 'allocation start date to end date', 'allocation date range', 'date range', 'alloc date range']),
          };

          // Robust fallback checks for Fabric GSM and Yarn RQ Qty if not matched by standard aliases
          if (!colMap.orderNumber) {
            const ordHeader = headers.find(h => {
              const l = h.toLowerCase();
              return l.includes('booking') || l.includes('order') || l.includes('ewo') || l.includes('job') || l.includes('po');
            });
            if (ordHeader) colMap.orderNumber = ordHeader;
          }

          if (!colMap.yarnRequired && colMap.allocatedYarn) {
            colMap.yarnRequired = colMap.allocatedYarn;
          } else if (!colMap.allocatedYarn && colMap.yarnRequired) {
            colMap.allocatedYarn = colMap.yarnRequired;
          }

          if (!colMap.fabricGsm) {
            const gsmHeader = headers.find(h => {
              const l = h.toLowerCase();
              return l.includes('gsm') || l.includes('g/m') || l.includes('weight');
            });
            if (gsmHeader) colMap.fabricGsm = gsmHeader;
          }

          if (!colMap.yarnRqQty) {
            const rqHeader = headers.find(h => {
              const l = h.toLowerCase();
              return (l.includes('rq') || l.includes('req') || l.includes('requisition') || l.includes('requirement')) && !l.includes('date');
            }) || headers.find(h => {
              const l = h.toLowerCase();
              return l.includes('qty') && !l.includes('alloc') && !l.includes('bal');
            });
            if (rqHeader) colMap.yarnRqQty = rqHeader;
          }

          // Validate required source columns (order number / booking is essential)
          const missingCols: string[] = [];
          if (!colMap.orderNumber) missingCols.push('Fabric Booking No / Order Number');

          if (missingCols.length > 0) {
            const errMsg = `Import Cancelled: Missing required column(s) in uploaded file: ${missingCols.join(', ')}. Please upload a valid Master Yarn Allocation file.`;
            setUploadError(errMsg);
            setIsParsing(false);

            const nowStr = new Date().toLocaleString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true
            });
            const failMeta: MasterUploadInfo = {
              lastUploadedAt: nowStr,
              fileName: file.name,
              totalRecords: 0,
              status: 'Failed',
              errorMessage: errMsg,
            };
            setUploadInfo(failMeta);
            try {
              localStorage.setItem('master_yarn_upload_info', JSON.stringify(failMeta));
            } catch (e) {}
            FirestoreSyncService.saveSettings({ master_yarn_upload_info: failMeta }).catch(() => {});
            GasClient.saveServerDb({ master_yarn_upload_info: failMeta }).catch(() => {});

            return;
          }

          // Map and group rows cleanly without quadratic searches
          const groupsMap = new Map<string, {
            orderNumber: string;
            fabricsType: string;
            fabricShade: string;
            fabricGsm: string | number;
            yarnRequired: string;
            lotRef: string;
            allocatedYarn: string;
            lotNo: string;
            spinnersName: string;
            buyer: string;
            allocationStatus: string;
            yarnStockStatus: string;
            yarnDeliveryStatus: string;
            proposedAllocationDate: string;
            actualRequisitionDate: string;
            allocationNo: string;
            remarks: string;
            totalRqQty: number;
            totalAlcQty: number;
            totalBal: number;
            allocationDates: Date[];
            existingDateRanges: string[];
          }>();

          for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
            const rowArr = rawMatrix[r];
            if (!Array.isArray(rowArr) || rowArr.every(c => c === '' || c === null || c === undefined)) continue;

            const rowObj: Record<string, any> = {};
            for (let c = 0; c < headers.length; c++) {
              if (headers[c]) {
                rowObj[headers[c]] = rowArr[c] !== undefined ? rowArr[c] : '';
              }
            }

            const parseNum = (val: any): number => {
              if (val === undefined || val === null || val === '') return 0;
              if (typeof val === 'number') return isNaN(val) ? 0 : val;
              const cleaned = String(val).replace(/[^0-9.-]/g, '');
              const parsed = parseFloat(cleaned);
              return isNaN(parsed) ? 0 : parsed;
            };

            const orderNumber = String(colMap.orderNumber ? rowObj[colMap.orderNumber] : '').trim();
            const fabricsType = String(colMap.fabricsType ? rowObj[colMap.fabricsType] : '').trim();
            const fabricShade = String(colMap.fabricShade ? rowObj[colMap.fabricShade] : '').trim();
            
            const rawGsm = colMap.fabricGsm ? rowObj[colMap.fabricGsm] : '';
            let fabricGsm: string | number = '';
            if (rawGsm !== undefined && rawGsm !== null && rawGsm !== '') {
              const numGsm = parseNum(rawGsm);
              if (numGsm > 0) {
                fabricGsm = Math.round(numGsm);
              } else {
                fabricGsm = String(rawGsm).trim();
              }
            }

            const yarnRequired = String(colMap.yarnRequired ? rowObj[colMap.yarnRequired] : '').trim();
            const allocatedYarn = String(colMap.allocatedYarn ? rowObj[colMap.allocatedYarn] : '').trim();
            const lotNo = String(colMap.lotNo ? rowObj[colMap.lotNo] : '').trim();
            const spinnersName = String(colMap.spinnersName ? rowObj[colMap.spinnersName] : '').trim();

            const groupKey = `${orderNumber.toLowerCase()}|${fabricsType.toLowerCase()}|${fabricShade.toLowerCase()}|${String(fabricGsm).toLowerCase()}|${allocatedYarn.toLowerCase()}|${lotNo.toLowerCase()}|${spinnersName.toLowerCase()}`;

            const rqQty = parseNum(colMap.yarnRqQty ? rowObj[colMap.yarnRqQty] : 0);
            const alcQty = parseNum(colMap.allocatedQty ? rowObj[colMap.allocatedQty] : 0);
            let balVal = colMap.balance ? rowObj[colMap.balance] : '';
            let bal = parseNum(balVal);
            if (bal === 0 && (rqQty > 0 || alcQty > 0)) bal = rqQty - alcQty;

            const allocDateRaw = colMap.allocationDate ? rowObj[colMap.allocationDate] : '';
            const parsedDate = parseToDate(allocDateRaw);

            const existingRange = String(colMap.existingRange ? rowObj[colMap.existingRange] : '').trim();

            if (!groupsMap.has(groupKey)) {
              groupsMap.set(groupKey, {
                orderNumber,
                fabricsType,
                fabricShade,
                fabricGsm,
                yarnRequired,
                lotRef: String(colMap.lotRef ? rowObj[colMap.lotRef] : '').trim(),
                allocatedYarn,
                lotNo,
                spinnersName,
                buyer: String(colMap.buyer ? rowObj[colMap.buyer] : '').trim(),
                allocationStatus: String(colMap.allocationStatus ? rowObj[colMap.allocationStatus] : 'Allocated').trim(),
                yarnStockStatus: String(colMap.yarnStockStatus ? rowObj[colMap.yarnStockStatus] : 'Stock Available').trim(),
                yarnDeliveryStatus: String(colMap.yarnDeliveryStatus ? rowObj[colMap.yarnDeliveryStatus] : 'Completed').trim(),
                proposedAllocationDate: parseExcelDate(colMap.proposedAllocationDate ? rowObj[colMap.proposedAllocationDate] : ''),
                actualRequisitionDate: parseExcelDate(colMap.actualRequisitionDate ? rowObj[colMap.actualRequisitionDate] : ''),
                allocationNo: String(colMap.allocationNo ? rowObj[colMap.allocationNo] : '').trim(),
                remarks: String(colMap.remarks ? rowObj[colMap.remarks] : '').trim(),
                totalRqQty: 0,
                totalAlcQty: 0,
                totalBal: 0,
                allocationDates: [],
                existingDateRanges: [],
              });
            }

            const grp = groupsMap.get(groupKey)!;
            grp.totalRqQty += rqQty;
            grp.totalAlcQty += alcQty;
            grp.totalBal += bal;

            if (parsedDate) {
              grp.allocationDates.push(parsedDate);
            }
            if (existingRange) {
              grp.existingDateRanges.push(existingRange);
            }
          }

          const records: YarnAllocationRecord[] = Array.from(groupsMap.values()).map((grp, idx) => {
            let dateRangeStr = '';
            if (grp.allocationDates.length > 0) {
              const timestamps = grp.allocationDates.map(d => d.getTime());
              const minDate = new Date(Math.min(...timestamps));
              const maxDate = new Date(Math.max(...timestamps));
              const minFormatted = formatDDMMMYYYY(minDate);
              const maxFormatted = formatDDMMMYYYY(maxDate);
              dateRangeStr = `${minFormatted} to ${maxFormatted}`;
            } else if (grp.existingDateRanges.length > 0) {
              dateRangeStr = grp.existingDateRanges[0];
            } else {
              dateRangeStr = '-';
            }

            return {
              id: `ya-master-${idx + 1}-${Date.now()}`,
              actualRequisitionDate: grp.actualRequisitionDate,
              buyer: grp.buyer,
              orderNumber: grp.orderNumber,
              fabricsType: grp.fabricsType,
              fabricShade: grp.fabricShade,
              fabricGsm: grp.fabricGsm,
              yarnRequired: grp.yarnRequired,
              lotRef: grp.lotRef,
              allocatedYarn: grp.allocatedYarn,
              lotNo: grp.lotNo,
              spinnersName: grp.spinnersName,
              allocationStatus: grp.allocationStatus,
              yarnStockStatus: grp.yarnStockStatus,
              yarnDeliveryStatus: grp.yarnDeliveryStatus,
              proposedAllocationDate: grp.proposedAllocationDate,
              allocationDateRange: dateRangeStr,
              allocationNo: grp.allocationNo,
              yarnRqQty: grp.totalRqQty,
              allocatedQty: grp.totalAlcQty,
              balance: grp.totalBal,
              remarks: grp.remarks,
            };
          });

          setParsedData(records);
          setIsParsing(false);
        } catch (err) {
          console.error('Error parsing Excel file:', err);
          setUploadError('Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.');
          setIsParsing(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }, 50);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // Load yarn allocations from Google Sheets / GasClient on mount & sync event
  useEffect(() => {
    const fetchAllocations = (force: boolean = false) => {
      GasClient.fetchYarnAllocations(force).then((remoteData) => {
        if (remoteData && Array.isArray(remoteData) && remoteData.length > 0) {
          setYarnAllocations(remoteData as YarnAllocationRecord[]);
          setUploadInfo(prev => ({
            ...prev,
            totalRecords: remoteData.length
          }));
        }
      }).catch((err) => {
        console.warn("Could not load yarn allocations from Google Sheets:", err);
      });
    };

    fetchAllocations(false);

    // Fetch latest master upload metadata from Server DB
    GasClient.fetchServerDb().then((db) => {
      if (db && db.master_yarn_upload_info) {
        setUploadInfo(db.master_yarn_upload_info);
      }
    }).catch(() => {});

    // Fetch latest master upload metadata from Firestore on mount
    FirestoreSyncService.fetchSettings().then((settings) => {
      if (settings && settings.master_yarn_upload_info) {
        setUploadInfo(settings.master_yarn_upload_info);
      }
    }).catch(err => console.warn('Could not fetch initial master_yarn_upload_info from Firestore:', err));

    // 2. Real-time subscription to Firestore settings for instant cross-device updates
    let lastKnownMeta = uploadInfo;
    const unsubscribeFirestore = FirestoreSyncService.subscribeToSettings((settings) => {
      if (settings && settings.master_yarn_upload_info) {
        const remoteMeta = settings.master_yarn_upload_info as MasterUploadInfo;
        if (
          lastKnownMeta.lastUploadedAt !== remoteMeta.lastUploadedAt ||
          lastKnownMeta.lastUpdatedDate !== remoteMeta.lastUpdatedDate ||
          lastKnownMeta.lastUpdateTime !== remoteMeta.lastUpdateTime ||
          lastKnownMeta.uploadedBy !== remoteMeta.uploadedBy ||
          lastKnownMeta.totalRecords !== remoteMeta.totalRecords ||
          lastKnownMeta.fileName !== remoteMeta.fileName ||
          lastKnownMeta.status !== remoteMeta.status
        ) {
          lastKnownMeta = remoteMeta;
          setUploadInfo(remoteMeta);
          // Automatically re-fetch updated dataset for other devices when master file is uploaded on any device
          fetchAllocations(true);
        }
      }
    });

    const handleSync = () => fetchAllocations(true);
    window.addEventListener('gas_data_synced', handleSync);

    return () => {
      unsubscribeFirestore();
      window.removeEventListener('gas_data_synced', handleSync);
    };
  }, []);

  const handleConfirmUpload = () => {
    if (!parsedData || parsedData.length === 0 || isSaving) return;

    setIsSaving(true);
    setUploadError(null);

    const dataToSave = parsedData;
    const fileName = uploadFile?.name || 'Master_Yarn_Allocation.xlsx';

    // Step 1: Update local and global React state instantly
    setYarnAllocations(dataToSave);
    setCurrentPage(1);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const activeUserName = currentUser?.userName || 'Md. Raihan Hossain Antu';

    const newUploadInfo: MasterUploadInfo = {
      lastUploadedAt: `${dateStr}, ${timeStr}`,
      lastUpdatedDate: dateStr,
      lastUpdateTime: timeStr,
      uploadedBy: activeUserName,
      userName: activeUserName,
      fileName: fileName,
      totalRecords: dataToSave.length,
      status: 'Success'
    };

    setUploadInfo(newUploadInfo);

    // Save and sync yarn allocations to Server DB and Google Sheets
    globalBulkSaveYarnAllocations(dataToSave, true).catch(err => console.warn("GlobalBulkSave notice:", err));
    FirestoreSyncService.saveSettings({
      master_yarn_upload_info: newUploadInfo,
      last_yarn_allocation_updated: new Date().toISOString()
    }).catch(err => console.warn("Firestore master_yarn_upload_info notice:", err));
    GasClient.saveServerDb({ master_yarn_upload_info: newUploadInfo, yarnAllocations: dataToSave }).catch(err => console.warn("Server DB master_yarn_upload_info notice:", err));

    setUploadSuccessBanner(`Instantly synced ${dataToSave.length.toLocaleString()} yarn allocation records across all devices! Background syncing to Google Sheets...`);
    setShowUploadModal(false);
    setUploadFile(null);
    setParsedData(null);
    setUploadError(null);
    setIsSaving(false);

    // Step 2: Keepalive sync to Google Sheets backend
    GasClient.saveYarnAllocations(dataToSave, true).then(() => {
      setUploadSuccessBanner(`Successfully synchronized ${dataToSave.length.toLocaleString()} yarn allocation records across all devices and Google Sheets.`);
    }).catch((err) => {
      console.warn("Background Google Sheets sync notice:", err);
      setUploadSuccessBanner(`Updated ${dataToSave.length.toLocaleString()} records across all devices. (Google Sheets sync notice: ${err.message || 'Complete'}).`);
    });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Yarn Allocation & Requirement Matrix
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Track yarn requisitions, fabric specifications, spinner allocations, and delivery balances
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportYarnExcel}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => {
              setUploadFile(null);
              setParsedData(null);
              setUploadError(null);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-all cursor-pointer shadow-md active:scale-98"
          >
            <UploadCloud className="h-4 w-4" />
            <span>Upload Master Yarn Allocation File</span>
          </button>
        </div>
      </div>

      {/* YARN ALLOCATION UPDATE STATUS BANNER */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              uploadInfo.status === 'Success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800'
                : uploadInfo.status === 'Failed'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800'
                : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800'
            }`}>
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                Yarn Allocation Sync Status
              </span>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  <span className="text-slate-400 font-medium">Update Time:</span>{' '}
                  <span className="font-black text-slate-900 dark:text-white font-mono">{updateTime}</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>
                  <span className="text-slate-400 font-medium">Update Date:</span>{' '}
                  <span className="font-black text-slate-900 dark:text-white">{updateDate}</span>
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span>
                  <span className="text-slate-400 font-medium">User Name:</span>{' '}
                  <span className="font-black text-blue-600 dark:text-sky-400">{userName}</span>
                </span>
                {uploadInfo.totalRecords ? (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold">
                      {uploadInfo.totalRecords} Records
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          {uploadInfo.status === 'Failed' && uploadInfo.errorMessage && (
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800 max-w-md">
              {uploadInfo.errorMessage}
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS BANNER */}
      {uploadSuccessBanner && (
        <div className="flex items-center justify-between rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3.5 text-xs text-emerald-800 dark:text-emerald-200 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-bold">{uploadSuccessBanner}</span>
          </div>
          <button onClick={() => setUploadSuccessBanner(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg cursor-pointer">
            <X className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </button>
        </div>
      )}

      {/* SUMMARY METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Unique Orders</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">{uniqueOrdersCount} Orders</span>
            <span className="text-[10px] font-medium text-slate-400 block mt-0.5">({filteredYarnAllocations.length} total allocations)</span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Layers className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Yarn Rq Qty</span>
            <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block">{formatYarnQty(yarnTotals.yarnRqQty)} Kg</span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Package className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Allocated Qty</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{formatYarnQty(yarnTotals.allocatedQty)} Kg</span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Net Balance Qty</span>
            <span className={`text-2xl font-black mt-1 block ${yarnTotals.balance < 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {formatYarnQty(yarnTotals.balance)} Kg
            </span>
          </div>
          <div className="h-11 w-11 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS TOOLBAR */}
      <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
        {/* Row 1: Search Input (Full width responsive) */}
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search Order #, Lot #, Buyer, Yarn, Allocation No..."
            value={yarnSearchQuery}
            onChange={(e) => {
              setYarnSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 pl-10 pr-9 py-2 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
          {yarnSearchQuery && (
            <button
              type="button"
              onClick={() => {
                setYarnSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Filter Selects & Controls (Responsive Grid for Mobile & Desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 w-full items-center">
          {/* Buyer Filter */}
          <div className="w-full">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 lg:hidden">
              Buyer Filter
            </label>
            <select
              value={yarnBuyerFilter}
              onChange={(e) => {
                setYarnBuyerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                yarnBuyerFilter !== 'All'
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-700 dark:text-slate-200'
              }`}
            >
              <option value="All">All Buyers ({uniqueBuyers.length})</option>
              {uniqueBuyers.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Fabric Filter */}
          <div className="w-full">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 lg:hidden">
              Fabric Filter
            </label>
            <select
              value={yarnFabricFilter}
              onChange={(e) => {
                setYarnFabricFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                yarnFabricFilter !== 'All'
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-700 dark:text-slate-200'
              }`}
            >
              <option value="All">All Fabrics ({uniqueFabrics.length})</option>
              {uniqueFabrics.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Spinner Filter */}
          <div className="w-full">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 lg:hidden">
              Spinner Filter
            </label>
            <select
              value={yarnSpinnerFilter}
              onChange={(e) => {
                setYarnSpinnerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`w-full rounded-xl border px-3 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer ${
                yarnSpinnerFilter !== 'All'
                  ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                  : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 text-slate-700 dark:text-slate-200'
              }`}
            >
              <option value="All">All Spinners ({uniqueSpinners.length})</option>
              {uniqueSpinners.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Action Row: Column Customizer and Reset */}
          <div className="w-full">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1 lg:hidden">
              Table View
            </label>
            <div className="flex items-center gap-2 w-full">
              <div className="flex-1">
                <ColumnCustomizerDropdown
                  tableId="yarn_allocation"
                  columns={YARN_ALLOCATION_COLUMNS}
                  hiddenColumns={hiddenColumns}
                  onToggleColumn={toggleColumn}
                  onResetColumns={resetColumns}
                  isFrozen={isFrozen}
                  freezeCount={freezeCount}
                  onToggleFreeze={toggleFreeze}
                  onSetFreezeCount={setFreezeCount}
                />
              </div>

              {(yarnSearchQuery !== '' || yarnBuyerFilter !== 'All' || yarnFabricFilter !== 'All' || yarnSpinnerFilter !== 'All') && (
                <button
                  type="button"
                  onClick={() => {
                    setYarnSearchQuery('');
                    setYarnBuyerFilter('All');
                    setYarnFabricFilter('All');
                    setYarnSpinnerFilter('All');
                    setCurrentPage(1);
                  }}
                  className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 transition-all cursor-pointer whitespace-nowrap shadow-2xs shrink-0"
                  title="Reset all active filters"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MATRIX SPREADSHEET TABLE */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[680px]">
          <table className="w-full text-left text-xs border-collapse min-w-[2100px]">
            <thead className="sticky top-0 z-30 bg-slate-100 dark:bg-slate-800 font-extrabold uppercase text-slate-600 dark:text-slate-300 text-[10px] tracking-tight border-b-2 border-slate-200 dark:border-slate-700">
              <tr>
                {isColVisible('actualRequisitionDate') && (
                  <ResizableTh width={getColWidth('actualRequisitionDate')} onWidthChange={(w) => setColumnWidth('actualRequisitionDate', w)} isSticky={isColFrozen('actualRequisitionDate')} stickyLeft={getStickyLeft('actualRequisitionDate')} isLastFrozen={'actualRequisitionDate' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Actual Yarn Requisition date</ResizableTh>
                )}
                {isColVisible('buyer') && (
                  <ResizableTh width={getColWidth('buyer')} onWidthChange={(w) => setColumnWidth('buyer', w)} isSticky={isColFrozen('buyer')} stickyLeft={getStickyLeft('buyer')} isLastFrozen={'buyer' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Buyer</ResizableTh>
                )}
                {isColVisible('orderNumber') && (
                  <ResizableTh width={getColWidth('orderNumber')} onWidthChange={(w) => setColumnWidth('orderNumber', w)} isSticky={isColFrozen('orderNumber')} stickyLeft={getStickyLeft('orderNumber')} isLastFrozen={'orderNumber' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Order Number</ResizableTh>
                )}
                {isColVisible('fabricsType') && (
                  <ResizableTh width={getColWidth('fabricsType')} onWidthChange={(w) => setColumnWidth('fabricsType', w)} isSticky={isColFrozen('fabricsType')} stickyLeft={getStickyLeft('fabricsType')} isLastFrozen={'fabricsType' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Fabrics Type</ResizableTh>
                )}
                {isColVisible('fabricShade') && (
                  <ResizableTh width={getColWidth('fabricShade')} onWidthChange={(w) => setColumnWidth('fabricShade', w)} isSticky={isColFrozen('fabricShade')} stickyLeft={getStickyLeft('fabricShade')} isLastFrozen={'fabricShade' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Fabric Shade</ResizableTh>
                )}
                {isColVisible('fabricGsm') && (
                  <ResizableTh width={getColWidth('fabricGsm')} onWidthChange={(w) => setColumnWidth('fabricGsm', w)} isSticky={isColFrozen('fabricGsm')} stickyLeft={getStickyLeft('fabricGsm')} isLastFrozen={'fabricGsm' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-center ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Fabric GSM</ResizableTh>
                )}
                {isColVisible('yarnRequired') && (
                  <ResizableTh width={getColWidth('yarnRequired')} onWidthChange={(w) => setColumnWidth('yarnRequired', w)} isSticky={isColFrozen('yarnRequired')} stickyLeft={getStickyLeft('yarnRequired')} isLastFrozen={'yarnRequired' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Yarn Required</ResizableTh>
                )}
                {isColVisible('lotRef') && (
                  <ResizableTh width={getColWidth('lotRef')} onWidthChange={(w) => setColumnWidth('lotRef', w)} isSticky={isColFrozen('lotRef')} stickyLeft={getStickyLeft('lotRef')} isLastFrozen={'lotRef' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Lot Ref</ResizableTh>
                )}
                {isColVisible('allocatedYarn') && (
                  <ResizableTh width={getColWidth('allocatedYarn')} onWidthChange={(w) => setColumnWidth('allocatedYarn', w)} isSticky={isColFrozen('allocatedYarn')} stickyLeft={getStickyLeft('allocatedYarn')} isLastFrozen={'allocatedYarn' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Allocated Yarn</ResizableTh>
                )}
                {isColVisible('lotNo') && (
                  <ResizableTh width={getColWidth('lotNo')} onWidthChange={(w) => setColumnWidth('lotNo', w)} isSticky={isColFrozen('lotNo')} stickyLeft={getStickyLeft('lotNo')} isLastFrozen={'lotNo' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Lot #</ResizableTh>
                )}
                {isColVisible('spinnersName') && (
                  <ResizableTh width={getColWidth('spinnersName')} onWidthChange={(w) => setColumnWidth('spinnersName', w)} isSticky={isColFrozen('spinnersName')} stickyLeft={getStickyLeft('spinnersName')} isLastFrozen={'spinnersName' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Spinner's Name</ResizableTh>
                )}
                {isColVisible('allocationStatus') && (
                  <ResizableTh width={getColWidth('allocationStatus')} onWidthChange={(w) => setColumnWidth('allocationStatus', w)} isSticky={isColFrozen('allocationStatus')} stickyLeft={getStickyLeft('allocationStatus')} isLastFrozen={'allocationStatus' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-center ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Allocation Status</ResizableTh>
                )}
                {isColVisible('yarnStockStatus') && (
                  <ResizableTh width={getColWidth('yarnStockStatus')} onWidthChange={(w) => setColumnWidth('yarnStockStatus', w)} isSticky={isColFrozen('yarnStockStatus')} stickyLeft={getStickyLeft('yarnStockStatus')} isLastFrozen={'yarnStockStatus' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-center ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Yarn Stock Status</ResizableTh>
                )}
                {isColVisible('yarnDeliveryStatus') && (
                  <ResizableTh width={getColWidth('yarnDeliveryStatus')} onWidthChange={(w) => setColumnWidth('yarnDeliveryStatus', w)} isSticky={isColFrozen('yarnDeliveryStatus')} stickyLeft={getStickyLeft('yarnDeliveryStatus')} isLastFrozen={'yarnDeliveryStatus' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-center ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Yarn Delivery Status</ResizableTh>
                )}
                {isColVisible('proposedAllocationDate') && (
                  <ResizableTh width={getColWidth('proposedAllocationDate')} onWidthChange={(w) => setColumnWidth('proposedAllocationDate', w)} isSticky={isColFrozen('proposedAllocationDate')} stickyLeft={getStickyLeft('proposedAllocationDate')} isLastFrozen={'proposedAllocationDate' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-center ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Proposed Allocation Date</ResizableTh>
                )}
                {isColVisible('existingRange') && (
                  <ResizableTh width={getColWidth('existingRange')} onWidthChange={(w) => setColumnWidth('existingRange', w)} isSticky={isColFrozen('existingRange')} stickyLeft={getStickyLeft('existingRange')} isLastFrozen={'existingRange' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-center ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Allocation Sart Date to End Date</ResizableTh>
                )}
                {isColVisible('allocationNo') && (
                  <ResizableTh width={getColWidth('allocationNo')} onWidthChange={(w) => setColumnWidth('allocationNo', w)} isSticky={isColFrozen('allocationNo')} stickyLeft={getStickyLeft('allocationNo')} isLastFrozen={'allocationNo' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-center ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Allocation No</ResizableTh>
                )}
                {isColVisible('yarnRqQty') && (
                  <ResizableTh width={getColWidth('yarnRqQty')} onWidthChange={(w) => setColumnWidth('yarnRqQty', w)} isSticky={isColFrozen('yarnRqQty')} stickyLeft={getStickyLeft('yarnRqQty')} isLastFrozen={'yarnRqQty' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-right bg-blue-50/50 dark:bg-blue-950/30 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Yarn Rq Qty</ResizableTh>
                )}
                {isColVisible('allocatedQty') && (
                  <ResizableTh width={getColWidth('allocatedQty')} onWidthChange={(w) => setColumnWidth('allocatedQty', w)} isSticky={isColFrozen('allocatedQty')} stickyLeft={getStickyLeft('allocatedQty')} isLastFrozen={'allocatedQty' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-right bg-emerald-50/50 dark:bg-emerald-950/30 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Allocated Qty</ResizableTh>
                )}
                {isColVisible('balance') && (
                  <ResizableTh width={getColWidth('balance')} onWidthChange={(w) => setColumnWidth('balance', w)} isSticky={isColFrozen('balance')} stickyLeft={getStickyLeft('balance')} isLastFrozen={'balance' === lastFrozenColId} className={`px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 text-right bg-amber-50/50 dark:bg-amber-950/30 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Balance</ResizableTh>
                )}
                {isColVisible('remarks') && (
                  <ResizableTh width={getColWidth('remarks')} onWidthChange={(w) => setColumnWidth('remarks', w)} isSticky={isColFrozen('remarks')} stickyLeft={getStickyLeft('remarks')} isLastFrozen={'remarks' === lastFrozenColId} className={`px-3.5 py-3 ${isWrapText ? 'whitespace-normal break-words' : 'whitespace-nowrap overflow-hidden text-ellipsis'}`}>Remarks</ResizableTh>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-semibold text-slate-800 dark:text-slate-200">
              {filteredYarnAllocations.length === 0 ? (
                <tr>
                  <td colSpan={21} className="py-12 text-center text-slate-400 font-medium">
                    No Yarn Allocation records found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedYarnAllocations.map((row, rowIdx) => (
                  <tr key={row.id ? `${row.id}-${rowIdx}` : `yarn-${rowIdx}`} className="group hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                    {isColVisible('actualRequisitionDate') && (
                      <td style={{ width: `${getColWidth('actualRequisitionDate')}px`, minWidth: `${getColWidth('actualRequisitionDate')}px`, maxWidth: `${getColWidth('actualRequisitionDate')}px`, ...getStickyStyle('actualRequisitionDate') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-bold text-slate-900 dark:text-white ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('actualRequisitionDate')}`}>
                        {formatDisplayDate(row.actualRequisitionDate)}
                      </td>
                    )}
                    {isColVisible('buyer') && (
                      <td style={{ width: `${getColWidth('buyer')}px`, minWidth: `${getColWidth('buyer')}px`, maxWidth: `${getColWidth('buyer')}px`, ...getStickyStyle('buyer') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-black text-slate-900 dark:text-white ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('buyer')}`}>
                        {row.buyer || '-'}
                      </td>
                    )}
                    {isColVisible('orderNumber') && (
                      <td style={{ width: `${getColWidth('orderNumber')}px`, minWidth: `${getColWidth('orderNumber')}px`, maxWidth: `${getColWidth('orderNumber')}px`, ...getStickyStyle('orderNumber') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono font-bold text-blue-600 dark:text-blue-400 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('orderNumber')}`}>
                        {row.orderNumber || '-'}
                      </td>
                    )}
                    {isColVisible('fabricsType') && (
                      <td style={{ width: `${getColWidth('fabricsType')}px`, minWidth: `${getColWidth('fabricsType')}px`, maxWidth: `${getColWidth('fabricsType')}px`, ...getStickyStyle('fabricsType') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-bold ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('fabricsType')}`}>
                        {row.fabricsType || '-'}
                      </td>
                    )}
                    {isColVisible('fabricShade') && (
                      <td style={{ width: `${getColWidth('fabricShade')}px`, minWidth: `${getColWidth('fabricShade')}px`, maxWidth: `${getColWidth('fabricShade')}px`, ...getStickyStyle('fabricShade') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('fabricShade')}`}>
                        {row.fabricShade || '-'}
                      </td>
                    )}
                    {isColVisible('fabricGsm') && (
                      <td style={{ width: `${getColWidth('fabricGsm')}px`, minWidth: `${getColWidth('fabricGsm')}px`, maxWidth: `${getColWidth('fabricGsm')}px`, ...getStickyStyle('fabricGsm') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center font-bold ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('fabricGsm')}`}>
                        {row.fabricGsm || '-'}
                      </td>
                    )}
                    {isColVisible('yarnRequired') && (
                      <td style={{ width: `${getColWidth('yarnRequired')}px`, minWidth: `${getColWidth('yarnRequired')}px`, maxWidth: `${getColWidth('yarnRequired')}px`, ...getStickyStyle('yarnRequired') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-bold text-slate-800 dark:text-slate-200 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('yarnRequired')}`}>
                        {row.yarnRequired || '-'}
                      </td>
                    )}
                    {isColVisible('lotRef') && (
                      <td style={{ width: `${getColWidth('lotRef')}px`, minWidth: `${getColWidth('lotRef')}px`, maxWidth: `${getColWidth('lotRef')}px`, ...getStickyStyle('lotRef') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 italic ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('lotRef')}`}>
                        {row.lotRef || '-'}
                      </td>
                    )}
                    {isColVisible('allocatedYarn') && (
                      <td style={{ width: `${getColWidth('allocatedYarn')}px`, minWidth: `${getColWidth('allocatedYarn')}px`, maxWidth: `${getColWidth('allocatedYarn')}px`, ...getStickyStyle('allocatedYarn') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-bold text-slate-900 dark:text-white ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('allocatedYarn')}`}>
                        {row.allocatedYarn || '-'}
                      </td>
                    )}
                    {isColVisible('lotNo') && (
                      <td style={{ width: `${getColWidth('lotNo')}px`, minWidth: `${getColWidth('lotNo')}px`, maxWidth: `${getColWidth('lotNo')}px`, ...getStickyStyle('lotNo') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono font-bold text-slate-900 dark:text-white ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('lotNo')}`}>
                        {row.lotNo || '-'}
                      </td>
                    )}
                    {isColVisible('spinnersName') && (
                      <td style={{ width: `${getColWidth('spinnersName')}px`, minWidth: `${getColWidth('spinnersName')}px`, maxWidth: `${getColWidth('spinnersName')}px`, ...getStickyStyle('spinnersName') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 font-semibold ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('spinnersName')}`}>
                        {row.spinnersName || '-'}
                      </td>
                    )}
                    {isColVisible('allocationStatus') && (
                      <td style={{ width: `${getColWidth('allocationStatus')}px`, minWidth: `${getColWidth('allocationStatus')}px`, maxWidth: `${getColWidth('allocationStatus')}px`, ...getStickyStyle('allocationStatus') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('allocationStatus')}`}>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                          {row.allocationStatus || 'Allocated'}
                        </span>
                      </td>
                    )}
                    {isColVisible('yarnStockStatus') && (
                      <td style={{ width: `${getColWidth('yarnStockStatus')}px`, minWidth: `${getColWidth('yarnStockStatus')}px`, maxWidth: `${getColWidth('yarnStockStatus')}px`, ...getStickyStyle('yarnStockStatus') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('yarnStockStatus')}`}>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {row.yarnStockStatus || 'Stock Available'}
                        </span>
                      </td>
                    )}
                    {isColVisible('yarnDeliveryStatus') && (
                      <td style={{ width: `${getColWidth('yarnDeliveryStatus')}px`, minWidth: `${getColWidth('yarnDeliveryStatus')}px`, maxWidth: `${getColWidth('yarnDeliveryStatus')}px`, ...getStickyStyle('yarnDeliveryStatus') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('yarnDeliveryStatus')}`}>
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300">
                          {row.yarnDeliveryStatus || 'Completed'}
                        </span>
                      </td>
                    )}
                    {isColVisible('proposedAllocationDate') && (
                      <td style={{ width: `${getColWidth('proposedAllocationDate')}px`, minWidth: `${getColWidth('proposedAllocationDate')}px`, maxWidth: `${getColWidth('proposedAllocationDate')}px`, ...getStickyStyle('proposedAllocationDate') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center text-slate-500 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('proposedAllocationDate')}`}>
                        {formatDisplayDate(row.proposedAllocationDate)}
                      </td>
                    )}
                    {isColVisible('existingRange') && (
                      <td style={{ width: `${getColWidth('existingRange')}px`, minWidth: `${getColWidth('existingRange')}px`, maxWidth: `${getColWidth('existingRange')}px`, ...getStickyStyle('existingRange') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('existingRange')}`}>
                        {formatDisplayDate(row.allocationDateRange)}
                      </td>
                    )}
                    {isColVisible('allocationNo') && (
                      <td style={{ width: `${getColWidth('allocationNo')}px`, minWidth: `${getColWidth('allocationNo')}px`, maxWidth: `${getColWidth('allocationNo')}px`, ...getStickyStyle('allocationNo') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-center font-mono font-bold text-blue-600 dark:text-blue-400 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('allocationNo')}`}>
                        {row.allocationNo || '-'}
                      </td>
                    )}

                    {/* QUANTITY COLUMNS */}
                    {isColVisible('yarnRqQty') && (
                      <td style={{ width: `${getColWidth('yarnRqQty')}px`, minWidth: `${getColWidth('yarnRqQty')}px`, maxWidth: `${getColWidth('yarnRqQty')}px`, ...getStickyStyle('yarnRqQty') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-right font-mono font-black text-slate-900 dark:text-white bg-blue-50/20 dark:bg-blue-950/10 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('yarnRqQty')}`}>
                        {formatYarnQty(row.yarnRqQty)}
                      </td>
                    )}
                    {isColVisible('allocatedQty') && (
                      <td style={{ width: `${getColWidth('allocatedQty')}px`, minWidth: `${getColWidth('allocatedQty')}px`, maxWidth: `${getColWidth('allocatedQty')}px`, ...getStickyStyle('allocatedQty') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('allocatedQty')}`}>
                        {formatYarnQty(row.allocatedQty)}
                      </td>
                    )}
                    {isColVisible('balance') && (
                      <td style={{ width: `${getColWidth('balance')}px`, minWidth: `${getColWidth('balance')}px`, maxWidth: `${getColWidth('balance')}px`, ...getStickyStyle('balance') }} className={`px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 text-right font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('balance')}`}>
                        {formatYarnQty(row.balance)}
                      </td>
                    )}
                    {isColVisible('remarks') && (
                      <td style={{ width: `${getColWidth('remarks')}px`, minWidth: `${getColWidth('remarks')}px`, maxWidth: `${getColWidth('remarks')}px`, ...getStickyStyle('remarks') }} className={`px-3.5 py-3 text-slate-500 ${isWrapText ? 'whitespace-normal break-words py-2.5 align-top overflow-hidden' : 'whitespace-nowrap overflow-hidden text-ellipsis align-middle'} ${getStickyClass('remarks')}`}>
                        {row.remarks || '-'}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>

            {/* SUMMARY TOTALS FOOTER ROW */}
            {filteredYarnAllocations.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={17} className="px-3.5 py-3 text-right uppercase text-[11px] tracking-wider text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
                    TOTALS ({filteredYarnAllocations.length} ITEMS):
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-black text-blue-700 dark:text-blue-300 border-r border-slate-200 dark:border-slate-700 bg-blue-100/50 dark:bg-blue-950/50">
                    {formatYarnQty(yarnTotals.yarnRqQty)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-black text-emerald-700 dark:text-emerald-300 border-r border-slate-200 dark:border-slate-700 bg-emerald-100/50 dark:bg-emerald-950/50">
                    {formatYarnQty(yarnTotals.allocatedQty)}
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-black text-amber-700 dark:text-amber-300 border-r border-slate-200 dark:border-slate-700 bg-amber-100/50 dark:bg-amber-950/50">
                    {formatYarnQty(yarnTotals.balance)}
                  </td>
                  <td className="px-3.5 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* PAGINATION CONTROLS */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="font-bold text-slate-900 dark:text-white">{filteredYarnAllocations.length > 0 ? (currentPage - 1) * (pageSize || filteredYarnAllocations.length) + 1 : 0}</strong> to <strong className="font-bold text-slate-900 dark:text-white">{pageSize === 0 ? filteredYarnAllocations.length : Math.min(currentPage * pageSize, filteredYarnAllocations.length)}</strong> of <strong className="font-bold text-slate-900 dark:text-white">{filteredYarnAllocations.length}</strong> records
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-2 py-1 text-xs font-semibold focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={0}>All</option>
              </select>
            </div>
          </div>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
                Page {currentPage} of {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Next Page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* UPLOAD YARN ALLOCATION FILE MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Upload Master Yarn Allocation File
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Upload Master Excel file (.xlsx, .xls) to replace existing allocation dataset
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setParsedData(null);
                  setUploadError(null);
                }}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {/* Note callout */}
              <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
                  <strong>Master Data Overwrite:</strong> Submitting a new file will completely <strong>replace (overwrite)</strong> the previous imported dataset. No duplicate records will be kept.
                </p>
              </div>

              {/* File Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    processSelectedFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <div className="h-12 w-12 rounded-2xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Click to browse or drag & drop file
                  </span>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    Supports Excel files (.xlsx, .xls) only
                  </span>
                </div>
              </div>

              {/* Parsing state */}
              {isParsing && (
                <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                  <span>Parsing file contents...</span>
                </div>
              )}

              {/* File error */}
              {uploadError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3 text-xs font-semibold text-red-700 dark:text-red-300">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>{uploadError}</span>
                </div>
              )}

              {/* File Success / Parsed Details */}
              {parsedData && uploadFile && !isParsing && (
                <div className="rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                      <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span className="truncate max-w-[280px]">{uploadFile.name}</span>
                    </div>
                    <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {parsedData.length} Records Found
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Ready to import. Click <strong>Submit & Replace Data</strong> to overwrite current allocation data.
                  </p>

                  {/* Quick Preview of parsed data sample */}
                  <div className="mt-2 pt-2 border-t border-blue-200/60 dark:border-blue-800/60 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-700 dark:text-slate-200">Sample Records:</span>
                    <ul className="mt-1 space-y-1 list-disc list-inside max-h-24 overflow-y-auto font-mono text-[10px]">
                      {parsedData.slice(0, 3).map((r, i) => (
                        <li key={i} className="truncate">
                          Order #{r.orderNumber || 'N/A'} | Buyer: {r.buyer || 'N/A'} | Lot #{r.lotNo || 'N/A'} | Rq Qty: {r.yarnRqQty} Kg
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFile(null);
                    setParsedData(null);
                    setUploadError(null);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!parsedData || parsedData.length === 0 || isParsing || isSaving}
                  onClick={handleConfirmUpload}
                  className={`rounded-xl px-5 py-2 text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    parsedData && parsedData.length > 0 && !isParsing && !isSaving
                      ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isSaving ? (
                    <>
                      <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      <span>Saving Data...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-4 w-4" />
                      <span>Submit & Replace Data</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
