/**
 * Standard policy document chapters — Code of Conduct, NDA, etc.
 * Shape: { introduction, chapters: [{ id, title, sections: [{ id, title, content }] }] }
 * Legacy flat `sections` are migrated into a single chapter on normalize.
 */
(function (global) {
  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function createEmptySection(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    return {
      id: o.id || makeId('sec'),
      title: o.title != null ? String(o.title) : 'Untitled section',
      content: o.content != null ? String(o.content) : '',
    };
  }

  function createEmptyChapter(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    const sections = Array.isArray(o.sections)
      ? o.sections.map((s) => createEmptySection(s))
      : [createEmptySection()];
    return {
      id: o.id || makeId('ch'),
      title: o.title != null ? String(o.title) : 'Untitled chapter',
      sections,
    };
  }

  function flattenChapters(chapters) {
    const out = [];
    (chapters || []).forEach((ch) => {
      (ch.sections || []).forEach((sec) => {
        out.push({
          id: sec.id,
          title: sec.title,
          content: sec.content,
        });
      });
    });
    return out;
  }

  /**
   * Ensure a standard policy doc has a chapters[] array.
   * - Prefer existing chapters when present
   * - Else wrap legacy sections into one chapter
   * - Always mirrors flattened sections for older readers
   */
  function normalizeStandardPolicyDoc(doc, options) {
    const raw = doc && typeof doc === 'object' ? doc : {};
    const opts = options && typeof options === 'object' ? options : {};
    const defaultChapterTitle = opts.defaultChapterTitle || 'Policy provisions';

    let chapters;
    if (Array.isArray(raw.chapters) && raw.chapters.length > 0) {
      chapters = raw.chapters.map((ch) =>
        createEmptyChapter({
          id: ch.id,
          title: ch.title || defaultChapterTitle,
          sections:
            Array.isArray(ch.sections) && ch.sections.length
              ? ch.sections
              : [createEmptySection()],
        }),
      );
    } else if (Array.isArray(raw.sections) && raw.sections.length > 0) {
      chapters = [
        createEmptyChapter({
          id: raw._legacyChapterId || 'ch-main',
          title: defaultChapterTitle,
          sections: raw.sections,
        }),
      ];
    } else {
      chapters = [
        createEmptyChapter({
          id: 'ch-main',
          title: defaultChapterTitle,
          sections: [createEmptySection()],
        }),
      ];
    }

    return {
      ...raw,
      chapters,
      sections: flattenChapters(chapters),
    };
  }

  function compileStandardPolicyMarkdown(doc) {
    const normalized = normalizeStandardPolicyDoc(doc);
    let md = `# ${normalized.title || 'Policy Document'}\n\n`;
    if (normalized.introduction) {
      md += `## Introduction\n${normalized.introduction}\n\n`;
    }
    (normalized.chapters || []).forEach((ch, chIdx) => {
      md += `## ${chIdx + 1}. ${ch.title || `Chapter ${chIdx + 1}`}\n\n`;
      (ch.sections || []).forEach((sec, secIdx) => {
        md += `### ${chIdx + 1}.${secIdx + 1} ${sec.title || `Section ${secIdx + 1}`}\n${sec.content || ''}\n\n`;
      });
    });
    return md.trim();
  }

  function tocEntries(doc) {
    const normalized = normalizeStandardPolicyDoc(doc);
    const entries = [{ title: 'Introduction' }];
    (normalized.chapters || []).forEach((ch) => {
      entries.push({ title: ch.title || 'Chapter', kind: 'chapter' });
      (ch.sections || []).forEach((sec) => {
        entries.push({ title: sec.title || 'Section', kind: 'section' });
      });
    });
    return entries;
  }

  const api = {
    createEmptySection,
    createEmptyChapter,
    flattenChapters,
    normalizeStandardPolicyDoc,
    compileStandardPolicyMarkdown,
    tocEntries,
  };

  global.PolicyChapters = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
