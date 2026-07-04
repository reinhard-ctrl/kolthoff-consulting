import { useProduct } from '../lib/product-context';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { splitCompanyDisplay } from '../lib/tenant-branding';
import { isLightProductTheme } from '../lib/product-config';

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
  const { branding } = useTenantBranding();
  const light = isLightProductTheme(product.id);
  const displaySubtitle = subtitle ?? branding.tagline ?? product.branding.subtitle;
  const logoSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const display = splitCompanyDisplay(branding.companyName);
  const color = branding.primaryColor;
  const companyDisplay = display.line2
    ? `${display.line1} ${display.line2}`
    : display.line1;

  if (light) {
    return (
      <div className={`flex items-center gap-3 min-w-0 ${className}`}>
        {branding.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt=""
            className={`${logoSize} shrink-0 object-contain`}
          />
        ) : (
          <div
            className={`${logoSize} shrink-0 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm`}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          >
            {display.line1.charAt(0)}
          </div>
        )}
        <div className="text-left min-w-0">
          <span className={`ops-brand-name block truncate ${compact ? 'text-sm' : ''}`}>
            {companyDisplay}
          </span>
          {displaySubtitle && (
            <span className="ops-brand-tagline block truncate">{displaySubtitle}</span>
          )}
          {product.isDemo && <span className="ops-brand-badge">Demo</span>}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      {branding.logoUrl ? (
        <img
          src={branding.logoUrl}
          alt=""
          className={`${logoSize} shrink-0 object-contain rounded`}
        />
      ) : (
        <div
          className={`${logoSize} shrink-0 rounded-lg flex items-center justify-center text-white font-bold text-xs`}
          style={{ backgroundColor: color }}
          aria-hidden="true"
        >
          {display.line1.charAt(0)}
        </div>
      )}
      <div className="text-left font-bold min-w-0">
        <span className={`font-extrabold tracking-wider uppercase block text-white leading-none truncate ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
          {display.line1}
          {display.line2 ? (
            <>
              {' '}
              <span style={{ color }}>{display.line2}</span>
            </>
          ) : null}
        </span>
        <span
          className="text-[8px] font-mono tracking-[0.25em] uppercase block mt-1.5 font-bold truncate"
          style={{ color: `${color}cc` }}
        >
          {displaySubtitle}
        </span>
        {product.isDemo && (
          <span className="text-[7px] text-slate-500 font-mono tracking-widest uppercase block mt-0.5 font-bold">
            Demo workspace
          </span>
        )}
      </div>
    </div>
  );
}
