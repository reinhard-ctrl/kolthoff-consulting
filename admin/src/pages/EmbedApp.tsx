import { Link } from 'react-router-dom';
import { getNavItem } from '../lib/navPreferences';

function buildEmbedSrc(href: string): string {
  const url = href.startsWith('http') ? new URL(href) : new URL(href, window.location.origin);
  url.searchParams.set('embed', '1');
  return url.toString();
}

export default function EmbedApp({ appId }: { appId: string }) {
  const item = getNavItem(appId);

  if (!item || item.type !== 'embed' || !item.href || item.openInNewTab) {
    return (
      <div className="glass-panel p-8 text-center">
        <p className="text-slate-400 mb-4">Unknown application. Select a module from the left navigation.</p>
        <Link to="/" className="text-brandTeal-400 hover:underline text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const src = buildEmbedSrc(item.href);
  const tabHref = item.href.startsWith('http') ? item.href : `${window.location.origin}${item.href}`;

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-brandNavy-700/60 shrink-0">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-brandTeal-400 font-bold">{item.group}</p>
          <h1 className="text-xl font-bold text-white mt-1">{item.label}</h1>
        </div>
        <a
          href={tabHref}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-brandNavy-700 bg-brandNavy-800 text-slate-300 hover:border-brandTeal-500/50 hover:text-brandTeal-300 transition-colors shrink-0"
        >
          Open in new tab
        </a>
      </div>

      <div className="flex-1 glass-panel overflow-hidden min-h-0">
        <iframe
          title={item.label}
          src={src}
          className="w-full h-full min-h-[calc(100vh-14rem)] border-0 bg-brandNavy-950"
        />
      </div>
    </div>
  );
}
