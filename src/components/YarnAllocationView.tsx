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
  FileText
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { GasClient } from '../lib/gasClient';

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
  allocationDate: string;
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
    allocationDate: '29-Jun-25',
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
    allocationDate: '8-Jul-25',
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
    allocationDate: '29-Jun-25',
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
    allocationDate: '29-Jun-25',
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
    allocationDate: '8-Jul-25',
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

function parseExcelDate(val: any): string {
  if (!val && val !== 0) return '';
  if (typeof val === 'number') {
    const dateObj = XLSX.SSF.parse_date_code(val);
    if (dateObj) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mStr = months[dateObj.m - 1] || 'Jan';
      const yr = String(dateObj.y).slice(-2);
      return `${dateObj.d}-${mStr}-${yr}`;
    }
  }
  if (val instanceof Date) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = val.getDate();
    const mStr = months[val.getMonth()] || 'Jan';
    const yr = String(val.getFullYear()).slice(-2);
    return `${d}-${mStr}-${yr}`;
  }
  return String(val).trim();
}

function getColValue(row: Record<string, any>, possibleKeys: string[]): any {
  const keys = Object.keys(row);
  for (const pk of possibleKeys) {
    const foundKey = keys.find(k => k.trim().toLowerCase() === pk.toLowerCase());
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
      return row[foundKey];
    }
  }
  return '';
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

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedData, setParsedData] = useState<YarnAllocationRecord[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessBanner, setUploadSuccessBanner] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredYarnAllocations = useMemo(() => {
    return yarnAllocations.filter(item => {
      const q = yarnSearchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        item.orderNumber.toLowerCase().includes(q) ||
        item.buyer.toLowerCase().includes(q) ||
        item.fabricsType.toLowerCase().includes(q) ||
        item.yarnRequired.toLowerCase().includes(q) ||
        item.allocatedYarn.toLowerCase().includes(q) ||
        item.lotNo.toLowerCase().includes(q) ||
        item.spinnersName.toLowerCase().includes(q) ||
        item.allocationNo.toLowerCase().includes(q) ||
        item.remarks.toLowerCase().includes(q);

      const matchesBuyer = yarnBuyerFilter === 'All' || item.buyer === yarnBuyerFilter;
      const matchesFabric = yarnFabricFilter === 'All' || item.fabricsType === yarnFabricFilter;
      const matchesSpinner = yarnSpinnerFilter === 'All' || item.spinnersName === yarnSpinnerFilter;

      return matchesSearch && matchesBuyer && matchesFabric && matchesSpinner;
    });
  }, [yarnAllocations, yarnSearchQuery, yarnBuyerFilter, yarnFabricFilter, yarnSpinnerFilter]);

  const yarnTotals = useMemo(() => {
    return filteredYarnAllocations.reduce((acc, curr) => ({
      yarnRqQty: acc.yarnRqQty + (curr.yarnRqQty || 0),
      allocatedQty: acc.allocatedQty + (curr.allocatedQty || 0),
      balance: acc.balance + (curr.balance || 0),
    }), { yarnRqQty: 0, allocatedQty: 0, balance: 0 });
  }, [filteredYarnAllocations]);

  const uniqueOrdersCount = useMemo(() => {
    return new Set(filteredYarnAllocations.map(item => item.orderNumber?.trim()).filter(Boolean)).size;
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
      'Allocation Date': item.allocationDate,
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

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          setUploadError('No sheets found in the uploaded file.');
          setIsParsing(false);
          return;
        }
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          setUploadError('The uploaded sheet is empty.');
          setIsParsing(false);
          return;
        }

        const records: YarnAllocationRecord[] = jsonData.map((row, idx) => {
          const rqQty = parseFloat(getColValue(row, ['Yarn Rq Qty', 'Yarn Req Qty', 'Required Qty', 'yarnRqQty'])) || 0;
          const alcQty = parseFloat(getColValue(row, ['Allocated Qty', 'Allocated Quantity', 'allocatedQty'])) || 0;
          let balVal = getColValue(row, ['Balance', 'balance']);
          let bal = typeof balVal === 'number' ? balVal : parseFloat(balVal);
          if (isNaN(bal)) {
            bal = rqQty - alcQty;
          }

          return {
            id: `ya-up-${idx + 1}-${Date.now()}`,
            actualRequisitionDate: parseExcelDate(getColValue(row, ['Actual Yarn Requisition date', 'Actual Requisition Date', 'Requisition Date', 'Req Date', 'actualRequisitionDate'])),
            buyer: String(getColValue(row, ['Buyer', 'buyer']) || '').trim(),
            orderNumber: String(getColValue(row, ['Order Number', 'Order No', 'Order #', 'orderNumber']) || '').trim(),
            fabricsType: String(getColValue(row, ['Fabrics Type', 'Fabric Type', 'fabricsType']) || '').trim(),
            fabricShade: String(getColValue(row, ['Fabric Shade', 'Shade', 'fabricShade']) || '').trim(),
            fabricGsm: getColValue(row, ['Fabric GSM', 'GSM', 'fabricGsm']) || '',
            yarnRequired: String(getColValue(row, ['Yarn Required', 'yarnRequired']) || '').trim(),
            lotRef: String(getColValue(row, ['Lot Ref', 'lotRef']) || '').trim(),
            allocatedYarn: String(getColValue(row, ['Allocated Yarn', 'allocatedYarn']) || '').trim(),
            lotNo: String(getColValue(row, ['Lot #', 'Lot No', 'Lot Number', 'lotNo']) || '').trim(),
            spinnersName: String(getColValue(row, ['Spinner\'s Name', 'Spinners Name', 'Spinner Name', 'Spinner', 'spinnersName']) || '').trim(),
            allocationStatus: String(getColValue(row, ['Allocation Status', 'allocationStatus']) || 'Allocated').trim(),
            yarnStockStatus: String(getColValue(row, ['Yarn Stock Status', 'yarnStockStatus']) || 'Stock Available').trim(),
            yarnDeliveryStatus: String(getColValue(row, ['Yarn Delivery Status', 'yarnDeliveryStatus']) || 'Completed').trim(),
            proposedAllocationDate: parseExcelDate(getColValue(row, ['Proposed Allocation Date', 'proposedAllocationDate'])),
            allocationDate: parseExcelDate(getColValue(row, ['Allocation Date', 'allocationDate'])),
            allocationDateRange: String(getColValue(row, ['Allocation Sart Date to End Date', 'Allocation Start Date to End Date', 'Allocation Date Range', 'allocationDateRange']) || '').trim(),
            allocationNo: String(getColValue(row, ['Allocation No', 'Allocation #', 'allocationNo']) || '').trim(),
            yarnRqQty: rqQty,
            allocatedQty: alcQty,
            balance: bal,
            remarks: String(getColValue(row, ['Remarks', 'remarks']) || '').trim(),
          };
        });

        setParsedData(records);
        setIsParsing(false);
      } catch (err) {
        console.error('Error parsing Excel file:', err);
        setUploadError('Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file.');
        setIsParsing(false);
      }
    };
    reader.readAsArrayBuffer(file);
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
    if (!parsedData || parsedData.length === 0) return;
    setYarnAllocations(parsedData);
    GasClient.saveYarnAllocations(parsedData).catch((err) => {
      console.warn("Failed to save uploaded yarn allocations to Google Sheets:", err);
    });
    setShowUploadModal(false);
    setUploadSuccessBanner(`Successfully replaced Yarn Allocation data with ${parsedData.length} records from ${uploadFile?.name || 'uploaded file'}.`);
    setUploadFile(null);
    setParsedData(null);
    setUploadError(null);
    setTimeout(() => {
      setUploadSuccessBanner(null);
    }, 6000);
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
            <span>Upload Allocation File</span>
          </button>
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
              {Array.from(new Set(yarnAllocations.map(a => a.buyer))).filter(Boolean).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={yarnFabricFilter}
              onChange={(e) => setYarnFabricFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All Fabrics</option>
              {Array.from(new Set(yarnAllocations.map(a => a.fabricsType))).filter(Boolean).map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>

            <select
              value={yarnSpinnerFilter}
              onChange={(e) => setYarnSpinnerFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="All">All Spinners</option>
              {Array.from(new Set(yarnAllocations.map(a => a.spinnersName))).filter(Boolean).map(s => (
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
                <th className="px-3.5 py-3 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center">Allocation Date</th>
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
                  <td colSpan={22} className="py-12 text-center text-slate-400 font-medium">
                    No Yarn Allocation records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredYarnAllocations.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/30 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                      {row.actualRequisitionDate || '-'}
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
                      {row.proposedAllocationDate || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center font-bold">
                      {row.allocationDate || '-'}
                    </td>
                    <td className="px-3.5 py-3 border-r border-slate-100 dark:border-slate-800/80 whitespace-nowrap text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      {row.allocationDateRange || '-'}
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
                    Upload Yarn Allocation File
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Upload an Excel (.xlsx, .xls) or CSV file to replace existing allocation data
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
                  <strong>Note:</strong> Submitting a new file will completely <strong>replace</strong> all existing Yarn Allocation records with the records from the uploaded file.
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
                  accept=".xlsx,.xls,.csv"
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
                    Supports Excel (.xlsx, .xls) and CSV (.csv) files
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
                  disabled={!parsedData || parsedData.length === 0 || isParsing}
                  onClick={handleConfirmUpload}
                  className={`rounded-xl px-5 py-2 text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer ${
                    parsedData && parsedData.length > 0 && !isParsing
                      ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Submit & Replace Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
