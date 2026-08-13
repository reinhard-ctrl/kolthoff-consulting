/**
 * Policy catalog — tombstones, categories, nav model.
 * Run: node tests/policy-catalog.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(__dirname, '../shared/policy-catalog.js'), 'utf8');
const win = {};
vm.runInNewContext(code, { window: win, globalThis: win });
const PC = win.PolicyCatalog;
assert.ok(PC);

const defaults = PC.DEFAULT_POLICY_CATALOG();
assert.equal(defaults.removedDefaults.length, 0);
assert.ok(defaults.categoryOrder.includes('operations'));
assert.ok(defaults.categoryOrder.includes('client-delivery'));
assert.ok(defaults.categoryOrder.includes('people'));
assert.ok(defaults.categoryOrder.includes('governance'));
assert.ok(defaults.categoryOrder.includes('compliance'));
assert.equal(defaults.categoryAssignments.healthSafety, 'operations');
assert.equal(defaults.categoryAssignments.communicationPlan, 'client-delivery');
assert.equal(defaults.categoryAssignments.raci, 'governance');

const removed = PC.removeDefaultDoc(defaults, 'nda');
assert.ok(removed.removedDefaults.includes('nda'));
assert.ok(!PC.listActiveBuiltinKeys(removed).includes('nda'));
assert.ok(PC.listActiveBuiltinKeys(removed).includes('conduct'));

const restored = PC.restoreDefaultDoc(removed, 'nda');
assert.ok(!restored.removedDefaults.includes('nda'));

const { catalog: withCustom, doc } = PC.addCustomDoc(defaults, {
  title: 'Vendor Management',
  categoryId: 'compliance',
  kind: 'chapters',
});
assert.match(doc.key, /^custom-vendor-management/);
assert.equal(withCustom.customDocs.length, 1);
assert.ok(PC.listActiveStandardBodyKeys(withCustom).includes(doc.key));

const afterCustomRemove = PC.removeCustomDoc(withCustom, doc.key);
assert.equal(afterCustomRemove.customDocs.length, 0);

const { catalog: withCat, category } = PC.addCategory(defaults, { title: 'Risk', subtitle: 'Risk & audit' });
assert.equal(category.title, 'Risk');
assert.ok(withCat.categoryOrder.includes(category.id));

const reassigned = PC.assignDocCategory(withCat, 'bcp', category.id);
assert.equal(reassigned.categoryAssignments.bcp, category.id);

const nav = PC.resolveNavModel(reassigned, {
  handbook: { title: 'HB' },
  standardDocs: { bcp: { title: 'BCP' }, conduct: { title: 'Conduct' } },
});
assert.ok(nav.length >= 4);
const ops = nav.find((c) => c.id === 'operations');
assert.ok(ops);
assert.ok(ops.items.some((i) => i.key === 'sops'));
assert.ok(!ops.items.some((i) => i.key === 'bcp')); // moved to Risk
const risk = nav.find((c) => c.id === category.id);
assert.ok(risk.items.some((i) => i.key === 'bcp'));

const tombstonedNav = PC.resolveNavModel(PC.removeDefaultDoc(defaults, 'sla'), {});
assert.ok(!tombstonedNav.flatMap((c) => c.items).some((i) => i.key === 'sla'));

const emptyMerge = PC.mergePolicyCatalog(defaults, {
  removedDefaults: ['orgChart', 'raci'],
  customDocs: [],
  customCategories: [],
});
assert.deepEqual(emptyMerge.removedDefaults.sort(), ['orgChart', 'raci'].sort());

const blank = PC.createEmptyCustomPolicyDoc({ title: 'Travel Policy', kind: 'chapters' });
assert.equal(blank.title, 'Travel Policy');
assert.ok(Array.isArray(blank.chapters) && blank.chapters.length >= 1);

const library = PC.listRemovableLibrary(PC.removeDefaultDoc(defaults, 'nda'));
assert.ok(library.some((d) => d.key === 'nda'));

console.log('policy-catalog.test.mjs: all assertions passed');
