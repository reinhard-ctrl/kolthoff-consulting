import { useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_QUICK_ACTION_IDS, QUICK_ACTION_CATALOG, type QuickActionDef } from '../config/quickActions';
import {
  addQuickAction,
  clearQuickActionPreferences,
  getEffectiveQuickActions,
  removeQuickAction,
  replaceQuickAction,
  reorderQuickActions,
  saveQuickActionPreferences,
} from '../lib/quickActionPreferences';

const MIME = 'application/x-kolthoff-quick-action';

function actionClass(variant: QuickActionDef['variant']) {
  return variant === 'primary'
    ? 'px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm'
    : 'px-4 py-2 bg-brandNavy-800 rounded text-sm border border-brandNavy-700';
}

function editChipClass(dragging?: boolean, dropHint?: 'before' | 'after') {
  return [
    'inline-flex items-center gap-2 rounded border px-3 py-2 text-sm transition-all',
    dragging ? 'opacity-40 scale-[0.98]' : '',
    dropHint === 'before' ? 'ring-2 ring-brandTeal-500/50' : '',
    dropHint === 'after' ? 'border-b-brandTeal-500 border-b-2' : '',
    'bg-brandNavy-800 border-brandNavy-700 text-slate-200 cursor-grab active:cursor-grabbing',
  ].join(' ');
}

export default function QuickActionsBar() {
  const [customizing, setCustomizing] = useState(false);
  const [order, setOrder] = useState<string[]>(() => getEffectiveQuickActions().map((action) => action.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; position: 'before' | 'after' } | null>(null);
  const dragIdRef = useRef<string | null>(null);

  const actions = order.map((id) => QUICK_ACTION_CATALOG.find((action) => action.id === id)).filter(Boolean) as QuickActionDef[];
  const availableToAdd = QUICK_ACTION_CATALOG.filter((action) => !order.includes(action.id));

  const persist = (nextOrder: string[]) => {
    setOrder(nextOrder);
    saveQuickActionPreferences({ order: nextOrder });
  };

  const reset = () => {
    clearQuickActionPreferences();
    setOrder([...DEFAULT_QUICK_ACTION_IDS]);
    setCustomizing(false);
    dragIdRef.current = null;
  };

  const beginDrag = (e: DragEvent, id: string) => {
    e.stopPropagation();
    dragIdRef.current = id;
    e.dataTransfer.setData(MIME, id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  };

  const readDragId = (e: DragEvent): string | null => {
    return e.dataTransfer.getData(MIME) || e.dataTransfer.getData('text/plain') || dragIdRef.current;
  };

  const allowDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const finishDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggedId = readDragId(e);
    if (!draggedId || draggedId === targetId) {
      setDraggingId(null);
      setDropTarget(null);
      dragIdRef.current = null;
      return;
    }

    const fromIndex = order.indexOf(draggedId);
    let toIndex = order.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    if (position === 'after') toIndex += 1;
    if (fromIndex < toIndex) toIndex -= 1;

    persist(reorderQuickActions(order, fromIndex, toIndex));
    dragIdRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="font-bold">Quick Actions</h2>
        {!customizing ? (
          <button type="button" onClick={() => setCustomizing(true)} className="sidebar-nav-btn-secondary">
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                persist(order);
                setCustomizing(false);
              }}
              className="sidebar-nav-btn-primary"
            >
              Done
            </button>
            <button type="button" onClick={reset} className="sidebar-nav-btn-secondary">
              Reset
            </button>
          </div>
        )}
      </div>

      {customizing ? (
        <>
          <p className="sidebar-nav-hint text-slate-500 mb-3">
            Drag to reorder. Use the menu on each action to swap it for another shortcut.
          </p>
          <div
            className="flex flex-wrap gap-3"
            onDragEnter={allowDrop}
            onDragOver={allowDrop}
            onDragLeave={() => setDropTarget(null)}
          >
            {actions.map((action) => {
              const dropHint =
                dropTarget?.id === action.id ? dropTarget.position : undefined;
              return (
                <div
                  key={action.id}
                  draggable
                  onDragStart={(e) => beginDrag(e, action.id)}
                  onDragEnd={() => {
                    dragIdRef.current = null;
                    setDraggingId(null);
                    setDropTarget(null);
                  }}
                  onDragEnter={allowDrop}
                  onDragOver={(e) => {
                    allowDrop(e);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const position =
                      e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
                    setDropTarget({ id: action.id, position });
                  }}
                  onDrop={(e) => finishDrop(e, action.id)}
                  className={editChipClass(draggingId === action.id, dropHint)}
                >
                  <span className="sidebar-drag-handle text-slate-600 select-none" aria-hidden="true">
                    ⠿
                  </span>
                  <span>{action.label}</span>
                  <select
                    value={action.id}
                    onChange={(e) => {
                      const index = order.indexOf(action.id);
                      persist(replaceQuickAction(order, index, e.target.value));
                    }}
                    className="ml-1 max-w-[8rem] bg-brandNavy-900 border border-brandNavy-700 rounded px-1 py-0.5 text-xs text-slate-300"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {QUICK_ACTION_CATALOG.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {order.length > 1 && (
                    <button
                      type="button"
                      onClick={() => persist(removeQuickAction(order, order.indexOf(action.id)))}
                      className="text-slate-500 hover:text-red-400 text-xs px-1"
                      aria-label={`Remove ${action.label}`}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {availableToAdd.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <label htmlFor="quick-action-add" className="text-xs text-slate-500 uppercase tracking-wider">
                Add action
              </label>
              <select
                id="quick-action-add"
                defaultValue=""
                onChange={(e) => {
                  if (!e.target.value) return;
                  persist(addQuickAction(order, e.target.value));
                  e.target.value = '';
                }}
                className="bg-brandNavy-900 border border-brandNavy-700 rounded px-2 py-1 text-sm text-slate-300"
              >
                <option value="">Choose…</option>
                {availableToAdd.map((action) => (
                  <option key={action.id} value={action.id}>
                    {action.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <Link key={action.id} to={action.to} className={actionClass(action.variant)}>
              {action.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
