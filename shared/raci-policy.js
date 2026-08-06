/**
 * RACI & Decision Authority policy — matrix of activities with R/A/C/I owners.
 * Shape: { title, docControl, introduction, sections[], matrix: [{ id, activity, responsible, accountable, consulted, informed }] }
 */
(function (global) {
  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function createEmptyRaciRow(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    return {
      id: o.id || makeId('raci'),
      activity: o.activity != null ? String(o.activity) : '',
      responsible: o.responsible != null ? String(o.responsible) : '',
      accountable: o.accountable != null ? String(o.accountable) : '',
      consulted: o.consulted != null ? String(o.consulted) : '',
      informed: o.informed != null ? String(o.informed) : '',
    };
  }

  const DEFAULT_RACI_MATRIX = [
    createEmptyRaciRow({
      id: 'raci-hiring',
      activity: 'Hiring & role changes',
      responsible: 'Hiring manager',
      accountable: 'HR Director',
      consulted: 'Department lead',
      informed: 'Leadership',
    }),
    createEmptyRaciRow({
      id: 'raci-escalation',
      activity: 'Client / operational escalations',
      responsible: 'Assigned owner',
      accountable: 'Department lead',
      consulted: 'Cross-functional partners',
      informed: 'Leadership',
    }),
    createEmptyRaciRow({
      id: 'raci-budget',
      activity: 'Budget & spend approvals',
      responsible: 'Requestor',
      accountable: 'Finance / Approver',
      consulted: 'Department lead',
      informed: 'Leadership',
    }),
    createEmptyRaciRow({
      id: 'raci-org-change',
      activity: 'Org structure changes',
      responsible: 'HR',
      accountable: 'Leadership',
      consulted: 'Affected managers',
      informed: 'All staff',
    }),
  ];

  const DEFAULT_RACI_POLICY = {
    title: 'RACI & Decision Authority',
    docControl: {
      version: '1.0',
      effectiveDate: '2026-07-06',
      lastReviewed: '2026-07-06',
      owner: 'HR Director',
    },
    introduction:
      'This policy defines who is Responsible, Accountable, Consulted, and Informed for key company decisions and activities. Use it with the Org Chart and Role Profiles so ownership stays clear.',
    sections: [
      {
        id: 'raci-howto',
        title: 'How to read this matrix',
        content:
          '**Responsible (R)** — does the work.\n**Accountable (A)** — owns the outcome (one person).\n**Consulted (C)** — gives input before the decision.\n**Informed (I)** — is told after the decision.\n\nUpdate this matrix when roles or decision rights change.',
      },
    ],
    matrix: DEFAULT_RACI_MATRIX.map((row) => ({ ...row })),
  };

  function mergeRaciPolicy(defaultDoc, loadedDoc) {
    const base = JSON.parse(JSON.stringify(defaultDoc || DEFAULT_RACI_POLICY));
    if (!loadedDoc || typeof loadedDoc !== 'object') return base;

    // Prefer explicit matrix; also accept legacy orgChart.raciMatrix shape if passed as matrix
    const loadedMatrix = Array.isArray(loadedDoc.matrix)
      ? loadedDoc.matrix
      : (Array.isArray(loadedDoc.raciMatrix) ? loadedDoc.raciMatrix : null);

    return {
      ...base,
      ...loadedDoc,
      docControl: { ...base.docControl, ...(loadedDoc.docControl || {}) },
      sections: loadedDoc.sections?.length ? loadedDoc.sections : base.sections,
      matrix: loadedMatrix
        ? loadedMatrix.map((row) => createEmptyRaciRow(row))
        : (base.matrix || []),
    };
  }

  function compileRaciPolicyMarkdown(doc) {
    const normalized = mergeRaciPolicy(DEFAULT_RACI_POLICY, doc);
    let md = `# ${normalized.title || 'RACI & Decision Authority'}\n\n`;
    if (normalized.introduction) {
      md += `## Introduction\n${normalized.introduction}\n\n`;
    }

    if (normalized.matrix && normalized.matrix.length) {
      md += '## RACI Matrix\n\n';
      md += '| Activity / Decision | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |\n';
      md += '|---------------------|-----------------|-----------------|---------------|-------------|\n';
      normalized.matrix.forEach((row) => {
        md +=
          '| ' +
          [row.activity, row.responsible, row.accountable, row.consulted, row.informed]
            .map((v) => String(v || '—').replace(/\|/g, '\\|'))
            .join(' | ') +
          ' |\n';
      });
      md += '\n';
    }

    (normalized.sections || []).forEach((sec, idx) => {
      md += `## ${idx + 1}. ${sec.title || 'Section'}\n${sec.content || ''}\n\n`;
    });

    return md.trim();
  }

  const api = {
    createEmptyRaciRow,
    DEFAULT_RACI_MATRIX,
    DEFAULT_RACI_POLICY,
    mergeRaciPolicy,
    compileRaciPolicyMarkdown,
  };

  global.RaciPolicy = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
