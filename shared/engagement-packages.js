/**
 * Kolthoff Operations Suite — engagement package definitions (MOD combinations + defaults).
 * Consumed by Project Planner (Packages tab) and public marketing site.
 */
(function (global) {
  const PACKAGES = [
    {
      id: 'leak-scan',
      name: 'Leak Scan',
      tagline: 'See where time and money leak before you spend on tools or hires.',
      forWhom: 'Skeptical owners who want proof before a bigger build.',
      modules: ['mod1'],
      marketingVisible: true,
      sortOrder: 1,
      tasks: {
        mode: 'modules',
        modules: ['mod1'],
        excludeFromModules: ['m1-06']
      },
      defaults: {
        proposalObjectives: 'Find where your team loses time and money through scattered chats, duplicate software, and manual rework — and leave with a prioritized 90-day fix list.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto'
      },
    },
    {
      id: 'leak-scan-briefing',
      name: 'Leak Scan + Briefing',
      tagline: 'Diagnosis plus a 60-minute leadership readout for the owner or GM.',
      forWhom: 'Family businesses where the payer and day-to-day operator are different people.',
      modules: ['mod1'],
      marketingVisible: false,
      sortOrder: 2,
      tasks: {
        mode: 'modules',
        modules: ['mod1']
      },
      defaults: {
        proposalObjectives: 'Quantify operational leakage, share findings with leadership in a dedicated briefing, and agree on the next phase together.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto'
      },
    },
    {
      id: 'fix-the-flow',
      name: 'Fix the Flow',
      tagline: 'Find the leaks, then write the playbooks everyone follows.',
      forWhom: '15–30 staff businesses with no standard operating rhythm.',
      modules: ['mod1', 'mod2'],
      marketingVisible: true,
      sortOrder: 3,
      tasks: {
        mode: 'modules',
        modules: ['mod1', 'mod2'],
        excludeFromModules: ['m1-06']
      },
      defaults: {
        proposalObjectives: 'Diagnose where time and money leak, then document how orders, purchases, and approvals run — so your team follows one path.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto'
      },
    },
    {
      id: 'run-on-rails',
      name: 'Run on Rails',
      tagline: 'You know the gaps — we document them and launch the workspace.',
      forWhom: 'Ops-mature teams that need execution, not another audit report.',
      modules: ['mod2', 'mod3'],
      marketingVisible: false,
      sortOrder: 4,
      tasks: {
        mode: 'modules',
        modules: ['mod2', 'mod3']
      },
      defaults: {
        proposalObjectives: 'Formalize how work runs, then launch your branded workspace with forms, training, and launch-week support.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto'
      },
    },
    {
      id: 'full-transformation',
      name: 'Full Transformation',
      tagline: 'From leak scan to live workspace — one phased engagement.',
      forWhom: 'Owners ready to invest once for scan, playbooks, and go-live.',
      modules: ['mod1', 'mod2', 'mod3'],
      marketingVisible: true,
      sortOrder: 5,
      tasks: {
        mode: 'modules',
        modules: ['mod1', 'mod2', 'mod3'],
        excludeFromModules: ['m1-06']
      },
      defaults: {
        proposalObjectives: 'End-to-end: diagnose leaks, document how your business runs, and launch a workspace your team is trained to use daily.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto'
      },
    },
    {
      id: 'launch-lite',
      name: 'Launch Lite',
      tagline: 'Minimum viable workspace — enough to run daily work, not every bell.',
      forWhom: 'Budget-conscious pilots or single-department rollouts.',
      modules: ['mod3'],
      marketingVisible: false,
      sortOrder: 6,
      tasks: {
        mode: 'include',
        include: ['m3-01', 'm3-01b', 'm3-02', 'm3-04']
      },
      taskOverrides: {
        'm3-02': {
          deliverable: 'Digital Approval Forms Pack (up to 3)',
          description: 'We build up to three digital request forms (max two approval steps each) with routing and a simple pending/approved view.',
          estHours: 12,
          scopeDetails: {
            activities: 'Build up to three digital forms; configure two-step approval; test with one live request each.',
            expectations: 'Provide copies of current paper forms; name approvers per request type.',
            output: 'Three live forms + approval routing + pending/approved view.'
          }
        }
      },
      defaults: {
        proposalObjectives: 'Launch a trimmed workspace with core setup, up to three approval forms, and hands-on training — prove value before expanding scope.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto'
      },
    },
    {
      id: 'care-plan',
      name: 'Care Plan',
      tagline: 'Hosting, manager check-ins, and health checks after go-live.',
      forWhom: 'Post-build clients who need continuity, not a new project.',
      modules: ['mod4'],
      marketingVisible: true,
      sortOrder: 7,
      tasks: {
        mode: 'include',
        include: ['m4-01', 'm4-02']
      },
      defaults: {
        proposalObjectives: 'Keep your workspace running with monthly hosting, user care, and bi-weekly operations check-ins with your managers.',
        frictionBuffer: 0,
        discountPercent: 0,
        milestoneSplit: 'auto',
        subscriptionMonths: 6
      },
      isMonthly: true
    },
    {
      id: 'care-plan-plus-audit',
      name: 'Care Plan + Health Check',
      tagline: 'Monthly care plus twice-yearly system health audits.',
      forWhom: 'Teams that want ongoing ops rhythm and periodic audits.',
      modules: ['mod4'],
      marketingVisible: false,
      sortOrder: 8,
      tasks: {
        mode: 'modules',
        modules: ['mod4']
      },
      defaults: {
        proposalObjectives: 'Monthly hosting and manager check-ins, plus semi-annual audits of usage, permissions, and outdated forms.',
        frictionBuffer: 0,
        discountPercent: 0,
        milestoneSplit: 'auto',
        subscriptionMonths: 6
      },
      isMonthly: true
    },
    {
      id: 'full-stack-care',
      name: 'Full Stack + Care',
      tagline: 'Build it, run it, and stay through year-one stability.',
      forWhom: 'Ambitious owners targeting multi-site or 25+ staff operations.',
      modules: ['mod1', 'mod2', 'mod3', 'mod4'],
      marketingVisible: false,
      sortOrder: 9,
      tasks: {
        mode: 'modules',
        modules: ['mod1', 'mod2', 'mod3', 'mod4'],
        excludeFromModules: ['m1-06']
      },
      defaults: {
        proposalObjectives: 'Full transformation from leak scan through workspace go-live, plus six months of hosting, check-ins, and adoption support.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto',
        subscriptionMonths: 6
      },
    }
  ];

  function getPackageById(id) {
    return PACKAGES.find((p) => p.id === id) || null;
  }

  function getMarketingPackages() {
    return PACKAGES.filter((p) => p.marketingVisible).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function getAllPackages() {
    return [...PACKAGES].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function suggestPackageFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    if (lower.includes('mod 1+2') || lower.includes('mod1+2') || lower.includes('fix the flow')) return 'fix-the-flow';
    if (lower.includes('full transform') || lower.includes('mod 1+2+3')) return 'full-transformation';
    if (lower.includes('care plan') || lower.includes('mod 4')) return 'care-plan';
    if (lower.includes('launch lite')) return 'launch-lite';
    if (lower.includes('run on rails') || lower.includes('mod 2+3')) return 'run-on-rails';
    if (lower.includes('leak scan') || lower.includes('mod 1')) return 'leak-scan';
    return null;
  }

  global.EngagementPackages = {
    PACKAGES,
    getPackageById,
    getMarketingPackages,
    getAllPackages,
    suggestPackageFromText
  };
})(window);
