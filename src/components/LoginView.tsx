import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ChevronRight, 
  Factory, 
  CheckCircle2, 
  ShieldAlert,
  Building2,
  Users,
  Loader2
} from 'lucide-react';
import { UserRecord } from './UserManagementView';
import { GasClient } from '../lib/gasClient';
import { FirestoreSyncService } from '../lib/firestoreSync';
import { auth } from '../lib/firebase';
import { 
  signInAnonymously, 
  updateProfile, 
  setPersistence, 
  browserLocalPersistence 
} from 'firebase/auth';

interface LoginViewProps {
  onLoginSuccess: (user: UserRecord) => void;
  inactivityNotice?: string | null;
}

// Default fallback users if localStorage has not been populated yet
const DEFAULT_USERS: UserRecord[] = [
  {
    id: 'usr-1',
    userName: 'Md. Raihan Hossain Antu',
    userType: 'Admin',
    designation: 'Senior Manager',
    uid: 'EKL001',
    password: 'Password@2026',
    department: 'Knitting',
    assignedUnits: ['EKL', 'EFL', 'Auto Stripe'],
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
    permission: 'Read',
    status: 'Active',
    lastUpdated: '2026-07-13 09:10 AM'
  }
];

export default function LoginView({ onLoginSuccess, inactivityNotice }: LoginViewProps) {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRoster, setUserRoster] = useState<UserRecord[]>(DEFAULT_USERS);
  const [activeTab, setActiveTab] = useState<'form' | 'demo'>('form');

  // Load user directory directly from Firebase Firestore
  useEffect(() => {

    const loadUsersFromFirestore = async () => {
      try {
        const firestoreUsers = await FirestoreSyncService.fetchUsers();
        if (firestoreUsers && firestoreUsers.length > 0) {
          setUserRoster(firestoreUsers as UserRecord[]);
        }
      } catch (e) {
        console.warn("Could not fetch user directory from Firestore on init:", e);
      }
    };
    loadUsersFromFirestore();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!uid.trim()) {
      setError("Please enter your unique Login ID (UID).");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setLoading(true);

    try {
      // Direct live verification against Firebase Firestore
      const liveUsers = await FirestoreSyncService.fetchUsers();
      const currentRoster = (liveUsers && liveUsers.length > 0) ? liveUsers : userRoster;

      const match = currentRoster.find(
        (user: any) => user.uid && user.uid.toString().trim().toUpperCase() === uid.trim().toUpperCase()
      );

      if (!match) {
        setError(`Access Denied: UID "${uid.trim().toUpperCase()}" was not found in Firebase User Directory.`);
        setLoading(false);
        return;
      }

      if (match.status === 'Inactive') {
        setError("Authorization Failed: This user account has been disabled. Please contact your system administrator.");
        setLoading(false);
        return;
      }

      // Check password if set on user record
      if (match.password && match.password !== password) {
        setError("Access Denied: Invalid account password provided.");
        setLoading(false);
        return;
      }

      // Establish Firebase Authentication session with browser persistence
      try {
        await setPersistence(auth, browserLocalPersistence);
        let fbUser = auth.currentUser;
        if (!fbUser) {
          const cred = await signInAnonymously(auth);
          fbUser = cred.user;
        }
        if (fbUser) {
          await updateProfile(fbUser, { displayName: match.uid.trim().toUpperCase() });
        }
        // Establish secure HTTP-only session cookie
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: match.uid.trim().toUpperCase() })
        }).catch(() => {});
      } catch (authErr) {
        console.warn("Firebase Auth persistence sync warning:", authErr);
      }

      // Successful Authenticated Session directly via Firebase Firestore & Auth
      setSuccess(`Welcome back, ${match.userName}! Authenticated live via Firebase.`);

      setTimeout(() => {
        onLoginSuccess(match as UserRecord);
      }, 500);
    } catch (err: any) {
      console.error("Firestore authentication failure:", err);
      // Fallback check against local roster state
      const match = userRoster.find(
        user => user.uid.trim().toUpperCase() === uid.trim().toUpperCase()
      );
      if (match) {
        if (match.status === 'Inactive') {
          setError("Authorization Failed: This user account has been disabled.");
          setLoading(false);
          return;
        }
        if (match.password && match.password !== password) {
          setError("Access Denied: Invalid account password provided.");
          setLoading(false);
          return;
        }

        // Establish Firebase Authentication session
        try {
          await setPersistence(auth, browserLocalPersistence);
          let fbUser = auth.currentUser;
          if (!fbUser) {
            const cred = await signInAnonymously(auth);
            fbUser = cred.user;
          }
          if (fbUser) {
            await updateProfile(fbUser, { displayName: match.uid.trim().toUpperCase() });
          }
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: match.uid.trim().toUpperCase() })
          }).catch(() => {});
        } catch (authErr) {
          console.warn("Firebase Auth persistence sync warning:", authErr);
        }

        setSuccess(`Welcome back, ${match.userName}! Access granted.`);
        setTimeout(() => {
          onLoginSuccess(match);
        }, 500);
        return;
      }
      setError(`Authentication Error: Unable to verify credentials with Firebase.`);
      setLoading(false);
    }
  };

  const handleQuickLogin = async (user: UserRecord) => {
    if (user.status === 'Inactive') {
      setError(`Account for ${user.userName} is currently set to Inactive. Modify status in User Management first.`);
      return;
    }
    setUid(user.uid);
    setPassword(user.password || 'Password@2026');
    setError(null);
    setSuccess(`Welcome back, ${user.userName}! Authenticating session with Firebase...`);
    setLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);
      let fbUser = auth.currentUser;
      if (!fbUser) {
        const cred = await signInAnonymously(auth);
        fbUser = cred.user;
      }
      if (fbUser) {
        await updateProfile(fbUser, { displayName: user.uid.trim().toUpperCase() });
      }
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: user.uid.trim().toUpperCase() })
      }).catch(() => {});
    } catch (authErr) {
      console.warn("Firebase Auth persistence sync warning:", authErr);
    }

    setTimeout(() => {
      onLoginSuccess(user);
    }, 400);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B132B] px-4 py-12 relative overflow-hidden transition-colors duration-300">
      
      {/* Visual decorative background mesh */}
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#0F4C81]/10 dark:bg-sky-500/5 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-emerald-500/10 dark:bg-emerald-500/5 blur-3xl" />

      {/* Main card box container */}
      <div className="w-full max-w-5xl bg-white dark:bg-[#111A34] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl z-10 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px] transition-all">
        
        {/* Left Side: Editorial Banner & Context */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0F4C81] to-[#1D2D50] text-white p-8 flex flex-col justify-between relative overflow-hidden">
          
          {/* Subtle logo background icon */}
          <div className="absolute -right-16 -bottom-16 text-white/5 pointer-events-none">
            <Factory className="h-64 w-64" />
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center font-black text-white text-lg tracking-wider">
                EKL
              </div>
              <div>
                <span className="block font-black text-sm uppercase tracking-widest text-sky-300">Epyllion Group</span>
                <span className="block text-[11px] font-bold text-white/70 uppercase tracking-widest">Knitwear Manufacturing Division</span>
              </div>
            </div>

            <div className="space-y-2 pt-6">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none text-white">
                Knitting Performance
              </h1>
              <p className="text-xs text-sky-200 uppercase tracking-widest font-black">
                SYSTEM ADMINISTRATION PANEL
              </p>
            </div>

            <p className="text-xs text-white/80 leading-relaxed font-medium">
              Secure single sign-on for shift supervisors, corporate executives, and system administrators. Log in to update production ledgers, view floor-level metrics, and export compliance audit rosters.
            </p>
          </div>

          <div className="pt-8 border-t border-white/10 space-y-3.5">
            <div className="flex items-center gap-3 text-xs font-semibold text-white/90">
              <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Enterprise Active Directory Sync Active</span>
            </div>
            
            <div className="text-[10px] text-white/60 uppercase tracking-wider font-bold">
              SYSTEM PORTAL v1.0 • EPYLLION KNITEX LTD.
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Login Form & Account Switcher */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white dark:bg-[#111A34]">
          <div>
            {/* Tab selection header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className={`text-sm font-black pb-3 transition-all relative cursor-pointer uppercase tracking-wider ${
                    activeTab === 'form' 
                      ? 'text-[#0F4C81] dark:text-sky-400 border-b-2 border-[#0F4C81] dark:border-sky-400' 
                      : 'text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Credential Login
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('demo')}
                  className={`text-sm font-black pb-3 transition-all relative cursor-pointer uppercase tracking-wider ${
                    activeTab === 'demo' 
                      ? 'text-[#0F4C81] dark:text-sky-400 border-b-2 border-[#0F4C81] dark:border-sky-400' 
                      : 'text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Demo Directory ({userRoster.length})
                </button>
              </div>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded">
                SECURE SSL
              </span>
            </div>

            {/* Error, Inactivity & Success Alert Bars */}
            {inactivityNotice && (
              <div className="mb-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5 shadow-sm">
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-black block uppercase tracking-wider text-[11px] text-amber-900 dark:text-amber-200">
                    Session Inactivity Timeout
                  </span>
                  <span className="font-medium leading-relaxed">{inactivityNotice}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 p-3.5 text-xs text-red-600 dark:text-red-400 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-semibold">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3.5 text-xs text-[#16A34A] dark:text-emerald-400 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-bold">{success}</span>
              </div>
            )}

            {activeTab === 'form' ? (
              /* Credential Form tab */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                    Sign In to Your Workspace
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-400 font-medium">
                    Please use your active factory UID and password credentials.
                  </p>
                </div>

                {/* UID Input */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                    LOGIN UNIQUE ID (UID) *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. EKL001"
                      value={uid}
                      onChange={(e) => setUid(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 py-2.5 pl-10 pr-3.5 text-xs font-bold text-slate-800 dark:text-slate-100 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden uppercase"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black text-gray-400 dark:text-slate-400 uppercase tracking-wider">
                      PASSWORD *
                    </label>
                    <span className="text-[10px] text-[#0F4C81] dark:text-sky-400 hover:underline cursor-pointer font-bold uppercase">
                      Forgot Password?
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 py-2.5 pl-10 pr-10 text-xs font-bold text-slate-800 dark:text-slate-100 transition-all focus:border-[#0F4C81] focus:bg-white dark:focus:bg-slate-900 focus:outline-hidden"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit button with full feedback & pulse styling */}
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full inline-flex items-center justify-center gap-2.5 rounded-xl text-white py-3 px-4 text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-98 disabled:cursor-not-allowed pt-2.5 pb-2.5 cursor-pointer mt-4 relative overflow-hidden ${
                    loading 
                      ? 'bg-slate-600 dark:bg-slate-800 border border-slate-500/30' 
                      : 'bg-[#0F4C81] hover:bg-[#0b3b64]'
                  }`}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-sky-400 shrink-0" />
                      <span className="animate-pulse tracking-widest text-slate-100">Verifying Credentials...</span>
                      <span className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#0F4C81] via-sky-400 to-[#0F4C81] animate-pulse w-full" />
                    </>
                  ) : (
                    <>
                      <span>Secure Authorize Portal</span>
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Demo Switcher Tab */
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-[#0F4C81]" />
                    <span>Active Directory Simulation</span>
                  </h2>
                  <p className="text-xs text-gray-400 dark:text-slate-400 font-medium">
                    Evaluate system views under different authorization privileges. Click any active profile below to auto-fill.
                  </p>
                </div>

                {/* Profiles grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {userRoster.map(user => (
                    <div
                      key={user.id}
                      onClick={() => handleQuickLogin(user)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-all hover:shadow-md flex flex-col justify-between gap-2 group relative overflow-hidden ${
                        user.status === 'Inactive'
                          ? 'border-red-100 bg-red-50/20 opacity-60 cursor-not-allowed dark:border-red-950/20'
                          : 'border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40 hover:border-blue-300 dark:hover:border-sky-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5">
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                            user.userType === 'Admin'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                              : 'bg-blue-100 dark:bg-blue-950 text-[#0F4C81] dark:text-sky-400'
                          }`}>
                            {user.userType}
                          </span>
                          <span className="font-mono text-[9px] font-bold text-gray-400 group-hover:text-[#0F4C81] dark:group-hover:text-sky-400">
                            {user.uid}
                          </span>
                        </div>
                        <h4 className="font-black text-slate-950 dark:text-slate-100 text-xs mt-1.5 truncate">
                          {user.userName}
                        </h4>
                        <span className="block text-[10px] text-gray-500 dark:text-slate-400 truncate">
                          {user.designation} • {user.department}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800/50 pt-2 mt-1">
                        <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-sm ${
                          user.permission === 'Read / Write' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-[#16A34A]' :
                          user.permission === 'Read' ? 'bg-blue-50 dark:bg-sky-950/30 text-[#0F4C81]' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'
                        }`}>
                          Perms: {user.permission}
                        </span>
                        
                        <span className="text-[9px] font-bold text-gray-400 group-hover:underline flex items-center gap-0.5">
                          Use UID
                          <ChevronRight className="h-2.5 w-2.5" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Institutional Compliance Disclaimer */}
          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 flex items-start gap-2.5 text-[10px] text-gray-400 dark:text-slate-500 leading-normal">
            <ShieldAlert className="h-4 w-4 shrink-0 text-[#0F4C81]" />
            <p className="font-semibold">
              Authorized access only. All activities are securely monitored and recorded. Unauthorized attempts will be reported immediately to Epyllion Group information security.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
