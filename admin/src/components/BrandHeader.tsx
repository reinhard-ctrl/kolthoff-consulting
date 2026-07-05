import { useMemo } from 'react';
import { useProduct } from '../lib/product-context';
import { useTenantBranding } from '../hooks/useTenantBranding';
import { useBrandingPreview } from '../lib/branding-preview-context';
import {
  resolveActiveProfileId,
  resolveProfileBranding,
  splitCompanyDisplay,
} from '../lib/tenant-branding';
import { useDemoAppearance } from '../lib/demo-appearance-context';
import { isAgencyOpsStarter } from '../lib/product-config';

type BrandHeaderProps = {
  subtitle?: string;
  compact?: boolean;
  className?: string;
};

function KolthoffShieldLogo({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`${className} shrink-0 text-brandTeal-400`}
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
  );
}

export default function BrandHeader({
  subtitle,
  compact = false,
  className = '',
}: BrandHeaderProps) {
  const product = useProduct();
  const {
    branding: tenantBranding,
    presets,
    activePresetId,
    appliedClientDemoId,
  } = useTenantBranding();
  const { previewPresetId } = useBrandingPreview();
  const { isLight: light } = useDemoAppearance();
  const logoSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const useTenantChrome = isAgencyOpsStarter(product.id);

  const profileBranding = useMemo(() => {
    const profileId = resolveActiveProfileId(
      previewPresetId,
      appliedClientDemoId,
      activePresetId,
    );
    const preset = profileId ? presets.find((item) => item.id === profileId) : null;
    return resolveProfileBranding(preset, tenantBranding);
  }, [previewPresetId, appliedClientDemoId, activePresetId, presets, tenantBranding]);

  if (!useTenantChrome && !light) {
    const { branding } = product;
    const displaySubtitle = subtitle ?? branding.subtitle;

    return (
      <div className={`flex items-center gap-3 min-w-0 ${className}`}>
        <KolthoffShieldLogo className={logoSize} />
        <div className="text-left font-bold min-w-0">
          <span className={`font-extrabold tracking-wider uppercase block text-white leading-none truncate ${compact ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`}>
            {branding.name}
            {branding.accent ? (
              <>
                {' '}
                <span className="text-brandTeal-500">{branding.accent}</span>
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

  const displaySubtitle = subtitle ?? profileBranding.tagline ?? product.branding.subtitle;
  const display = splitCompanyDisplay(profileBranding.companyName);
  const color = profileBranding.primaryColor;
  const companyDisplay = display.line2
    ? `${display.line1} ${display.line2}`
    : display.line1;

  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      {profileBranding.logoUrl ? (
        <img
          src={profileBranding.logoUrl}
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
