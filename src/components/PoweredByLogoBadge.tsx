import React, { useEffect, useState } from 'react';
import { getMyLogo, initBrandingSync } from '../lib/logoStore';
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
    initBrandingSync().catch(() => {});
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setMyLogo(customEvent.detail ?? getMyLogo());
    };
    window.addEventListener('my_logo_updated', handleUpdate);
    return () => window.removeEventListener('my_logo_updated', handleUpdate);
  }, []);

  return (
    <div
      id={id}
      className={`relative inline-flex flex-col items-center sm:items-end justify-center select-none bg-transparent ${className}`}
    >
      {/* Header Label: POWERED BY */}
      <div className="flex items-center gap-1.5 w-full justify-center sm:justify-end mb-1">
        <span className="text-[8px] sm:text-[9px] font-mono font-bold tracking-[0.18em] text-slate-400/90 dark:text-slate-400/90 uppercase">
          POWERED BY
        </span>
      </div>

      {/* Main Logo Container - 96px x 96px transparent presentation */}
      {myLogo ? (
        <div 
          className="relative flex items-center justify-center w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] bg-transparent"
        >
          <img
            src={myLogo}
            alt="Powered By Logo"
            className="w-full h-full max-w-[84px] max-h-[84px] sm:max-w-[96px] sm:max-h-[96px] object-contain bg-transparent transition-transform duration-300 hover:scale-105"
          />
        </div>
      ) : (
        <div className="relative flex items-center justify-center w-[84px] h-[84px] sm:w-[96px] sm:h-[96px] bg-transparent">
          <OfficialEpyllionLogo width={96} height={60} showSubtitle={false} theme="dark" id={`${id}-fallback-epyllion`} />
        </div>
      )}
    </div>
  );
};

