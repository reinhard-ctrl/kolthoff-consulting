/**
 * Policy document import helpers — parse Google Docs / markdown / plain text
 * into Policy Studio standard-doc shape: { title, introduction, sections[] }.
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

  /** Extract a Google Docs document ID from common URL shapes. */
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

  /** Lightweight HTML → plain text with markdown-ish headings for <h1>–<h3>. */
  function htmlToPlainText(html) {
    let text = String(html || '');
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `\n# ${stripTags(inner).trim()}\n`);
    text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n## ${stripTags(inner).trim()}\n`);
    text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n### ${stripTags(inner).trim()}\n`);
    text = text.replace(/<\/(p|div|tr|li|br|h[1-6])>/gi, '\n');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<li[^>]*>/gi, '• ');
    text = stripTags(text);
    return decodeHtmlEntities(text);
  }

  function stripTags(html) {
    return String(html || '').replace(/<[^>]+>/g, '');
  }

  function normalizePolicySourceText(raw) {
    let text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const trimmed = text.trim();
    if (/^</.test(trimmed) || /<\/[a-z][\s\S]*>/i.test(trimmed.slice(0, 2000))) {
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
      .replace(/^\d+[\.\)]\s+/, '')
      .trim();
  }

  function isMarkdownHeading(line) {
    return /^#{1,6}\s+\S/.test(line);
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
    if (isNumberedHeading(t)) {
      return { level: 2, title: stripMdHeadingMarks(t) };
    }
    if (isAllCapsHeading(t)) {
      return { level: 2, title: t.replace(/\s+/g, ' ') };
    }
    return null;
  }

  /**
   * Parse exported Doc / markdown / plain text into a standard policy draft.
   * @returns {{ title: string, introduction: string, sections: Array<{id:string,title:string,content:string}> }}
   */
  function parsePolicyDocText(raw, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const idPrefix = opts.idPrefix || 'imp';
    const text = normalizePolicySourceText(raw);
    if (!text) {
      return { title: '', introduction: '', sections: [] };
    }

    const lines = text.split('\n');
    const blocks = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
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

    let title = '';
    let introduction = '';
    const sections = [];
    let mode = 'preamble';
    let currentSection = null;
    const pushLine = (bucket, line) => {
      const t = line == null ? '' : String(line);
      if (!bucket.value && !t.trim()) return;
      bucket.value = bucket.value ? `${bucket.value}\n${t}` : t;
    };
    const introBucket = { value: '' };

    const flushSection = () => {
      if (!currentSection) return;
      const content = String(currentSection.content || '').trim();
      const secTitle = String(currentSection.title || '').trim() || `Section ${sections.length + 1}`;
      sections.push({
        id: slugId(idPrefix, secTitle, sections.length),
        title: secTitle,
        content: content || 'Details…',
      });
      currentSection = null;
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

        if (INTRO_HEADING_RE.test(headingTitle) && !sections.length && !currentSection) {
          flushSection();
          mode = 'intro';
          return;
        }

        if (!title && mode === 'preamble' && !introBucket.value.trim() && block.level <= 2) {
          // First heading with no preamble often is the document title
          title = headingTitle;
          mode = 'preamble';
          return;
        }

        flushSection();
        mode = 'section';
        currentSection = { title: headingTitle, content: '' };
        return;
      }

      if (mode === 'section' && currentSection) {
        currentSection.content = currentSection.content
          ? `${currentSection.content}\n${block.text}`
          : block.text;
        return;
      }

      pushLine(introBucket, block.text);
    });

    flushSection();
    introduction = introBucket.value.trim();

    // No headings: first paragraph = intro, rest = single section (or all intro if short)
    if (!sections.length) {
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
            content: rest,
          });
        }
      } else if (paras.length >= 2) {
        introduction = paras[0];
        sections.push({
          id: slugId(idPrefix, 'imported-content', 0),
          title: 'Imported content',
          content: paras.slice(1).join('\n\n'),
        });
      } else {
        introduction = text;
      }
    }

    // Drop empty trailing whitespace inside section bodies
    sections.forEach((s) => {
      s.content = String(s.content || '').trim();
    });

    return {
      title: String(title || '').trim(),
      introduction: String(introduction || '').trim(),
      sections,
    };
  }

  /** Merge parsed import into an existing standard doc (preserves docControl & extras). */
  function applyParsedToStandardDoc(existingDoc, parsed, options) {
    const doc = existingDoc && typeof existingDoc === 'object' ? existingDoc : {};
    const p = parsed && typeof parsed === 'object' ? parsed : {};
    const opts = options && typeof options === 'object' ? options : {};
    const updateTitle = opts.updateTitle !== false;
    const sections = Array.isArray(p.sections)
      ? p.sections.map((s, idx) => ({
          id: s.id || slugId('imp', s.title, idx),
          title: String(s.title || `Section ${idx + 1}`).trim(),
          content: String(s.content || '').trim() || 'Details…',
        }))
      : [];

    return {
      ...doc,
      title: updateTitle && p.title ? String(p.title).trim() : doc.title,
      introduction: p.introduction != null ? String(p.introduction) : doc.introduction || '',
      sections,
    };
  }

  const api = {
    extractGoogleDocId,
    isGoogleDocHtmlPage,
    htmlToPlainText,
    normalizePolicySourceText,
    parsePolicyDocText,
    applyParsedToStandardDoc,
  };

  global.PolicyDocImport = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
