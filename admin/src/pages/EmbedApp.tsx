import { Link } from 'react-router-dom';
import { getNavItem } from '../lib/navPreferences';
import { useProduct } from '../lib/product-context';

/** Bump when embedded HTML apps change so admin iframes skip stale cached scripts. */
const EMBED_CACHE_VERSION = '20250704-ui-v5';

function buildEmbedSrc(href: string, embedParams: Record<string, string>): string {
  const url = href.startsWith('http') ? new URL(href) : new URL(href, window.location.origin);
  url.searchParams.set('embed', '1');
  url.searchParams.set('v', EMBED_CACHE_VERSION);
  for (const [key, value] of Object.entries(embedParams)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export default function EmbedApp({ appId }: { appId: string }) {
  const product = useProduct();
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

  const src = buildEmbedSrc(item.href, product.embedParams);

  return (
    <iframe
      title={item.label}
      src={src}
      className={`w-full h-full border-0 block ${product.theme === 'light' ? 'bg-white' : 'bg-brandNavy-950'}`}
    />
  );
}
