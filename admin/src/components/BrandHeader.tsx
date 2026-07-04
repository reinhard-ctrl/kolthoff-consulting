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
        <span className={`font-extrabold tracking-wider uppercase block leading-none truncate ${light ? 'text-slate-900' : 'text-white'} ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
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
          <span className={`text-[7px] font-mono tracking-widest uppercase block mt-0.5 font-bold ${light ? 'text-slate-400' : 'text-slate-500'}`}>
            Demo workspace
          </span>
        )}
      </div>
    </div>
  );
}
