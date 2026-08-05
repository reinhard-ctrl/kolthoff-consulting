/**
 * Markdown formatting helpers for Policy Studio text fields.
 * Applies Google Docs–like edits (bold, lists, headings) to a text selection.
 */
(function (global) {
  function applyMarkdownFormat(value, selectionStart, selectionEnd, format) {
    const raw = String(value || '');
    const start = Math.max(0, Math.min(selectionStart ?? raw.length, raw.length));
    const end = Math.max(start, Math.min(selectionEnd ?? start, raw.length));
    const selected = raw.slice(start, end);
    const before = raw.slice(0, start);
    const after = raw.slice(end);
    let next = raw;
    let selStart = start;
    let selEnd = end;

    const wrap = (left, right, placeholder) => {
      const inner = selected || placeholder || '';
      next = `${before}${left}${inner}${right}${after}`;
      selStart = start + left.length;
      selEnd = selStart + inner.length;
    };

    const prefixLines = (makePrefix) => {
      const block = selected || '';
      if (!block) {
        const prefix = makePrefix(0);
        next = `${before}${prefix}${after}`;
        selStart = start + prefix.length;
        selEnd = selStart;
        return;
      }
      const lines = block.split('\n');
      const rewritten = lines
        .map((line, i) => {
          const trimmed = line.replace(/^\s*(?:[-*+]|\d+\.)\s+/, '');
          if (!String(line).trim()) return line;
          return `${makePrefix(i)}${trimmed}`;
        })
        .join('\n');
      next = `${before}${rewritten}${after}`;
      selStart = start;
      selEnd = start + rewritten.length;
    };

    switch (format) {
      case 'bold':
        wrap('**', '**', 'bold text');
        break;
      case 'italic':
        wrap('*', '*', 'italic text');
        break;
      case 'strike':
        wrap('~~', '~~', 'text');
        break;
      case 'code':
        wrap('`', '`', 'code');
        break;
      case 'h2':
        prefixLines(() => '## ');
        break;
      case 'h3':
        prefixLines(() => '### ');
        break;
      case 'bullet':
        prefixLines(() => '- ');
        break;
      case 'number':
        prefixLines((i) => `${i + 1}. `);
        break;
      case 'quote':
        prefixLines(() => '> ');
        break;
      case 'link': {
        const label = selected || 'link text';
        const md = `[${label}](https://)`;
        next = `${before}${md}${after}`;
        selStart = start + label.length + 3;
        selEnd = selStart + 'https://'.length;
        break;
      }
      case 'hr':
        next = `${before}${selected ? `${selected}\n\n` : ''}---\n\n${after}`;
        selStart = selEnd = next.length - after.length;
        break;
      default:
        return { value: raw, selectionStart: start, selectionEnd: end };
    }

    return { value: next, selectionStart: selStart, selectionEnd: selEnd };
  }

  const api = { applyMarkdownFormat };
  global.MarkdownFormat = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
