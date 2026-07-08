import { Link, useLocation } from 'react-router-dom';
import { getNavItem } from '../lib/navPreferences';
import { useProduct } from '../lib/product-context';
import { useDemoAppearance } from '../lib/demo-appearance-context';

/** Bump when embedded HTML apps change so admin iframes skip stale cached scripts. */
const EMBED_CACHE_VERSION = '20250708-embed-v31';

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
  const location = useLocation();
  const { appearance, isLight } = useDemoAppearance();
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

  const embedParams = {
    ...product.embedParams,
    ...(appearance ? { appearance } : {}),
  };
  const profileFromRoute = new URLSearchParams(location.search).get('profile');
  if (profileFromRoute) {
    embedParams.profile = profileFromRoute;
  }
  const src = buildEmbedSrc(item.href, embedParams);

  return (
    <iframe
      key={appearance ?? 'default'}
      title={item.label}
      src={src}
      className={`w-full h-full border-0 block ops-embed-frame ${isLight ? 'bg-[#e3e6eb]' : 'bg-brandNavy-950'}`}
    />
  );
}
