/**
 * Regression: Policy Studio cloud save must never send undefined fields.
 * Firestore rejects `setDoc` payloads that contain undefined (e.g. chapters: undefined
 * after merging non-chapter docs like jobDescriptions).
 * Run: node tests/policy-studio-firestore-payload.test.mjs
 */
import assert from 'node:assert/strict';

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map((item) => stripUndefinedDeep(item));
  if (value !== null && typeof value === 'object') {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      out[key] = stripUndefinedDeep(nested);
    }
    return out;
  }
  return value;
}

function hasUndefined(value) {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).some(hasUndefined);
  }
  return false;
}

/** Mirrors Policy Studio mergePolicyData chapters handling (post-fix). */
function mergeChaptersField(defaultDoc, loadedDoc) {
  const chaptersSource = loadedDoc.chapters?.length
    ? loadedDoc.chapters
    : (defaultDoc.chapters?.length ? defaultDoc.chapters : null);
  const merged = {
    ...defaultDoc,
    ...loadedDoc,
    sections: loadedDoc.sections?.length ? loadedDoc.sections : defaultDoc.sections,
  };
  delete merged.chapters;
  if (Array.isArray(chaptersSource) && chaptersSource.length) {
    merged.chapters = chaptersSource;
  }
  return merged;
}

const jobDefault = { title: 'Job Role Profiles', sections: [{ id: 'r1', title: 'Ops' }] };
const jobLoaded = { title: 'Job Role Profiles', sections: [{ id: 'r1', title: 'Ops Lead' }] };
const mergedJob = mergeChaptersField(jobDefault, jobLoaded);
assert.equal('chapters' in mergedJob, false);
assert.equal(hasUndefined(mergedJob), false);

const conductDefault = {
  title: 'Code of Conduct',
  chapters: [{ id: 'ch1', title: 'Workplace', sections: [{ id: 's1', title: 'Dress', content: 'Neat' }] }],
  sections: [{ id: 's1', title: 'Dress', content: 'Neat' }],
};
const mergedConduct = mergeChaptersField(conductDefault, { introduction: 'Hi' });
assert.equal(mergedConduct.chapters.length, 1);
assert.equal(hasUndefined(mergedConduct), false);

const poisoned = { standardDocs: { jobDescriptions: { title: 'X', chapters: undefined, sections: [] } } };
assert.equal(hasUndefined(poisoned), true);
assert.equal(hasUndefined(stripUndefinedDeep(poisoned)), false);
assert.equal('chapters' in stripUndefinedDeep(poisoned).standardDocs.jobDescriptions, false);

console.log('policy-studio-firestore-payload.test.mjs: all assertions passed');
