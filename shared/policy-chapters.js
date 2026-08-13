/**
 * Standard policy document chapters — Code of Conduct, NDA, etc.
 * Shape: {
 *   introduction,
 *   chapters: [{
 *     id, title,
 *     sections: [{
 *       id, title,
 *       kind: 'text' | 'table',
 *       content,                 // prose (kind === 'text')
 *       table: { headers[], rows: [{ id, cells[] }] }  // Firestore-safe (no nested arrays)
 *     }]
 *   }]
 * }
 * Legacy flat `sections` are migrated into a single chapter on normalize.
 */
(function (global) {
  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /** Read cell values from a row in either Firestore-safe or legacy nested-array form. */
  function rowCells(row, width) {
    const w = Math.max(1, Number(width) || 1);
    if (Array.isArray(row)) {
      return Array.from({ length: w }, (_, i) => (row[i] == null ? '' : String(row[i])));
    }
    if (row && typeof row === 'object') {
      const cells = Array.isArray(row.cells) ? row.cells : [];
      return Array.from({ length: w }, (_, i) => (cells[i] == null ? '' : String(cells[i])));
    }
    return Array.from({ length: w }, () => '');
  }

  function createTableRow(cells, id) {
    const list = Array.isArray(cells) ? cells.map((c) => (c == null ? '' : String(c))) : [];
    return {
      id: id != null && String(id) ? String(id) : makeId('tr'),
      cells: list,
    };
  }

  /**
   * Normalize table to Firestore-safe shape:
   * { headers: string[], rows: [{ id, cells: string[] }] }
   * Accepts legacy nested arrays (string[][]) and migrates them.
   */
  function normalizeTable(raw, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const colCount = Math.max(1, Number(opts.colCount) || 3);
    const rowCount = Math.max(1, Number(opts.rowCount) || 3);
    const src = raw && typeof raw === 'object' ? raw : {};
    let headers = Array.isArray(src.headers)
      ? src.headers.map((h) => (h == null ? '' : String(h)))
      : [];
    if (!headers.length) {
      headers = Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
    }
    const width = headers.length;
    let rows = Array.isArray(src.rows)
      ? src.rows.map((row) => {
          const id =
            row && typeof row === 'object' && !Array.isArray(row) && row.id != null
              ? String(row.id)
              : makeId('tr');
          return createTableRow(rowCells(row, width), id);
        })
      : [];
    if (!rows.length) {
      rows = Array.from({ length: rowCount }, () =>
        createTableRow(Array.from({ length: width }, () => ''))
      );
    }
    return { headers, rows };
  }

  function createEmptyTable(overrides) {
    return normalizeTable(overrides && overrides.table ? overrides.table : overrides, overrides);
  }

  function createEmptySection(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    const kind = o.kind === 'table' ? 'table' : 'text';
    const section = {
      id: o.id || makeId('sec'),
      title:
        o.title != null
          ? String(o.title)
          : kind === 'table'
            ? 'Untitled table'
            : 'Untitled section',
      kind,
      content: kind === 'table' ? '' : o.content != null ? String(o.content) : '',
    };
    if (kind === 'table') {
      section.table = createEmptyTable(o.table ? { table: o.table } : o);
    }
    return section;
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
        const kind = sec.kind === 'table' ? 'table' : 'text';
        const entry = {
          id: sec.id,
          title: sec.title,
          kind,
          content: kind === 'table' ? '' : sec.content,
        };
        if (kind === 'table') {
          entry.table = normalizeTable(sec.table);
        }
        out.push(entry);
      });
    });
    return out;
  }

  function escapeMdCell(value) {
    return String(value == null ? '' : value)
      .replace(/\|/g, '\\|')
      .replace(/\r?\n/g, ' ');
  }

  function tableToMarkdown(table) {
    const normalized = normalizeTable(table);
    const headers = normalized.headers;
    const rows = normalized.rows;
    const headerLine = `| ${headers.map(escapeMdCell).join(' | ')} |`;
    const sepLine = `| ${headers.map(() => '---').join(' | ')} |`;
    const body = rows.map((row) => {
      const cells = rowCells(row, headers.length);
      return `| ${headers.map((_, i) => escapeMdCell(cells[i])).join(' | ')} |`;
    });
    return [headerLine, sepLine, ...body].join('\n');
  }

  function sectionBodyMarkdown(sec) {
    if (sec && sec.kind === 'table') {
      return tableToMarkdown(sec.table);
    }
    return sec && sec.content != null ? String(sec.content) : '';
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
        })
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
        md += `### ${chIdx + 1}.${secIdx + 1} ${sec.title || `Section ${secIdx + 1}`}\n${sectionBodyMarkdown(sec)}\n\n`;
      });
    });
    return md.trim();
  }

  function tocEntries(doc) {
    const normalized = normalizeStandardPolicyDoc(doc);
    const entries = [{ title: 'Introduction', kind: 'intro', number: '' }];
    (normalized.chapters || []).forEach((ch, chIdx) => {
      const chapterNo = chIdx + 1;
      entries.push({
        title: ch.title || 'Chapter',
        kind: 'chapter',
        number: `${chapterNo}.`,
      });
      (ch.sections || []).forEach((sec, secIdx) => {
        entries.push({
          title: sec.title || 'Section',
          kind: sec.kind === 'table' ? 'table' : 'section',
          number: `${chapterNo}.${secIdx + 1}`,
        });
      });
    });
    return entries;
  }

  /** Flat (non-chapter) outline: Introduction + 1. / 2. / 3. sections */
  function tocEntriesFlat(doc) {
    const raw = doc && typeof doc === 'object' ? doc : {};
    const entries = [{ title: 'Introduction', kind: 'intro', number: '' }];
    (raw.sections || []).forEach((sec, idx) => {
      entries.push({
        title: sec.title || 'Section',
        kind: sec.kind === 'table' ? 'table' : 'section',
        number: `${idx + 1}.`,
        id: sec.id,
      });
    });
    return entries;
  }

  function setTableCell(table, rowIndex, colIndex, value) {
    const next = normalizeTable(table);
    if (rowIndex === -1) {
      if (colIndex < 0 || colIndex >= next.headers.length) return next;
      next.headers = next.headers.slice();
      next.headers[colIndex] = value == null ? '' : String(value);
      return next;
    }
    if (rowIndex < 0 || rowIndex >= next.rows.length) return next;
    if (colIndex < 0 || colIndex >= next.headers.length) return next;
    next.rows = next.rows.map((row, i) => {
      if (i !== rowIndex) return row;
      const cells = rowCells(row, next.headers.length);
      cells[colIndex] = value == null ? '' : String(value);
      return createTableRow(cells, row.id);
    });
    return next;
  }

  function addTableRow(table) {
    const next = normalizeTable(table);
    next.rows = [
      ...next.rows,
      createTableRow(Array.from({ length: next.headers.length }, () => '')),
    ];
    return next;
  }

  function removeTableRow(table, rowIndex) {
    const next = normalizeTable(table);
    if (next.rows.length <= 1) return next;
    if (rowIndex < 0 || rowIndex >= next.rows.length) return next;
    next.rows = next.rows.filter((_, i) => i !== rowIndex);
    return next;
  }

  function addTableColumn(table) {
    const next = normalizeTable(table);
    const n = next.headers.length + 1;
    next.headers = [...next.headers, `Column ${n}`];
    next.rows = next.rows.map((row) =>
      createTableRow([...rowCells(row, next.headers.length - 1), ''], row.id)
    );
    return next;
  }

  function removeTableColumn(table, colIndex) {
    const next = normalizeTable(table);
    if (next.headers.length <= 1) return next;
    if (colIndex < 0 || colIndex >= next.headers.length) return next;
    next.headers = next.headers.filter((_, i) => i !== colIndex);
    next.rows = next.rows.map((row) => {
      const cells = rowCells(row, next.headers.length + 1).filter((_, i) => i !== colIndex);
      return createTableRow(cells, row.id);
    });
    return next;
  }

  const api = {
    createEmptySection,
    createEmptyChapter,
    createEmptyTable,
    createTableRow,
    rowCells,
    normalizeTable,
    flattenChapters,
    normalizeStandardPolicyDoc,
    compileStandardPolicyMarkdown,
    tableToMarkdown,
    sectionBodyMarkdown,
    tocEntries,
    tocEntriesFlat,
    setTableCell,
    addTableRow,
    removeTableRow,
    addTableColumn,
    removeTableColumn,
  };

  global.PolicyChapters = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
