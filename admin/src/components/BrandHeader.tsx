import { useProduct } from '../lib/product-context';

type BrandHeaderProps = {
  subtitle?: string;
  compact?: boolean;
  className?: string;
};

export default function BrandHeader({
  subtitle,
  compact = false,
  className = '',
}: BrandHeaderProps) {
  const product = useProduct();
  const { branding } = product;
  const displaySubtitle = subtitle ?? branding.subtitle;
  const logoSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const accentClass = product.id === 'agency-ops-starter' ? 'text-sky-400' : 'text-brandTeal-500';

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <svg
        aria-hidden="true"
        className={`${logoSize} shrink-0 text-brandTeal-400`}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="admin-shield-grad" x1="16" y1="12" x2="84" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14B8A6" stopOpacity="0.4" />
            <stop offset="1" stopColor="#2DD4BF" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="admin-check-grad" x1="36" y1="36" x2="66" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14B8A6" />
            <stop offset="1" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>
        <path
          d="M50 12 C72 16 84 22 84 22 V54 C84 72 70 85 50 90 C30 85 16 72 16 54 V22 C16 22 28 16 50 12 Z"
          fill="#14B8A6"
          fillOpacity="0.08"
          stroke="url(#admin-shield-grad)"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <path
          d="M36 50 L46 60 L66 36"
          stroke="url(#admin-check-grad)"
          strokeWidth="7.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-left font-bold min-w-0">
        <span className={`font-extrabold tracking-wider uppercase block text-white leading-none truncate ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
          {branding.name}
          {branding.accent ? (
            <>
              {' '}
              <span className={accentClass}>{branding.accent}</span>
            </>
          ) : null}
        </span>
        <span className="text-[8px] text-brandTeal-400 font-mono tracking-[0.25em] uppercase block mt-1.5 font-bold truncate">
          {displaySubtitle}
        </span>
        {product.isDemo && (
          <span className="text-[7px] text-amber-400/90 font-mono tracking-widest uppercase block mt-0.5 font-bold">
            Demo Environment
          </span>
        )}
      </div>
    </div>
  );
}
