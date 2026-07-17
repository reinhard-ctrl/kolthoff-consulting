export default function WorkspaceTenantLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-800 p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2">Workspace</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Open your workspace link from the Client Portal, or use the direct URL your administrator shared
          (for example <span className="font-mono text-slate-300">/workspace/?tenant=client-acme</span>).
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 rounded-lg ws-brand-bg text-slate-950 text-sm font-bold hover:brightness-110"
        >
          Go to Client Portal
        </a>
      </div>
    </div>
  );
}
