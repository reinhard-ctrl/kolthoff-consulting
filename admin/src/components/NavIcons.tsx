import type { JSX, ReactNode } from 'react';

type IconProps = { className?: string };

function Svg({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS: Record<string, (p: IconProps) => JSX.Element> = {
  dashboard: ({ className }) => (
    <Svg className={className}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></Svg>
  ),
  tenants: ({ className }) => (
    <Svg className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
  ),
  'org-chart': ({ className }) => (
    <Svg className={className}><path d="M12 3v18" /><path d="M6 8h12" /><path d="M9 8v5" /><path d="M15 8v5" /><path d="M9 13h6" /><circle cx="12" cy="5" r="2" /><circle cx="6" cy="16" r="2" /><circle cx="18" cy="16" r="2" /></Svg>
  ),
  portals: ({ className }) => (
    <Svg className={className}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 1 4 10 14.5 14.5 0 0 1-4 10 14.5 14.5 0 0 1-4-10 14.5 14.5 0 0 1 4-10z" /><path d="M2 12h20" /></Svg>
  ),
  contracts: ({ className }) => (
    <Svg className={className}><path d="M12 3v18" /><path d="M5 8h14" /><path d="M5 16h14" /><path d="M7 5h10v14H7z" opacity="0.35" fill="currentColor" stroke="none" /></Svg>
  ),
  master: ({ className }) => (
    <Svg className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></Svg>
  ),
  'project-planner': ({ className }) => (
    <Svg className={className}><path d="M3 7h18" /><path d="M3 12h18" /><path d="M3 17h18" /><path d="M8 7v10" opacity="0.4" /></Svg>
  ),
  'diagnosis-reports': ({ className }) => (
    <Svg className={className}><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></Svg>
  ),
  'crm-pipeline': ({ className }) => (
    <Svg className={className}><path d="M3 3v18h18" /><path d="M7 16l4-6 4 3 5-7" /></Svg>
  ),
  'policy-studio': ({ className }) => (
    <Svg className={className}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></Svg>
  ),
  'workflow-builder': ({ className }) => (
    <Svg className={className}><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><rect x="9" y="15" width="6" height="6" rx="1" /><path d="M6 9v3h5v3" /><path d="M18 9v3h-5v3" /></Svg>
  ),
  'firm-analytics': ({ className }) => (
    <Svg className={className}><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></Svg>
  ),
  'resource-capacity': ({ className }) => (
    <Svg className={className}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Svg>
  ),
  'time-variance': ({ className }) => (
    <Svg className={className}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Svg>
  ),
  'core-workspace': ({ className }) => (
    <Svg className={className}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 17v4" /></Svg>
  ),
  'client-portal': ({ className }) => (
    <Svg className={className}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Svg>
  ),
  marketing: ({ className }) => (
    <Svg className={className}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></Svg>
  ),
  external: ({ className }) => (
    <Svg className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14 21 3" /></Svg>
  ),
  collections: ({ className }) => (
    <Svg className={className}><path d="M12 2v20" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></Svg>
  ),
  'agency-ops-manager': ({ className }) => (
    <Svg className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Svg>
  ),
  branding: ({ className }) => (
    <Svg className={className}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2" /></Svg>
  ),
  default: ({ className }) => (
    <Svg className={className}><circle cx="12" cy="12" r="3" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Svg>
  ),
};

export function NavIcon({ id, openInNewTab, className = 'w-4 h-4' }: { id: string; openInNewTab?: boolean; className?: string }) {
  const Icon = ICONS[openInNewTab ? 'external' : id] ?? ICONS.default;
  return <Icon className={className} />;
}
