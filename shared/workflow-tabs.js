/**
 * Workflow tab persistence — app-specific slices on workbook_profiles to avoid clobbering.
 * Sets window.WorkflowTabs for legacy HTML apps.
 */
(function (global) {
  const SLICE_KEYS = {
    diagnosis: 'diagnosisWorkflow',
    workflow: 'workflowBuilder',
  };

  function stripTabsForSave(tabs) {
    return (tabs || []).map((t) => ({ id: t.id, name: t.name, present: t.present }));
  }

  function hydrateTabs(storedTabs) {
    return (storedTabs || []).map((t) => ({ ...t, past: [], future: [] }));
  }

  /** Merge overlay tabs over base by id; overlay order first, then remaining base tabs. */
  function mergeTabsById(baseTabs, overlayTabs) {
    const byId = {};
    (baseTabs || []).forEach((t) => {
      byId[t.id] = { id: t.id, name: t.name, present: t.present };
    });
    (overlayTabs || []).forEach((t) => {
      byId[t.id] = { id: t.id, name: t.name, present: t.present };
    });
    const order = [];
    (overlayTabs || []).forEach((t) => {
      if (!order.includes(t.id)) order.push(t.id);
    });
    (baseTabs || []).forEach((t) => {
      if (!order.includes(t.id)) order.push(t.id);
    });
    return order.map((id) => byId[id]);
  }

  /** True when profile uses Mod 1 / Mod 2 slice fields (post-split). */
  function hasSliceSplit(profile) {
    return !!(profile?.diagnosisWorkflow || profile?.workflowBuilder);
  }

  /** Prefer app-specific slice; fall back to legacy tabs[] only before slice split. */
  function resolveWorkflowTabs(profile, app) {
    if (!profile) return null;
    const sliceKey = SLICE_KEYS[app];
    const slice = profile[sliceKey];
    if (slice?.tabs?.length) {
      return {
        tabs: slice.tabs,
        activeTabId: slice.activeTabId || slice.tabs[0].id,
        source: sliceKey,
      };
    }
    if (!hasSliceSplit(profile) && profile.tabs?.length) {
      return {
        tabs: profile.tabs,
        activeTabId: profile.activeTabId || profile.tabs[0].id,
        source: 'tabs',
      };
    }
    return null;
  }

  /**
   * Build merge payload: store app slice + canonical tabs merged with the other app's slice.
   * @param {'diagnosis'|'workflow'} app
   */
  function buildWorkflowTabsPayload(app, localTabs, activeTabId, existingProfile) {
    const clean = stripTabsForSave(localTabs);
    const sliceKey = SLICE_KEYS[app];
    const otherKey = app === 'diagnosis' ? SLICE_KEYS.workflow : SLICE_KEYS.diagnosis;
    const otherSlice = existingProfile?.[otherKey];
    const canonicalTabs = mergeTabsById(otherSlice?.tabs, clean);

    return {
      [sliceKey]: { tabs: clean, activeTabId, updatedAt: Date.now() },
      tabs: canonicalTabs,
      activeTabId,
    };
  }

  /**
   * Mod 1 diagnosis report tabs — as-is workflows only.
   * Falls back to workflowBuilder for profiles created before the slice split.
   */
  function getDiagnosisTabs(profile) {
    if (!profile) return { tabs: [], activeTabId: null, source: null };
    const dx = resolveWorkflowTabs(profile, 'diagnosis');
    if (dx?.tabs?.length) {
      return { tabs: dx.tabs, activeTabId: dx.activeTabId, source: dx.source };
    }
    const wf = resolveWorkflowTabs(profile, 'workflow');
    if (wf?.tabs?.length && wf.source === 'workflowBuilder') {
      return { tabs: wf.tabs, activeTabId: wf.activeTabId, source: 'workflowBuilder (legacy fallback)' };
    }
    if (!hasSliceSplit(profile) && profile.tabs?.length) {
      return {
        tabs: profile.tabs,
        activeTabId: profile.activeTabId || profile.tabs[0].id,
        source: 'tabs',
      };
    }
    return { tabs: [], activeTabId: null, source: null };
  }

  /** Mod 2 workflow builder tabs — to-be workflows only (never Mod 1 as-is). */
  function getWorkflowTabs(profile) {
    if (!profile) return { tabs: [], activeTabId: null, source: null };
    const wf = resolveWorkflowTabs(profile, 'workflow');
    if (wf?.tabs?.length) {
      return { tabs: wf.tabs, activeTabId: wf.activeTabId, source: wf.source };
    }
    return { tabs: [], activeTabId: null, source: null };
  }

  /**
   * Parse workflow app slice from URL (?slice=diagnosis|workflow).
   * Defaults to workflow (Mod 2).
   */
  function parseWorkflowAppFromSearch(search) {
    let slice = 'workflow';
    const raw = typeof search === 'string' ? search.replace(/^\?/, '') : '';
    raw.split('&').forEach((pair) => {
      if (!pair) return;
      const eq = pair.indexOf('=');
      const key = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      const val = decodeURIComponent(eq >= 0 ? pair.slice(eq + 1) : '');
      if (key === 'slice' || key === 'app') slice = (val || '').toLowerCase();
    });
    return slice === 'diagnosis' ? 'diagnosis' : 'workflow';
  }

  /**
   * Load tabs for a workflow editor app, with cross-slice fallback for legacy profiles.
   */
  function resolveEditorTabs(profile, app) {
    const primary = resolveWorkflowTabs(profile, app);
    if (primary?.tabs?.length) {
      return { tabs: primary.tabs, activeTabId: primary.activeTabId, source: primary.source };
    }
    if (app === 'diagnosis') {
      return getDiagnosisTabs(profile);
    }
    return getWorkflowTabs(profile);
  }

  /**
   * Merged tabs for read-only consumers that need both Mod 1 and Mod 2 slices.
   * Mod 1 editor and Leak Scan Report should use getDiagnosisTabs() — as-is only.
   */
  function getReportTabs(profile) {
    if (!profile) return [];
    const wf = resolveWorkflowTabs(profile, 'workflow');
    const dx = resolveWorkflowTabs(profile, 'diagnosis');
    if (wf?.tabs?.length && dx?.tabs?.length) {
      return mergeTabsById(dx.tabs, wf.tabs);
    }
    return wf?.tabs || dx?.tabs || profile.tabs || [];
  }

  const bundle = {
    SLICE_KEYS,
    stripTabsForSave,
    hydrateTabs,
    mergeTabsById,
    hasSliceSplit,
    resolveWorkflowTabs,
    buildWorkflowTabsPayload,
    getDiagnosisTabs,
    getWorkflowTabs,
    parseWorkflowAppFromSearch,
    resolveEditorTabs,
    getReportTabs,
  };

  global.WorkflowTabs = bundle;
})(typeof window !== 'undefined' ? window : globalThis);
