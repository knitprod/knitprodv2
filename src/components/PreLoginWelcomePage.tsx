import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowRight, 
  Activity, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Radio, 
  Lock,
  Sparkles,
  Server,
  BarChart3,
  Network,
  CalendarDays,
  Clock,
  Boxes,
  LayoutDashboard,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  RefreshCw
} from 'lucide-react';
import { OfficialEpyllionLogo } from './OfficialEpyllionLogo';
import LoginView from './LoginView';
import { UserRecord } from './UserManagementView';

interface PreLoginWelcomePageProps {
  onLoginSuccess: (user: UserRecord) => void;
  inactivityNotice?: string | null;
  defaultShowLoginForm?: boolean;
}

export const PreLoginWelcomePage: React.FC<PreLoginWelcomePageProps> = ({
  onLoginSuccess,
  inactivityNotice,
  defaultShowLoginForm = false
}) => {
  const [showLoginPanel, setShowLoginPanel] = useState(defaultShowLoginForm || !!inactivityNotice);
  const [activeTargetIndex, setActiveTargetIndex] = useState(0);

  // Cycle active packet highlights periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTargetIndex((prev) => (prev + 1) % 7);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  // 7 Destinations for Data Transfer from Knitting Engine
  const destinations = [
    {
      id: 'production',
      title: 'Production',
      subtitle: 'Floor & Frame Output',
      icon: Layers,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      badge: '50K Kg / Day'
    },
    {
      id: 'planning',
      title: 'Planning',
      subtitle: 'Shift Schedule & Routing',
      icon: CalendarDays,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      badge: 'Synced 100%'
    },
    {
      id: 'otd-update',
      title: 'OTD Update',
      subtitle: 'Real-time Delivery Milestones',
      icon: Clock,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/30',
      badge: '98.2% On-Time'
    },
    {
      id: 'yarn-allocations',
      title: 'Yarn Allocations',
      subtitle: 'Lot Matching & Balances',
      icon: Boxes,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      badge: '184 Lots Allocated'
    },
    {
      id: 'dashboards',
      title: 'Dashboards',
      subtitle: 'Executive Telemetry',
      icon: LayoutDashboard,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/30',
      badge: 'Live 24/7'
    },
    {
      id: 'decision-making',
      title: 'Decision Making',
      subtitle: 'AI Analytics & Bottlenecks',
      icon: BrainCircuit,
      color: 'text-teal-300',
      bg: 'bg-teal-500/10',
      border: 'border-teal-500/30',
      badge: 'Smart Assist'
    },
    {
      id: 'execution',
      title: 'Execution',
      subtitle: 'Floor Actions & Handover',
      icon: CheckCircle2,
      color: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      badge: 'Active Shifts'
    }
  ];

  return (
    <div 
      className="min-h-screen w-full bg-[#030712] text-slate-100 relative overflow-x-hidden font-sans selection:bg-emerald-500 selection:text-white flex flex-col justify-between"
      id="pre-login-welcome-page"
    >
      {/* 1. Atmospheric Dark Canvas with Industrial Grid */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Fine Digital Grid */}
        <div 
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #38BDF8 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Ambient Subtle Gradients */}
        <div className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full bg-emerald-600/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-48 w-[750px] h-[750px] rounded-full bg-blue-600/12 blur-[160px]" />
        <div className="absolute -bottom-40 left-1/3 w-[700px] h-[700px] rounded-full bg-teal-500/10 blur-[150px]" />

        {/* Fine Accent Lines */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-blue-500/25 to-transparent" />
      </div>

      {/* 2. Top Header Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 pt-6 pb-2 flex items-center justify-between">
        {/* Understated Live Telemetry Status */}
        <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-[11px] font-mono font-bold tracking-wider text-emerald-400 uppercase">
            ● SYSTEM ONLINE
          </span>
          <span className="text-slate-700 text-xs">•</span>
          <span className="text-[10px] font-medium tracking-wide text-slate-400 hidden sm:inline">
            Plant Telemetry Active
          </span>
        </div>

        {/* Header Right Action */}
        <button
          onClick={() => setShowLoginPanel((prev) => !prev)}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer shadow-sm hover:border-slate-600"
          id="top-signin-btn"
        >
          {showLoginPanel ? (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Back to Overview</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Personnel Portal</span>
            </>
          )}
        </button>
      </header>

      {/* 3. Primary Hero Section (Split Screen on Desktop) */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 py-6 sm:py-10 lg:py-12 flex-1 flex items-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch w-full">
          
          {/* ================= LEFT SIDE: BRAND & MESSAGE ================= */}
          <motion.div 
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 space-y-6 sm:space-y-7 text-left flex flex-col justify-center"
          >
            {/* 1. Official Company Logo - Enlarge prominently */}
            <div className="pt-2 pb-2">
              <OfficialEpyllionLogo 
                width={380}
                height={96}
                theme="dark"
                id="hero-official-logo"
                className="transform scale-105 sm:scale-110 origin-left"
              />
            </div>

            {/* 2. Company Name & Hierarchy */}
            <div className="space-y-3">
              <div>
                <span className="text-xs sm:text-sm font-black tracking-[0.25em] text-slate-400 uppercase">
                  EPYLLION KNITEX LTD.
                </span>
              </div>

              {/* 3. Main Headline */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[44px] font-black tracking-tight leading-[1.12] text-white">
                Where Production{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400">
                  Meets Intelligence.
                </span>
              </h1>
            </div>

            {/* 4. Supporting Message */}
            <div className="space-y-1.5 text-slate-300 text-base sm:text-lg font-medium leading-relaxed">
              <p className="font-semibold text-white/95">
                Plan smarter. Monitor faster.
              </p>
              <p className="text-slate-300">
                Make better decisions.
              </p>
            </div>

            {/* 5. Feature Line */}
            <div className="pt-0.5">
              <p className="text-xs sm:text-sm font-semibold tracking-wide text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="text-emerald-400 font-bold">Real-time production visibility</span>
                <span className="text-slate-600 font-bold">•</span>
                <span className="text-sky-300 font-bold">Floor performance</span>
                <span className="text-slate-600 font-bold">•</span>
                <span className="text-teal-300 font-bold">Smart analytics</span>
              </p>
            </div>

            {/* 6. Primary Action: Sign In Button & System Label */}
            <div className="pt-2 space-y-4">
              <div>
                <button
                  onClick={() => setShowLoginPanel(true)}
                  id="hero-signin-btn"
                  className="group relative inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 text-white font-bold text-base shadow-[0_4px_24px_rgba(16,185,129,0.3)] hover:shadow-[0_6px_32px_rgba(16,185,129,0.45)] hover:from-emerald-400 hover:to-teal-500 transition-all duration-200 cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0 border border-emerald-400/40"
                >
                  <span className="tracking-wide">Sign In</span>
                  <ArrowRight className="w-5 h-5 transition-transform duration-200 group-hover:translate-x-1.5 text-white" />
                </button>
              </div>

              {/* 7. Small Label */}
              <div>
                <p className="text-xs font-semibold italic tracking-wider text-slate-400">
                  Knitting Performance System
                </p>
              </div>
            </div>

            {/* Micro Industrial Highlights */}
            <div className="pt-5 border-t border-slate-800/80 grid grid-cols-3 gap-3 text-left">
              <div>
                <span className="block font-mono text-base sm:text-lg font-black text-white">218+</span>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Frames Synced</span>
              </div>
              <div>
                <span className="block font-mono text-base sm:text-lg font-black text-emerald-400">50K Kg</span>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Daily Output</span>
              </div>
              <div>
                <span className="block font-mono text-base sm:text-lg font-black text-sky-400">98.2%</span>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">OTD Target</span>
              </div>
            </div>
          </motion.div>

          {/* ================= RIGHT SIDE: DYNAMIC SLIDE-IN LOGIN OR INTELLIGENCE MATRIX ================= */}
          <div className="lg:col-span-7 relative w-full flex items-center min-h-[580px]">
            <AnimatePresence mode="wait">
              {showLoginPanel ? (
                /* ----------------- SLIDE-IN LOGIN VIEW FROM RIGHT ----------------- */
                <motion.div
                  key="login-panel"
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 60 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full relative"
                >
                  <div className="relative rounded-3xl border border-slate-800 bg-[#060D1E]/95 shadow-[0_24px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl overflow-hidden">
                    {/* Top Accent Line */}
                    <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />
                    
                    {/* Top Navigation / Toggle bar inside panel */}
                    <div className="px-6 pt-5 pb-2 flex items-center justify-between border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider">
                          Knitting Access Portal
                        </span>
                      </div>
                      <button
                        onClick={() => setShowLoginPanel(false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-colors"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>View System Flow</span>
                      </button>
                    </div>

                    {/* Integrated Login Component */}
                    <div className="p-2 sm:p-4">
                      <LoginView 
                        onLoginSuccess={onLoginSuccess}
                        inactivityNotice={inactivityNotice}
                        embedded={true}
                      />
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ----------------- PRODUCTION INTELLIGENCE & KNITTING ENGINE DATA TRANSFER ----------------- */
                <motion.div
                  key="intelligence-panel"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full relative"
                >
                  <div className="relative rounded-3xl border border-slate-800/90 bg-[#070E1F]/90 p-5 sm:p-7 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65)] overflow-hidden">
                    
                    {/* Top Accent Gradient Header Line */}
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500" />
                    
                    {/* Background Ambient Lights */}
                    <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

                    {/* Panel Header */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <Radio className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h2 className="text-xs font-black uppercase tracking-widest text-slate-200">
                            Production Intelligence Architecture
                          </h2>
                          <p className="text-[10px] font-mono text-emerald-400">
                            KNITTING ENGINE DATA DISPATCH MATRIX
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-400 flex items-center gap-1.5">
                          <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                          <span>STREAMING</span>
                        </span>
                      </div>
                    </div>

                    {/* ================= KNITTING ENGINE CENTRAL HUB ================= */}
                    <div className="relative p-4 rounded-2xl bg-gradient-to-r from-slate-950 via-[#0B1A36] to-slate-950 border-2 border-emerald-500/50 shadow-[0_0_35px_rgba(16,185,129,0.25)] text-center mb-6 overflow-hidden">
                      {/* Ambient scanning light */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/10 to-transparent animate-pulse pointer-events-none" />
                      
                      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3 text-left">
                          <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/60 flex items-center justify-center text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                            <Activity className="w-6 h-6 animate-pulse" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm sm:text-base font-black text-white tracking-wider">
                                Knitting Engine
                              </h3>
                              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                                CORE OPERATIONAL HUB
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300 font-medium">
                              Continuous real-time telemetry dispatch across enterprise factory streams
                            </p>
                          </div>
                        </div>

                        {/* Telemetry packet rate */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto text-[10px] font-mono text-slate-400 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                          <span className="text-emerald-400 font-bold">14.2 KB/s Active Flux</span>
                          <span>Zero Packet Latency</span>
                        </div>
                      </div>
                    </div>

                    {/* ================= 7 DATA TRANSFER DESTINATIONS ================= */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                        <span>Data Transfer Channels (7 Active Streams)</span>
                        <span className="text-emerald-400">Knitting Engine → Live Modules</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {destinations.map((dest, idx) => {
                          const Icon = dest.icon;
                          const isActive = activeTargetIndex === idx;

                          return (
                            <div
                              key={dest.id}
                              className={`relative p-3 rounded-xl border transition-all duration-300 text-left overflow-hidden ${
                                isActive 
                                  ? 'bg-slate-900 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] scale-[1.02]' 
                                  : 'bg-slate-950/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/60'
                              } ${idx === 6 ? 'sm:col-span-2 lg:col-span-1' : ''}`}
                            >
                              {/* Glowing pulse indicator when active */}
                              {isActive && (
                                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-emerald-400 to-sky-400" />
                              )}

                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className={`p-1.5 rounded-lg ${dest.bg} ${dest.border} border`}>
                                    <Icon className={`w-3.5 h-3.5 ${dest.color}`} />
                                  </div>
                                  <span className="text-xs font-bold text-slate-100">
                                    {dest.title}
                                  </span>
                                </div>
                                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                  isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-900 text-slate-400'
                                }`}>
                                  {dest.badge}
                                </span>
                              </div>

                              <p className="text-[10px] text-slate-400 font-medium pl-8 truncate">
                                {dest.subtitle}
                              </p>

                              {/* Transfer Flow Visual Bar */}
                              <div className="mt-2 pl-8 flex items-center gap-1.5">
                                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-700 ${
                                      isActive 
                                        ? 'w-full bg-gradient-to-r from-emerald-400 to-teal-300 animate-pulse' 
                                        : 'w-2/3 bg-slate-700'
                                    }`} 
                                  />
                                </div>
                                <span className="text-[8px] font-mono text-slate-400">
                                  {isActive ? 'TRANSFERRING' : 'STREAM'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Status Footnote */}
                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-2 font-medium">
                        <Network className="w-3.5 h-3.5 text-teal-400" />
                        <span>Knitting Engine Telemetry Bus</span>
                      </div>
                      <button
                        onClick={() => setShowLoginPanel(true)}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold text-[11px] transition-colors cursor-pointer"
                      >
                        <span>Access Production System</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </main>

      {/* 4. Understated Footer */}
      <footer className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-8 py-5 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 font-medium">
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-300">EPYLLION KNITEX LTD.</span>
          <span className="text-slate-600">•</span>
          <span>Knitting Performance System</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Enterprise Production Portal</span>
          <span className="text-slate-600">•</span>
          <span>Real-time Floor Telemetry & Intelligence</span>
        </div>
      </footer>

    </div>
  );
};

export default PreLoginWelcomePage;
