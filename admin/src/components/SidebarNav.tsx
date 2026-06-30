import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { DEFAULT_NAV_GROUPS, getNavLink, type NavItem } from '../config/navigation';
import {
  buildPreferencesFromGroups,
  clearNavPreferences,
  getEffectiveNavGroups,
  moveGroup,
  moveItem,
  saveNavPreferences,
  type NavGroup,
} from '../lib/navPreferences';

function navItemClass(active: boolean, customizing: boolean) {
  return [
    'block w-full text-left p-2 rounded text-sm transition-colors border',
    customizing ? 'pr-16 relative' : '',
    active
      ? 'bg-brandTeal-500/15 text-brandTeal-300 border-brandTeal-500/30 font-semibold'
      : 'text-slate-400 hover:bg-brandNavy-800 hover:text-slate-200 border-transparent',
  ].join(' ');
}

function NavItemLink({ item, customizing }: { item: NavItem; customizing: boolean }) {
  const location = useLocation();

  if (item.openInNewTab && item.href) {
    const href = item.href.startsWith('http') ? item.href : `${window.location.origin}${item.href}`;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={navItemClass(false, customizing)}
      >
        <span className="flex items-center justify-between gap-2">
          <span>{item.label}</span>
          <svg className="w-3 h-3 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </span>
      </a>
    );
  }

  const to = getNavLink(item);
  const active =
    item.type === 'route'
      ? item.path === '/'
        ? location.pathname === '/'
        : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
      : location.pathname === `/app/${item.id}`;

  return (
    <NavLink to={to} end={item.path === '/'} className={navItemClass(active, customizing)}>
      {item.label}
    </NavLink>
  );
}

export default function SidebarNav() {
  const [customizing, setCustomizing] = useState(false);
  const [groups, setGroups] = useState<NavGroup[]>(() => getEffectiveNavGroups());

  const persist = (next: NavGroup[]) => {
    setGroups(next);
    saveNavPreferences(buildPreferencesFromGroups(next));
  };

  const reset = () => {
    clearNavPreferences();
    setGroups(DEFAULT_NAV_GROUPS);
    setCustomizing(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="space-y-1 flex-1 overflow-y-auto" aria-label="Operations Suite navigation">
        {groups.map((group) => (
          <div key={group.id} className="mb-3">
            <div className="flex items-center justify-between pt-2 pb-1.5">
              <div className="text-[9px] text-slate-500 uppercase tracking-[0.2em] font-bold font-mono">
                {group.label}
              </div>
              {customizing && (
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    aria-label={`Move ${group.label} up`}
                    onClick={() => persist(moveGroup(groups, group.id, -1))}
                    className="px-1 text-[10px] text-slate-500 hover:text-brandTeal-400"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${group.label} down`}
                    onClick={() => persist(moveGroup(groups, group.id, 1))}
                    className="px-1 text-[10px] text-slate-500 hover:text-brandTeal-400"
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
            {group.items.map((item) => (
              <div key={item.id} className="relative mb-0.5">
                <NavItemLink item={item} customizing={customizing} />
                {customizing && (
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
                    <button
                      type="button"
                      aria-label={`Move ${item.label} up`}
                      onClick={() => persist(moveItem(groups, group.id, item.id, -1))}
                      className="px-1 text-[10px] text-slate-500 hover:text-brandTeal-400"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${item.label} down`}
                      onClick={() => persist(moveItem(groups, group.id, item.id, 1))}
                      className="px-1 text-[10px] text-slate-500 hover:text-brandTeal-400"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="pt-3 border-t border-brandNavy-800 space-y-2 shrink-0">
        {customizing ? (
          <>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Use arrows to reorder groups and links. Order is saved in this browser.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCustomizing(false)}
                className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider bg-brandTeal-500 text-brandNavy-955"
              >
                Done
              </button>
              <button
                type="button"
                onClick={reset}
                className="px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border border-brandNavy-700 text-slate-400 hover:text-slate-200"
              >
                Reset
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setCustomizing(true)}
            className="w-full px-2 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider border border-brandNavy-700 text-slate-500 hover:text-brandTeal-400 hover:border-brandTeal-500/30 transition-colors"
          >
            Customize sidebar
          </button>
        )}
      </div>
    </div>
  );
}
