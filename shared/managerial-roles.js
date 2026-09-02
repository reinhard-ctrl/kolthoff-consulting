/**
 * Manager Governance & Authority Charter policy.
 * Shape: {
 *   title, documentRef, docControl, introduction, sections[],
 *   divisions: [{
 *     id, number, title,
 *     roles: [{
 *       id, number, title, incumbent, reportsTo, directReports, summary,
 *       accountable, responsible, consulted, informed,
 *       specialAuthority, approvalLimits, responsibilities
 *     }]
 *   }]
 * }
 * Reference structure: managerial JD packs (divisions → role cards with RACI rights).
 */
(function (global) {
  function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function createEmptyRole(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    return {
      id: o.id || makeId('mgr'),
      number: o.number != null ? String(o.number) : '',
      title: o.title != null ? String(o.title) : '',
      incumbent: o.incumbent != null ? String(o.incumbent) : '',
      reportsTo: o.reportsTo != null ? String(o.reportsTo) : '',
      directReports: o.directReports != null ? String(o.directReports) : '',
      summary: o.summary != null ? String(o.summary) : '',
      accountable: o.accountable != null ? String(o.accountable) : '',
      responsible: o.responsible != null ? String(o.responsible) : '',
      consulted: o.consulted != null ? String(o.consulted) : '',
      informed: o.informed != null ? String(o.informed) : '',
      specialAuthority: o.specialAuthority != null ? String(o.specialAuthority) : '',
      approvalLimits: o.approvalLimits != null ? String(o.approvalLimits) : '',
      responsibilities: o.responsibilities != null ? String(o.responsibilities) : '',
    };
  }

  function createEmptyDivision(overrides) {
    const o = overrides && typeof overrides === 'object' ? overrides : {};
    const roles = Array.isArray(o.roles) && o.roles.length
      ? o.roles.map((r) => createEmptyRole(r))
      : [createEmptyRole({ title: 'New managerial role' })];
    return {
      id: o.id || makeId('div'),
      number: o.number != null ? String(o.number) : '',
      title: o.title != null ? String(o.title) : 'Untitled division',
      roles,
    };
  }

  const DEFAULT_DIVISIONS = [
    createEmptyDivision({
      id: 'div-exec',
      number: '1',
      title: 'Executive Office',
      roles: [
        createEmptyRole({
          id: 'role-ceo',
          number: '1.1',
          title: 'Chief Executive Officer (CEO)',
          incumbent: 'Andre Philip Uy',
          reportsTo: 'Board of Directors',
          directReports:
            'Head of Legal, Regulatory & Compliance; Chief Operating Officer (COO); HR Manager; Finance Manager; Marketing Manager',
          summary:
            'The Chief Executive Officer holds ultimate executive accountability for enterprise strategy, corporate vision, operational alignment, capital allocation, board governance, and commercial growth across all digital and retail gaming channels.',
          accountable:
            'Corporate Strategy & Annual Business Plan; Annual Operating & Capital Budget Approvals; Gaming Content & Game Supplier Contract Approvals; Introduction of New Gaming Product Verticals; Outlet & Merchant Gaming Agent Onboarding; Player Bonusing Approvals; Legal Dispute Settlements & Litigation Strategy; Corporate Treasury Transfers & Dividend Distributions; Monthly / Annual Financial Statement Sign-offs; Tax Filing Strategy & Statutory Audit Filings; Executive & Managerial Level Recruitment; Corporate Compensation Bands & Benefits Architecture; Master Brand Campaigns & Promotional Ad Spend; Sports Sponsorships & Athletic League Contracts; Crisis PR & Public Communications Releases.',
          consulted: 'Corporate Governance Policy Amendments.',
          informed:
            'PAGCOR License Acquisition, Renewals & Filings; KYC Thresholds & Account Freeze Criteria; Suspicious Transaction (STR) Filings; High-Value Customer Withdrawal Approvals; Merchant Compliance Enforcement; Blacklist & Self-Exclusion Execution; Tech Infrastructure & System Releases; Payment Gateway Onboarding; Employee Disciplinary Actions.',
          responsibilities:
            '1. Direct macro corporate vision, annual business planning, and strategic expansion across physical gaming outlets and digital betting platforms.\n2. Provide executive oversight to direct C-suite and division heads, ensuring organizational alignment with business targets.\n3. Manage strategic governance relationships with PAGCOR, statutory bodies, key commercial suppliers, and the Board of Directors.\n4. Lead corporate capital allocation, treasury distributions, and long-term financial planning in coordination with the Finance Manager.',
        }),
      ],
    }),
    createEmptyDivision({
      id: 'div-legal',
      number: '2',
      title: 'Legal, Regulatory & Compliance Division',
      roles: [
        createEmptyRole({
          id: 'role-legal',
          number: '2.1',
          title: 'Head of Legal, Regulatory & Compliance',
          incumbent: 'To Be Hired (TBH)',
          reportsTo: 'Chief Executive Officer (CEO)',
          directReports:
            'PAGCOR & Regulatory Licensing Governance Lead; Outlet & Merchant Compliance Lead; Policy Oversight Lead (AML / KYC Standards)',
          summary:
            'The Head of Legal, Regulatory & Compliance serves as the principal legal authority and regulatory officer for the Corporation. Operating independently of commercial operations, this role guarantees total adherence to PAGCOR license conditions, Anti-Money Laundering (AML/CFT) laws, Data Privacy Act (DPA) mandates, and corporate governance standards.',
          accountable:
            'PAGCOR License Acquisition, Renewals & Filings; KYC Validation Thresholds & Account Freeze Criteria; Suspicious Transaction (STR) Filing & AML Escalations; Merchant & Outlet Compliance Enforcement / Penalties; Blacklist & Self-Exclusion Program Execution; Data Privacy (DPA) & Cybersecurity Policy Governance.',
          responsible: 'Statutory & Regulatory Compliance Audits; Legal Dispute Settlements & Litigation Strategy.',
          specialAuthority:
            'Veto / Compliance Overwrite Power (Rule 6.2): Independent authority to halt any commercial campaign, product feature, or branch operation that breaches legal, PAGCOR, or AML/CFT standards.',
          approvalLimits: 'Standard Departmental Services Contracts (OPEX up to ₱10,000 without prior budget line pre-approval).',
          responsibilities:
            '1. Lead all regulatory filings, license renewals, statutory communications, and official correspondence with PAGCOR, AMLC, and statutory authorities.\n2. Oversee compliance auditing and enforcement across retail gaming branches, merchant outlets, and agent partners.\n3. Develop, audit, and update corporate policy frameworks for Anti-Money Laundering (AML), Counter-Financing of Terrorism (CFT), Know-Your-Customer (KYC), and Data Privacy.\n4. Direct litigation defense, legal dispute settlements, corporate contract reviews, and intellectual property protections in coordination with external legal counsel.',
        }),
      ],
    }),
    createEmptyDivision({
      id: 'div-ops',
      number: '3',
      title: 'Operations Division (C-Suite & Functional Management)',
      roles: [
        createEmptyRole({
          id: 'role-coo',
          number: '3.1',
          title: 'Chief Operating Officer (COO)',
          incumbent: 'Eric Lance Uy',
          reportsTo: 'Chief Executive Officer (CEO)',
          directReports:
            'IT Manager (IT Infrastructure & Operations); Tech Project Manager (Tech Development & Software Engineering); Admin Manager (General Administration); Senior Operations Manager (Customer Operations); Branch Manager (Outlet Management); Operations Manager (Gaming Product Management); Operations Manager (Risk & Security Operations)',
          summary:
            'The Chief Operating Officer holds overall executive oversight over operational execution, technical infrastructure, software engineering delivery, customer experience, retail branch networks, gaming verticals, and risk/security operations. The COO translates strategic plans into robust, scalable daily operations.',
          accountable:
            'Corporate Governance Policy Amendments; Statutory & Regulatory Compliance Audit Approvals; Yield Strategy, Margin Target & Payout Adjustments; Player Bonus Architecture; Tech Infrastructure Architecture & Cloud Deployment; Platform Downtime SLAs & Disaster Recovery Plans; Software & Hardware Engineering Procurement; System Code Release & Platform Deployment Sign-offs.',
          responsible:
            'Gaming Content & Supplier Contracts; Introduction of New Gaming Product Verticals; Outlet & Merchant Gaming Agent Onboarding; KYC Validation Thresholds Execution; High-Value Customer Withdrawal Processing; Blacklist & Self-Exclusion Program Execution.',
          specialAuthority:
            'Emergency Authority (Rule R-03): Power to execute emergency platform or gaming line suspensions during active fraud exploits, severe network outages, or critical cybersecurity breaches (notifying CEO and Legal within 30 minutes).',
          responsibilities:
            '1. Direct daily operational workflows, system releases, network infrastructure, and platform delivery to ensure high uptime and service stability.\n2. Oversee direct operational managers across retail gaming branches, customer support, game verticals, and risk/fraud units.\n3. Drive yield strategies, payout margin targets, and house edge calibrations in coordination with Gaming Product Management and Finance.\n4. Authorize software procurement, cloud infrastructure architecture, and technical vendor SLAs.',
        }),
        createEmptyRole({
          id: 'role-it',
          number: '3.2',
          title: 'IT Manager (IT Infrastructure & Operations)',
          incumbent: 'Jodel Dalina',
          reportsTo: 'Chief Operating Officer (COO)',
          directReports: 'IT Network Engineers; System Administrators; Telecom Specialists; Database Administrators',
          summary:
            'The IT Manager leads the physical and cloud technology infrastructure, server architecture, network security, hardware procurement, and database administration of the Corporation. This position ensures enterprise cyber resilience and 24/7 uptime across corporate and platform network environments.',
          responsible:
            'Tech Infrastructure Architecture & Cloud Deployment; Platform Downtime SLAs & Disaster Recovery Plans; Software & Hardware Engineering Procurement; Data Privacy & Cybersecurity Technical Controls Implementation; System Code Environment Preparation.',
          approvalLimits: 'Departmental Services / IT OPEX up to ₱10,000 (pre-approved budget execution).',
          responsibilities:
            '1. Manage enterprise cloud servers, telecom links, workstation hardware, network connectivity, and database availability.\n2. Enforce disaster recovery (DR) protocols, automated backup procedures, and business continuity plans across all technical environments.\n3. Manage network firewalls, employee access credentials, hardware provisioning, and IT service desk management.\n4. Maintain vendor relations with cloud providers, internet service providers (ISPs), and network hardware suppliers.',
        }),
        createEmptyRole({
          id: 'role-pm',
          number: '3.3',
          title: 'Project Manager (Tech Development & Software Engineering)',
          incumbent: 'Roxanne',
          reportsTo: 'Chief Operating Officer (COO)',
          directReports: 'QA Lead; Quality Assurance (QA) Engineers; Software Engineers / Developers',
          summary:
            'The Tech Development & Software Engineering Project Manager directs software engineering cycles, feature release management, quality assurance testing, and platform deployment schedules. This position ensures timely delivery of digital betting applications, back-office administration systems, and game API integrations.',
          responsible:
            'System Code Release & Platform Deployment Execution; Software Engineering Task Prioritization; QA System Testing Protocols & Development Lifecycle Management.',
          responsibilities:
            '1. Manage agile development sprints, product backlogs, software deployment roadmaps, and bug-tracking workflows.\n2. Direct QA Engineers in executing end-to-end integration, stress testing, and regression testing prior to production sign-off.\n3. Coordinate with product managers and third-party game engine providers to integrate core betting features and API pipelines.\n4. Maintain technical documentation, deployment logs, and release notes for all system updates.',
        }),
        createEmptyRole({
          id: 'role-admin',
          number: '3.4',
          title: 'General Administration Manager',
          incumbent: 'Mina Morales',
          reportsTo: 'Chief Operating Officer (COO)',
          directReports: 'Admin Officers; Facilities Staff; Logistics Coordinators; Procurement Assistants',
          summary:
            'The General Administration Manager oversees corporate physical facilities, administrative purchasing, office lease administration, logistics, and workplace support. This role ensures functional, safe, and efficient physical work environments across corporate locations.',
          responsible: 'Corporate Facilities Maintenance; Admin Asset Procurement; Workplace Logistics; Administrative Operational Execution.',
          approvalLimits: 'Administrative OPEX up to ₱10,000 (pre-approved line item execution).',
          responsibilities:
            '1. Manage office lease agreements, building safety, physical facility maintenance, and utility administration.\n2. Direct administrative procurement, inventory control of office assets, and workplace supply distribution.\n3. Coordinate travel arrangements, administrative vendor service contracts, and facility security protocols.\n4. Support company event logistics and workplace administrative services.',
        }),
        createEmptyRole({
          id: 'role-cs',
          number: '3.5',
          title: 'Senior Operations Manager (Customer Operations)',
          incumbent: 'Katrine Demaisp',
          reportsTo: 'Chief Operating Officer (COO)',
          directReports:
            'CS Operations Lead (SMEs, Team Leads, CS Agents); QA & L&D Manager (QA Team, Customer Operations L&D Team); Workforce & Admin Manager',
          summary:
            'The Senior Operations Manager for Customer Operations leads multi-channel player support operations. This role drives service quality, queue efficiency, resolution speed, CS Quality Assurance, and functional product training across all player contact channels.',
          responsible:
            'Customer Support Workflow Execution; CS Escalation Protocols; Workforce Queue Allocation & Shift Scheduling; CS Functional L&D & Quality Control.',
          responsibilities:
            '1. Direct 24/7 customer support service operations, maintaining established SLA standards for response speed and dispute resolution.\n2. Oversee Customer Support QA and functional L&D teams to train agents on game rules, customer communications, and ticketing software workflows (Rule 6.3).\n3. Oversee workforce planning, shift rotation, queue load management, and CS administrative tools.\n4. Handle high-tier player support escalations and coordinate with Risk/KYC teams regarding account verification holds.',
        }),
        createEmptyRole({
          id: 'role-branch',
          number: '3.6',
          title: 'Branch Manager (Outlet Management)',
          incumbent: 'To Be Hired (TBH)',
          reportsTo: 'Chief Operating Officer (COO)',
          directReports: 'Outlet Supervisors; Retail Branch Leads; Cashiers; Field Support Technicians',
          summary:
            'The Branch Manager holds overall operational responsibility for physical retail gaming branches, outlets, and partner merchant agent locations. This role drives branch cashiering controls, physical site onboarding, and on-site player service execution.',
          responsible:
            'Outlet & Branch Operations Execution; On-Site Cashiering & Cash Handling Protocols; Physical Branch Setup & Onboarding.',
          responsibilities:
            '1. Manage daily operations across physical retail gaming branches and partner merchant outlets.\n2. Oversee physical branch cashiering procedures, cash float handling, terminal uptime, and daily cash reconciliations.\n3. Coordinate physical setup, equipment deployment, and staffing for new retail outlets and agent locations.\n4. Enforce physical branch adherence to PAGCOR floor layout rules, signage requirements, and age restriction checks in alignment with Compliance.',
        }),
        createEmptyRole({
          id: 'role-gaming',
          number: '3.7',
          title: 'Operations Manager (Gaming Product Management)',
          incumbent: 'To Be Hired (TBH)',
          reportsTo: 'Chief Operating Officer (COO)',
          directReports: 'Sportsbook Lead; Casino & Slot Lead; Poker Vertical Lead',
          summary:
            'The Operations Manager for Gaming Product Management oversees commercial product vertical management, supplier game integrations, yield strategy execution, and portfolio optimization across Sportsbook, Casino, Slots, and Poker. Maintaining strict separation from Risk & KYC teams (Rule 6.1), this role drives player engagement and content performance.',
          responsible:
            'Gaming Product Roadmap Proposals; Third-Party Content Integration Plans; Game Yield & Margin Optimization; Player Bonus Architecture Inputs.',
          responsibilities:
            '1. Manage commercial performance, engagement metrics, and margin optimization across Sportsbook, Casino, Slot, and Poker portfolios.\n2. Evaluate and propose new third-party game content, supplier partnerships, and engine integrations to the COO and CEO.\n3. Analyze house edge, RTP (Return to Player) rates, and overall product profitability in coordination with Finance.\n4. Collaborate with Marketing to design engaging product promotions, wagering mechanics, and tournament campaigns.',
        }),
        createEmptyRole({
          id: 'role-risk',
          number: '3.8',
          title: 'Operations Manager (Risk & Security Operations)',
          incumbent: 'To Be Hired (TBH)',
          reportsTo: 'Chief Operating Officer (COO)',
          directReports: 'KYC Team Lead (Verification Officers); Risk & Fraud Team Lead (Fraud Analysts, Account Security Officers)',
          summary:
            'The Operations Manager for Risk & Security Operations leads fraud detection, identity verification (KYC), account integrity enforcement, bonus abuse prevention, and player security controls. Operating independently of commercial product targets (Rule 6.1), this role protects platform assets against fraud and operational exploits.',
          responsible:
            'KYC Operational Screening & Document Verification; Fraud Pattern Monitoring & Account Suspension Execution; Bonus Abuse Tracking; Blacklist & Self-Exclusion Execution.',
          consulted: 'High-Value Customer Withdrawal Approvals (> Threshold).',
          responsibilities:
            '1. Direct the KYC team in performing player identity verification, document screening, PEP checks, and account validation procedures.\n2. Oversee Fraud Analysts in monitoring real-time betting patterns, syndicate activity, multiple account exploits, and payment fraud.\n3. Execute immediate account holds and temporary withdrawal freezes upon detecting suspicious activity or bonus abuse.\n4. Coordinate with Legal/Compliance to report suspicious transactions (STRs) and maintain updated self-exclusion/blacklist registries.',
        }),
      ],
    }),
    createEmptyDivision({
      id: 'div-hr',
      number: '4',
      title: 'Human Resources Division',
      roles: [
        createEmptyRole({
          id: 'role-hr',
          number: '4.1',
          title: 'Human Resources Manager',
          incumbent: 'Denis Batungbacal',
          reportsTo: 'Chief Executive Officer (CEO)',
          directReports:
            'Talent Acquisition Lead; Compensation & Benefits Lead; Employee Relations Lead; Training & Development (Corporate L&D) Specialist',
          summary:
            'The HR Manager leads executive and staff recruitment, organizational design, compensation and benefits management, employee relations, labor law compliance, and corporate culture development. This position fosters corporate performance while ensuring strict adherence to Philippine Labor Laws.',
          accountable: 'Employee Disciplinary Actions & Terminations; Company-Wide Leadership & Cultural L&D.',
          responsible:
            'Corporate Governance Policy Amendment Filings; Executive & Managerial Recruitment; Corporate Compensation Bands & Benefits Architecture Execution.',
          approvalLimits: 'Standard HR OPEX up to ₱10,000 (pre-approved line item execution).',
          responsibilities:
            '1. Direct candidate sourcing, executive recruitment, and hiring workflows across all corporate divisions.\n2. Oversee compensation structures, health benefits administration, payroll processing, and performance review cycles.\n3. Lead corporate culture initiatives, leadership development, company-wide onboarding, and soft-skills training (Rule 6.3).\n4. Manage employee labor relations, workplace grievance procedures, disciplinary proceedings, and statutory labor compliance.',
        }),
      ],
    }),
    createEmptyDivision({
      id: 'div-finance',
      number: '5',
      title: 'Finance Division',
      roles: [
        createEmptyRole({
          id: 'role-finance',
          number: '5.1',
          title: 'Finance Manager',
          incumbent: 'Wihl Mathew Zalatar',
          reportsTo: 'Chief Executive Officer (CEO)',
          directReports: 'Accounting Lead; Accounts Payable Lead; Treasury Lead',
          summary:
            'The Finance Manager directs corporate accounting, treasury operations, payment gateway settlements, tax compliance, statutory financial reporting, disbursements, and audit management. This position enforces rigid capital controls and ensures transparent financial oversight.',
          accountable:
            'High-Value Customer Withdrawal Approvals (> Threshold); Payment Gateway Onboarding & Merchant Fee Negotiation.',
          responsible:
            'Annual Operating & Capital Budget Approvals; Corporate Treasury Transfers & Dividend Distributions; Monthly / Annual Financial Statement Preparation; Tax Filing Strategy & Statutory Audit Filings.',
          responsibilities:
            '1. Direct general ledger accounting, statutory tax filings (BIR), financial reporting, and annual statutory audits.\n2. Oversee daily treasury operations, cash flow forecasting, payment gateway reconciliations, and banking relations.\n3. Manage Accounts Payable processing, vendor disbursements, and departmental operational budget variance tracking.\n4. Prepare profit-and-loss statements, balance sheets, and financial analyses for executive leadership and the Board of Directors.',
        }),
      ],
    }),
    createEmptyDivision({
      id: 'div-mkt',
      number: '6',
      title: 'Marketing Division',
      roles: [
        createEmptyRole({
          id: 'role-mkt',
          number: '6.1',
          title: 'Marketing Manager',
          incumbent: 'To Be Hired (TBH)',
          reportsTo: 'Chief Executive Officer (CEO)',
          directReports:
            'Growth & Performance Marketing (Acquisition) Lead; Lifecycle & VIP Player Operations (Retention & LTV) Lead; Brand, Sponsorships & Affiliate Network Lead; PR, Social Media & Community Management Lead; Marketing Operations, Data Analytics & Compliance Lead',
          summary:
            'The Marketing Manager drives brand strategy, digital user acquisition, player retention, sports league partnerships, public relations, and campaign analytics. This role optimizes customer lifetime value (LTV) while ensuring full compliance with PAGCOR advertising regulations.',
          responsible:
            'Player Bonusing Execution; Master Brand Campaigns & Promotional Ad Spend; Sports Sponsorships & Athletic League Contracts; Crisis PR & Public Communications Release Preparation.',
          approvalLimits: 'Marketing OPEX up to ₱10,000 (pre-approved line item execution).',
          responsibilities:
            '1. Direct digital customer acquisition channels, paid performance marketing campaigns, SEO/SEM strategies, and affiliate networks.\n2. Oversee player retention initiatives, VIP loyalty management, CRM automated campaigns, and churn prevention programs.\n3. Manage corporate brand strategy, sports league partnerships, promotional sponsorships, and affiliate contracts.\n4. Direct PR communications, social media channels, and community engagement while ensuring all advertising assets comply with PAGCOR advertising rules.',
        }),
      ],
    }),
  ];

  const POLICY_TITLE = 'Manager Governance & Authority Charter';
  const LEGACY_POLICY_TITLES = [
    'Managerial Role Descriptions & Executive Specifications',
    'Managerial Role Descriptions',
  ];

  const DEFAULT_MANAGERIAL_ROLES = {
    title: POLICY_TITLE,
    documentRef: 'HR-JD-2026-001',
    docControl: {
      version: '1.0',
      effectiveDate: '2026-08-11',
      lastReviewed: '2026-08-11',
      owner: 'HR Manager',
      approvedBy: 'Board of Directors & Chief Executive Officer',
    },
    introduction:
      'This charter defines managerial governance and authority by division — including reporting lines, role mandates, primary RACI accountabilities, approval limits, special authorities, and key responsibilities.',
    sections: [],
    divisions: DEFAULT_DIVISIONS.map((d) => createEmptyDivision(d)),
  };

  function normalizeDivisions(raw, fallback) {
    const base = Array.isArray(fallback) && fallback.length ? fallback : DEFAULT_DIVISIONS;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((d) => createEmptyDivision(d));
    }
    return base.map((d) => createEmptyDivision(d));
  }

  function resolvePolicyTitle(loadedTitle, fallbackTitle) {
    const fallback = fallbackTitle || POLICY_TITLE;
    const title = loadedTitle != null ? String(loadedTitle).trim() : '';
    if (!title || LEGACY_POLICY_TITLES.includes(title)) return fallback;
    return title;
  }

  function mergeManagerialRoles(defaultDoc, loadedDoc) {
    const base = JSON.parse(JSON.stringify(defaultDoc || DEFAULT_MANAGERIAL_ROLES));
    if (!loadedDoc || typeof loadedDoc !== 'object') {
      return {
        ...base,
        title: resolvePolicyTitle(base.title, POLICY_TITLE),
        divisions: normalizeDivisions(base.divisions, DEFAULT_DIVISIONS),
      };
    }
    return {
      ...base,
      ...loadedDoc,
      title: resolvePolicyTitle(loadedDoc.title, base.title || POLICY_TITLE),
      documentRef: loadedDoc.documentRef != null ? String(loadedDoc.documentRef) : (base.documentRef || ''),
      docControl: { ...base.docControl, ...(loadedDoc.docControl || {}) },
      sections: loadedDoc.sections?.length ? loadedDoc.sections : base.sections,
      divisions: normalizeDivisions(loadedDoc.divisions, base.divisions || DEFAULT_DIVISIONS),
    };
  }

  function cell(v) {
    return String(v || '—').replace(/\|/g, '\\|');
  }

  /**
   * Split dense field text (semicolon / newline / numbered lists) into scannable items.
   * Used by client PDF briefs and markdown export so RACI is not one wall of prose.
   */
  function splitFieldItems(raw) {
    const s = String(raw || '').trim();
    if (!s) return [];
    const parts = s
      .split(/\n+|(?:;\s*)+/)
      .map((part) => String(part || '').replace(/^\d+[\.\)]\s*/, '').trim())
      .filter(Boolean);
    return parts.length ? parts : [s];
  }

  function formatItemsAsMarkdownList(raw) {
    const items = splitFieldItems(raw);
    if (!items.length) return '';
    return items.map((item) => `- ${item}`).join('\n');
  }

  function formatNumberedMarkdownList(raw) {
    const items = splitFieldItems(raw);
    if (!items.length) return '';
    return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  }

  function buildRoleIndex(normalized) {
    const rows = [];
    (normalized.divisions || []).forEach((div, divIdx) => {
      const divNumber = div.number || String(divIdx + 1);
      const divTitle = div.title || 'Division';
      (div.roles || []).forEach((role, roleIdx) => {
        rows.push({
          divisionNumber: divNumber,
          divisionTitle: divTitle,
          roleNumber: role.number || `${divNumber}.${roleIdx + 1}`,
          roleTitle: role.title || 'Role',
          incumbent: role.incumbent || '—',
        });
      });
    });
    return rows;
  }

  function compileManagerialRolesMarkdown(doc) {
    const normalized = mergeManagerialRoles(DEFAULT_MANAGERIAL_ROLES, doc);
    let md = `# ${normalized.title || POLICY_TITLE}\n\n`;
    if (normalized.documentRef) md += `**Document Reference:** ${normalized.documentRef}\n\n`;
    const dc = normalized.docControl || {};
    const meta = [];
    if (dc.version) meta.push(`**Version:** ${dc.version}`);
    if (dc.effectiveDate) meta.push(`**Effective Date:** ${dc.effectiveDate}`);
    if (dc.owner) meta.push(`**Owner:** ${dc.owner}`);
    if (dc.approvedBy) meta.push(`**Approved By:** ${dc.approvedBy}`);
    if (meta.length) md += `${meta.join(' · ')}\n\n`;
    if (normalized.introduction) md += `## Introduction\n${normalized.introduction}\n\n`;

    const index = buildRoleIndex(normalized);
    if (index.length) {
      md += `## Role Index\n\n`;
      let lastDiv = null;
      index.forEach((row) => {
        const divKey = `${row.divisionNumber}|${row.divisionTitle}`;
        if (divKey !== lastDiv) {
          md += `### ${row.divisionNumber}. ${row.divisionTitle}\n\n`;
          lastDiv = divKey;
        }
        md += `- **${row.roleNumber} ${row.roleTitle}** — ${row.incumbent}\n`;
      });
      md += '\n';
    }

    (normalized.divisions || []).forEach((div) => {
      md += `## ${div.number ? `${div.number}. ` : ''}${div.title || 'Division'}\n\n`;
      (div.roles || []).forEach((role) => {
        md += `### ${role.number ? `${role.number} ` : ''}${role.title || 'Role'}\n\n`;
        md += `| Field | Detail |\n|------|--------|\n`;
        md += `| Incumbent / Status | ${cell(role.incumbent)} |\n`;
        md += `| Reports To | ${cell(role.reportsTo)} |\n`;
        md += `| Direct Reports | ${cell(role.directReports)} |\n\n`;
        if (role.summary) md += `#### Role Summary\n\n${role.summary}\n\n`;

        const raciBlocks = [
          { key: 'accountable', label: 'Accountable (A)' },
          { key: 'responsible', label: 'Responsible (R)' },
          { key: 'consulted', label: 'Consulted (C)' },
          { key: 'informed', label: 'Informed (I)' },
        ];
        const hasRaci = raciBlocks.some((b) => String(role[b.key] || '').trim());
        if (hasRaci) {
          md += '#### Governance Rights (RACI)\n\n';
          raciBlocks.forEach((b) => {
            const list = formatItemsAsMarkdownList(role[b.key]);
            if (!list) return;
            md += `**${b.label}**\n\n${list}\n\n`;
          });
        }

        if (role.specialAuthority) {
          md += `#### Special Authority\n\n${formatItemsAsMarkdownList(role.specialAuthority) || role.specialAuthority}\n\n`;
        }
        if (role.approvalLimits) {
          md += `#### Approval Limits\n\n${formatItemsAsMarkdownList(role.approvalLimits) || role.approvalLimits}\n\n`;
        }
        if (role.responsibilities) {
          md += `#### Key Responsibilities\n\n${formatNumberedMarkdownList(role.responsibilities) || role.responsibilities}\n\n`;
        }
      });
    });

    (normalized.sections || []).forEach((sec) => {
      md += `## ${sec.title || 'Section'}\n${sec.content || ''}\n\n`;
    });

    return md.trim();
  }

  const api = {
    createEmptyRole,
    createEmptyDivision,
    normalizeDivisions,
    POLICY_TITLE,
    LEGACY_POLICY_TITLES,
    DEFAULT_DIVISIONS,
    DEFAULT_MANAGERIAL_ROLES,
    resolvePolicyTitle,
    mergeManagerialRoles,
    splitFieldItems,
    formatItemsAsMarkdownList,
    formatNumberedMarkdownList,
    buildRoleIndex,
    compileManagerialRolesMarkdown,
  };

  global.ManagerialRoles = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
