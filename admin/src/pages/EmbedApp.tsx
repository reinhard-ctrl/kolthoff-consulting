import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getNavItem } from '../lib/navPreferences';

export default function EmbedApp({ appId }: { appId: string }) {
  const item = getNavItem(appId);
  const [blocked, setBlocked] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const embeddable = item?.type === 'embed' && item.href && !item.openInNewTab;
  const src = embeddable
    ? (item.href!.startsWith('http') ? item.href! : `${window.location.origin}${item.href}`)
    : '';

  useEffect(() => {
    if (!embeddable) return;
    setBlocked(false);
    const timer = window.setTimeout(() => {
      const frame = iframeRef.current;
      if (!frame) return;
      try {
        const doc = frame.contentDocument;
        if (!doc || !doc.body?.childElementCount) setBlocked(true);
      } catch {
        setBlocked(true);
      }
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [embeddable, src]);

  if (!embeddable || !item) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-slate-400 mb-4">Unknown application. Select a module from the left navigation.</p>
        <Link to="/" className="text-brandTeal-400 hover:underline text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const blockedFallback = (
    <div className="glass-panel p-8 flex-1 flex flex-col items-center justify-center text-center">
      <p className="text-slate-400 mb-4 max-w-md">
        This module cannot be embedded in the console panel (connection refused or framing blocked). Open it in a separate tab instead.
      </p>
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="px-5 py-2.5 bg-brandTeal-500 text-brandNavy-955 rounded-lg font-bold text-sm"
      >
        Open {item.label}
      </a>
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-brandNavy-700/60 shrink-0">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-brandTeal-400 font-bold">{item.group}</p>
          <h1 className="text-xl font-bold text-white mt-1">{item.label}</h1>
        </div>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-brandNavy-700 bg-brandNavy-800 text-slate-300 hover:border-brandTeal-500/50 hover:text-brandTeal-300 transition-colors shrink-0"
        >
          Open in new tab
        </a>
      </div>

      {blocked ? blockedFallback : (
        <div className="flex-1 glass-panel overflow-hidden min-h-0">
          <iframe
            ref={iframeRef}
            title={item.label}
            src={src}
            className="w-full h-full min-h-[calc(100vh-14rem)] border-0 bg-brandNavy-950"
            onLoad={() => {
              const frame = iframeRef.current;
              if (!frame) return;
              try {
                const doc = frame.contentDocument;
                if (!doc?.body) setBlocked(true);
              } catch {
                setBlocked(true);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
