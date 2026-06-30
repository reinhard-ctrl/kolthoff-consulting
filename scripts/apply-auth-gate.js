#!/usr/bin/env node
/** Inject shared auth-gate into internal HTML apps and remove anonymous bootstrap */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const INTERNAL = [
  'admin/legacy/index.html',
  'admin/legacy/admin_console.html',
  'admin/legacy/intake_center.html',
  'admin/legacy/contract_ledger.html',
  'admin/legacy/core_master_admin.html',
  'admin/legacy/core_workspace_app.html',
  'apps/delivery/project_planner.html',
  'apps/delivery/diagnoses_report.html',
  'apps/operations/crm_pipeline.html',
  'apps/operations/workflow_builder.html',
  'apps/analytics/firm_analytics_dashboard.html',
  'apps/analytics/resource_capacity_manager.html',
  'apps/analytics/time_tracking_variance_analyzer.html',
];

const AUTH_GATE_TAG = `    <script type="module" src="../../shared/auth-gate.js"></script>`;

const policyStudioFirebaseBlock = /    <!-- Firebase Module Initialization \(Loaded only if not in Standalone Offline Mode\) -->[\s\S]*?    <\/script>\s*\n/;

const policyStudioReplacement = `    <!-- Firebase + staff auth gate (skipped in standalone offline mode) -->
    <script type="module">
      if (typeof window.STANDALONE_POLICIES === 'undefined') {
        import('../../shared/firebase-init.js');
        import('../../shared/auth-gate.js');
      } else {
        window.kolthoffStaffReady = Promise.resolve({ user: null, role: 'standalone' });
      }
    </script>
`;

function injectAuthGate(content) {
  if (content.includes('shared/auth-gate.js')) return content;

  const firebaseInit = '<script type="module" src="../../shared/firebase-init.js"></script>';
  if (content.includes(firebaseInit)) {
    return content.replace(
      firebaseInit,
      `${firebaseInit}\n${AUTH_GATE_TAG}`
    );
  }

  // Launcher pages without firebase yet — add both modules after <head>
  if (content.includes('<head>')) {
    return content.replace(
      '<head>',
      `<head>\n  ${firebaseInit}\n${AUTH_GATE_TAG}`
    );
  }
  return content;
}

function stripAnonymousBootstrap(content) {
  let next = content;

  next = next.replace(
    /if \(window\.initialAuthToken\) \{\s*await window\.signInWithCustomToken\(window\.firebaseAuth, window\.initialAuthToken\);\s*\} else \{\s*await window\.signInAnonymously\(window\.firebaseAuth\);\s*\}/g,
    'await window.kolthoffStaffReady'
  );

  next = next.replace(
    /await window\.signInAnonymously\(window\.firebaseAuth\);/g,
    'await window.kolthoffStaffReady'
  );

  next = next.replace(
    /await signInAnonymously\(window\.firebaseAuth\);/g,
    'await window.kolthoffStaffReady'
  );

  return next;
}

for (const rel of INTERNAL) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.warn('Skip missing:', rel);
    continue;
  }
  let content = fs.readFileSync(fp, 'utf8');
  content = injectAuthGate(content);
  content = stripAnonymousBootstrap(content);
  fs.writeFileSync(fp, content);
  console.log('Auth gate applied:', rel);
}

const policyPath = path.join(root, 'apps/operations/policy_studio.html');
if (fs.existsSync(policyPath)) {
  let policy = fs.readFileSync(policyPath, 'utf8');
  if (policyStudioFirebaseBlock.test(policy)) {
    policy = policy.replace(policyStudioFirebaseBlock, policyStudioReplacement);
  }
  policy = stripAnonymousBootstrap(policy);
  fs.writeFileSync(policyPath, policy);
  console.log('Auth gate applied: apps/operations/policy_studio.html');
}

console.log('Done.');
