import { useRef, useState, type DragEvent } from 'react';
import { NavLink } from 'react-router-dom';
import { DEFAULT_NAV_GROUPS, getNavExternalUrl, getNavLink, canOpenInPanel, type NavItem } from '../config/navigation';
import { NavIcon } from './NavIcons';
import { useSidebarFit } from '../hooks/useSidebarFit';
import {
  addNavGroup,
  buildPreferencesFromGroups,
  clearNavPreferences,
  getAvailableNavGroupsToAdd,
  getEffectiveNavGroups,
  insertItemAt,
  removeNavGroup,
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

function navCardClass(active: boolean, dragging?: boolean, dropHint?: 'before' | 'after') {
  return [
    'group flex items-center gap-2 w-full rounded-lg border transition-all duration-150 sidebar-nav-item px-2 py-1.5',
    dragging ? 'opacity-40 scale-[0.98]' : '',
    dropHint === 'before' ? 'ring-2 ring-brandTeal-500/50 ring-offset-1 ring-offset-brandNavy-950' : '',
    dropHint === 'after' ? 'border-b-brandTeal-500 border-b-2' : '',
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
  if (!data) return null;
  try {
    return JSON.parse(data) as DragPayload;
  } catch {
    return null;
  }
}

function NavItemContent({
  item,
  active,
  customizing,
  showNewTabAffordance,
}: {
  item: NavItem;
  active: boolean;
  customizing: boolean;
  showNewTabAffordance?: boolean;
}) {
  return (
    <>
      {customizing && (
        <span className="sidebar-drag-handle shrink-0 text-slate-600 select-none" aria-hidden="true">
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
      {showNewTabAffordance && !customizing && (
        <span className="sidebar-nav-external-spacer shrink-0 w-5" aria-hidden="true" />
      )}
    </>
  );
}

function OpenInNewTabButton({ item }: { item: NavItem }) {
  const url = getNavExternalUrl(item);
  if (!url || !canOpenInPanel(item)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${item.label} in new tab`}
      aria-label={`Open ${item.label} in new tab`}
      className="sidebar-nav-external-btn"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <NavIcon id="external" className="w-2.5 h-2.5" />
    </a>
  );
}

function NavItemCard({
  item,
  groupId,
  customizing,
  dragging,
  dropHint,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDrop,
}: {
  item: NavItem;
  groupId: string;
  customizing: boolean;
  dragging: boolean;
  dropHint?: 'before' | 'after';
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onDragEnter: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}) {
  if (customizing) {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`${navCardClass(false, dragging, dropHint)} cursor-grab active:cursor-grabbing`}
      >
        <NavItemContent item={item} active={false} customizing />
      </div>
    );
  }

  const card = navCardClass(false, false);

  if (item.openInNewTab && item.href) {
    const href = item.href.startsWith('http') ? item.href : `${window.location.origin}${item.href}`;
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={card}>
        <NavItemContent item={item} active={false} customizing={false} />
      </a>
    );
  }

  const to = getNavLink(item);
  const externalUrl = getNavExternalUrl(item);
  const showNewTabButton = Boolean(externalUrl && canOpenInPanel(item));

  return (
    <div className="group/card relative">
      <NavLink to={to} end={item.path === '/'} className={({ isActive }) => navCardClass(isActive)}>
        {({ isActive }) => (
          <NavItemContent item={item} active={isActive} customizing={false} showNewTabAffordance={showNewTabButton} />
        )}
      </NavLink>
      {showNewTabButton && <OpenInNewTabButton item={item} />}
    </div>
  );
}

export default function SidebarNav() {
  const [customizing, setCustomizing] = useState(false);
  const [groups, setGroups] = useState<NavGroup[]>(() => getEffectiveNavGroups());
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);

  const { shellRef, contentRef } = useSidebarFit(groups, customizing);

  const persist = (next: NavGroup[]) => {
    setGroups(next);
    saveNavPreferences(buildPreferencesFromGroups(next));
  };

  const reset = () => {
    clearNavPreferences();
    setGroups(DEFAULT_NAV_GROUPS);
    setCustomizing(false);
    dragPayloadRef.current = null;
  };

  const beginDrag = (e: DragEvent, payload: DragPayload) => {
    e.stopPropagation();
    dragPayloadRef.current = payload;
    const json = JSON.stringify(payload);
    e.dataTransfer.setData(MIME, json);
    e.dataTransfer.setData('text/plain', json);
    e.dataTransfer.effectAllowed = 'move';
    setDragging(payload);
  };

  const readDragPayload = (e: DragEvent): DragPayload | null => {
    return parseDrag(e.dataTransfer.getData(MIME) || e.dataTransfer.getData('text/plain')) || dragPayloadRef.current;
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

  const finishDrop = (e: DragEvent, target: DropTarget) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = readDragPayload(e);
    if (payload) applyDrop(payload, target);
    dragPayloadRef.current = null;
    setDragging(null);
    setDropTarget(null);
  };

  const allowDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const dropHandlers = customizing
    ? { onDragEnter: allowDrop, onDragOver: allowDrop }
    : { onDragEnter: undefined, onDragOver: undefined };

  const itemDropHint = (groupId: string, itemId: string): 'before' | 'after' | undefined => {
    if (dropTarget?.kind !== 'item') return undefined;
    if (dropTarget.groupId !== groupId || dropTarget.itemId !== itemId) return undefined;
    return dropTarget.position;
  };

  const hiddenGroupsToAdd = getAvailableNavGroupsToAdd(groups);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div ref={shellRef} className="sidebar-nav-shell flex-1 min-h-0 px-2">
        <nav
          ref={contentRef}
          className="sidebar-nav-fit space-y-2"
          aria-label="Operations Suite navigation"
          {...dropHandlers}
          onDragLeave={customizing ? () => setDropTarget(null) : undefined}
        >
          {groups.map((group, groupIndex) => {
            const groupDragging = dragging?.kind === 'group' && dragging.groupId === group.id;
            const groupDropBefore =
              dropTarget?.kind === 'group' &&
              dropTarget.groupId === group.id &&
              dropTarget.position === 'before';
            const groupDropAfter =
              dropTarget?.kind === 'group' &&
              dropTarget.groupId === group.id &&
              dropTarget.position === 'after';

            return (
              <div
                key={group.id}
                className={`relative ${groupDropBefore ? 'sidebar-group-drop-before' : ''} ${groupDropAfter ? 'sidebar-group-drop-after' : ''}`}
                onDragEnter={customizing ? allowDrop : undefined}
                onDragOver={
                  customizing
                    ? (e) => {
                        allowDrop(e);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        setDropTarget({ kind: 'group', groupId: group.id, position });
                      }
                    : undefined
                }
                onDrop={
                  customizing
                    ? (e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                        finishDrop(e, { kind: 'group', groupId: group.id, position });
                      }
                    : undefined
                }
              >
                <section
                  className={`sidebar-group-card rounded-lg border border-brandNavy-800/80 bg-brandNavy-950/40 p-1.5 ${groupDragging ? 'opacity-40' : ''}`}
                >
                  <div
                    className={`flex items-center gap-1.5 px-1 pb-1 ${customizing ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    draggable={customizing}
                    onDragStart={
                      customizing
                        ? (e) => beginDrag(e, { kind: 'group', groupId: group.id })
                        : undefined
                    }
                    onDragEnd={() => {
                      dragPayloadRef.current = null;
                      setDragging(null);
                      setDropTarget(null);
                    }}
                    onDragEnter={customizing ? allowDrop : undefined}
                    onDragOver={
                      customizing
                        ? (e) => {
                            allowDrop(e);
                            setDropTarget({ kind: 'group', groupId: group.id, position: 'after' });
                          }
                        : undefined
                    }
                    onDrop={
                      customizing
                        ? (e) => finishDrop(e, { kind: 'group', groupId: group.id, position: 'after' })
                        : undefined
                    }
                  >
                    {customizing && <span className="sidebar-drag-handle text-slate-600 text-xs select-none">⠿</span>}
                    <h2 className="sidebar-nav-group-label flex-1 font-mono font-bold uppercase tracking-[0.14em] text-slate-500 truncate pointer-events-none">
                      {group.label}
                    </h2>
                    {customizing && (
                      <button
                        type="button"
                        title={`Remove ${group.label} group`}
                        aria-label={`Remove ${group.label} group`}
                        disabled={groups.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          persist(removeNavGroup(groups, group.id));
                        }}
                        className="shrink-0 w-5 h-5 rounded text-slate-600 hover:text-red-400 hover:bg-brandNavy-800 disabled:opacity-30 disabled:pointer-events-none text-sm leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <ul
                    className="space-y-1 min-h-[1.5rem]"
                    onDragEnter={customizing ? allowDrop : undefined}
                    onDragOver={
                      customizing
                        ? (e) => {
                            allowDrop(e);
                            if (group.items.length === 0) {
                              setDropTarget({ kind: 'group', groupId: group.id, position: 'after' });
                            }
                          }
                        : undefined
                    }
                    onDrop={
                      customizing && group.items.length === 0
                        ? (e) => finishDrop(e, { kind: 'group', groupId: group.id, position: 'after' })
                        : undefined
                    }
                  >
                    {group.items.map((item) => (
                      <li key={item.id}>
                        <NavItemCard
                          item={item}
                          groupId={group.id}
                          customizing={customizing}
                          dragging={dragging?.kind === 'item' && dragging.itemId === item.id}
                          dropHint={itemDropHint(group.id, item.id)}
                          onDragStart={(e) => beginDrag(e, { kind: 'item', itemId: item.id, groupId: group.id })}
                          onDragEnd={() => {
                            dragPayloadRef.current = null;
                            setDragging(null);
                            setDropTarget(null);
                          }}
                          onDragEnter={allowDrop}
                          onDragOver={(e) => {
                            allowDrop(e);
                            const rect = e.currentTarget.getBoundingClientRect();
                            const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                            setDropTarget({ kind: 'item', groupId: group.id, itemId: item.id, position });
                          }}
                          onDrop={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                            finishDrop(e, { kind: 'item', groupId: group.id, itemId: item.id, position });
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
                {customizing && groupIndex === groups.length - 1 && (
                  <div
                    className="h-4 mt-1 rounded sidebar-drop-pad"
                    onDragEnter={allowDrop}
                    onDragOver={(e) => {
                      allowDrop(e);
                      setDropTarget({ kind: 'group', groupId: group.id, position: 'after' });
                    }}
                    onDrop={(e) => finishDrop(e, { kind: 'group', groupId: group.id, position: 'after' })}
                  />
                )}
              </div>
            );
          })}
          {customizing && hiddenGroupsToAdd.length > 0 && (
            <div className="px-1 pt-1">
              <label htmlFor="sidebar-add-group" className="sidebar-nav-hint text-slate-500 block mb-1">
                Add group
              </label>
              <select
                id="sidebar-add-group"
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  persist(addNavGroup(groups, e.target.value));
                  e.target.value = '';
                }}
                className="w-full bg-brandNavy-900 border border-brandNavy-700 rounded px-2 py-1 text-xs text-slate-300"
              >
                <option value="">Choose a group…</option>
                {hiddenGroupsToAdd.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </nav>
      </div>

      <div className="pt-2 border-t border-brandNavy-800 space-y-1.5 shrink-0 px-2">
        {customizing ? (
          <>
            <p className="sidebar-nav-hint text-slate-500 leading-snug">
              Drag cards to reorder. Drop on a group header to move between groups. Use × to remove a group card or add one back below.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  persist(groups);
                  setCustomizing(false);
                }}
                className="flex-1 sidebar-nav-btn-primary"
              >
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
