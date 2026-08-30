import React, { useEffect, useState } from 'react';
import { getCompanyLogo, initBrandingSync } from '../lib/logoStore';

interface OfficialEpyllionLogoProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  showSubtitle?: boolean;
  theme?: 'dark' | 'light';
  id?: string;
}

export const OfficialEpyllionLogo: React.FC<OfficialEpyllionLogoProps> = ({
  className = '',
  width = 320,
  height = 80,
  showSubtitle = true,
  theme = 'dark',
  id = 'official-epyllion-logo'
}) => {
  const [customLogo, setCustomLogo] = useState<string | null>(() => getCompanyLogo());

  useEffect(() => {
    initBrandingSync().catch(() => {});
    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<string | null>;
      setCustomLogo(customEvent.detail ?? getCompanyLogo());
    };
    window.addEventListener('company_logo_updated', handleUpdate);
    return () => window.removeEventListener('company_logo_updated', handleUpdate);
  }, []);

  if (customLogo) {
    return (
      <div 
        id={id} 
        className={`inline-flex items-center select-none ${className}`}
        style={{ width: typeof width === 'number' ? `${width}px` : width }}
      >
        <img 
          src={customLogo} 
          alt="EPYLLION KNITEX LTD." 
          className="h-auto max-h-24 w-auto object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
        />
      </div>
    );
  }

  const isDark = theme === 'dark';

  return (
    <div id={id} className={`inline-flex items-center select-none ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 320 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-auto h-auto max-h-24 overflow-visible"
      >
        <defs>
          <filter id="epyllion-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>

          <linearGradient id="epyllion-gold-arc" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F59E0B" />
            <stop offset="60%" stopColor="#FBBF24" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>

          <linearGradient id="epyllion-brand-green" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#15803D" />
          </linearGradient>
        </defs>

        {/* Ambient backdrop glow in dark mode */}
        {isDark && (
          <ellipse cx="140" cy="40" rx="130" ry="32" fill="#10B981" fillOpacity="0.08" />
        )}

        {/* --- SUNBURST RAYS (4 Iconic Petals on Top Right of Arc) --- */}
        <g id="sunburst-rays">
          {/* Ray 1 (Leftmost ray) */}
          <path
            d="M 124 23 C 122 17 122 13 124 10 C 126 13 128 17 128 23 Z"
            fill="#FBBF24"
          />
          {/* Ray 2 */}
          <path
            d="M 132 24 C 133 18 136 13 139 12 C 139 16 138 21 135 25 Z"
            fill="#F59E0B"
          />
          {/* Ray 3 */}
          <path
            d="M 140 27 C 143 21 148 18 153 18 C 151 22 148 26 143 29 Z"
            fill="#FBBF24"
          />
          {/* Ray 4 (Rightmost ray) */}
          <path
            d="M 147 32 C 152 28 158 26 163 28 C 160 31 155 33 149 35 Z"
            fill="#F59E0B"
          />
        </g>

        {/* --- DYNAMIC GOLDEN ARC SWEEPING ACROSS --- */}
        <path
          d="M 16 64 C 48 48 94 28 156 38 C 160 39 161 41 158 43 C 104 34 56 54 22 70 C 18 72 14 67 16 64 Z"
          fill="url(#epyllion-gold-arc)"
          filter={isDark ? "url(#epyllion-glow)" : undefined}
        />

        {/* --- BRAND WORDMARK: EPYLLION --- */}
        <text
          x="12"
          y="56"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
          fontSize="36"
          fontWeight="900"
          letterSpacing="2.5"
          fill={isDark ? '#22C55E' : '#15803D'}
        >
          EPYLLION
        </text>

        {/* --- SUBTITLE: GROUP / KNITEX LTD. --- */}
        {showSubtitle && (
          <g transform="translate(14, 72)">
            <text
              x="0"
              y="0"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="10"
              fontWeight="800"
              letterSpacing="6.5"
              fill={isDark ? '#94A3B8' : '#64748B'}
            >
              G R O U P
            </text>
            <text
              x="132"
              y="0"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontSize="9.5"
              fontWeight="800"
              letterSpacing="2"
              fill={isDark ? '#38BDF8' : '#0284C7'}
            >
              • KNITEX LTD.
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};

