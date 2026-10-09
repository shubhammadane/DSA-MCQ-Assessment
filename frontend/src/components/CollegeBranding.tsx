import React from 'react';

/**
 * CollegeBranding — Shared institutional identity component.
 *
 * Displays:
 *  - Official college logo
 *  - English name: Government College of Engineering, Chhatrapati Sambhajinagar
 *  - Marathi name: शासकीय अभियांत्रिकी महाविद्यालय, छत्रपती संभाजीनगर
 *  - Subtitle: (An Autonomous Institute of Government of Maharashtra)
 */

type BrandingSize = 'sm' | 'md' | 'lg';

interface CollegeBrandingProps {
  size?: BrandingSize;
  showMarathi?: boolean;
  className?: string;
  theme?: 'light' | 'dark';
}

const sizeConfig: Record<BrandingSize, {
  logoClass: string;
  engClass: string;
  marClass: string;
  subClass: string;
  gapClass: string;
}> = {
  sm: {
    logoClass: 'w-10 h-10',
    engClass: 'text-sm font-bold leading-tight',
    marClass: 'text-[11px] leading-tight',
    subClass: 'text-[10px]',
    gapClass: 'space-x-2.5',
  },
  md: {
    logoClass: 'w-14 h-14',
    engClass: 'text-base font-bold leading-snug',
    marClass: 'text-xs leading-snug',
    subClass: 'text-[11px]',
    gapClass: 'space-x-3',
  },
  lg: {
    logoClass: 'w-20 h-20',
    engClass: 'text-xl font-bold leading-snug',
    marClass: 'text-sm leading-snug',
    subClass: 'text-xs',
    gapClass: 'space-x-4',
  },
};

export const CollegeBranding: React.FC<CollegeBrandingProps> = ({
  size = 'md',
  showMarathi = true,
  className = '',
  theme = 'light',
}) => {
  const cfg = sizeConfig[size];
  const isDark = theme === 'dark';

  return (
    <div className={`flex items-center ${cfg.gapClass} ${className}`}>
      {/* College Logo */}
      <img
        src="/college-logo.png"
        alt="Government College of Engineering Chhatrapati Sambhajinagar"
        className={`${cfg.logoClass} object-contain flex-shrink-0 drop-shadow-sm`}
        style={{ imageRendering: 'crisp-edges' }}
      />

      {/* Text Identity */}
      <div className="min-w-0">
        {/* English Name */}
        <p className={`${cfg.engClass} ${isDark ? 'text-white' : 'text-slate-900'} tracking-tight`}>
          Government College of Engineering, Chhatrapati Sambhajinagar
        </p>

        {/* Marathi Name */}
        {showMarathi && (
          <p
            className={`${cfg.marClass} ${isDark ? 'text-amber-300 font-medium' : 'text-blue-900 font-semibold'}`}
            style={{ fontFamily: '"Noto Sans Devanagari", "Mangal", sans-serif' }}
          >
            शासकीय अभियांत्रिकी महाविद्यालय, छत्रपती संभाजीनगर
          </p>
        )}

        {/* Institutional Subtitle */}
        <p className={`${cfg.subClass} ${isDark ? 'text-slate-400' : 'text-slate-600'} italic`}>
          (An Autonomous Institute of Government of Maharashtra)
        </p>
      </div>
    </div>
  );
};

export default CollegeBranding;
