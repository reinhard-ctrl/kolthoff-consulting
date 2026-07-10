/** draw.io diagram engine — TypeScript mirror of shared/diagram-editor.js */

import type { OrgChartRosterRow } from './org-chart';

export const DRAWIO_EMBED_BASE = 'https://embed.diagrams.net/';

export const BLANK_ORG_CHART_XML =
  '<mxfile host="app.diagrams.net" agent="kolthoff-portal">' +
  '<diagram id="org-chart" name="Organization Chart">' +
  '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850">' +
  '<root><mxCell id="0"/><mxCell id="1" parent="0"/></root>' +
  '</mxGraphModel></diagram></mxfile>';

export const BLANK_BPMN_XML =
  '<mxfile host="app.diagrams.net" agent="kolthoff-portal">' +
  '<diagram id="bpmn" name="Process">' +
  '<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1100" pageHeight="850">' +
  '<root><mxCell id="0"/><mxCell id="1" parent="0"/></root>' +
  '</mxGraphModel></diagram></mxfile>';

export interface OrgChartPolicyDoc {
  title: string;
  docControl: {
    version: string;
    effectiveDate: string;
    lastReviewed: string;
    owner: string;
  };
  introduction: string;
  sections: Array<{ id: string; title: string; content: string }>;
  diagram: {
    drawioXml: string;
    svgCache?: string;
    layout?: string;
    lastDiagramEditAt?: number | null;
  };
  roster?: Array<{
    id: string;
    name: string;
    title: string;
    department?: string;
    reportsTo?: string;
  }>;
  link?: {
    source?: string;
    workbookOrgChartField?: string;
    lastSyncedAt?: number | null;
  };
}

export type DiagramPresetId = 'orgChart' | 'bpmn';

export function getDrawioEmbedUrl(options?: { ui?: string; dark?: boolean; libs?: string }): string {
  const params = new URLSearchParams({
    embed: '1',
    proto: 'json',
    spin: '1',
    configure: '1',
    libraries: '1',
    noSaveBtn: '1',
    saveAndExit: '0',
    noExitBtn: '1',
    ui: options?.ui || 'kennedy',
  });
  if (options?.libs) params.set('libs', options.libs);
  if (options?.dark) params.set('dark', '1');
  return `${DRAWIO_EMBED_BASE}?${params.toString()}`;
}

export function getPreset(presetId: DiagramPresetId) {
  if (presetId === 'bpmn') {
    return {
      id: 'bpmn',
      label: 'BPMN 2.0 Workflow',
      embedLibs: 'bpmn',
      configure: {
        defaultLibraries: 'bpmn;general;flowchart;basic;arrows2',
        enabledLibraries: ['bpmn', 'general', 'flowchart', 'basic', 'arrows2'],
        title: 'BPMN 2.0 Workflow',
      },
    };
  }
  return {
    id: 'orgChart',
    label: 'Organization Chart',
    embedLibs: 'general;basic;arrows2',
    configure: {
      defaultLibraries: 'general;basic;arrows2',
      enabledLibraries: ['general', 'basic', 'arrows2'],
      title: 'Organization Chart',
    },
  };
}

export function createEmptyWorkflowPresent() {
  return {
    format: 'bpmn' as const,
    drawioXml: BLANK_BPMN_XML,
    svgCache: '',
    cellMeta: {} as Record<string, Record<string, unknown>>,
  };
}

export type { OrgChartRosterRow };

function stripHtml(value: string): string {
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

function parseCellLabel(value: string): { name: string; title: string; department: string } {
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

function decodeXmlEntities(str: string): string {
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

function encodeXmlAttr(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function upsertRosterVertex(
  rosterById: Record<string, OrgChartRosterRow & { parentId?: string | null }>,
  id: string | undefined,
  rawLabel: string,
  parentId?: string | null,
) {
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

/** Parse draw.io org chart XML into roster rows (matches Policy Studio). */
export function parseRosterFromDrawioXml(xml?: string | null): OrgChartRosterRow[] {
  if (!xml || typeof xml !== 'string') return [];
  const rosterById: Record<string, OrgChartRosterRow & { parentId?: string | null }> = {};
  const edges: Array<{ source: string; target: string }> = [];

  // draw.io org-chart shapes often wrap labels in <object>/<UserObject> with id on the wrapper.
  const objectRegex = /<(?:object|UserObject)\b([^>]*)>([\s\S]*?)<\/(?:object|UserObject)>/gi;
  let objectMatch: RegExpExecArray | null;
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
  let match: RegExpExecArray | null;
  while ((match = cellRegex.exec(xml)) !== null) {
    const attrs = match[1];
    const id = attrs.match(/\bid="([^"]+)"/)?.[1];
    if (!id) continue;
    const valueMatch = attrs.match(/\bvalue="([^"]*)"/);
    const isVertex = /\bvertex="1"/.test(attrs);
    const isEdge = /\bedge="1"/.test(attrs);
    const source = attrs.match(/\bsource="([^"]+)"/)?.[1];
    const target = attrs.match(/\btarget="([^"]+)"/)?.[1];
    const parentId = attrs.match(/\bparent="([^"]+)"/)?.[1] || null;

    if (isVertex && valueMatch && !rosterById[id]) {
      upsertRosterVertex(rosterById, id, valueMatch[1], parentId);
    } else if (isEdge && source && target) {
      edges.push({ source, target });
    }
  }

  edges.forEach(({ source, target }) => {
    if (rosterById[target] && rosterById[source]) {
      rosterById[target].reportsTo = rosterById[source].name;
    }
  });

  return Object.values(rosterById)
    .map(({ id, name, title, department, reportsTo }) => ({ id, name, title, department, reportsTo }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Prefer freshly parsed roster rows; keep prior members when parse returns empty. */
export function resolveOrgChartMembers(
  xml?: string | null,
  fallbackMembers?: OrgChartRosterRow[] | null,
): OrgChartRosterRow[] {
  const parsed = parseRosterFromDrawioXml(xml);
  if (parsed.length) return parsed;
  return Array.isArray(fallbackMembers) ? fallbackMembers : [];
}

/** Build draw.io XML from legacy member rows (managerId links). */
export function membersToDrawioXml(
  members: Array<{ id: string; name: string; role?: string; title?: string; department?: string; managerId?: string | null }>,
): string {
  const list = (members || []).filter((m) => m?.name);
  if (!list.length) return BLANK_ORG_CHART_XML;

  const roots = list.filter((m) => !m.managerId || !list.some((x) => x.id === m.managerId));
  const childrenOf = (managerId: string) => list.filter((m) => m.managerId === managerId);

  let cellId = 2;
  const cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
  const edgeCells: string[] = [];

  const layoutNode = (member: (typeof list)[0], parentCellId: string | null, depth: number, indexInRow: number) => {
    const myId = String(cellId++);
    const x = 40 + indexInRow * 220;
    const y = 40 + depth * 140;
    const label = [member.name, member.role || member.title, member.department].filter(Boolean).join('\n');
    cells.push(
      `<mxCell id="${myId}" value="${encodeXmlAttr(label)}" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontStyle=1" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="180" height="70" as="geometry"/></mxCell>`,
    );
    if (parentCellId) {
      edgeCells.push(
        `<mxCell id="${cellId++}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;" edge="1" parent="1" source="${parentCellId}" target="${myId}">` +
          '<mxGeometry relative="1" as="geometry"/></mxCell>',
      );
    }
    childrenOf(member.id).forEach((child, idx) => layoutNode(child, myId, depth + 1, idx));
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

export function resolveWorkspaceOrgChartXml(profile: {
  orgChart?: { drawioXml?: string; members?: Array<{ id: string; name: string; role?: string; department?: string; managerId?: string | null }> };
} | null): string {
  if (!profile?.orgChart) return BLANK_ORG_CHART_XML;
  const org = profile.orgChart;
  if (typeof org.drawioXml === 'string' && org.drawioXml.trim()) return org.drawioXml;
  const members = Array.isArray(org.members) ? org.members : [];
  if (members.length) return membersToDrawioXml(members);
  return BLANK_ORG_CHART_XML;
}
