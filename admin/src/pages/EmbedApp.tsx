import { Link } from 'react-router-dom';
import { getNavItem } from '../lib/navPreferences';

/** Bump when embedded HTML apps change so admin iframes skip stale cached scripts. */
const EMBED_CACHE_VERSION = '20250630-catalog-v2';

function buildEmbedSrc(href: string): string {
  const url = href.startsWith('http') ? new URL(href) : new URL(href, window.location.origin);
  url.searchParams.set('embed', '1');
  url.searchParams.set('v', EMBED_CACHE_VERSION);
  return url.toString();
}

export default function EmbedApp({ appId }: { appId: string }) {
  const item = getNavItem(appId);

  if (!item || item.type !== 'embed' || !item.href || item.openInNewTab) {
    return (
      <div className="glass-panel p-8 text-center m-4 sm:m-6">
        <p className="text-slate-400 mb-4">Unknown application. Select a module from the left navigation.</p>
        <Link to="/" className="text-brandTeal-400 hover:underline text-sm">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const src = buildEmbedSrc(item.href);

  return (
    <iframe
      title={item.label}
      src={src}
      className="w-full h-full border-0 bg-brandNavy-950 block"
    />
  );
}
