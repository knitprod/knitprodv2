/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  Settings, 
  User, 
  Clock, 
  Calendar, 
  Check, 
  AlertCircle, 
  Menu, 
  X, 
  Home, 
  ClipboardCopy, 
  LayoutGrid, 
  TrendingUp, 
  FileText, 
  Users, 
  LogOut,
  Sun,
  Moon,
  Key,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldAlert,
  RefreshCw,
  Upload
} from 'lucide-react';
import { ActivityLog } from '../types';
import { UserRecord } from './UserManagementView';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { getCompanyLogo, saveCompanyLogo } from '../lib/logoStore';
import TopNavMenu from './TopNavMenu';

interface HeaderProps {
  notifications: ActivityLog[];
  onNotificationClick: (floorId?: string) => void;
  onNavigate: (tab: string) => void;
  currentPage: string;
  onLogout?: () => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  isDark: boolean;
  onToggleDark: () => void;
  currentUser?: UserRecord | null;
  onManualSync?: () => Promise<void> | void;
}

export default function Header({ 
  notifications, 
  onNotificationClick, 
  onNavigate, 
  currentPage,
  onLogout,
  mobileMenuOpen,
  setMobileMenuOpen,
  isDark,
  onToggleDark,
  currentUser,
  onManualSync
}: HeaderProps) {
  const [time, setTime] = useState<string>(() => new Date().toLocaleTimeString('en-US', { hour12: true }));
  const [date, setDate] = useState<string>(() => new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }));
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwdText, setShowPwdText] = useState(false);
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [companyLogo, setCompanyLogo] = useState<string | null>(() => getCompanyLogo());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleLogoUpdate = (e: Event) => {
      const customEv = e as CustomEvent<string | null>;
      if (customEv.detail !== undefined) {
        setCompanyLogo(customEv.detail);
      } else {
        setCompanyLogo(getCompanyLogo());
      }
    };
    window.addEventListener('company_logo_updated', handleLogoUpdate);

    // Also check remote settings from Firestore for companyLogo
    const unsubSettings = FirestoreSyncService.subscribeToSettings((settings) => {
      if (settings?.companyLogo) {
        setCompanyLogo(settings.companyLogo);
        try {
          localStorage.setItem('ekl_company_logo', settings.companyLogo);
        } catch {}
      }
    });

    return () => {
      window.removeEventListener('company_logo_updated', handleLogoUpdate);
      if (unsubSettings) unsubSettings();
    };
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  useEffect(() => {
    const unsubscribe = GasClient.onSyncStateChange((syncing) => {
      setIsSyncing(syncing);
    });
    return unsubscribe;
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    if (!newPassword.trim()) {
      return setPwdError("Please enter a new password.");
    }
    if (newPassword.trim().length < 4) {
      return setPwdError("Password must be at least 4 characters long.");
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      return setPwdError("Passwords do not match.");
    }

    if (!currentUser || !currentUser.uid) {
      return setPwdError("User session missing.");
    }

    setIsUpdatingPwd(true);

    const updatedUser: UserRecord = {
      ...currentUser,
      password: newPassword.trim(),
      lastUpdated: new Date().toLocaleString()
    };

    // Save directly to Firebase Firestore
    FirestoreSyncService.saveUser(updatedUser).catch(err => {
      console.warn("Failed to sync updated password to Firestore:", err);
    });

    setPwdSuccess("Password updated and synced to Firebase Firestore!");
    setIsUpdatingPwd(false);

    // Sync to Google Sheets in background
    if (GasClient.getDatabaseMode() === 'gas') {
      GasClient.updateUser(updatedUser).catch(err => {
        console.warn("Background password update notice:", err);
      });
    }

    setTimeout(() => {
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      setPwdSuccess(null);
    }, 1000);
  };

  // Live ticking clock in 12-hour AM/PM format
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: true }));
      setDate(now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }));
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const alertNotifications = notifications.filter(n => n.type === 'alert');

  return (
    <header className="fixed top-0 left-0 right-0 z-40 border-b border-gray-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md text-gray-900 dark:text-slate-100 shadow-2xs">
      {/* Tier 1: Main Header Bar */}
      <div className="flex h-14 items-center justify-between px-3 sm:px-6">
        {/* Left side: Company Logo Placeholder & Title */}
        <div className="flex items-center gap-1.5 sm:gap-4">
          {/* Hamburger Menu Toggle for Mobile */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors md:hidden shrink-0 cursor-pointer"
            aria-label="Toggle mobile menu"
            id="header-hamburger-btn"
          >
            {mobileMenuOpen ? <X className="h-5 w-5 text-blue-600 dark:text-blue-400" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Company Logo Element with Upload Trigger */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleLogoUpload} 
            accept="image/*" 
            className="hidden" 
            id="header-logo-input"
          />
          {companyLogo ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-9 sm:h-10 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-1 transition-all hover:border-blue-500 cursor-pointer shrink-0 shadow-2xs"
              title="Click to change company logo"
            >
              <img 
                src={companyLogo} 
                alt="Company Logo" 
                className="h-7 sm:h-8 w-auto max-w-[110px] object-contain"
              />
              <div className="absolute inset-0 bg-blue-900/60 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="h-4 w-4 text-white" />
              </div>
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-9 w-9 sm:h-10 sm:w-10 cursor-pointer items-center justify-center rounded-lg border border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20 transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 shrink-0"
              title="Click to upload company logo"
            >
              <span className="font-mono text-xs font-black tracking-tight text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">EKL</span>
              <div className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow-2xs">
                +
              </div>
              {/* Tooltip */}
              <div className="absolute left-12 top-0 hidden w-48 rounded-xl bg-gray-900 p-2 text-[10px] text-white group-hover:block shadow-md z-50">
                Click to upload your official <strong>Epyllion Knitex Logo</strong> (PNG/JPEG)
              </div>
            </div>
          )}

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-sans text-[11px] sm:text-sm md:text-base font-black tracking-tight sm:tracking-wider text-gray-950 dark:text-slate-100 uppercase truncate max-w-[120px] sm:max-w-none">
                Epyllion Knitex Ltd.
              </span>
              {isSyncing ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 animate-pulse">
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-600 dark:text-blue-400" />
                  Syncing...
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  System Live
                </span>
              )}
            </div>
            <span className="font-sans text-[8px] sm:text-[10px] md:text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 truncate max-w-[120px] sm:max-w-none">
              Knitting Performance System
            </span>
          </div>
        </div>

        {/* Right side: Live Date/Time, Manual Sync, Theme Toggle, Alerts, Settings, User Profile */}
        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-5 shrink-0">
          {/* Manual Google Sheet Sync Button */}
          {onManualSync && (
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800/80 bg-blue-50/80 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 px-2.5 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 transition-all cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
              title="Bring & Sync live data from Google Sheet"
              id="header-manual-sync-btn"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-blue-600 dark:text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>
          )}

          {/* Live Date Indicator (Tablet & Up) */}
          <div className="hidden items-center gap-2 rounded-lg bg-gray-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-gray-500 dark:text-slate-400 xl:flex">
            <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">{date}</span>
          </div>

          {/* Live Clock Indicator */}
          <div className="hidden md:flex items-center gap-1 sm:gap-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 px-2 py-1 sm:px-3 sm:py-1.5 font-mono text-[10px] sm:text-xs font-bold text-blue-700 dark:text-blue-300 shrink-0">
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600 dark:text-blue-400 animate-pulse" />
            <span>{time}</span>
          </div>

          {/* Dark Mode / Light Mode Toggle Button */}
          <button
            onClick={onToggleDark}
            className="hidden md:flex rounded-lg p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="Toggle Dark/Light Mode"
            id="theme-toggle-btn"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDark ? <Sun className="h-5 w-5 text-amber-500" /> : <Moon className="h-5 w-5 text-slate-500" />}
          </button>

          {/* Alerts & Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
              aria-label="Toggle notifications"
              id="notification-bell-btn"
            >
              <Bell className="h-5 w-5" />
              {alertNotifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600"></span>
                </span>
              )}
            </button>

            {/* Notifications Dropdown Panel */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 mt-2.5 w-80 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 shadow-xl ring-1 ring-black/5 z-50">
                  <div className="flex items-center justify-between border-b border-gray-50 dark:border-slate-800 px-3 py-2">
                    <span className="text-xs font-bold text-gray-900 dark:text-slate-100">Floor Alerts & Updates</span>
                    <span className="rounded-full bg-red-50 dark:bg-red-950/40 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                      {alertNotifications.length} Critical
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto py-1">
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          onNotificationClick(n.floorId);
                          setShowNotifications(false);
                        }}
                        className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-800"
                      >
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          n.status === 'danger' ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400' :
                          n.status === 'warning' ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400' :
                          n.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 
                          'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                        }`}>
                          {n.status === 'danger' || n.status === 'warning' ? (
                            <AlertCircle className="h-3 w-3" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                        <div className="flex flex-col">
                          <p className="text-xs font-medium text-gray-800 dark:text-slate-200 line-clamp-2">
                            {n.message}
                          </p>
                          <span className="mt-1 text-[9px] font-bold text-gray-400 dark:text-slate-500 uppercase">
                            Floor: {n.floorId?.toUpperCase() || 'SYSTEM'} • {n.timestamp}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-50 dark:border-slate-800 p-1.5 text-center">
                    <button 
                      onClick={() => {
                        onNavigate('Floor Dashboard');
                        setShowNotifications(false);
                      }}
                      className="w-full rounded-lg py-1.5 text-center text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800"
                    >
                      View All Live Floor Dashboards
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Settings Icon */}
          <button
            onClick={() => onNavigate('Settings')}
            className="hidden md:flex rounded-lg p-2 text-gray-400 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="Settings"
            id="header-settings-btn"
          >
            <Settings className="h-5 w-5" />
          </button>

          {/* User Profile Component with Dropdown */}
          <div className="relative hidden md:flex items-center">
            <button 
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2.5 border-l border-gray-100 dark:border-slate-800 pl-3 md:pl-5 text-left cursor-pointer hover:opacity-95 transition-opacity"
              id="user-profile-dropdown-trigger"
            >
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-gray-950 dark:text-slate-200">
                  {currentUser?.userName || 'Md. Raihan Hossain Antu'}
                </span>
                <span className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                  {currentUser?.designation || 'Sr. Production Manager'} ({currentUser?.department || 'Knitting'})
                </span>
              </div>
              <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white shadow-sm ring-2 ring-blue-50 dark:ring-slate-800">
                {currentUser?.userName
                  ? currentUser.userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                  : 'KM'
                }
                <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-slate-900 bg-emerald-500" />
              </div>
            </button>

            {showProfileDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-transparent" 
                  onClick={() => setShowProfileDropdown(false)}
                />
                <div className="absolute right-0 top-12 mt-1 w-64 rounded-xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl ring-1 ring-black/5 z-50 space-y-3 animate-fade-in">
                  <div className="pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="block text-xs font-black text-slate-950 dark:text-white">
                      {currentUser?.userName || 'Md. Raihan Hossain Antu'}
                    </span>
                    <span className="block text-[10px] text-gray-400 dark:text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {currentUser?.designation || 'Sr. Production Manager'}
                    </span>
                    <span className="block text-[9px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wide">
                      Dept: {currentUser?.department || 'Knitting'} • UID: {currentUser?.uid || 'EKL001'}
                    </span>
                  </div>
                  
                  <div className="pt-1 pb-1 space-y-1">
                    <button
                      onClick={() => {
                        setShowProfileDropdown(false);
                        setPwdError(null);
                        setPwdSuccess(null);
                        setNewPassword('');
                        setConfirmPassword('');
                        setShowPasswordModal(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Key className="h-3.5 w-3.5 text-blue-500" />
                      <span>Change Password</span>
                    </button>
                    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-900/50">
                      <ShieldAlert className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Auto-logout: 30m idle / On browser exit</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileDropdown(false);
                      if (onLogout) onLogout();
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/45 text-red-600 dark:text-red-400 py-2 text-xs font-bold transition-all cursor-pointer uppercase tracking-wider"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout Session</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tier 2: Top Navigation Menu Bar */}
      <div className="hidden md:flex items-center justify-start border-t border-gray-100 dark:border-slate-800/80 px-3 sm:px-6 py-1.5 bg-slate-50/60 dark:bg-slate-900/90">
        <TopNavMenu currentPage={currentPage} onNavigate={onNavigate} currentUser={currentUser} />
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Change Account Password</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Update security credentials for {currentUser?.uid || 'user'}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-500 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
              {pwdError && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{pwdError}</span>
                </div>
              )}

              {pwdSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>New Password</span>
                  <span className="text-[10px] text-slate-400">Min 4 characters</span>
                </label>
                <div className="relative">
                  <input
                    type={showPwdText ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden transition-all pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwdText(!showPwdText)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showPwdText ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Confirm New Password
                </label>
                <input
                  type={showPwdText ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new password..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden transition-all"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingPwd}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-5 py-2 text-xs font-bold shadow-md hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isUpdatingPwd ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
