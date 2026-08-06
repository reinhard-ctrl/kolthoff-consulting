/**
 * Communication Plan policy — meeting cadence tiers + tools/channels.
 * Shape: {
 *   title, docControl, introduction, sections[],
 *   tiers: [{ id, tier, name, cadence, duration, purpose, attendees, owner, channel }],
 *   channels: [{ id, tool, purpose, audience, cadenceOrSla, notes }]
 * }
 */
(function (global) {
  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function createEmptyTier(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    return {
      id: o.id || makeId('tier'),
      tier: o.tier != null ? String(o.tier) : '',
      name: o.name != null ? String(o.name) : '',
      cadence: o.cadence != null ? String(o.cadence) : '',
      duration: o.duration != null ? String(o.duration) : '',
      purpose: o.purpose != null ? String(o.purpose) : '',
      attendees: o.attendees != null ? String(o.attendees) : '',
      owner: o.owner != null ? String(o.owner) : '',
      channel: o.channel != null ? String(o.channel) : '',
    };
  }

  function createEmptyChannel(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    return {
      id: o.id || makeId('ch'),
      tool: o.tool != null ? String(o.tool) : '',
      purpose: o.purpose != null ? String(o.purpose) : '',
      audience: o.audience != null ? String(o.audience) : '',
      cadenceOrSla: o.cadenceOrSla != null ? String(o.cadenceOrSla) : '',
      notes: o.notes != null ? String(o.notes) : '',
    };
  }

  const DEFAULT_TIERS = [
    createEmptyTier({
      id: 'tier-1',
      tier: 'Tier 1',
      name: 'Strategy-to-Execution Sync',
      cadence: 'Bi-Weekly',
      duration: '45 mins',
      purpose: 'Align leadership priorities with delivery progress, unblock cross-team decisions, and confirm the next two-week focus.',
      attendees: 'CEO / COO, department leads',
      owner: 'COO',
      channel: 'Video conference (Google Meet / Zoom)',
    }),
    createEmptyTier({
      id: 'tier-2',
      tier: 'Tier 2',
      name: 'Weekly Operational Sync',
      cadence: 'Weekly',
      duration: '30–45 mins',
      purpose: 'Review active work, capacity, risks, and handoffs so day-to-day operations stay on track.',
      attendees: 'Operations leads, team leads',
      owner: 'Operations Manager',
      channel: 'Video conference (Google Meet / Zoom)',
    }),
    createEmptyTier({
      id: 'tier-3',
      tier: 'Tier 3',
      name: 'Team Standup / Async Update',
      cadence: 'Daily (or 3× weekly)',
      duration: '10–15 mins',
      purpose: 'Share what shipped, what is next, and where help is needed without pulling everyone into long meetings.',
      attendees: 'Individual contributors + immediate lead',
      owner: 'Team lead',
      channel: 'Slack / Teams huddle or async thread',
    }),
  ];

  const DEFAULT_CHANNELS = [
    createEmptyChannel({
      id: 'ch-meet',
      tool: 'Google Meet / Zoom',
      purpose: 'Live syncs for Tier 1–2 meetings and client calls',
      audience: 'Leadership, ops leads, clients',
      cadenceOrSla: 'Per meeting invite',
      notes: 'Record Tier 1 when decisions need an audit trail; share notes in the project drive.',
    }),
    createEmptyChannel({
      id: 'ch-slack',
      tool: 'Slack / Microsoft Teams',
      purpose: 'Day-to-day coordination, quick questions, and Tier 3 updates',
      audience: 'All staff',
      cadenceOrSla: 'Respond within 4 business hours during work week',
      notes: 'Use channels by topic; escalate blockers with @owner rather than DMs-only.',
    }),
    createEmptyChannel({
      id: 'ch-email',
      tool: 'Email',
      purpose: 'Formal notices, client correspondence, and approvals that need a record',
      audience: 'External stakeholders, leadership',
      cadenceOrSla: 'Acknowledge within 1 business day',
      notes: 'Prefer Slack/Teams for internal working conversations.',
    }),
    createEmptyChannel({
      id: 'ch-docs',
      tool: 'Shared drive / Docs',
      purpose: 'Agendas, decision logs, and meeting notes',
      audience: 'Meeting attendees + informed stakeholders',
      cadenceOrSla: 'Notes posted within 24 hours of the meeting',
      notes: 'Link notes from the calendar invite and relevant Slack channel.',
    }),
  ];

  const DEFAULT_COMMUNICATION_PLAN = {
    title: 'Communication Plan',
    docControl: {
      version: '1.0',
      effectiveDate: '2026-07-06',
      lastReviewed: '2026-07-06',
      owner: 'COO',
    },
    introduction:
      'This plan defines how the organization communicates: which meeting tiers run on what cadence, who attends, and which tools to use so information flows without meeting overload.',
    sections: [
      {
        id: 'comm-norms',
        title: 'Communication norms',
        content:
          '- Prefer the lowest tier that still gets the decision made.\n- Every recurring meeting has an owner, agenda, and written notes.\n- Urgent issues escalate on Slack/Teams first; schedule a live call only when async cannot resolve them.\n- Keep client-facing and confidential topics in the approved channels listed below.',
      },
    ],
    tiers: DEFAULT_TIERS.map((t) => createEmptyTier(t)),
    channels: DEFAULT_CHANNELS.map((c) => createEmptyChannel(c)),
  };

  function normalizeTiers(raw, fallback) {
    const base = Array.isArray(fallback) && fallback.length ? fallback : DEFAULT_TIERS;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((row) => createEmptyTier(row));
    }
    return base.map((row) => createEmptyTier(row));
  }

  function normalizeChannels(raw, fallback) {
    const base = Array.isArray(fallback) && fallback.length ? fallback : DEFAULT_CHANNELS;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((row) => createEmptyChannel(row));
    }
    return base.map((row) => createEmptyChannel(row));
  }

  function mergeCommunicationPlan(defaultDoc, loadedDoc) {
    const base = JSON.parse(JSON.stringify(defaultDoc || DEFAULT_COMMUNICATION_PLAN));
    if (!loadedDoc || typeof loadedDoc !== 'object') {
      return {
        ...base,
        tiers: normalizeTiers(base.tiers, DEFAULT_TIERS),
        channels: normalizeChannels(base.channels, DEFAULT_CHANNELS),
      };
    }
    return {
      ...base,
      ...loadedDoc,
      docControl: { ...base.docControl, ...(loadedDoc.docControl || {}) },
      sections: loadedDoc.sections?.length ? loadedDoc.sections : base.sections,
      tiers: normalizeTiers(loadedDoc.tiers, base.tiers || DEFAULT_TIERS),
      channels: normalizeChannels(loadedDoc.channels, base.channels || DEFAULT_CHANNELS),
    };
  }

  function cell(v) {
    return String(v || '—').replace(/\|/g, '\\|');
  }

  function compileCommunicationPlanMarkdown(doc) {
    const normalized = mergeCommunicationPlan(DEFAULT_COMMUNICATION_PLAN, doc);
    let md = `# ${normalized.title || 'Communication Plan'}\n\n`;
    if (normalized.introduction) {
      md += `## Introduction\n${normalized.introduction}\n\n`;
    }

    md += '## 1. Meeting Cadence Tiers\n\n';
    md += '| Tier | Meeting | Cadence | Duration | Purpose | Attendees | Owner | Primary Channel |\n';
    md += '|------|---------|---------|----------|---------|-----------|-------|------------------|\n';
    (normalized.tiers || []).forEach((row) => {
      md +=
        '| ' +
        [row.tier, row.name, row.cadence, row.duration, row.purpose, row.attendees, row.owner, row.channel]
          .map(cell)
          .join(' | ') +
        ' |\n';
    });
    md += '\n';

    md += '## 2. Tools & Channels\n\n';
    md += '| Tool | Purpose | Audience | Cadence / SLA | Notes |\n';
    md += '|------|---------|----------|---------------|-------|\n';
    (normalized.channels || []).forEach((row) => {
      md +=
        '| ' +
        [row.tool, row.purpose, row.audience, row.cadenceOrSla, row.notes].map(cell).join(' | ') +
        ' |\n';
    });
    md += '\n';

    (normalized.sections || []).forEach((sec) => {
      md += `## ${sec.title || 'Section'}\n${sec.content || ''}\n\n`;
    });

    return md.trim();
  }

  const api = {
    createEmptyTier,
    createEmptyChannel,
    normalizeTiers,
    normalizeChannels,
    DEFAULT_TIERS,
    DEFAULT_CHANNELS,
    DEFAULT_COMMUNICATION_PLAN,
    mergeCommunicationPlan,
    compileCommunicationPlanMarkdown,
  };

  global.CommunicationPlan = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
