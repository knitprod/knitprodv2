/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { UserRecord } from './UserManagementView';
import { 
  ClipboardList, 
  Target, 
  Layers, 
  CalendarCheck, 
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
  AlertCircle
} from 'lucide-react';

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
    knitEndRemarks: ''
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
    knitEndRemarks: ''
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
    knitEndRemarks: ''
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
    knitEndRemarks: ''
  }
];

interface PlanOrderFollowupViewProps {
  initialSubTab?: 'summary' | 'buyer' | 'yarn' | 'delivery';
  currentUser?: UserRecord | null;
}

export default function PlanOrderFollowupView({ initialSubTab = 'summary', currentUser }: PlanOrderFollowupViewProps) {
  const isAdmin = currentUser?.userType === 'Admin';

  const [orders, setOrders] = useState<OrderPlan[]>(INITIAL_ORDERS);
  const [activeSubTab, setActiveSubTab] = useState<'summary' | 'buyer' | 'yarn' | 'delivery'>(initialSubTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [buyerFilter, setBuyerFilter] = useState('All');
  const [planMonthFilter, setPlanMonthFilter] = useState('All');
  const [otdFilter, setOtdFilter] = useState('All');
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

  // Subscribe to real-time order plans from Firestore & fallback to GAS if empty
  useEffect(() => {
    const unsubscribe = FirestoreSyncService.subscribeToOrderPlans((remoteOrders) => {
      if (remoteOrders && remoteOrders.length > 0) {
        const mapped = remoteOrders.map((r, idx) => ({
          id: r.id || `ord-${idx}`,
          planMonth: r.planMonth || (r as any).month || 'July',
          planType: r.planType || 'Confirm',
          ewo: r.ewo || (r as any).orderNo || `270${100 + idx}`,
          buyer: r.buyer || 'Vogue Sourcin',
          color: r.color || (r as any).styleNo || 'Default Color',
          knitStart: r.knitStart || (r as any).startDate || '01-Jul-26',
          knitEnd: r.knitEnd || (r as any).deliveryDate || '15-Jul-26',
          target: typeof r.target === 'number' ? r.target : (parseFloat((r as any).plannedKg) || 1000),
          targetNextMonth: r.targetNextMonth || 0,
          allocationStart: r.allocationStart || '',
          allocationEnd: r.allocationEnd || '',
          allocatedQty: typeof r.allocatedQty === 'number' ? r.allocatedQty : (parseFloat((r as any).plannedKg) || 1000),
          allocatedBal: r.allocatedBal || 0,
          greyReq: typeof r.greyReq === 'number' ? r.greyReq : (parseFloat((r as any).plannedKg) || 1000),
          knitPro: typeof r.knitPro === 'number' ? r.knitPro : (parseFloat((r as any).producedKg) || 0),
          knitBal: typeof r.knitBal === 'number' ? r.knitBal : Math.max(0, (parseFloat((r as any).plannedKg) || 1000) - (parseFloat((r as any).producedKg) || 0)),
          aKnitStart: r.aKnitStart || '',
          lastProductionDate: r.lastProductionDate || '',
          avgProdDay: r.avgProdDay || 0,
          expectedKnitEnd: r.expectedKnitEnd || '',
          knitStartOtd: (r.knitStartOtd as any) || ((r as any).status === 'Completed' ? 'Passed' : (r as any).status === 'Delayed' ? 'Failed' : 'Pending'),
          knitEndOtd: (r.knitEndOtd as any) || ((r as any).status === 'Completed' ? 'Passed' : (r as any).status === 'Delayed' ? 'Failed' : 'Pending'),
          knitStartRemarks: r.knitStartRemarks || '',
          knitEndRemarks: r.knitEndRemarks || ''
        }));
        setOrders(mapped);
      } else {
        // Seed initial orders to Firestore & Google Sheets if empty
        INITIAL_ORDERS.forEach(order => {
          FirestoreSyncService.saveOrderPlan(order).catch(() => {});
        });
      }
    });

    // Also attempt fallback fetch from Google Sheets if Firestore has not populated yet
    GasClient.fetchOrderPlans().then(sheetsOrders => {
      if (sheetsOrders && sheetsOrders.length > 0) {
        sheetsOrders.forEach(o => {
          FirestoreSyncService.saveOrderPlan(o).catch(() => {});
        });
      }
    }).catch(err => {
      console.warn("Could not load order plans from server/GAS:", err);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        ord.ewo.toLowerCase().includes(q) ||
        ord.buyer.toLowerCase().includes(q) ||
        ord.color.toLowerCase().includes(q) ||
        ord.planMonth.toLowerCase().includes(q) ||
        ord.planType.toLowerCase().includes(q);
      
      const matchesBuyer = buyerFilter === 'All' || ord.buyer === buyerFilter;
      const matchesMonth = planMonthFilter === 'All' || ord.planMonth === planMonthFilter;
      
      const matchesOtd = 
        otdFilter === 'All' ||
        (otdFilter === 'BothPassed' && ord.knitStartOtd === 'Passed' && ord.knitEndOtd === 'Passed') ||
        (otdFilter === 'Passed' && (ord.knitStartOtd === 'Passed' || ord.knitEndOtd === 'Passed')) ||
        (otdFilter === 'Failed' && (ord.knitStartOtd === 'Failed' || ord.knitEndOtd === 'Failed')) ||
        (otdFilter === 'Pending' && (ord.knitStartOtd === 'Pending' || ord.knitEndOtd === 'Pending'));

      return matchesSearch && matchesBuyer && matchesMonth && matchesOtd;
    });
  }, [orders, searchQuery, buyerFilter, planMonthFilter, otdFilter]);

  // Unique lists for filters
  const buyersList = useMemo(() => {
    const set = new Set(orders.map(o => o.buyer));
    return Array.from(set);
  }, [orders]);

  const monthsList = useMemo(() => {
    const set = new Set(orders.map(o => o.planMonth));
    return Array.from(set);
  }, [orders]);

  // KPIs
  const totalTarget = orders.reduce((sum, o) => sum + (o.target || 0), 0);
  const totalGreyReq = orders.reduce((sum, o) => sum + (o.greyReq || 0), 0);
  const totalKnitPro = orders.reduce((sum, o) => sum + (o.knitPro || 0), 0);
  const totalKnitBal = orders.reduce((sum, o) => sum + (o.knitBal || 0), 0);
  const otdPassedCount = orders.filter(o => o.knitEndOtd === 'Passed').length;
  const otdTotalCount = orders.filter(o => o.knitEndOtd !== 'Pending').length;
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
      knitEndRemarks: ''
    };

    const updated = [newEntry, ...orders];
    setOrders(updated);
    FirestoreSyncService.saveOrderPlan(newEntry).catch(err => console.warn('Order plan save warning:', err));
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
    setShowEditModal(true);
  };

  const handleSaveEditOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;

    const updatedOrder: OrderPlan = {
      ...editingOrder,
      knitStartRemarks: editKnitStartRemarks.trim(),
      knitEndRemarks: editKnitEndRemarks.trim(),
    };

    const updatedList = orders.map(o => o.id === editingOrder.id ? updatedOrder : o);
    setOrders(updatedList);
    FirestoreSyncService.saveOrderPlan(updatedOrder).catch(err => console.warn('Order plan edit save warning:', err));
    setShowEditModal(false);
    setEditingOrder(null);
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this Order Plan record?')) {
      const updated = orders.filter(o => o.id !== id);
      setOrders(updated);
      try {
        await FirestoreSyncService.deleteOrderPlan(id);
      } catch (err) {
        console.warn("Error deleting order plan:", err);
      }
    }
  };

  // Export to CSV
  const exportToCsv = () => {
    const headers = [
      "Plan Month","Plan Type","EWO","Buyer","Color","Knit Start","Knit End",
      "Target","Target Next Month","Allocation Start","Allocation End","Allocated QTY",
      "Allocated Bal.","GREY REQ.","KNIT PRO.","KNIT BAL.","A.Knit Start",
      "Knit Start VS A. Knit Start","A. Knit End/Last Production Date","Knit End VS A. Knit End",
      "Avg Prod/Day","Expected Knit End","Knit Start OTD",
      "Knit End OTD","Knit Start Remarks","Knit End Remarks"
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
        o.knitEndOtd, o.knitStartRemarks, o.knitEndRemarks
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Order_Plan_Status_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
            onClick={exportToCsv}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3.5 py-2 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Order Plan</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Target</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-slate-900 dark:text-white">{totalTarget.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grey Requirement</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-blue-600 dark:text-blue-400">{totalGreyReq.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Knit Produced</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{totalKnitPro.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Knit Balance</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-amber-600 dark:text-amber-400">{totalKnitBal.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-400">Kg</span>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OTD Pass Rate</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">{otdRate}%</span>
            <span className="text-[10px] font-bold text-slate-400">On-Time</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveSubTab('summary')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'summary'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>Order Plan & Status (Spreadsheet)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('buyer')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'buyer'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Buyer Summary</span>
        </button>

        <button
          onClick={() => setActiveSubTab('yarn')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'yarn'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Yarn Allocation</span>
        </button>

        <button
          onClick={() => setActiveSubTab('delivery')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'delivery'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CalendarCheck className="h-4 w-4" />
          <span>OTD Delivery Timeline</span>
        </button>
      </div>

      {/* SUB-TAB 1: ORDER PLAN & STATUS SPREADSHEET VIEW */}
      {activeSubTab === 'summary' && (
        <div className="space-y-3">
          {/* Controls toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search EWO, Buyer, Color or Month..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-9 pr-4 text-xs font-medium text-slate-900 dark:text-white focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={planMonthFilter}
                onChange={(e) => setPlanMonthFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="All">All Months</option>
                {monthsList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              <select
                value={buyerFilter}
                onChange={(e) => setBuyerFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="All">All Buyers</option>
                {buyersList.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              <select
                value={otdFilter}
                onChange={(e) => setOtdFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300"
              >
                <option value="All">All OTD Status</option>
                <option value="BothPassed">Both Passed (Passed Orders Only)</option>
                <option value="Passed">Any Passed</option>
                <option value="Failed">Failed Orders</option>
                <option value="Pending">Pending Orders</option>
              </select>

              <button
                type="button"
                onClick={() => setOtdFilter(otdFilter === 'Failed' ? 'All' : 'Failed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  otdFilter === 'Failed'
                    ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                    : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Failed Orders</span>
              </button>

              <button
                type="button"
                onClick={() => setOtdFilter(otdFilter === 'BothPassed' ? 'All' : 'BothPassed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  otdFilter === 'BothPassed'
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Passed Orders</span>
              </button>
            </div>
          </div>

          {/* MODERN WEB APPLICATION DASHBOARD TABLE DESIGN */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse min-w-[2500px]">
                <thead>
                  <tr className="bg-slate-50/90 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200/80 dark:border-slate-800">
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Plan Month</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Plan Type</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-center">EWO</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Buyer</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Color</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Knit Start</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Knit End</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">Target (Kg)</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">Target Next Month</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Allocation Start</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Allocation End</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">Allocated QTY</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">Allocated Bal.</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">GREY REQ.</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">KNIT PRO.</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">KNIT BAL.</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">A.Knit Start</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-center bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300">
                      <div className="flex flex-col items-center">
                        <span>Knit Start VS A. Knit Start</span>
                        <span className="text-[9px] font-normal normal-case text-blue-500 dark:text-blue-400">(Knit Start - A. Knit Start)</span>
                      </div>
                    </th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">A. Knit End/Last Production Date</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-center bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-300">
                      <div className="flex flex-col items-center">
                        <span>Knit End VS A. Knit End</span>
                        <span className="text-[9px] font-normal normal-case text-indigo-500 dark:text-indigo-400">(Knit End - A. Knit End)</span>
                      </div>
                    </th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-right">Avg Prod/Day</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Expected Knit End</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-x border-slate-200/60 dark:border-slate-700/60 font-bold">Knit Start OTD</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-center bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-x border-slate-200/60 dark:border-slate-700/60 font-bold">Knit End OTD</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Knit Start Remarks</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap">Knit End Remarks</th>
                    <th className="px-3.5 py-3.5 whitespace-nowrap text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200 font-medium">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={27} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No order plans match the selected filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map(ord => {
                      const startVar = calculateDateVariance(ord.knitStart, ord.aKnitStart);
                      const endVar = calculateDateVariance(ord.knitEnd, ord.lastProductionDate);

                      return (
                        <tr key={ord.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px] inline-block">
                              {ord.planMonth}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                              ord.planType === 'Confirm' 
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50' 
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50'
                            }`}>
                              {ord.planType}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center">
                            <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60 inline-block shadow-2xs">
                              {ord.ewo}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap font-semibold text-slate-900 dark:text-white">
                            {ord.buyer}
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                            <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-900/50 px-2.5 py-1 rounded-lg text-xs inline-block">
                              {ord.color}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-300 font-semibold">{ord.knitStart}</td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-300 font-semibold">{ord.knitEnd}</td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-extrabold text-slate-900 dark:text-white">
                            {ord.target.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right text-slate-500">{ord.targetNextMonth}</td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-400">{ord.allocationStart || '-'}</td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-400">{ord.allocationEnd || '-'}</td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-semibold text-slate-700 dark:text-slate-300">
                            {ord.allocatedQty ? ord.allocatedQty.toLocaleString() : '-'}
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right text-slate-500">{ord.allocatedBal}</td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-extrabold text-slate-900 dark:text-slate-100">
                            {ord.greyReq ? ord.greyReq.toLocaleString() : '-'}
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right">
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-900/50 px-2.5 py-1 rounded-lg inline-block">
                              {ord.knitPro ? ord.knitPro.toLocaleString() : '0'}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right">
                            <span className="font-extrabold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-100 dark:border-amber-900/50 px-2.5 py-1 rounded-lg inline-block">
                              {ord.knitBal ? ord.knitBal.toLocaleString() : '-'}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                            {ord.aKnitStart || '-'}
                          </td>
                          
                          {/* Knit Start VS A. Knit Start Column */}
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center bg-blue-50/20 dark:bg-blue-950/10">
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

                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-700 dark:text-slate-300 font-medium">
                            {ord.lastProductionDate || '-'}
                          </td>

                          {/* Knit End VS A. Knit End Column */}
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center bg-indigo-50/20 dark:bg-indigo-950/10">
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

                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-right font-semibold text-slate-700 dark:text-slate-300">
                            {ord.avgProdDay || '-'}
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-slate-600 dark:text-slate-400">
                            {ord.expectedKnitEnd || '-'}
                          </td>

                          {/* KNIT START OTD COLUMN - FULL GREEN / RED CELL COLOR */}
                          <td className={`px-3.5 py-3 border-b whitespace-nowrap text-center transition-colors ${
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

                          {/* KNIT END OTD COLUMN - FULL GREEN / RED CELL COLOR */}
                          <td className={`px-3.5 py-3 border-b whitespace-nowrap text-center transition-colors ${
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

                          {/* KNIT START REMARKS */}
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                            {ord.knitStartRemarks ? (
                              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-block max-w-[220px] truncate ${
                                ord.knitStartOtd === 'Failed'
                                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800/60'
                                  : ord.knitStartOtd === 'Passed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`} title={ord.knitStartRemarks}>
                                {ord.knitStartRemarks}
                              </span>
                            ) : ord.knitStartOtd === 'Failed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-800/60">
                                ⚠️ Remarks Needed
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>

                          {/* KNIT END REMARKS */}
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap">
                            {ord.knitEndRemarks ? (
                              <span className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-block max-w-[220px] truncate ${
                                ord.knitEndOtd === 'Failed'
                                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800/60'
                                  : ord.knitEndOtd === 'Passed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                                  : 'text-slate-700 dark:text-slate-300'
                              }`} title={ord.knitEndRemarks}>
                                {ord.knitEndRemarks}
                              </span>
                            ) : ord.knitEndOtd === 'Failed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-md border border-rose-300 dark:border-rose-800/60">
                                ⚠️ Remarks Needed
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">-</span>
                            )}
                          </td>
                          <td className="px-3.5 py-3 border-b border-slate-100 dark:border-slate-800/60 whitespace-nowrap text-center">
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
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: BUYER SUMMARY */}
      {activeSubTab === 'buyer' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {buyersList.map(b => {
            const buyerOrders = orders.filter(o => o.buyer === b);
            const targetTotal = buyerOrders.reduce((sum, o) => sum + (o.target || 0), 0);
            const knitProTotal = buyerOrders.reduce((sum, o) => sum + (o.knitPro || 0), 0);
            const pct = targetTotal > 0 ? Math.min(100, Math.round((knitProTotal / targetTotal) * 100)) : 0;

            return (
              <div key={b} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">{b}</h3>
                    <span className="text-xs text-slate-400 font-semibold">{buyerOrders.length} Order Rows</span>
                  </div>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-400">{pct}%</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-500">
                    <span>Knitted: {knitProTotal.toLocaleString()} Kg</span>
                    <span>Target: {targetTotal.toLocaleString()} Kg</span>
                  </div>
                  <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Balance: Math.max(0, targetTotal - knitProTotal).toLocaleString() Kg</span>
                  <span className="text-blue-600 font-bold cursor-pointer hover:underline" onClick={() => {
                    setBuyerFilter(b);
                    setActiveSubTab('summary');
                  }}>View Spreadsheet Row →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SUB-TAB 3: YARN ALLOCATION */}
      {activeSubTab === 'yarn' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Yarn Allocation & Requirement Matrix</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 font-black uppercase text-slate-400 text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">EWO</th>
                  <th className="px-4 py-3">Buyer & Color</th>
                  <th className="px-4 py-3">Allocation Start / End</th>
                  <th className="px-4 py-3 text-right">Allocated QTY (Kg)</th>
                  <th className="px-4 py-3 text-right">Allocated Bal. (Kg)</th>
                  <th className="px-4 py-3 text-right">GREY REQ. (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                {orders.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{o.ewo}</td>
                    <td className="px-4 py-3 text-slate-500">{o.buyer} — <span className="text-blue-600">{o.color}</span></td>
                    <td className="px-4 py-3 text-slate-500">{o.allocationStart || '-'} to {o.allocationEnd || '-'}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{o.allocatedQty ? o.allocatedQty.toLocaleString() : '0'}</td>
                    <td className="px-4 py-3 text-right font-bold text-amber-600">{o.allocatedBal}</td>
                    <td className="px-4 py-3 text-right font-bold">{o.greyReq ? o.greyReq.toLocaleString() : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: DELIVERY TIMELINE */}
      {activeSubTab === 'delivery' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">OTD Delivery & Knit Completion Timeline</h3>
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o.id} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-xs">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-900 dark:text-white">EWO: {o.ewo} — {o.buyer} ({o.color})</span>
                    <span className="block text-[10px] text-slate-400">Planned Knit: {o.knitStart} to {o.knitEnd} | Expected End: {o.expectedKnitEnd || 'N/A'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="block text-xs font-bold text-blue-600 dark:text-blue-400">{o.knitPro.toLocaleString()} / {o.target.toLocaleString()} Kg</span>
                    <span className="block text-[10px] text-slate-400">Avg Prod/Day: {o.avgProdDay} Kg</span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${o.knitStartOtd === 'Passed' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      Start OTD: {o.knitStartOtd}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${o.knitEndOtd === 'Passed' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      End OTD: {o.knitEndOtd}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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
    </div>
  );
}
