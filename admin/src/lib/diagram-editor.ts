/** draw.io diagram engine — TypeScript mirror of shared/diagram-editor.js */

export const DRAWIO_EMBED_BASE = 'https://embed.diagrams.net/';

export const BLANK_ORG_CHART_XML =
  '<mxfile host="app.diagrams.net" agent="kolthoff-portal">' +
  '<diagram id="org-chart" name="Organization Chart">' +
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

export function getDrawioEmbedUrl(options?: { ui?: string; dark?: boolean }): string {
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
  if (options?.dark) params.set('dark', '1');
  return `${DRAWIO_EMBED_BASE}?${params.toString()}`;
}

export function getPreset(presetId: DiagramPresetId) {
  if (presetId === 'bpmn') {
    return {
      id: 'bpmn',
      label: 'BPMN 2.0 Workflow',
      configure: {
        defaultLibraries: 'bpmn;general',
        enabledLibraries: ['bpmn', 'general'],
      },
    };
  }
  return {
    id: 'orgChart',
    label: 'Organization Chart',
    configure: {
      defaultLibraries: 'general;basic;arrows2',
      enabledLibraries: ['general', 'basic', 'arrows2'],
    },
  };
}
