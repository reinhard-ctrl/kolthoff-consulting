function openWorkspaceTabUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('embed');
  return url.pathname + url.search + url.hash;
}

export default function EmbedAuthPrompt() {
  return (
    <div className="h-full min-h-[12rem] flex items-center justify-center bg-slate-900 p-6 text-center">
      <div className="max-w-sm space-y-4">
        <p className="text-sm text-slate-400 leading-relaxed">
          Staff session required. Sign in to the admin console first, then reload this panel.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <a
            href="/admin/"
            target="_top"
            rel="noopener"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700"
          >
            Open admin console
          </a>
          <a
            href={openWorkspaceTabUrl()}
            target="_blank"
            rel="noopener"
            className="inline-block px-4 py-2 border border-slate-600 text-slate-300 rounded-lg font-semibold text-sm hover:bg-slate-800"
          >
            Open in new tab
          </a>
        </div>
      </div>
    </div>
  );
}
