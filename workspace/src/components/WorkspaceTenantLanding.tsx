export default function WorkspaceTenantLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-700 bg-slate-800 p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-bold text-white mb-2">Core Workspace</h1>
        <p className="text-sm text-slate-400 leading-relaxed mb-6">
          Open the workspace link from your Client Portal dashboard, or ask your Kolthoff contact for a direct URL
          with your tenant ID (for example <span className="font-mono text-slate-300">/workspace/?tenant=client-acme</span>).
        </p>
        <a
          href="/"
          className="inline-block px-4 py-2 rounded-lg bg-teal-500 text-slate-950 text-sm font-bold hover:bg-teal-400"
        >
          Go to Client Portal
        </a>
      </div>
    </div>
  );
}
