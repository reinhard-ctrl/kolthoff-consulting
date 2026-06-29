#!/usr/bin/env node
/** Patch legacy HTML files: shared firebase-init, remove ADMIN fallback, fix URLs */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const files = [
  'admin/legacy/admin_console.html',
  'admin/legacy/intake_center.html',
  'admin/legacy/contract_ledger.html',
  'admin/legacy/core_master_admin.html',
  'admin/legacy/core_workspace_app.html',
  'apps/public/portal.html',
  'apps/public/client_intake.html',
  'apps/delivery/project_planner.html',
  'apps/delivery/diagnoses_report.html',
  'apps/operations/crm_pipeline.html',
  'apps/operations/policy_studio.html',
  'apps/operations/workflow_builder.html',
  'apps/analytics/firm_analytics_dashboard.html',
  'apps/analytics/resource_capacity_manager.html',
  'apps/analytics/time_tracking_variance_analyzer.html',
];

const firebaseInitReplacement = `    <script type="module" src="../../shared/firebase-init.js"></script>`;

const firebaseBlockRegex = /<script type="module">\s*import \{ initializeApp \}[\s\S]*?<\/script>\s*\n/;

for (const rel of files) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) { console.warn('Skip missing:', rel); continue; }
  let content = fs.readFileSync(fp, 'utf8');

  if (firebaseBlockRegex.test(content)) {
    content = content.replace(firebaseBlockRegex, firebaseInitReplacement + '\n');
  }

  // Remove ADMIN fallback — use Cloud Function verifyAdminPasscode
  content = content.replace(
    /if \(docSnap\.exists\(\) \|\| cleanCode === 'ADMIN'\)/g,
    'if (docSnap.exists())'
  );
  content = content.replace(
    /\/\/ Added fallback 'ADMIN' sequence[\s\S]*?if \(docSnap\.exists\(\) \|\| cleanCode === 'ADMIN'\)/g,
    'if (docSnap.exists())'
  );
  content = content.replace(
    /\/\/ Added a fallback 'ADMIN'[\s\S]*?if \(docSnap\.exists\(\) \|\| cleanCode === 'ADMIN'\)/g,
    'if (docSnap.exists())'
  );

  // Fix hardcoded intake URL
  content = content.replace(
    /https:\/\/kolthoff-consulting\.com\/client_intake\.html/g,
    `${'${window.location.origin}/apps/public/client_intake.html'}`
  );
  // Fix template literal if we accidentally broke it - use proper template
  content = content.replace(
    /\$\{window\.location\.origin\}\/apps\/public\/client_intake\.html/g,
    '`${window.location.origin}/apps/public/client_intake.html`'
  );

  fs.writeFileSync(fp, content);
  console.log('Patched:', rel);
}

// contract_ledger: add financials import and remove inline getFinancials
const ledgerPath = path.join(root, 'admin/legacy/contract_ledger.html');
let ledger = fs.readFileSync(ledgerPath, 'utf8');
if (!ledger.includes('shared/financials.js')) {
  ledger = ledger.replace(
    firebaseInitReplacement,
    firebaseInitReplacement + '\n    <script type="module" src="../../shared/financials.js"></script>'
  );
  // Replace inline getFinancials with import from window
  ledger = ledger.replace(
    /const formatCurrency = \(val\) => new Intl\.NumberFormat[\s\S]*?^\s*\};\s*$/m,
    `const formatCurrency = (val) => window.Financials?.formatCurrency(val) || val;
        const getFinancials = (profile) => window.Financials?.getFinancials(profile) || { total: 0, subtotal: 0 };`
  );
}
// Add financials window export script before babel
if (!ledger.includes('window.Financials')) {
  ledger = ledger.replace(
    '<script type="text/babel">',
    `<script type="module">
        import * as Financials from '../../shared/financials.js';
        window.Financials = Financials;
    </script>
    <script type="text/babel">`
  );
}
fs.writeFileSync(ledgerPath, ledger);
console.log('Patched contract_ledger financials');

console.log('Done.');
