import React, { useState, useEffect } from 'react';

interface RaihanAvatarProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showOnlineIndicator?: boolean;
  className?: string;
  avatarUrl?: string;
  allowUpload?: boolean;
  onAvatarChange?: (newUrl: string) => void;
}

export const RaihanAvatar: React.FC<RaihanAvatarProps> = ({
  size = 'md',
  showOnlineIndicator = false,
  className = '',
  avatarUrl,
  allowUpload = false,
  onAvatarChange
}) => {
  // Dimension mapping
  const sizeMap = {
    xs: { outer: 'w-6 h-6', inner: 'w-6 h-6', dot: 'w-1.5 h-1.5' },
    sm: { outer: 'w-8 h-8', inner: 'w-8 h-8', dot: 'w-2 h-2' },
    md: { outer: 'w-10 h-10', inner: 'w-10 h-10', dot: 'w-2.5 h-2.5' },
    lg: { outer: 'w-12 h-12', inner: 'w-12 h-12', dot: 'w-3 h-3' },
    xl: { outer: 'w-16 h-16', inner: 'w-16 h-16', dot: 'w-3.5 h-3.5' },
  };

  const [customAvatar, setCustomAvatar] = useState<string | null>(() => {
    try {
      return localStorage.getItem('raihan_custom_avatar');
    } catch {
      return null;
    }
  });

  // Listen for avatar updates across components
  useEffect(() => {
    const handleAvatarUpdate = () => {
      try {
        const saved = localStorage.getItem('raihan_custom_avatar');
        setCustomAvatar(saved);
      } catch {
        // ignore
      }
    };
    window.addEventListener('raihan_avatar_updated', handleAvatarUpdate);
    return () => window.removeEventListener('raihan_avatar_updated', handleAvatarUpdate);
  }, []);

  // Priority list of image sources:
  // 1. Explicit prop if provided
  // 2. Custom uploaded photo from localStorage (if user uploaded)
  // 3. User's uploaded file name
  // 4. Standalone raihan-avatar.png
  // 5. Recreated cyber-tech portrait SVG
  const candidates = React.useMemo(() => {
    const list: string[] = [];
    if (avatarUrl) list.push(avatarUrl);
    if (customAvatar) list.push(customAvatar);
    list.push('/Gemini_Generated_Image_e0oxaye0oxaye0ox.jfif');
    list.push('/Gemini_Generated_Image_e0oxaye0oxaye0ox.png');
    list.push('/raihan-avatar.png');
    list.push('/raihan-avatar.svg');
    return Array.from(new Set(list));
  }, [avatarUrl, customAvatar]);

  const [candidateIndex, setCandidateIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  const currentSrc = candidates[candidateIndex];

  const handleImageError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((prev) => prev + 1);
    } else {
      setAllFailed(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        try {
          localStorage.setItem('raihan_custom_avatar', result);
        } catch {
          // ignore
        }
        setCustomAvatar(result);
        setCandidateIndex(0);
        setAllFailed(false);
        window.dispatchEvent(new Event('raihan_avatar_updated'));
        if (onAvatarChange) onAvatarChange(result);
      }
    };
    reader.readAsDataURL(file);
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`relative shrink-0 select-none ${currentSize.outer} ${className}`}>
      <div className={`w-full h-full rounded-xl overflow-hidden bg-slate-900 shadow-md border border-teal-500/30 flex items-center justify-center ring-1 ring-white/10 relative group`}>
        {!allFailed && currentSrc ? (
          <img
            src={currentSrc}
            alt="Raihan - ERP Assistant"
            className="w-full h-full object-cover object-center"
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        ) : (
          // Cyber-tech portrait vector fallback
          <svg
            viewBox="0 0 500 500"
            className="w-full h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="miniBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#142c52" />
                <stop offset="100%" stopColor="#0e1d38" />
              </linearGradient>
              <linearGradient id="miniSkin" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e2aa84" />
                <stop offset="100%" stopColor="#ae6e43" />
              </linearGradient>
              <filter id="miniCyanGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background Card */}
            <rect width="500" height="500" fill="url(#miniBg)" />

            {/* Suit & Shoulders */}
            <path d="M70 490 C 80 400, 150 360, 250 360 C 350 360, 420 400, 430 490 L 450 500 L 50 500 Z" fill="#1b2331" />
            <polygon points="250,360 195,430 305,430" fill="#e0f2fe" />
            <polygon points="175,355 242,418 200,422" fill="#f8fafc" />
            <polygon points="325,355 258,418 300,422" fill="#ffffff" />

            {/* Neck & Head */}
            <path d="M208 305 L 208 365 C 228 382, 272 382, 292 365 L 292 305 Z" fill="#b07246" />
            <ellipse cx="250" cy="242" rx="82" ry="102" fill="url(#miniSkin)" />

            {/* Hair */}
            <path d="M168 215 C 160 135, 205 92, 258 92 C 318 92, 342 135, 332 215 C 322 188, 308 168, 278 165 C 242 162, 198 178, 168 215 Z" fill="#141110" />

            {/* Eyes & Brows */}
            <path d="M198 205 C 210 196, 228 198, 238 206" stroke="#141110" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M262 206 C 272 198, 290 196, 302 205" stroke="#141110" strokeWidth="6" strokeLinecap="round" fill="none" />
            <ellipse cx="219" cy="220" rx="6" ry="6" fill="#2d1c15" />
            <ellipse cx="281" cy="220" rx="6" ry="6" fill="#2d1c15" />
            <circle cx="221" cy="218" r="2" fill="#ffffff" />
            <circle cx="283" cy="218" r="2" fill="#ffffff" />

            {/* Smile & Beard */}
            <path d="M231 273 C 241 288, 259 288, 269 273 Z" fill="#ffffff" />
            <path d="M188 238 C 188 305, 210 342, 250 342 C 290 342, 312 305, 312 238 C 306 265, 295 290, 280 302 C 270 312, 260 316, 250 316 C 240 316, 230 312, 220 302 C 205 290, 194 265, 188 238 Z" fill="#141110" />

            {/* Headset Arch & LED */}
            <path d="M165 245 C 150 110, 350 110, 335 245" stroke="#475569" strokeWidth="14" strokeLinecap="round" fill="none" />
            <path d="M200 128 C 228 114, 272 114, 300 128" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" fill="none" filter="url(#miniCyanGlow)" />

            {/* Earcups */}
            <rect x="150" y="210" width="26" height="56" rx="13" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
            <circle cx="163" cy="238" r="6" fill="#38bdf8" />
            <rect x="324" y="210" width="26" height="56" rx="13" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
            <circle cx="337" cy="238" r="6" fill="#38bdf8" />

            {/* Mic boom & tip */}
            <path d="M338 252 C 348 298, 315 310, 278 298" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" fill="none" />
            <rect x="264" y="291" width="18" height="12" rx="6" fill="#00e5ff" filter="url(#miniCyanGlow)" />
          </svg>
        )}

        {/* Upload Overlay if enabled */}
        {allowUpload && (
          <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-[9px] font-semibold">
            <span>Change</span>
            <input
              type="file"
              accept="image/*,.jfif"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
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
