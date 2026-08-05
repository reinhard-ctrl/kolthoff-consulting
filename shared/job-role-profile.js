/**
 * Job Role Profile helpers — structured one-page role documents.
 * Used by Policy Studio (editor, vault export, load migration).
 */
(function (global) {
  const EMPTY_JOB_ROLE_FIELDS = {
    department: '',
    reportsTo: '',
    purpose: '',
    responsibilities: '',
    successMeasures: '',
    skillsTools: '',
    collaboratesWith: '',
    outOfScope: '',
    content: '',
  };

  function createEmptyJobRole(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    return {
      id: o.id || `jd-${Date.now()}`,
      title: o.title || 'New Job Role Profile',
      ...EMPTY_JOB_ROLE_FIELDS,
      ...o,
    };
  }

  function bulletize(parts) {
    return (parts || [])
      .map((p) => String(p || '').trim())
      .filter(Boolean)
      .map((p) => (p.startsWith('•') ? p : `• ${p}`))
      .join('\n');
  }

  /** Pull structured fields out of legacy freeform `content` when needed. */
  function migrateJobRoleFromContent(role) {
    const raw = role && typeof role === 'object' ? role : {};
    const hasStructured = Boolean(
      String(raw.purpose || '').trim() ||
        String(raw.responsibilities || '').trim() ||
        String(raw.successMeasures || '').trim() ||
        String(raw.skillsTools || '').trim() ||
        String(raw.reportsTo || '').trim() ||
        String(raw.department || '').trim()
    );
    if (hasStructured) {
      return {
        ...EMPTY_JOB_ROLE_FIELDS,
        ...raw,
        id: raw.id || `jd-${Date.now()}`,
        title: raw.title || 'Job Role Profile',
      };
    }

    const content = String(raw.content || '').trim();
    if (!content) {
      return createEmptyJobRole({ id: raw.id, title: raw.title || 'Job Role Profile' });
    }

    const lines = content
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean);
    let purpose = '';
    let reportsTo = '';
    let responsibilities = '';
    let skillsTools = '';
    const leftover = [];

    lines.forEach((line) => {
      const lower = line.toLowerCase();
      if (/^reports?\s*to\s*:/.test(lower)) {
        reportsTo = line.replace(/^reports?\s*to\s*:/i, '').trim();
        return;
      }
      if (/^(must-?dos?|responsibilities|duties)\s*:/i.test(line)) {
        const rest = line.replace(/^(must-?dos?|responsibilities|duties)\s*:/i, '').trim();
        responsibilities = bulletize(rest.split(/;|•/));
        return;
      }
      if (/^(skills?|tools?|skills\s*&\s*tools?)\s*:/i.test(line)) {
        const rest = line.replace(/^(skills?|tools?|skills\s*&\s*tools?)\s*:/i, '').trim();
        skillsTools = bulletize(rest.split(/;|,|•/));
        return;
      }
      if (/^owns?\b/i.test(line) || /^purpose\s*:/i.test(line)) {
        purpose = line.replace(/^purpose\s*:/i, '').trim();
        return;
      }
      leftover.push(line);
    });

    if (!purpose && leftover.length) purpose = leftover.shift();
    if (!responsibilities && leftover.length) responsibilities = bulletize(leftover);

    return createEmptyJobRole({
      id: raw.id,
      title: raw.title || 'Job Role Profile',
      department: raw.department || '',
      reportsTo: reportsTo || raw.reportsTo || '',
      purpose: purpose || '',
      responsibilities: responsibilities || '',
      successMeasures: raw.successMeasures || '',
      skillsTools: skillsTools || '',
      collaboratesWith: raw.collaboratesWith || '',
      outOfScope: raw.outOfScope || '',
      content: raw.content || '',
    });
  }

  function compileJobRoleMarkdown(role) {
    const r = migrateJobRoleFromContent(role || {});
    let md = `# ${r.title || 'Job Role Profile'}\n\n`;
    const meta = [r.department, r.reportsTo ? `Reports to: ${r.reportsTo}` : ''].filter(Boolean).join(' · ');
    if (meta) md += `${meta}\n\n`;
    if (String(r.purpose || '').trim()) md += `## Purpose\n${r.purpose.trim()}\n\n`;
    if (String(r.responsibilities || '').trim()) md += `## Key responsibilities\n${r.responsibilities.trim()}\n\n`;
    if (String(r.successMeasures || '').trim()) md += `## Success measures\n${r.successMeasures.trim()}\n\n`;
    if (String(r.skillsTools || '').trim()) md += `## Skills & tools\n${r.skillsTools.trim()}\n\n`;
    if (String(r.collaboratesWith || '').trim()) md += `## Collaborates with\n${r.collaboratesWith.trim()}\n\n`;
    if (String(r.outOfScope || '').trim()) md += `## Out of scope\n${r.outOfScope.trim()}\n\n`;
    if (
      !String(r.purpose || '').trim() &&
      !String(r.responsibilities || '').trim() &&
      !String(r.successMeasures || '').trim() &&
      !String(r.skillsTools || '').trim() &&
      String(r.content || '').trim()
    ) {
      md += `${r.content.trim()}\n`;
    }
    return md.trim();
  }

  global.JobRoleProfile = {
    EMPTY_JOB_ROLE_FIELDS,
    createEmptyJobRole,
    migrateJobRoleFromContent,
    compileJobRoleMarkdown,
  };
})(typeof window !== 'undefined' ? window : globalThis);
