/**
 * Policy document import helpers — parse Google Docs / Drive HTML / markdown / plain text
 * into Policy Studio chaptered shape:
 * { title, introduction, chapters: [{ id, title, sections: [{ id, title, kind, content?, table? }] }], sections[] }
 *
 * Structure mapping (Google Docs Heading styles / markdown):
 *   H1 / #     → document title
 *   H2 / ##    → chapter (when H3s exist) or flat section (H2-only docs)
 *   H3 / ###   → section inside current chapter
 *   <table>    → kind: 'table' section (preserves grid layout)
 */
(function (global) {
  const INTRO_HEADING_RE =
    /^(introduction(\s*&\s*purpose)?|overview|about\s+this\s+(policy|document)|1[\.\)]?\s*introduction(\s*&\s*purpose)?)\b/i;

  function slugId(prefix, title, index) {
    const base = String(title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    return `${prefix || 'sec'}-${base || index + 1}`;
  }

  /** Extract a Google Docs / Drive document ID from common URL shapes. */
  function extractGoogleDocId(rawUrl) {
    const raw = String(rawUrl || '').trim();
    if (!raw) return null;
    const docMatch = raw.match(/\/document\/d\/([a-zA-Z0-9_-]+)/i);
    if (docMatch) return docMatch[1];
    const driveMatch = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (driveMatch) return driveMatch[1];
    const openMatch = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    if (openMatch && /docs\.google\.com|drive\.google\.com/i.test(raw)) return openMatch[1];
    return null;
  }

  function isGoogleDocHtmlPage(text) {
    const sample = String(text || '')
      .trim()
      .slice(0, 512)
      .toLowerCase();
    return (
      sample.startsWith('<!doctype html') ||
      sample.startsWith('<html') ||
      sample.includes('accounts.google.com') ||
      (sample.includes('sign in') && sample.includes('<html'))
    );
  }

  function looksLikeHtmlDocument(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return false;
    if (/^</.test(trimmed) || /<\/[a-z][\s\S]*>/i.test(trimmed.slice(0, 2000))) return true;
    return false;
  }

  function decodeHtmlEntities(str) {
    return String(str || '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]+>/g, '');
  }

  function cellText(html) {
    return decodeHtmlEntities(stripTags(String(html || '').replace(/<br\s*\/?>/gi, '\n')))
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
  }

  /** Parse an HTML <table> into Firestore-safe { headers, rows: [{ id, cells }] }. */
  function parseHtmlTableElement(tableHtml, idPrefix, index) {
    const inner = String(tableHtml || '');
    const rowHtmls = [];
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let m;
    while ((m = trRe.exec(inner)) !== null) {
      rowHtmls.push(m[1]);
    }
    if (!rowHtmls.length) return null;

    const parsedRows = rowHtmls.map((rowHtml) => {
      const cells = [];
      const cellRe = /<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi;
      let cm;
      while ((cm = cellRe.exec(rowHtml)) !== null) {
        cells.push({ header: String(cm[1]).toLowerCase() === 'th', text: cellText(cm[2]) });
      }
      return cells;
    }).filter((r) => r.length);

    if (!parsedRows.length) return null;

    const firstIsHeader =
      parsedRows[0].some((c) => c.header) ||
      parsedRows.length > 1;

    let headers;
    let body;
    if (firstIsHeader) {
      headers = parsedRows[0].map((c, i) => c.text || `Column ${i + 1}`);
      body = parsedRows.slice(1);
    } else {
      const width = Math.max(...parsedRows.map((r) => r.length));
      headers = Array.from({ length: width }, (_, i) => `Column ${i + 1}`);
      body = parsedRows;
    }

    const width = headers.length;
    const rows = body.map((row, ri) => ({
      id: slugId(`${idPrefix}-tr`, `r${ri}`, ri),
      cells: Array.from({ length: width }, (_, i) => (row[i] ? row[i].text : '')),
    }));

    return {
      id: slugId(idPrefix, `table-${index + 1}`, index),
      title: `Table ${index + 1}`,
      kind: 'table',
      content: '',
      table: {
        headers,
        rows: rows.length
          ? rows
          : [{
              id: slugId(`${idPrefix}-tr`, 'empty', 0),
              cells: Array.from({ length: width }, () => ''),
            }],
      },
    };
  }

  /** Convert HTML (Google Docs export / saved webpage) into markdown-ish text + table markers. */
  function htmlToStructuredText(html) {
    let text = String(html || '');
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    const bodyMatch = text.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    if (bodyMatch) text = bodyMatch[1];

    const tables = [];
    text = text.replace(/<table[^>]*>[\s\S]*?<\/table>/gi, (full) => {
      const parsed = parseHtmlTableElement(full, 'imp', tables.length);
      if (!parsed) return '\n';
      tables.push(parsed);
      return `\n\n@@TABLE_${tables.length - 1}@@\n\n`;
    });

    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `\n# ${cellText(inner)}\n`);
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n## ${cellText(inner)}\n`);
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n### ${cellText(inner)}\n`);
    text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, inner) => `\n#### ${cellText(inner)}\n`);
    text = text.replace(/<\/(p|div|tr|li|br|h[1-6])>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '• ');
    text = stripTags(text);
    text = decodeHtmlEntities(text);

    return { text, tables };
  }

  /** Lightweight HTML → plain text with markdown-ish headings for <h1>–<h3>. */
  function htmlToPlainText(html) {
    return htmlToStructuredText(html).text;
  }

  function normalizePolicySourceText(raw) {
    let text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const trimmed = text.trim();
    if (looksLikeHtmlDocument(trimmed)) {
      text = htmlToPlainText(text);
    }
    return text
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function stripMdHeadingMarks(line) {
    return String(line || '')
      .replace(/^#{1,6}\s+/, '')
      .replace(/^\d+(\.\d+)?[\.\)]\s+/, '')
      .trim();
  }

  function isMarkdownHeading(line) {
    return /^#{1,6}\s+\S/.test(line);
  }

  function isNumberedSubHeading(line) {
    return /^\d{1,2}\.\d{1,2}[\.\)]?\s+\S.{0,120}$/.test(line) && !/[.!?]$/.test(line.trim());
  }

  function isNumberedHeading(line) {
    return /^\d{1,2}[\.\)]\s+\S.{0,120}$/.test(line) && !/[.!?]$/.test(line.trim());
  }

  function isAllCapsHeading(line) {
    const t = line.trim();
    if (t.length < 3 || t.length > 80) return false;
    if (!/[A-Z]/.test(t)) return false;
    if (/[.!?;,:]/.test(t) && t.length > 40) return false;
    const letters = t.replace(/[^A-Za-z]/g, '');
    if (letters.length < 3) return false;
    const upper = letters.replace(/[^A-Z]/g, '').length;
    return upper / letters.length >= 0.85;
  }

  function isSetextUnderline(line) {
    return /^(=+|-+)\s*$/.test(line);
  }

  function classifyHeading(line, nextLine) {
    const t = String(line || '').trim();
    if (!t) return null;
    if (isMarkdownHeading(t)) {
      const level = (t.match(/^#+/) || ['#'])[0].length;
      return { level, title: stripMdHeadingMarks(t) };
    }
    if (nextLine && isSetextUnderline(nextLine)) {
      return { level: nextLine.trim().startsWith('=') ? 1 : 2, title: t, consumeNext: true };
    }
    if (isNumberedSubHeading(t)) {
      return { level: 3, title: stripMdHeadingMarks(t) };
    }
    if (isNumberedHeading(t)) {
      return { level: 2, title: stripMdHeadingMarks(t) };
    }
    if (isAllCapsHeading(t)) {
      return { level: 2, title: t.replace(/\s+/g, ' ') };
    }
    return null;
  }

  function isMarkdownTableSeparator(line) {
    return /^\|?[\s:|-]+$/.test(line) && /---/.test(line) && line.includes('|');
  }

  function parseMarkdownTableLines(lines, startIndex) {
    const headerLine = String(lines[startIndex] || '').trim();
    const sepLine = String(lines[startIndex + 1] || '').trim();
    if (!headerLine.includes('|') || !isMarkdownTableSeparator(sepLine)) return null;

    const splitRow = (line) =>
      String(line || '')
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());

    const headers = splitRow(headerLine);
    if (!headers.length) return null;
    const rows = [];
    let i = startIndex + 2;
    while (i < lines.length) {
      const line = String(lines[i] || '').trim();
      if (!line.includes('|') || isMarkdownTableSeparator(line) || classifyHeading(line, lines[i + 1] || '')) break;
      if (!line) break;
      rows.push({
        id: slugId('mdtr', `r${rows.length}`, rows.length),
        cells: Array.from({ length: headers.length }, (_, ci) => splitRow(line)[ci] || ''),
      });
      i += 1;
    }
    return {
      endIndex: i,
      section: {
        id: slugId('imp', `table-${startIndex}`, startIndex),
        title: 'Table',
        kind: 'table',
        content: '',
        table: {
          headers,
          rows: rows.length
            ? rows
            : [{ id: slugId('mdtr', 'empty', 0), cells: Array.from({ length: headers.length }, () => '') }],
        },
      },
    };
  }

  function emptyResult() {
    return { title: '', introduction: '', chapters: [], sections: [] };
  }

  function finalizeStructure(title, introduction, chapters, sections, idPrefix) {
    const cleanTitle = String(title || '').trim();
    const cleanIntro = String(introduction || '').trim();

    let finalChapters = (chapters || [])
      .map((ch, ci) => {
        const chTitle = String(ch.title || '').trim() || `Chapter ${ci + 1}`;
        const secs = (ch.sections || [])
          .map((s, si) => normalizeImportedSection(s, idPrefix, `${ci}-${si}`))
          .filter(Boolean);
        if (!secs.length) return null;
        return {
          id: ch.id || slugId(`${idPrefix}-ch`, chTitle, ci),
          title: chTitle,
          sections: secs,
        };
      })
      .filter(Boolean);

    let finalSections = (sections || [])
      .map((s, si) => normalizeImportedSection(s, idPrefix, si))
      .filter(Boolean);

    // Prefer chapter tree when present; otherwise keep flat sections.
    if (finalChapters.length) {
      finalSections = [];
      finalChapters.forEach((ch) => {
        (ch.sections || []).forEach((sec) => finalSections.push(sec));
      });
    } else if (finalSections.length) {
      finalChapters = [];
    }

    return {
      title: cleanTitle,
      introduction: cleanIntro,
      chapters: finalChapters,
      sections: finalSections,
    };
  }

  function normalizeImportedSection(raw, idPrefix, index) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.kind === 'table') {
      const headers = Array.isArray(raw.table?.headers)
        ? raw.table.headers.map((h) => (h == null ? '' : String(h)))
        : [];
      if (!headers.length) return null;
      const rows = Array.isArray(raw.table?.rows)
        ? raw.table.rows.map((row, ri) => ({
            id: row && row.id != null ? String(row.id) : slugId(`${idPrefix}-tr`, `r${ri}`, ri),
            cells: Array.from({ length: headers.length }, (_, i) => {
              const cells = Array.isArray(row?.cells) ? row.cells : Array.isArray(row) ? row : [];
              return cells[i] == null ? '' : String(cells[i]);
            }),
          }))
        : [];
      return {
        id: raw.id || slugId(idPrefix, raw.title || `table-${index}`, index),
        title: String(raw.title || `Table ${Number(index) + 1 || 1}`).trim(),
        kind: 'table',
        content: '',
        table: {
          headers,
          rows: rows.length
            ? rows
            : [{ id: slugId(`${idPrefix}-tr`, 'empty', 0), cells: Array.from({ length: headers.length }, () => '') }],
        },
      };
    }
    const content = String(raw.content || '').trim();
    const title = String(raw.title || '').trim() || `Section ${Number(index) + 1 || 1}`;
    return {
      id: raw.id || slugId(idPrefix, title, index),
      title,
      kind: 'text',
      content: content || 'Details…',
    };
  }

  /**
   * Parse exported Doc / Drive HTML / markdown / plain text into a policy draft.
   * @returns {{ title, introduction, chapters, sections }}
   */
  function parsePolicyDocText(raw, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const idPrefix = opts.idPrefix || 'imp';

    let source = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    let embeddedTables = [];
    if (looksLikeHtmlDocument(source.trim())) {
      const structured = htmlToStructuredText(source);
      embeddedTables = structured.tables || [];
      source = structured.text;
    }

    const text = source
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!text && !embeddedTables.length) return emptyResult();

    const lines = text.split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = String(line || '').trim();

      const tableMarker = trimmed.match(/^@@TABLE_(\d+)@@$/);
      if (tableMarker) {
        const table = embeddedTables[Number(tableMarker[1])];
        if (table) blocks.push({ type: 'table', section: { ...table } });
        i += 1;
        continue;
      }

      const mdTable = parseMarkdownTableLines(lines, i);
      if (mdTable) {
        blocks.push({ type: 'table', section: mdTable.section });
        i = mdTable.endIndex;
        continue;
      }

      const next = lines[i + 1] || '';
      const heading = classifyHeading(line, next);
      if (heading) {
        blocks.push({ type: 'heading', level: heading.level, title: heading.title });
        i += heading.consumeNext ? 2 : 1;
        continue;
      }
      blocks.push({ type: 'line', text: line });
      i += 1;
    }

    const hasLevel3 = blocks.some((b) => b.type === 'heading' && b.level >= 3);
    const useChapters = hasLevel3;

    let title = '';
    let introduction = '';
    const chapters = [];
    const sections = [];
    let mode = 'preamble';
    let currentChapter = null;
    let currentSection = null;
    const introBucket = { value: '' };

    const pushLine = (bucket, line) => {
      const t = line == null ? '' : String(line);
      if (!bucket.value && !t.trim()) return;
      bucket.value = bucket.value ? `${bucket.value}\n${t}` : t;
    };

    const flushSection = () => {
      if (!currentSection) return;
      if (currentSection._soft && !String(currentSection.content || '').trim()) {
        currentSection = null;
        return;
      }
      const normalized = normalizeImportedSection(
        currentSection,
        idPrefix,
        useChapters ? `${chapters.length}-${(currentChapter?.sections || sections).length}` : sections.length,
      );
      if (!normalized) {
        currentSection = null;
        return;
      }
      if (useChapters) {
        if (!currentChapter) {
          currentChapter = {
            id: slugId(`${idPrefix}-ch`, 'policy-provisions', 0),
            title: 'Policy provisions',
            sections: [],
          };
        }
        currentChapter.sections.push(normalized);
      } else {
        sections.push(normalized);
      }
      currentSection = null;
    };

    const flushChapter = () => {
      flushSection();
      if (!currentChapter) return;
      if (!(currentChapter.sections || []).length) {
        currentChapter = null;
        return;
      }
      chapters.push(currentChapter);
      currentChapter = null;
    };

    const startTextSection = (headingTitle) => {
      currentSection = {
        title: headingTitle,
        kind: 'text',
        content: '',
      };
    };

    const appendToCurrent = (block) => {
      if (block.type === 'table') {
        flushSection();
        const tableSec = normalizeImportedSection(
          {
            ...block.section,
            title: currentSection?.title && !String(currentSection.content || '').trim()
              ? currentSection.title
              : block.section.title,
          },
          idPrefix,
          useChapters ? `${chapters.length}-t` : sections.length,
        );
        // If we were holding an empty titled section, replace title onto the table
        currentSection = null;
        if (!tableSec) return;
        if (useChapters) {
          if (!currentChapter) {
            currentChapter = {
              id: slugId(`${idPrefix}-ch`, 'policy-provisions', chapters.length),
              title: 'Policy provisions',
              sections: [],
            };
          }
          currentChapter.sections.push(tableSec);
        } else {
          sections.push(tableSec);
        }
        return;
      }

      if (mode === 'section' && currentSection) {
        currentSection.content = currentSection.content
          ? `${currentSection.content}\n${block.text}`
          : block.text;
        return;
      }
      pushLine(introBucket, block.text);
    };

    blocks.forEach((block) => {
      if (block.type === 'heading') {
        const headingTitle = String(block.title || '').trim();
        if (!headingTitle) return;

        if (!title && block.level === 1) {
          title = headingTitle;
          mode = 'preamble';
          return;
        }

        if (INTRO_HEADING_RE.test(headingTitle) && !sections.length && !chapters.length && !currentSection && !currentChapter) {
          flushSection();
          mode = 'intro';
          return;
        }

        if (!title && mode === 'preamble' && !introBucket.value.trim() && block.level <= 2) {
          title = headingTitle;
          mode = 'preamble';
          return;
        }

        if (useChapters && block.level <= 2) {
          flushChapter();
          mode = 'section';
          currentChapter = {
            id: slugId(`${idPrefix}-ch`, headingTitle, chapters.length),
            title: headingTitle,
            sections: [],
          };
          // Body before first H3 becomes an Overview section once content arrives
          currentSection = { title: 'Overview', kind: 'text', content: '', _soft: true };
          return;
        }

        if (useChapters && block.level >= 3) {
          if (currentSection && currentSection._soft && !String(currentSection.content || '').trim()) {
            currentSection = null; // drop empty soft Overview
          } else {
            flushSection();
          }
          if (!currentChapter) {
            currentChapter = {
              id: slugId(`${idPrefix}-ch`, 'policy-provisions', chapters.length),
              title: 'Policy provisions',
              sections: [],
            };
          }
          mode = 'section';
          startTextSection(headingTitle);
          return;
        }

        // Flat (H2-only) docs — each heading is a section
        flushSection();
        mode = 'section';
        startTextSection(headingTitle);
        return;
      }

      if (block.type === 'table') {
        if (mode === 'intro' || mode === 'preamble') {
          // Tables before first real section still belong in structure
          mode = 'section';
        }
        appendToCurrent(block);
        return;
      }

      if (mode === 'section' && currentSection) {
        const lineText = block.text == null ? '' : String(block.text);
        if (!lineText.trim()) {
          // Ignore blank lines so empty soft Overview under H2 can still be dropped by H3
          if (!currentSection._soft && currentSection.content) {
            currentSection.content = `${currentSection.content}\n`;
          }
          return;
        }
        if (currentSection._soft) delete currentSection._soft;
        currentSection.content = currentSection.content
          ? `${currentSection.content}\n${lineText}`
          : lineText;
        return;
      }

      if (mode === 'intro') {
        pushLine(introBucket, block.text);
        return;
      }

      pushLine(introBucket, block.text);
    });

    if (useChapters) flushChapter();
    else flushSection();

    // Drop empty soft overview leftovers already handled; trim intro
    introduction = introBucket.value.trim();

    // No headings: first paragraph = intro, rest = single section (or all intro if short)
    if (!sections.length && !chapters.length) {
      const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
      const looksLikeTitle = (p) => {
        if (!p || p.includes('\n')) return false;
        if (p.length > 90 || p.length < 3) return false;
        if (/[.!?]/.test(p)) return false;
        const words = p.split(/\s+/).length;
        return words >= 1 && words <= 12;
      };
      if (paras.length >= 2 && looksLikeTitle(paras[0])) {
        title = title || paras[0];
        introduction = paras[1] || '';
        const rest = paras.slice(2).join('\n\n');
        if (rest) {
          sections.push({
            id: slugId(idPrefix, 'imported-content', 0),
            title: 'Imported content',
            kind: 'text',
            content: rest,
          });
        }
      } else if (paras.length >= 2) {
        introduction = paras[0];
        sections.push({
          id: slugId(idPrefix, 'imported-content', 0),
          title: 'Imported content',
          kind: 'text',
          content: paras.slice(1).join('\n\n'),
        });
      } else if (embeddedTables.length) {
        embeddedTables.forEach((t, idx) => {
          const sec = normalizeImportedSection(t, idPrefix, idx);
          if (sec) sections.push(sec);
        });
      } else {
        introduction = text;
      }
    }

    return finalizeStructure(title, introduction, chapters, sections, idPrefix);
  }

  /** Merge parsed import into an existing standard doc (preserves docControl & extras). */
  function applyParsedToStandardDoc(existingDoc, parsed, options) {
    const doc = existingDoc && typeof existingDoc === 'object' ? existingDoc : {};
    const p = parsed && typeof parsed === 'object' ? parsed : {};
    const opts = options && typeof options === 'object' ? options : {};
    const updateTitle = opts.updateTitle !== false;
    const idPrefix = opts.idPrefix || 'imp';

    const finalized = finalizeStructure(
      p.title,
      p.introduction != null ? p.introduction : '',
      p.chapters,
      p.sections,
      idPrefix,
    );

    const next = {
      ...doc,
      title: updateTitle && finalized.title ? finalized.title : doc.title,
      introduction:
        p.introduction != null ? String(p.introduction) : doc.introduction || '',
    };

    if (finalized.chapters.length) {
      next.chapters = finalized.chapters;
      next.sections = finalized.sections;
    } else {
      next.sections = finalized.sections.length
        ? finalized.sections
        : [];
      // Force chapter rebuild from flat sections on normalize
      delete next.chapters;
    }

    return next;
  }

  /** Count summary for UI preview. */
  function summarizeParsed(parsed) {
    const p = parsed && typeof parsed === 'object' ? parsed : {};
    const chapters = Array.isArray(p.chapters) ? p.chapters : [];
    const sections = Array.isArray(p.sections) ? p.sections : [];
    let sectionCount = 0;
    let tableCount = 0;
    const walk = (list) => {
      (list || []).forEach((s) => {
        sectionCount += 1;
        if (s && s.kind === 'table') tableCount += 1;
      });
    };
    if (chapters.length) {
      chapters.forEach((ch) => walk(ch.sections));
    } else {
      walk(sections);
    }
    return {
      chapterCount: chapters.length,
      sectionCount,
      tableCount,
    };
  }

  const api = {
    extractGoogleDocId,
    isGoogleDocHtmlPage,
    htmlToPlainText,
    htmlToStructuredText,
    parseHtmlTableElement,
    normalizePolicySourceText,
    parsePolicyDocText,
    applyParsedToStandardDoc,
    summarizeParsed,
  };

  global.PolicyDocImport = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
