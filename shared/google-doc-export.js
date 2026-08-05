/**
 * Build a Word/Google Docs–importable HTML document from title + body HTML.
 * Saved as .doc so Drive → Open with Google Docs works.
 */
(function (global) {
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function sanitizeFileName(name) {
    return String(name || 'Document')
      .replace(/[^\w\s\-().]+/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 80) || 'Document';
  }

  function buildWordHtmlDocument(title, bodyHtml, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const company = opts.company || '';
    const safeTitle = escapeHtml(title || 'Policy Document');
    const metaLine = [company, opts.subtitle].filter(Boolean).map(escapeHtml).join(' · ');
    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<meta name="ProgId" content="Word.Document" />
<meta name="Generator" content="Kolthoff Policy Studio" />
<title>${safeTitle}</title>
<!--[if gte mso 9]><xml>
 <w:WordDocument>
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
 </w:WordDocument>
</xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.45; max-width: 720px; margin: 24px auto; }
  h1 { font-size: 22pt; margin: 0 0 8px; }
  h2 { font-size: 14pt; margin: 22px 0 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
  h3 { font-size: 12pt; margin: 16px 0 6px; }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 12px 22px; }
  li { margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; vertical-align: top; }
  img { max-width: 100%; height: auto; }
  .meta { color: #64748b; font-size: 10pt; margin-bottom: 20px; }
  .doc-control { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 12px; margin: 0 0 20px; }
</style>
</head>
<body>
  <h1>${safeTitle}</h1>
  ${metaLine ? `<p class="meta">${metaLine}</p>` : ''}
  ${bodyHtml || '<p></p>'}
</body>
</html>`;
  }

  function downloadTextFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType || 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportHtmlAsGoogleDoc(title, bodyHtml, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const html = buildWordHtmlDocument(title, bodyHtml, opts);
    const filename = `${sanitizeFileName(title)}.doc`;
    downloadTextFile(filename, html, 'application/msword;charset=utf-8');
    return { filename, html };
  }

  const api = {
    escapeHtml,
    sanitizeFileName,
    buildWordHtmlDocument,
    downloadTextFile,
    exportHtmlAsGoogleDoc,
  };

  global.GoogleDocExport = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
