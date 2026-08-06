/**
 * RACI & Decision Authority policy — one or more topic matrices with R/A/C/I rows.
 * Shape: {
 *   title, docControl, introduction, sections[],
 *   matrices: [{ id, title, rows: [{ id, activity, responsible, accountable, consulted, informed }] }]
 * }
 * Legacy flat `matrix` / `raciMatrix` arrays are normalized into a single matrices[] group.
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

  function createEmptyRaciMatrix(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    const rows = Array.isArray(o.rows)
      ? o.rows.map((r) => createEmptyRaciRow(r))
      : [createEmptyRaciRow({ activity: 'New decision / activity' })];
    return {
      id: o.id || makeId('mx'),
      title: o.title != null ? String(o.title) : 'Untitled topic',
      rows,
    };
  }

  const DEFAULT_RACI_MATRICES = [
    createEmptyRaciMatrix({
      id: 'mx-people',
      title: 'People & HR',
      rows: [
        createEmptyRaciRow({
          id: 'raci-hiring',
          activity: 'Hiring & role changes',
          responsible: 'Hiring manager',
          accountable: 'HR Director',
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
      ],
    }),
    createEmptyRaciMatrix({
      id: 'mx-ops',
      title: 'Operations',
      rows: [
        createEmptyRaciRow({
          id: 'raci-escalation',
          activity: 'Client / operational escalations',
          responsible: 'Assigned owner',
          accountable: 'Department lead',
          consulted: 'Cross-functional partners',
          informed: 'Leadership',
        }),
      ],
    }),
    createEmptyRaciMatrix({
      id: 'mx-finance',
      title: 'Finance',
      rows: [
        createEmptyRaciRow({
          id: 'raci-budget',
          activity: 'Budget & spend approvals',
          responsible: 'Requestor',
          accountable: 'Finance / Approver',
          consulted: 'Department lead',
          informed: 'Leadership',
        }),
      ],
    }),
  ];

  /** Flatten all matrix rows (compat helper / flat mirror). */
  function flattenMatrices(matrices) {
    const out = [];
    (matrices || []).forEach((mx) => {
      (mx.rows || []).forEach((row) => out.push({ ...row }));
    });
    return out;
  }

  /**
   * Normalize to matrices[]. Accepts:
   * - matrices[] (preferred)
   * - flat matrix[] / raciMatrix[] (legacy single group)
   */
  function normalizeMatrices(raw) {
    const doc = raw && typeof raw === 'object' ? raw : {};
    if (Array.isArray(doc.matrices) && doc.matrices.length > 0) {
      return doc.matrices.map((mx) =>
        createEmptyRaciMatrix({
          id: mx.id,
          title: mx.title || 'Untitled topic',
          rows: Array.isArray(mx.rows) && mx.rows.length
            ? mx.rows
            : [{ activity: 'New decision / activity' }],
        }),
      );
    }
    const flat = Array.isArray(doc.matrix) && doc.matrix.length
      ? doc.matrix
      : (Array.isArray(doc.raciMatrix) && doc.raciMatrix.length ? doc.raciMatrix : null);
    if (flat) {
      return [
        createEmptyRaciMatrix({
          id: doc._legacyMatrixId || 'mx-main',
          title: doc._legacyMatrixTitle || 'General',
          rows: flat,
        }),
      ];
    }
    return DEFAULT_RACI_MATRICES.map((mx) => createEmptyRaciMatrix(mx));
  }

  const DEFAULT_RACI_POLICY = {
    title: 'RACI & Decision Authority',
    docControl: {
      version: '1.0',
      effectiveDate: '2026-07-06',
      lastReviewed: '2026-07-06',
      owner: 'HR Director',
    },
    introduction:
      'This policy defines who is Responsible, Accountable, Consulted, and Informed for key company decisions and activities. Group matrices by topic or category so ownership stays clear.',
    sections: [
      {
        id: 'raci-howto',
        title: 'How to read this matrix',
        content:
          '**Responsible (R)** — does the work.\n**Accountable (A)** — owns the outcome (one person).\n**Consulted (C)** — gives input before the decision.\n**Informed (I)** — is told after the decision.\n\nAdd a matrix per topic (People, Operations, Finance, etc.) and update rows when roles or decision rights change.',
      },
    ],
    matrices: DEFAULT_RACI_MATRICES.map((mx) => createEmptyRaciMatrix(mx)),
    // Flat mirror for older readers / simple consumers
    matrix: flattenMatrices(DEFAULT_RACI_MATRICES),
  };

  function mergeRaciPolicy(defaultDoc, loadedDoc) {
    const base = JSON.parse(JSON.stringify(defaultDoc || DEFAULT_RACI_POLICY));
    if (!loadedDoc || typeof loadedDoc !== 'object') {
      const matrices = normalizeMatrices(base);
      return { ...base, matrices, matrix: flattenMatrices(matrices) };
    }

    // Prefer loaded matrices/flat rows over defaults so legacy single-matrix docs migrate cleanly.
    let matricesSource;
    if (Array.isArray(loadedDoc.matrices) && loadedDoc.matrices.length) {
      matricesSource = { matrices: loadedDoc.matrices };
    } else if (Array.isArray(loadedDoc.matrix) && loadedDoc.matrix.length) {
      matricesSource = {
        matrix: loadedDoc.matrix,
        _legacyMatrixTitle: loadedDoc._legacyMatrixTitle || 'General',
      };
    } else if (Array.isArray(loadedDoc.raciMatrix) && loadedDoc.raciMatrix.length) {
      matricesSource = {
        raciMatrix: loadedDoc.raciMatrix,
        _legacyMatrixTitle: 'General',
      };
    } else {
      matricesSource = { matrices: base.matrices };
    }

    const matrices = normalizeMatrices(matricesSource);
    const { raciMatrix: _legacyOrg, ...loadedClean } = loadedDoc;
    return {
      ...base,
      ...loadedClean,
      docControl: { ...base.docControl, ...(loadedDoc.docControl || {}) },
      sections: loadedDoc.sections?.length ? loadedDoc.sections : base.sections,
      matrices,
      matrix: flattenMatrices(matrices),
    };
  }

  function compileRaciPolicyMarkdown(doc) {
    const normalized = mergeRaciPolicy(DEFAULT_RACI_POLICY, doc);
    let md = `# ${normalized.title || 'RACI & Decision Authority'}\n\n`;
    if (normalized.introduction) {
      md += `## Introduction\n${normalized.introduction}\n\n`;
    }

    (normalized.matrices || []).forEach((mx, idx) => {
      const heading = mx.title || `Topic ${idx + 1}`;
      md += `## ${idx + 1}. ${heading}\n\n`;
      md += '| Activity / Decision | Responsible (R) | Accountable (A) | Consulted (C) | Informed (I) |\n';
      md += '|---------------------|-----------------|-----------------|---------------|-------------|\n';
      (mx.rows || []).forEach((row) => {
        md +=
          '| ' +
          [row.activity, row.responsible, row.accountable, row.consulted, row.informed]
            .map((v) => String(v || '—').replace(/\|/g, '\\|'))
            .join(' | ') +
          ' |\n';
      });
      md += '\n';
    });

    (normalized.sections || []).forEach((sec, idx) => {
      md += `## ${sec.title || `Section ${idx + 1}`}\n${sec.content || ''}\n\n`;
    });

    return md.trim();
  }

  const api = {
    createEmptyRaciRow,
    createEmptyRaciMatrix,
    flattenMatrices,
    normalizeMatrices,
    DEFAULT_RACI_MATRICES,
    DEFAULT_RACI_POLICY,
    mergeRaciPolicy,
    compileRaciPolicyMarkdown,
  };

  global.RaciPolicy = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
