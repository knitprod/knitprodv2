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
import { UserRecord, INITIAL_USERS } from './UserManagementView';
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

export default function LoginView({ onLoginSuccess, inactivityNotice }: LoginViewProps) {
  const [uid, setUid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userRoster, setUserRoster] = useState<UserRecord[]>(INITIAL_USERS);

  // Load user directory directly from Firebase Firestore or local persistent DB
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await FirestoreSyncService.fetchUsers();
        if (users && users.length > 0) {
          setUserRoster(users as UserRecord[]);
        } else {
          setUserRoster(INITIAL_USERS);
        }
      } catch (e) {
        setUserRoster(INITIAL_USERS);
      }
    };
    loadUsers();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const inputIdentifier = uid.trim();
    if (!inputIdentifier) {
      setError("Please enter your unique Login ID (UID).");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Direct live verification against Firebase Firestore / Server DB / Initial roster
      const liveUsers = await FirestoreSyncService.fetchUsers();
      const currentRoster = (liveUsers && liveUsers.length > 0) ? liveUsers : (userRoster.length > 0 ? userRoster : INITIAL_USERS);

      const cleanInput = inputIdentifier.toUpperCase();

      // Find by exact UID first, then by matching user name
      let match = currentRoster.find(
        (user: any) => user.uid && user.uid.toString().trim().toUpperCase() === cleanInput
      );

      if (!match) {
        match = currentRoster.find((user: any) => {
          const uName = (user.userName || '').toString().toUpperCase();
          const uId = (user.id || '').toString().toUpperCase();
          return uName.includes(cleanInput) || cleanInput.includes(uName) || uId === cleanInput;
        });
      }

      if (!match) {
        setError(`Access Denied: UID "${inputIdentifier}" was not found in the User Directory.`);
        setLoading(false);
        return;
      }

      if (match.status === 'Inactive') {
        setError("Authorization Failed: This user account has been deactivated. Please contact your system administrator.");
        setLoading(false);
        return;
      }

      // Check password
      if (match.password && match.password !== password) {
        setError("Access Denied: Invalid credentials provided. Please check your password.");
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

      // Successful Authenticated Session
      setSuccess(`Welcome back, ${match.userName}! Authenticated successfully.`);

      setTimeout(() => {
        onLoginSuccess(match as UserRecord);
      }, 400);
    } catch (err: any) {
      console.error("Authentication check error:", err);
      // Fallback check against local initial roster
      const cleanInput = inputIdentifier.toUpperCase();
      let match = INITIAL_USERS.find(
        user => user.uid.trim().toUpperCase() === cleanInput
      ) || INITIAL_USERS.find(
        user => user.userName.toUpperCase().includes(cleanInput)
      );

      if (match) {
        if (match.status === 'Inactive') {
          setError("Authorization Failed: This user account has been disabled.");
          setLoading(false);
          return;
        }
        if (match.password && match.password !== password) {
          setError("Access Denied: Invalid credentials provided. Please check your password.");
          setLoading(false);
          return;
        }

        setSuccess(`Welcome back, ${match.userName}! Access granted.`);
        setTimeout(() => {
          onLoginSuccess(match);
        }, 400);
        return;
      }

      setError("Authentication Error: Unable to verify credentials. Please check your UID.");
      setLoading(false);
    }
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

        {/* Right Side: Interactive Login Form */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white dark:bg-[#111A34]">
          <div>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
              <span className="text-xs font-black uppercase tracking-wider text-[#0F4C81] dark:text-sky-400">
                Authorized Personnel Login
              </span>
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
                <span className="font-semibold leading-relaxed">{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-3.5 text-xs text-[#16A34A] dark:text-emerald-400 flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="font-bold">{success}</span>
              </div>
            )}

            {/* Credential Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Sign In to Your Workspace
                </h2>
                <p className="text-xs text-gray-400 dark:text-slate-400 font-medium">
                  Please enter your factory UID and password credentials.
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
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase cursor-default">
                    Contact Admin For Reset
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

              {/* Submit button */}
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

