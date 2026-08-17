import React, { useState, useRef } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Download,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  XCircle,
  HelpCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { LedgerRecord } from '../types';

export interface AppColumnDefinition {
  key: keyof LedgerRecord | string;
  label: string;
  category: string;
  aliases: string[];
  required?: boolean;
}

// Complete 51 App Table Columns Matching the Production Ledger UI
export const APP_LEDGER_COLUMNS: AppColumnDefinition[] = [
  { key: 'unit', label: 'Unit', category: 'General', aliases: ['unit', 'unit type', 'in-house/sub-contact', 'unittype'], required: false },
  { key: 'year', label: 'Year', category: 'General', aliases: ['year', 'yr', 'calyear', 'calendaryear'], required: true },
  { key: 'month', label: 'Month', category: 'General', aliases: ['month', 'mth', 'monthname'], required: true },
  { key: 'date', label: 'Date', category: 'General', aliases: ['date', 'production date', 'entry date', 'date of prod', 'dateddmmmyyyy'], required: true },
  { key: 'floor', label: 'Floor', category: 'General', aliases: ['floor', 'floor/unit', 'factory floor', 'unit name', 'floor unit', 'section', 'line/floor'], required: true },
  { key: 'target', label: 'Target Total', category: 'Production Data', aliases: ['target total', 'target', 'total target', 'target output (kg)', 'plan target', 'target output'], required: true },
  { key: 'shiftA', label: 'Shift A', category: 'Production Data', aliases: ['shift a', 'shift_a', 'shifta', 'a shift', 'shift a output (kg)', 'shift a output'] },
  { key: 'shiftB', label: 'Shift B', category: 'Production Data', aliases: ['shift b', 'shift_b', 'shiftb', 'b shift', 'shift b output (kg)', 'shift b output'] },
  { key: 'shiftC', label: 'Shift C', category: 'Production Data', aliases: ['shift c', 'shift_c', 'shiftc', 'c shift', 'shift c output (kg)', 'shift c output'] },
  { key: 'totalProduction', label: 'Total Production', category: 'Production Data', aliases: ['total production', 'total prod', 'total prod kg', 'production total', 'actual production', 'cumulative yield (kg)', 'cumulative yield'], required: true },
  { key: 'targetBulk', label: 'Target Bulk', category: 'Production Data', aliases: ['target bulk', 'bulk target', 'targetbulk'] },
  { key: 'bulkProd', label: 'Bulk Prod.', category: 'Production Data', aliases: ['bulk prod.', 'bulk prod', 'bulk production', 'bulk actual', 'bulkprod'] },
  { key: 'sampleProd', label: 'Sample Prod.', category: 'Production Data', aliases: ['sample prod.', 'sample prod', 'sample production', 'sample actual', 'sampleprod'] },
  { key: 'runningBulk', label: 'Running Bulk', category: 'Machine Performance', aliases: ['running bulk', 'running mc bulk', 'runningbulk'] },
  { key: 'runningSample', label: 'Running Sample', category: 'Machine Performance', aliases: ['running sample', 'running mc sample', 'runningsample'] },
  { key: 'idleMc', label: 'Idle Mc', category: 'Machine Performance', aliases: ['idle mc', 'idle machines', 'idle machine', 'idlemc'] },
  { key: 'machineUtilization', label: 'Machine Utilization', category: 'Machine Performance', aliases: ['machine utilization', 'machine utilization %', 'mc utilization', 'utilization rate (%)', 'utilization rate', 'utilization'] },
  { key: 'idleMcPct', label: 'Idle Mc %', category: 'Machine Performance', aliases: ['idle mc %', 'idle mc pct', 'idle machine %', 'idle rate (%)', 'idle rate'] },
  { key: 'idleProduction', label: 'Idle Production', category: 'Machine Performance', aliases: ['idle production', 'idle prod', 'idle production lost (kg)', 'idle production lost'] },
  { key: 'efficiency', label: 'Efficiency', category: 'Machine Performance', aliases: ['efficiency', 'efficiency %', 'floor efficiency', 'net efficiency (%)', 'net efficiency'] },
  { key: 'proPerMc', label: 'Pro Per Mc', category: 'Machine Performance', aliases: ['pro per mc', 'prod per mc', 'kg per mc', 'production per active frame (kg)', 'production per active frame', 'propermc'] },
  { key: 'reject', label: 'Reject', category: 'Quality Indices', aliases: ['reject', 'reject (kg)', 'total reject', 'reject scrap (kg)', 'reject scrap'] },
  { key: 'rejectPct', label: 'Reject%', category: 'Quality Indices', aliases: ['reject%', 'reject %', 'reject rate (%)', 'reject pct', 'reject rate'] },
  { key: 'hold', label: 'Hold', category: 'Quality Indices', aliases: ['hold', 'hold (kg)', 'total hold', 'hold scrap (kg)', 'hold scrap'] },
  { key: 'holdPct', label: 'Hold%', category: 'Quality Indices', aliases: ['hold%', 'hold %', 'hold rate (%)', 'hold pct', 'hold rate'] },
  { key: 'jhuteCutpcs', label: 'Jhute/Cutpcs', category: 'Quality Indices', aliases: ['jhute/cutpcs', 'jhute / cutpcs', 'jhute', 'cutpcs', 'jhute cutpcs', 'wastage'] },
  { key: 'jhuteCutpcsPct', label: 'Jhute/Cutpcs%', category: 'Quality Indices', aliases: ['jhute/cutpcs%', 'jhute / cutpcs %', 'jhute%', 'jhute/cutpcs %', 'jhute pct'] },
  { key: 'needleBroken', label: 'Needle Broken', category: 'Consumables', aliases: ['needle broken', 'needles broken', 'needles broken (pcs)', 'needle'] },
  { key: 'needlePerKg', label: 'Needle Broken/KG', category: 'Consumables', aliases: ['needle broken/kg', 'needle broken / kg', 'needle/kg', 'needle per kg'] },
  { key: 'sinkerBroken', label: 'Sinker Broken', category: 'Consumables', aliases: ['sinker broken', 'sinkers broken', 'sinkers broken (pcs)', 'sinker'] },
  { key: 'sinkerPerKg', label: 'Sinker Broken/KG', category: 'Consumables', aliases: ['sinker broken/kg', 'sinker broken / kg', 'sinker/kg', 'sinker per kg'] },
  { key: 'oilConsumption', label: 'Oil Consumption', category: 'Consumables', aliases: ['oil consumption', 'oil consumption (ltr)', 'oil consumption (liters)', 'lubricating oil (liters)', 'oil'] },
  { key: 'beltBroken', label: 'Belt Broken', category: 'Consumables', aliases: ['belt broken', 'belts broken', 'belt'] },
  { key: 'otherSparePartsName', label: 'Other Spare parts Name', category: 'Consumables', aliases: ['other spare parts name', 'other spare parts', 'spare parts name', 'spare parts'] },
  { key: 'otherSparePartsQty', label: 'Other Spare parts QTY', category: 'Consumables', aliases: ['other spare parts qty', 'other spare parts quantity', 'spare parts qty', 'spare parts count'] },
  { key: 'setChangePcs', label: 'Set Change(Pcs)', category: 'Operational', aliases: ['set change(pcs)', 'set change (pcs)', 'set change', 'set changes completed'] },
  { key: 'productionLossForEff', label: 'Production Loss For Eff', category: 'Operational', aliases: ['production loss for eff', 'yield deficit vs plan (kg)', 'loss for eff', 'production loss for efficiency'] },
  { key: 'prodLossForSample', label: 'Production Loss for Sample', category: 'Operational', aliases: ['production loss for sample', 'production loss for sample (kg)', 'prod loss for sample', 'loss for sample'] },
  { key: 'capacityUtilization', label: 'Capacity Utilization', category: 'Operational', aliases: ['capacity utilization', 'capacity utilization %', 'installed capacity ratio (%)', 'capacity ratio'] },
  { key: 'totalOperator', label: 'Total Operator', category: 'Manpower', aliases: ['total operator', 'total operators', 'roster active operators', 'operator count', 'operators'] },
  { key: 'absent', label: 'Absent', category: 'Manpower', aliases: ['absent', 'operators absent', 'absent operators', 'absenteeism'] },
  { key: 'absentPct', label: 'Absent %', category: 'Manpower', aliases: ['absent %', 'absent%', 'absenteeism rate (%)', 'absent pct', 'absent rate'] },
  { key: 'productionFlatKnit', label: 'Production-Flat Knit', category: 'Sub-Contact', aliases: ['production-flat knit', 'production flat knit', 'production flat knit (pcs)', 'flat knit prod', 'flat knit'] },
  { key: 'achievmentCircular', label: 'Achievment-Circular', category: 'Operational', aliases: ['achievment-circular', 'achievment circular', 'achievement (%)', 'achievement circular'] },
  { key: 'otd', label: 'OTD', category: 'Operational', aliases: ['otd', 'on time delivery'] },
  { key: 'yarnIssued', label: 'Yarn Issued', category: 'Sub-Contact', aliases: ['yarn issued', 'yarn issued (kg)', 'yarn issue'] },
  { key: 'totalRunningFactories', label: 'Total Running Factories', category: 'Sub-Contact', aliases: ['total running factories', 'running factories'] },
  { key: 'runningMachine', label: 'Running Machine', category: 'Machine Performance', aliases: ['running machine', 'running machines', 'active machines', 'running mc'] },
  { key: 'numberVehicles', label: 'Number Vehicles', category: 'Operational', aliases: ['number vehicles', 'vehicles', 'number of vehicles'] },
  { key: 'fabricReturn', label: 'Fabric Return', category: 'Sub-Contact', aliases: ['fabric return', 'fabric return (kg)', 'fabric returned'] },
  { key: 'remarks', label: 'Remarks', category: 'General', aliases: ['remarks', 'shift handover remarks', 'comment', 'notes', 'reason'] }
];

interface HeaderMatchResult {
  matchedColumns: { appCol: AppColumnDefinition; sheetHeader: string; sheetIndex: number }[];
  missingColumns: AppColumnDefinition[];
  missingCriticalColumns: AppColumnDefinition[];
  unrecognizedColumns: { header: string; index: number }[];
  isPerfectMatch: boolean;
  canProceed: boolean;
  totalSheetCols: number;
}

interface UploadLedgerExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (records: LedgerRecord[], mode: 'append' | 'replace') => void;
  existingCount: number;
}

export default function UploadLedgerExcelModal({
  isOpen,
  onClose,
  onImportComplete,
  existingCount
}: UploadLedgerExcelModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [parsedRecords, setParsedRecords] = useState<LedgerRecord[] | null>(null);
  const [matchResult, setMatchResult] = useState<HeaderMatchResult | null>(null);
  const [showMismatchDetails, setShowMismatchDetails] = useState<boolean>(false);
  const [activeMismatchTab, setActiveMismatchTab] = useState<'missing' | 'unrecognized' | 'matched'>('missing');
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setFile(null);
    setParsedRecords(null);
    setMatchResult(null);
    setUploadError(null);
    setIsParsing(false);
    setShowMismatchDetails(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to normalize strings for comparisons
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

  // Helper to parse date string or Excel serial number to YYYY-MM-DD
  const parseExcelDate = (val: any): { dateStr: string; year: number; monthName: string } => {
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    let d: Date;

    if (val instanceof Date && !isNaN(val.getTime())) {
      d = val;
    } else if (typeof val === 'number') {
      d = new Date(Math.round((val - 25569) * 86400 * 1000));
    } else if (typeof val === 'string' && val.trim()) {
      const trimmed = val.trim();
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
        const parts = trimmed.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        d = new Date(y, m, day);
      } else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}$/.test(trimmed)) {
        const parts = trimmed.split(/[\/\-\.]/);
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (p0 > 12) {
          d = new Date(p2, p1 - 1, p0);
        } else {
          d = new Date(p2, p0 - 1, p1);
        }
      } else {
        d = new Date(trimmed);
      }
    } else {
      d = new Date();
    }

    if (isNaN(d.getTime())) {
      d = new Date();
    }

    const y = d.getFullYear();
    const m = d.getMonth();
    const day = String(d.getDate()).padStart(2, '0');
    const monthFormatted = String(m + 1).padStart(2, '0');
    const dateStr = `${y}-${monthFormatted}-${day}`;
    const monthName = MONTHS[m] || 'August';

    return { dateStr, year: y, monthName };
  };

  const cleanNum = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const str = String(val).replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Compare uploaded headers with App Headers
  const evaluateHeaders = (sheetHeaders: string[]): HeaderMatchResult => {
    const matchedColumns: { appCol: AppColumnDefinition; sheetHeader: string; sheetIndex: number }[] = [];
    const usedSheetIndices = new Set<number>();
    const missingColumns: AppColumnDefinition[] = [];
    const missingCriticalColumns: AppColumnDefinition[] = [];

    // 1. Pass 1: Find match for each App Column
    for (const appCol of APP_LEDGER_COLUMNS) {
      let foundIndex = -1;
      const appLabelNorm = normalize(appCol.label);
      const appKeyNorm = normalize(String(appCol.key));

      // Check exact label match first
      for (let i = 0; i < sheetHeaders.length; i++) {
        if (usedSheetIndices.has(i)) continue;
        const shNorm = normalize(sheetHeaders[i]);
        if (shNorm === appLabelNorm || shNorm === appKeyNorm) {
          foundIndex = i;
          break;
        }
      }

      // Check aliases if not found
      if (foundIndex === -1) {
        for (let i = 0; i < sheetHeaders.length; i++) {
          if (usedSheetIndices.has(i)) continue;
          const shNorm = normalize(sheetHeaders[i]);
          if (appCol.aliases.some(alias => normalize(alias) === shNorm)) {
            foundIndex = i;
            break;
          }
        }
      }

      // Substring check if still not found
      if (foundIndex === -1) {
        for (let i = 0; i < sheetHeaders.length; i++) {
          if (usedSheetIndices.has(i)) continue;
          const shNorm = normalize(sheetHeaders[i]);
          if (shNorm && (shNorm.includes(appLabelNorm) || appLabelNorm.includes(shNorm))) {
            foundIndex = i;
            break;
          }
        }
      }

      if (foundIndex !== -1) {
        matchedColumns.push({
          appCol,
          sheetHeader: sheetHeaders[foundIndex],
          sheetIndex: foundIndex
        });
        usedSheetIndices.add(foundIndex);
      } else {
        missingColumns.push(appCol);
        if (appCol.required) {
          missingCriticalColumns.push(appCol);
        }
      }
    }

    // 2. Unrecognized sheet columns
    const unrecognizedColumns: { header: string; index: number }[] = [];
    for (let i = 0; i < sheetHeaders.length; i++) {
      if (!usedSheetIndices.has(i) && sheetHeaders[i] && sheetHeaders[i].trim() !== '') {
        unrecognizedColumns.push({ header: sheetHeaders[i], index: i });
      }
    }

    const isPerfectMatch = missingColumns.length === 0 && unrecognizedColumns.length === 0;
    const canProceed = missingCriticalColumns.length === 0;

    return {
      matchedColumns,
      missingColumns,
      missingCriticalColumns,
      unrecognizedColumns,
      isPerfectMatch,
      canProceed,
      totalSheetCols: sheetHeaders.length
    };
  };

  const processFile = (uploadedFile: File) => {
    setFile(uploadedFile);
    setUploadError(null);
    setIsParsing(true);
    setParsedRecords(null);
    setMatchResult(null);

    const nameLower = uploadedFile.name.toLowerCase();
    if (!nameLower.endsWith('.xlsx') && !nameLower.endsWith('.xls') && !nameLower.endsWith('.csv')) {
      setUploadError('Invalid file format. Please upload a valid Excel file (.xlsx or .xls) or CSV.');
      setIsParsing(false);
      return;
    }

    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            setUploadError('No worksheets found in this Excel file.');
            setIsParsing(false);
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const rawMatrix = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });

          if (!rawMatrix || rawMatrix.length === 0) {
            setUploadError('The uploaded sheet contains no readable rows.');
            setIsParsing(false);
            return;
          }

          // Search top 15 rows for header row
          let headerRowIndex = 0;
          let maxMatches = 0;
          const headerKeywords = ['floor', 'unit', 'target', 'date', 'shift', 'prod', 'machine', 'efficiency', 'reject', 'loss'];

          for (let r = 0; r < Math.min(15, rawMatrix.length); r++) {
            const rowArr = rawMatrix[r];
            if (!Array.isArray(rowArr)) continue;
            let matches = 0;
            for (const cell of rowArr) {
              const str = String(cell || '').toLowerCase();
              if (headerKeywords.some(kw => str.includes(kw))) {
                matches++;
              }
            }
            if (matches > maxMatches) {
              maxMatches = matches;
              headerRowIndex = r;
            }
          }

          const headerRow = rawMatrix[headerRowIndex] || [];
          const sheetHeaders = headerRow.map((cell: any) => String(cell || '').trim());

          // Evaluate headers against app columns
          const evaluation = evaluateHeaders(sheetHeaders);
          setMatchResult(evaluation);

          if (!evaluation.canProceed) {
            const missingNames = evaluation.missingCriticalColumns.map(c => c.label).join(', ');
            setUploadError(`Missing Critical Required Column(s): ${missingNames}. The sheet cannot be imported without these essential columns.`);
            setIsParsing(false);
            return;
          }

          // Build column lookup index from evaluation
          const colIndexMap: Record<string, number> = {};
          evaluation.matchedColumns.forEach(m => {
            colIndexMap[m.appCol.key] = m.sheetIndex;
          });

          const getVal = (row: any[], key: string) => {
            const idx = colIndexMap[key];
            return idx !== undefined && idx >= 0 ? row[idx] : undefined;
          };

          const records: LedgerRecord[] = [];

          for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
            const row = rawMatrix[r];
            if (!Array.isArray(row) || row.length === 0) continue;

            const hasData = row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '');
            if (!hasData) continue;

            const rawFloor = String(getVal(row, 'floor') || '').trim();
            const rawDate = getVal(row, 'date');

            if (!rawFloor && !rawDate) continue;

            const { dateStr, year, monthName } = parseExcelDate(rawDate);
            const targetFloor = rawFloor || 'EKL';

            const shiftA = cleanNum(getVal(row, 'shiftA'));
            const shiftB = cleanNum(getVal(row, 'shiftB'));
            const shiftC = cleanNum(getVal(row, 'shiftC'));
            let totalProduction = cleanNum(getVal(row, 'totalProduction'));
            if (totalProduction === 0 && (shiftA > 0 || shiftB > 0 || shiftC > 0)) {
              totalProduction = shiftA + shiftB + shiftC;
            }

            const target = cleanNum(getVal(row, 'target')) || 25000;
            const bulkProd = cleanNum(getVal(row, 'bulkProd')) || (totalProduction > 0 ? totalProduction : 0);
            const sampleProd = cleanNum(getVal(row, 'sampleProd'));
            const targetBulk = cleanNum(getVal(row, 'targetBulk')) || target;
            const totalMachines = cleanNum(getVal(row, 'runningMachine')) || 100;
            const runningBulk = cleanNum(getVal(row, 'runningBulk')) || 85;
            const runningSample = cleanNum(getVal(row, 'runningSample')) || 0;
            const idleMc = cleanNum(getVal(row, 'idleMc')) || Math.max(0, totalMachines - (runningBulk + runningSample));

            const isSubContact = targetFloor.toLowerCase().includes('sub-contact') || String(getVal(row, 'unit') || '').toLowerCase().includes('sub-contact');

            const record: LedgerRecord = {
              id: `imported-${dateStr}-${targetFloor.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substring(2, 7)}`,
              unit: isSubContact ? 'Sub-Contact' : 'In-House',
              year: cleanNum(getVal(row, 'year')) || year,
              month: String(getVal(row, 'month') || monthName).trim() || monthName,
              date: dateStr,
              floor: targetFloor,
              target: target,
              shiftA: shiftA,
              shiftB: shiftB,
              shiftC: shiftC,
              totalProduction: totalProduction,
              targetBulk: targetBulk,
              bulkProd: bulkProd,
              sampleProd: sampleProd,
              totalMachines: totalMachines,
              runningBulk: runningBulk,
              runningSample: runningSample,
              idleMc: idleMc,
              machineUtilization: cleanNum(getVal(row, 'machineUtilization')) || (totalMachines > 0 ? parseFloat((((runningBulk + runningSample) / totalMachines) * 100).toFixed(1)) : 0),
              idleMcPct: cleanNum(getVal(row, 'idleMcPct')) || (totalMachines > 0 ? parseFloat(((idleMc / totalMachines) * 100).toFixed(1)) : 0),
              prodLossForSample: cleanNum(getVal(row, 'prodLossForSample')),
              idleProduction: cleanNum(getVal(row, 'idleProduction')),
              efficiency: cleanNum(getVal(row, 'efficiency')) || (target > 0 ? parseFloat(((totalProduction / target) * 100).toFixed(1)) : 0),
              proPerMc: cleanNum(getVal(row, 'proPerMc')) || ((runningBulk + runningSample) > 0 ? Math.round(totalProduction / (runningBulk + runningSample)) : 0),
              reject: cleanNum(getVal(row, 'reject')),
              rejectPct: cleanNum(getVal(row, 'rejectPct')),
              hold: cleanNum(getVal(row, 'hold')),
              holdPct: cleanNum(getVal(row, 'holdPct')),
              jhuteCutpcs: cleanNum(getVal(row, 'jhuteCutpcs')),
              jhuteCutpcsPct: cleanNum(getVal(row, 'jhuteCutpcsPct')),
              needleBroken: cleanNum(getVal(row, 'needleBroken')),
              needlePerKg: cleanNum(getVal(row, 'needlePerKg')),
              sinkerBroken: cleanNum(getVal(row, 'sinkerBroken')),
              sinkerPerKg: cleanNum(getVal(row, 'sinkerPerKg')),
              oilConsumption: cleanNum(getVal(row, 'oilConsumption')),
              beltBroken: cleanNum(getVal(row, 'beltBroken')),
              otherSparePartsName: String(getVal(row, 'otherSparePartsName') || '').trim(),
              otherSparePartsQty: cleanNum(getVal(row, 'otherSparePartsQty')),
              setChange: cleanNum(getVal(row, 'setChangePcs')),
              productionLossForEff: cleanNum(getVal(row, 'productionLossForEff')),
              capacityUtilization: cleanNum(getVal(row, 'capacityUtilization')),
              totalOperator: cleanNum(getVal(row, 'totalOperator')),
              absent: cleanNum(getVal(row, 'absent')),
              absentPct: cleanNum(getVal(row, 'absentPct')),
              productionFlatKnit: cleanNum(getVal(row, 'productionFlatKnit')),
              achievmentCircular: cleanNum(getVal(row, 'achievmentCircular')),
              otd: String(getVal(row, 'otd') || '').trim(),
              yarnIssued: cleanNum(getVal(row, 'yarnIssued')),
              runningFactories: cleanNum(getVal(row, 'totalRunningFactories')),
              runningMachine: cleanNum(getVal(row, 'runningMachine')),
              numberVehicles: cleanNum(getVal(row, 'numberVehicles')),
              fabricReturn: cleanNum(getVal(row, 'fabricReturn')),
              remarks: String(getVal(row, 'remarks') || '').trim(),
            };

            records.push(record);
          }

          if (records.length === 0) {
            setUploadError('No valid production records could be extracted from this file. Please verify column values.');
            setIsParsing(false);
            return;
          }

          setParsedRecords(records);
          setIsParsing(false);
        } catch (err: any) {
          console.error('Error parsing Excel sheet:', err);
          setUploadError(`Failed to parse file: ${err.message || 'Unknown format error'}`);
          setIsParsing(false);
        }
      };

      reader.onerror = () => {
        setUploadError('Failed to read file from disk.');
        setIsParsing(false);
      };

      reader.readAsArrayBuffer(uploadedFile);
    }, 150);
  };

  // Download exact 51 column App Headers standard template
  const handleDownloadTemplate = () => {
    const templateHeaders = [APP_LEDGER_COLUMNS.map(c => c.label)];

    const sampleRow = [
      'In-House', 2026, 'August', '2026-08-11', 'EKL', 25000,
      8200, 7800, 7600, 23600, 25000,
      23600, 0, 88, 0,
      12, 88.0, 12.0, 1400,
      94.4, 268, 180, 0.76,
      50, 0.21, 120, 0.51,
      4, 0.017, 2, 0.008,
      15, 0, 'Needle cylinder bolt', 2,
      6, 1400, 0, 92.5,
      85, 4, 4.7, 0,
      94.4, '100%', 0, 0,
      88, 0, 0, 'Standard morning operations'
    ];

    const ws = XLSX.utils.aoa_to_sheet([...templateHeaders, sampleRow]);
    
    // Set auto column widths
    ws['!cols'] = APP_LEDGER_COLUMNS.map(c => ({ wch: Math.max(c.label.length + 3, 12) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Production_Ledger_Template');
    XLSX.writeFile(wb, 'Production_Ledger_Standard_Template.xlsx');
  };

  const handleCommit = () => {
    if (!parsedRecords || parsedRecords.length === 0) return;
    onImportComplete(parsedRecords, importMode);
    handleReset();
    onClose();
  };

  const totalKg = parsedRecords?.reduce((sum, r) => sum + (r.totalProduction || 0), 0) || 0;
  const uniqueFloors = parsedRecords ? Array.from(new Set(parsedRecords.map(r => r.floor))) : [];
  const uniqueDates = parsedRecords ? Array.from(new Set(parsedRecords.map(r => r.date))) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Upload Excel Production Ledger
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Import bulk production records matching the 51 App Headers
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              handleReset();
              onClose();
            }}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          
          {/* Download Standard Template Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-semibold">
              <Info className="h-4 w-4 text-[#0F4C81] dark:text-sky-400 shrink-0" />
              <span>Standardize with the exact 51 App Headers template:</span>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-[#0F4C81] dark:text-sky-300 bg-white dark:bg-slate-700 border border-[#0F4C81]/30 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-600 transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download 51-Col Template</span>
            </button>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 bg-slate-50/40 dark:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  processFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Click to browse or drag & drop Excel file
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Supports Excel (.xlsx, .xls) and CSV files
              </span>
            </div>
          </div>

          {/* Loading Indicator */}
          {isParsing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <div className="h-4 w-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
              <span>Matching spreadsheet columns with App Headers...</span>
            </div>
          )}

          {/* Error Callout */}
          {uploadError && (
            <div className="flex items-start gap-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-3.5 text-xs font-semibold text-red-700 dark:text-red-300">
              <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <div>
                <p className="font-bold">Column Validation Error</p>
                <p className="mt-0.5 text-[11px]">{uploadError}</p>
              </div>
            </div>
          )}

          {/* Column Match Validation & Mismatch Warning Section */}
          {matchResult && file && !isParsing && (
            <div className="space-y-3">
              
              {/* Header Match Status Badge Banner */}
              {matchResult.isPerfectMatch ? (
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-bold">
                      Perfect Column Match: All 51 App Headers matched successfully!
                    </span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                    51 / 51 Matched
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                          Column Mismatch Warning
                        </p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                          {matchResult.missingColumns.length > 0 && (
                            <span><strong>{matchResult.missingColumns.length}</strong> App Header(s) missing from file. </span>
                          )}
                          {matchResult.unrecognizedColumns.length > 0 && (
                            <span><strong>{matchResult.unrecognizedColumns.length}</strong> Unrecognized column(s) in sheet. </span>
                          )}
                          <span>({matchResult.matchedColumns.length} / 51 Columns successfully matched)</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowMismatchDetails(!showMismatchDetails)}
                      className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 dark:text-amber-200 hover:underline cursor-pointer"
                    >
                      <span>{showMismatchDetails ? 'Hide Details' : 'View Mismatch Columns'}</span>
                      {showMismatchDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Detailed Mismatch Column Inspector */}
                  {showMismatchDetails && (
                    <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/60 space-y-2.5">
                      {/* Sub-tabs */}
                      <div className="flex items-center gap-1.5 border-b border-amber-200 dark:border-amber-800/60 pb-1.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setActiveMismatchTab('missing')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            activeMismatchTab === 'missing'
                              ? 'bg-red-100 dark:bg-red-900/60 text-red-900 dark:text-red-200'
                              : 'text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                          }`}
                        >
                          Missing App Headers ({matchResult.missingColumns.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMismatchTab('unrecognized')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            activeMismatchTab === 'unrecognized'
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white'
                              : 'text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                          }`}
                        >
                          Unrecognized Headers ({matchResult.unrecognizedColumns.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMismatchTab('matched')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                            activeMismatchTab === 'matched'
                              ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                              : 'text-amber-800 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30'
                          }`}
                        >
                          Matched Headers ({matchResult.matchedColumns.length})
                        </button>
                      </div>

                      {/* Content of selected mismatch subtab */}
                      <div className="max-h-40 overflow-y-auto p-2 rounded-lg bg-white/80 dark:bg-slate-900/80 border border-amber-200 dark:border-amber-800/40 text-[11px]">
                        {activeMismatchTab === 'missing' && (
                          <div className="space-y-1.5">
                            {matchResult.missingColumns.length === 0 ? (
                              <p className="text-emerald-600 dark:text-emerald-400 font-semibold py-1">No missing columns! All 51 App Headers found.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {matchResult.missingColumns.map((col, idx) => (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                      col.required
                                        ? 'bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
                                        : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                    }`}
                                    title={col.required ? 'Critical required column' : 'Optional column (will default to 0 / empty)'}
                                  >
                                    <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                                    <span>{col.label}</span>
                                    {col.required && <span className="text-[9px] uppercase font-black text-red-600">(Required)</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {activeMismatchTab === 'unrecognized' && (
                          <div className="space-y-1.5">
                            {matchResult.unrecognizedColumns.length === 0 ? (
                              <p className="text-emerald-600 dark:text-emerald-400 font-semibold py-1">No extra or unrecognized columns in file.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {matchResult.unrecognizedColumns.map((col, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                  >
                                    <HelpCircle className="h-3 w-3 text-slate-400 shrink-0" />
                                    <span>Col {col.index + 1}: "{col.header}"</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {activeMismatchTab === 'matched' && (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {matchResult.matchedColumns.map((col, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                >
                                  <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                                  <span>{col.appCol.label}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

          {/* Parsed Results Overview */}
          {parsedRecords && file && !isParsing && (
            <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900 dark:text-white">
                  <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="truncate max-w-[280px]">{file.name}</span>
                </div>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                  {parsedRecords.length} Records Extracted
                </span>
              </div>

              {/* Data Summary Grid */}
              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Total Volume</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{totalKg.toLocaleString()} Kg</span>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Units/Floors</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{uniqueFloors.length} Floors</span>
                </div>
                <div className="p-2 rounded-lg bg-white/70 dark:bg-slate-800/60 border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 block">Dates Covered</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{uniqueDates.length} Dates</span>
                </div>
              </div>

              {/* Import Mode Radio selection */}
              <div className="space-y-1.5 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <label className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300">
                  Import Action:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('append')}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      importMode === 'append'
                        ? 'bg-white dark:bg-slate-800 border-emerald-500 shadow-2xs text-slate-900 dark:text-white'
                        : 'bg-emerald-100/30 dark:bg-emerald-950/20 border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <div className={`h-3 w-3 rounded-full border-2 ${importMode === 'append' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-400'}`} />
                      <span>Append & Merge</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Add to current {existingCount} records. Overwrites only matching date & floor logs.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-white dark:bg-slate-800 border-red-500 shadow-2xs text-slate-900 dark:text-white'
                        : 'bg-emerald-100/30 dark:bg-emerald-950/20 border-transparent text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs text-red-600 dark:text-red-400">
                      <div className={`h-3 w-3 rounded-full border-2 ${importMode === 'replace' ? 'border-red-600 bg-red-600' : 'border-slate-400'}`} />
                      <span>Replace Entire Ledger</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Clear existing ledger records and replace completely with this sheet.
                    </p>
                  </button>
                </div>
              </div>

              {/* Sample Table Preview */}
              <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/60">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mb-1">
                  Sample Preview (First 3 Extracted Rows):
                </span>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[10px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-1.5">Date</th>
                        <th className="p-1.5">Floor</th>
                        <th className="p-1.5">Target</th>
                        <th className="p-1.5">Shift A</th>
                        <th className="p-1.5">Shift B</th>
                        <th className="p-1.5">Shift C</th>
                        <th className="p-1.5">Total Prod</th>
                        <th className="p-1.5">Eff %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {parsedRecords.slice(0, 3).map((r, i) => (
                        <tr key={i}>
                          <td className="p-1.5 font-mono">{r.date}</td>
                          <td className="p-1.5 font-bold">{r.floor}</td>
                          <td className="p-1.5 font-mono">{r.target?.toLocaleString()}</td>
                          <td className="p-1.5 font-mono">{r.shiftA?.toLocaleString()}</td>
                          <td className="p-1.5 font-mono">{r.shiftB?.toLocaleString()}</td>
                          <td className="p-1.5 font-mono">{r.shiftC?.toLocaleString()}</td>
                          <td className="p-1.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">{r.totalProduction?.toLocaleString()}</td>
                          <td className="p-1.5 font-mono">{r.efficiency}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!parsedRecords || parsedRecords.length === 0 || isParsing || (matchResult && !matchResult.canProceed)}
              onClick={handleCommit}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {importMode === 'replace' ? 'Confirm & Replace Ledger' : 'Confirm & Merge Data'}
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
