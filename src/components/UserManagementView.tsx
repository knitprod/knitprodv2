import React, { useState, useMemo, useEffect, useRef } from 'react';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { getBuyers } from '../lib/buyerStore';
import { 
  Users, 
  UserPlus, 
  Search, 
  RefreshCw, 
  Download, 
  Eye, 
  EyeOff, 
  Edit2, 
  Trash2, 
  X, 
  ChevronDown, 
  Check, 
  User, 
  Filter, 
  Lock, 
  Unlock, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertTriangle,
  Building2,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Minimize2,
  Maximize2,
  Globe,
  Mail,
  Phone,
  Shield,
  KeyRound,
  Bell,
  Sliders,
  Calendar,
  MapPin,
  Loader2,
  Info,
  ShoppingBag,
  LayoutGrid
} from 'lucide-react';

// Define TS Interfaces according to specifications
export interface UserRecord {
  id: string;
  userName: string;
  userType: 'Admin' | 'General';
  designation: string;
  uid: string;
  password?: string;
  department: 'Knitting' | 'Dyeing' | 'Finishing';
  assignedUnits: string[]; // e.g. ['EKL', 'EFL']
  assignedBuyers?: string[]; // e.g. ['Marks & Spencer', 'H&M']
  permission: 'Read' | 'Read / Write' | 'Hide';
  status: 'Active' | 'Inactive';
  lastUpdated: string; // "YYYY-MM-DD HH:MM AM/PM"
  allowedTabs?: string[];
  tabPermissions?: Record<string, 'View Only' | 'Full Access' | 'No Access'>;
}

export const ALL_TABS = [
  'Dashboard',
  'Production Ledger',
  'Floor Dashboard',
  'Management Dashboard',
  'Reports',
  'Plan Order Followup',
  'Buyer Plan vs Actual',
  'Yarn Allocation',
  'Delivery Schedule',
  'User Management',
  'Database Connection',
  'Settings'
];

export const getTabEmoji = (tabName: string): string => {
  switch (tabName) {
    case 'Dashboard': return '📊';
    case 'Production Ledger': return '📋';
    case 'Floor Dashboard': return '🏭';
    case 'Management Dashboard': return '📈';
    case 'Reports': return '📑';
    case 'Plan Order Followup': return '🎯';
    case 'Buyer Plan vs Actual': return '🛍️';
    case 'Yarn Allocation': return '🧶';
    case 'Delivery Schedule': return '🚚';
    case 'User Management': return '👥';
    case 'Database Connection': return '⚡';
    case 'Settings': return '⚙️';
    default: return '📄';
  }
};

export const BUYER_OPTIONS = getBuyers();

// Designation options as provided in hierarchy
const DESIGNATIONS = [
  'General Manager (GM)',
  'Deputy General Manager (DGM)',
  'Assistant General Manager (AGM)',
  'Senior Manager',
  'Manager',
  'Deputy Manager',
  'Assistant Manager',
  'Senior Executive',
  'Executive',
  'Senior Officer',
  'Officer',
  'Assistant Officer'
];

// Department options
const DEPARTMENTS: Array<'Knitting' | 'Dyeing' | 'Finishing'> = ['Knitting', 'Dyeing', 'Finishing'];

// Available units
const AVAILABLE_UNITS = [
  'EKL',
  'EFL',
  'EFL-2',
  'Auto Stripe',
  'EFL-Extension',
  'ESL-Extension',
  'Sub-Contact'
];

// Default initial premium seed records
const DEFAULT_INITIAL_BUYERS = [
  'Marks & Spencer',
  'H&M',
  'C&A',
  'PUMA',
  'Zara',
  'Next',
  'Target',
  'Uniqlo',
  'G-Star',
  'Express',
  'Decathlon',
  'Wal-Mart'
];

export const INITIAL_USERS: UserRecord[] = [
  {
    id: 'usr-1',
    userName: 'Md. Raihan Hossain Antu',
    userType: 'Admin',
    designation: 'Senior Manager',
    uid: 'EKL001',
    password: 'Password@2026',
    department: 'Knitting',
    assignedUnits: ['EKL', 'EFL', 'Auto Stripe'],
    assignedBuyers: [...DEFAULT_INITIAL_BUYERS],
    permission: 'Read / Write',
    status: 'Active',
    lastUpdated: '2026-07-15 10:30 AM'
  },
  {
    id: 'usr-2',
    userName: 'Zahirul Islam',
    userType: 'Admin',
    designation: 'General Manager (GM)',
    uid: 'EKL002',
    password: 'GmKnitting99',
    department: 'Knitting',
    assignedUnits: ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension', 'Sub-Contact'],
    assignedBuyers: [...DEFAULT_INITIAL_BUYERS],
    permission: 'Read / Write',
    status: 'Active',
    lastUpdated: '2026-07-15 11:45 AM'
  },
  {
    id: 'usr-3',
    userName: 'Akil Zaman',
    userType: 'General',
    designation: 'Assistant Manager',
    uid: 'EKL003',
    password: 'AkilZaman#456',
    department: 'Knitting',
    assignedUnits: ['EKL', 'EFL-2'],
    assignedBuyers: ['Marks & Spencer', 'H&M', 'C&A', 'PUMA'],
    permission: 'Read',
    status: 'Active',
    lastUpdated: '2026-07-14 02:15 PM'
  },
  {
    id: 'usr-4',
    userName: 'Nasrin Akhter',
    userType: 'General',
    designation: 'Executive',
    uid: 'EKL004',
    password: 'NasrinDyeing@1',
    department: 'Dyeing',
    assignedUnits: ['EFL', 'Auto Stripe'],
    assignedBuyers: ['Zara', 'Next', 'Target', 'Uniqlo'],
    permission: 'Read',
    status: 'Active',
    lastUpdated: '2026-07-13 09:10 AM'
  },
  {
    id: 'usr-5',
    userName: 'Kamal Hossain',
    userType: 'General',
    designation: 'Deputy Manager',
    uid: 'EKL005',
    password: 'KamalFinish88',
    department: 'Finishing',
    assignedUnits: ['EFL-Extension', 'ESL-Extension'],
    assignedBuyers: ['G-Star', 'Express', 'Decathlon'],
    permission: 'Read / Write',
    status: 'Inactive',
    lastUpdated: '2026-07-12 04:30 PM'
  },
  {
    id: 'usr-6',
    userName: 'Rashedul Bari',
    userType: 'General',
    designation: 'Senior Officer',
    uid: 'EKL006',
    password: 'BariRashedul!',
    department: 'Knitting',
    assignedUnits: ['Auto Stripe'],
    assignedBuyers: ['Wal-Mart', 'PUMA', 'H&M'],
    permission: 'Read',
    status: 'Active',
    lastUpdated: '2026-07-11 11:00 AM'
  },
  {
    id: 'usr-7',
    userName: 'Taslima Begum',
    userType: 'General',
    designation: 'Officer',
    uid: 'EKL007',
    password: 'TaslimaDyeingSecret',
    department: 'Dyeing',
    assignedUnits: ['EFL-2'],
    assignedBuyers: ['Marks & Spencer', 'Zara'],
    permission: 'Hide',
    status: 'Inactive',
    lastUpdated: '2026-07-10 03:22 PM'
  }
];

export default function UserManagementView() {
  // ----------------------------------------------------
  // Persistent States - Firebase Firestore is primary source
  // ----------------------------------------------------
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);

  // Subscribe to Firebase Firestore in real-time
  useEffect(() => {

    // Seed initial users into Firebase Firestore if empty
    FirestoreSyncService.seedInitialUsersIfEmpty(INITIAL_USERS);

    // Real-time subscription to Firebase Firestore users
    const unsubscribe = FirestoreSyncService.subscribeToUsers((serverUsers) => {
      if (serverUsers && Array.isArray(serverUsers) && serverUsers.length > 0) {
        setUsers(serverUsers as UserRecord[]);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // ----------------------------------------------------
  // Interactive UI Elements & Feedback States
  // ----------------------------------------------------
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  
  // Track password visibility per user ID
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  // Global search input focus trigger
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ----------------------------------------------------
  // Search & Filter States
  // ----------------------------------------------------
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterUserType, setFilterUserType] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterAssignedUnit, setFilterAssignedUnit] = useState<string>('all');
  const [filterPermission, setFilterPermission] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // ----------------------------------------------------
  // Pagination States
  // ----------------------------------------------------
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState<number>(25);

  // ----------------------------------------------------
  // Dialog / Popup Form States
  // ----------------------------------------------------
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [popupMode, setPopupMode] = useState<'add' | 'edit'>('add');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Popup Window State Controls
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4>(1);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields - Tab 1: Employee Information
  const [formName, setFormName] = useState('');
  const [formUid, setFormUid] = useState('');
  const [formDepartment, setFormDepartment] = useState<'Knitting' | 'Dyeing' | 'Finishing'>('Knitting');
  const [formDesignation, setFormDesignation] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formType, setFormType] = useState<'Admin' | 'General'>('General');

  // Form Fields - Tab 2: Contact Details
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('Dhaka');
  const [formCountry, setFormCountry] = useState('Bangladesh');

  // Form Fields - Tab 2: Access & Permissions
  const [formPermission, setFormPermission] = useState<'Read' | 'Read / Write' | 'Hide'>('Read');
  const [formAssignedUnits, setFormAssignedUnits] = useState<string[]>([]);
  const [formAssignedBuyers, setFormAssignedBuyers] = useState<string[]>([]);
  const [formAllowedTabs, setFormAllowedTabs] = useState<string[]>([]);
  const [formTabPermissions, setFormTabPermissions] = useState<Record<string, 'View Only' | 'Full Access' | 'No Access'>>({});

  // Form Fields - Tab 3: Credentials & Security
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formConfirmPassword, setFormConfirmPassword] = useState('');
  const [formForceReset, setFormForceReset] = useState(false);
  const [form2FA, setForm2FA] = useState(false);

  // Real-time password strength score (0-4)
  const passwordStrength = useMemo(() => {
    let score = 0;
    if (!formPassword) return 0;
    if (formPassword.length >= 6) score += 1;
    if (formPassword.length >= 10) score += 1;
    if (/[A-Z]/.test(formPassword) && /[0-9]/.test(formPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(formPassword)) score += 1;
    return score;
  }, [formPassword]);

  // Form Fields - Tab 4: Preferences & Notifications
  const [formLanguage, setFormLanguage] = useState('English');
  const [formTimezone, setFormTimezone] = useState('Asia/Dhaka (GMT+6)');
  const [formEmailNotif, setFormEmailNotif] = useState(true);
  const [formSmsAlerts, setFormSmsAlerts] = useState(false);
  const [formNotifFreq, setFormNotifFreq] = useState('Real-time');
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');

  // Popup validation error states per tab
  const [formError, setFormError] = useState<string | null>(null);
  const [tabErrors, setTabErrors] = useState<{ 1?: string; 2?: string; 3?: string; 4?: string }>({});

  // Custom visual multi-select search input inside popup for Units & Buyers
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [isBuyerDropdownOpen, setIsBuyerDropdownOpen] = useState(false);
  const buyerDropdownRef = useRef<HTMLDivElement>(null);

  // Dynamic Buyers list state from central store
  const [buyersList, setBuyersList] = useState<string[]>(() => getBuyers());

  useEffect(() => {
    const handleBuyersUpdate = (e: Event) => {
      const customEv = e as CustomEvent<any>;
      if (customEv.detail && Array.isArray(customEv.detail)) {
        setBuyersList(customEv.detail);
      } else if (customEv.detail && Array.isArray(customEv.detail.buyers)) {
        setBuyersList(customEv.detail.buyers);
      } else {
        setBuyersList(getBuyers());
      }
    };
    window.addEventListener('buyers_updated', handleBuyersUpdate);
    return () => window.removeEventListener('buyers_updated', handleBuyersUpdate);
  }, []);

  // Form Password eyes
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [showFormConfirmPassword, setShowFormConfirmPassword] = useState(false);

  // Delete Confirmation Dialog state
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // User Full Details Modal State
  const [viewingDetailUser, setViewingDetailUser] = useState<UserRecord | null>(null);
  const [showDetailPassword, setShowDetailPassword] = useState(false);

  // ----------------------------------------------------
  // Dynamic Helpers
  // ----------------------------------------------------
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const getFormattedDateTime = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const formattedHours = String(hours).padStart(2, '0');

    return `${yyyy}-${mm}-${dd} ${formattedHours}:${minutes} ${ampm}`;
  };

  // Close unit/buyer dropdowns if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
      if (buyerDropdownRef.current && !buyerDropdownRef.current.contains(event.target as Node)) {
        setIsBuyerDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleBuyerSelection = (buyer: string) => {
    setFormAssignedBuyers(prev => 
      prev.includes(buyer) ? prev.filter(b => b !== buyer) : [...prev, buyer]
    );
  };

  const filteredAvailableBuyersInForm = useMemo(() => {
    return buyersList.filter(buyer => 
      buyer.toLowerCase().includes(buyerSearchQuery.toLowerCase())
    );
  }, [buyersList, buyerSearchQuery]);

  // ----------------------------------------------------
  // Actions: Add / Edit / Delete / Export / Refresh
  // ----------------------------------------------------
  const handleFocusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
      // Highlight the input temporarily
      searchInputRef.current.classList.add('ring-2', 'ring-blue-500');
      setTimeout(() => {
        searchInputRef.current?.classList.remove('ring-2', 'ring-blue-500');
      }, 1000);
    }
    showToast("Global Search focused. Type to filter records.", "info");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (GasClient.getDatabaseMode() === 'gas') {
      try {
        const serverUsers = await GasClient.fetchUsers();
        if (serverUsers && Array.isArray(serverUsers)) {
          setUsers(serverUsers);
        }
      } catch (err: any) {
        showToast(`Sync warning: ${err.message || 'Failed to sync with Google Sheets.'}`, 'error');
      }
    }
    setGlobalSearch('');
    setFilterUserType('all');
    setFilterDepartment('all');
    setFilterAssignedUnit('all');
    setFilterPermission('all');
    setFilterStatus('all');
    setCurrentPage(1);
    setIsRefreshing(false);
    showToast("User Management Ledger refreshed successfully.", "success");
  };

  const togglePasswordVisibility = (userId: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleToggleStatus = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    const nextStatus = targetUser.status === 'Active' ? 'Inactive' : 'Active';
    const updatedUser: UserRecord = {
      ...targetUser,
      status: nextStatus as 'Active' | 'Inactive',
      lastUpdated: getFormattedDateTime()
    };

    if (GasClient.getDatabaseMode() === 'gas') {
      try {
        await GasClient.updateUser(updatedUser);
        showToast(`Updated ${targetUser.userName} status to ${nextStatus} in Google Sheets`, 'success');
      } catch (err: any) {
        showToast(`Failed to update status in Google Sheets: ${err.message}`, 'error');
        return;
      }
    }

    setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
    if (GasClient.getDatabaseMode() !== 'gas') {
      showToast(`User ${targetUser.userName} status set to ${nextStatus}`, 'info');
    }
  };

  const handleOpenAddModal = () => {
    setPopupMode('add');
    setEditingUserId(null);
    setFormError(null);
    setTabErrors({});
    setActiveTab(1);
    setIsMinimized(false);
    setIsMaximized(false);
    
    // Clear all fields
    setFormName('');
    setFormType('General');
    setFormDesignation('');
    setFormUid('');
    
    setFormEmail('');
    setFormPhone('');
    setFormAddress('');
    setFormCity('Dhaka');
    setFormCountry('Bangladesh');

    setFormPermission('Read');
    setFormDepartment('Knitting');
    setFormAssignedUnits([]);
    setFormAssignedBuyers([...buyersList]);
    setFormAllowedTabs(Array.from(new Set(ALL_TABS)));
    const initialAddPerms: Record<string, 'View Only' | 'Full Access' | 'No Access'> = {};
    ALL_TABS.forEach(t => {
      initialAddPerms[t] = 'View Only';
    });
    setFormTabPermissions(initialAddPerms);
    
    setFormUsername('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormForceReset(false);
    setForm2FA(false);

    setFormLanguage('English');
    setFormTimezone('Asia/Dhaka (GMT+6)');
    setFormEmailNotif(true);
    setFormSmsAlerts(false);
    setFormNotifFreq('Real-time');
    setFormStatus('Active');
    
    setShowFormPassword(false);
    setShowFormConfirmPassword(false);
    setIsPopupOpen(true);
  };

  const handleOpenEditModal = (user: UserRecord) => {
    setPopupMode('edit');
    setEditingUserId(user.id);
    setFormError(null);
    setTabErrors({});
    setActiveTab(1);
    setIsMinimized(false);
    setIsMaximized(false);

    // Populate field values
    setFormName(user.userName);
    setFormType(user.userType);
    setFormDesignation(user.designation);
    setFormUid(user.uid);

    setFormEmail(user.userName.toLowerCase().replace(/\s+/g, '.') + '@epylliongroup.com');
    setFormPhone('+8801700000000');
    setFormAddress('Epyllion Knitting Unit, Gazipur');
    setFormCity('Gazipur');
    setFormCountry('Bangladesh');

    setFormDepartment(user.department);
    setFormAssignedUnits([...user.assignedUnits]);
    setFormAssignedBuyers(user.assignedBuyers ? [...user.assignedBuyers] : [...buyersList]);
    setFormPermission(user.permission);
    const initialAllowed = user.allowedTabs || (user.userType === 'Admin' ? ALL_TABS : ALL_TABS.filter(t => t !== 'User Management'));
    setFormAllowedTabs(Array.from(new Set(initialAllowed)));

    const initialEditPerms: Record<string, 'View Only' | 'Full Access' | 'No Access'> = {};
    ALL_TABS.forEach(t => {
      if (user.tabPermissions && user.tabPermissions[t]) {
        initialEditPerms[t] = user.tabPermissions[t];
      } else if (initialAllowed.includes(t)) {
        initialEditPerms[t] = user.permission === 'Read / Write' ? 'Full Access' : 'View Only';
      } else {
        initialEditPerms[t] = 'No Access';
      }
    });
    setFormTabPermissions(initialEditPerms);

    setFormUsername(user.uid);
    setFormPassword(user.password || '');
    setFormConfirmPassword(user.password || '');
    setFormForceReset(false);
    setForm2FA(false);

    setFormLanguage('English');
    setFormTimezone('Asia/Dhaka (GMT+6)');
    setFormEmailNotif(true);
    setFormSmsAlerts(false);
    setFormNotifFreq('Real-time');
    setFormStatus(user.status);

    setShowFormPassword(false);
    setShowFormConfirmPassword(false);
    setIsPopupOpen(true);
  };

  const handleClearForm = () => {
    setFormName('');
    setFormUid('');
    setFormDesignation('');
    setFormEmail('');
    setFormPhone('');
    setFormUsername('');
    setFormPassword('');
    setFormConfirmPassword('');
    setFormAssignedUnits([]);
    setFormAllowedTabs([...ALL_TABS]);
    const clearPerms: Record<string, 'View Only' | 'Full Access' | 'No Access'> = {};
    ALL_TABS.forEach(t => {
      clearPerms[t] = 'View Only';
    });
    setFormTabPermissions(clearPerms);
    setFormError(null);
    setTabErrors({});
    showToast("Form fields cleared", "info");
  };

  const validateAllTabs = () => {
    const errors: { 1?: string; 2?: string; 3?: string; 4?: string } = {};

    // Tab 1 Validation: Employee Information
    if (!formName.trim() || formName.trim().length < 2) {
      errors[1] = "Full Name is required (at least 2 characters).";
    } else if (!formUid.trim()) {
      errors[1] = "Employee ID / UID is required.";
    } else if (!formDesignation) {
      errors[1] = "Designation is required.";
    }

    // Tab 2 Validation: Access & Permissions
    if (formAssignedUnits.length === 0) {
      errors[2] = "Please assign at least one manufacturing unit.";
    } else if (formAllowedTabs.length === 0) {
      errors[2] = "Please select at least one allowed tab/view.";
    }

    // Tab 3 Validation: Credentials & Security
    if (!formPassword) {
      errors[3] = "Password is required.";
    } else if (formPassword.length < 6) {
      errors[3] = "Password must be at least 6 characters long.";
    } else if (formPassword !== formConfirmPassword) {
      errors[3] = "Passwords do not match.";
    }

    setTabErrors(errors);
    return errors;
  };

  const handleTriggerSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFormError(null);

    const errors = validateAllTabs();
    const errorTabKeys = Object.keys(errors);

    if (errorTabKeys.length > 0) {
      const firstErrorTab = Number(errorTabKeys[0]) as any;
      setActiveTab(firstErrorTab);
      setFormError(errors[firstErrorTab as keyof typeof errors] || "Please resolve validation errors.");
      showToast("Please complete all required fields on highlighted tabs.", "error");
      return;
    }

    // Check unique UID (excluding current user when editing)
    const isUidTaken = users.some(u => u.uid.toUpperCase() === formUid.trim().toUpperCase() && u.id !== editingUserId);
    if (isUidTaken) {
      setTabErrors(prev => ({ ...prev, 1: `UID '${formUid.trim().toUpperCase()}' is already taken.` }));
      setActiveTab(1);
      return setFormError(`UID '${formUid.trim().toUpperCase()}' is already assigned to another user.`);
    }

    setIsSubmitting(true);

    // Simulate async API operation with timeout
    await new Promise(resolve => setTimeout(resolve, 600));

    const timestamp = getFormattedDateTime();

    if (popupMode === 'add') {
      const newUser: UserRecord = {
        id: `usr-${Date.now()}`,
        userName: formName.trim(),
        userType: formType,
        designation: formDesignation,
        uid: formUid.trim().toUpperCase(),
        password: formPassword,
        department: formDepartment,
        assignedUnits: [...formAssignedUnits],
        assignedBuyers: [...formAssignedBuyers],
        permission: formPermission,
        status: formStatus,
        lastUpdated: timestamp,
        allowedTabs: Array.from(new Set(formAllowedTabs)),
        tabPermissions: { ...formTabPermissions }
      };

      setUsers(prev => [newUser, ...prev.filter(u => u.uid.toUpperCase() !== newUser.uid.toUpperCase())]);
      setIsPopupOpen(false);

      try {
        await FirestoreSyncService.saveUser(newUser);
        showToast(`User registered & synced with Firebase & Google Sheets: ${newUser.userName}`, 'success');
      } catch (err: any) {
        showToast(`User saved locally, but sync error: ${err.message || 'Sync failed'}`, 'error');
      }
      setIsSubmitting(false);
    } else {
      const updatedUser: UserRecord = {
        id: editingUserId || `usr-${Date.now()}`,
        userName: formName.trim(),
        userType: formType,
        designation: formDesignation,
        uid: formUid.trim().toUpperCase(),
        password: formPassword,
        department: formDepartment,
        assignedUnits: [...formAssignedUnits],
        assignedBuyers: [...formAssignedBuyers],
        permission: formPermission,
        status: formStatus,
        lastUpdated: timestamp,
        allowedTabs: Array.from(new Set(formAllowedTabs)),
        tabPermissions: { ...formTabPermissions }
      };

      setUsers(prev => prev.map(u => (u.id === editingUserId || u.uid.toUpperCase() === updatedUser.uid.toUpperCase()) ? updatedUser : u));
      setIsPopupOpen(false);

      try {
        await FirestoreSyncService.saveUser(updatedUser);
        showToast(`Updated ${formName.trim()} in Firebase & Google Sheets`, 'success');
      } catch (err: any) {
        showToast(`Updated locally, but sync error: ${err.message || 'Sync failed'}`, 'error');
      }
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = (userId: string) => {
    setDeletingUserId(userId);
  };

  const executeDelete = async () => {
    if (!deletingUserId) return;
    const targetUser = users.find(u => u.id === deletingUserId);
    if (targetUser) {
      setUsers(prev => prev.filter(u => u.id !== deletingUserId));

      try {
        await FirestoreSyncService.deleteUser(targetUser.uid);
        showToast(`Deleted ${targetUser.userName} from Firebase & Google Sheets`, 'success');
      } catch (err: any) {
        showToast(`Deleted locally, but sync error: ${err.message}`, 'error');
      }
    }
    setDeletingUserId(null);
  };

  // Toggle unit selection in multi-select list
  const toggleUnitSelection = (unit: string) => {
    setFormAssignedUnits(prev => {
      if (prev.includes(unit)) {
        return prev.filter(u => u !== unit);
      } else {
        return [...prev, unit];
      }
    });
  };

  // ----------------------------------------------------
  // Filtering & Search Logic
  // ----------------------------------------------------
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Global Search matching
      const query = globalSearch.toLowerCase().trim();
      const matchesSearch = !query ? true : (
        user.userName.toLowerCase().includes(query) ||
        user.uid.toLowerCase().includes(query) ||
        user.designation.toLowerCase().includes(query) ||
        user.department.toLowerCase().includes(query) ||
        user.userType.toLowerCase().includes(query) ||
        user.permission.toLowerCase().includes(query) ||
        user.assignedUnits.some(unit => unit.toLowerCase().includes(query))
      );

      // Category filters
      const matchesUserType = filterUserType === 'all' || user.userType === filterUserType;
      const matchesDepartment = filterDepartment === 'all' || user.department === filterDepartment;
      const matchesPermission = filterPermission === 'all' || user.permission === filterPermission;
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
      
      const matchesAssignedUnit = filterAssignedUnit === 'all' || user.assignedUnits.includes(filterAssignedUnit);

      return matchesSearch && matchesUserType && matchesDepartment && matchesAssignedUnit && matchesPermission && matchesStatus;
    });
  }, [users, globalSearch, filterUserType, filterDepartment, filterAssignedUnit, filterPermission, filterStatus]);

  // Adjust pagination current page if filtered list shrinks
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [filteredUsers.length, usersPerPage, totalPages, currentPage]);

  // Paginated Slice
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * usersPerPage;
    return filteredUsers.slice(startIndex, startIndex + usersPerPage);
  }, [filteredUsers, currentPage, usersPerPage]);

  // ----------------------------------------------------
  // Export Users to spreadsheet (.xlsx formatted CSV)
  // ----------------------------------------------------
  const handleExportUsers = () => {
    if (filteredUsers.length === 0) {
      showToast("No filtered user records available to export.", "error");
      return;
    }

    // Build standard CSV representation
    const headers = [
      'User Name',
      'User Type',
      'Designation',
      'UID',
      'Password',
      'Department',
      'Assigned Units',
      'Permission',
      'Status',
      'Last Updated'
    ];

    const rows = filteredUsers.map(user => [
      `"${user.userName.replace(/"/g, '""')}"`,
      `"${user.userType}"`,
      `"${user.designation}"`,
      `"${user.uid}"`,
      `"${user.password || '********'}"`,
      `"${user.department}"`,
      `"${user.assignedUnits.join(' | ')}"`,
      `"${user.permission}"`,
      `"${user.status}"`,
      `"${user.lastUpdated}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Epyllion_Knitex_Users_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${filteredUsers.length} filtered user records to spreadsheet CSV.`, "success");
  };

  // Form unit list filtering
  const filteredAvailableUnitsInForm = AVAILABLE_UNITS.filter(unit => 
    unit.toLowerCase().includes(unitSearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="user-management-module-root">
      
      {/* Toast Notification HUD */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-black text-white shadow-xl animate-bounce border ${
          toastMessage.type === 'success' ? 'bg-[#16A34A] border-emerald-500' : 
          toastMessage.type === 'error' ? 'bg-[#DC2626] border-red-500' : 
          'bg-[#0F4C81] border-sky-600'
        }`}>
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Title & Subtitle Card */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 gap-4 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-[#0F4C81]/10 rounded-lg text-[#0F4C81] dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="font-sans text-xl font-black tracking-tight text-gray-900 dark:text-white">
              User Management
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 pl-1">
            Create, Edit and Manage System Users — Admin Panel for Manufacturing Authorization
          </p>
        </div>

        {/* Top Toolbar Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add User */}
          <button
            type="button"
            id="btn-add-user"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F4C81] hover:bg-[#0c3d68] text-white px-3.5 py-2 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>➕ Add User</span>
          </button>

          {/* Focus Search */}
          <button
            type="button"
            id="btn-focus-search"
            onClick={handleFocusSearch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 px-3 py-2 text-xs font-bold transition-all cursor-pointer"
          >
            <Search className="h-3.5 w-3.5" />
            <span>🔍 Search User</span>
          </button>

          {/* Refresh Action */}
          <button
            type="button"
            id="btn-refresh-users"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`inline-flex items-center gap-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-200 px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
              isRefreshing ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>🔄 Refresh</span>
          </button>

          {/* Export Action */}
          <button
            type="button"
            id="btn-export-users"
            onClick={handleExportUsers}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#16A34A] hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>📥 Export Users (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Advanced Search & Filtering Dashboard Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-gray-100 dark:border-slate-800 pb-3">
          <Filter className="h-4 w-4 text-[#0F4C81]" />
          <h3 className="font-sans text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider">
            Search Filter Control Desk
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3.5">
          {/* Global Search Bar */}
          <div className="col-span-1 md:col-span-2 relative">
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Global Search Box
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <Search className="h-3.5 w-3.5 text-gray-400" />
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search by Name, UID, Unit, Designation..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 py-1.5 pl-9 pr-3 text-xs font-semibold text-gray-700 dark:text-slate-100 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
              />
              {globalSearch && (
                <button
                  onClick={() => setGlobalSearch('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* User Type Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              User Type
            </label>
            <select
              value={filterUserType}
              onChange={(e) => {
                setFilterUserType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden cursor-pointer"
            >
              <option value="all">📁 All User Types</option>
              <option value="Admin">🔑 Admin Only</option>
              <option value="General">👤 General Only</option>
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Department
            </label>
            <select
              value={filterDepartment}
              onChange={(e) => {
                setFilterDepartment(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden cursor-pointer"
            >
              <option value="all">🏢 All Departments</option>
              <option value="Knitting">🧵 Knitting</option>
              <option value="Dyeing">🧪 Dyeing</option>
              <option value="Finishing">✨ Finishing</option>
            </select>
          </div>

          {/* Assigned Unit Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Assigned Unit
            </label>
            <select
              value={filterAssignedUnit}
              onChange={(e) => {
                setFilterAssignedUnit(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden cursor-pointer"
            >
              <option value="all">🏭 All Units</option>
              {AVAILABLE_UNITS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {/* Read/Write Permission Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Read / Write Permission
            </label>
            <select
              value={filterPermission}
              onChange={(e) => {
                setFilterPermission(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden cursor-pointer"
            >
              <option value="all">🔰 All Permissions</option>
              <option value="Read">🔷 Read Only</option>
              <option value="Read / Write">🟢 Read / Write</option>
              <option value="Hide">⚪ Hide</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Status Filter
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:text-slate-200 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden cursor-pointer"
            >
              <option value="all">⚡ All Statuses</option>
              <option value="Active">🟢 Active Only</option>
              <option value="Inactive">🔴 Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Clear Filter Toolbar shortcut */}
        {(globalSearch || filterUserType !== 'all' || filterDepartment !== 'all' || filterAssignedUnit !== 'all' || filterPermission !== 'all' || filterStatus !== 'all') && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-slate-800">
            <span className="text-[11px] font-bold text-gray-400">
              Active Filters found <span className="text-blue-600 dark:text-sky-400">{filteredUsers.length}</span> matching record(s).
            </span>
            <button
              onClick={() => {
                setGlobalSearch('');
                setFilterUserType('all');
                setFilterDepartment('all');
                setFilterAssignedUnit('all');
                setFilterPermission('all');
                setFilterStatus('all');
                showToast("All filters reset", "info");
              }}
              className="text-[11px] font-bold text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3 w-3" />
              <span>Clear Filter Presets</span>
            </button>
          </div>
        )}
      </div>

      {/* Main ERP Ledger Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col">
        
        {/* Sticky Table Wrapper */}
        <div className="overflow-x-auto" style={{ maxHeight: '600px' }}>
          <table className="w-full text-left border-collapse" id="user-ledger-datatable">
            
            {/* Sticky Table Header */}
            <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-xs">
              <tr className="text-[10px] font-black text-[#0F4C81] dark:text-slate-300 uppercase tracking-wider">
                <th className="px-4 py-3 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">User Name</th>
                <th className="px-4 py-3 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">User Type</th>
                <th className="px-4 py-3 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">Designation</th>
                <th className="px-4 py-3 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">Department</th>
                <th className="px-4 py-3 bg-slate-100 dark:bg-slate-800 whitespace-nowrap text-center">Status</th>
                <th className="px-4 py-3 bg-slate-100 dark:bg-slate-800 whitespace-nowrap">Last Updated</th>
                <th className="px-4 py-3 bg-slate-100 dark:bg-slate-800 whitespace-nowrap text-center">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-xs text-gray-700 dark:text-slate-300 font-medium">
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => {
                  return (
                    <tr 
                      key={user.id} 
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* User Name */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 text-[#0F4C81] dark:text-sky-400 flex items-center justify-center font-bold">
                            {user.userName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-black text-slate-900 dark:text-white text-xs">
                              {user.userName}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* User Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${
                          user.userType === 'Admin' 
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}>
                          {user.userType === 'Admin' ? '🔑 Admin' : '👤 General'}
                        </span>
                      </td>

                      {/* Designation */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {user.designation}
                        </span>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          {user.department}
                        </span>
                      </td>

                      {/* Status Toggle Switch */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(user.id)}
                            className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
                            style={{ backgroundColor: user.status === 'Active' ? '#16A34A' : '#94A3B8' }}
                            title="Click to toggle status"
                          >
                            <span
                              className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                              style={{ transform: user.status === 'Active' ? 'translateX(16px)' : 'translateX(0px)' }}
                            />
                          </button>
                        </div>
                      </td>

                      {/* Last Updated */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono text-[10px] text-gray-500 dark:text-slate-400">
                          {user.lastUpdated}
                        </span>
                      </td>

                      {/* Eye Button for Full Profile Details */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setViewingDetailUser(user);
                            setShowDetailPassword(false);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F4C81] hover:bg-[#0c3d68] text-white text-[10px] font-black uppercase tracking-wider transition-all shadow-2xs cursor-pointer"
                          title="View Full User Profile & Access Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-12 px-4 text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="h-8 w-8 text-amber-500" />
                      <span className="font-black text-gray-600 dark:text-slate-400 text-sm">No Matching Users Found</span>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                        Adjust your search query or reset the filter dropdowns to show records.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sticky Table Footer / Pagination Desk */}
        <div className="bg-slate-50 dark:bg-slate-850 px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Info Status text */}
          <div className="text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider text-center sm:text-left">
            Showing <span className="text-slate-900 dark:text-white font-black">{filteredUsers.length === 0 ? 0 : (currentPage - 1) * usersPerPage + 1}</span> to{' '}
            <span className="text-slate-900 dark:text-white font-black">
              {Math.min(currentPage * usersPerPage, filteredUsers.length)}
            </span> of{' '}
            <span className="text-[#0F4C81] dark:text-sky-400 font-black">{filteredUsers.length}</span> System Users
          </div>

          {/* Rows selector & controls */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Row limit selection */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
              <span className="uppercase">Rows per page:</span>
              <select
                value={usersPerPage}
                onChange={(e) => {
                  setUsersPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-0.5 font-bold text-gray-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              
              {/* Page Number Badges */}
              <div className="flex items-center gap-0.5">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
                  // Only display neighbors of current page if total pages is large
                  if (totalPages > 5 && Math.abs(pageNum - currentPage) > 1 && pageNum !== 1 && pageNum !== totalPages) {
                    if (pageNum === 2 || pageNum === totalPages - 1) {
                      return <span key={pageNum} className="px-1 text-gray-400 font-bold">...</span>;
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-6 w-6 rounded-md text-[10px] font-black flex items-center justify-center transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-[#0F4C81] text-white'
                          : 'bg-white border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-1 rounded-md border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-300 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* FLOATING MINIMIZED WIDGET */}
      {/* ========================================================== */}
      {isPopupOpen && isMinimized && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0F4C81] text-white px-4 py-3 rounded-2xl shadow-2xl border border-sky-400/30 flex items-center gap-3 animate-bounce">
          <div className="p-2 bg-white/10 rounded-xl">
            <Users className="h-5 w-5 text-sky-300" />
          </div>
          <div>
            <span className="block text-xs font-black">
              {popupMode === 'add' ? 'Registering User...' : 'Editing User Profile'}
            </span>
            <span className="block text-[10px] text-sky-200">
              {formName || 'Draft in Progress'} • Tab {activeTab} of 5
            </span>
          </div>
          <button
            onClick={() => setIsMinimized(false)}
            className="ml-2 bg-white/20 hover:bg-white/30 text-white p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            title="Expand Popup"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================== */}
      {/* ADD / EDIT USER DIALOG POPUP (5 CUSTOM TABS) */}
      {/* ========================================================== */}
      {isPopupOpen && !isMinimized && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
          <div 
            className={`bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${
              isMaximized ? 'w-[99vw] h-[96vh] max-w-none' : 'w-full max-w-4xl max-h-[92vh]'
            }`}
            style={{ borderRadius: '16px' }}
          >
            
            {/* 1. HEADER WITH POPUP CONTROLS & SHORTCUT HINTS */}
            <div className="bg-[#0F4C81] text-white px-6 py-4 flex items-center justify-between shrink-0 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-white/10 rounded-xl">
                  <Users className="h-5 w-5 text-sky-300 shrink-0" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans text-sm sm:text-base font-black uppercase tracking-wider truncate">
                      {popupMode === 'add' ? '➕ Register New User' : '✏ Edit User Records'}
                    </h3>
                    <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-sky-950/80 text-sky-300 px-2 py-0.5 rounded-md border border-sky-400/30">
                      Ctrl+S Save
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-200/90 truncate hidden sm:block">
                    {popupMode === 'add' ? 'Add new manufacturing account with customizable tabs & permissions' : `Modifying profile for ${formName || 'User'}`}
                  </p>
                </div>
              </div>

              {/* Popup Window Action Icons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMinimized(true)}
                  className="p-1.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Minimize Popup"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsMaximized(!isMaximized)}
                  className="p-1.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title={isMaximized ? "Restore Size" : "Maximize / Fullscreen"}
                >
                  <Maximize2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsPopupOpen(false)}
                  className="p-1.5 rounded-lg text-sky-200 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer ml-1"
                  title="Close (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* 2. CUSTOM TAB NAVIGATION BAR */}
            <div className="bg-slate-100 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 px-4 pt-3 flex items-center gap-1 overflow-x-auto shrink-0 scrollbar-none">
              {[
                { id: 1, label: 'Employee Info', icon: User, keyHint: 'Ctrl+1' },
                { id: 2, label: 'Access & Permissions', icon: Shield, keyHint: 'Ctrl+2' },
                { id: 3, label: 'Credentials', icon: KeyRound, keyHint: 'Ctrl+3' },
                { id: 4, label: 'Preferences', icon: Sliders, keyHint: 'Ctrl+4' },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const hasError = !!tabErrors[tab.id as keyof typeof tabErrors];

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive 
                        ? 'bg-white dark:bg-slate-900 text-[#0F4C81] dark:text-sky-400 shadow-sm border-t-2 border-[#0F4C81] dark:border-sky-400 font-black' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#0F4C81] dark:text-sky-400' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    
                    {/* Validation Error Dot Badge */}
                    {hasError && (
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Validation errors on this tab" />
                    )}

                    <span className="hidden md:inline-block text-[9px] text-slate-400 opacity-60 font-mono ml-1">
                      ({tab.keyHint})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 3. TAB CONTENT AREA */}
            <form onSubmit={handleTriggerSave} className="flex-1 overflow-y-auto p-6 space-y-5">
              
              {/* Validation Warning Summary Banner */}
              {formError && (
                <div className="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-600 p-3.5 rounded-r-xl flex items-start gap-3 shadow-xs">
                  <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider">
                      Validation Error on Tab {activeTab}
                    </span>
                    <p className="text-xs font-semibold text-red-600 dark:text-red-300 mt-0.5">
                      {formError}
                    </p>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* TAB 1: EMPLOYEE INFORMATION */}
              {/* =================================================== */}
              {activeTab === 1 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="font-sans text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Employee Identity & Hierarchy
                      </h4>
                      <p className="text-[11px] text-slate-400">Basic identification details for manufacturing credentials</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tab 1 of 4</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Employee Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Md. Raihan Hossain Antu"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
                      />
                    </div>

                    {/* Employee ID / UID */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Employee ID / UID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. EKL001"
                        value={formUid}
                        onChange={(e) => setFormUid(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* User Type / Role */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        User Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                      >
                        <option value="General">👤 General User</option>
                        <option value="Admin">🔑 Administrator</option>
                      </select>
                    </div>

                    {/* Department */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Department <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formDepartment}
                        onChange={(e) => setFormDepartment(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                      >
                        {DEPARTMENTS.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    {/* Designation */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Designation <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formDesignation}
                        onChange={(e) => setFormDesignation(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                      >
                        <option value="">-- Choose Designation --</option>
                        {DESIGNATIONS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* TAB 2: ACCESS & PERMISSIONS */}
              {/* =================================================== */}
              {activeTab === 2 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="font-sans text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Authorization & Workspace Permissions
                      </h4>
                      <p className="text-[11px] text-slate-400">Configure assigned manufacturing units, buyers, and visible dashboard tabs</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tab 2 of 4</span>
                  </div>

                  {/* Read/Write Level */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Permission Level <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formPermission}
                      onChange={(e) => setFormPermission(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                    >
                      <option value="Read">Read Only (View Dashboard & Reports)</option>
                      <option value="Read / Write">Read / Write (Add, Edit, Update production records)</option>
                      <option value="Hide">Hide (Restricted Access)</option>
                    </select>
                  </div>

                  {/* Searchable Multi-Select Units */}
                  <div className="space-y-2" ref={unitDropdownRef}>
                    <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Assigned Units <span className="text-red-500">*</span>
                    </label>

                    {/* Chips container */}
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[48px]">
                      {formAssignedUnits.length > 0 ? (
                        formAssignedUnits.map(unit => (
                          <span 
                            key={unit} 
                            className="inline-flex items-center gap-1.5 text-[10px] font-black bg-[#0F4C81] text-white pl-2.5 pr-1.5 py-1 rounded-lg shadow-xs"
                          >
                            <span>{unit}</span>
                            <button
                              type="button"
                              onClick={() => toggleUnitSelection(unit)}
                              className="hover:bg-white/20 text-sky-200 hover:text-white rounded-full p-0.5 transition-colors cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 self-center">
                          No units assigned. Select from dropdown below.
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                        className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <span>{formAssignedUnits.length} Unit(s) Selected</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isUnitDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isUnitDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 z-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-2 max-h-52 overflow-y-auto">
                          <input
                            type="text"
                            placeholder="Filter units..."
                            value={unitSearchQuery}
                            onChange={(e) => setUnitSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold focus:outline-hidden"
                          />
                          <div className="space-y-1">
                            {filteredAvailableUnitsInForm.map(unit => {
                              const isChecked = formAssignedUnits.includes(unit);
                              return (
                                <div
                                  key={unit}
                                  onClick={() => toggleUnitSelection(unit)}
                                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200"
                                >
                                  {isChecked ? (
                                    <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-300 shrink-0" />
                                  )}
                                  <span>{unit}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Searchable Multi-Select Buyers */}
                  <div className="space-y-2" ref={buyerDropdownRef}>
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                        Assigned Buyers
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setFormAssignedBuyers([...buyersList])}
                          className="text-[10px] font-bold text-[#0F4C81] dark:text-sky-400 hover:underline uppercase cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setFormAssignedBuyers([])}
                          className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline uppercase cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    {/* Chips container */}
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 min-h-[48px]">
                      {formAssignedBuyers.length > 0 ? (
                        formAssignedBuyers.map(buyer => (
                          <span 
                            key={buyer} 
                            className="inline-flex items-center gap-1.5 text-[10px] font-black bg-emerald-700 text-white pl-2.5 pr-1.5 py-1 rounded-lg shadow-xs"
                          >
                            <span>{buyer}</span>
                            <button
                              type="button"
                              onClick={() => toggleBuyerSelection(buyer)}
                              className="hover:bg-white/20 text-emerald-100 hover:text-white rounded-full p-0.5 transition-colors cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-semibold text-slate-400 self-center">
                          No buyers assigned (User won't see filtered buyer orders). Select from dropdown below.
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsBuyerDropdownOpen(!isBuyerDropdownOpen)}
                        className="w-full flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <span>{formAssignedBuyers.length} Buyer(s) Selected</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isBuyerDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>

                      {isBuyerDropdownOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 z-20 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 space-y-2 max-h-52 overflow-y-auto">
                          <input
                            type="text"
                            placeholder="Filter buyers..."
                            value={buyerSearchQuery}
                            onChange={(e) => setBuyerSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold focus:outline-hidden"
                          />
                          <div className="space-y-1">
                            {filteredAvailableBuyersInForm.map(buyer => {
                              const isChecked = formAssignedBuyers.includes(buyer);
                              return (
                                <div
                                  key={buyer}
                                  onClick={() => toggleBuyerSelection(buyer)}
                                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-200"
                                >
                                  {isChecked ? (
                                    <CheckSquare className="h-4 w-4 text-emerald-600 shrink-0" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-300 shrink-0" />
                                  )}
                                  <span>{buyer}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Select tabs and set permission levels (Matching User Screenshot Layout) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-medium text-xs">
                        <Info className="h-4 w-4 text-slate-500 shrink-0" />
                        <span>Select tabs and set permission levels</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setFormAllowedTabs([...ALL_TABS]);
                            const perms: Record<string, 'View Only' | 'Full Access' | 'No Access'> = {};
                            ALL_TABS.forEach(t => perms[t] = 'View Only');
                            setFormTabPermissions(perms);
                          }}
                          className="text-[10px] font-bold text-[#0F4C81] dark:text-sky-400 hover:underline uppercase cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => {
                            setFormAllowedTabs([]);
                            const perms: Record<string, 'View Only' | 'Full Access' | 'No Access'> = {};
                            ALL_TABS.forEach(t => perms[t] = 'No Access');
                            setFormTabPermissions(perms);
                          }}
                          className="text-[10px] font-bold text-red-600 dark:text-red-400 hover:underline uppercase cursor-pointer"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ALL_TABS.map((tab) => {
                        const isChecked = formAllowedTabs.includes(tab);
                        const permLevel = formTabPermissions[tab] || (isChecked ? 'View Only' : 'No Access');

                        const handleCheckboxToggle = () => {
                          if (isChecked) {
                            setFormAllowedTabs(prev => prev.filter(t => t !== tab));
                            setFormTabPermissions(prev => ({ ...prev, [tab]: 'No Access' }));
                          } else {
                            setFormAllowedTabs(prev => [...prev, tab]);
                            setFormTabPermissions(prev => ({ ...prev, [tab]: permLevel === 'No Access' ? 'View Only' : permLevel }));
                          }
                        };

                        const handleSelectChange = (newLevel: 'View Only' | 'Full Access' | 'No Access') => {
                          if (newLevel === 'No Access') {
                            setFormAllowedTabs(prev => prev.filter(t => t !== tab));
                            setFormTabPermissions(prev => ({ ...prev, [tab]: 'No Access' }));
                          } else {
                            if (!isChecked) {
                              setFormAllowedTabs(prev => [...prev, tab]);
                            }
                            setFormTabPermissions(prev => ({ ...prev, [tab]: newLevel }));
                          }
                        };

                        const getTabEmoji = (tabName: string) => {
                          switch (tabName) {
                            case 'Dashboard': return '📊';
                            case 'Production Ledger': return '📦';
                            case 'Floor Dashboard': return '🏭';
                            case 'Management Dashboard': return '📈';
                            case 'Reports': return '📈';
                            case 'Plan Order Followup': return '📋';
                            case 'Buyer Plan vs Actual': return '🛍️';
                            case 'Yarn Allocation': return '🧶';
                            case 'Delivery Schedule': return '🚚';
                            case 'User Management': return '👥';
                            case 'Database Connection': return '🗄️';
                            case 'Settings': return '⚙️';
                            default: return '🏬';
                          }
                        };

                        return (
                          <div
                            key={tab}
                            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-all ${
                              isChecked 
                                ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 shadow-2xs' 
                                : 'bg-slate-50/20 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800'
                            }`}
                          >
                            <div 
                              className="flex items-center gap-3 min-w-0 cursor-pointer select-none"
                              onClick={handleCheckboxToggle}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={handleCheckboxToggle}
                                className="h-4 w-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                              />
                              <span className="text-sm shrink-0">{getTabEmoji(tab)}</span>
                              <span className={`text-xs font-semibold truncate ${isChecked ? 'text-slate-800 dark:text-slate-100 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                                {tab}
                              </span>
                            </div>

                            <select
                              value={isChecked ? (permLevel === 'No Access' ? 'View Only' : permLevel) : 'No Access'}
                              onChange={(e) => handleSelectChange(e.target.value as any)}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-2xs focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer shrink-0"
                            >
                              <option value="View Only">View Only</option>
                              <option value="Full Access">Full Access</option>
                              <option value="No Access">No Access</option>
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* TAB 3: CREDENTIALS & SECURITY */}
              {/* =================================================== */}
              {activeTab === 3 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="font-sans text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        Login Credentials & Password Security
                      </h4>
                      <p className="text-[11px] text-slate-400">Set authentication passwords with real-time strength meter</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tab 3 of 4</span>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Username / Login UID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EKL001"
                      value={formUid}
                      onChange={(e) => setFormUid(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Password */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showFormPassword ? "text" : "password"}
                          required
                          placeholder="At least 6 characters..."
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormPassword(!showFormPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showFormPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Password Strength Meter Bar */}
                      {formPassword && (
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold">
                            <span className="text-slate-400">Strength:</span>
                            <span className={
                              passwordStrength <= 1 ? 'text-red-500' :
                              passwordStrength === 2 ? 'text-amber-500' :
                              passwordStrength === 3 ? 'text-blue-500' : 'text-emerald-500'
                            }>
                              {passwordStrength <= 1 ? 'Weak ⚠️' : passwordStrength === 2 ? 'Fair ⚡' : passwordStrength === 3 ? 'Good 👍' : 'Strong 🔒'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex gap-1">
                            <div className={`h-full flex-1 transition-all ${passwordStrength >= 1 ? (passwordStrength === 1 ? 'bg-red-500' : passwordStrength === 2 ? 'bg-amber-500' : passwordStrength === 3 ? 'bg-blue-500' : 'bg-emerald-500') : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 transition-all ${passwordStrength >= 2 ? (passwordStrength === 2 ? 'bg-amber-500' : passwordStrength === 3 ? 'bg-blue-500' : 'bg-emerald-500') : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 transition-all ${passwordStrength >= 3 ? (passwordStrength === 3 ? 'bg-blue-500' : 'bg-emerald-500') : 'bg-slate-200'}`} />
                            <div className={`h-full flex-1 transition-all ${passwordStrength >= 4 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Confirm Password <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showFormConfirmPassword ? "text" : "password"}
                          required
                          placeholder="Re-type password..."
                          value={formConfirmPassword}
                          onChange={(e) => setFormConfirmPassword(e.target.value)}
                          className={`w-full rounded-xl border bg-slate-50 dark:bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs font-mono font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden ${
                            formConfirmPassword && formPassword !== formConfirmPassword
                              ? 'border-red-500 text-red-600'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowFormConfirmPassword(!showFormConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showFormConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {formConfirmPassword && (
                        <p className={`text-[10px] font-bold mt-1.5 ${formPassword === formConfirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formPassword === formConfirmPassword ? '✓ Passwords match perfectly' : '✕ Passwords do not match'}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Security Toggles */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                      <div>
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Force Password Reset</span>
                        <span className="block text-[10px] text-slate-400">User must change password on next sign-in</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={formForceReset}
                        onChange={(e) => setFormForceReset(e.target.checked)}
                        className="h-4 w-4 rounded-md border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                      <div>
                        <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">Two-Factor Auth (2FA)</span>
                        <span className="block text-[10px] text-slate-400">Require OTP verification on login</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={form2FA}
                        onChange={(e) => setForm2FA(e.target.checked)}
                        className="h-4 w-4 rounded-md border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* =================================================== */}
              {/* TAB 4: PREFERENCES & NOTIFICATIONS */}
              {/* =================================================== */}
              {activeTab === 4 && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                    <div>
                      <h4 className="font-sans text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        System Preferences & Alert Subscriptions
                      </h4>
                      <p className="text-[11px] text-slate-400">Configure language, timezones, and alert preferences</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tab 4 of 4</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Language */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        System Language
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                        <select
                          value={formLanguage}
                          onChange={(e) => setFormLanguage(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-10 pr-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                        >
                          <option value="English">English (United States)</option>
                          <option value="Bengali">Bengali (বাংলা)</option>
                          <option value="Spanish">Spanish (Español)</option>
                          <option value="French">French (Français)</option>
                        </select>
                      </div>
                    </div>

                    {/* Timezone */}
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Timezone
                      </label>
                      <select
                        value={formTimezone}
                        onChange={(e) => setFormTimezone(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                      >
                        <option value="Asia/Dhaka (GMT+6)">Asia/Dhaka (GMT+6)</option>
                        <option value="UTC (GMT+0)">UTC (GMT+0)</option>
                        <option value="America/New_York (EST)">America/New_York (EST)</option>
                        <option value="Asia/Kolkata (GMT+5:30)">Asia/Kolkata (GMT+5:30)</option>
                      </select>
                    </div>
                  </div>

                  {/* Notification Toggles */}
                  <div className="space-y-3 pt-2">
                    <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Notification Channels
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <Mail className="h-4 w-4 text-[#0F4C81] dark:text-sky-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Email Alerts</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={formEmailNotif}
                          onChange={(e) => setFormEmailNotif(e.target.checked)}
                          className="h-4 w-4 rounded-md border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 cursor-pointer">
                        <div className="flex items-center gap-2.5">
                          <Bell className="h-4 w-4 text-[#0F4C81] dark:text-sky-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">SMS / Mobile Alerts</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={formSmsAlerts}
                          onChange={(e) => setFormSmsAlerts(e.target.checked)}
                          className="h-4 w-4 rounded-md border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Frequency & User Status */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Notification Frequency
                      </label>
                      <select
                        value={formNotifFreq}
                        onChange={(e) => setFormNotifFreq(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                      >
                        <option value="Real-time">Real-time Immediate</option>
                        <option value="Daily">Daily Summary</option>
                        <option value="Weekly">Weekly Summary</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                        Account Activation Status
                      </label>
                      <select
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-hidden cursor-pointer"
                      >
                        <option value="Active">🟢 Active (Access Enabled)</option>
                        <option value="Inactive">🔴 Inactive (Access Suspended)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

            </form>

            {/* 4. FOOTER CONTROLS & ACTIONS */}
            <div className="bg-slate-100 dark:bg-slate-850 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              
              {/* Keyboard Shortcut Hint */}
              <div className="text-[11px] font-bold text-slate-400 hidden md:block">
                <span>Shortcuts: </span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-md text-[10px] font-mono">Esc</kbd> Close
                <span className="mx-1.5">•</span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-md text-[10px] font-mono">Ctrl+S</kbd> Save
                <span className="mx-1.5">•</span>
                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-md text-[10px] font-mono">Ctrl+1..4</kbd> Switch Tab
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsPopupOpen(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleClearForm}
                  className="rounded-xl border border-amber-300 dark:border-amber-900/50 text-amber-600 dark:text-amber-400 px-4 py-2.5 text-xs font-bold hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors cursor-pointer"
                >
                  Clear Form
                </button>
                <button
                  type="button"
                  onClick={(e) => handleTriggerSave(e)}
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0F4C81] hover:bg-[#0c3d68] text-white px-6 py-2.5 text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-2 disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{popupMode === 'add' ? 'Save User' : 'Save Changes'}</span>
                  )}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* DELETE CONFIRMATION DIALOG */}
      {/* ========================================================== */}
      {deletingUserId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-950/40 rounded-xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-150 overflow-hidden">
            
            {/* Header banner */}
            <div className="bg-[#DC2626] text-white px-5 py-3.5 flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5" />
              <h3 className="font-sans text-xs font-black uppercase tracking-wider">
                Delete User Account Confirmation
              </h3>
            </div>

            {/* Content body */}
            <div className="p-5 space-y-4">
              <p className="text-xs font-bold text-gray-600 dark:text-slate-300 leading-relaxed">
                Are you sure you want to permanently delete this user?
              </p>
              
              {/* Highlight target */}
              {(() => {
                const target = users.find(u => u.id === deletingUserId);
                return target ? (
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-lg border border-gray-150 dark:border-slate-750 text-xs font-bold">
                    <span className="block text-[10px] text-gray-400 uppercase tracking-widest">Target User Details:</span>
                    <span className="block text-slate-900 dark:text-white mt-1">Name: {target.userName}</span>
                    <span className="block text-slate-500 mt-0.5 font-mono">UID: {target.uid} | Dept: {target.department}</span>
                  </div>
                ) : null;
              })()}

              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider bg-red-50 dark:bg-red-950/20 p-2.5 rounded-lg">
                ⚠️ Warning: This operation cannot be undone. All access authorization for this UID will be terminated immediately.
              </p>

              {/* Action desk */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeletingUserId(null)}
                  className="rounded-lg border border-gray-200 dark:border-slate-700 px-3.5 py-1.5 text-xs font-bold text-gray-500 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeDelete}
                  className="rounded-lg bg-[#DC2626] text-white hover:bg-red-700 px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* FULL USER DETAILS MODAL (OPENED VIA EYE BUTTON) */}
      {/* ========================================================== */}
      {viewingDetailUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-150 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#0F4C81] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-lg text-white">
                  {viewingDetailUser.userName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-sans text-sm font-black uppercase tracking-wider text-white">
                    {viewingDetailUser.userName}
                  </h3>
                  <p className="text-[11px] text-sky-200 font-medium">
                    {viewingDetailUser.designation} • {viewingDetailUser.department} Department
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingDetailUser(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto">
              
              {/* User General Info */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-750">
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">User Name</span>
                  <span className="block text-xs font-black text-slate-900 dark:text-white mt-0.5">
                    {viewingDetailUser.userName}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">User Type</span>
                  <span className={`inline-flex items-center gap-1 mt-0.5 text-xs font-black ${viewingDetailUser.userType === 'Admin' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
                    {viewingDetailUser.userType === 'Admin' ? '🔑 Admin User' : '👤 General User'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Designation</span>
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                    {viewingDetailUser.designation}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Department</span>
                  <span className="block text-xs font-black text-slate-800 dark:text-slate-100 mt-0.5">
                    {viewingDetailUser.department}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Account Status</span>
                  <span className={`inline-flex items-center gap-1 mt-0.5 text-xs font-black ${viewingDetailUser.status === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                    {viewingDetailUser.status === 'Active' ? '🟢 Active' : '🔴 Inactive'}
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] font-black uppercase tracking-wider text-slate-400">Last Updated</span>
                  <span className="block text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                    {viewingDetailUser.lastUpdated}
                  </span>
                </div>
              </div>

              {/* UID & Password Credentials */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-[#0F4C81]" />
                  <span>UID & Credentials</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">User UID</span>
                    <span className="block text-sm font-mono font-black text-slate-900 dark:text-white mt-1">
                      {viewingDetailUser.uid}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-750 bg-white dark:bg-slate-800 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Password</span>
                      <span className="block text-sm font-mono font-black text-slate-900 dark:text-white mt-1 tracking-wider">
                        {showDetailPassword ? (viewingDetailUser.password || '********') : '••••••••'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDetailPassword(!showDetailPassword)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 transition-colors cursor-pointer"
                      title={showDetailPassword ? "Hide password" : "Show password"}
                    >
                      {showDetailPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Assigned Manufacturing Units */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-[#0F4C81]" />
                  <span>Assigned Unit</span>
                </h4>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750">
                  {viewingDetailUser.assignedUnits && viewingDetailUser.assignedUnits.length > 0 ? (
                    viewingDetailUser.assignedUnits.map((unit) => (
                      <span
                        key={unit}
                        className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-slate-700 text-[#0F4C81] dark:text-sky-300 border border-blue-200 dark:border-slate-600 text-xs font-black"
                      >
                        {unit}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">No units assigned</span>
                  )}
                </div>
              </div>

              {/* Visible Workspace Tabs */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <LayoutGrid className="h-4 w-4 text-[#0F4C81]" />
                  <span>Visible Tabs ({viewingDetailUser.allowedTabs ? Array.from(new Set(viewingDetailUser.allowedTabs)).length : 0})</span>
                </h4>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 max-h-40 overflow-y-auto">
                  {viewingDetailUser.allowedTabs && viewingDetailUser.allowedTabs.length > 0 ? (
                    Array.from(new Set(viewingDetailUser.allowedTabs as string[])).map((tab: string, idx: number) => (
                      <span
                        key={`${tab}-${idx}`}
                        className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600 text-xs font-bold shadow-2xs flex items-center gap-1.5"
                      >
                        <span>{getTabEmoji(tab)}</span>
                        <span>{tab}</span>
                        {viewingDetailUser.tabPermissions && viewingDetailUser.tabPermissions[tab] && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {viewingDetailUser.tabPermissions[tab]}
                          </span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">Default workspace access enabled</span>
                  )}
                </div>
              </div>

              {/* Assigned Buyers */}
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShoppingBag className="h-4 w-4 text-[#0F4C81]" />
                  <span>
                    Assigned Buyers ({(viewingDetailUser.assignedBuyers && viewingDetailUser.assignedBuyers.length > 0) ? viewingDetailUser.assignedBuyers.length : buyersList.length})
                  </span>
                </h4>
                <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 max-h-36 overflow-y-auto">
                  {((viewingDetailUser.assignedBuyers && viewingDetailUser.assignedBuyers.length > 0)
                    ? viewingDetailUser.assignedBuyers
                    : buyersList
                  ).map((buyer) => (
                    <span
                      key={buyer}
                      className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-black"
                    >
                      {buyer}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="bg-slate-100 dark:bg-slate-800/80 px-6 py-4 border-t border-slate-200 dark:border-slate-750 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const targetUser = viewingDetailUser;
                    setViewingDetailUser(null);
                    handleOpenEditModal(targetUser);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F4C81] hover:bg-[#0c3d68] text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>Edit Button</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const targetId = viewingDetailUser.id;
                    setViewingDetailUser(null);
                    handleConfirmDelete(targetId);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Button</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setViewingDetailUser(null)}
                className="px-5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
              >
                Close Button
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
