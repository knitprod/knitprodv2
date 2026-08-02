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
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { GasClient } from '../lib/gasClient';

export interface MasterUploadInfo {
  lastUploadedAt: string | null;
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
  if (val === 0) return '-';
  if (val < 0) return `(${Math.abs(val).toLocaleString()})`;
  return val.toLocaleString();
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

export default function YarnAllocationView({ currentUser }: YarnAllocationViewProps) {
  const [yarnAllocations, setYarnAllocations] = useState<YarnAllocationRecord[]>(INITIAL_YARN_ALLOCATIONS);
  const [yarnSearchQuery, setYarnSearchQuery] = useState('');
  const [yarnBuyerFilter, setYarnBuyerFilter] = useState('All');
  const [yarnFabricFilter, setYarnFabricFilter] = useState('All');
  const [yarnSpinnerFilter, setYarnSpinnerFilter] = useState('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  // Master upload metadata state
  const [uploadInfo, setUploadInfo] = useState<MasterUploadInfo>(() => {
    try {
      const saved = localStorage.getItem('master_yarn_upload_info');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      lastUploadedAt: '01-Aug-2026, 10:30 AM',
      fileName: 'Master_Yarn_Allocation.xlsx',
      totalRecords: INITIAL_YARN_ALLOCATIONS.length,
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

  // Load saved yarn allocations from server database on mount
  useEffect(() => {
    let isMounted = true;
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

    return () => { isMounted = false; };
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [yarnSearchQuery, yarnBuyerFilter, yarnFabricFilter, yarnSpinnerFilter, pageSize]);

  const uniqueBuyers = useMemo(() => {
    return Array.from(new Set(yarnAllocations.map(a => a.buyer))).filter(Boolean).sort();
  }, [yarnAllocations]);

  const uniqueFabrics = useMemo(() => {
    return Array.from(new Set(yarnAllocations.map(a => a.fabricsType))).filter(Boolean).sort();
  }, [yarnAllocations]);

  const uniqueSpinners = useMemo(() => {
    return Array.from(new Set(yarnAllocations.map(a => a.spinnersName))).filter(Boolean).sort();
  }, [yarnAllocations]);

  const filteredYarnAllocations = useMemo(() => {
    const q = yarnSearchQuery.trim().toLowerCase();

    return yarnAllocations.filter(item => {
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
  }, [yarnAllocations, yarnSearchQuery, yarnBuyerFilter, yarnFabricFilter, yarnSpinnerFilter]);

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

          // Fast O(1) header column lookup map
          const findHeaderKey = (possibleKeys: string[]): string => {
            for (const pk of possibleKeys) {
              const pkClean = pk.toLowerCase().trim();
              const match = headers.find(h => {
                const hc = h.toLowerCase().trim();
                return hc === pkClean || hc.startsWith(pkClean) || (pkClean.length > 3 && hc.includes(pkClean));
              });
              if (match) return match;
            }
            return '';
          };

          const colMap = {
            orderNumber: findHeaderKey(['fabric booking no', 'fabric booking number', 'order number', 'order no', 'order #', 'booking no', 'booking']),
            fabricsType: findHeaderKey(['fabrics type', 'fabric type', 'fabric']),
            fabricShade: findHeaderKey(['fabric shade', 'shade', 'color']),
            fabricGsm: findHeaderKey(['fabric gsm', 'gsm']),
            yarnRequired: findHeaderKey(['yarn category', 'yarn required', 'as per fr', 'yarn cat', 'category']),
            allocatedYarn: findHeaderKey(['yarn count physical', 'allocated yarn', 'count physical', 'physical count', 'yarn req', 'count']),
            lotNo: findHeaderKey(['lot #', 'lot no', 'lot number', 'lot']),
            spinnersName: findHeaderKey(["spinner's name", 'spinners name', 'spinner name', 'spinner']),
            buyer: findHeaderKey(['buyer']),
            lotRef: findHeaderKey(['lot reference', 'lot ref']),
            allocationStatus: findHeaderKey(['allocation status']),
            yarnStockStatus: findHeaderKey(['yarn stock status']),
            yarnDeliveryStatus: findHeaderKey(['yarn delivery status']),
            proposedAllocationDate: findHeaderKey(['proposed allocation date']),
            actualRequisitionDate: findHeaderKey(['actual yarn requisition date', 'actual requisition date', 'requisition date', 'req date']),
            allocationNo: findHeaderKey(['allocation no', 'allocation #', 'allocation number']),
            remarks: findHeaderKey(['remarks', 'comment']),
            yarnRqQty: findHeaderKey(['yarn requisition qty', 'yarn rq qty', 'yarn req qty', 'required qty']),
            allocatedQty: findHeaderKey(['allocated qty', 'allocated quantity']),
            balance: findHeaderKey(['balance qty', 'balance']),
            allocationDate: findHeaderKey(['allocation date', 'alloc date', 'allocation d', 'alloc d', 'date']),
            existingRange: findHeaderKey(['allocation sart date to end date', 'allocation start date to end date', 'allocation date range']),
          };

          // Validate required source columns
          const missingCols: string[] = [];
          if (!colMap.orderNumber) missingCols.push('Fabric Booking No');
          if (!colMap.yarnRequired) missingCols.push('Yarn Category');
          if (!colMap.allocatedYarn) missingCols.push('Yarn Count Physical');
          if (!colMap.allocationDate) missingCols.push('Allocation Date');

          if (missingCols.length > 0) {
            const errMsg = `Import Cancelled: Missing required column(s) in uploaded file: ${missingCols.join(', ')}. Please upload a valid Master Yarn Allocation file containing all required source columns.`;
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

            const orderNumber = String(colMap.orderNumber ? rowObj[colMap.orderNumber] : '').trim();
            const fabricsType = String(colMap.fabricsType ? rowObj[colMap.fabricsType] : '').trim();
            const fabricShade = String(colMap.fabricShade ? rowObj[colMap.fabricShade] : '').trim();
            const fabricGsm = colMap.fabricGsm ? rowObj[colMap.fabricGsm] : '';
            const yarnRequired = String(colMap.yarnRequired ? rowObj[colMap.yarnRequired] : '').trim();
            const allocatedYarn = String(colMap.allocatedYarn ? rowObj[colMap.allocatedYarn] : '').trim();
            const lotNo = String(colMap.lotNo ? rowObj[colMap.lotNo] : '').trim();
            const spinnersName = String(colMap.spinnersName ? rowObj[colMap.spinnersName] : '').trim();

            const groupKey = `${orderNumber.toLowerCase()}|${fabricsType.toLowerCase()}|${fabricShade.toLowerCase()}|${String(fabricGsm).toLowerCase()}|${allocatedYarn.toLowerCase()}|${lotNo.toLowerCase()}|${spinnersName.toLowerCase()}`;

            const rqQty = parseFloat(colMap.yarnRqQty ? rowObj[colMap.yarnRqQty] : 0) || 0;
            const alcQty = parseFloat(colMap.allocatedQty ? rowObj[colMap.allocatedQty] : 0) || 0;
            let balVal = colMap.balance ? rowObj[colMap.balance] : '';
            let bal = typeof balVal === 'number' ? balVal : parseFloat(balVal);
            if (isNaN(bal)) bal = rqQty - alcQty;

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

  // Load yarn allocations from Google Sheets / GasClient on mount
  useEffect(() => {
    GasClient.fetchYarnAllocations().then((remoteData) => {
      if (remoteData && remoteData.length > 0) {
        setYarnAllocations(remoteData as YarnAllocationRecord[]);
      } else {
        // Save initial seed yarn allocations to Google Sheets / GasClient
        GasClient.saveYarnAllocations(INITIAL_YARN_ALLOCATIONS).catch(() => {});
      }
    }).catch((err) => {
      console.warn("Could not load yarn allocations from Google Sheets:", err);
    });
  }, []);

  const handleConfirmUpload = () => {
    if (!parsedData || parsedData.length === 0 || isSaving) return;

    setIsSaving(true);
    setUploadError(null);

    const dataToSave = parsedData;
    const fileName = uploadFile?.name || 'Master_Yarn_Allocation.xlsx';

    // Step 1: Update browser state immediately 1st
    setYarnAllocations(dataToSave);
    setCurrentPage(1);

    const nowStr = new Date().toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const newUploadInfo: MasterUploadInfo = {
      lastUploadedAt: nowStr,
      fileName: fileName,
      totalRecords: dataToSave.length,
      status: 'Success'
    };

    setUploadInfo(newUploadInfo);
    try {
      localStorage.setItem('master_yarn_upload_info', JSON.stringify(newUploadInfo));
    } catch (e) {}

    setUploadSuccessBanner(`Updated browser instantly with ${dataToSave.length.toLocaleString()} allocation records! Syncing to Google Sheets...`);
    setShowUploadModal(false);
    setUploadFile(null);
    setParsedData(null);
    setUploadError(null);
    setIsSaving(false);

    // Step 2: Sync to Google Sheets and Server DB in background
    GasClient.saveYarnAllocations(dataToSave, true).then(() => {
      setUploadSuccessBanner(`Successfully imported and synced all ${dataToSave.length.toLocaleString()} yarn allocation records with Google Sheets.`);
    }).catch((err) => {
      console.warn("Background Google Sheets sync notice:", err);
      setUploadSuccessBanner(`Browser updated with ${dataToSave.length.toLocaleString()} records. (Google Sheets background sync notice: ${err.message || 'Check Apps Script endpoint'}).`);
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

      {/* MASTER UPLOAD INFORMATION STATUS BAR */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
              uploadInfo.status === 'Success'
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800'
                : uploadInfo.status === 'Failed'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            }`}>
              <UploadCloud className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Master Allocation Data Source
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  uploadInfo.status === 'Success'
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                    : uploadInfo.status === 'Failed'
                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  Status: {uploadInfo.status}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span><span className="text-slate-400 font-medium">File:</span> {uploadInfo.fileName || 'None'}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span><span className="text-slate-400 font-medium">Last Uploaded:</span> {uploadInfo.lastUploadedAt || 'N/A'}</span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span><span className="text-slate-400 font-medium">Total Records:</span> <span className="font-extrabold text-blue-600 dark:text-blue-400">{uploadInfo.totalRecords}</span></span>
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Order #, Lot #, Buyer, Yarn, Allocation No..."
              value={yarnSearchQuery}
              onChange={(e) => setYarnSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 pl-10 pr-3.5 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={yarnBuyerFilter}
              onChange={(e) => setYarnBuyerFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All Buyers</option>
              {uniqueBuyers.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={yarnFabricFilter}
              onChange={(e) => setYarnFabricFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All Fabrics</option>
              {uniqueFabrics.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <select
              value={yarnSpinnerFilter}
              onChange={(e) => setYarnSpinnerFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All Spinners</option>
              {uniqueSpinners.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* MATRIX SPREADSHEET TABLE */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="overflow-x-auto max-h-[680px]">
          <table className="w-full text-left text-xs border-collapse min-w-[2100px]">
            <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-xs font-extrabold uppercase text-slate-600 dark:text-slate-300 text-[10px] tracking-tight border-b-2 border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Actual Yarn Requisition date</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Buyer</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Order Number</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Fabrics Type</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Fabric Shade</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center">Fabric GSM</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap min-w-[180px]">Yarn Required</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap min-w-[160px]">Lot Ref</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap min-w-[180px]">Allocated Yarn</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Lot #</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap">Spinner's Name</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center">Allocation Status</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center">Yarn Stock Status</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center">Yarn Delivery Status</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center">Proposed Allocation Date</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap min-w-[160px] text-center">Allocation Sart Date to End Date</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center">Allocation No</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-right bg-blue-50/50 dark:bg-blue-950/30">Yarn Rq Qty</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-right bg-emerald-50/50 dark:bg-emerald-950/30">Allocated Qty</th>
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-right bg-amber-50/50 dark:bg-amber-950/30">Balance</th>
                <th className="px-3.5 py-3 whitespace-nowrap min-w-[160px]">Remarks</th>
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
                paginatedYarnAllocations.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {formatDisplayDate(row.actualRequisitionDate)}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-black text-slate-900 dark:text-white">
                      {row.buyer || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-mono font-bold text-blue-600 dark:text-blue-400">
                      {row.orderNumber || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-bold">
                      {row.fabricsType || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      {row.fabricShade || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center font-bold">
                      {row.fabricGsm || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-bold text-slate-800 dark:text-slate-200">
                      {row.yarnRequired || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300 italic">
                      {row.lotRef || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {row.allocatedYarn || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-mono font-bold text-slate-900 dark:text-white">
                      {row.lotNo || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-semibold">
                      {row.spinnersName || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-black bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300">
                        {row.allocationStatus || 'Allocated'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {row.yarnStockStatus || 'Stock Available'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300">
                        {row.yarnDeliveryStatus || 'Completed'}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center text-slate-500">
                      {formatDisplayDate(row.proposedAllocationDate)}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {formatDisplayDate(row.allocationDateRange)}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                      {row.allocationNo || '-'}
                    </td>

                    {/* QUANTITY COLUMNS */}
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-right font-mono font-black text-slate-900 dark:text-white bg-blue-50/20 dark:bg-blue-950/10">
                      {formatYarnQty(row.yarnRqQty)}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-right font-mono font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                      {formatYarnQty(row.allocatedQty)}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-right font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50/20 dark:bg-amber-950/10">
                      {formatYarnQty(row.balance)}
                    </td>

                    <td className="px-3.5 py-3 whitespace-nowrap text-xs text-slate-600 dark:text-slate-300">
                      {row.remarks || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* SUMMARY TOTALS FOOTER ROW */}
            {filteredYarnAllocations.length > 0 && (
              <tfoot className="bg-slate-100 dark:bg-slate-800 font-extrabold text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                <tr>
                  <td colSpan={18} className="px-3.5 py-3 text-right uppercase text-[11px] tracking-wider text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700">
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
