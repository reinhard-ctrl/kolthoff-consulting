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
      embedLibs: 'general;basic;arrows2',
      configure: {
        defaultLibraries: 'general;basic;arrows2',
        enabledLibraries: ['general', 'basic', 'arrows2'],
        css: '',
        title: 'Organization Chart',
      },
    },
    bpmn: {
      id: 'bpmn',
      label: 'BPMN 2.0 Workflow',
      blankXml: BLANK_BPMN_XML,
      embedLibs: 'bpmn',
      configure: {
        defaultLibraries: 'bpmn;general;flowchart;basic;arrows2',
        enabledLibraries: ['bpmn', 'general', 'flowchart', 'basic', 'arrows2'],
        css: '',
        title: 'BPMN 2.0 Workflow',
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
    if (opts.libs) params.set('libs', opts.libs);
    if (opts.dark) params.set('dark', '1');
    return DRAWIO_EMBED_BASE + '?' + params.toString();
  }

  function getPreset(presetId) {
    return PRESETS[presetId] || PRESETS.orgChart;
  }

  function stripHtml(value) {
    return String(value || '')
      // draw.io rectangle labels often use <div>/<p> per line (Name / Role / Dept).
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(div|p|li|h[1-6]|tr)\s*>/gi, '\n')
      .replace(/<\s*(div|p|li|h[1-6]|tr)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // Keep newlines so org-chart Name/Title/Dept lines stay separable.
      .replace(/[^\S\n]+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();
  }

  function parseCellLabel(value) {
    const text = stripHtml(value);
    if (!text) return { name: '', title: '', department: '' };
    // Prefer line breaks; also accept common separators users type in one line.
    const parts = text
      .split(/\n+| \| | — | – | - | \/ /)
      .map((p) => p.trim())
      .filter(Boolean);
    return {
      name: parts[0] || text,
      title: parts[1] || '',
      department: parts[2] || '',
    };
  }

  function decodeXmlEntities(str) {
    return String(str || '')
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) ? String.fromCharCode(code) : '';
      })
      .replace(/&#(\d+);/g, (_, dec) => {
        const code = parseInt(dec, 10);
        return Number.isFinite(code) ? String.fromCharCode(code) : '';
      })
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  function upsertRosterVertex(rosterById, id, rawLabel, parentId) {
    if (!id) return;
    const label = parseCellLabel(decodeXmlEntities(rawLabel || ''));
    if (!label.name) return;
    rosterById[id] = {
      id,
      name: label.name,
      title: label.title,
      department: label.department,
      reportsTo: '',
      parentId: parentId || null,
    };
  }

  /** Parse draw.io mxGraph XML into a roster table (name, title, department, reportsTo). */
  function parseRosterFromDrawioXml(xml) {
    if (!xml || typeof xml !== 'string') return [];
    const rosterById = {};
    const edges = [];

    // draw.io org-chart shapes often wrap labels in <object>/<UserObject> with id on the wrapper.
    const objectRegex = /<(?:object|UserObject)\b([^>]*)>([\s\S]*?)<\/(?:object|UserObject)>/gi;
    let objectMatch;
    while ((objectMatch = objectRegex.exec(xml)) !== null) {
      const attrs = objectMatch[1] || '';
      const inner = objectMatch[2] || '';
      const id = attrs.match(/\bid="([^"]+)"/)?.[1];
      const label =
        attrs.match(/\blabel="([^"]*)"/)?.[1] ||
        attrs.match(/\bvalue="([^"]*)"/)?.[1] ||
        '';
      const nestedCell = inner.match(/<mxCell\b([^>]*)\/?>/i);
      const nestedAttrs = nestedCell?.[1] || '';
      const isVertex = /\bvertex="1"/.test(nestedAttrs) || !nestedCell;
      if (!isVertex) continue;
      const parentId = nestedAttrs.match(/\bparent="([^"]+)"/)?.[1] || null;
      upsertRosterVertex(rosterById, id, label, parentId);
    }

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

      if (isVertex && valueMatch && !rosterById[id]) {
        upsertRosterVertex(rosterById, id, valueMatch[1], parentMatch ? parentMatch[1] : null);
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

  /** Prefer freshly parsed roster rows; keep prior members when parse returns empty. */
  function resolveOrgChartMembers(xml, fallbackMembers) {
    const parsed = parseRosterFromDrawioXml(xml);
    if (parsed.length) return parsed;
    return Array.isArray(fallbackMembers) ? fallbackMembers : [];
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

  function createEmptyWorkflowPresent() {
    return {
      format: 'bpmn',
      drawioXml: BLANK_BPMN_XML,
      svgCache: '',
      cellMeta: {},
    };
  }

  function normalizeWorkflowPresent(present) {
    if (!present || typeof present !== 'object') return createEmptyWorkflowPresent();
    if (typeof present.drawioXml === 'string' && present.drawioXml.trim()) {
      return {
        format: 'bpmn',
        drawioXml: present.drawioXml,
        svgCache: present.svgCache || '',
        cellMeta: present.cellMeta || {},
      };
    }
    if (Array.isArray(present.nodes)) {
      return {
        format: 'legacy',
        nodes: present.nodes || [],
        edges: present.edges || [],
        lanes: present.lanes || [],
        phases: present.phases || [],
        cellMeta: present.cellMeta || {},
      };
    }
    return createEmptyWorkflowPresent();
  }

  function parseDrawioXmlCells(xml) {
    if (!xml || typeof xml !== 'string') return [];
    const cells = [];
    const re = /<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g;
    let match;
    while ((match = re.exec(xml)) !== null) {
      const attrs = match[1];
      const inner = match[2] || '';
      const idMatch = attrs.match(/\bid="([^"]+)"/);
      if (!idMatch) continue;
      const valueMatch = attrs.match(/\bvalue="([^"]*)"/);
      const styleMatch = attrs.match(/\bstyle="([^"]*)"/);
      const parentMatch = attrs.match(/\bparent="([^"]+)"/);
      const sourceMatch = attrs.match(/\bsource="([^"]+)"/);
      const targetMatch = attrs.match(/\btarget="([^"]+)"/);
      const geoMatch = (attrs + inner).match(/<mxGeometry[^>]*\bx="([^"]+)"[^>]*\by="([^"]+)"/);
      cells.push({
        id: idMatch[1],
        value: valueMatch ? decodeXmlEntities(valueMatch[1]) : '',
        style: styleMatch ? styleMatch[1] : '',
        vertex: /\bvertex="1"/.test(attrs),
        edge: /\bedge="1"/.test(attrs),
        parent: parentMatch ? parentMatch[1] : null,
        source: sourceMatch ? sourceMatch[1] : null,
        target: targetMatch ? targetMatch[1] : null,
        x: geoMatch ? Number(geoMatch[1]) : 0,
        y: geoMatch ? Number(geoMatch[2]) : 0,
      });
    }
    return cells;
  }

  function isBpmnLane(style) {
    const s = style || '';
    return /swimlane/i.test(s) || /mxgraph\.bpmn\.lane/i.test(s) || /part=swimlane/i.test(s);
  }

  function isBpmnPool(style) {
    const s = style || '';
    return /mxgraph\.bpmn\.pool/i.test(s) || /shape=pool/i.test(s);
  }

  function isBpmnContainer(style) {
    return isBpmnLane(style) || isBpmnPool(style) || /group/i.test(style);
  }

  function getFlowNodeSortKey(node, cellById) {
    const cell = cellById.get(node.id);
    const x = node.x ?? cell?.x ?? 0;
    const y = node.y ?? cell?.y ?? 0;
    return { x, y, label: node.label || '' };
  }

  /** Order BPMN shapes by sequence flow edges; fall back to canvas position for ties and orphans. */
  function orderNodesByFlowSequence(nodes, cells) {
    const list = nodes || [];
    if (list.length <= 1) return list.slice();

    const nodeIds = new Set(list.map((n) => n.id));
    const cellById = new Map((cells || []).map((c) => [c.id, c]));
    const compareNodes = (aId, bId) => {
      const a = getFlowNodeSortKey(list.find((n) => n.id === aId) || { id: aId }, cellById);
      const b = getFlowNodeSortKey(list.find((n) => n.id === bId) || { id: bId }, cellById);
      return a.y - b.y || a.x - b.x || a.label.localeCompare(b.label);
    };

    const adjacency = new Map();
    const inDegree = new Map();
    nodeIds.forEach((id) => {
      adjacency.set(id, []);
      inDegree.set(id, 0);
    });

    (cells || []).forEach((cell) => {
      if (!cell.edge || !cell.source || !cell.target) return;
      if (!nodeIds.has(cell.source) || !nodeIds.has(cell.target)) return;
      adjacency.get(cell.source).push(cell.target);
      inDegree.set(cell.target, (inDegree.get(cell.target) || 0) + 1);
    });

    adjacency.forEach((targets, source) => {
      targets.sort(compareNodes);
    });

    const queue = [...nodeIds].filter((id) => inDegree.get(id) === 0).sort(compareNodes);
    const orderedIds = [];
    const seen = new Set();

    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      orderedIds.push(id);
      (adjacency.get(id) || []).forEach((next) => {
        inDegree.set(next, inDegree.get(next) - 1);
        if (inDegree.get(next) === 0) {
          queue.push(next);
          queue.sort(compareNodes);
        }
      });
    }

    const nodeById = new Map(list.map((n) => [n.id, n]));
    const ordered = orderedIds.map((id) => nodeById.get(id)).filter(Boolean);
    const remaining = list
      .filter((n) => !seen.has(n.id))
      .sort((a, b) => compareNodes(a.id, b.id));
    return [...ordered, ...remaining];
  }

  function parseBpmnFromDrawioXml(xml) {
    const cells = parseDrawioXmlCells(xml);
    const lanes = cells
      .filter((c) => c.vertex && isBpmnLane(c.style))
      .map((c) => {
        const label = parseCellLabel(c.value);
        return {
          id: c.id,
          label: label.name || 'Lane',
          owner: label.title || label.name || '',
          x: c.x,
          y: c.y,
        };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x);

    const laneIds = new Set(lanes.map((l) => l.id));
    const tasks = cells
      .filter((c) => c.vertex && !c.edge && c.value && !isBpmnContainer(c.style))
      .map((c) => {
        const label = stripHtml(c.value).replace(/\n/g, ' ').trim();
        const laneId = laneIds.has(c.parent) ? c.parent : '';
        const lane = lanes.find((l) => l.id === laneId);
        return {
          id: c.id,
          label,
          owner: lane ? lane.label : 'Unassigned',
          laneId,
          x: c.x,
          y: c.y,
          type: /gateway/i.test(c.style) ? 'gateway' : /event/i.test(c.style) ? 'event' : 'task',
          delayMinutes: 0,
          affectedStaff: 1,
          hourlyRate: 150,
          duration: '1 Hour',
          description: '',
        };
      });

    const orderedTasks = orderNodesByFlowSequence(tasks, cells);

    return { tasks: orderedTasks, lanes };
  }

  function getLegacyWorkflowViewModel(present) {
    const lanes = (present.lanes || [])
      .slice()
      .sort((a, b) => a.y - b.y)
      .map((l) => ({
        id: l.id,
        label: String(l.label || '').replace(/\n/g, ' '),
        owner: l.owner || '',
      }));
    const tasks = (present.nodes || [])
      .filter((n) => n.type === 'process' || n.type === 'approval')
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((n) => {
        const lane = lanes.find((l) => l.id === n.roleId);
        return {
          id: n.id,
          label: String(n.label || '').replace(/\n/g, ' '),
          owner: lane ? lane.label : 'Unassigned',
          laneId: n.roleId || '',
          x: n.x,
          y: n.y,
          type: n.type,
          delayMinutes: Number(n.delayMinutes) || 0,
          affectedStaff: Number(n.affectedStaff) || 1,
          hourlyRate: Number(n.hourlyRate) || 150,
          duration: n.duration || '1 Hour',
          description: n.description || '',
        };
      });
    return {
      format: 'legacy',
      drawioXml: '',
      svgCache: '',
      tasks,
      lanes,
    };
  }

  /** Unified tasks + lanes for RACI, SOP sync, chaos tax, and reports. */
  function getWorkflowViewModel(present) {
    const norm = normalizeWorkflowPresent(present);
    if (norm.format === 'legacy') {
      return getLegacyWorkflowViewModel(norm);
    }
    const parsed = parseBpmnFromDrawioXml(norm.drawioXml);
    const cellMeta = norm.cellMeta || {};
    const tasks = parsed.tasks.map((task) => {
      const meta = cellMeta[task.id] || {};
      return {
        ...task,
        delayMinutes: Number(meta.delayMinutes) || 0,
        affectedStaff: Number(meta.affectedStaff) || 1,
        hourlyRate: Number(meta.hourlyRate) || 150,
        duration: meta.duration || task.duration || '1 Hour',
        description: meta.description || task.description || '',
        risk: meta.risk || '',
      };
    });
    const lanes = parsed.lanes.length
      ? parsed.lanes
      : [{ id: 'lane-default', label: 'Responsible Role', owner: '' }];
    return {
      format: 'bpmn',
      drawioXml: norm.drawioXml,
      svgCache: norm.svgCache || '',
      tasks,
      lanes,
    };
  }

  function computeTabChaosTax(tasks) {
    let annual = 0;
    let dailyHours = 0;
    (tasks || []).forEach((task) => {
      if (task.type === 'gateway' || task.type === 'event') return;
      const dailyWasteHours = ((Number(task.delayMinutes) || 0) * (Number(task.affectedStaff) || 1)) / 60;
      dailyHours += dailyWasteHours;
      annual += dailyWasteHours * (Number(task.hourlyRate) || 0) * 22 * 12;
    });
    return { annual: Math.round(annual), dailyHours };
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
    resolveOrgChartMembers,
    parseDrawioXmlCells,
    orderNodesByFlowSequence,
    parseBpmnFromDrawioXml,
    membersToDrawioXml,
    resolveWorkspaceOrgChartXml,
    compileOrgChartPolicyMarkdown,
    mergeOrgChartPolicy,
    createEmptyWorkflowPresent,
    normalizeWorkflowPresent,
    getWorkflowViewModel,
    computeTabChaosTax,
  };
})(typeof window !== 'undefined' ? window : globalThis);
