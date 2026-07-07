/**
 * Build Policy Studio SOP documents from Mod 2 BPMN workflow tabs.
 * Sets window.SopSync for HTML apps.
 */
(function (global) {
  function emptySopDiagram() {
    return { drawioXml: '', svgCache: '', lastDiagramEditAt: null };
  }

  function diagramFromPresent(present) {
    const DE = global.DiagramEditor;
    const norm = DE?.normalizeWorkflowPresent?.(present) || {};
    return {
      drawioXml: norm.drawioXml || '',
      svgCache: norm.svgCache || '',
      lastDiagramEditAt: Date.now(),
    };
  }

  function resolveWorkflowTab(profile, options) {
    const opts = options || {};
    const wt = global.WorkflowTabs?.getWorkflowTabs?.(profile);
    const tabs = wt?.tabs || [];
    if (opts.tabId) {
      const byId = tabs.find((t) => t.id === opts.tabId);
      if (byId) return byId;
    }
    if (opts.tabName) {
      const normalized = String(opts.tabName).trim().toLowerCase();
      return tabs.find((t) => String(t.name || '').trim().toLowerCase() === normalized) || null;
    }
    return null;
  }

  function buildSopFromWorkflowTab(tab, profile) {
    const DE = global.DiagramEditor;
    const vm = DE?.getWorkflowViewModel(tab?.present) || { tasks: [], lanes: [] };
    const sortedNodes = vm.tasks.filter((t) => t.type !== 'gateway' && t.type !== 'event');

    if (sortedNodes.length === 0) return null;

    const rRoles = [];
    const aRoles = [];
    const cRoles = [];
    const iRoles = [];

    sortedNodes.forEach((node) => {
      if (node.owner && node.owner !== 'Unassigned' && !rRoles.includes(node.owner)) {
        rRoles.push(node.owner);
      }
    });

    if (profile?.raciAssignments) {
      sortedNodes.forEach((node) => {
        const nodeRaci = profile.raciAssignments[node.id];
        if (!nodeRaci) return;
        Object.entries(nodeRaci).forEach(([laneId, value]) => {
          const lane = vm.lanes.find((l) => l.id === laneId);
          if (!lane) return;
          const name = lane.label.replace(/\n/g, ' ');
          if (value === 'R' && !rRoles.includes(name)) rRoles.push(name);
          if (value === 'A' && !aRoles.includes(name)) aRoles.push(name);
          if (value === 'C' && !cRoles.includes(name)) cRoles.push(name);
          if (value === 'I' && !iRoles.includes(name)) iRoles.push(name);
        });
      });
    }

    const mappedSteps = sortedNodes.map((node) => ({
      id: node.id,
      action: node.label,
      owner: node.owner || 'Unassigned',
      duration: node.duration || '1 Hour',
      details: node.description || 'Proceed with standard operational precautions as defined in the BPMN workflow.',
    }));

    const uniqueLanes = [...new Set(mappedSteps.map((s) => s.owner).filter((o) => o !== 'Unassigned'))];
    const today = new Date().toISOString().split('T')[0];

    return {
      id: 'sop-' + tab.id,
      title: tab.name,
      docControl: {
        version: '1.0',
        effectiveDate: today,
        lastReviewed: today,
        owner: uniqueLanes[0] || 'Operations Lead',
      },
      objective: `To standardize the execution steps of the ${tab.name} workflow to optimize efficiency, limit errors, and minimize operational delay points.`,
      scope: `Applies to all ${uniqueLanes.join(', ') || 'relevant functional team'} personnel involved in this process path.`,
      prerequisites: `1. Fully trained status on ${tab.name} architecture.\n2. Access to primary software/tools as diagrammed.`,
      kpis: '1. SLA target times met per process node.\n2. Less than 5% delay deviation on handoffs.',
      troubleshooting: '1. Delay on Handoff: Escalate to direct supervisor immediately if an orthogonal pathway stalls.',
      raci: {
        responsible: rRoles.join(', ') || 'Fulfillment Team',
        accountable: aRoles.join(', ') || uniqueLanes[0] || 'Manager',
        consulted: cRoles.join(', ') || 'Consulted Stakeholders',
        informed: iRoles.join(', ') || 'Finance/Management',
      },
      steps: mappedSteps,
      diagram: diagramFromPresent(tab?.present),
      link: {
        source: 'workflow-builder',
        workflowTabId: tab.id,
        workbookWorkflowField: 'workflowBuilder',
        lastSyncedAt: Date.now(),
      },
    };
  }

  /** Preserve diagram/link when loading saved policy SOPs. */
  function mergeSopDocument(defaultSop, loadedSop) {
    const base = defaultSop && typeof defaultSop === 'object' ? defaultSop : {};
    const loaded = loadedSop && typeof loadedSop === 'object' ? loadedSop : {};
    return {
      ...base,
      ...loaded,
      docControl: { ...(base.docControl || {}), ...(loaded.docControl || {}) },
      raci: { ...(base.raci || {}), ...(loaded.raci || {}) },
      diagram: {
        ...emptySopDiagram(),
        ...(base.diagram || {}),
        ...(loaded.diagram || {}),
      },
      link: { ...(base.link || {}), ...(loaded.link || {}) },
      steps: Array.isArray(loaded.steps) ? loaded.steps : base.steps || [],
    };
  }

  function refreshSopStepsFromDiagram(sop, profile) {
    if (!sop?.diagram?.drawioXml) return null;
    const tab = {
      id: sop.link?.workflowTabId || sop.id,
      name: sop.title,
      present: sop.diagram,
    };
    const rebuilt = buildSopFromWorkflowTab(tab, profile);
    if (!rebuilt) return null;
    return {
      ...sop,
      steps: rebuilt.steps,
      raci: rebuilt.raci,
    };
  }

  function syncSopFromWorkspace(sop, profile) {
    const tab = resolveWorkflowTab(profile, {
      tabId: sop?.link?.workflowTabId,
      tabName: sop?.title,
    });
    if (!tab) return null;
    const built = buildSopFromWorkflowTab(tab, profile);
    if (!built) return null;
    return { ...built, id: sop.id };
  }

  /** Merge generated SOPs into policy pack data by tab title (case-insensitive). */
  function mergeSopsIntoPolicyData(policyData, sops) {
    const base = policyData && typeof policyData === 'object' ? { ...policyData } : {};
    const existing = Array.isArray(base.sops) ? base.sops : [];
    const titles = new Set((sops || []).map((s) => s.title.toLowerCase()));
    const kept = existing.filter((s) => !titles.has(String(s.title || '').toLowerCase()));
    return {
      ...base,
      sops: [...kept, ...(sops || [])],
    };
  }

  function buildSopsFromWorkflowTabs(tabs, profile) {
    return (tabs || [])
      .map((tab) => buildSopFromWorkflowTab(tab, profile))
      .filter(Boolean);
  }

  const bundle = {
    emptySopDiagram,
    resolveWorkflowTab,
    buildSopFromWorkflowTab,
    buildSopsFromWorkflowTabs,
    mergeSopDocument,
    mergeSopsIntoPolicyData,
    refreshSopStepsFromDiagram,
    syncSopFromWorkspace,
  };

  global.SopSync = bundle;
})(typeof window !== 'undefined' ? window : globalThis);
