import React, { useState } from 'react';

interface RaihanAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showOnlineIndicator?: boolean;
  className?: string;
  avatarUrl?: string;
}

export const RaihanAvatar: React.FC<RaihanAvatarProps> = ({
  size = 'md',
  showOnlineIndicator = false,
  className = '',
  avatarUrl = '/Gemini_Generated_Image_e0oxaye0oxaye0ox-removebg-preview.png'
}) => {
  const [hasError, setHasError] = useState(false);

  // Dimension mapping
  const sizeMap = {
    xs: { outer: 'w-5 h-5', inner: 'w-5 h-5', dot: 'w-1.5 h-1.5' },
    sm: { outer: 'w-7 h-7', inner: 'w-7 h-7', dot: 'w-2 h-2' },
    md: { outer: 'w-9 h-9', inner: 'w-9 h-9', dot: 'w-2.5 h-2.5' },
    lg: { outer: 'w-11 h-11', inner: 'w-11 h-11', dot: 'w-3 h-3' },
    xl: { outer: 'w-14 h-14', inner: 'w-14 h-14', dot: 'w-3.5 h-3.5' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`relative shrink-0 select-none ${currentSize.outer} ${className}`}>
      <div className={`w-full h-full rounded-xl overflow-hidden bg-slate-800/90 shadow-xs border border-white/20 flex items-center justify-center`}>
        {!hasError ? (
          <img
            src={avatarUrl}
            alt="Raihan - ERP Assistant"
            className="w-full h-full object-cover object-top"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
          />
        ) : (
          // Vector representation matching the user's uploaded portrait of Raihan (headset with glowing cyan LED mic, dark beard, suit)
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="avatarSkin" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e4aa86" />
                <stop offset="60%" stopColor="#cb8c64" />
                <stop offset="100%" stopColor="#af7046" />
              </linearGradient>
              <linearGradient id="avatarSuit" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#243142" />
                <stop offset="100%" stopColor="#151e2b" />
              </linearGradient>
              <filter id="cyanGlowMini" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="1.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Suit & Shoulders */}
            <path d="M22 84 C 24 72, 34 68, 50 68 C 66 68, 76 72, 78 84 L 84 100 L 16 100 Z" fill="url(#avatarSuit)" />
            {/* Pinstripes */}
            <line x1="32" y1="70" x2="28" y2="100" stroke="#3b4d63" strokeWidth="0.8" />
            <line x1="42" y1="69" x2="40" y2="100" stroke="#3b4d63" strokeWidth="0.8" />
            <line x1="58" y1="69" x2="60" y2="100" stroke="#3b4d63" strokeWidth="0.8" />
            <line x1="68" y1="70" x2="72" y2="100" stroke="#3b4d63" strokeWidth="0.8" />

            {/* Shirt & Collar */}
            <polygon points="50,68 42,78 58,78" fill="#e2e8f0" />
            <polygon points="42,67 50,77 44,78" fill="#f8fafc" />
            <polygon points="58,67 50,77 56,78" fill="#ffffff" />

            {/* Neck */}
            <path d="M44 60 L 44 70 C 47 72, 53 72, 56 70 L 56 60 Z" fill="#b97c55" />

            {/* Head & Face */}
            <ellipse cx="50" cy="49" rx="14" ry="18" fill="url(#avatarSkin)" />

            {/* Hair */}
            <path d="M35 44 C 35 32, 42 26, 50 25 C 59 25, 65 31, 64 44 C 63 40, 61 36, 55 35 C 49 35, 42 37, 35 44 Z" fill="#14181e" />

            {/* Eyebrows */}
            <path d="M41 42 C 43 41, 46 41, 47 42" stroke="#14181e" strokeWidth="1" strokeLinecap="round" />
            <path d="M53 42 C 54 41, 57 41, 59 42" stroke="#14181e" strokeWidth="1" strokeLinecap="round" />

            {/* Eyes */}
            <ellipse cx="44" cy="45" rx="1.8" ry="1.2" fill="#2b1a13" />
            <ellipse cx="56" cy="45" rx="1.8" ry="1.2" fill="#2b1a13" />

            {/* Nose */}
            <path d="M50 44 L 49 50 C 50 51, 51 51, 51 50 Z" fill="#9e6642" opacity="0.6" />

            {/* Mustache & Beard */}
            <path d="M46 53 C 48 52, 50 53, 50 53.5 C 50 53, 52 52, 54 53 C 53 54.5, 51 54.8, 50 54.2 C 49 54.8, 47 54.5, 46 53 Z" fill="#14181e" />
            {/* Smile / Teeth */}
            <path d="M47 54.5 C 48 56.5, 52 56.5, 53 54.5 Z" fill="#ffffff" />
            {/* Trimmed Beard */}
            <path d="M39 48 C 39 59, 43 65, 50 65 C 57 65, 61 59, 61 48 C 60 52, 58 56, 56 58 C 54 60, 52 61, 50 61 C 48 61, 46 60, 44 58 C 42 56, 40 52, 39 48 Z" fill="#14181e" />

            {/* Headset Arch */}
            <path d="M34 49 C 32 29, 68 29, 66 49" stroke="#334155" strokeWidth="3" strokeLinecap="round" fill="none" />
            {/* Headband Top Cyan LED Strip */}
            <path d="M42 30 C 46 29, 54 29, 58 30" stroke="#00e5ff" strokeWidth="1.2" strokeLinecap="round" fill="none" filter="url(#cyanGlowMini)" />

            {/* Left/Right Earcups */}
            <rect x="31" y="43" width="4.5" height="9" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.5" />
            <circle cx="33.2" cy="47.5" r="1.2" fill="#00e5ff" filter="url(#cyanGlowMini)" />

            <rect x="64.5" y="43" width="4.5" height="9" rx="2" fill="#1e293b" stroke="#475569" strokeWidth="0.5" />
            <circle cx="66.8" cy="47.5" r="1.2" fill="#00e5ff" filter="url(#cyanGlowMini)" />

            {/* Boom Mic with glowing Cyan LED tip */}
            <path d="M66.5 49 C 68 57, 62 59, 56 57" stroke="#475569" strokeWidth="1" strokeLinecap="round" fill="none" />
            <circle cx="54.5" cy="56.5" r="1.5" fill="#00e5ff" filter="url(#cyanGlowMini)" />
            <circle cx="54.5" cy="56.5" r="0.8" fill="#ffffff" />
          </svg>
        )}
      </div>

      {showOnlineIndicator && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${currentSize.dot} bg-emerald-400 rounded-full ring-2 ring-teal-700 shadow-xs animate-pulse`}
          title="Raihan Online"
        />
      )}
    </div>
  );
};
