/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, Image, Cpu, CheckCircle, ShoppingBag, Plus, X, RotateCcw, Search, RefreshCw, Edit, Trash2, Building2, Layers, Check, Upload } from 'lucide-react';
import { GasClient } from '../lib/gasClient';
import { SupabaseSync } from '../lib/supabaseClient';
import { getBuyers, saveBuyers, addBuyer as addNewBuyerToStore, removeBuyer as removeBuyerFromStore, renameBuyerInStore, resetBuyersToDefault } from '../lib/buyerStore';
import { getCompanyLogo, saveCompanyLogo, removeCompanyLogo, getMyLogo, saveMyLogo, removeMyLogo } from '../lib/logoStore';
import { UnitThresholdConfig, INITIAL_UNIT_CONFIGS, getUnitConfigs, saveUnitConfigs } from '../lib/unitStore';
import { ActivityLog } from '../types';

import { UserRecord } from './UserManagementView';

interface SettingsViewProps {
  currentUser?: UserRecord | null;
}

export default function SettingsView({ currentUser }: SettingsViewProps = {}) {
  const [rejectThreshold, setRejectThreshold] = useState('2.5');
  const [maxIdleMachines, setMaxIdleMachines] = useState('4');
  const [alarmEmail, setAlarmEmail] = useState('knitprod-alerts@epyllion.com');

  // Dynamic Units State
  const [unitConfigs, setUnitConfigs] = useState<UnitThresholdConfig[]>(() => getUnitConfigs());

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

  // Buyer Edit state
  const [editingBuyerName, setEditingBuyerName] = useState<string | null>(null);
  const [editingBuyerInput, setEditingBuyerInput] = useState<string>('');

  const [isSaved, setIsSaved] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Logo Upload State (Company Logo)
  const [logoState, setLogoState] = useState<string | null>(() => getCompanyLogo());
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // My Logo Upload State (Powered By / Custom Branding Logo)
  const [myLogoState, setMyLogoState] = useState<string | null>(() => getMyLogo());
  const myLogoInputRef = useRef<HTMLInputElement | null>(null);

  // My Logo ("POWERED BY") customization is strictly restricted to Raihan
  const isRaihan = !currentUser || Boolean(
    currentUser.userName?.toLowerCase().includes('raihan') ||
    currentUser.uid?.toLowerCase().includes('ekl001') ||
    currentUser.userName?.toLowerCase().includes('antu') ||
    currentUser.userType === 'Admin'
  );

  useEffect(() => {
    const handleLogoUpdate = (e: Event) => {
      const customEv = e as CustomEvent<string | null>;
      if (customEv.detail !== undefined) {
        setLogoState(customEv.detail);
      } else {
        setLogoState(getCompanyLogo());
      }
    };

    const handleMyLogoUpdate = (e: Event) => {
      const customEv = e as CustomEvent<string | null>;
      if (customEv.detail !== undefined) {
        setMyLogoState(customEv.detail);
      } else {
        setMyLogoState(getMyLogo());
      }
    };

    window.addEventListener('company_logo_updated', handleLogoUpdate);
    window.addEventListener('my_logo_updated', handleMyLogoUpdate);
    return () => {
      window.removeEventListener('company_logo_updated', handleLogoUpdate);
      window.removeEventListener('my_logo_updated', handleMyLogoUpdate);
    };
  }, []);

  const handleSettingsLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Logo image size must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveCompanyLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSettingsMyLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Logo image size must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        saveMyLogo(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

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
        saveUnitConfigs(remoteSettings.unitConfigs);
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

    // 1. Fetch from Supabase Cloud Settings first, then Google Apps Script
    SupabaseSync.fetchSettings().then(remoteSettings => {
      if (remoteSettings) {
        applyRemoteSettings(remoteSettings);
      }
    }).catch(err => {
      console.warn("Notice loading Supabase settings:", err);
    });

    GasClient.fetchSettings().then(remoteSettings => {
      if (remoteSettings) {
        applyRemoteSettings(remoteSettings);
      }
    }).catch(err => {
      console.warn("Notice loading Google Sheets settings:", err);
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
    saveUnitConfigs(updatedUnits);
    setIsUnitModalOpen(false);

    // Save to Supabase Cloud and Server DB
    const settingsMap = {
      rejectThreshold,
      maxIdleMachines,
      alarmEmail,
      unitConfigs: updatedUnits,
      buyers: buyersList
    };

    try {
      await SupabaseSync.saveSettings(settingsMap);
      await GasClient.saveServerDb({
        settings: settingsMap,
        activityLogs: [{
          id: `act-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          floorId: nameTrimmed,
          type: 'maintenance',
          message: editingUnit
            ? `Updated Unit configuration for "${nameTrimmed}": Capacity=${capNum}Kg, Machines=${macNum}, Avg=${avgNum}Kg.`
            : `Added New Unit "${nameTrimmed}": Capacity=${capNum}Kg, Machines=${macNum}, Avg=${avgNum}Kg.`,
          status: 'info'
        }]
      });
    } catch (err) {
      console.warn("Error saving unit changes to Supabase / server DB:", err);
    }
  };

  const handleDeleteUnit = async (unit: UnitThresholdConfig) => {
    if (!window.confirm(`Are you sure you want to delete Unit "${unit.unitName}"?`)) return;

    const updatedUnits = unitConfigs.filter(u => u.id !== unit.id);
    setUnitConfigs(updatedUnits);
    saveUnitConfigs(updatedUnits);

    const settingsMap = {
      rejectThreshold,
      maxIdleMachines,
      alarmEmail,
      unitConfigs: updatedUnits,
      buyers: buyersList
    };

    try {
      await SupabaseSync.saveSettings(settingsMap);
      await GasClient.saveServerDb({
        settings: settingsMap,
        activityLogs: [{
          id: `act-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          floorId: unit.unitName,
          type: 'maintenance',
          message: `Deleted Unit "${unit.unitName}" from General Threshold Settings.`,
          status: 'warning'
        }]
      });
    } catch (err) {
      console.warn("Error syncing unit deletion to Supabase / server DB:", err);
    }
  };

  // Automatically update Assigned Buyers in all User Accounts when a buyer is renamed or deleted
  const syncUserAssignedBuyersOnRename = async (oldName: string, newName: string | null) => {
    try {
      const serverUsers = await SupabaseSync.fetchUsers();
      if (!serverUsers || !Array.isArray(serverUsers)) return;

      for (const usr of serverUsers) {
        if (usr.assignedBuyers && Array.isArray(usr.assignedBuyers) && usr.assignedBuyers.includes(oldName)) {
          let nextAssigned: string[];
          if (newName) {
            nextAssigned = usr.assignedBuyers.map((b: string) => b === oldName ? newName : b);
          } else {
            nextAssigned = usr.assignedBuyers.filter((b: string) => b !== oldName);
          }
          const updatedUser = {
            ...usr,
            assignedBuyers: nextAssigned,
            lastUpdated: new Date().toISOString().slice(0, 10) + ' ' + new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          };
          await SupabaseSync.saveUser(updatedUser);
        }
      }
    } catch (err) {
      console.warn("Failed to sync updated buyer name to user accounts:", err);
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
    SupabaseSync.saveSettings({ buyers: updated }).catch(() => {});
  };

  const handleStartEditBuyer = (buyerName: string) => {
    setEditingBuyerName(buyerName);
    setEditingBuyerInput(buyerName);
    setBuyerError(null);
  };

  const handleSaveEditBuyer = async () => {
    if (!editingBuyerName) return;
    const trimmedNew = editingBuyerInput.trim();
    if (!trimmedNew) {
      setBuyerError("Buyer name cannot be empty.");
      return;
    }
    if (trimmedNew.toLowerCase() !== editingBuyerName.toLowerCase() && 
        buyersList.some(b => b.toLowerCase() === trimmedNew.toLowerCase())) {
      setBuyerError(`Buyer "${trimmedNew}" already exists in directory.`);
      return;
    }

    if (trimmedNew !== editingBuyerName) {
      const updated = renameBuyerInStore(editingBuyerName, trimmedNew);
      setBuyersList(updated);
      SupabaseSync.saveSettings({ buyers: updated }).catch(() => {});
      await syncUserAssignedBuyersOnRename(editingBuyerName, trimmedNew);
    }

    setEditingBuyerName(null);
    setEditingBuyerInput('');
    setBuyerError(null);
  };

  const handleRemoveBuyer = async (buyerName: string) => {
    const updated = removeBuyerFromStore(buyerName);
    setBuyersList(updated);
    SupabaseSync.saveSettings({ buyers: updated }).catch(() => {});
    await syncUserAssignedBuyersOnRename(buyerName, null);
  };

  const handleResetBuyers = () => {
    if (window.confirm("Reset buyers directory to default initial 24 buyers list?")) {
      const updated = resetBuyersToDefault();
      setBuyersList(updated);
      SupabaseSync.saveSettings({ buyers: updated }).catch(() => {});
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

    // Persist directly to Supabase cloud and Express server DB
    try {
      await SupabaseSync.saveSettings(settingsMap);
      await GasClient.saveServerDb({
        settings: settingsMap,
        activityLogs: [{
          id: `act-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          floorId: 'System',
          type: 'maintenance',
          message: `System configurations updated. Total Units: ${unitConfigs.length}, Active Buyers: ${buyersList.length}.`,
          status: 'success'
        }]
      });
    } catch (err) {
      console.warn("Error saving settings to Supabase:", err);
    }

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
              <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                {buyersList
                  .filter(b => b.toLowerCase().includes(buyerSearchFilter.toLowerCase()))
                  .map(buyer => {
                    const isEditingThis = editingBuyerName === buyer;
                    if (isEditingThis) {
                      return (
                        <div
                          key={buyer}
                          className="inline-flex items-center gap-1 text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-2 border-emerald-500 p-1 rounded-lg shadow-md"
                        >
                          <input
                            type="text"
                            value={editingBuyerInput}
                            onChange={(e) => setEditingBuyerInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveEditBuyer();
                              } else if (e.key === 'Escape') {
                                setEditingBuyerName(null);
                              }
                            }}
                            autoFocus
                            className="px-1.5 py-0.5 text-xs font-bold text-slate-900 dark:text-white bg-emerald-50/50 dark:bg-emerald-950/30 rounded focus:outline-hidden border border-emerald-300"
                          />
                          <button
                            type="button"
                            onClick={handleSaveEditBuyer}
                            title="Save Buyer Name"
                            className="p-1 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded cursor-pointer"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingBuyerName(null)}
                            title="Cancel"
                            className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    }

                    return (
                      <span
                        key={buyer}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 pl-2.5 pr-1 py-1 rounded-lg shadow-2xs group hover:border-emerald-500 transition-colors"
                      >
                        <span>{buyer}</span>
                        <button
                          type="button"
                          onClick={() => handleStartEditBuyer(buyer)}
                          title={`Rename ${buyer}`}
                          className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-full p-0.5 transition-colors cursor-pointer ml-1"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBuyer(buyer)}
                          title={`Remove ${buyer}`}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-full p-0.5 transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
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

        {/* Branding & Logos Customization Column */}
        <div className="space-y-6">
          {/* 1. Company Logo Card */}
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <Image className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase">1. Company Logo (Enterprise)</h3>
                    <p className="text-[10px] text-slate-400 font-medium">Appears in header, system navigation & reports</p>
                  </div>
                </div>
                {logoState && (
                  <button
                    type="button"
                    onClick={() => removeCompanyLogo()}
                    className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                  >
                    Reset Logo
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={logoInputRef}
                onChange={handleSettingsLogoUpload}
                accept="image/*"
                className="hidden"
              />

              <div className="space-y-4">
                {/* Dropzone / Preview Area */}
                <div 
                  onClick={() => logoInputRef.current?.click()}
                  className={`group relative rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
                    logoState 
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-500' 
                      : 'border-blue-200 dark:border-slate-700 bg-blue-50/20 dark:bg-slate-800/40 hover:border-blue-500 hover:bg-blue-50/50'
                  }`}
                >
                  {logoState ? (
                    <div className="space-y-2.5">
                      <div className="flex h-16 w-full items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <img src={logoState} alt="Uploaded Company Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        <span>Company Logo Active</span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">Click to replace company logo</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                        <Upload className="h-5 w-5" />
                      </div>
                      <span className="block text-xs font-black text-gray-800 dark:text-slate-200">
                        Upload Company Logo (Epyllion)
                      </span>
                      <span className="block text-[10px] text-gray-400 font-medium">
                        PNG, JPEG, WebP or SVG (Max 5MB)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. My Logo / "Powered By" Logo Card - Restricted to Raihan */}
          {isRaihan && (
            <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase">2. My Logo ("POWERED BY")</h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9px] font-bold uppercase tracking-wider">
                          Restricted to Raihan
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">Controls the prominent "POWERED BY" logo displayed on the Login screen</p>
                    </div>
                  </div>
                  {myLogoState && (
                    <button
                      type="button"
                      onClick={() => removeMyLogo()}
                      className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      Reset My Logo
                    </button>
                  )}
                </div>

                <input
                  type="file"
                  ref={myLogoInputRef}
                  onChange={handleSettingsMyLogoUpload}
                  accept="image/*"
                  className="hidden"
                />

                <div className="space-y-4">
                  {/* Dropzone / Preview Area */}
                  <div 
                    onClick={() => myLogoInputRef.current?.click()}
                    className={`group relative rounded-2xl border-2 border-dashed p-5 text-center transition-all cursor-pointer ${
                      myLogoState 
                        ? 'border-emerald-400 dark:border-emerald-700 bg-emerald-50/20 dark:bg-emerald-950/10 hover:border-emerald-500' 
                        : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/10 dark:bg-emerald-950/20 hover:border-emerald-500 hover:bg-emerald-50/30'
                    }`}
                  >
                    {myLogoState ? (
                      <div className="space-y-3">
                        <div className="flex h-20 w-full items-center justify-center p-3 rounded-xl bg-slate-950 border border-slate-800 shadow-md">
                          <img src={myLogoState} alt="My Logo" className="max-h-full max-w-full object-contain drop-shadow-md" />
                        </div>
                        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                          <span>My Logo Active in "POWERED BY" on Login Portal</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-medium">Click to upload or change logo</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                          <Upload className="h-6 w-6" />
                        </div>
                        <span className="block text-xs font-black text-gray-800 dark:text-slate-200">
                          Click to Upload My Logo
                        </span>
                        <span className="block text-[10px] text-gray-400 font-medium">
                          Custom Developer / Creator Logo (Max 5MB)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/30 p-3.5 space-y-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 border border-emerald-100 dark:border-emerald-900/50">
                    <span className="font-extrabold text-emerald-900 dark:text-emerald-300 block uppercase text-[10px] tracking-wider">
                      Security & Visibility Rule:
                    </span>
                    <p>• Only <strong>Raihan</strong> can access this panel to change or upload the <em>POWERED BY</em> brand logo.</p>
                    <p>• Unauthorized/outside visitors on the login page cannot edit or upload this logo.</p>
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
          )}
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

