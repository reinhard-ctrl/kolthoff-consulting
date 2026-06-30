import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { DEFAULT_NAV_GROUPS, getNavLink, type NavItem } from '../config/navigation';
import { NavIcon } from './NavIcons';
import {
  buildPreferencesFromGroups,
  clearNavPreferences,
  findItemGroup,
  getEffectiveNavGroups,
  moveGroup,
  moveItem,
  moveItemToGroup,
  saveNavPreferences,
  type NavGroup,
} from '../lib/navPreferences';


function navCardClass(active: boolean) {
  return [
    'group flex items-center gap-2.5 w-full rounded-lg border transition-all duration-150 sidebar-nav-item px-2.5 py-2',
    active
      ? 'bg-brandTeal-500/15 border-brandTeal-500/40 text-brandTeal-200 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.15)]'
      : 'bg-brandNavy-800/40 border-brandNavy-700/50 text-slate-300 hover:bg-brandNavy-800 hover:border-brandNavy-600 hover:text-white',
  ].join(' ');
}

function iconWrapClass(active: boolean) {
  return [
    'flex items-center justify-center shrink-0 w-8 h-8 rounded-md border',
    active
      ? 'bg-brandTeal-500/20 text-brandTeal-300 border-brandTeal-500/30'
      : 'bg-brandNavy-900/80 text-slate-400 border-brandNavy-700/60 group-hover:text-brandTeal-400 group-hover:border-brandTeal-500/20',
  ].join(' ');
}

function NavItemContent({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <>
      <span className={iconWrapClass(active)}>
        <NavIcon id={item.id} openInNewTab={item.openInNewTab} className="sidebar-nav-icon" />
      </span>
      <span className="flex-1 min-w-0 sidebar-nav-label leading-snug truncate">{item.label}</span>
      {item.openInNewTab && (
        <NavIcon id="external" className="w-3 h-3 opacity-40 shrink-0" />
      )}
    </>
  );
}

function NavItemLink({
  item,
  customizing,
  groups,
  onMoveToGroup,
}: {
  item: NavItem;
  customizing: boolean;
  groups: NavGroup[];
  onMoveToGroup: (itemId: string, fromGroupId: string, toGroupId: string) => void;
}) {
  const currentGroupId = findItemGroup(groups, item.id);

  const moveSelect = customizing && currentGroupId && (
    <select
      aria-label={`Move ${item.label} to group`}
      value={currentGroupId}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onMoveToGroup(item.id, currentGroupId, e.target.value)}
      className="w-full text-[clamp(0.55rem,0.75vw,0.65rem)] bg-brandNavy-950 border border-brandNavy-700 rounded px-1.5 py-1 text-slate-400 focus:border-brandTeal-500/50 outline-none"
    >
      {groups.map((g) => (
        <option key={g.id} value={g.id}>{g.label}</option>
      ))}
    </select>
  );

  let link: React.ReactNode;
  if (item.openInNewTab && item.href) {
    const href = item.href.startsWith('http') ? item.href : `${window.location.origin}${item.href}`;
    link = (
      <a href={href} target="_blank" rel="noopener noreferrer" className={navCardClass(false)}>
        <NavItemContent item={item} active={false} />
      </a>
    );
  } else {
    const to = getNavLink(item);
    link = (
      <NavLink to={to} end={item.path === '/'} className={({ isActive }) => navCardClass(isActive)}>
        {({ isActive }) => <NavItemContent item={item} active={isActive} />}
      </NavLink>
    );
  }

  return (
    <div className={customizing ? 'space-y-1' : ''}>
      <div className={customizing ? 'pr-6' : ''}>{link}</div>
      {moveSelect}
    </div>
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

  const moveToGroup = (itemId: string, fromGroupId: string, toGroupId: string) => {
    persist(moveItemToGroup(groups, itemId, fromGroupId, toGroupId));
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <nav className="flex-1 overflow-y-auto sidebar-nav-scroll space-y-3 pr-0.5" aria-label="Operations Suite navigation">
        {groups.map((group) => (
          <section key={group.id} className="rounded-xl border border-brandNavy-800/80 bg-brandNavy-950/40 p-2">
            <div className="flex items-center justify-between px-1.5 pb-2 gap-2">
              <h2 className="sidebar-nav-group-label font-mono font-bold uppercase tracking-[0.18em] text-slate-500 truncate">
                {group.label}
              </h2>
              {customizing && (
                <div className="flex gap-0.5 shrink-0">
                  <button type="button" aria-label={`Move ${group.label} up`} onClick={() => persist(moveGroup(groups, group.id, -1))} className="nav-nudge-btn">↑</button>
                  <button type="button" aria-label={`Move ${group.label} down`} onClick={() => persist(moveGroup(groups, group.id, 1))} className="nav-nudge-btn">↓</button>
                </div>
              )}
            </div>
            <ul className="space-y-1.5">
              {group.items.map((item) => (
                <li key={item.id} className="relative">
                  <NavItemLink item={item} customizing={customizing} groups={groups} onMoveToGroup={moveToGroup} />
                  {customizing && (
                    <div className="absolute right-1 top-[0.4rem] flex flex-col gap-0.5 z-20 pointer-events-auto">
                      <button type="button" aria-label={`Move ${item.label} up`} onClick={() => persist(moveItem(groups, group.id, item.id, -1))} className="nav-nudge-btn">↑</button>
                      <button type="button" aria-label={`Move ${item.label} down`} onClick={() => persist(moveItem(groups, group.id, item.id, 1))} className="nav-nudge-btn">↓</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <div className="pt-3 border-t border-brandNavy-800 space-y-2 shrink-0">
        {customizing ? (
          <>
            <p className="sidebar-nav-hint text-slate-500 leading-relaxed">
              Reorder with ↑↓, or pick a group from the dropdown to move a link. Saved in this browser.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCustomizing(false)} className="flex-1 sidebar-nav-btn-primary">Done</button>
              <button type="button" onClick={reset} className="sidebar-nav-btn-secondary">Reset</button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => setCustomizing(true)} className="w-full sidebar-nav-btn-secondary">
            Customize sidebar
          </button>
        )}
      </div>
    </div>
  );
}
