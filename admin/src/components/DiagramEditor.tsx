import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BLANK_BPMN_XML,
  BLANK_ORG_CHART_XML,
  type DiagramPresetId,
  getDrawioEmbedUrl,
  getPreset,
} from '../lib/diagram-editor';

export interface DiagramEditorProps {
  preset?: DiagramPresetId;
  xml?: string;
  onXmlChange?: (xml: string) => void;
  onSvgExport?: (svgDataUri: string) => void;
  height?: number | string;
  className?: string;
  applyLabel?: string;
}

export default function DiagramEditor({
  preset = 'bpmn',
  xml,
  onXmlChange,
  onSvgExport,
  height = 520,
  className = '',
  applyLabel = 'Apply Diagram',
}: DiagramEditorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const configuredRef = useRef(false);
  const pendingXmlRef = useRef(xml);
  const presetData = useMemo(() => getPreset(preset), [preset]);
  const embedUrl = useMemo(
    () =>
      getDrawioEmbedUrl({
        libs: presetData.embedLibs || presetData.configure.defaultLibraries?.split(';')[0] || 'bpmn',
      }),
    [presetData],
  );

  const postAction = useCallback((payload: object) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(payload), '*');
  }, []);

  const sendLoad = useCallback(
    (diagramXml?: string) => {
      const blank = preset === 'orgChart' ? BLANK_ORG_CHART_XML : BLANK_BPMN_XML;
      postAction({
        action: 'load',
        xml: diagramXml || blank,
        autosave: 1,
      });
    },
    [postAction, preset],
  );

  const requestExport = useCallback(
    (format: string) => {
      postAction({
        action: 'export',
        format,
        xml: format === 'xml',
        spin: 'Exporting diagram…',
      });
    },
    [postAction],
  );

  useEffect(() => {
    pendingXmlRef.current = xml;
    if (readyRef.current && configuredRef.current) sendLoad(xml);
  }, [xml, sendLoad]);

  useEffect(() => {
    readyRef.current = false;
    configuredRef.current = false;
  }, [embedUrl]);

  useEffect(() => {
    const handler = (evt: MessageEvent) => {
      if (!evt.data || typeof evt.data !== 'string') return;
      let msg: { event?: string; format?: string; xml?: string; data?: string };
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (msg.event === 'configure') {
        configuredRef.current = true;
        postAction({ action: 'configure', config: presetData.configure });
      }
      if (msg.event === 'init') {
        readyRef.current = true;
        sendLoad(pendingXmlRef.current);
      }
      if (msg.event === 'export') {
        if (msg.format === 'xml' && msg.xml && onXmlChange) onXmlChange(msg.xml);
        if ((msg.format === 'xmlsvg' || msg.format === 'svg') && msg.data && onSvgExport) {
          onSvgExport(msg.data);
        }
      }
      if (msg.event === 'autosave' && msg.xml && onXmlChange) onXmlChange(msg.xml);
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onSvgExport, onXmlChange, postAction, presetData.configure, sendLoad]);

  return (
    <div className={`flex flex-col gap-3 h-full min-h-0 ${className}`.trim()}>
      <div className="flex flex-wrap gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            requestExport('xml');
            requestExport('xmlsvg');
          }}
          className="text-[10px] font-bold uppercase bg-brandTeal-500 hover:bg-brandTeal-600 text-brandNavy-955 px-3 py-1.5 rounded-lg transition-colors"
        >
          {applyLabel}
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title={presetData.configure.title || presetData.label}
        className="w-full flex-1 min-h-[420px] border border-brandNavy-800 rounded-xl bg-white"
        style={typeof height === 'number' ? { height } : undefined}
      />
    </div>
  );
}
