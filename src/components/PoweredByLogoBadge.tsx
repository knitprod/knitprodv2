import React, { useEffect, useState } from 'react';
import { getMyLogo } from '../lib/logoStore';
import { OfficialEpyllionLogo } from './OfficialEpyllionLogo';

interface PoweredByLogoBadgeProps {
  theme?: 'dark' | 'light';
  id?: string;
  className?: string;
}

export const PoweredByLogoBadge: React.FC<PoweredByLogoBadgeProps> = ({
  theme = 'dark',
  id = 'powered-by-badge',
  className = ''
}) => {
  const [myLogo, setMyLogo] = useState<string | null>(() => getMyLogo());

  useEffect(() => {
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setMyLogo(customEvent.detail ?? getMyLogo());
    };
    window.addEventListener('my_logo_updated', handleUpdate);
    return () => window.removeEventListener('my_logo_updated', handleUpdate);
  }, []);

  const isDark = theme === 'dark';

  return (
    <div
      id={id}
      className={`relative inline-flex flex-col items-center sm:items-end justify-center px-3 py-1.5 rounded-2xl select-none ${className}`}
    >
      {/* Header Monospace Label */}
      <div className="flex items-center gap-1.5 w-full justify-center sm:justify-end mb-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-mono font-black tracking-widest text-slate-400 dark:text-slate-400 uppercase">
          POWERED BY
        </span>
      </div>

      {/* Main Logo Showcase Container - Borderless, spacious & prominent */}
      {myLogo ? (
        <div 
          className="relative flex items-center justify-center min-w-[160px] max-w-[260px] h-[64px] sm:h-[74px] px-2 py-1"
        >
          <img
            src={myLogo}
            alt="Powered By Logo"
            className="max-h-[60px] sm:max-h-[70px] w-auto max-w-full object-contain drop-shadow-xl transition-transform duration-300 hover:scale-105"
          />
        </div>
      ) : (
        <div className="relative flex items-center justify-center min-w-[160px] h-[64px] sm:h-[74px] px-2 py-1">
          <OfficialEpyllionLogo width={160} height={44} showSubtitle={true} theme="dark" id={`${id}-fallback-epyllion`} />
        </div>
      )}
    </div>
  );
};

