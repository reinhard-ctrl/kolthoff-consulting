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

  /** Prefer app-specific slice; fall back to legacy tabs[]. */
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
    if (profile.tabs?.length) {
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

  const bundle = {
    SLICE_KEYS,
    stripTabsForSave,
    hydrateTabs,
    mergeTabsById,
    resolveWorkflowTabs,
    buildWorkflowTabsPayload,
  };

  global.WorkflowTabs = bundle;
})(typeof window !== 'undefined' ? window : globalThis);
