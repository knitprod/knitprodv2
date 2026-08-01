/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Settings, Save, Image, Cpu, CheckCircle, ShoppingBag, Plus, X, RotateCcw, Search, RefreshCw, Edit, Trash2, Building2, Layers } from 'lucide-react';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { getBuyers, saveBuyers, addBuyer as addNewBuyerToStore, removeBuyer as removeBuyerFromStore, resetBuyersToDefault } from '../lib/buyerStore';
import { ActivityLog } from '../types';

export interface UnitThresholdConfig {
  id: string;
  unitName: string;
  productionCapacity: number;
  avgProdPerMachine: number;
  totalMachine: number;
}

export const INITIAL_UNIT_CONFIGS: UnitThresholdConfig[] = [
  { id: 'unit-ekl', unitName: 'EKL', productionCapacity: 7500, totalMachine: 48, avgProdPerMachine: 156.25 },
  { id: 'unit-efl', unitName: 'EFL', productionCapacity: 15000, totalMachine: 40, avgProdPerMachine: 375 },
  { id: 'unit-efl2', unitName: 'EFL-2', productionCapacity: 15000, totalMachine: 35, avgProdPerMachine: 428.57 },
  { id: 'unit-autostripe', unitName: 'Auto Stripe', productionCapacity: 12000, totalMachine: 20, avgProdPerMachine: 600 },
  { id: 'unit-eflext', unitName: 'EFL-Extension', productionCapacity: 15000, totalMachine: 25, avgProdPerMachine: 600 },
  { id: 'unit-eslext', unitName: 'ESL-Extension', productionCapacity: 10000, totalMachine: 16, avgProdPerMachine: 625 }
];

export default function SettingsView() {
  const [rejectThreshold, setRejectThreshold] = useState('2.5');
  const [maxIdleMachines, setMaxIdleMachines] = useState('4');
  const [alarmEmail, setAlarmEmail] = useState('knitprod-alerts@epyllion.com');

  // Dynamic Units State
  const [unitConfigs, setUnitConfigs] = useState<UnitThresholdConfig[]>(INITIAL_UNIT_CONFIGS);

  // Popup Modal States for Unit Thresholds
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitThresholdConfig | null>(null);
  const [modalUnitName, setModalUnitName] = useState('');
  const [modalCapacity, setModalCapacity] = useState<string>('');
  const [modalTotalMachine, setModalTotalMachine] = useState<string>('');
  const [modalAvgProd, setModalAvgProd] = useState<string>('');
  const [unitModalError, setUnitModalError] = useState<string | null>(null);

  // Calculate Totals across all units
  const totalCapacity = unitConfigs.reduce((sum, u) => sum + Number(u.productionCapacity || 0), 0);
  const totalMachines = unitConfigs.reduce((sum, u) => sum + Number(u.totalMachine || 0), 0);
  const totalAvgProdPerMachine = unitConfigs.reduce((sum, u) => sum + Number(u.avgProdPerMachine || 0), 0);
  const totalCalculativeCapacity = unitConfigs.reduce((sum, u) => {
    const calcCap = (Number(u.totalMachine || 0) * 0.8) * Number(u.avgProdPerMachine || 0);
    return sum + calcCap;
  }, 0);

  // Buyer Directory state
  const [buyersList, setBuyersList] = useState<string[]>(() => getBuyers());
  const [newBuyerInput, setNewBuyerInput] = useState('');
  const [buyerSearchFilter, setBuyerSearchFilter] = useState('');
  const [buyerError, setBuyerError] = useState<string | null>(null);

  const [isSaved, setIsSaved] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const applyRemoteSettings = (remoteSettings: Record<string, any>) => {
      if (!remoteSettings) return;

      const rej = remoteSettings.rejectThreshold || remoteSettings.setting_rejectThreshold;
      if (rej) setRejectThreshold(String(rej));

      const maxIdle = remoteSettings.maxIdleMachines || remoteSettings.setting_maxIdleMachines;
      if (maxIdle) setMaxIdleMachines(String(maxIdle));

      const email = remoteSettings.alarmEmail || remoteSettings.setting_alarmEmail;
      if (email) setAlarmEmail(String(email));

      // Load dynamic units list if provided in Firestore / remote settings
      if (remoteSettings.unitConfigs && Array.isArray(remoteSettings.unitConfigs) && remoteSettings.unitConfigs.length > 0) {
        setUnitConfigs(remoteSettings.unitConfigs);
      }

      if (remoteSettings.buyers) {
        const list = Array.isArray(remoteSettings.buyers)
          ? remoteSettings.buyers
          : String(remoteSettings.buyers).split(',').map(s => s.trim()).filter(Boolean);
        if (list.length > 0) {
          setBuyersList(list);
          saveBuyers(list);
        }
      }
    };

    // 1. Fetch from Google Apps Script if connected
    GasClient.fetchSettings().then(remoteSettings => {
      if (remoteSettings) {
        applyRemoteSettings(remoteSettings);
        FirestoreSyncService.saveSettings(remoteSettings).catch(() => {});
      }
    }).catch(err => {
      console.warn("Notice loading Google Sheets settings:", err);
    });

    // 2. Realtime subscription to Firestore settings
    const unsubscribe = FirestoreSyncService.subscribeToSettings((remoteSettings) => {
      if (remoteSettings) {
        applyRemoteSettings(remoteSettings);
      }
    });

    const handleBuyersUpdate = (e: Event) => {
      const customEv = e as CustomEvent<string[]>;
      if (customEv.detail) {
        setBuyersList(customEv.detail);
      } else {
        setBuyersList(getBuyers());
      }
    };
    window.addEventListener('buyers_updated', handleBuyersUpdate);
    return () => {
      if (unsubscribe) unsubscribe();
      window.removeEventListener('buyers_updated', handleBuyersUpdate);
    };
  }, []);

  // Modal helper handlers
  const handleOpenAddUnitModal = () => {
    setEditingUnit(null);
    setModalUnitName('');
    setModalCapacity('10000');
    setModalTotalMachine('20');
    setModalAvgProd('500');
    setUnitModalError(null);
    setIsUnitModalOpen(true);
  };

  const handleOpenEditUnitModal = (unit: UnitThresholdConfig) => {
    setEditingUnit(unit);
    setModalUnitName(unit.unitName);
    setModalCapacity(String(unit.productionCapacity));
    setModalTotalMachine(String(unit.totalMachine));
    setModalAvgProd(String(unit.avgProdPerMachine));
    setUnitModalError(null);
    setIsUnitModalOpen(true);
  };

  // Auto calculate average when capacity or totalMachine changes in modal
  const handleCapacityOrMachineChange = (capacityStr: string, machineStr: string) => {
    setModalCapacity(capacityStr);
    setModalTotalMachine(machineStr);
    const cap = parseFloat(capacityStr) || 0;
    const mac = parseFloat(machineStr) || 0;
    if (mac > 0 && cap > 0) {
      setModalAvgProd((cap / mac).toFixed(2));
    }
  };

  const handleSaveUnitFromModal = async () => {
    const nameTrimmed = modalUnitName.trim();
    if (!nameTrimmed) {
      setUnitModalError("Unit Name is required.");
      return;
    }

    const capNum = parseFloat(modalCapacity);
    if (isNaN(capNum) || capNum <= 0) {
      setUnitModalError("Production Capacity must be a positive number.");
      return;
    }

    const macNum = parseInt(modalTotalMachine, 10);
    if (isNaN(macNum) || macNum <= 0) {
      setUnitModalError("Total Machine must be a positive integer.");
      return;
    }

    let avgNum = parseFloat(modalAvgProd);
    if (isNaN(avgNum) || avgNum <= 0) {
      avgNum = parseFloat((capNum / macNum).toFixed(2));
    }

    let updatedUnits: UnitThresholdConfig[] = [];
    if (editingUnit) {
      // Update existing unit
      updatedUnits = unitConfigs.map(u => u.id === editingUnit.id ? {
        ...u,
        unitName: nameTrimmed,
        productionCapacity: capNum,
        totalMachine: macNum,
        avgProdPerMachine: avgNum
      } : u);
    } else {
      // Add new unit
      const newUnit: UnitThresholdConfig = {
        id: `unit-${Date.now()}`,
        unitName: nameTrimmed,
        productionCapacity: capNum,
        totalMachine: macNum,
        avgProdPerMachine: avgNum
      };
      updatedUnits = [...unitConfigs, newUnit];
    }

    setUnitConfigs(updatedUnits);
    setIsUnitModalOpen(false);

    // Save to Firestore and create Activity Log in Firestore
    const settingsMap = {
      rejectThreshold,
      maxIdleMachines,
      alarmEmail,
      unitConfigs: updatedUnits,
      buyers: buyersList
    };

    try {
      await FirestoreSyncService.saveSettings(settingsMap);
      // Log Activity in Firestore
      const logMsg = editingUnit
        ? `Updated Unit configuration for "${nameTrimmed}": Capacity=${capNum}Kg, Machines=${macNum}, Avg=${avgNum}Kg.`
        : `Added New Unit "${nameTrimmed}": Capacity=${capNum}Kg, Machines=${macNum}, Avg=${avgNum}Kg.`;

      await FirestoreSyncService.saveActivityLog({
        id: `act-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        floorId: nameTrimmed,
        type: 'maintenance',
        message: logMsg,
        status: 'info'
      });
    } catch (err) {
      console.warn("Error saving unit changes to Firestore:", err);
    }
  };

  const handleDeleteUnit = async (unit: UnitThresholdConfig) => {
    if (!window.confirm(`Are you sure you want to delete Unit "${unit.unitName}"?`)) return;

    const updatedUnits = unitConfigs.filter(u => u.id !== unit.id);
    setUnitConfigs(updatedUnits);

    const settingsMap = {
      rejectThreshold,
      maxIdleMachines,
      alarmEmail,
      unitConfigs: updatedUnits,
      buyers: buyersList
    };

    try {
      await FirestoreSyncService.saveSettings(settingsMap);
      await FirestoreSyncService.saveActivityLog({
        id: `act-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        floorId: unit.unitName,
        type: 'maintenance',
        message: `Deleted Unit "${unit.unitName}" from General Threshold Settings.`,
        status: 'warning'
      });
    } catch (err) {
      console.warn("Error syncing unit deletion to Firestore:", err);
    }
  };

  const handleAddBuyer = () => {
    const trimmed = newBuyerInput.trim();
    if (!trimmed) return;
    if (buyersList.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      setBuyerError(`Buyer "${trimmed}" already exists in directory.`);
      setTimeout(() => setBuyerError(null), 3000);
      return;
    }
    const updated = addNewBuyerToStore(trimmed);
    setBuyersList(updated);
    setNewBuyerInput('');
    setBuyerError(null);
  };

  const handleRemoveBuyer = (buyerName: string) => {
    const updated = removeBuyerFromStore(buyerName);
    setBuyersList(updated);
  };

  const handleResetBuyers = () => {
    if (window.confirm("Reset buyers directory to default initial 24 buyers list?")) {
      const updated = resetBuyersToDefault();
      setBuyersList(updated);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);

    // Save buyer directory list in memory
    saveBuyers(buyersList);

    const settingsMap = {
      rejectThreshold,
      maxIdleMachines,
      alarmEmail,
      unitConfigs,
      buyers: buyersList
    };

    // Sync to Firestore via FirestoreSyncService
    try {
      await FirestoreSyncService.saveSettings(settingsMap);
      await FirestoreSyncService.saveActivityLog({
        id: `act-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        floorId: 'System',
        type: 'maintenance',
        message: `System configurations committed to Firebase Firestore. Total Units: ${unitConfigs.length}, Active Buyers: ${buyersList.length}.`,
        status: 'success'
      });
    } catch (e) {
      console.warn("Settings save error:", e);
    }

    // Persist centrally on server DB for all devices
    await GasClient.saveServerDb({
      settings: {
        rejectThreshold,
        maxIdleMachines,
        alarmEmail,
        unitConfigs,
        buyers: buyersList
      }
    });

    setIsSyncing(false);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 4000);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="font-sans text-xl font-black tracking-tight text-gray-900 dark:text-white">
          Knitting Performance System Configuration
        </h2>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Configure default floor plans, quality tolerances, and notification hooks
        </p>
      </div>

      {isSaved && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 shadow-xs flex items-center gap-2.5 animate-fade-in">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
          <span>Application configurations successfully committed to central cache registry and Firebase Firestore.</span>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Settings Form */}
        <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs lg:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* GENERAL THRESHOLD SETTINGS - DYNAMIC UNITS TABLE */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-sans text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">
                      General Threshold Settings
                    </h3>
                    <p className="text-[11px] font-medium text-gray-400">
                      Manage unit production capacities, machine counts, and average outputs per machine
                    </p>
                  </div>
                </div>

                {/* + ADD NEW UNIT BUTTON */}
                <button
                  type="button"
                  onClick={handleOpenAddUnitModal}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Plus className="h-4 w-4 text-sky-300" />
                  <span>+ Add New Unit</span>
                </button>
              </div>

              {/* UNITS TABLE */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                      <th className="py-3 px-4">Unit Name</th>
                      <th className="py-3 px-4 text-right">Production Capacity (Kg)</th>
                      <th className="py-3 px-4 text-right">Avg Prod. / Machine (Kg)</th>
                      <th className="py-3 px-4 text-center">Total Machine</th>
                      <th className="py-3 px-4 text-right">Calculative Capacity/Day (80% Utilization)</th>
                      <th className="py-3 px-4 text-center">Action Button</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-200">
                    {unitConfigs.map((unit, index) => {
                      const calcCap = (Number(unit.totalMachine || 0) * 0.8) * Number(unit.avgProdPerMachine || 0);
                      return (
                        <tr key={unit.id || `unit-${index}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                              <Layers className="h-3 w-3 text-blue-500" />
                              {unit.unitName}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                            {unit.productionCapacity.toLocaleString()} Kg
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                            {unit.avgProdPerMachine.toFixed(2)} Kg
                          </td>
                          <td className="py-3 px-4 text-center font-bold">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                              {unit.totalMachine}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {calcCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              {/* EDIT BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditUnitModal(unit)}
                                title="Edit Unit Configuration"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 font-extrabold text-[11px] transition-all cursor-pointer"
                              >
                                <Edit className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* DELETE BUTTON */}
                              <button
                                type="button"
                                onClick={() => handleDeleteUnit(unit)}
                                title="Delete Unit Configuration"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 border border-red-200/60 dark:border-red-800/60 font-extrabold text-[11px] transition-all cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* TOTAL SUMMARY ROW */}
                    {unitConfigs.length > 0 && (
                      <tr key="total-summary-row" className="bg-slate-100/90 dark:bg-slate-800/90 border-t-2 border-slate-300 dark:border-slate-600 font-extrabold text-slate-900 dark:text-white">
                        <td className="py-3.5 px-4 font-black">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 text-white dark:bg-blue-950 dark:text-blue-300 border border-slate-800 dark:border-blue-800 text-[11px] uppercase tracking-wider font-extrabold">
                            <Building2 className="h-3.5 w-3.5 text-amber-400 dark:text-sky-300" />
                            Total
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs sm:text-sm font-black text-blue-900 dark:text-blue-300">
                          {totalCapacity.toLocaleString()} Kg
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                          {totalAvgProdPerMachine.toFixed(2)} Kg
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold">
                          <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700 font-mono text-xs font-black">
                            {totalMachines}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-xs sm:text-sm font-black text-indigo-900 dark:text-indigo-300">
                          {totalCalculativeCapacity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Kg
                        </td>
                        <td className="py-3.5 px-4 text-center text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                          All Units Combined
                        </td>
                      </tr>
                    )}

                    {unitConfigs.length === 0 && (
                      <tr key="empty-units-row">
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No units configured yet. Click <strong>"+ Add New Unit"</strong> above to add one.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quality Tolerances */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4">
              <h3 className="font-sans text-sm font-black text-gray-900 dark:text-white uppercase flex items-center gap-2">
                <Cpu className="h-4.5 w-4.5 text-indigo-600" />
                Quality & Alarm Tolerances
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Max Rejection Threshold (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={rejectThreshold}
                    onChange={(e) => setRejectThreshold(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    Max Idle Machines Alert
                  </label>
                  <input
                    type="number"
                    value={maxIdleMachines}
                    onChange={(e) => setMaxIdleMachines(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 focus:border-blue-500 focus:bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    System Alert Email
                  </label>
                  <input
                    type="email"
                    value={alarmEmail}
                    onChange={(e) => setAlarmEmail(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-gray-800 dark:text-slate-100 focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Buyer Directory Management */}
            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-sans text-sm font-black text-gray-900 dark:text-white uppercase flex items-center gap-2">
                  <ShoppingBag className="h-4.5 w-4.5 text-emerald-600" />
                  Buyer Directory Management
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-200/60 dark:border-emerald-800">
                    {buyersList.length} Active Buyers
                  </span>
                  <button
                    type="button"
                    onClick={handleResetBuyers}
                    title="Reset to standard 24 buyers list"
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset Defaults</span>
                  </button>
                </div>
              </div>

              {buyerError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {buyerError}
                </div>
              )}

              {/* Add New Buyer Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Enter new buyer name (e.g. Nike, Adidas, Inditex)..."
                    value={newBuyerInput}
                    onChange={(e) => setNewBuyerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBuyer();
                      }
                    }}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-gray-800 dark:text-slate-100 focus:outline-hidden focus:bg-white focus:border-emerald-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddBuyer}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Buyer</span>
                </button>
              </div>

              {/* Search Buyers Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter registered buyers..."
                  value={buyerSearchFilter}
                  onChange={(e) => setBuyerSearchFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 pl-8 pr-3 py-1.5 text-[11px] font-medium focus:outline-hidden text-slate-800 dark:text-slate-100"
                />
              </div>

              {/* Buyers Chips List */}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                {buyersList
                  .filter(b => b.toLowerCase().includes(buyerSearchFilter.toLowerCase()))
                  .map(buyer => (
                    <span
                      key={buyer}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 pl-2.5 pr-1.5 py-1 rounded-lg shadow-2xs group hover:border-emerald-500 transition-colors"
                    >
                      <span>{buyer}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBuyer(buyer)}
                        title={`Remove ${buyer}`}
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full p-0.5 transition-colors cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                {buyersList.filter(b => b.toLowerCase().includes(buyerSearchFilter.toLowerCase())).length === 0 && (
                  <span className="text-xs font-semibold text-slate-400 py-2">
                    No buyers matching "{buyerSearchFilter}" found.
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSyncing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-900 py-3 text-sm font-black text-white hover:bg-blue-950 transition-all shadow-md cursor-pointer disabled:opacity-60"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                  <span>Syncing Settings to Firebase Firestore...</span>
                </>
              ) : isSaved ? (
                <>
                  <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
                  <span>Saved & Synced to Firebase Firestore!</span>
                </>
              ) : (
                <>
                  <Save className="h-4.5 w-4.5" />
                  <span>Save System Settings & Sync to Firestore</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Logo Customization guidelines */}
        <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-gray-50 dark:border-slate-800 pb-3 mb-4">
              <Image className="h-4.5 w-4.5 text-blue-600" />
              <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase">Logo Customization</h3>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-slate-700 p-6 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-400">
                  <Image className="h-5 w-5" />
                </div>
                <span className="mt-2 block text-xs font-bold text-gray-700 dark:text-slate-200">Company Logo Placeholder</span>
                <span className="mt-1 block text-[10px] text-gray-400">Recommended size: 160 x 50 pixels (PNG with alpha channel transparent)</span>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-900 dark:text-slate-200 uppercase">Step-by-step Replacement Guide:</h4>
                <div className="text-[11px] font-medium text-gray-500 dark:text-slate-400 leading-relaxed space-y-2.5">
                  <p>
                    1. Save your company logo as a transparent PNG asset under the name <strong>company_logo.png</strong>.
                  </p>
                  <p>
                    2. Drag and upload that image into the <strong>/public/</strong> directory of the applet using the file browser.
                  </p>
                  <p>
                    3. Modify the placeholder image element in <strong>src/components/Header.tsx</strong> to reference your newly uploaded asset.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl bg-blue-50/50 dark:bg-blue-950/40 p-3.5 text-center">
            <span className="block text-[10px] font-black uppercase tracking-widest text-blue-800 dark:text-blue-300">
              Epyllion Knitex ERP Portal
            </span>
            <span className="mt-1 block text-[9px] text-blue-600 dark:text-blue-400 font-semibold">
              Software Version: 1.0.0 Stable Build (Firestore Sync Active)
            </span>
          </div>
        </div>
      </div>

      {/* POPUP MODAL FOR ADD / EDIT UNIT THRESHOLD */}
      {isUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <h3 className="font-sans text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingUnit ? `Edit Unit (${editingUnit.unitName})` : '+ Add New Unit Threshold'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {unitModalError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-bold text-red-700 dark:text-red-300">
                {unitModalError}
              </div>
            )}

            <div className="space-y-4 text-xs font-semibold">
              {/* Unit Name */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Unit Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. EKL, EFL-3, Extension Floor..."
                  value={modalUnitName}
                  onChange={(e) => setModalUnitName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* Production Capacity */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Production Capacity (Kg / day) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={modalCapacity}
                  onChange={(e) => handleCapacityOrMachineChange(e.target.value, modalTotalMachine)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* Total Machine */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Total Machine Allocation <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 40"
                  value={modalTotalMachine}
                  onChange={(e) => handleCapacityOrMachineChange(modalCapacity, e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-900 dark:text-white focus:bg-white focus:border-blue-500 outline-none transition-all"
                />
              </div>

              {/* Avg Prod. / Machine */}
              <div className="space-y-1">
                <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Avg Prod. / Machine (Kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Auto-calculated (Capacity / Machines)"
                  value={modalAvgProd}
                  onChange={(e) => setModalAvgProd(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 focus:bg-white focus:border-emerald-500 outline-none transition-all"
                />
                <span className="text-[10px] text-slate-400 font-medium">
                  Auto-calculated based on Production Capacity ÷ Total Machine.
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsUnitModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-extrabold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveUnitFromModal}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-black text-xs transition-all shadow-md cursor-pointer"
              >
                <Save className="h-4 w-4" />
                <span>Save Unit Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

