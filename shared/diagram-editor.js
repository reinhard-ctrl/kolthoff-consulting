/**
 * draw.io diagram engine — shared presets, org chart policy defaults, and helpers.
 * Sets window.DiagramEditor for HTML apps; mirrored in admin/src/lib/diagram-editor.ts.
 */
(function (global) {
  const DRAWIO_EMBED_BASE = 'https://embed.diagrams.net/';

  const BLANK_ORG_CHART_XML =
    '<mxfile host="app.diagrams.net" agent="kolthoff-portal">' +
    '<diagram id="org-chart" name="Organization Chart">' +
    '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850">' +
    '<root><mxCell id="0"/><mxCell id="1" parent="0"/></root>' +
    '</mxGraphModel></diagram></mxfile>';

  const BLANK_BPMN_XML =
    '<mxfile host="app.diagrams.net" agent="kolthoff-portal">' +
    '<diagram id="bpmn" name="Process">' +
    '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850">' +
    '<root><mxCell id="0"/><mxCell id="1" parent="0"/></root>' +
    '</mxGraphModel></diagram></mxfile>';

  const DEFAULT_ORG_CHART_POLICY = {
    title: 'Organizational Structure & Reporting Policy',
    docControl: {
      version: '1.0',
      effectiveDate: '2026-07-06',
      lastReviewed: '2026-07-06',
      owner: 'HR Director',
    },
    introduction:
      'This policy defines the official reporting structure, decision authority, and organizational relationships for all employees. The organization chart is the authoritative reference for reporting lines, escalation paths, and role accountability. This document is reviewed at least annually or whenever material structural changes occur.',
    sections: [
      {
        id: 'oc-1',
        title: 'Purpose & Scope',
        content:
          'This policy applies to all employees, contractors, and managers. It establishes how reporting relationships operate, how decisions escalate, and how organizational changes are communicated and recorded.',
      },
      {
        id: 'oc-2',
        title: 'Reporting Structure',
        content:
          'Every employee reports to a direct manager shown on the official organization chart. Solid lines indicate primary reporting relationships. Dotted lines (if shown) indicate matrix or secondary reporting for specific projects or functions.',
      },
      {
        id: 'oc-3',
        title: 'Decision Authority',
        content:
          'Decision authority follows the reporting hierarchy unless explicitly delegated in writing. Managers are accountable for approvals within their span of control. Cross-functional decisions require consultation with affected department heads.',
      },
      {
        id: 'oc-4',
        title: 'Span of Control & Escalation',
        content:
          'When a manager is unavailable, designated deputies or the next level manager assumes interim authority. Employees must escalate blockers, compliance issues, and client-impacting risks through their direct manager unless an emergency protocol applies.',
      },
      {
        id: 'oc-5',
        title: 'Organizational Change Management',
        content:
          'Structural changes are approved by executive leadership, communicated by HR, and reflected in an updated organization chart within five (5) business days of the effective date. Related Role Profiles and SOP ownership must be updated in Policy Studio.',
      },
      {
        id: 'oc-6',
        title: 'Related Documents',
        content:
          'This policy should be read together with the Employee Handbook, Role Alignment Profile Guides, and applicable Standard Operating Procedures. Role-specific duties are defined in Role Profiles; reporting lines are defined here.',
      },
    ],
    diagram: {
      drawioXml: BLANK_ORG_CHART_XML,
      svgCache: '',
      layout: 'horizontalTree',
      lastDiagramEditAt: null,
    },
    roster: [],
    link: {
      source: 'policy-studio',
      workbookOrgChartField: 'orgChart.drawioXml',
      lastSyncedAt: null,
    },
  };

  const PRESETS = {
    orgChart: {
      id: 'orgChart',
      label: 'Organization Chart',
      blankXml: BLANK_ORG_CHART_XML,
      configure: {
        defaultLibraries: 'general;basic;arrows2',
        enabledLibraries: ['general', 'basic', 'arrows2'],
        css: '',
      },
    },
    bpmn: {
      id: 'bpmn',
      label: 'BPMN 2.0 Workflow',
      blankXml: BLANK_BPMN_XML,
      configure: {
        defaultLibraries: 'bpmn;general',
        enabledLibraries: ['bpmn', 'general'],
        css: '',
      },
    },
  };

  function getDrawioEmbedUrl(options) {
    const opts = options || {};
    const params = new URLSearchParams({
      embed: '1',
      proto: 'json',
      spin: '1',
      configure: '1',
      libraries: '1',
      noSaveBtn: '1',
      saveAndExit: '0',
      noExitBtn: '1',
      ui: opts.ui || 'kennedy',
    });
    if (opts.dark) params.set('dark', '1');
    return DRAWIO_EMBED_BASE + '?' + params.toString();
  }

  function getPreset(presetId) {
    return PRESETS[presetId] || PRESETS.orgChart;
  }

  function stripHtml(value) {
    return String(value || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function parseCellLabel(value) {
    const text = stripHtml(value);
    if (!text) return { name: '', title: '', department: '' };
    const parts = text.split(/\n| — | - /).map((p) => p.trim()).filter(Boolean);
    return {
      name: parts[0] || text,
      title: parts[1] || '',
      department: parts[2] || '',
    };
  }

  /** Parse draw.io mxGraph XML into a roster table (name, title, department, reportsTo). */
  function parseRosterFromDrawioXml(xml) {
    if (!xml || typeof xml !== 'string') return [];
    const rosterById = {};
    const edges = [];

    const cellRegex = /<mxCell\b([^>]*?)\/?>/g;
    let match;
    while ((match = cellRegex.exec(xml)) !== null) {
      const attrs = match[1];
      const idMatch = attrs.match(/\bid="([^"]+)"/);
      const valueMatch = attrs.match(/\bvalue="([^"]*)"/);
      const parentMatch = attrs.match(/\bparent="([^"]+)"/);
      const sourceMatch = attrs.match(/\bsource="([^"]+)"/);
      const targetMatch = attrs.match(/\btarget="([^"]+)"/);
      const isVertex = /\bvertex="1"/.test(attrs);
      const isEdge = /\bedge="1"/.test(attrs);
      const id = idMatch ? idMatch[1] : null;
      if (!id) continue;

      if (isVertex && valueMatch) {
        const label = parseCellLabel(decodeXmlEntities(valueMatch[1]));
        if (!label.name) continue;
        rosterById[id] = {
          id,
          name: label.name,
          title: label.title,
          department: label.department,
          reportsTo: '',
          parentId: parentMatch ? parentMatch[1] : null,
        };
      } else if (isEdge && sourceMatch && targetMatch) {
        edges.push({ source: sourceMatch[1], target: targetMatch[1] });
      }
    }

    edges.forEach(({ source, target }) => {
      if (rosterById[target] && rosterById[source]) {
        rosterById[target].reportsTo = rosterById[source].name;
      }
    });

    return Object.values(rosterById)
      .map(({ id, name, title, department, reportsTo }) => ({
        id,
        name,
        title,
        department,
        reportsTo,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function decodeXmlEntities(str) {
    return String(str || '')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function encodeXmlAttr(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Build a simple draw.io org chart XML from legacy member rows. */
  function membersToDrawioXml(members) {
    const list = (members || []).filter((m) => m && m.name);
    if (!list.length) return BLANK_ORG_CHART_XML;

    const roots = list.filter((m) => !m.managerId || !list.some((x) => x.id === m.managerId));
    const childrenOf = (managerId) => list.filter((m) => m.managerId === managerId);

    let cellId = 2;
    const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
    const nodeIdByMember = {};
    const edgeCells = [];

    const layoutNode = (member, parentCellId, depth, indexInRow) => {
      const myId = String(cellId++);
      nodeIdByMember[member.id] = myId;
      const x = 40 + indexInRow * 220;
      const y = 40 + depth * 140;
      const label = [member.name, member.role || member.title, member.department]
        .filter(Boolean)
        .join('\n');
      cells.push(
        '<mxCell id="' +
          myId +
          '" value="' +
          encodeXmlAttr(label) +
          '" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1" vertex="1" parent="1">' +
          '<mxGeometry x="' +
          x +
          '" y="' +
          y +
          '" width="180" height="70" as="geometry"/>' +
          '</mxCell>',
      );
      if (parentCellId) {
        edgeCells.push(
          '<mxCell id="' +
            cellId++ +
            '" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="' +
            parentCellId +
            '" target="' +
            myId +
            '">' +
            '<mxGeometry relative="1" as="geometry"/>' +
            '</mxCell>',
        );
      }
      const kids = childrenOf(member.id);
      kids.forEach((child, idx) => layoutNode(child, myId, depth + 1, idx));
    };

    roots.forEach((root, idx) => layoutNode(root, null, 0, idx));
    cells.push(...edgeCells);

    return (
      '<mxfile host="app.diagrams.net" agent="kolthoff-portal">' +
      '<diagram id="org-chart" name="Organization Chart">' +
      '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850">' +
      '<root>' +
      cells.join('') +
      '</root></mxGraphModel></diagram></mxfile>'
    );
  }

  function resolveWorkspaceOrgChartXml(profile) {
    if (!profile) return BLANK_ORG_CHART_XML;
    const org = profile.orgChart;
    if (org && typeof org.drawioXml === 'string' && org.drawioXml.trim()) {
      return org.drawioXml;
    }
    const members = Array.isArray(org?.members) ? org.members : [];
    if (members.length) return membersToDrawioXml(members);
    return BLANK_ORG_CHART_XML;
  }

  function compileOrgChartPolicyMarkdown(doc) {
    if (!doc) return '';
    let md = '# ' + (doc.title || 'Organizational Structure & Reporting Policy') + '\n\n';
    if (doc.introduction) md += '## Introduction\n' + doc.introduction + '\n\n';

    (doc.sections || []).forEach((sec, idx) => {
      md += '## ' + (idx + 1) + '. ' + (sec.title || 'Section') + '\n' + (sec.content || '') + '\n\n';
    });

    md += '## Official Organization Chart\n';
    if (doc.diagram?.svgCache) {
      md += '![Organization Chart](' + doc.diagram.svgCache + ')\n\n';
    } else {
      md += '_Organization chart diagram — see Policy Studio for the current visual._\n\n';
    }

    if (doc.roster && doc.roster.length) {
      md += '## Roster Summary\n\n';
      md += '| Name | Title | Department | Reports To |\n';
      md += '|------|-------|------------|------------|\n';
      doc.roster.forEach((row) => {
        md +=
          '| ' +
          [row.name, row.title, row.department, row.reportsTo]
            .map((v) => String(v || '—').replace(/\|/g, '\\|'))
            .join(' | ') +
          ' |\n';
      });
      md += '\n';
    }

    return md.trim();
  }

  function mergeOrgChartPolicy(defaultDoc, loadedDoc) {
    const base = JSON.parse(JSON.stringify(defaultDoc));
    if (!loadedDoc || typeof loadedDoc !== 'object') return base;
    return {
      ...base,
      ...loadedDoc,
      docControl: { ...base.docControl, ...(loadedDoc.docControl || {}) },
      sections: loadedDoc.sections?.length ? loadedDoc.sections : base.sections,
      diagram: {
        ...base.diagram,
        ...(loadedDoc.diagram || {}),
        drawioXml: loadedDoc.diagram?.drawioXml || base.diagram.drawioXml,
      },
      roster: loadedDoc.roster || base.roster,
      link: { ...base.link, ...(loadedDoc.link || {}) },
    };
  }

  global.DiagramEditor = {
    DRAWIO_EMBED_BASE,
    BLANK_ORG_CHART_XML,
    BLANK_BPMN_XML,
    DEFAULT_ORG_CHART_POLICY,
    PRESETS,
    getDrawioEmbedUrl,
    getPreset,
    parseRosterFromDrawioXml,
    membersToDrawioXml,
    resolveWorkspaceOrgChartXml,
    compileOrgChartPolicyMarkdown,
    mergeOrgChartPolicy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
