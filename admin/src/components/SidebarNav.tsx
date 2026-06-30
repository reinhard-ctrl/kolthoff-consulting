import { useState, type DragEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { DEFAULT_NAV_GROUPS, getNavLink, type NavItem } from '../config/navigation';
import { NavIcon } from './NavIcons';
import { useSidebarFit } from '../hooks/useSidebarFit';
import {
  buildPreferencesFromGroups,
  clearNavPreferences,
  getEffectiveNavGroups,
  insertItemAt,
  reorderGroups,
  saveNavPreferences,
  type NavGroup,
} from '../lib/navPreferences';

type DragPayload =
  | { kind: 'item'; itemId: string; groupId: string }
  | { kind: 'group'; groupId: string };

type DropTarget =
  | { kind: 'item'; groupId: string; itemId: string; position: 'before' | 'after' }
  | { kind: 'group'; groupId: string; position: 'before' | 'after' };

const MIME = 'application/x-kolthoff-nav';

function navCardClass(active: boolean, dragging?: boolean) {
  return [
    'group flex items-center gap-2 w-full rounded-lg border transition-all duration-150 sidebar-nav-item px-2 py-1.5',
    dragging ? 'opacity-40 scale-[0.98]' : '',
    active
      ? 'bg-brandTeal-500/15 border-brandTeal-500/40 text-brandTeal-200 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.15)]'
      : 'bg-brandNavy-800/40 border-brandNavy-700/50 text-slate-300 hover:bg-brandNavy-800 hover:border-brandNavy-600 hover:text-white',
  ].join(' ');
}

function iconWrapClass(active: boolean) {
  return [
    'flex items-center justify-center shrink-0 sidebar-nav-icon-wrap rounded-md border',
    active
      ? 'bg-brandTeal-500/20 text-brandTeal-300 border-brandTeal-500/30'
      : 'bg-brandNavy-900/80 text-slate-400 border-brandNavy-700/60 group-hover:text-brandTeal-400 group-hover:border-brandTeal-500/20',
  ].join(' ');
}

function parseDrag(data: string): DragPayload | null {
  try {
    return JSON.parse(data) as DragPayload;
  } catch {
    return null;
  }
}

function NavItemContent({ item, active, customizing }: { item: NavItem; active: boolean; customizing: boolean }) {
  return (
    <>
      {customizing && (
        <span className="sidebar-drag-handle shrink-0 text-slate-600" aria-hidden="true">
          ⠿
        </span>
      )}
      <span className={iconWrapClass(active)}>
        <NavIcon id={item.id} openInNewTab={item.openInNewTab} className="sidebar-nav-icon" />
      </span>
      <span className="flex-1 min-w-0 sidebar-nav-label leading-tight truncate">{item.label}</span>
      {item.openInNewTab && !customizing && (
        <NavIcon id="external" className="w-2.5 h-2.5 opacity-40 shrink-0" />
      )}
    </>
  );
}

function NavItemCard({
  item,
  groupId,
  customizing,
  active,
  dragging,
  onDragStart,
  onDragEnd,
}: {
  item: NavItem;
  groupId: string;
  customizing: boolean;
  active: boolean;
  dragging: boolean;
  onDragStart: (e: DragEvent, payload: DragPayload) => void;
  onDragEnd: () => void;
}) {
  const card = navCardClass(active, dragging);

  if (customizing) {
    return (
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(MIME, JSON.stringify({ kind: 'item', itemId: item.id, groupId }));
          e.dataTransfer.effectAllowed = 'move';
          onDragStart(e, { kind: 'item', itemId: item.id, groupId });
        }}
        onDragEnd={onDragEnd}
        className={`${card} cursor-grab active:cursor-grabbing`}
      >
        <NavItemContent item={item} active={active} customizing />
      </div>
    );
  }

  if (item.openInNewTab && item.href) {
    const href = item.href.startsWith('http') ? item.href : `${window.location.origin}${item.href}`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={card}>
        <NavItemContent item={item} active={false} customizing={false} />
      </a>
    );
  }

  const to = getNavLink(item);
  return (
    <NavLink to={to} end={item.path === '/'} className={({ isActive }) => navCardClass(isActive)}>
      {({ isActive }) => <NavItemContent item={item} active={isActive} customizing={false} />}
    </NavLink>
  );
}

export default function SidebarNav() {
  const [customizing, setCustomizing] = useState(false);
  const [groups, setGroups] = useState<NavGroup[]>(() => getEffectiveNavGroups());
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const { shellRef, contentRef } = useSidebarFit(groups, customizing);

  const persist = (next: NavGroup[]) => {
    setGroups(next);
    saveNavPreferences(buildPreferencesFromGroups(next));
  };

  const reset = () => {
    clearNavPreferences();
    setGroups(DEFAULT_NAV_GROUPS);
    setCustomizing(false);
  };

  const applyDrop = (payload: DragPayload, target: DropTarget) => {
    if (payload.kind === 'group' && target.kind === 'group') {
      const fromIndex = groups.findIndex((g) => g.id === payload.groupId);
      let toIndex = groups.findIndex((g) => g.id === target.groupId);
      if (fromIndex < 0 || toIndex < 0) return;
      if (target.position === 'after') toIndex += 1;
      if (fromIndex < toIndex) toIndex -= 1;
      persist(reorderGroups(groups, fromIndex, toIndex));
      return;
    }

    if (payload.kind === 'item' && target.kind === 'item') {
      const toGroup = groups.find((g) => g.id === target.groupId);
      if (!toGroup) return;
      let toIndex = toGroup.items.findIndex((i) => i.id === target.itemId);
      if (toIndex < 0) return;
      if (target.position === 'after') toIndex += 1;
      persist(insertItemAt(groups, payload.itemId, payload.groupId, target.groupId, toIndex));
      return;
    }

    if (payload.kind === 'item' && target.kind === 'group') {
      const toGroup = groups.find((g) => g.id === target.groupId);
      if (!toGroup) return;
      const toIndex = target.position === 'before' ? 0 : toGroup.items.length;
      persist(insertItemAt(groups, payload.itemId, payload.groupId, target.groupId, toIndex));
    }
  };

  const handleDrop = (e: DragEvent, target: DropTarget) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData(MIME);
    const payload = parseDrag(raw);
    if (payload) applyDrop(payload, target);
    setDragging(null);
    setDropTarget(null);
  };

  const dropZoneClass = (active: boolean) =>
    `sidebar-drop-zone ${active ? 'sidebar-drop-zone-active' : ''}`;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div ref={shellRef} className="sidebar-nav-shell flex-1 min-h-0 overflow-hidden px-2">
        <nav
          ref={contentRef}
          className="sidebar-nav-fit space-y-2"
          aria-label="Operations Suite navigation"
        >
          {groups.map((group, groupIndex) => {
            const groupDragging = dragging?.kind === 'group' && dragging.groupId === group.id;
            const groupDropBefore =
              dropTarget?.kind === 'group' && dropTarget.groupId === group.id && dropTarget.position === 'before';
            const groupDropAfter =
              dropTarget?.kind === 'group' && dropTarget.groupId === group.id && dropTarget.position === 'after';

            return (
              <div key={group.id}>
                {customizing && (
                  <div
                    className={dropZoneClass(groupDropBefore)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget({ kind: 'group', groupId: group.id, position: 'before' });
                    }}
                    onDrop={(e) => handleDrop(e, { kind: 'group', groupId: group.id, position: 'before' })}
                  />
                )}
                <section
                  className={`sidebar-group-card rounded-lg border border-brandNavy-800/80 bg-brandNavy-950/40 p-1.5 ${groupDragging ? 'opacity-40' : ''}`}
                  draggable={customizing}
                  onDragStart={
                    customizing
                      ? (e) => {
                          e.dataTransfer.setData(MIME, JSON.stringify({ kind: 'group', groupId: group.id }));
                          e.dataTransfer.effectAllowed = 'move';
                          setDragging({ kind: 'group', groupId: group.id });
                        }
                      : undefined
                  }
                  onDragEnd={() => setDragging(null)}
                >
                  <div
                    className={`flex items-center gap-1.5 px-1 pb-1 ${customizing ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    onDragOver={
                      customizing
                        ? (e) => {
                            e.preventDefault();
                            setDropTarget({ kind: 'group', groupId: group.id, position: 'after' });
                          }
                        : undefined
                    }
                    onDrop={
                      customizing
                        ? (e) => handleDrop(e, { kind: 'group', groupId: group.id, position: 'after' })
                        : undefined
                    }
                  >
                    {customizing && <span className="sidebar-drag-handle text-slate-600 text-xs">⠿</span>}
                    <h2 className="sidebar-nav-group-label flex-1 font-mono font-bold uppercase tracking-[0.14em] text-slate-500 truncate">
                      {group.label}
                    </h2>
                  </div>
                  <ul className="space-y-1">
                    {group.items.map((item) => {
                      const itemDropBefore =
                        dropTarget?.kind === 'item' &&
                        dropTarget.groupId === group.id &&
                        dropTarget.itemId === item.id &&
                        dropTarget.position === 'before';
                      const itemDropAfter =
                        dropTarget?.kind === 'item' &&
                        dropTarget.groupId === group.id &&
                        dropTarget.itemId === item.id &&
                        dropTarget.position === 'after';

                      return (
                        <li key={item.id}>
                          {customizing && (
                            <div
                              className={dropZoneClass(!!itemDropBefore)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDropTarget({ kind: 'item', groupId: group.id, itemId: item.id, position: 'before' });
                              }}
                              onDrop={(e) =>
                                handleDrop(e, { kind: 'item', groupId: group.id, itemId: item.id, position: 'before' })
                              }
                            />
                          )}
                          <NavItemCard
                            item={item}
                            groupId={group.id}
                            customizing={customizing}
                            active={false}
                            dragging={dragging?.kind === 'item' && dragging.itemId === item.id}
                            onDragStart={(_, p) => setDragging(p)}
                            onDragEnd={() => setDragging(null)}
                          />
                          {customizing && (
                            <div
                              className={dropZoneClass(!!itemDropAfter)}
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDropTarget({ kind: 'item', groupId: group.id, itemId: item.id, position: 'after' });
                              }}
                              onDrop={(e) =>
                                handleDrop(e, { kind: 'item', groupId: group.id, itemId: item.id, position: 'after' })
                              }
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
                {customizing && groupIndex === groups.length - 1 && (
                  <div
                    className={dropZoneClass(groupDropAfter)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDropTarget({ kind: 'group', groupId: group.id, position: 'after' });
                    }}
                    onDrop={(e) => handleDrop(e, { kind: 'group', groupId: group.id, position: 'after' })}
                  />
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="pt-2 border-t border-brandNavy-800 space-y-1.5 shrink-0">
        {customizing ? (
          <>
            <p className="sidebar-nav-hint text-slate-500 leading-snug">
              Drag cards to reorder or move between groups. Saved in this browser.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setCustomizing(false)} className="flex-1 sidebar-nav-btn-primary">
                Done
              </button>
              <button type="button" onClick={reset} className="sidebar-nav-btn-secondary">
                Reset
              </button>
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
