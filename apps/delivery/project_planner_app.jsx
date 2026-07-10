    const { useState, useMemo, useEffect, useRef, useCallback, Component } = React;
    const H = window.PlannerHelpers;
    const EP = window.EngagementPackages;
    const PC = window.ProductCatalog;
    const PRODUCT = window.ProductConfig?.getProductConfig?.() || { branding: { name: 'Studio', accent: 'North' }, plannerTabs: ['nda', 'packages', 'sandbox', 'package', 'addendum', 'invoice'], plannerSubtitle: 'Quotes' };
    const AGENCY_MOD_FALLBACK = {
      mod1: { title: 'Discovery & Audit', shortTitle: 'Discovery', description: 'Map current workflows, tools, and bottlenecks before scoping the engagement.' },
      mod2: { title: 'Process Design', shortTitle: 'Process', description: 'Design streamlined playbooks, roles, and approval paths for your team.' },
      mod3: { title: 'Build & Implementation', shortTitle: 'Build', description: 'Configure deliverables, integrations, and workspace with hands-on setup.' },
      mod4: { title: 'Ongoing Support', shortTitle: 'Support', description: 'Hosting, check-ins, and continuous improvements after launch.' },
    };
    const isAgencyStarterContext = () => Boolean(
      PRODUCT.starterMode ||
      PRODUCT.id === 'agency-ops-starter' ||
      window.ProductConfig?.isStarterMode?.() ||
      new URLSearchParams(window.location.search).get('product') === 'agency-ops-starter'
    );
    const getAgencyModMeta = (n) => {
      const key = `mod${n}`;
      return window.ProductConfig?.AGENCY_MOD_LABELS?.[key] || AGENCY_MOD_FALLBACK[key];
    };
    const modTitle = (n) => {
      if (isAgencyStarterContext()) return getAgencyModMeta(n)?.title || `Module ${n}`;
      return window.ProductConfig?.getModTitle?.(n) || H?.getModDisplayName?.(n) || `Module ${n}`;
    };
    const modShortTitle = (n) => {
      if (isAgencyStarterContext()) return getAgencyModMeta(n)?.shortTitle || modTitle(n);
      return modTitle(n);
    };
    const modCategory = (n) => {
      if (isAgencyStarterContext()) return `MOD ${n} - ${modTitle(n)}`;
      return window.ProductConfig?.getModCategory?.(n) || H?.MOD_CATEGORIES?.[`mod${n}`] || `MOD ${n} - ${modTitle(n)}`;
    };
    const modChip = (n) => {
      if (isAgencyStarterContext()) return `MOD ${n} · ${modShortTitle(n)}`;
      return window.ProductConfig?.getModChipLabel?.(n) || `MOD ${n} · ${modTitle(n)}`;
    };
    const modPhase = (n) => {
      if (isAgencyStarterContext()) return `Phase ${n}: ${modTitle(n)}`;
      return window.ProductConfig?.getModPhase?.(n) || `Phase ${n}: ${modTitle(n)}`;
    };
    const modDesc = (n) => {
      if (isAgencyStarterContext()) return getAgencyModMeta(n)?.description || '';
      return window.ProductConfig?.getModDescription?.(n) || '';
    };
    const packageModuleLabel = (mod) => {
      if (String(mod).startsWith('pro')) {
        const p = PC?.getProductById?.(mod);
        return p?.skuLabel || String(mod).toUpperCase().replace('pro', 'PRO ');
      }
      return String(mod).replace('mod', 'MOD ');
    };
    const formatCategoryDisplay = (category) => {
      if (typeof category === 'string' && category.startsWith('PRO ')) {
        return PC?.getProductByCategory?.(category)?.skuLabel || category.replace(' - ', ' · ');
      }
      if (window.ProductConfig?.formatModCategoryDisplay) {
        return window.ProductConfig.formatModCategoryDisplay(category, isAgencyStarterContext());
      }
      if (isAgencyStarterContext()) {
        const match = String(category || '').match(/^MOD (\d)/);
        if (match) return modChip(Number(match[1]));
      }
      return (category || '').replace('MOD ', 'M').replace(' - ', ' · ');
    };
    const taskModNum = (task) => {
      if (H?.isProTask?.(task)) return null;
      if (H?.getTaskModNum) {
        const n = H.getTaskModNum(task);
        if (n != null) return n;
      }
      const cat = task?.category;
      if (cat && typeof cat === 'string') {
        const m = cat.match(/^MOD (\d)/);
        if (m) return Number(m[1]);
      }
      const key = task?.moduleKey || 'mod1';
      return Number(String(key).replace('mod', '')) || 1;
    };
    const getModPresets = (bundleNames) => [
      { name: 'mod1', label: bundleNames?.mod1 || modChip(1) },
      { name: 'mod2', label: bundleNames?.mod2 || modChip(2) },
      { name: 'mod3', label: bundleNames?.mod3 || modChip(3) },
      { name: 'mod4', label: bundleNames?.mod4 || modChip(4) },
    ];
    const STARTER_UI = isAgencyStarterContext();
    const MOD_1 = H?.MOD_CATEGORIES?.mod1 ?? 'MOD 1 - Business Leak Scan';
    const MOD_2 = H?.MOD_CATEGORIES?.mod2 ?? 'MOD 2 - How Your Business Runs';
    const MOD_3 = H?.MOD_CATEGORIES?.mod3 ?? 'MOD 3 - Your Team Workspace';
    const MOD_4 = H?.MOD_CATEGORIES?.mod4 ?? 'MOD 4 - Care Plan';
    const PRO_1 = PC?.getProductById?.('pro1')?.category ?? 'PRO 1 - Agency Ops Platform';
    const defaultMod1Selected = (task) => task.id.startsWith('m1-') && task.id !== 'm1-06';
    if (STARTER_UI && PRODUCT.moduleLabels?.quotes) {
      document.title = `${PRODUCT.moduleLabels.quotes} | Cloud Synced`;
    }
    const defaultBrand = () => window.TenantBranding?.getEffectiveBranding?.() || (() => {
      const isAgencyOps = PRODUCT.id === 'agency-ops-starter' || PRODUCT.starterMode;
      const companyName = [PRODUCT.branding?.name, PRODUCT.branding?.accent].filter(Boolean).join(' ').trim()
        || (isAgencyOps ? 'Studio North' : 'Kolthoff Consulting');
      return {
        companyName,
        tagline: PRODUCT.plannerSubtitle || 'Quotes',
        primaryColor: isAgencyOps ? '#4f46e5' : '#14B8A6',
        logoUrl: '',
        plannerSubtitle: PRODUCT.plannerSubtitle,
      };
    })();
    const PLANNER_TABS = PRODUCT.plannerTabs || ['nda', 'packages', 'sandbox', 'package', 'addendum', 'invoice'];
    const TAB_LABELS = window.ProductConfig?.getPlannerTabLabels?.() || { nda: 'NDA', packages: 'Packages', sandbox: 'Planner', package: 'Documents', addendum: 'Addendum', invoice: 'Invoice' };
    class ErrorBoundary extends Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }
      static getDerivedStateFromError(error) {
        return { error };
      }
      render() {
        if (this.state.error) {
          return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-brandNavy-955">
              <div className="max-w-lg w-full bg-brandNavy-900 border border-brandNavy-700 rounded-xl p-8">
                <h1 className="text-xl font-bold text-red-400 mb-3">Project Planner Error</h1>
                <p className="text-slate-300 text-sm mb-4">{this.state.error.message}</p>
                <button type="button" onClick={() => window.location.reload()} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 rounded font-bold text-sm">
                  Reload
                </button>
              </div>
            </div>
          );
        }
        return this.props.children;
      }
    }

    // --- PHILIPPINE TIN FORMAT VALIDATOR & GENERATOR ---
    function validatePhilippineTIN(tinString) {
      const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3,5}$/;
      return tinRegex.test(tinString);
    }

    // Standard Philippine TIN Formatter
    function formatTINInput(value) {
      const numbers = value.replace(/\D/g, '');
      let formatted = '';
      for (let i = 0; i < numbers.length; i++) {
        if (i === 3 || i === 6 || i === 9) formatted += '-';
        formatted += numbers[i];
      }
      return formatted.substring(0, 17);
    }

    function formatCurrency(val) {
      return new Intl.NumberFormat('en-PH', { 
        style: 'currency', 
        currency: 'PHP', 
        maximumFractionDigits: 0 
      }).format(val);
    }

    function getTodayDateString() {
      return new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      });
    }

    function autoResizeField(el, maxPx = 96) {
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, maxPx)}px`;
    }

    const TIER_LABELS = {
      associate: 'Specialist',
      senior: 'Architect',
      principal: 'Strategist',
      partner: 'IT Partner'
    };

    function getShortDeliverableName(name) {
      const label = name == null ? '' : String(name);
      const mappings = {
        'Simple Privacy & Directory': 'Team List & Privacy Rules',
        'Anonymous Suggestion Box': 'Staff Feedback Channel',
        'Work Shadowing Review': 'Daily Work Friction Study',
        'Software Bill Savings Audit': 'Duplicate Software Spend Review',
        'Chaos Tax Money-Leak Map': 'Leak Scan Report',
        'Sales & Buying Blueprints': 'Order & Purchase Playbooks',
        'Role Accountability Matrix': 'Roles & Sign-Off Chart',
        'SOP Video & Document Vault': 'How-To Video Library',
        'Employee Policy Handbook': 'Employee Rules Handbook',
        'Secure Shared Drive': 'Workspace Go-Live',
        'Task Status & Tracker Boards': 'Digital Approval Forms',
        'Tax-Smart Sales App': 'Sales & Order Log',
        'Practical Staff Training': 'Hands-On Team Training',
        'Weekly Strategy Syncs': 'Operations Check-In Calls',
        '6-Month Workspace Audits': 'System Health Check',
        'Ongoing Digital Support Care': 'Platform Hosting & User Care',
        'Staff Feedback Link: Safe Anonymous Suggestion Box': 'Staff Feedback Channel',
        'Targeted Process Mapping Audit': 'Daily Work Friction Study',
        'Subscription Audit: App Consolidation Strategy': 'Duplicate Software Spend Review',
        'Visual Chaos Tax Map & ROI Solution Plan': 'Leak Scan Report',
        'Standardized Customer Order & Buying Flowcharts': 'Order & Purchase Playbooks',
        'Clear Who-Does-What Matrix & System Org-Chart': 'Roles & Sign-Off Chart',
        'Pre-Loaded Employee Policies (DOLE-Shielded)': 'Employee Rules Handbook',
        'Core Workspace Deployment & Org-Mapping': 'Workspace Go-Live',
        'Digital Approval Workflows & Form Conversion': 'Digital Approval Forms',
        'System Onboarding & Staff Training': 'Hands-On Team Training',
        'Weekly Operations & Adoption Huddles': 'Operations Check-In Calls',
        'Managed App Hosting & IT Administration': 'Platform Hosting & User Care'
      };
      if (mappings[label]) return mappings[label];
      if (!label) return 'Untitled deliverable';
      return label.length > 32 ? label.substring(0, 32) + '...' : label;
    }

    // --- DATA CONSTANTS ---
    const INITIAL_TASKS = [
      {
        id: 'm1-01', category: MOD_1,
        deliverable: 'Team List & Privacy Ground Rules',
        description: 'We build a template-based staff directory with roles and one-page privacy ground rules for customer and employee data — not legal advice.',
        estHours: 2, tier: 'associate', selected: true,
        scopeDetails: { activities: 'Populate a staff directory template and draft one-page privacy ground rules.', expectations: 'Share staff names, roles, and how you store customer info today.', output: 'A ready-to-use staff directory with clear privacy rules.' }
      },
      {
        id: 'm1-02', category: MOD_1,
        deliverable: 'Anonymous Staff Feedback Channel',
        description: 'We provide a ready-to-use anonymous feedback form template and launch guide — your team circulates it internally.',
        estHours: 1, tier: 'associate', selected: true,
        scopeDetails: { activities: 'Deploy a standard anonymous feedback form template and handoff guide.', expectations: 'Circulate the form internally; share themes only (no names).', output: 'A live feedback channel and a prioritized problem list for leadership review.' }
      },
      {
        id: 'm1-03', category: MOD_1,
        deliverable: 'Daily Work Friction Study',
        description: 'We review 2 real workflows from your forms, chats, or sheets and chart what slows people down — async only, no long workshops.',
        estHours: 5, tier: 'senior', selected: true,
        scopeDetails: { activities: 'Review two manual workflows asynchronously and map friction points.', expectations: 'Provide sample forms, chat threads, or step lists your team uses.', output: 'A single friction chart of your biggest time-wasters.' }
      },
      {
        id: 'm1-04', category: MOD_1,
        deliverable: 'Duplicate Software Spend Review',
        description: 'We review your top app subscriptions (up to 10) and flag overlapping spend with estimated monthly savings.',
        estHours: 2, tier: 'associate', selected: true,
        scopeDetails: { activities: 'Compare up to ten subscriptions and flag overlapping features.', expectations: 'Provide a list of apps and monthly costs.', output: 'A savings report showing duplicate tools you can cut.' }
      },
      {
        id: 'm1-05', category: MOD_1,
        deliverable: 'Leak Scan Report & 90-Day Recovery Plan',
        description: 'We quantify delays and rework as annual leakage and deliver a written Leak Scan Report, short Loom walkthrough, and top-5 90-Day Recovery Plan.',
        estHours: 3, tier: 'senior', selected: true,
        scopeDetails: { activities: 'Calculate operational leakage; record a short Loom walkthrough.', expectations: 'Review the numbers with your leadership team.', output: 'A Leak Scan Report and top-5 90-Day Recovery Plan.' }
      },
      {
        id: 'm1-06', category: MOD_1,
        deliverable: 'Optional — Owner Findings Briefing',
        description: 'Optional 60-minute presentation of diagnosis findings to the owner or general manager.',
        estHours: 2, tier: 'principal', selected: false,
        scopeDetails: { activities: 'Present the Leak Scan Report and answer questions.', expectations: 'Owner or GM attends the briefing.', output: 'Shared understanding of findings and next steps.' }
      },
      {
        id: 'm2-01', category: MOD_2,
        deliverable: 'Customer Order Playbook',
        description: 'We map how inquiries become orders, deliveries, and invoices — so everyone follows the same path.',
        estHours: 6, tier: 'senior', selected: false,
        scopeDetails: { activities: 'Map inquiry → order → delivery → invoice on one flowchart.', expectations: 'Provide sample order slips or invoices.', output: 'An easy-to-read customer order playbook.' }
      },
      {
        id: 'm2-02', category: MOD_2,
        deliverable: 'Purchase & Payment Playbook',
        description: 'We map how purchase requests are approved and paid — so buying stays controlled and traceable.',
        estHours: 6, tier: 'senior', selected: false,
        scopeDetails: { activities: 'Map request → approve → pay supplier steps.', expectations: 'Provide sample purchase records or payment forms.', output: 'An easy-to-read purchase and payment playbook.' }
      },
      {
        id: 'm2-03', category: MOD_2,
        deliverable: 'Roles & Sign-Off Chart',
        description: 'We document who owns each task and who signs off, with a simple org chart — so approvals reach the right person.',
        estHours: 6, tier: 'senior', selected: false,
        scopeDetails: { activities: 'Document task ownership and draw a simple org chart.', expectations: 'Confirm who reports to whom.', output: 'A who-does-what chart everyone can reference.' }
      },
      {
        id: 'm2-04', category: MOD_2,
        deliverable: 'Up to 3 How-To Videos & File Library',
        description: 'We record up to three short screen-recorded how-tos and store step-by-step guides in one shared folder. Extra videos quoted separately.',
        estHours: 6, tier: 'associate', selected: false,
        scopeDetails: { activities: 'Record plain-language walkthroughs and upload guides to a shared folder.', expectations: 'Nominate team members to demo key tasks on camera.', output: 'A video and document library for daily reference. Extra videos quoted separately.' }
      },
      {
        id: 'm2-05', category: MOD_2,
        deliverable: 'Employee Rules Handbook',
        description: 'We adapt Philippines-ready handbook templates and load them into your workspace — client legal review required before use.',
        estHours: 8, tier: 'associate', selected: false,
        scopeDetails: { activities: 'Adapt handbook templates to your company and upload them digitally.', expectations: 'Review and approve the draft handbook.', output: 'A complete digital employee rules handbook.' }
      },
      {
        id: 'm3-01', category: MOD_3,
        deliverable: 'Workspace Setup & Branding',
        description: 'We provision your branded workspace tenant, map departments and managers, and apply your company look and feel.',
        estHours: 6, tier: 'senior', selected: false,
        scopeDetails: { activities: 'Set up tenant, branding, departments, and manager mapping.', expectations: 'Provide your org structure and brand assets.', output: 'A branded workspace shell ready for staff.' }
      },
      {
        id: 'm3-01b', category: MOD_3,
        deliverable: 'Staff Logins & Core Folders',
        description: 'We create staff logins and organize core shared folders — so your team can log in on day one.',
        estHours: 4, tier: 'associate', selected: false,
        scopeDetails: { activities: 'Create user accounts and lay out core folder structure.', expectations: 'Provide your final staff list.', output: 'Live logins and a folder layout your team can use.' }
      },
      {
        id: 'm3-02', category: MOD_3,
        deliverable: 'Digital Approval Forms Pack (up to 5)',
        description: 'We build up to five digital request forms (max two approval steps each) with routing and a simple pending/approved view.',
        estHours: 18, tier: 'associate', selected: false,
        scopeDetails: { activities: 'Build up to five digital forms; configure max two approval steps each; test with one live request per form.', expectations: 'Provide copies of current paper forms; name approvers per request type.', output: 'Five live forms + approval routing + pending/approved view.' }
      },
      {
        id: 'm3-03', category: MOD_3,
        deliverable: 'Sales & Order Log',
        description: 'We set up a daily sales and order log you can export for bookkeeping — not a full accounting or ERP system.',
        estHours: 12, tier: 'associate', selected: false,
        scopeDetails: { activities: 'Configure a sales log tied to your order and invoice flow.', expectations: 'Share how you record sales today.', output: 'A sales tracker your team can update daily.' }
      },
      {
        id: 'm3-04', category: MOD_3,
        deliverable: 'Hands-On Team Training',
        description: 'We run two live sessions (90 minutes each max) and leave cheat sheets for messaging, approvals, and your policy library.',
        estHours: 6, tier: 'senior', selected: false,
        scopeDetails: { activities: 'Run two live training sessions and publish short how-to guides.', expectations: 'Ensure key staff attend both sessions.', output: 'Trained staff and a help folder they can revisit.' }
      },
      {
        id: 'm3-05', category: MOD_3,
        deliverable: 'Two-Week Launch Help Desk',
        description: 'For two weeks after go-live we answer chat/email “how do I…?” questions during business hours — so adoption doesn’t stall.',
        estHours: 4, tier: 'associate', selected: false,
        scopeDetails: { activities: 'Provide launch support via agreed chat/email channel, business hours, for two weeks.', expectations: 'Designate one point person; escalate blockers within 1 business day.', output: 'Faster first two weeks; FAQ notes added to help folder.' }
      },
      {
        id: 'm4-01', category: MOD_4,
        deliverable: 'Platform Hosting & User Care',
        description: 'Monthly: we maintain hosting, user logins, and minor layout tweaks. New forms or workflows are quoted separately.',
        estHours: 4, tier: 'partner', selected: false, isMonthlyRetainer: true,
        scopeDetails: { activities: 'Maintain hosting, credentials, and routine admin (users, permissions, minor layout).', expectations: 'Submit requests through support channel; 48-hour response target.', output: 'Reliable uptime and responsive admin help.' }
      },
      {
        id: 'm4-02', category: MOD_4,
        deliverable: 'Operations Check-In Calls',
        description: 'Monthly: bi-weekly 60-minute calls with your managers to review pending items, unblock tasks, and keep adoption on track.',
        estHours: 4, tier: 'senior', selected: false, isMonthlyRetainer: true,
        scopeDetails: { activities: 'Review dashboards, pending approvals, and team questions.', expectations: 'Key managers join each scheduled call.', output: 'A short action list and steady day-to-day usage.' }
      },
      {
        id: 'm4-03', category: MOD_4,
        deliverable: 'System Health Check',
        description: 'Twice per year: we audit usage, permissions, and outdated forms, then apply or schedule fixes from the findings.',
        estHours: 6, tier: 'senior', selected: false,
        scopeDetails: { activities: 'Half-day audit of usage, permissions, broken/outdated forms; schedule or apply fixes.', expectations: 'Manager access for review session; twice per year on calendar.', output: 'Audit report + fixes applied or scheduled.' }
      },
      {
        id: 'pro1-01', category: PRO_1,
        deliverable: 'Platform Setup & White-Label Configuration',
        description: 'We provision your branded Agency Ops tenant — logo, colors, CRM pipeline, quote templates, and collections flow.',
        estHours: 16, tier: 'senior', selected: false,
        scopeDetails: {
          activities: 'Create tenant workspace, apply agency branding, configure CRM stages, and wire quote-to-invoice defaults.',
          expectations: 'Provide logo assets, brand colors, and sample quote/invoice copy for white-label setup.',
          output: 'Live Agency Ops tenant with your branding and starter CRM/quote templates.'
        }
      },
      {
        id: 'pro1-02', category: PRO_1,
        deliverable: 'Agency Team Onboarding & Training',
        description: 'Two live sessions (90 minutes each) covering CRM, quotes, invoicing, and your branded client-facing documents.',
        estHours: 4, tier: 'senior', selected: false,
        scopeDetails: {
          activities: 'Run two onboarding sessions and publish quick-start guides for sales and finance workflows.',
          expectations: 'Ensure sales and ops leads attend both sessions.',
          output: 'Trained team and a help folder they can revisit for daily Agency Ops tasks.'
        }
      },
      {
        id: 'pro1-03', category: PRO_1,
        deliverable: 'Agency Ops Platform Subscription',
        description: 'Monthly access to your white-label quote-to-cash workspace — hosting, updates, and standard user support.',
        estHours: 4, tier: 'partner', selected: false, isMonthlyRetainer: true,
        scopeDetails: {
          activities: 'Maintain platform hosting, tenant updates, and standard support during business hours.',
          expectations: 'Submit support requests through the agreed channel; designate one admin contact.',
          output: 'Continuous access to your branded Agency Ops platform.'
        }
      }
    ];

    const AGENCY_DEMO_TASKS = [
      {
        id: 'line-deluxe-bay',
        moduleKey: 'mod1',
        category: 'MOD 1 - Discovery & Audit',
        deliverable: 'Deluxe Bay',
        description: 'Full-service production bay with equipment package.',
        selected: true,
        lineQty: 6,
        lineDuration: 4,
        lineUnitPrice: 1800,
        lineUnit: 'per hour',
        lineMarkUp: 33.33333333333333,
        estHours: 24,
        tier: 'senior',
      },
      {
        id: 'line-premium-bay',
        moduleKey: 'mod1',
        category: 'MOD 1 - Discovery & Audit',
        deliverable: 'Premium Bay',
        description: 'Premium bay — single-day booking.',
        selected: true,
        lineQty: 1,
        lineDuration: 1,
        lineUnitPrice: 3000,
        lineUnit: 'per day',
        lineMarkUp: 50,
        estHours: 8,
        tier: 'senior',
      },
      {
        id: 'line-brand-kit',
        moduleKey: 'mod2',
        category: 'MOD 2 - Process Design',
        deliverable: 'Brand Identity Kit',
        description: 'Logo suite, color system, and typography guidelines.',
        selected: false,
        lineQty: 1,
        lineDuration: 1,
        lineUnitPrice: 85000,
        lineUnit: 'per project',
        lineMarkUp: 25,
        estHours: 40,
        tier: 'senior',
      },
      {
        id: 'line-web-build',
        moduleKey: 'mod3',
        category: 'MOD 3 - Build & Implementation',
        deliverable: 'Marketing Website',
        description: 'Responsive site build with CMS handoff.',
        selected: false,
        lineQty: 1,
        lineDuration: 1,
        lineUnitPrice: 120000,
        lineUnit: 'per project',
        lineMarkUp: 30,
        estHours: 80,
        tier: 'associate',
      },
    ];

    const PRODUCT_TASK_CATALOG = STARTER_UI ? AGENCY_DEMO_TASKS : INITIAL_TASKS;

    const defaultAgencyModuleBundleNames = () => ({
      mod1: modTitle(1),
      mod2: modTitle(2),
      mod3: modTitle(3),
      mod4: modTitle(4),
    });

    const defaultAgencySlaContent = () => H.defaultAgencySlaTemplate?.() || '';

    // --- DEFAULT PROFILES DATA ---
    const DEFAULT_CLIENTS = [
      {
        id: 'aparri-trading',
        clientCompany: 'Aparri Trading Corp.',
        clientRep: 'Engr. Manuel Santos',
        clientAddress: 'Aparri Port Compound, Cagayan Valley, Philippines',
        clientTin: '204-512-309-000',
        quoteId: 'KC-2026-APARRI',
        quoteDate: getTodayDateString(),
        quoteValidity: '30 Days',
        staffCount: 16,
        monthlySalary: 25000,
        wastedHours: 2.0,
        annualOperationalLeakage: 1200000,
        includeTax: false,
        preparerTitle: 'Chief Operations Strategist',
        preparerTin: '337-945-806-000',
        targetStartDate: 'July 6, 2026',
        proposalObjectives: 'Organize your growing team, eliminate unorganized Viber chats and scattered spreadsheets, set up easy-to-follow staff guidelines, and launch secure, automated tracking boards so your business runs smoothly even when you are not looking.',
        proposalSponsor: 'Engr. Manuel Santos (General Manager)',
        preDiagnosticList: "• Basic list of your active staff and what each person handles\n• Samples of current invoices, spreadsheets, or instructions you share\n• Existing office guidelines, leaves rules, or staff contracts\n• A simple list of apps or software tools you currently pay for\n• Typical daily task lists or order sheets your team uses",
        frictionBuffer: 10,
        principalToSeniorDelegate: 20,
        seniorToAssociateDelegate: 40,
        overrideTimeline: '',
        weeklyHours: 16,
        clientReviewWeeks: 1, 
        discountPercent: 5,
        subscriptionMonths: 6,
        printSow: true,
        printTimeline: true,
        printQuote: true,
        milestoneSplit: 'auto', 
        customSplit1: 40, customSplit2: 40, customSplit3: 20, 
        ndaEffectiveDate: 'June 22, 2026',
        ndaPurpose: 'Reviewing active team duties, software subscriptions, general business logistics rules, and mapping out areas where your Cagayan warehouse is losing time, in strict compliance with the local Philippine Data Privacy Act (RA 10173).',
        ndaTerm: '5 (Five) Years',
        ndaJurisdiction: 'Taytay, Rizal, Philippines',
        invoiceMilestone: 'full',
        customInvoiceAmount: 120000,
        invoiceNumberSuffix: '01',
        invoiceDueDate: 'July 15, 2026',
        ...H.DEFAULT_RATES,
        selectedPackageId: 'leak-scan',
        packageCustomized: false,
        packageAppliedAt: Date.now(),
        tasks: INITIAL_TASKS.map(t => ({ ...t, selected: defaultMod1Selected(t) }))
      },
      {
        id: 'delacruz-ent',
        clientCompany: 'Dela Cruz Enterprises',
        clientRep: 'Juan Dela Cruz',
        clientAddress: '128 Ortigas Avenue, Pasig City, Metro Manila',
        clientTin: '102-455-891-001',
        quoteId: 'KC-2026-DELACRUZ',
        quoteDate: getTodayDateString(),
        quoteValidity: '15 Days',
        staffCount: 20,
        monthlySalary: 30000,
        wastedHours: 2.0,
        annualOperationalLeakage: 1800000,
        includeTax: true,
        preparerTitle: 'Chief Operations Strategist',
        preparerTin: '337-945-806-000',
        targetStartDate: 'August 1, 2026',
        proposalObjectives: 'Establish high-security internal staff directories, formalize standard roles & responsibilities to eliminate overlapping daily duties, and deploy secure local employee playbooks to shield the business from regulatory and labor disputes.',
        proposalSponsor: 'Juan Dela Cruz (Managing Director)',
        preDiagnosticList: "• Existing employee records or active local labor contracts\n• Current payroll spreadsheet templates or leave logs\n• Typical daily task sheets and B2B pricing guidelines",
        frictionBuffer: 15,
        principalToSeniorDelegate: 10,
        seniorToAssociateDelegate: 50,
        overrideTimeline: '4 - 5 Weeks',
        weeklyHours: 20,
        clientReviewWeeks: 2,
        discountPercent: 10,
        subscriptionMonths: 6,
        printSow: true,
        printTimeline: true,
        printQuote: true,
        milestoneSplit: '30-40-30',
        customSplit1: 30, customSplit2: 40, customSplit3: 30,
        ndaEffectiveDate: 'June 25, 2026',
        ndaPurpose: 'Auditing active team directories, standardizing role accountability scopes, reviewing local HR handbook guidelines, and configuring secure documentation files.',
        ndaTerm: '3 (Three) Years',
        ndaJurisdiction: 'Pasig City, Metro Manila, Philippines',
        invoiceMilestone: 'milestone_0',
        customInvoiceAmount: 85000,
        invoiceNumberSuffix: '02',
        invoiceDueDate: 'August 10, 2026',
        ...H.DEFAULT_RATES,
        selectedPackageId: 'fix-the-flow',
        packageCustomized: false,
        packageAppliedAt: Date.now(),
        tasks: INITIAL_TASKS.map(t => ({ ...t, selected: defaultMod1Selected(t) || t.id.startsWith('m2-') }))
      }
    ];

    const EMPTY_AGENCY_WORKSPACE_STUB = {
      id: '',
      workspaceName: '',
      clientCompany: '',
      clientRep: '',
      clientAddress: '',
      clientTin: '',
      quoteId: '',
      quoteDate: getTodayDateString(),
      quoteValidity: '30 Days',
      staffCount: 0,
      monthlySalary: 0,
      wastedHours: 0,
      includeTax: false,
      preparerTitle: '',
      targetStartDate: '',
      proposalObjectives: '',
      proposalSponsor: '',
      preDiagnosticList: '',
      frictionBuffer: 10,
      principalToSeniorDelegate: 20,
      seniorToAssociateDelegate: 40,
      overrideTimeline: '',
      weeklyHours: 16,
      clientReviewWeeks: 1,
      discountPercent: 0,
      subscriptionMonths: 6,
      printSow: true,
      printTimeline: true,
      printSla: true,
      printQuote: true,
      printCover: false,
      milestoneSplit: 'auto',
      customSplit1: 40,
      customSplit2: 40,
      customSplit3: 20,
      ndaEffectiveDate: getTodayDateString(),
      ndaPurpose: '',
      ndaTerm: '5 (Five) Years',
      ndaJurisdiction: '',
      invoiceMilestone: 'full',
      customInvoiceAmount: 0,
      invoiceNumberSuffix: '01',
      invoiceDueDate: '',
      tasks: [],
      selectedPackageId: 'custom',
      packageCustomized: true,
      packageAppliedAt: null,
      engagementType: 'service',
      productId: null,
      slaContent: '',
      ...H.DEFAULT_RATES,
    };

    const buildNewAgencyWorkspace = (newId) => ({
      id: newId,
      workspaceName: 'New Quote',
      clientCompany: '',
      clientRep: '',
      clientAddress: '',
      clientTin: '',
      quoteId: `Q-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      quoteDate: getTodayDateString(),
      quoteValidity: '30 Days',
      staffCount: 0,
      monthlySalary: 0,
      wastedHours: 0,
      annualOperationalLeakage: 0,
      includeTax: false,
      preparerTitle: '',
      preparerTin: '',
      targetStartDate: '',
      proposalObjectives: '',
      proposalSponsor: '',
      preDiagnosticList: '',
      frictionBuffer: 10,
      principalToSeniorDelegate: 20,
      seniorToAssociateDelegate: 40,
      overrideTimeline: '',
      weeklyHours: 16,
      clientReviewWeeks: 1,
      discountPercent: 0,
      dpaRetentionDays: 14,
      slaCureDays: 30,
      slaRecurrenceMonths: 3,
      subscriptionMonths: 6,
      slaContent: defaultAgencySlaContent(),
      printSow: true,
      printTimeline: true,
      printSla: true,
      printQuote: true,
      printCover: false,
      milestoneSplit: 'auto',
      customSplit1: 40,
      customSplit2: 40,
      customSplit3: 20,
      ndaEffectiveDate: getTodayDateString(),
      ndaPurpose: '',
      ndaTerm: '5 (Five) Years',
      ndaJurisdiction: '',
      invoiceMilestone: 'full',
      customInvoiceAmount: 0,
      invoiceNumberSuffix: '01',
      invoiceDueDate: '',
      tasks: [],
      selectedPackageId: 'custom',
      packageCustomized: true,
      packageAppliedAt: Date.now(),
      engagementType: 'service',
      productId: null,
      ...H.DEFAULT_RATES,
      updatedAt: Date.now(),
    });

    // --- UI ICONS ---
    const IconCheckSquare = () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-brandTeal-500"><path d="m9 11 3 3 7-7"/><rect width="18" height="18" x="3" y="3" rx="2"/></svg>;
    const IconSquare = () => <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>;
    const IconCalculator = () => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>;
    const IconClock = () => <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    const IconTrash = ({ className }) => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>;
    const IconGripVertical = ({ className = "w-4 h-4" }) => (
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
      </svg>
    );
    const IconPlus = () => <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
    
    // Checkbox SVG to define IconCheckCircle and prevent SLA ReferenceErrors
    const IconCheckCircle = () => (
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 text-brandTeal-500 shrink-0">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );

    const IconEmptyCircle = () => (
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5 text-slate-300 shrink-0">
        <circle cx="12" cy="12" r="10" fill="transparent" stroke="currentColor" strokeWidth="2" />
      </svg>
    );

    // --- BRAND SHIELD GRADIENT (hdr-shield-grad) AS THE SELECTION INDICATOR ---
    const ShieldIndicator = ({ active, className = "mr-1.5 shrink-0" }) => (
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
        <path
          d="M50 12 C72 16 84 22 84 22 V54 C84 72 70 85 50 90 C30 85 16 72 16 54 V22 C16 22 28 16 50 12 Z"
          fill={active ? "url(#hdr-shield-grad)" : "none"}
          fillOpacity={active ? "0.15" : "0"}
          stroke={active ? "url(#hdr-shield-grad)" : "#94a3b8"}
          strokeWidth="10"
          strokeLinejoin="round"
        />
        {active && (
          <path
            d="M36 50 L46 60 L66 36"
            stroke="url(#hdr-check-grad)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </svg>
    );

    const CheckboxIndicator = ({ checked, className = "shrink-0" }) => (
      checked ? (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`text-brandTeal-500 ${className}`}>
          <path d="m9 11 3 3 7-7" /><rect width="18" height="18" x="3" y="3" rx="2" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-slate-500 ${className}`}>
          <rect width="18" height="18" x="3" y="3" rx="2" />
        </svg>
      )
    );

    const IconPrint = ({ className }) => <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>;
    const IconEdit = () => <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
    const IconMail = ({ className = "w-4 h-4" }) => <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>;
    const IconGlobe = ({ className = "w-4 h-4" }) => <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>;
    const IconCheck = ({ className = "w-4 h-4" }) => <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" className={className}><polyline points="20 6 9 17 4 12" /></svg>;
    const IconCalendar = ({ className = "w-4 h-4" }) => <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>;
    const IconAlertTriangle = ({ className = "w-4 h-4" }) => <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>;

    const BrandLogo = ({ className = "w-14 h-14 shrink-0 text-brandTeal-500" } = {}) => (
      <svg aria-hidden="true" className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 12 C72 16 84 22 84 22 V54 C84 72 70 85 50 90 C30 85 16 72 16 54 V22 C16 22 28 16 50 12 Z" fill="#14B8A6" fillOpacity="0.08" stroke="url(#hdr-shield-grad)" strokeWidth="4.5" strokeLinejoin="round" />
        <path d="M36 50 L46 60 L66 36" stroke="url(#hdr-check-grad)" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

    const renderPlannerHeaderLogo = (brand) => {
      if (!STARTER_UI) return <BrandLogo className="w-8 h-8 text-brandTeal-400" />;
      if (brand.logoUrl) {
        return <img src={brand.logoUrl} alt="" className="h-8 w-auto max-w-[100px] object-contain" />;
      }
      return (
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ backgroundColor: brand.primaryColor }}>
          {(brand.companyName || 'A').charAt(0)}
        </div>
      );
    };

    const renderPlannerHeaderTitle = (brand) => {
      if (!STARTER_UI) {
        return (
          <>
            {PRODUCT.branding?.name}
            {PRODUCT.branding?.accent ? <> <span className="text-brandTeal-500">{PRODUCT.branding.accent}</span></> : null}
          </>
        );
      }
      const d = window.TenantBranding?.splitDisplay?.(brand.companyName) || { line1: brand.companyName, line2: '' };
      return <>{d.line1}{d.line2 ? <> <span style={{ color: brand.primaryColor }}>{d.line2}</span></> : null}</>;
    };

    const renderPrintBrandLogo = (brand, sizeClass = 'h-14 w-auto max-w-[160px]') => {
      if (!STARTER_UI) return <BrandLogo className="w-14 h-14 shrink-0 text-brandTeal-500" />;
      if (brand.logoUrl) {
        return <img src={brand.logoUrl} alt="" className={`${sizeClass} object-contain shrink-0`} />;
      }
      return (
        <div
          className="w-14 h-14 shrink-0 rounded-lg flex items-center justify-center text-white font-bold text-xl bg-slate-700"
          aria-hidden="true"
        >
          {(brand.companyName || 'A').charAt(0)}
        </div>
      );
    };

    const renderConsultantBadge = (tier) => {
      const labelMap = { principal: 'Strategist', senior: 'Architect', associate: 'Specialist', partner: 'IT Partner' };
      const styleMap = {
        principal: 'bg-purple-100 text-purple-700 border-purple-200',
        senior: 'bg-brandTeal-100 text-brandTeal-700 border-brandTeal-200',
        associate: 'bg-slate-100 text-slate-600 border-slate-200',
        partner: 'bg-indigo-100 text-indigo-700 border-indigo-200'
      };
      return (
        <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${styleMap[tier] || styleMap.associate}`}>
          {labelMap[tier] || 'Specialist'}
        </span>
      );
    };

    function App() {
      if (!H) {
        return (
          <div className="min-h-screen flex items-center justify-center p-6 text-slate-300">
            <p>Planner helpers failed to load. Hard refresh or check project_planner_helpers.js.</p>
          </div>
        );
      }
      // --- FIREBASE & APP STATES ---
      const [isAuthed, setIsAuthed] = useState(false);
      const [authErrorDetails, setAuthErrorDetails] = useState(null);
      const [crmDeals, setCrmDeals] = useState([]);
      const [isSaving, setIsSaving] = useState(false);
      const [view, setView] = useState('sandbox');

      useEffect(() => {
        if (STARTER_UI && view === 'packages') setView('sandbox');
      }, [view]);
      const [brand, setBrand] = useState(defaultBrand);

      useEffect(() => {
        if (!window.TenantBranding?.subscribe) return undefined;
        return window.TenantBranding.subscribe(setBrand);
      }, []);

      const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
      const [showRenameWorkspace, setShowRenameWorkspace] = useState(false);
      const [renameWorkspaceValue, setRenameWorkspaceValue] = useState('');
      const [saveStatus, setSaveStatus] = useState('saved');
      const [saveError, setSaveError] = useState(null);
      const [lastSavedFingerprint, setLastSavedFingerprint] = useState('');
      const [showUnsavedSwitchConfirm, setShowUnsavedSwitchConfirm] = useState(false);
      const [pendingProfileId, setPendingProfileId] = useState(null);
      const [showPrintValidation, setShowPrintValidation] = useState(false);
      const [printValidationIssues, setPrintValidationIssues] = useState([]);
      const [printValidationWarnings, setPrintValidationWarnings] = useState([]);
      const [isIssuingInvoice, setIsIssuingInvoice] = useState(false);
      const [issueInvoiceToast, setIssueInvoiceToast] = useState(null);
      const [workspaceSearch, setWorkspaceSearch] = useState('');
      const [workspaceSort, setWorkspaceSort] = useState('modified');
      const [showCrmImportModal, setShowCrmImportModal] = useState(false);
      const [pendingCrmDeal, setPendingCrmDeal] = useState(null);
      const [localDraftBanner, setLocalDraftBanner] = useState(null);
      const autoSaveTimerRef = useRef(null);
      const isHydratingRef = useRef(true);
      const isDirtyRef = useRef(false);
      const lastSavedFingerprintRef = useRef('');
      const dismissedDraftsRef = useRef({});
      const importFileRef = useRef(null);
      const lastHydratedProfileIdRef = useRef(null);
      const profileUrlAppliedRef = useRef(false);

      const syncSavedFingerprint = (fp) => {
        lastSavedFingerprintRef.current = fp;
        setLastSavedFingerprint(fp);
      };

      // --- CLIENT PROFILES LIST STATE ---
      const [profiles, setProfiles] = useState(STARTER_UI ? [] : DEFAULT_CLIENTS);
      const [activeProfileId, setActiveProfileId] = useState(STARTER_UI ? '' : DEFAULT_CLIENTS[0].id);

      // --- FIREBASE INITIALIZATION & SYNC ---
      useEffect(() => {
        if (window.FirebaseErrors?.isFileProtocol?.()) {
          setAuthErrorDetails('auth/requests-from-referer-null-are-blocked');
        }
      }, []);

      useEffect(() => {
        let cancelled = false;
        let checkInterval;
        const timeout = setTimeout(() => {
          if (cancelled) return;
          clearInterval(checkInterval);
          if (!window.firebaseAuth || !window.firebaseDb) {
            setAuthErrorDetails('Cloud sync failed to load. If you see a firebase-init error in the console, refresh after the latest deploy.');
          } else if (!window.kolthoffStaffReady) {
            setAuthErrorDetails('Staff authentication module failed to load. Refresh the page or sign in via Admin.');
          }
        }, 15000);

        checkInterval = setInterval(() => {
          if (window.firebaseAuth && window.firebaseDb && window.kolthoffStaffReady) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            const initAuth = async () => {
              try {
                await window.kolthoffStaffReady;
                if (!cancelled) {
                  setIsAuthed(true);
                  setAuthErrorDetails(null);
                }
              } catch (e) {
                console.error("Firebase Auth Error Caught:", e);
                if (!cancelled) {
                  setIsAuthed(false);
                  setAuthErrorDetails(e?.code || e.message || "Authentication failed.");
                }
              }
            };
            initAuth();
          }
        }, 50);

        return () => { cancelled = true; clearInterval(checkInterval); clearTimeout(timeout); };
      }, []);

      useEffect(() => {
        if (!isAuthed) return;

        let profilesSeeded = false;
        const db = window.firebaseDb;
        const appId = window.appId;

        const dealsRef = window.collection(db, 'artifacts', appId, 'public', 'data', 'crm_deals');
        const unsubDeals = window.onSnapshot(dealsRef, (snap) => {
          const fetchedDeals = [];
          snap.forEach((snapDoc) => fetchedDeals.push(snapDoc.data()));
          setCrmDeals(fetchedDeals);
        }, console.error);

        const profilesRef = window.collection(db, 'artifacts', appId, 'public', 'data', 'workbook_profiles');
        const unsubProfiles = window.onSnapshot(profilesRef, (snap) => {
          if (snap.empty && !profilesSeeded && !window.KOLTHOFF_DISABLE_CLIENT_SEED && !STARTER_UI) {
            profilesSeeded = true;
            DEFAULT_CLIENTS.forEach(p => {
              window.firestoreSetDoc(window.firestoreDoc(profilesRef, p.id), p);
            });
          } else {
            const fetchedProfiles = [];
            snap.forEach((snapDoc) => fetchedProfiles.push(snapDoc.data()));
            setProfiles(fetchedProfiles);
            const profileFromUrl = new URLSearchParams(window.location.search).get('profile');
            if (
              !profileUrlAppliedRef.current &&
              profileFromUrl &&
              fetchedProfiles.some((p) => p.id === profileFromUrl)
            ) {
              profileUrlAppliedRef.current = true;
              setActiveProfileId(profileFromUrl);
            } else if (fetchedProfiles.length > 0) {
              setActiveProfileId(currId => {
                if (!fetchedProfiles.find(p => p.id === currId)) return fetchedProfiles[0].id;
                return currId;
              });
            } else if (STARTER_UI) {
              setActiveProfileId('');
            }
          }
        }, console.error);

        return () => { unsubDeals(); unsubProfiles(); };
      }, [isAuthed]);

      const activeProfile = useMemo(() => {
        const match = profiles.find(p => p.id === activeProfileId) || profiles[0];
        if (match) return match;
        return STARTER_UI ? EMPTY_AGENCY_WORKSPACE_STUB : DEFAULT_CLIENTS[0];
      }, [profiles, activeProfileId]);

      const getWorkspaceLabel = H.getWorkspaceLabel;

      // --- ACTIVE METADATA STATE ---
      const [clientCompany, setClientCompany] = useState(activeProfile.clientCompany);
      const [clientRep, setClientRep] = useState(activeProfile.clientRep);
      const [clientAddress, setClientAddress] = useState(activeProfile.clientAddress);
      const [clientTin, setClientTin] = useState(activeProfile.clientTin);
      const [quoteId, setQuoteId] = useState(activeProfile.quoteId);
      const [quoteDate, setQuoteDate] = useState(activeProfile.quoteDate);
      const [quoteValidity, setQuoteValidity] = useState(activeProfile.quoteValidity);
      const [includeTax, setIncludeTax] = useState(activeProfile.includeTax);
      const [preparedBy] = useState('Reinhard Ludwig A. Kolthoff'); 
      const [preparerTitle, setPreparerTitle] = useState(activeProfile.preparerTitle || 'Chief Operations Strategist');
      const [preparerTin] = useState('337-945-806-000');
      const issuerCompanyName = STARTER_UI ? (brand.companyName || 'Studio North') : 'Kolthoff Consulting';
      const issuerLegalName = STARTER_UI ? (brand.companyName || 'Studio North') : preparedBy;
      const issuerTagline = STARTER_UI ? (brand.tagline || '') : 'Operational Excellence & Strategy';
      const [targetStartDate, setTargetStartDate] = useState(activeProfile.targetStartDate ?? '');
      const [proposalObjectives, setProposalObjectives] = useState(activeProfile.proposalObjectives);
      const [proposalSponsor, setProposalSponsor] = useState(activeProfile.proposalSponsor);
      const [preDiagnosticList, setPreDiagnosticList] = useState(activeProfile.preDiagnosticList);
      const [frictionBuffer, setFrictionBuffer] = useState(activeProfile.frictionBuffer);
      const [principalToSeniorDelegate, setPrincipalToSeniorDelegate] = useState(activeProfile.principalToSeniorDelegate);
      const [seniorToAssociateDelegate, setSeniorToAssociateDelegate] = useState(activeProfile.seniorToAssociateDelegate);
      const [overrideTimeline, setOverrideTimeline] = useState(activeProfile.overrideTimeline || '');
      const [weeklyHours, setWeeklyHours] = useState(activeProfile.weeklyHours || 16);
      const [clientReviewWeeks, setClientReviewWeeks] = useState(activeProfile.clientReviewWeeks || 1);

      // --- RETAINER CONFIG STATE ---
      const [subscriptionMonths, setSubscriptionMonths] = useState(activeProfile.subscriptionMonths || 6);
      const [dpaRetentionDays, setDpaRetentionDays] = useState(activeProfile.dpaRetentionDays || 14);
      const [slaCureDays, setSlaCureDays] = useState(activeProfile.slaCureDays || 30);
      const [slaRecurrenceMonths, setSlaRecurrenceMonths] = useState(activeProfile.slaRecurrenceMonths || 3);
      const [slaContent, setSlaContent] = useState(
        activeProfile.slaContent ?? (STARTER_UI ? defaultAgencySlaContent() : '')
      );

      // --- SELECTIVE PDF PRINTING TOGGLES ---
      const [printSow, setPrintSow] = useState(activeProfile.printSow !== undefined ? activeProfile.printSow : true);
      const [printTimeline, setPrintTimeline] = useState(activeProfile.printTimeline !== undefined ? activeProfile.printTimeline : true);
      const [printSla, setPrintSla] = useState(activeProfile.printSla !== undefined ? activeProfile.printSla : true);
      const [printQuote, setPrintQuote] = useState(activeProfile.printQuote !== undefined ? activeProfile.printQuote : true);
      const [printCover, setPrintCover] = useState(activeProfile.printCover !== undefined ? activeProfile.printCover : false);

      // --- CHAOS TAX DYNAMIC STATES ---
      const [staffCount, setStaffCount] = useState(activeProfile.staffCount || 15);
      const [monthlySalary, setMonthlySalary] = useState(activeProfile.monthlySalary || 25000);
      const [wastedHours, setWastedHours] = useState(activeProfile.wastedHours || 2.0);

      const annualOperationalLeakage = useMemo(() => {
        return H.computeAnnualOperationalLeakage(staffCount, monthlySalary, wastedHours);
      }, [staffCount, monthlySalary, wastedHours]);

      const recoveryPotential = useMemo(() => {
        return annualOperationalLeakage * 0.4;
      }, [annualOperationalLeakage]);

      // --- SOW SELECTION ---
      const [tasks, setTasks] = useState(
        STARTER_UI ? (activeProfile.tasks ?? []) : (activeProfile.tasks || PRODUCT_TASK_CATALOG)
      );
      const [moduleBundleNames, setModuleBundleNames] = useState(() => ({
        ...defaultAgencyModuleBundleNames(),
        ...(activeProfile.moduleBundleNames || {}),
      }));
      const [discountPercent, setDiscountPercent] = useState(activeProfile.discountPercent || 0);
      const [milestoneSplit, setMilestoneSplit] = useState(activeProfile.milestoneSplit || 'auto');
      const [customSplit1, setCustomSplit1] = useState(activeProfile.customSplit1 || 40);
      const [customSplit2, setCustomSplit2] = useState(activeProfile.customSplit2 || 40);
      const [customSplit3, setCustomSplit3] = useState(activeProfile.customSplit3 || 20);

      const [ndaEffectiveDate, setNdaEffectiveDate] = useState(activeProfile.ndaEffectiveDate || '');
      const [ndaPurpose, setNdaPurpose] = useState(activeProfile.ndaPurpose || '');
      const [ndaTerm, setNdaTerm] = useState(activeProfile.ndaTerm || '5 (Five) Years');
      const [ndaJurisdiction, setNdaJurisdiction] = useState(activeProfile.ndaJurisdiction || 'Taytay, Rizal, Philippines');

      const [invoiceMilestone, setInvoiceMilestone] = useState(activeProfile.invoiceMilestone || 'full');
      const [retainerBillingPeriod, setRetainerBillingPeriod] = useState(activeProfile.retainerBillingPeriod || '');
      const [customInvoiceAmount, setCustomInvoiceAmount] = useState(activeProfile.customInvoiceAmount || 120000);
      const [invoiceNumberSuffix, setInvoiceNumberSuffix] = useState(activeProfile.invoiceNumberSuffix || '01');
      const [invoiceDueDate, setInvoiceDueDate] = useState(activeProfile.invoiceDueDate || '');
      const [useCustomInvoiceBillTo, setUseCustomInvoiceBillTo] = useState(Boolean(activeProfile.useCustomInvoiceBillTo));
      const [invoiceBillToCompany, setInvoiceBillToCompany] = useState(activeProfile.invoiceBillToCompany || '');
      const [invoiceBillToRep, setInvoiceBillToRep] = useState(activeProfile.invoiceBillToRep || '');
      const [invoiceBillToAddress, setInvoiceBillToAddress] = useState(activeProfile.invoiceBillToAddress || '');
      const [invoiceBillToTin, setInvoiceBillToTin] = useState(activeProfile.invoiceBillToTin || '');
      const [invoicePartySource, setInvoicePartySource] = useState(
        activeProfile.invoicePartySource === 'sponsor' ? 'sponsor' : 'client',
      );
      const [useCustomSponsor, setUseCustomSponsor] = useState(Boolean(activeProfile.useCustomSponsor ?? activeProfile.useCustomDocumentParty));
      const [sponsorCompany, setSponsorCompany] = useState(activeProfile.sponsorCompany || activeProfile.documentPartyCompany || '');
      const [sponsorRep, setSponsorRep] = useState(activeProfile.sponsorRep || activeProfile.documentPartyRep || '');
      const [sponsorAddress, setSponsorAddress] = useState(activeProfile.sponsorAddress || activeProfile.documentPartyAddress || '');
      const [sponsorTin, setSponsorTin] = useState(activeProfile.sponsorTin || activeProfile.documentPartyTin || '');
      const [contractPartySource, setContractPartySource] = useState(
        activeProfile.contractPartySource === 'sponsor' ? 'sponsor' : 'client',
      );

      const [addenda, setAddenda] = useState(activeProfile.addenda || []);
      const [activeAddendumId, setActiveAddendumId] = useState(activeProfile.activeAddendumId || null);
      const [invoiceAddendumId, setInvoiceAddendumId] = useState(activeProfile.invoiceAddendumId || null);

      const resolvedClientParty = useMemo(() => H.resolveClientParty({
        clientCompany,
        clientRep,
        clientAddress,
        clientTin,
      }), [clientCompany, clientRep, clientAddress, clientTin]);

      const resolvedSponsorParty = useMemo(() => H.resolveSponsorParty({
        useCustomSponsor,
        sponsorCompany,
        sponsorRep,
        sponsorAddress,
        sponsorTin,
        clientCompany,
        clientRep,
        clientAddress,
        clientTin,
      }), [useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin, clientCompany, clientRep, clientAddress, clientTin]);

      const copyContractClientToInvoiceBillTo = () => {
        setInvoiceBillToCompany(clientCompany || '');
        setInvoiceBillToRep(clientRep || '');
        setInvoiceBillToAddress(clientAddress || '');
        setInvoiceBillToTin(clientTin || '');
      };

      const copyClientToSponsor = () => {
        setSponsorCompany(clientCompany || '');
        setSponsorRep(clientRep || '');
        setSponsorAddress(clientAddress || '');
        setSponsorTin(clientTin || '');
      };

      const [activePresets, setActivePresets] = useState(['mod1']);
      const [selectedPackageId, setSelectedPackageId] = useState('leak-scan');
      const [packageCustomized, setPackageCustomized] = useState(false);
      const [packageAppliedAt, setPackageAppliedAt] = useState(null);
      const [engagementType, setEngagementType] = useState('service');
      const [productId, setProductId] = useState(null);
      const [showPackageApplyConfirm, setShowPackageApplyConfirm] = useState(false);
      const [pendingPackageId, setPendingPackageId] = useState(null);
      const catalogTasksRef = useRef(PRODUCT_TASK_CATALOG.map(t => ({ ...t })));

      const [newTaskCategory, setNewTaskCategory] = useState(MOD_1);
      const [newTaskDeliv, setNewTaskDeliv] = useState('');
      const [newLineQty, setNewLineQty] = useState('1');
      const [newLineDuration, setNewLineDuration] = useState('1');
      const [newLineUnitPrice, setNewLineUnitPrice] = useState('');
      const [newLineUnit, setNewLineUnit] = useState('per hour');
      const [newLineMarkUp, setNewLineMarkUp] = useState('33.3');
      const [newLineModuleKey, setNewLineModuleKey] = useState('mod1');
      const [newTaskDesc, setNewTaskDesc] = useState('');
      const [newTaskHours, setNewTaskHours] = useState('');
      const [newTaskMultiplier, setNewTaskMultiplier] = useState(0); 
      const [newTaskTier, setNewTaskTier] = useState('associate');
      const [newTaskActivities, setNewTaskActivities] = useState('');
      const [newTaskExpectations, setNewTaskExpectations] = useState('');
      const [newTaskOutput, setNewTaskOutput] = useState('');
      const [dragTaskId, setDragTaskId] = useState(null);

      const [principalRate, setPrincipalRate] = useState(activeProfile.principalRate ?? H.DEFAULT_RATES.principalRate);
      const [seniorRate, setSeniorRate] = useState(activeProfile.seniorRate ?? H.DEFAULT_RATES.seniorRate);
      const [associateRate, setAssociateRate] = useState(activeProfile.associateRate ?? H.DEFAULT_RATES.associateRate);
      const [partnerRate, setPartnerRate] = useState(activeProfile.partnerRate ?? H.DEFAULT_RATES.partnerRate);

      const hourlyRates = useMemo(() => ({ principalRate, seniorRate, associateRate, partnerRate }), [principalRate, seniorRate, associateRate, partnerRate]);
      const getRateForTier = useCallback((tier) => H.getRateForTier(tier, hourlyRates), [hourlyRates]);

      const activeAddendum = useMemo(
        () => (addenda || []).find((a) => a.id === activeAddendumId) || null,
        [addenda, activeAddendumId],
      );

      const addendumEconomics = useMemo(() => {
        if (!activeAddendum) return null;
        return H.computeAddendumEconomics(activeAddendum, {
          includeTax,
          frictionBuffer,
          subscriptionMonths,
          principalToSeniorDelegate,
          seniorToAssociateDelegate,
          recoveryPotential,
          staffCount,
          monthlySalary,
          wastedHours,
          rates: hourlyRates,
          formatCurrency,
        });
      }, [activeAddendum, includeTax, frictionBuffer, subscriptionMonths, principalToSeniorDelegate, seniorToAssociateDelegate, recoveryPotential, staffCount, monthlySalary, wastedHours, hourlyRates]);

      const resolvedAddendumParty = useMemo(() => {
        if (!activeAddendum) return null;
        return H.resolveAddendumParty(activeAddendum, {
          clientCompany, clientRep, clientAddress, clientTin,
          useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin,
          contractPartySource,
        });
      }, [activeAddendum, clientCompany, clientRep, clientAddress, clientTin, useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin, contractPartySource]);

      const addendumPartyLabel = useMemo(() => {
        if (!activeAddendum) return 'Client';
        return H.getAddendumPartySource(activeAddendum, { contractPartySource }) === 'sponsor' ? 'Sponsor' : 'Client';
      }, [activeAddendum, contractPartySource]);

      const invoiceTargetAddendum = useMemo(
        () => (invoiceAddendumId ? (addenda || []).find((a) => a.id === invoiceAddendumId) : null),
        [addenda, invoiceAddendumId],
      );

      const invoiceTargetEconomics = useMemo(() => {
        if (!invoiceTargetAddendum) return null;
        return H.computeAddendumEconomics(invoiceTargetAddendum, {
          includeTax,
          frictionBuffer,
          subscriptionMonths,
          principalToSeniorDelegate,
          seniorToAssociateDelegate,
          recoveryPotential,
          staffCount,
          monthlySalary,
          wastedHours,
          rates: hourlyRates,
          formatCurrency,
        });
      }, [invoiceTargetAddendum, includeTax, frictionBuffer, subscriptionMonths, principalToSeniorDelegate, seniorToAssociateDelegate, recoveryPotential, staffCount, monthlySalary, wastedHours, hourlyRates]);

      const isAddendumInvoiceMode = view === 'invoice' && Boolean(invoiceTargetAddendum);

      const resolvedInvoiceBillTo = useMemo(() => H.resolveInvoiceBillTo({
        useCustomInvoiceBillTo,
        invoiceBillToCompany,
        invoiceBillToRep,
        invoiceBillToAddress,
        invoiceBillToTin,
        invoicePartySource,
        clientCompany,
        clientRep,
        clientAddress,
        clientTin,
        useCustomSponsor,
        sponsorCompany,
        sponsorRep,
        sponsorAddress,
        sponsorTin,
        contractPartySource,
      }, isAddendumInvoiceMode ? invoiceTargetAddendum : null), [
        useCustomInvoiceBillTo, invoiceBillToCompany, invoiceBillToRep, invoiceBillToAddress, invoiceBillToTin,
        invoicePartySource, clientCompany, clientRep, clientAddress, clientTin,
        useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin, contractPartySource,
        isAddendumInvoiceMode, invoiceTargetAddendum,
      ]);

      const invoicePartyLabel = useMemo(() => {
        if (useCustomInvoiceBillTo) return 'Custom';
        const source = H.getInvoicePartySource({
          invoicePartySource,
          contractPartySource,
        }, isAddendumInvoiceMode ? invoiceTargetAddendum : null);
        return source === 'sponsor' ? 'Sponsor' : 'Client';
      }, [useCustomInvoiceBillTo, invoicePartySource, contractPartySource, isAddendumInvoiceMode, invoiceTargetAddendum]);

      const patchInvoiceTargetAddendum = useCallback((patch) => {
        if (!invoiceAddendumId) return;
        setAddenda((prev) => H.updateAddendumInList(prev, invoiceAddendumId, patch));
      }, [invoiceAddendumId]);

      useEffect(() => {
        if (!invoiceAddendumId) return;
        const target = (addenda || []).find((a) => a.id === invoiceAddendumId);
        if (!target || target.status === 'invoiced') setInvoiceAddendumId(null);
      }, [addenda, invoiceAddendumId]);

      const patchActiveAddendum = useCallback((patch) => {
        if (!activeAddendumId) return;
        setAddenda((prev) => H.updateAddendumInList(prev, activeAddendumId, patch));
      }, [activeAddendumId]);

      const [addendumModulesReady, setAddendumModulesReady] = useState(false);
      const [addendumTemplates, setAddendumTemplates] = useState([]);

      useEffect(() => {
        if (view !== 'addendum') return undefined;
        let cancelled = false;
        H.ensureAddendumModules()
          .then(() => {
            if (cancelled) return;
            setAddendumModulesReady(true);
            setAddendumTemplates(window.AddendumTemplates?.listTemplates?.() || []);
          })
          .catch((err) => console.error('Addendum modules failed to load:', err));
        return () => { cancelled = true; };
      }, [view]);

      const createAddendumFromTemplate = useCallback(async (templateId) => {
        await H.ensureAddendumModules();
        setAddendumModulesReady(true);
        setAddendumTemplates(window.AddendumTemplates?.listTemplates?.() || []);
        const record = H.createAddendumRecord({
          parentQuoteId: quoteId,
          addenda,
          templateId,
          catalogTasks: catalogTasksRef.current,
          quoteDate,
          defaultPartySource: contractPartySource,
        });
        setAddenda((prev) => [...(prev || []), record]);
        setActiveAddendumId(record.id);
        setView('addendum');
      }, [quoteId, addenda, quoteDate, contractPartySource]);

      const toggleAddendumTask = useCallback((taskId) => {
        if (!activeAddendum) return;
        const nextTasks = (activeAddendum.tasks || []).map((t) => (
          t.id === taskId ? { ...t, selected: !t.selected } : t
        ));
        patchActiveAddendum({ tasks: nextTasks });
      }, [activeAddendum, patchActiveAddendum]);

      const updateAddendumTaskHours = useCallback((taskId, value) => {
        if (!activeAddendum) return;
        const hours = Math.max(1, Math.round(Number(value) || 1));
        const nextTasks = (activeAddendum.tasks || []).map((t) => (
          t.id === taskId ? { ...t, estHours: hours } : t
        ));
        patchActiveAddendum({ tasks: nextTasks });
      }, [activeAddendum, patchActiveAddendum]);

      const deleteActiveAddendum = useCallback(() => {
        if (!activeAddendum || !H.canDeleteAddendum(activeAddendum)) return;
        const label = activeAddendum.ref || activeAddendum.suffix || 'this addendum';
        const statusLabel = activeAddendum.status === 'issued' ? 'issued' : 'draft';
        if (!window.confirm(`Delete ${statusLabel} addendum ${label}? This cannot be undone.`)) return;
        const remaining = H.removeAddendumFromList(addenda, activeAddendum.id);
        setAddenda(remaining);
        setActiveAddendumId(remaining[0]?.id ?? null);
        isDirtyRef.current = true;
        setSaveStatus('unsaved');
      }, [activeAddendum, addenda]);

      useEffect(() => {
        const p = profiles.find(profile => profile.id === activeProfileId) || profiles[0] || (STARTER_UI ? null : DEFAULT_CLIENTS[0]);
        if (!p || !p.id) return;
        const profileSwitch = lastHydratedProfileIdRef.current !== activeProfileId;
        if (!profileSwitch && isDirtyRef.current) return;
        const profileStaffCount = p.staffCount !== undefined ? p.staffCount : 15;
        const profileMonthlySalary = p.monthlySalary !== undefined ? p.monthlySalary : 25000;
        const profileWastedHours = p.wastedHours !== undefined ? p.wastedHours : 2.0;
        const profileLeakage = H.computeAnnualOperationalLeakage(profileStaffCount, profileMonthlySalary, profileWastedHours);
        const bundleNames = { ...defaultAgencyModuleBundleNames(), ...(p.moduleBundleNames || {}) };
        const profileState = {
          clientCompany: p.clientCompany, clientRep: p.clientRep, clientAddress: p.clientAddress, clientTin: p.clientTin,
          quoteId: p.quoteId, quoteDate: p.quoteDate, quoteValidity: p.quoteValidity, includeTax: p.includeTax,
          preparerTitle: p.preparerTitle || 'Chief Operations Strategist', targetStartDate: p.targetStartDate ?? '',
          proposalObjectives: p.proposalObjectives ?? '', proposalSponsor: p.proposalSponsor ?? '', preDiagnosticList: p.preDiagnosticList ?? '',
          frictionBuffer: p.frictionBuffer, principalToSeniorDelegate: p.principalToSeniorDelegate,
          seniorToAssociateDelegate: p.seniorToAssociateDelegate, overrideTimeline: p.overrideTimeline || '',
          weeklyHours: p.weeklyHours || 16, clientReviewWeeks: p.clientReviewWeeks !== undefined ? p.clientReviewWeeks : 1,
          tasks: (STARTER_UI ? (p.tasks ?? []).map((t) => H.normalizeAgencyLineItemTask(t, bundleNames)) : (p.tasks || PRODUCT_TASK_CATALOG)), discountPercent: p.discountPercent || 0,
          moduleBundleNames: bundleNames,
          subscriptionMonths: p.subscriptionMonths !== undefined ? p.subscriptionMonths : 6,
          dpaRetentionDays: p.dpaRetentionDays !== undefined ? p.dpaRetentionDays : 14,
          slaCureDays: p.slaCureDays !== undefined ? p.slaCureDays : 30,
          slaRecurrenceMonths: p.slaRecurrenceMonths !== undefined ? p.slaRecurrenceMonths : 3,
          slaContent: p.slaContent ?? (STARTER_UI ? defaultAgencySlaContent() : ''),
          printSow: p.printSow !== undefined ? p.printSow : true, printTimeline: p.printTimeline !== undefined ? p.printTimeline : true,
          printSla: p.printSla !== undefined ? p.printSla : true,
          printQuote: p.printQuote !== undefined ? p.printQuote : true,
          printCover: p.printCover !== undefined ? p.printCover : false,
          milestoneSplit: p.milestoneSplit || 'auto', customSplit1: p.customSplit1 !== undefined ? p.customSplit1 : 40,
          customSplit2: p.customSplit2 !== undefined ? p.customSplit2 : 40, customSplit3: p.customSplit3 !== undefined ? p.customSplit3 : 20,
          ndaEffectiveDate: p.ndaEffectiveDate || '', ndaPurpose: p.ndaPurpose || '', ndaTerm: p.ndaTerm || '5 (Five) Years',
          ndaJurisdiction: p.ndaJurisdiction || 'Taytay, Rizal, Philippines', invoiceMilestone: p.invoiceMilestone || 'full',
          retainerBillingPeriod: p.retainerBillingPeriod || '',
          customInvoiceAmount: p.customInvoiceAmount || 120000, invoiceNumberSuffix: p.invoiceNumberSuffix || '01', invoiceDueDate: p.invoiceDueDate || '',
          useCustomInvoiceBillTo: Boolean(p.useCustomInvoiceBillTo),
          invoiceBillToCompany: p.invoiceBillToCompany || '', invoiceBillToRep: p.invoiceBillToRep || '',
          invoiceBillToAddress: p.invoiceBillToAddress || '', invoiceBillToTin: p.invoiceBillToTin || '',
          invoicePartySource: p.invoicePartySource === 'sponsor' ? 'sponsor' : 'client',
          useCustomSponsor: Boolean(p.useCustomSponsor ?? p.useCustomDocumentParty),
          sponsorCompany: p.sponsorCompany || p.documentPartyCompany || '', sponsorRep: p.sponsorRep || p.documentPartyRep || '',
          sponsorAddress: p.sponsorAddress || p.documentPartyAddress || '', sponsorTin: p.sponsorTin || p.documentPartyTin || '',
          contractPartySource: p.contractPartySource === 'sponsor' ? 'sponsor' : 'client',
          staffCount: profileStaffCount, monthlySalary: profileMonthlySalary, wastedHours: profileWastedHours,
          principalRate: p.principalRate ?? H.DEFAULT_RATES.principalRate, seniorRate: p.seniorRate ?? H.DEFAULT_RATES.seniorRate,
          associateRate: p.associateRate ?? H.DEFAULT_RATES.associateRate, partnerRate: p.partnerRate ?? H.DEFAULT_RATES.partnerRate,
          selectedPackageId: p.selectedPackageId ?? (STARTER_UI ? 'custom' : 'leak-scan'),
          packageCustomized: p.packageCustomized ?? false,
          packageAppliedAt: p.packageAppliedAt ?? null,
          engagementType: p.engagementType ?? 'service',
          productId: p.productId ?? null,
          addenda: p.addenda || [],
          activeAddendumId: p.activeAddendumId || null,
          invoiceAddendumId: p.invoiceAddendumId || null,
        };
        if (!profileSwitch && !isDirtyRef.current) {
          const incomingPayload = H.buildProfilePayload(activeProfileId, p.workspaceName || '', profileState, profileLeakage, p);
          if (p.updatedAt) incomingPayload.updatedAt = p.updatedAt;
          if (H.payloadFingerprint(incomingPayload) === lastSavedFingerprintRef.current) return;
        }
        lastHydratedProfileIdRef.current = activeProfileId;
        setClientCompany(profileState.clientCompany);
        setClientRep(profileState.clientRep);
        setClientAddress(profileState.clientAddress);
        setClientTin(profileState.clientTin);
        setQuoteId(profileState.quoteId);
        setQuoteDate(profileState.quoteDate);
        setQuoteValidity(profileState.quoteValidity);
        setStaffCount(profileState.staffCount);
        setMonthlySalary(profileState.monthlySalary);
        setWastedHours(profileState.wastedHours);
        setIncludeTax(profileState.includeTax);
        setPreparerTitle(profileState.preparerTitle);
        setTargetStartDate(profileState.targetStartDate);
        setProposalObjectives(profileState.proposalObjectives);
        setProposalSponsor(profileState.proposalSponsor);
        setPreDiagnosticList(profileState.preDiagnosticList);
        setFrictionBuffer(profileState.frictionBuffer);
        setPrincipalToSeniorDelegate(profileState.principalToSeniorDelegate);
        setSeniorToAssociateDelegate(profileState.seniorToAssociateDelegate);
        setOverrideTimeline(profileState.overrideTimeline);
        setWeeklyHours(profileState.weeklyHours);
        setClientReviewWeeks(profileState.clientReviewWeeks);
        setTasks(profileState.tasks);
        setModuleBundleNames(profileState.moduleBundleNames || defaultAgencyModuleBundleNames());
        setDiscountPercent(profileState.discountPercent);
        setSubscriptionMonths(profileState.subscriptionMonths);
        setDpaRetentionDays(profileState.dpaRetentionDays);
        setSlaCureDays(profileState.slaCureDays);
        setSlaRecurrenceMonths(profileState.slaRecurrenceMonths);
        setSlaContent(profileState.slaContent ?? (STARTER_UI ? defaultAgencySlaContent() : ''));
        setPrintSow(profileState.printSow);
        setPrintTimeline(profileState.printTimeline);
        setPrintSla(profileState.printSla);
        setPrintQuote(profileState.printQuote);
        setPrintCover(profileState.printCover);
        setMilestoneSplit(profileState.milestoneSplit);
        setCustomSplit1(profileState.customSplit1);
        setCustomSplit2(profileState.customSplit2);
        setCustomSplit3(profileState.customSplit3);
        setNdaEffectiveDate(profileState.ndaEffectiveDate);
        setNdaPurpose(profileState.ndaPurpose);
        setNdaTerm(profileState.ndaTerm);
        setNdaJurisdiction(profileState.ndaJurisdiction);
        setInvoiceMilestone(profileState.invoiceMilestone);
        setRetainerBillingPeriod(profileState.retainerBillingPeriod || '');
        setCustomInvoiceAmount(profileState.customInvoiceAmount);
        setInvoiceNumberSuffix(profileState.invoiceNumberSuffix);
        setInvoiceDueDate(profileState.invoiceDueDate);
        setUseCustomInvoiceBillTo(profileState.useCustomInvoiceBillTo);
        setInvoiceBillToCompany(profileState.invoiceBillToCompany);
        setInvoiceBillToRep(profileState.invoiceBillToRep);
        setInvoiceBillToAddress(profileState.invoiceBillToAddress);
        setInvoiceBillToTin(profileState.invoiceBillToTin);
        setInvoicePartySource(profileState.invoicePartySource);
        setUseCustomSponsor(profileState.useCustomSponsor);
        setSponsorCompany(profileState.sponsorCompany);
        setSponsorRep(profileState.sponsorRep);
        setSponsorAddress(profileState.sponsorAddress);
        setSponsorTin(profileState.sponsorTin);
        setContractPartySource(profileState.contractPartySource);
        setPrincipalRate(profileState.principalRate);
        setSeniorRate(profileState.seniorRate);
        setAssociateRate(profileState.associateRate);
        setPartnerRate(profileState.partnerRate);
        setSelectedPackageId(profileState.selectedPackageId);
        setPackageCustomized(profileState.packageCustomized);
        setPackageAppliedAt(profileState.packageAppliedAt);
        setEngagementType(profileState.engagementType || 'service');
        setProductId(profileState.productId || null);
        setAddenda(profileState.addenda || []);
        setActiveAddendumId(profileState.activeAddendumId || (profileState.addenda?.[0]?.id ?? null));
        setInvoiceAddendumId(profileState.invoiceAddendumId || null);
        setActivePresets(H.deriveActivePresetsFromTasks(profileState.tasks));
        isHydratingRef.current = true;
        const hydratedPayload = H.buildProfilePayload(activeProfileId, p.workspaceName || '', profileState, profileLeakage, p);
        if (p.updatedAt) hydratedPayload.updatedAt = p.updatedAt;
        syncSavedFingerprint(H.payloadFingerprint(hydratedPayload));
        setSaveStatus('saved');
        setSaveError(null);
        isDirtyRef.current = false;
        if (profileSwitch) {
          const draft = H.loadLocalDraft(activeProfileId);
          const cloudFp = H.payloadFingerprint(hydratedPayload);
          const dismissedAt = dismissedDraftsRef.current[activeProfileId];
          if (draft?.payload && draft.savedAt > (p.updatedAt || 0)) {
            const draftFp = H.payloadFingerprint(draft.payload);
            if (draftFp !== cloudFp && draft.savedAt !== dismissedAt) {
              setLocalDraftBanner(draft);
            } else {
              if (draftFp === cloudFp) H.clearLocalDraft(activeProfileId);
              setLocalDraftBanner(null);
            }
          } else {
            setLocalDraftBanner(null);
          }
        }
        setTimeout(() => { isHydratingRef.current = false; }, 0);
      }, [activeProfileId, profiles]);

      const buildCurrentProfileState = useCallback(() => ({
        clientCompany, clientRep, clientAddress, clientTin, quoteId, quoteDate, quoteValidity,
        includeTax, preparerTitle, targetStartDate, proposalObjectives, proposalSponsor, preDiagnosticList,
        frictionBuffer, principalToSeniorDelegate, seniorToAssociateDelegate, overrideTimeline, weeklyHours,
        clientReviewWeeks, tasks, discountPercent, dpaRetentionDays, slaCureDays, slaRecurrenceMonths, subscriptionMonths, slaContent, printSow, printTimeline, printSla, printQuote, printCover,
        milestoneSplit, customSplit1, customSplit2, customSplit3, ndaEffectiveDate, ndaPurpose, ndaTerm,
        ndaJurisdiction, invoiceMilestone, retainerBillingPeriod, customInvoiceAmount, invoiceNumberSuffix, invoiceDueDate,
        useCustomInvoiceBillTo, invoiceBillToCompany, invoiceBillToRep, invoiceBillToAddress, invoiceBillToTin, invoicePartySource,
        useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin, contractPartySource,
        staffCount, monthlySalary, wastedHours, principalRate, seniorRate, associateRate, partnerRate,
        selectedPackageId, packageCustomized, packageAppliedAt, engagementType, productId, addenda, activeAddendumId, invoiceAddendumId,
        moduleBundleNames,
      }), [clientCompany, clientRep, clientAddress, clientTin, quoteId, quoteDate, quoteValidity, includeTax, preparerTitle, targetStartDate, proposalObjectives, proposalSponsor, preDiagnosticList, frictionBuffer, principalToSeniorDelegate, seniorToAssociateDelegate, overrideTimeline, weeklyHours, clientReviewWeeks, tasks, discountPercent, dpaRetentionDays, slaCureDays, slaRecurrenceMonths, subscriptionMonths, slaContent, printSow, printTimeline, printSla, printQuote, printCover, milestoneSplit, customSplit1, customSplit2, customSplit3, ndaEffectiveDate, ndaPurpose, ndaTerm, ndaJurisdiction, invoiceMilestone, retainerBillingPeriod, customInvoiceAmount, invoiceNumberSuffix, invoiceDueDate, useCustomInvoiceBillTo, invoiceBillToCompany, invoiceBillToRep, invoiceBillToAddress, invoiceBillToTin, invoicePartySource, useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin, contractPartySource, staffCount, monthlySalary, wastedHours, principalRate, seniorRate, associateRate, partnerRate, selectedPackageId, packageCustomized, packageAppliedAt, engagementType, productId, addenda, activeAddendumId, invoiceAddendumId, moduleBundleNames]);

      const buildCurrentPayload = useCallback(() => {
        return H.buildProfilePayload(activeProfileId, activeProfile.workspaceName || '', buildCurrentProfileState(), annualOperationalLeakage, activeProfile);
      }, [activeProfileId, activeProfile, buildCurrentProfileState, annualOperationalLeakage]);

      const handleSaveToCloud = async (isAuto = false, retryCount = 0) => {
        if (!isAuthed) return false;
        setIsSaving(true);
        setSaveStatus('saving');
        setSaveError(null);
        try {
          await H.ensurePortalSync();
          const currentProfilePayload = buildCurrentPayload();
          currentProfilePayload.updatedAt = Date.now();
          const docRef = window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', activeProfileId);
          await window.firestoreSetDoc(docRef, currentProfilePayload, { merge: true });
          syncSavedFingerprint(H.payloadFingerprint(currentProfilePayload));
          if (window.PortalSync?.syncProfileToPortalIfExists) {
            try {
              await window.PortalSync.syncProfileToPortalIfExists(currentProfilePayload);
            } catch (portalErr) {
              console.warn('Portal sync skipped:', portalErr);
            }
          }
          setSaveStatus('saved');
          isDirtyRef.current = false;
          H.clearLocalDraft(activeProfileId);
          setLocalDraftBanner(null);
          setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, ...currentProfilePayload } : p));
          return true;
        } catch (e) {
          console.error("Error saving to cloud:", e);
          if (retryCount < 1) return handleSaveToCloud(isAuto, retryCount + 1);
          setSaveStatus('error');
          setSaveError(e.message || 'Save failed. A local draft was kept.');
          H.saveLocalDraft(activeProfileId, buildCurrentPayload());
          return false;
        } finally {
          setTimeout(() => setIsSaving(false), isAuto ? 400 : 800);
        }
      };

      useEffect(() => {
        if (isHydratingRef.current) return;
        const payload = buildCurrentPayload();
        const fp = H.payloadFingerprint(payload);
        if (fp === lastSavedFingerprintRef.current) {
          isDirtyRef.current = false;
          if (isAuthed) setSaveStatus((prev) => (prev === 'saving' ? prev : 'saved'));
          return;
        }
        isDirtyRef.current = true;
        setSaveStatus('unsaved');
        if (!isAuthed) H.saveLocalDraft(activeProfileId, payload);
        if (!isAuthed) return;
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = setTimeout(() => { handleSaveToCloud(true); }, 2500);
        return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
      }, [buildCurrentPayload, isAuthed, activeProfileId]);

      useEffect(() => {
        const onBeforeUnload = (e) => {
          if (saveStatus === 'unsaved' || saveStatus === 'saving') {
            e.preventDefault();
            e.returnValue = '';
          }
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
      }, [saveStatus]);

      const requestProfileSwitch = (newId) => {
        if (newId === activeProfileId) return;
        const fp = H.payloadFingerprint(buildCurrentPayload());
        if (fp !== lastSavedFingerprintRef.current) {
          setPendingProfileId(newId);
          setShowUnsavedSwitchConfirm(true);
        } else {
          setActiveProfileId(newId);
        }
      };

      const confirmProfileSwitch = (saveFirst) => {
        const targetId = pendingProfileId;
        setShowUnsavedSwitchConfirm(false);
        setPendingProfileId(null);
        if (!targetId) return;
        if (saveFirst) {
          handleSaveToCloud(false).then((ok) => { if (ok) setActiveProfileId(targetId); });
        } else {
          setActiveProfileId(targetId);
        }
      };

      const restoreLocalDraft = () => {
        if (!localDraftBanner?.payload) return;
        const d = localDraftBanner.payload;
        setClientCompany(d.clientCompany); setClientRep(d.clientRep); setClientAddress(d.clientAddress); setClientTin(d.clientTin);
        setQuoteId(d.quoteId); setQuoteDate(d.quoteDate); setQuoteValidity(d.quoteValidity); setIncludeTax(d.includeTax);
        setPreparerTitle(d.preparerTitle); setTargetStartDate(d.targetStartDate); setProposalObjectives(d.proposalObjectives);
        setProposalSponsor(d.proposalSponsor); setPreDiagnosticList(d.preDiagnosticList); setFrictionBuffer(d.frictionBuffer);
        setPrincipalToSeniorDelegate(d.principalToSeniorDelegate); setSeniorToAssociateDelegate(d.seniorToAssociateDelegate);
        setOverrideTimeline(d.overrideTimeline || ''); setWeeklyHours(d.weeklyHours || 16); setClientReviewWeeks(d.clientReviewWeeks ?? 1);
        setTasks(d.tasks || INITIAL_TASKS); setDiscountPercent(d.discountPercent || 0);
        setSubscriptionMonths(d.subscriptionMonths ?? 6);
        setDpaRetentionDays(d.dpaRetentionDays ?? 14);
        setSlaCureDays(d.slaCureDays ?? 30);
        setSlaRecurrenceMonths(d.slaRecurrenceMonths ?? 3);
        setSlaContent(d.slaContent ?? (STARTER_UI ? defaultAgencySlaContent() : ''));
        setPrintSow(d.printSow ?? true); setPrintTimeline(d.printTimeline ?? true);
        setPrintSla(d.printSla ?? true);
        setPrintQuote(d.printQuote ?? true); setPrintCover(d.printCover ?? false);
        setMilestoneSplit(d.milestoneSplit || 'auto'); setCustomSplit1(d.customSplit1 ?? 40); setCustomSplit2(d.customSplit2 ?? 40); setCustomSplit3(d.customSplit3 ?? 20);
        setNdaEffectiveDate(d.ndaEffectiveDate || ''); setNdaPurpose(d.ndaPurpose || ''); setNdaTerm(d.ndaTerm || '5 (Five) Years');
        setNdaJurisdiction(d.ndaJurisdiction || 'Taytay, Rizal, Philippines'); setInvoiceMilestone(d.invoiceMilestone || 'full');
        setRetainerBillingPeriod(d.retainerBillingPeriod || '');
        setCustomInvoiceAmount(d.customInvoiceAmount || 120000); setInvoiceNumberSuffix(d.invoiceNumberSuffix || '01'); setInvoiceDueDate(d.invoiceDueDate || '');
        setUseCustomInvoiceBillTo(Boolean(d.useCustomInvoiceBillTo));
        setInvoiceBillToCompany(d.invoiceBillToCompany || ''); setInvoiceBillToRep(d.invoiceBillToRep || '');
        setInvoiceBillToAddress(d.invoiceBillToAddress || ''); setInvoiceBillToTin(d.invoiceBillToTin || '');
        setInvoicePartySource(d.invoicePartySource === 'sponsor' ? 'sponsor' : 'client');
        setUseCustomSponsor(Boolean(d.useCustomSponsor ?? d.useCustomDocumentParty));
        setSponsorCompany(d.sponsorCompany || d.documentPartyCompany || ''); setSponsorRep(d.sponsorRep || d.documentPartyRep || '');
        setSponsorAddress(d.sponsorAddress || d.documentPartyAddress || ''); setSponsorTin(d.sponsorTin || d.documentPartyTin || '');
        setContractPartySource(d.contractPartySource === 'sponsor' ? 'sponsor' : 'client');
        setStaffCount(d.staffCount ?? 15); setMonthlySalary(d.monthlySalary ?? 25000); setWastedHours(d.wastedHours ?? 2.0);
        setPrincipalRate(d.principalRate ?? H.DEFAULT_RATES.principalRate); setSeniorRate(d.seniorRate ?? H.DEFAULT_RATES.seniorRate);
        setAssociateRate(d.associateRate ?? H.DEFAULT_RATES.associateRate); setPartnerRate(d.partnerRate ?? H.DEFAULT_RATES.partnerRate);
        setSelectedPackageId(d.selectedPackageId ?? 'leak-scan'); setPackageCustomized(d.packageCustomized ?? false);
        setPackageAppliedAt(d.packageAppliedAt ?? null);
        setEngagementType(d.engagementType ?? 'service');
        setProductId(d.productId ?? null);
        setAddenda(d.addenda || []);
        setActiveAddendumId(d.activeAddendumId || (d.addenda?.[0]?.id ?? null));
        setInvoiceAddendumId(d.invoiceAddendumId || null);
        setActivePresets(H.deriveActivePresetsFromTasks(d.tasks || INITIAL_TASKS));
        H.clearLocalDraft(activeProfileId);
        setLocalDraftBanner(null);
        isDirtyRef.current = true;
        setSaveStatus('unsaved');
      };

      const handleExportWorkspace = () => {
        const payload = buildCurrentPayload();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getWorkspaceLabel(activeProfile).replace(/[^a-z0-9-_]+/gi, '_')}_${activeProfileId}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };

      const handleImportWorkspaceFile = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const imported = JSON.parse(ev.target.result);
            if (!imported.clientCompany && !imported.tasks) throw new Error('Invalid workspace file');
            const newId = imported.id ? `${imported.id}-import-${Date.now()}` : `client-import-${Date.now()}`;
            const payload = { ...imported, id: newId, workspaceName: imported.workspaceName || `${imported.clientCompany || 'Imported'} Workspace`, updatedAt: Date.now() };
            if (isAuthed) {
              await window.firestoreSetDoc(window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', newId), payload);
              setActiveProfileId(newId);
            }
          } catch (err) {
            alert('Import failed: ' + (err.message || 'Invalid JSON'));
          }
          e.target.value = '';
        };
        reader.readAsText(file);
      };

      const applyCrmDealToFields = (deal) => {
        setClientCompany(deal.company || 'Individual');
        setClientRep(deal.leadName);
        setProposalSponsor(deal.titleRole ? `${deal.leadName} (${deal.titleRole})` : deal.leadName);
      };

      const createWorkspaceFromCrmDeal = async (deal) => {
        const newId = `client-crm-${deal.id || Date.now()}`;
        const base = buildCurrentPayload();
        const suggestedPackage = EP?.resolvePackageFromCrmDeal?.(deal) || EP?.suggestPackageFromText?.(deal.notes || '') || 'leak-scan';
        const packageResult = STARTER_UI
          ? { tasks: [], defaults: {}, package: null }
          : H.applyPackageToTasks(suggestedPackage, INITIAL_TASKS.map(t => ({ ...t })), catalogTasksRef.current);
        const defs = packageResult.defaults || {};
        const isProductPkg = !STARTER_UI && EP?.isProductPackage?.(packageResult.package);
        const payload = {
          ...base,
          id: newId,
          workspaceName: `${deal.company || deal.leadName || 'CRM'} — New Deal`,
          clientCompany: deal.company || 'Individual',
          clientRep: deal.leadName,
          proposalSponsor: deal.titleRole ? `${deal.leadName} (${deal.titleRole})` : deal.leadName,
          quoteId: deal.id,
          tasks: packageResult.tasks,
          selectedPackageId: STARTER_UI ? 'custom' : suggestedPackage,
          packageCustomized: STARTER_UI ? true : false,
          packageAppliedAt: Date.now(),
          engagementType: isProductPkg ? 'product' : 'service',
          productId: isProductPkg ? (packageResult.package?.productId || defs.productId || null) : null,
          proposalObjectives: defs.proposalObjectives || base.proposalObjectives,
          printTimeline: defs.printTimeline ?? !isProductPkg,
          printSla: defs.printSla ?? (isProductPkg || false),
          links: {
            crmDealId: deal.id,
            portalClientId: deal.id,
            contractId: `contract-${newId}`,
          },
          updatedAt: Date.now()
        };
        if (isAuthed) {
          await window.firestoreSetDoc(window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', newId), payload);
          setActiveProfileId(newId);
          if (STARTER_UI) setView('sandbox');
        }
      };

      const handleCreateNewWorkspace = () => {
        const newId = `client-${Date.now()}`;
        const newClientObj = STARTER_UI ? buildNewAgencyWorkspace(newId) : {
          id: newId, clientCompany: 'New Workspace Corp.', clientRep: 'Representative Name', clientAddress: 'Registered Business Address',
          clientTin: '000-000-000-000', quoteId: `KC-${new Date().getFullYear()}-NEW`, quoteDate: getTodayDateString(), quoteValidity: '30 Days',
          staffCount: 15, monthlySalary: 25000, wastedHours: 2.0, annualOperationalLeakage: 1125000, includeTax: false, preparerTitle: 'Chief Operations Strategist', preparerTin: '337-945-806-000',
          targetStartDate: 'TBD', proposalObjectives: 'Deploy the Core Workspace application, digitize approval workflows, and establish managed IT infrastructure for your business.',
          proposalSponsor: 'Representative (Director)', preDiagnosticList: "• Standard active staff directory\n• Samples of current invoices and transaction flows",
          frictionBuffer: 10, principalToSeniorDelegate: 20, seniorToAssociateDelegate: 40, overrideTimeline: '', weeklyHours: 16, clientReviewWeeks: 1,
          discountPercent: 0, dpaRetentionDays: 14, slaCureDays: 30, slaRecurrenceMonths: 3, subscriptionMonths: 6,
          slaContent: '',
          printSow: true, printTimeline: true, printSla: true, printQuote: true, printCover: false,
          milestoneSplit: 'auto', customSplit1: 40, customSplit2: 40, customSplit3: 20, ndaEffectiveDate: getTodayDateString(), ndaPurpose: 'Analyzing current process layouts, standardizing operational guidelines, and auditing software billing assets.',
          ndaTerm: '5 (Five) Years', ndaJurisdiction: 'Taytay, Rizal, Philippines', invoiceMilestone: 'full', customInvoiceAmount: 100000,
          invoiceNumberSuffix: '01', invoiceDueDate: '', tasks: INITIAL_TASKS.map(t => ({ ...t, selected: defaultMod1Selected(t) })),
          selectedPackageId: 'leak-scan', packageCustomized: false, packageAppliedAt: Date.now(),
          ...H.DEFAULT_RATES, updatedAt: Date.now()
        };
        const docRef = window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', newId);
        window.firestoreSetDoc(docRef, newClientObj).then(() => {
          setActiveProfileId(newId);
          setView(STARTER_UI ? 'sandbox' : 'packages');
        });
      };

      const handleCloneCurrentWorkspace = () => {
        const newId = `client-clone-${Date.now()}`;
        const cloneObj = { 
          ...buildCurrentPayload(), 
          id: newId, 
          workspaceName: `${getWorkspaceLabel(activeProfile)} (Clone)`,
          quoteId: `${activeProfile.quoteId}-CLONE`,
          updatedAt: Date.now()
        };
        const docRef = window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', newId);
        window.firestoreSetDoc(docRef, cloneObj).then(() => setActiveProfileId(newId));
      };

      const executeDeleteWorkspace = async () => {
        if (profiles.length <= 1) { setShowDeleteConfirm(false); return; }
        const nextProfiles = profiles.filter(p => p.id !== activeProfileId);
        const docRef = window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', activeProfileId);
        await window.firestoreDeleteDoc(docRef);
        setActiveProfileId(nextProfiles[0].id);
        setShowDeleteConfirm(false);
      };

      const openRenameWorkspace = () => {
        setRenameWorkspaceValue(getWorkspaceLabel(activeProfile));
        setShowRenameWorkspace(true);
      };

      const executeRenameWorkspace = async () => {
        const trimmedName = renameWorkspaceValue.trim();
        if (!trimmedName || !isAuthed) { setShowRenameWorkspace(false); return; }
        setIsSaving(true);
        try {
          const currentProfilePayload = { ...buildCurrentPayload(), workspaceName: trimmedName };
          const docRef = window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'workbook_profiles', activeProfileId);
          await window.firestoreSetDoc(docRef, currentProfilePayload, { merge: true });
          setProfiles(prev => prev.map(p => p.id === activeProfileId ? { ...p, workspaceName: trimmedName, updatedAt: currentProfilePayload.updatedAt } : p));
          syncSavedFingerprint(H.payloadFingerprint(currentProfilePayload));
          setSaveStatus('saved');
          H.clearLocalDraft(activeProfileId);
        } catch (e) {
          console.error("Error renaming workspace:", e);
          setSaveStatus('error');
          setSaveError(e.message || 'Rename save failed');
        }
        setShowRenameWorkspace(false);
        setTimeout(() => setIsSaving(false), 800);
      };

      const handleImportFromCRM = (e) => {
        const dealId = e.target.value;
        if (!dealId) return;
        const deal = crmDeals.find(d => d.id === dealId);
        if (deal) {
          setPendingCrmDeal(deal);
          setShowCrmImportModal(true);
        }
        e.target.value = "";
      };

      useEffect(() => {
        if (isHydratingRef.current) return;
        setActivePresets(H.deriveActivePresetsFromTasks(tasks));
      }, [tasks]);

      const activeDiag = useMemo(() => tasks.some(t => H.isModCategory(t, 1) && t.selected), [tasks]);
      const activeSOP = useMemo(() => tasks.some(t => H.isModCategory(t, 2) && t.selected), [tasks]);
      const activePMO = useMemo(() => tasks.some(t => H.isModCategory(t, 3) && t.selected), [tasks]);
      const activeGov = useMemo(() => tasks.some(t => H.isModCategory(t, 4) && t.selected), [tasks]);
      const isProEngagement = useMemo(() => engagementType === 'product' && Boolean(productId), [engagementType, productId]);
      const proProductMeta = useMemo(() => (isProEngagement ? PC?.getProductById?.(productId) : null), [isProEngagement, productId]);
      
      const handlePrint = () => {
        const validation = H.validatePrintReadiness(view, {
          clientCompany, clientRep, clientAddress, clientTin,
          useCustomInvoiceBillTo, invoiceBillToCompany, invoiceBillToRep, invoiceBillToAddress, invoiceBillToTin,
          invoicePartySource,
          useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin, contractPartySource,
          invoiceDueDate: view === 'addendum' ? (activeAddendum?.invoiceDueDate || '') : (view === 'invoice' && isAddendumInvoiceMode ? (invoiceTargetAddendum?.invoiceDueDate || '') : invoiceDueDate),
          ndaEffectiveDate, tasks,
          printSow, printTimeline, printSla, printQuote, activePMO, activeGov, printCover,
          validateTIN: validatePhilippineTIN,
          activeAddendum,
          invoiceTargetAddendum: view === 'invoice' && isAddendumInvoiceMode ? invoiceTargetAddendum : null,
        });
        if (!validation.ok || validation.warnings.length > 0) {
          setPrintValidationIssues(validation.issues);
          setPrintValidationWarnings(validation.warnings);
          setShowPrintValidation(true);
          return;
        }
        if (view === 'addendum' && activeAddendum && activeAddendum.status === 'draft') {
          patchActiveAddendum({ status: 'issued', issuedAt: Date.now() });
        }
        setPrintDocumentTitle();
        window.print();
      };

      const proceedPrintDespiteWarnings = () => {
        setShowPrintValidation(false);
        if (view === 'addendum' && activeAddendum && activeAddendum.status === 'draft') {
          patchActiveAddendum({ status: 'issued', issuedAt: Date.now() });
        }
        setPrintDocumentTitle();
        window.print();
      };

      const showIssueToast = (msg) => {
        setIssueInvoiceToast(msg);
        setTimeout(() => setIssueInvoiceToast(null), 4000);
      };

      const handleIssueInvoice = async () => {
        if (!isAuthed || view !== 'invoice') return;
        const isAddendumInvoice = Boolean(invoiceTargetAddendum);
        const validation = H.validatePrintReadiness('invoice', {
          clientCompany, clientRep, clientAddress, clientTin,
          useCustomInvoiceBillTo, invoiceBillToCompany, invoiceBillToRep, invoiceBillToAddress, invoiceBillToTin,
          invoicePartySource,
          useCustomSponsor, sponsorCompany, sponsorRep, sponsorAddress, sponsorTin, contractPartySource,
          invoiceDueDate: isAddendumInvoice ? (invoiceTargetAddendum?.invoiceDueDate || '') : invoiceDueDate,
          ndaEffectiveDate, tasks,
          printSow, printTimeline, printSla, printQuote, activePMO, activeGov, printCover,
          validateTIN: validatePhilippineTIN,
          invoiceTargetAddendum: isAddendumInvoice ? invoiceTargetAddendum : null,
          issueInvoice: true,
        });
        if (!validation.ok) {
          setPrintValidationIssues(validation.issues);
          setPrintValidationWarnings(validation.warnings);
          setShowPrintValidation(true);
          return;
        }

        const IH = window.InvoiceHelpers;
        if (!IH) {
          showIssueToast('Invoice module failed to load — hard refresh.');
          return;
        }

        if (!isAddendumInvoice && invoiceMilestone === 'retainer_monthly' && retainerCostBase <= 0) {
          showIssueToast(`Select ${modTitle(4)} retainer tasks in the Planner tab before issuing a monthly invoice.`);
          return;
        }

        if (!isAddendumInvoice && invoiceMilestone === 'retainer_monthly' && !retainerBillingPeriod) {
          showIssueToast('Choose a billing month for the monthly retainer invoice.');
          return;
        }

        setIsIssuingInvoice(true);
        try {
          await H.ensurePortalSync();
          if (isAddendumInvoice) await H.ensureAddendumModules();
          const profilePayload = buildCurrentPayload();
          const billingPeriod = !isAddendumInvoice && invoiceMilestone === 'retainer_monthly'
            ? (retainerBillingPeriod || window.InvoiceHelpers?.currentBillingPeriod?.() || '')
            : null;

          let amounts;
          let milestoneLabel;
          let milestoneKey;
          let suffix;
          let dueDate;

          if (isAddendumInvoice && invoiceTargetAddendum && invoiceTargetEconomics) {
            milestoneKey = invoiceTargetAddendum.invoiceMilestone || 'full';
            suffix = invoiceTargetAddendum.invoiceNumberSuffix || invoiceTargetAddendum.suffix;
            dueDate = invoiceTargetAddendum.invoiceDueDate || '';
            amounts = IH.computeInvoiceAmounts({
              invoiceMilestone: milestoneKey,
              customInvoiceAmount: invoiceTargetAddendum.customInvoiceAmount || 0,
              billingMilestones: invoiceTargetEconomics.billingMilestones || [],
              finalProjectCostBase: invoiceTargetEconomics.finalProjectCostBase,
              retainerCostBase: invoiceTargetEconomics.retainerCostBase,
              retainerCostTotalBase: invoiceTargetEconomics.retainerCostTotalBase,
              includeTax,
            });
            milestoneLabel = IH.resolveMilestoneLabel(milestoneKey, invoiceTargetEconomics.billingMilestones, {
              isAddendum: true,
              addendumTitle: invoiceTargetAddendum.title,
            });
          } else {
            amounts = IH.computeInvoiceAmounts({
              invoiceMilestone,
              customInvoiceAmount,
              billingMilestones,
              finalProjectCostBase,
              retainerCostBase,
              retainerCostTotalBase,
              includeTax,
            });
            milestoneLabel = IH.resolveMilestoneLabel(invoiceMilestone, billingMilestones, { billingPeriod });
            milestoneKey = invoiceMilestone;
            suffix = invoiceNumberSuffix;
            dueDate = invoiceDueDate;
          }

          const portalAccessCode = window.PortalSync?.resolvePortalAccessCode?.(profilePayload) || quoteId || null;

          const invoice = IH.buildInvoiceRecord({
            profileId: activeProfileId,
            profile: {
              ...profilePayload,
              quoteId,
              clientCompany: resolvedInvoiceBillTo.company || clientCompany,
              clientRep: resolvedInvoiceBillTo.rep || clientRep,
              includeTax,
            },
            invoiceMilestone: milestoneKey,
            invoiceNumberSuffix: suffix,
            invoiceDueDate: dueDate,
            issueDate: quoteDate,
            amounts,
            milestoneLabel,
            portalAccessCode,
            status: 'sent',
            billingPeriod,
            addendumId: isAddendumInvoice ? invoiceTargetAddendum?.id : null,
            addendumRef: isAddendumInvoice ? invoiceTargetAddendum?.ref : null,
          });

          const docRef = window.firestoreDoc(window.firebaseDb, 'artifacts', window.appId, 'public', 'data', 'invoices', invoice.id);
          await window.firestoreSetDoc(docRef, invoice);

          if (isAddendumInvoice && invoiceTargetAddendum) {
            setAddenda((prev) => H.updateAddendumInList(prev, invoiceTargetAddendum.id, {
              status: 'invoiced',
              issuedAt: invoiceTargetAddendum.issuedAt || Date.now(),
            }));
          }

          if (portalAccessCode && window.PortalSync?.syncInvoicesToPortal) {
            try {
              await window.PortalSync.syncInvoicesToPortal(portalAccessCode);
            } catch (portalErr) {
              console.warn('Portal billing sync skipped:', portalErr);
            }
          }

          showIssueToast(`Invoice ${invoice.invoiceNumber} issued and saved.`);
        } catch (err) {
          console.error('Issue invoice failed:', err);
          showIssueToast(err.message || 'Failed to issue invoice.');
        } finally {
          setIsIssuingInvoice(false);
        }
      };

      const toggleTask = (id) => { setPackageCustomized(true); setTasks(prev => prev.map(t => t.id === id ? { ...t, selected: !t.selected } : t)); };
      const updateTaskHours = (id, value) => { setPackageCustomized(true); setTasks(prev => prev.map(t => t.id === id ? { ...t, estHours: Math.max(0, Number(value) || 0) } : t)); };
      const validateTaskHoursOnBlur = (id, selected) => {
        if (!selected) return;
        setTasks(prev => prev.map(t => {
          if (t.id !== id) return t;
          const hours = Number(t.estHours);
          if (!Number.isFinite(hours) || hours < 1) return { ...t, estHours: 1 };
          return { ...t, estHours: Math.round(hours) };
        }));
      };
      const updateTaskTier = (id, tier) => { setPackageCustomized(true); setTasks(prev => prev.map(t => t.id === id ? { ...t, tier: tier } : t)); };
      const updateTaskDeliverable = (id, value) => { setPackageCustomized(true); setTasks(prev => prev.map(t => t.id === id ? { ...t, deliverable: value } : t)); };
      const updateTaskDescription = (id, value) => { setPackageCustomized(true); setTasks(prev => prev.map(t => t.id === id ? { ...t, description: value } : t)); };
      const updateTaskLineField = (id, field, rawValue) => {
        setPackageCustomized(true);
        setTasks(prev => prev.map(t => {
          if (t.id !== id) return t;
          if (field === 'lineUnit' || field === 'deliverable') return { ...t, [field]: rawValue };
          const num = Math.max(0, Number(rawValue) || 0);
          return { ...t, [field]: num };
        }));
      };
      const updateTaskModuleKey = (id, modKey) => {
        setPackageCustomized(true);
        const label = moduleBundleNames[modKey] || modTitle(Number(String(modKey).replace('mod', '')));
        setTasks(prev => prev.map(t => t.id === id ? { ...t, moduleKey: modKey, category: H.agencyModCategory(modKey, label) } : t));
      };
      const renameModuleBundle = (modKey, label) => {
        setPackageCustomized(true);
        setModuleBundleNames(prev => ({ ...prev, [modKey]: label }));
        setTasks(prev => prev.map(t => t.moduleKey === modKey ? { ...t, category: H.agencyModCategory(modKey, label) } : t));
      };
      const removeTask = (id) => { setPackageCustomized(true); setTasks(prev => prev.filter(t => t.id !== id)); };

      const reorderTasks = (fromId, toId) => {
        if (!fromId || !toId || fromId === toId) return;
        setTasks(prev => {
          const fromIdx = prev.findIndex(t => t.id === fromId);
          const toIdx = prev.findIndex(t => t.id === toId);
          if (fromIdx < 0 || toIdx < 0) return prev;
          const next = [...prev];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);
          return next;
        });
      };

      const moveTaskByOffset = (id, offset) => {
        setTasks(prev => {
          const idx = prev.findIndex(t => t.id === id);
          const newIdx = idx + offset;
          if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
          const next = [...prev];
          const [moved] = next.splice(idx, 1);
          next.splice(newIdx, 0, moved);
          return next;
        });
      };

      const handleTaskDragStart = (taskId) => setDragTaskId(taskId);
      const handleTaskDragOver = (e) => e.preventDefault();
      const handleTaskDrop = (targetTaskId) => {
        if (dragTaskId) reorderTasks(dragTaskId, targetTaskId);
        setDragTaskId(null);
      };

      const addNewTask = (e) => {
        e.preventDefault();
        if (STARTER_UI) {
          if (!newTaskDeliv.trim()) return;
          const modKey = newLineModuleKey || 'mod1';
          const label = moduleBundleNames[modKey] || modTitle(Number(String(modKey).replace('mod', '')));
          const lineTask = {
            id: `line-${Date.now()}`,
            moduleKey: modKey,
            category: H.agencyModCategory(modKey, label),
            deliverable: newTaskDeliv.trim(),
            description: newTaskDesc || '',
            selected: true,
            lineQty: Math.max(0, Number(newLineQty) || 0),
            lineDuration: Math.max(0, Number(newLineDuration) || 0),
            lineUnitPrice: Math.max(0, Number(newLineUnitPrice) || 0),
            lineUnit: newLineUnit || 'per hour',
            lineMarkUp: Math.max(0, Number(newLineMarkUp) || 0),
            estHours: Math.max(1, Math.round((Number(newLineQty) || 1) * (Number(newLineDuration) || 1))),
            tier: 'senior',
          };
          setPackageCustomized(true);
          setTasks(prev => [...prev, lineTask]);
          setNewTaskDeliv('');
          setNewTaskDesc('');
          setNewLineQty('1');
          setNewLineDuration('1');
          setNewLineUnitPrice('');
          setNewLineMarkUp('33.3');
          return;
        }
        if (!newTaskDeliv) return;
        const baseHours = Number(newTaskHours) || 0;
        const multiplier = Number(newTaskMultiplier) / 100;
        const calculatedHours = Math.round(baseHours * (1 + multiplier));

        const customTaskObj = {
          id: `custom-${Date.now()}`, category: newTaskCategory, deliverable: newTaskDeliv, description: newTaskDesc || 'Bespoke operational assistance step.',
          estHours: calculatedHours, tier: newTaskTier, selected: true, isMonthlyRetainer: H.isModCategory(newTaskCategory, 4),
          scopeDetails: { activities: newTaskActivities || "Work closely with your team to review and complete planned milestone tasks.", expectations: "Provide basic information access and honest feedback on drafted guidelines.", output: "A completed SOW deliverable asset aligned with custom specifications." }
        };
        setPackageCustomized(true);
        setTasks(prev => [...prev, customTaskObj]);
        setNewTaskDeliv(''); setNewTaskDesc(''); setNewTaskHours(''); setNewTaskMultiplier(0); setNewTaskTier('associate'); setNewTaskActivities(''); setNewTaskExpectations(''); setNewTaskOutput('');
      };

      const executeApplyPackage = useCallback((packageId) => {
        const result = H.applyPackageToTasks(packageId, tasks, catalogTasksRef.current);
        if (!result.package) return;
        const defs = result.defaults || {};
        setTasks(result.tasks);
        setActivePresets(result.activePresets);
        setSelectedPackageId(packageId);
        setPackageCustomized(false);
        setPackageAppliedAt(Date.now());
        if (defs.proposalObjectives) setProposalObjectives(defs.proposalObjectives);
        if (defs.frictionBuffer !== undefined) setFrictionBuffer(defs.frictionBuffer);
        if (defs.discountPercent !== undefined) setDiscountPercent(defs.discountPercent);
        if (defs.milestoneSplit) setMilestoneSplit(defs.milestoneSplit);
        if (defs.subscriptionMonths !== undefined) setSubscriptionMonths(defs.subscriptionMonths);
        if (defs.printTimeline !== undefined) setPrintTimeline(defs.printTimeline);
        if (defs.printSla !== undefined) setPrintSla(defs.printSla);
        const isProductPkg = EP?.isProductPackage?.(result.package);
        setEngagementType(isProductPkg ? 'product' : 'service');
        setProductId(isProductPkg ? (result.package?.productId || defs.productId || null) : null);
        setView('sandbox');
      }, [tasks]);

      const requestApplyPackage = useCallback((packageId) => {
        if (packageCustomized || tasks.some(t => t.id.startsWith('custom-'))) {
          setPendingPackageId(packageId);
          setShowPackageApplyConfirm(true);
          return;
        }
        executeApplyPackage(packageId);
      }, [packageCustomized, tasks, executeApplyPackage]);

      const packagePreviewEconomics = useCallback((packageId) => {
        const previewTasks = H.previewPackageSelection(packageId, tasks, catalogTasksRef.current);
        const pkgDefaults = H.packagePreviewDefaults(packageId);
        return H.computeProjectEconomics({
          tasks: previewTasks,
          frictionBuffer: pkgDefaults.frictionBuffer ?? frictionBuffer,
          discountPercent: pkgDefaults.discountPercent ?? discountPercent,
          includeTax,
          subscriptionMonths: pkgDefaults.subscriptionMonths ?? subscriptionMonths,
          milestoneSplit,
          customSplit1,
          customSplit2,
          customSplit3,
          rates: hourlyRates,
          principalToSeniorDelegate,
          seniorToAssociateDelegate,
          recoveryPotential,
          staffCount,
          monthlySalary,
          wastedHours,
          formatCurrency
        });
      }, [tasks, frictionBuffer, discountPercent, includeTax, subscriptionMonths, milestoneSplit, customSplit1, customSplit2, customSplit3, hourlyRates, principalToSeniorDelegate, seniorToAssociateDelegate, recoveryPotential, staffCount, monthlySalary, wastedHours]);

      const activePackageMeta = useMemo(() => {
        if (!EP?.getPackageById) return null;
        return selectedPackageId ? EP.getPackageById(selectedPackageId) : null;
      }, [selectedPackageId]);

      const handleTogglePreset = (presetName) => {
        setPackageCustomized(true);
        const updatedPresets = activePresets.includes(presetName) ? activePresets.filter(p => p !== presetName) : [...activePresets, presetName];
        setActivePresets(updatedPresets);
        const categoryToPreset = H.CATEGORY_TO_PRESET;
        setTasks(prev => prev.map(t => {
          const presetForTask = H.presetForTask(t);
          return { ...t, selected: presetForTask ? updatedPresets.includes(presetForTask) : t.selected };
        }));
      };

      const handleSelectAllPresets = () => { setPackageCustomized(true); setActivePresets(['mod1', 'mod2', 'mod3', 'mod4']); setTasks(prev => prev.map(t => ({ ...t, selected: true }))); };
      const handleClearAllPresets = () => { setPackageCustomized(true); setActivePresets([]); setTasks(prev => prev.map(t => ({ ...t, selected: false }))); };

      const scheduledTasksAndPhases = useMemo(() => {
        const selected = tasks.filter(t => t.selected);
        if (selected.length === 0) return { items: [], scheduledP1: [], scheduledP2: [], scheduledP3: [], scheduledP4: [] };
        
        const bufferMultiplier = 1 + (frictionBuffer / 100);
        let currentWeek = 1;
        
        const p1Tasks = selected.filter(t => H.isModCategory(t, 1));
        const p2Tasks = selected.filter(t => H.isModCategory(t, 2));
        const p3Tasks = selected.filter(t => H.isModCategory(t, 3));
        const p4Tasks = selected.filter(t => H.isModCategory(t, 4));

        const activePhases = [];
        if (p1Tasks.length) activePhases.push(p1Tasks);
        if (p2Tasks.length) activePhases.push(p2Tasks);
        if (p3Tasks.length) activePhases.push(p3Tasks);

        const schedulePhase = (tasksList, isLastPhase) => {
          if (tasksList.length === 0) return [];
          let currentCumulativeHours = 0;
          
          const scheduled = tasksList.map(task => {
            const bufferedHours = Math.round(task.estHours * bufferMultiplier);
            const taskStartWeek = currentWeek + Math.floor(currentCumulativeHours / weeklyHours);
            const endHour = currentCumulativeHours + Math.max(1, bufferedHours);
            const taskEndWeek = currentWeek + Math.floor((endHour - 0.1) / weeklyHours);
            
            currentCumulativeHours += bufferedHours;

            return { 
              ...task, 
              bufferedHours, 
              startWeek: taskStartWeek, 
              endWeek: Math.max(taskStartWeek, taskEndWeek),
              isRetainer: false 
            };
          });

          const totalWeeksForGroup = Math.ceil(currentCumulativeHours / weeklyHours) || 1;
          currentWeek += totalWeeksForGroup;
          
          if (!isLastPhase) {
            currentWeek += clientReviewWeeks;
          }
          
          return scheduled;
        };

        const scheduledP1 = p1Tasks.length ? schedulePhase(p1Tasks, activePhases.indexOf(p1Tasks) === activePhases.length - 1) : [];
        const scheduledP2 = p2Tasks.length ? schedulePhase(p2Tasks, activePhases.indexOf(p2Tasks) === activePhases.length - 1) : [];
        const scheduledP3 = p3Tasks.length ? schedulePhase(p3Tasks, activePhases.indexOf(p3Tasks) === activePhases.length - 1) : [];

        // Calculation Correction: Dynamically schedule Module 4 strictly after preceding project scopes complete
        const maxProjectEndWeek = Math.max(
          ...scheduledP1.map(t => t.endWeek),
          ...scheduledP2.map(t => t.endWeek),
          ...scheduledP3.map(t => t.endWeek),
          0
        );
        const p4StartWeek = maxProjectEndWeek > 0 ? maxProjectEndWeek + 1 : 1;

        const scheduledP4 = p4Tasks.map(task => ({
          ...task,
          bufferedHours: Math.round(task.estHours * bufferMultiplier),
          startWeek: p4StartWeek,
          endWeek: task.isMonthlyRetainer ? null : p4StartWeek,
          isRetainer: !!task.isMonthlyRetainer
        }));

        return {
          items: [...scheduledP1, ...scheduledP2, ...scheduledP3, ...scheduledP4],
          scheduledP1, scheduledP2, scheduledP3, scheduledP4
        };
      }, [tasks, frictionBuffer, weeklyHours, clientReviewWeeks]);

      const scheduledTasks = scheduledTasksAndPhases.items;

      const maxWeek = useMemo(() => {
        const projectTasks = scheduledTasks.filter(t => !t.isRetainer);
        const hasRetainers = scheduledTasks.some(t => t.isRetainer);
        if (projectTasks.length === 0) return 4;
        const maxProj = Math.max(...projectTasks.map(t => t.endWeek));
        // Extend Gantt view bounds by 4 weeks to display ongoing retainer tasks elegantly
        return hasRetainers ? maxProj + 4 : maxProj;
      }, [scheduledTasks]);

      const calculatedTimeline = useMemo(() => {
        const selectedTasks = tasks.filter(t => t.selected);
        if (selectedTasks.length === 0) return "N/A";
        const projectTasks = scheduledTasks.filter(t => !t.isRetainer);
        
        let timelineStr = "";
        if (projectTasks.length > 0) {
          const ceilingWeeks = Math.max(...projectTasks.map(t => t.endWeek));
          if (ceilingWeeks <= 1) timelineStr = "1 - 2 Weeks"; 
          else if (ceilingWeeks <= 2) timelineStr = "2 - 3 Weeks";
          else timelineStr = `${ceilingWeeks - 1} - ${ceilingWeeks} Weeks`;
        }
        const retainerTasks = selectedTasks.filter(t => t.isMonthlyRetainer);
        return retainerTasks.length > 0 ? (projectTasks.length > 0 ? `${timelineStr} + ${modTitle(4)}` : modTitle(4)) : timelineStr;
      }, [tasks, scheduledTasks]);

      const displayTimeline = useMemo(() => overrideTimeline || calculatedTimeline, [overrideTimeline, calculatedTimeline]);

      const pricing = useMemo(() => H.computeProjectEconomics({
        tasks, frictionBuffer, discountPercent, includeTax, subscriptionMonths,
        milestoneSplit, customSplit1, customSplit2, customSplit3,
        rates: hourlyRates, principalToSeniorDelegate, seniorToAssociateDelegate,
        recoveryPotential, staffCount, monthlySalary, wastedHours, formatCurrency,
        starterLineItems: STARTER_UI,
        moduleBundleNames,
      }), [tasks, frictionBuffer, discountPercent, includeTax, subscriptionMonths, milestoneSplit, customSplit1, customSplit2, customSplit3, hourlyRates, principalToSeniorDelegate, seniorToAssociateDelegate, recoveryPotential, staffCount, monthlySalary, wastedHours, moduleBundleNames]);

      const sharedProfileForBilling = useMemo(() => ({
        tasks, frictionBuffer, discountPercent, includeTax, subscriptionMonths,
        milestoneSplit, customSplit1, customSplit2, customSplit3,
        principalRate: hourlyRates.principalRate,
        seniorRate: hourlyRates.seniorRate,
        associateRate: hourlyRates.associateRate,
        partnerRate: hourlyRates.partnerRate,
      }), [tasks, frictionBuffer, discountPercent, includeTax, subscriptionMonths, milestoneSplit, customSplit1, customSplit2, customSplit3, hourlyRates]);

      const sharedBillingSchedule = useMemo(() => {
        const SF = window.SharedFinancials;
        return SF?.getBillingSchedule ? SF.getBillingSchedule(sharedProfileForBilling) : null;
      }, [sharedProfileForBilling]);

      const sharedModuleSummaries = useMemo(() => {
        const SF = window.SharedFinancials;
        return SF?.computeModuleInvestmentSummaries ? SF.computeModuleInvestmentSummaries(sharedProfileForBilling) : null;
      }, [sharedProfileForBilling]);

      const {
        projectCostBaseUndiscounted,
        retainerCostBaseUndiscounted,
        projectCostBase,
        finalProjectCostBase,
        retainerCostBase,
        finalProjectCostPart,
        retainerCostPart: plannerRetainerCostPart,
        retainerCostTotalBaseUndiscounted,
        retainerCostTotalBase,
        retainerCostTotalPart: plannerRetainerCostTotalPart,
        updatedSummary,
        billingMilestones: plannerBillingMilestones,
        moduleInvestmentSummaries: plannerModuleSummaries
      } = pricing;

      const usePlannerLineItemBilling = STARTER_UI || tasks.some(H.isAgencyLineItem);
      const billingMilestones = (
        usePlannerLineItemBilling
          ? plannerBillingMilestones
          : (sharedBillingSchedule?.milestones?.length ? sharedBillingSchedule.milestones : plannerBillingMilestones)
      ) ?? [];
      const moduleInvestmentSummaries = (
        usePlannerLineItemBilling
          ? plannerModuleSummaries
          : (sharedModuleSummaries?.length ? sharedModuleSummaries : plannerModuleSummaries)
      ) ?? [];
      const retainerCostPart = sharedBillingSchedule?.retainerMonthly || plannerRetainerCostPart;
      const retainerCostTotalPart = sharedBillingSchedule?.retainerTotal || plannerRetainerCostTotalPart;

      const packageSectionCount = useMemo(() => {
        let count = 0;
        if (printCover) count += 1;
        if (printSow) count += 1;
        if (printTimeline) count += 1;
        if (printSla) count += 1;
        if (printQuote) count += 1;
        return count;
      }, [printCover, printSow, printTimeline, printSla, printQuote]);

      const setPrintDocumentTitle = () => {
        const slug = (clientCompany || 'Proposal').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
        const docPrefix = STARTER_UI ? (issuerCompanyName || 'Proposal') : 'Kolthoff';
        if (view === 'addendum' && activeAddendum) {
          document.title = `${docPrefix}-Addendum-${activeAddendum.ref}-${slug}`;
          return;
        }
        document.title = `${docPrefix}-SOW-${quoteId}-${slug}`;
      };

      const computedInvoiceCost = useMemo(() => {
        const milestone = isAddendumInvoiceMode
          ? (invoiceTargetAddendum?.invoiceMilestone || 'full')
          : invoiceMilestone;
        const milestones = isAddendumInvoiceMode
          ? (invoiceTargetEconomics?.billingMilestones || [])
          : billingMilestones;
        const projectBase = isAddendumInvoiceMode
          ? (invoiceTargetEconomics?.finalProjectCostBase || 0)
          : finalProjectCostBase;
        const retainerBase = isAddendumInvoiceMode
          ? (invoiceTargetEconomics?.retainerCostBase || 0)
          : retainerCostBase;
        const retainerTotalBase = isAddendumInvoiceMode
          ? (invoiceTargetEconomics?.retainerCostTotalBase || 0)
          : retainerCostTotalBase;
        const customAmount = isAddendumInvoiceMode
          ? (invoiceTargetAddendum?.customInvoiceAmount || 0)
          : customInvoiceAmount;

        let baseAmount = 0;
        if (milestone === 'full') baseAmount = projectBase + retainerTotalBase;
        else if (milestone.startsWith('milestone_')) {
          const idx = parseInt(milestone.split('_')[1], 10);
          if (milestones[idx]) baseAmount = includeTax ? Math.round(milestones[idx].amount / 1.12) : milestones[idx].amount;
        }
        else if (milestone === 'retainer_monthly') baseAmount = retainerBase;
        else if (milestone === 'retainer') baseAmount = retainerTotalBase;
        else if (milestone === 'custom') baseAmount = customAmount;

        return {
          baseAmount,
          vatAmount: includeTax ? Math.round(baseAmount * 0.12) : 0,
          totalAmount: baseAmount + (includeTax ? Math.round(baseAmount * 0.12) : 0),
        };
      }, [isAddendumInvoiceMode, invoiceTargetAddendum, invoiceTargetEconomics, invoiceMilestone, finalProjectCostBase, retainerCostBase, retainerCostTotalBase, billingMilestones, customInvoiceAmount, includeTax]);

      const previewInvoiceSuffix = isAddendumInvoiceMode
        ? (invoiceTargetAddendum?.invoiceNumberSuffix || invoiceTargetAddendum?.suffix || '01')
        : invoiceNumberSuffix;
      const previewInvoiceDueDate = isAddendumInvoiceMode
        ? (invoiceTargetAddendum?.invoiceDueDate || '')
        : invoiceDueDate;

      const computedInvoiceCostUndiscounted = useMemo(() => {
        if (invoiceMilestone === 'full') return projectCostBaseUndiscounted + retainerCostTotalBaseUndiscounted;
        if (invoiceMilestone === 'retainer') return retainerCostTotalBaseUndiscounted;
        if (invoiceMilestone === 'retainer_monthly') return retainerCostBaseUndiscounted;
        return computedInvoiceCost.baseAmount;
      }, [invoiceMilestone, projectCostBaseUndiscounted, retainerCostTotalBaseUndiscounted, retainerCostBaseUndiscounted, computedInvoiceCost]);

      useEffect(() => {
        const milestoneCount = billingMilestones?.length ?? 0;
        if (invoiceMilestone.startsWith('milestone_') && parseInt(invoiceMilestone.split('_')[1], 10) >= milestoneCount) {
          setInvoiceMilestone('full');
        }
      }, [billingMilestones, invoiceMilestone]);

      const resolvedSlaContent = useMemo(() => (
        H.resolveAgencySlaTemplate?.(slaContent, {
          agencyName: issuerCompanyName,
          clientName: resolvedClientParty.company,
          clientRep: resolvedClientParty.rep,
        }) || ''
      ), [slaContent, issuerCompanyName, resolvedClientParty]);

      const applyClientPdfPreset = () => {
        setPrintCover(true);
        setPrintSow(true);
        setPrintQuote(true);
        setPrintTimeline(isProEngagement ? false : (tasks.some(t => H.isModCategory(t, 2) && t.selected) || tasks.some(t => H.isModCategory(t, 3) && t.selected)));
        setPrintSla(STARTER_UI ? true : (activePMO || activeGov || isProEngagement));
        setPrintRoadmapGantt(true);
        setPrintRoadmapTable(true);
        setPrintRoadmapScale(true);
      };

      const applyFullPdfPreset = () => {
        setPrintCover(false);
        setPrintSow(true);
        setPrintTimeline(isProEngagement ? false : true);
        setPrintQuote(true);
        setPrintSla(STARTER_UI ? true : (activePMO || activeGov || isProEngagement));
        setPrintRoadmapGantt(true);
        setPrintRoadmapTable(true);
        setPrintRoadmapScale(true);
      };

      const renderPrintFooter = (sectionLabel, sectionIndex, totalSections) => (
        <div className="print-page-footer font-mono uppercase tracking-wider">
          <span>{quoteId} · {sectionLabel}</span>
          <span>Section {sectionIndex} of {totalSections} · {issuerCompanyName} · Confidential</span>
        </div>
      );

      const renderCoverPage = () => (
        <div className="text-left font-sans space-y-8 min-h-[70vh] flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {renderPrintBrandLogo(brand)}
              <div>
                <h1 className="text-2xl font-serif font-bold text-slate-900">Statement of Work Package</h1>
                <p className="text-sm text-slate-500 font-mono mt-1">{quoteId} · Valid until {quoteValidity}</p>
                {STARTER_UI && issuerTagline ? (
                  <p className="text-xs text-slate-500 mt-1">{issuerTagline}</p>
                ) : null}
              </div>
            </div>
            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 print-pill space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">Prepared for</span>
              <div className="text-lg font-bold text-slate-900">{resolvedClientParty.company || 'Client Company'}</div>
              <div className="text-sm text-slate-600">{resolvedClientParty.rep || 'Representative'}</div>
              {resolvedClientParty.address && <div className="text-xs text-slate-500">{resolvedClientParty.address}</div>}
              {resolvedClientParty.tin && <div className="text-xs font-mono text-slate-500">TIN: {resolvedClientParty.tin}</div>}
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-2">Package contents</span>
              <ul className="text-xs space-y-1 text-slate-700">
                {printSow && <li>✓ Scope &amp; Project Proposal</li>}
                {printQuote && <li>✓ Official Price Quotation &amp; Terms</li>}
                {printTimeline && <li>✓ Implementation Timeline</li>}
                {printSla && <li>✓ Service Level Agreement</li>}
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-200 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">Total project investment</span>
              <span className="text-2xl font-serif font-black text-brandTeal-600 print-accent">{formatCurrency(updatedSummary.totalCost)}</span>
              {includeTax && <span className="text-[10px] text-slate-500 block mt-1">Includes 12% VAT</span>}
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block mb-1">Target timeline</span>
              <span className="text-sm font-bold text-slate-900">{displayTimeline}</span>
            </div>
          </div>
        </div>
      );

      const renderSowAcceptanceMini = () => (
        <div className="mt-8 pt-6 border-t border-slate-200 print-avoid-break text-xs font-sans">
          <p className="text-slate-600 mb-4">By signing below, the client acknowledges receipt of this scope proposal. Binding commercial terms and payment appear on the Official Price Quotation page of this package.</p>
          <div className="grid grid-cols-2 gap-12">
            <div>
              <p className="font-bold text-slate-700 mb-8">Client acknowledgment</p>
              <div className="border-t border-slate-300 pt-2">
                <div className="font-bold text-slate-900">{resolvedClientParty.rep || '________________________'}</div>
                <div className="text-slate-500">{resolvedClientParty.company || '________________________'}</div>
                <div className="text-slate-400 mt-1">Date: ________________________</div>
              </div>
            </div>
            <div>
              <p className="font-bold text-slate-700 mb-8">Prepared by</p>
              <div className="border-t border-slate-300 pt-2">
                <div className="font-bold text-slate-900">{issuerLegalName}</div>
                <div className="text-slate-500">{STARTER_UI ? preparerTitle : `${preparerTitle}, Kolthoff Consulting`}</div>
                <div className="text-slate-400 mt-1">Date: {quoteDate}</div>
              </div>
            </div>
          </div>
        </div>
      );

      const renderModuleInvestmentSummary = () => {
        if (!moduleInvestmentSummaries || moduleInvestmentSummaries.length === 0) return null;
        return (
          <div className="mb-8 print-avoid-break">
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3">{isProEngagement ? 'Product Investment Summary' : 'Module Investment Summary'}</h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[9px] uppercase font-mono text-slate-500">
                    <th className="py-2.5 px-3 text-left">Module</th>
                    <th className="py-2.5 px-3 text-center">Items</th>
                    <th className="py-2.5 px-3 text-right">Base</th>
                    <th className="py-2.5 px-3 text-right">After discount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {moduleInvestmentSummaries.map((row) => (
                    <tr key={String(row.modNum)}>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{row.label}{row.isMonthly ? ' (monthly)' : row.isAnnual ? ' (annual)' : ''}</td>
                      <td className="py-2.5 px-3 text-center font-mono">{row.count}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(row.baseUndiscounted)}{row.isMonthly ? '/mo' : ''}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(row.afterDiscount)}{row.isMonthly ? '/mo' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {frictionBuffer > 0 && (
              <p className="text-[9px] text-slate-500 mt-2">* Base amounts include a {frictionBuffer}% project buffer on implementation modules.</p>
            )}
          </div>
        );
      };

      const renderEOPTPrintFootnote = () => {
        if (STARTER_UI) {
          return (
            <p className="print-only text-[9px] text-slate-500 mt-2 leading-relaxed">
              Tax note: {includeTax ? 'This quotation is subject to 12% Philippine VAT on taxable sales.' : 'Non-VAT quotation — seller is not VAT-registered for this engagement.'}
            </p>
          );
        }
        return (
          <p className="print-only text-[9px] text-slate-500 mt-2 leading-relaxed">
            Tax note: {includeTax ? 'This quotation is subject to 12% Philippine VAT on taxable sales.' : 'Non-VAT quotation — seller is not VAT-registered for this engagement.'}
            {' Legal taxpayer: Reinhard Ludwig A. Kolthoff · Trade style: Kolthoff Consulting.'}
          </p>
        );
      };

      const getModuleCardsHeading = () => {
        if (isProEngagement) return 'Platform services included in this proposal';
        const selectedMods = [activeDiag, activeSOP, activePMO, activeGov].filter(Boolean).length;
        if (selectedMods === 4) return 'Modules included in this proposal';
        if (selectedMods === 0) return 'Your growth roadmap';
        return 'Your roadmap — included now vs. later';
      };

      const renderEngagementPackageCallout = () => {
        if (!activePackageMeta) return null;
        const packageModLabels = (activePackageMeta.modules || []).map((mod) => packageModuleLabel(mod));
        return (
          <div className="mb-4 border border-brandTeal-200 bg-brandTeal-50/40 rounded-xl p-4 print-pill print-avoid-break text-left font-sans" aria-label="Selected engagement package">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[9px] font-mono uppercase tracking-wider text-brandTeal-700 font-bold block mb-1">Selected engagement package</span>
                <h5 className="text-sm font-bold text-slate-900 leading-tight">
                  {activePackageMeta.name}
                  {packageCustomized ? <span className="text-[10px] font-mono font-bold text-amber-700 normal-case tracking-normal ml-1.5">· customized in planner</span> : null}
                </h5>
                <p className="text-[10px] text-slate-600 leading-relaxed mt-1">{activePackageMeta.tagline}</p>
                {activePackageMeta.forWhom ? (
                  <p className="text-[9px] text-slate-500 italic leading-snug mt-1.5">Best for: {activePackageMeta.forWhom}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1 shrink-0 lg:max-w-[14rem] lg:justify-end">
                {packageModLabels.map((label) => (
                  <span key={label} className="text-[8px] font-mono uppercase bg-white text-brandTeal-700 px-2 py-0.5 rounded border border-brandTeal-200 font-bold">{label}</span>
                ))}
              </div>
            </div>
            <p className="text-[9px] text-slate-500 leading-relaxed mt-3 pt-3 border-t border-brandTeal-100">
              {isProEngagement
                ? 'The platform card below shows the PRO services active in this SOW and the deliverables included.'
                : 'The module cards below show what is active in this SOW and the deliverables included under each phase.'}
            </p>
          </div>
        );
      };

      const invoiceLineItemDescription = useMemo(() => {
        const taxMultiplier = includeTax ? 1.12 : 1.0;
        const milestone = isAddendumInvoiceMode
          ? (invoiceTargetAddendum?.invoiceMilestone || 'full')
          : invoiceMilestone;
        const milestones = isAddendumInvoiceMode
          ? (invoiceTargetEconomics?.billingMilestones || [])
          : billingMilestones;
        const addendumRef = invoiceTargetAddendum?.ref || '';
        const addendumTitle = invoiceTargetAddendum?.title || 'Addendum';
        const addendumDiscount = invoiceTargetAddendum?.discountPercent || 0;
        const addendumProjectBase = invoiceTargetEconomics?.finalProjectCostBase || 0;
        const addendumRetainerTotal = invoiceTargetEconomics?.retainerCostTotalBase || 0;

        if (isAddendumInvoiceMode) {
          if (milestone === 'full') {
            return `100% Full Payment of Professional Fees under Addendum ${addendumRef} — ${addendumTitle}${addendumDiscount > 0 ? ` (with ${addendumDiscount}% discount applied)` : ''} (Total Value: ${formatCurrency(Math.round((addendumProjectBase + addendumRetainerTotal) * taxMultiplier))})`;
          }
          if (milestone.startsWith('milestone_')) {
            const idx = parseInt(milestone.split('_')[1], 10);
            if (milestones[idx]) return `Addendum Milestone Payment: ${milestones[idx].label} under ${addendumRef}`;
          }
          return `Custom Addendum Billing under ${addendumRef}`;
        }

        if (invoiceMilestone === 'full') {
          return `100% Full Payment of Professional Fees under Scope of Work SOW-${quoteId}${discountPercent > 0 ? ` (with ${discountPercent}% Partnership Discount applied)` : ''} (Total Value: ${formatCurrency(Math.round((finalProjectCostBase + retainerCostTotalBase) * taxMultiplier))})`;
        }
        if (invoiceMilestone.startsWith('milestone_')) {
          const idx = parseInt(invoiceMilestone.split('_')[1], 10);
          if (billingMilestones[idx]) return `Stage-Gated Milestone Payment: ${billingMilestones[idx].label} under SOW-${quoteId}`;
        }
        if (invoiceMilestone === 'retainer') {
          const retainerLabel = isProEngagement ? (proProductMeta?.skuLabel || 'PRO 1 · Agency Ops') : `MOD 4 ${modTitle(4)}`;
          return `${retainerLabel} — full ${subscriptionMonths}-month subscription${discountPercent > 0 ? ` (with ${discountPercent}% Partnership Discount applied)` : ''} — ${formatCurrency(retainerCostPart)} / month (${formatCurrency(retainerCostTotalPart)} total commitment)`;
        }
        if (invoiceMilestone === 'retainer_monthly') {
          const periodLabel = window.InvoiceHelpers?.formatBillingPeriodLabel?.(retainerBillingPeriod) || 'monthly period';
          const retainerLabel = isProEngagement ? (proProductMeta?.skuLabel || 'PRO 1 · Agency Ops') : `MOD 4 ${modTitle(4)}`;
          return `${retainerLabel} — ${periodLabel}${discountPercent > 0 ? ` (with ${discountPercent}% Partnership Discount applied)` : ''} — ${formatCurrency(retainerCostPart)}${includeTax ? ' inc. VAT' : ''} monthly retainer`;
        }
        return `Custom Service Milestone Billing under SOW-${quoteId}`;
      }, [isAddendumInvoiceMode, invoiceTargetAddendum, invoiceTargetEconomics, invoiceMilestone, finalProjectCostBase, retainerCostTotalBase, retainerCostPart, retainerCostTotalPart, retainerBillingPeriod, billingMilestones, quoteId, includeTax, discountPercent, subscriptionMonths, isProEngagement, proProductMeta]);

      const renderPrintHeader = (title, isNda = false, isInvoice = false, isRoadmap = false) => (
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center pb-8 border-b-2 mb-8 print-card-header gap-6 font-sans ${STARTER_UI ? 'border-slate-800' : 'border-brandTeal-500'}`}>
          <div className="flex items-center gap-4">
            {renderPrintBrandLogo(brand)}
            <div>
              {STARTER_UI ? (
                <>
                  <h1 className="font-sans font-black tracking-tight text-lg text-slate-900 leading-tight">{issuerCompanyName}</h1>
                  {issuerTagline ? (
                    <span className="text-[10px] font-semibold tracking-wide block mt-1 font-sans text-slate-600">{issuerTagline}</span>
                  ) : null}
                </>
              ) : (
                <>
                  <h1 className="font-sans font-black tracking-wider text-lg uppercase text-slate-900 leading-none">{preparedBy}</h1>
                  <span className="text-[10px] text-brandTeal-600 print-accent font-extrabold tracking-widest uppercase block mt-1 font-sans">TRADE STYLE / DBA: KOLTHOFF CONSULTING</span>
                  <span className="text-[9px] text-slate-500 tracking-widest uppercase block mt-1.5 font-mono font-bold leading-relaxed font-sans">{issuerTagline}</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500 mt-2 font-semibold font-sans">
                    <span className="flex items-center gap-1"><IconMail className="w-3.5 h-3.5 text-brandTeal-600 print-accent" /> contact@kolthoff-consulting.com</span>
                    <span className="flex items-center gap-1"><IconGlobe className="w-3.5 h-3.5 text-brandTeal-600 print-accent" /> www.kolthoff-consulting.com</span>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right font-mono text-[11px] text-slate-600 space-y-1">
            <div className="text-slate-900 font-bold text-sm tracking-wide font-sans text-right uppercase">{title}</div>
            {title.includes('QUOTATION') && !isInvoice && (
              <div className="text-[9px] font-bold text-slate-600 text-right">{includeTax ? 'VAT QUOTATION · 12% VAT applies' : 'NON-VAT QUOTATION'}</div>
            )}
            {isInvoice && !STARTER_UI && <div className="text-[9px] text-rose-600 font-bold block mb-1">RA 11976 (EOPT) Compliant Billing</div>}
            {isInvoice && <div>Invoice No: <span className="font-bold text-slate-900">{quoteId.replace('KC', 'INV')}{previewInvoiceSuffix}</span></div>}
            {!isInvoice && <div>Reference SOW: <span className="font-bold text-slate-900">{isNda ? `${quoteId}-NDA` : quoteId}</span></div>}
            {isInvoice && isAddendumInvoiceMode && invoiceTargetAddendum && (
              <div>Addendum Ref: <span className="font-bold text-slate-900">{invoiceTargetAddendum.ref}</span></div>
            )}
            {isRoadmap && <div>Launch Target: <span className="font-bold text-slate-900">{targetStartDate || "Upon Signup"}</span></div>}
            {!isRoadmap && <div>Date Issued: {quoteDate}</div>}
            {!isNda && !isRoadmap && !isInvoice && <div>Valid Until: {quoteValidity}</div>}
            {!isNda && !isInvoice && <div>Project Timeline: <span className="font-bold text-slate-900">{displayTimeline}</span></div>}
            {isNda && <div>Governing Law: Philippines</div>}
            {isInvoice && <div>Payment Due: <span className="font-bold text-slate-900">{previewInvoiceDueDate || "________________________"}</span></div>}
          </div>
        </div>
      );

      const renderCustomerBlock = (partyRole = 'client', isRoadmap = false) => {
        const isInvoice = partyRole === 'invoice';
        const party = isInvoice
          ? resolvedInvoiceBillTo
          : partyRole === 'sponsor'
            ? resolvedSponsorParty
            : resolvedClientParty;
        return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 text-sm font-sans font-medium border-b border-slate-200 pb-6 print-divider text-slate-700">
          <div className="space-y-1.5 text-left font-sans">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
              {isInvoice ? `SOLD TO (${invoicePartyLabel}):` : partyRole === 'sponsor' ? "ENGAGEMENT SPONSOR:" : "CLIENT:"}
            </span>
            <div className="font-bold text-slate-900 text-base">{party.rep || "________________________"}</div>
            <div className="text-slate-700 font-bold font-sans">{party.company || "________________________"}</div>
            {(!isRoadmap || isInvoice) && <div className="text-xs text-slate-500 font-mono">TIN: {party.tin || "________________________"}</div>}
            {!isRoadmap && !isInvoice && party.address && <div className="text-xs text-slate-500 leading-snug mt-1">{party.address}</div>}
            {isInvoice && <div className="text-xs text-slate-500 leading-snug mt-1">{party.address || "________________________"}</div>}
            {partyRole === 'sponsor' && !isRoadmap && !isInvoice && <div className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Sponsor Title:</span> {proposalSponsor || "________________________"}</div>}
            {partyRole === 'client' && !isRoadmap && !isInvoice && <div className="text-xs text-slate-600"><span className="font-semibold text-slate-800">Target Kickoff:</span> {targetStartDate || "________________________"}</div>}
          </div>
          <div className="space-y-1.5 md:text-right text-left md:text-right font-sans">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
              {isInvoice ? "ISSUED BY (Sellers Information):" : "PREPARED BY:"}
            </span>
            <div className="font-bold text-slate-900 text-base">{issuerLegalName}</div>
            <div className="text-slate-700 font-bold text-xs">{STARTER_UI ? (issuerTagline || preparerTitle) : `${preparerTitle}, Kolthoff Consulting`}</div>
            {isInvoice && !STARTER_UI && <div className="text-xs text-slate-500 font-mono">TIN: {preparerTin}</div>}
            {isInvoice && !STARTER_UI && <div className="text-xs text-slate-500 font-sans">Taytay, Rizal, Calabarzon, Philippines</div>}
            {!isRoadmap && !isInvoice && <div className="text-xs text-slate-400 font-sans">Proposal Date: {quoteDate}</div>}
          </div>
        </div>
        );
      };

      const renderSignaturesBlock = (titleLeft = "Approved and Accepted by:", titleRight = "Submitted by:", leftParty = null) => {
        const party = leftParty || { rep: resolvedClientParty.rep, company: resolvedClientParty.company };
        return (
        <div className="print-quote-signatures pt-8 text-xs font-sans font-semibold border-t border-slate-200 print-divider">
          <div className="grid grid-cols-2 gap-12 sm:gap-24 font-sans">
            {titleLeft ? (
              <div className="space-y-12 flex flex-col justify-between font-sans text-left">
                <p className="text-slate-700 font-bold font-sans text-left">{titleLeft}</p>
                <div className="border-t border-slate-300 pt-2 text-[10px] space-y-0.5 font-sans">
                  <div className="font-bold text-slate-900">{party.rep || "________________________"}</div>
                  <div className="text-slate-500 font-sans">Representative, {party.company || "________________________"}</div>
                  <div className="text-slate-400 font-sans">Date: ________________________</div>
                </div>
              </div>
            ) : <div className="hidden sm:block"></div>}
            {titleRight && (
              <div className="space-y-12 flex flex-col justify-between font-sans text-left">
                <p className="text-slate-700 font-bold font-sans text-left font-sans">{titleRight}</p>
                <div className="border-t border-slate-300 pt-2 text-[10px] space-y-0.5">
                  <div className="font-bold text-slate-900">{issuerLegalName}</div>
                  <div className="text-slate-500 font-sans">{STARTER_UI ? preparerTitle : `${preparerTitle}, Kolthoff Consulting`}</div>
                  <div className="text-slate-400 font-sans">Date: {quoteDate}</div>
                </div>
              </div>
            )}
          </div>
        </div>
        );
      };

      const renderEOPTAlertBlock = (isInvoice) => {
        if (STARTER_UI) return null;
        return (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg mb-6 text-xs text-slate-800 space-y-2 no-print shadow-sm font-sans text-left">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            <span>BIR Taxpayer Compliance Guidance (EOPT Act / RA 11976)</span>
          </div>
          <p className="leading-relaxed font-sans">
            {isInvoice ? "This invoice complies with the Ease of Paying Taxes (EOPT) rules of 2024. " : "This proposal structure lists "}
            Your name <strong className="text-slate-900 font-bold font-sans">Reinhard Ludwig A. Kolthoff</strong> is identified as the legal individual taxpayer, and <strong className="text-slate-900 font-bold font-sans font-sans">Kolthoff Consulting</strong> is identified as your Trade Style (DBA).
            {!isInvoice && " This conforms fully with the Bureau of Internal Revenue (BIR) sole-proprietor naming guidelines."}
          </p>
          <p className="leading-relaxed text-slate-600 font-sans">
            <strong className="text-amber-800 font-sans">{isInvoice ? "Invoicing Tax Switch:" : "Tax Switch Note:"}</strong> {includeTax ? `Output VAT of 12% is added. The header prints as "VAT SALES INVOICE".` : `Non-VAT has been selected. The header prints as "NON-VAT SALES INVOICE" to ensure absolute tax compliance for non-VAT sole proprietors.`}
          </p>
        </div>
        );
      };

      const renderTaxBreakoutTable = (isInvoice = false) => {
        const quoteBaseAmount = finalProjectCostBase + retainerCostTotalBase;
        const quoteVatAmount = includeTax ? Math.round(quoteBaseAmount * 0.12) : 0;
        const baseAmount = isInvoice ? computedInvoiceCost.baseAmount : quoteBaseAmount;
        const vatAmount = isInvoice ? computedInvoiceCost.vatAmount : quoteVatAmount;

        return (
        <div className="mb-6 font-sans">
          <h4 className="text-[9px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2 font-sans font-semibold text-left">{STARTER_UI ? 'Philippine Tax Breakout Table' : 'Philippine Tax Breakout Table (EOPT Compliant)'}</h4>
          <div className="border border-slate-200 rounded-lg overflow-hidden text-center text-[10px] uppercase font-mono tracking-wider text-slate-600 font-bold font-sans">
            <div className="grid grid-cols-4 bg-slate-50 divide-x divide-slate-200 border-b border-slate-200">
              <div className="py-2.5 px-1 font-sans">Standard Taxable Sales</div>
              <div className="py-2.5 px-1 font-sans">Tax-Exempt Sales</div>
              <div className="py-2.5 px-1 font-sans font-sans">Zero-Rated Sales</div>
              <div className="py-2.5 px-1 font-sans">{includeTax ? "12% VAT Amount" : "Non-VAT / Exempt"}</div>
            </div>
            <div className="grid grid-cols-4 divide-x divide-slate-200 bg-white text-slate-900 py-3">
              <div className="font-mono">{includeTax ? formatCurrency(baseAmount) : "₱0"}</div>
              <div className="font-mono">{includeTax ? "₱0" : formatCurrency(baseAmount)}</div>
              <div className="font-mono">₱0</div>
              <div className="font-mono">{includeTax ? formatCurrency(vatAmount) : "₱0"}</div>
            </div>
          </div>
        </div>
        );
      };

      const renderFinancialBreakdown = (isInvoice) => (
        <div className="flex flex-col lg:flex-row lg:justify-between items-stretch gap-6 py-6 border-t border-b border-slate-200 mb-8 print-divider text-sm bg-slate-50 p-4 rounded-xl font-semibold text-left print-financial-summary">
          <div className="text-[11px] text-slate-600 max-w-md leading-relaxed text-left font-sans font-medium flex flex-col justify-between text-slate-700 font-sans">
            {isInvoice ? (
              <div>
                <strong className="text-slate-700 block mb-1 font-bold font-sans font-semibold text-left">Payment Terms &amp; Guidelines:</strong>
                {STARTER_UI
                  ? <>Please settle this invoice within <strong>seven (7) business days</strong> of the invoice date using your agreed payment method.</>
                  : <>Please settle this invoice amount via local bank transfer using the BDO account details below within <strong>seven (7) business days</strong> of this invoice.</>}
                {!STARTER_UI && (
                <div className="mt-4 pt-3 border-t border-slate-200 font-sans text-left">
                  <span className="text-[10px] font-mono tracking-widest text-brandTeal-600 print-accent block mb-1 uppercase font-bold font-sans text-left">BDO Remittance Details:</span>
                  <div className="font-mono text-[9px] text-slate-700 space-y-0.5 bg-slate-50 p-2.5 rounded border border-slate-200 font-sans">
                    <div>Bank Name: <strong>BDO Unibank Inc.</strong></div>
                    <div>Account Name: <strong>Reinhard Ludwig A. Kolthoff</strong></div>
                    <div>Account Number: <strong>0039 5019 0761</strong></div>
                  </div>
                </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <strong className="text-slate-700 block mb-1 font-bold font-sans">Fixed Flat-Rate SOW Guarantee:</strong> All SOW plans are provided on a flat-rate basis. {STARTER_UI ? 'Our team delivers your systems completely asynchronously, guaranteeing zero scheduling delays or billing hourly variations.' : 'Reinhard builds your systems completely asynchronously, guaranteeing zero scheduling delays or billing hourly variations.'}
                  
                  {frictionBuffer > 0 && (
                    <div className="mt-2 text-slate-500 text-[10px] font-sans font-medium text-left">
                      * Your total project quote includes a built-in <strong className="text-slate-700 font-sans font-bold">+{frictionBuffer}% Project Buffer Hours</strong>, giving our team sufficient hours to perform complete, unhurried observation audits without any surprise billing adjustments later on.
                    </div>
                  )}
                </div>
                {!STARTER_UI && (
                <div className="mt-4 pt-3 border-t border-slate-200 text-left">
                  <strong className="text-brandTeal-600 print-accent block mb-1.5 uppercase tracking-wider text-[10px] font-mono font-bold font-sans text-left font-sans">Your SME Financial Recovery (ROI Plan):</strong>
                  <span className="text-xs text-slate-700 leading-normal block">
                    Annual Operational Leakage (Chaos Tax): <strong className="text-slate-900 font-mono font-bold">{formatCurrency(annualOperationalLeakage)}</strong>
                  </span>
                  <span className="text-xs text-slate-700 leading-normal block mt-1">
                    Expected First Year Recovery Potential (40% Target): <strong className="text-emerald-600 font-mono font-bold">{formatCurrency(recoveryPotential)}</strong>
                  </span>
                  <span className="text-xs text-slate-700 leading-normal block mt-1 font-sans">
                    Expected Net First Year Savings: <strong className="text-emerald-600 font-mono font-bold">{formatCurrency(updatedSummary.netFirstYearSavings)}</strong> after project investment (ROI of <strong className="text-emerald-600 font-mono font-bold">{updatedSummary.projectROI}%</strong>).
                  </span>
                </div>
                )}
              </>
            )}
          </div>
          
          <div className="text-right space-y-1.5 shrink-0 min-w-[270px] border-l border-slate-200 pl-6 flex flex-col justify-center font-sans font-semibold">
            {!isInvoice && (
              <div className="flex justify-between items-center text-slate-600 font-mono text-xs mb-1 font-sans">
                <span>Target Duration:</span>
                <span className="font-bold text-slate-900">{displayTimeline}</span>
              </div>
            )}

            {discountPercent > 0 && (isInvoice ? (invoiceMilestone === 'full' || invoiceMilestone === 'retainer' || invoiceMilestone === 'retainer_monthly') : true) ? (
              <>
                <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                  <span>Subtotal (Standard Price):</span>
                  <span className="font-bold text-slate-700 font-mono">
                    {formatCurrency(isInvoice ? computedInvoiceCostUndiscounted : (projectCostBaseUndiscounted + retainerCostTotalBaseUndiscounted))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-emerald-600 font-mono font-semibold">
                  <span>Special Discount ({discountPercent}%):</span>
                  <span className="font-bold font-mono">
                    - {formatCurrency(isInvoice ? (computedInvoiceCostUndiscounted - computedInvoiceCost.baseAmount) : ((projectCostBaseUndiscounted + retainerCostTotalBaseUndiscounted) - (finalProjectCostBase + retainerCostTotalBase)))}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600 border-t border-slate-200 pt-1.5 font-mono font-sans">
                  <span>Discounted Net Subtotal:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {formatCurrency(isInvoice ? computedInvoiceCost.baseAmount : (finalProjectCostBase + retainerCostTotalBase))}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center text-xs text-slate-600 border-t border-slate-200 pt-2 font-mono font-semibold">
                <span>{isInvoice ? "Subtotal Ex-Tax:" : "SOW Net Subtotal:"}</span>
                <span className="font-bold text-slate-900 font-mono font-semibold">
                  {formatCurrency(isInvoice ? computedInvoiceCost.baseAmount : (finalProjectCostBase + retainerCostTotalBase))}
                </span>
              </div>
            )}

            {includeTax && (
              <div className="flex justify-between items-center text-xs text-slate-500 font-mono">
                <span>Philippine VAT (12%):</span>
                <span className="font-bold font-mono">
                  {formatCurrency(isInvoice ? computedInvoiceCost.vatAmount : updatedSummary.taxValue)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-base font-bold text-slate-900 pt-2 border-t border-slate-200 font-sans">
              <span>{isInvoice ? "Total Amount Due:" : "Total Project Investment:"}</span>
              <span className="text-brandTeal-600 print-accent text-lg font-serif font-black font-mono">
                {formatCurrency(isInvoice ? computedInvoiceCost.totalAmount : updatedSummary.totalCost)}
              </span>
            </div>
          </div>
        </div>
      );

      const renderDeliverablesTable = (isInvoice) => (
        <>
          <div className="text-xs text-slate-600 mb-6 italic leading-relaxed font-sans font-semibold text-left font-sans">
            {isInvoice
              ? (isAddendumInvoiceMode
                ? `Please find below the itemized billing details for addendum scope ${invoiceTargetAddendum?.ref || ''} in accordance with the master project SOW ${quoteId}:`
                : "Please find below the itemized billing details for operational support services rendered in accordance with our master project SOW:")
              : (STARTER_UI
                ? 'We are pleased to submit our formal pricing proposal for the services listed below:'
                : "We are pleased to submit our formal flat-rate pricing proposal to fix operational leaks, document how your business runs, and launch your team workspace:")}
          </div>

          {isInvoice ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-6 print-divider font-sans text-left">
              <table className="w-full text-left border-collapse text-xs table-fixed font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono text-[9px] tracking-wider font-extrabold font-sans">
                    <th scope="col" className="py-3 px-4 w-[65%] text-left">Description of Services Rendered</th>
                    <th scope="col" className="py-3 px-4 text-right w-[35%] font-sans">Milestone Amount (PHP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium font-sans">
                  <tr>
                    <td className="py-5 px-4 align-top text-slate-800 text-left">
                      <div className="font-bold text-slate-900 font-sans text-xs text-left font-sans font-bold">{invoiceLineItemDescription}</div>
                      <div className="text-[10px] text-slate-500 mt-2 leading-relaxed font-sans font-medium text-left">
                        {isAddendumInvoiceMode ? (
                          <>
                            <span className="font-semibold text-slate-700">{invoiceTargetAddendum?.title}</span>
                            {(invoiceTargetAddendum?.tasks || []).filter((t) => t.selected).slice(0, 4).map((task) => (
                              <span key={task.id} className="block mt-1">· {task.deliverable}</span>
                            ))}
                          </>
                        ) : (
                          'Business leak scan, playbooks, workspace setup, employee handbook, and ongoing care plan services as listed in this SOW.'
                        )}
                      </div>
                    </td>
                    <td className="py-5 px-4 text-right align-top font-mono font-bold text-slate-900 text-sm">
                      {formatCurrency(computedInvoiceCost.baseAmount)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : STARTER_UI ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-8 print-divider font-sans text-left">
              <table className="w-full text-left border-collapse text-[10px] font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono text-[8px] tracking-wider font-extrabold">
                    <th className="py-2 px-2 text-left">Module</th>
                    <th className="py-2 px-2 text-left">Particular</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-center">Duration</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 px-2 text-left">Unit</th>
                    <th className="py-2 px-2 text-right">Base Price</th>
                    <th className="py-2 px-2 text-right">Mark Up</th>
                    <th className="py-2 px-2 text-right">Gross Profit</th>
                    <th className="py-2 px-2 text-right">GP Margin</th>
                    <th className="py-2 px-2 text-right">Estimate Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tasks.filter(t => t.selected && H.isAgencyLineItem(t)).map((task) => {
                    const row = H.computeAgencyLineItemPricing(task);
                    const modKey = task.moduleKey || H.presetForTask(task) || 'mod1';
                    return (
                      <tr key={task.id}>
                        <td className="py-2 px-2 font-semibold text-slate-700">{moduleBundleNames[modKey] || H.getModDisplayName(Number(String(modKey).replace('mod', '')))}</td>
                        <td className="py-2 px-2 font-bold text-slate-900">{task.deliverable}</td>
                        <td className="py-2 px-2 text-center font-mono">{task.lineQty ?? 0}</td>
                        <td className="py-2 px-2 text-center font-mono">{task.lineDuration ?? 0}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(task.lineUnitPrice ?? 0)}</td>
                        <td className="py-2 px-2">{task.lineUnit || 'per hour'}</td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(row.basePrice)}</td>
                        <td className="py-2 px-2 text-right font-mono">{row.markUp.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right font-mono">{formatCurrency(row.grossProfit)}</td>
                        <td className="py-2 px-2 text-right font-mono">{row.gpMargin.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-right font-mono font-bold">{formatCurrency(row.estimateCost)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden mb-8 print-divider font-sans text-left font-sans font-semibold">
              <table className="w-full text-left border-collapse text-xs table-fixed font-sans">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-mono text-[9px] tracking-wider font-extrabold font-sans">
                    <th scope="col" className="py-3 px-4 w-[30%] text-left">Included Service Module</th>
                    <th scope="col" className="py-3 px-4 w-[70%] text-left">Milestone Deliverable Objectives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium font-sans">
                  {tasks.filter(t => t.selected).map((task) => (
                    <tr key={task.id}>
                      <td className="py-3 px-4 align-top font-bold text-slate-700 text-[10px] uppercase font-sans text-left font-sans font-bold">
                        {H.getTaskCategoryLabel ? H.getTaskCategoryLabel(task) : formatCategoryDisplay(task.category)}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-800 text-left font-sans">
                        <div className="font-bold text-slate-900 font-sans text-xs text-left font-sans font-bold">{task.deliverable}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed font-sans text-left font-sans">{task.description}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      );

      const renderMilestoneBillingGrid = () => (
        <section className="mb-8 font-semibold" aria-labelledby="stage-gated-heading">
          <h4 id="stage-gated-heading" className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-3 font-sans text-left font-sans font-bold">
            {milestoneSplit === 'auto' ? "Stage-Gated Phased Commitment Structure" : "Project Milestones"}
          </h4>
          
          {finalProjectCostPart > 0 && billingMilestones.length > 0 && (
            <div 
              className="grid grid-cols-1 gap-4 text-xs font-sans font-medium text-left mb-4"
              style={{ gridTemplateColumns: `repeat(${billingMilestones.length}, minmax(0, 1fr))` }}
              role="list"
              aria-label="Stage-gated payment gates"
            >
              {billingMilestones.map((milestone, idx) => (
                <article key={idx} role="listitem" className="p-3 bg-slate-50 rounded border border-slate-200 print-pill font-sans">
                  <div className="font-bold text-slate-800 font-sans font-semibold leading-snug">{milestone.label}</div>
                  <span className="font-mono text-brandTeal-600 print-accent font-bold mt-1.5 block">{formatCurrency(milestone.amount)}</span>
                  <p className="text-[10px] text-slate-500 mt-1 font-sans font-medium leading-relaxed">{milestone.desc}</p>
                </article>
              ))}
            </div>
          )}

          {retainerCostBase > 0 && (
            <article className="p-4 bg-slate-50 rounded-xl border border-slate-200 print-pill mb-4 font-sans text-left font-sans font-semibold" aria-label={isProEngagement ? 'PRO platform subscription retainer' : `Module 4 ${modTitle(4)} retainer`}>
              <div className="flex justify-between items-center font-bold text-slate-800 text-sm">
                <span>{isProEngagement ? `${proProductMeta?.skuLabel || 'PRO 1 · Agency Ops'} (${subscriptionMonths} months)` : `MOD 4 ${modTitle(4)} (${subscriptionMonths} months)`}</span>
                <span className="text-brandTeal-600 print-accent font-mono font-bold">{formatCurrency(retainerCostPart)} / Month{includeTax ? " (inc. VAT)" : ""}</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed text-left font-sans">
                {isProEngagement
                  ? `Covers platform hosting, product updates, and standard user support. Payments are due at the beginning of each calendar month (${subscriptionMonths} × ${formatCurrency(retainerCostPart)} = ${formatCurrency(retainerCostTotalPart)}${includeTax ? " inc. VAT" : ""} total commitment).`
                  : `Covers platform hosting, user care, and bi-weekly operations check-in calls. Payments are due at the beginning of each calendar month (${subscriptionMonths} × ${formatCurrency(retainerCostPart)} = ${formatCurrency(retainerCostTotalPart)}${includeTax ? " inc. VAT" : ""} total commitment). Semi-annual system health checks are billed separately when selected.`}
              </p>
            </article>
          )}
        </section>
      );

      const renderChaosTaxCalculatorCard = (isSidebar = false) => {
        return (
          <div className="bg-brandNavy-900 border border-brandNavy-700/80 rounded-xl p-5 shadow-2xl space-y-5 font-sans text-left">
            <div className="border-b border-brandNavy-700 pb-3 flex justify-between items-center font-sans font-semibold">
              <span className="text-[10px] font-mono tracking-widest text-brandTeal-400 uppercase font-bold">Interactive Assessment</span>
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Chaos Tax Matrix</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold uppercase tracking-wider text-[10px]">Total Staff Count</span>
                <span className="font-bold text-brandTeal-300 font-mono">{staffCount} Employees</span>
              </div>
              <input 
                type="range" 
                min="1" 
                max="200" 
                value={staffCount} 
                onChange={(e) => setStaffCount(parseInt(e.target.value))} 
                className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1.5 rounded cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs font-sans">
                <span className="text-slate-300 font-semibold uppercase tracking-wider text-[10px]">Avg Monthly Payroll Salary</span>
                <span className="font-bold text-brandTeal-300 font-mono">{formatCurrency(monthlySalary)} / month</span>
              </div>
              <input 
                type="range" 
                min="10000" 
                max="200000" 
                step="1000" 
                value={monthlySalary} 
                onChange={(e) => setMonthlySalary(parseInt(e.target.value))} 
                className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1.5 rounded cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-semibold uppercase tracking-wider text-[10px]">Daily Lost Hours Per Employee</span>
                <span className="font-bold text-brandTeal-300 font-mono">{wastedHours.toFixed(1)} Hours / Day</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="8.0" 
                step="0.5" 
                value={wastedHours} 
                onChange={(e) => setWastedHours(parseFloat(e.target.value))} 
                className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1.5 rounded cursor-pointer"
              />
            </div>

            <div className="bg-brandNavy-955 border border-brandNavy-800 rounded-xl p-4 space-y-3.5 mt-2">
              <div>
                <span className="text-[9px] font-mono tracking-wider uppercase text-rose-400 font-bold block mb-1 text-left">Your Est. Annual Operational Leakage (Chaos Tax)</span>
                <span className="text-xl font-bold font-mono text-rose-500">{formatCurrency(annualOperationalLeakage)}</span>
              </div>
              <div className="border-t border-brandNavy-800 pt-3">
                <span className="text-[9px] font-mono tracking-wider uppercase text-emerald-400 font-bold block mb-1 text-left">Estimated Recovery Potential (First Year)</span>
                <span className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(recoveryPotential)}</span>
              </div>
            </div>

            <div className="text-[9px] text-slate-500 leading-snug italic pt-1 font-medium text-left font-sans">
              * Disclaimer: This calculation is an illustrative simulation based on localized SME sector averages. Operational performance recoveries vary and are governed strictly by customized, manually validated Statements of Work (SOW).
            </div>
          </div>
        );
      };

      const renderSettingsSidebar = ({ embedded = false } = {}) => {
        if (view === 'sandbox' || view === 'packages') return null;

        const isNda = view === 'nda';
        const isProposal = view === 'package';
        const isRoadmap = view === 'package';
        const isQuoteOrInvoice = view === 'invoice' || view === 'package';
        const isInvoice = view === 'invoice';
        const isPackage = view === 'package';
        const isAddendum = view === 'addendum';
        const hasPrintSection = printCover || printSow || printTimeline || printQuote || printSla;

        const printSectionOptions = [
          { id: 'print-cover', label: 'Cover Page', checked: printCover, onChange: setPrintCover },
          { id: 'print-sow', label: 'SOW Project Proposal Page', checked: printSow, onChange: setPrintSow },
          { id: 'print-timeline', label: 'Roadmap / Timeline Page', checked: printTimeline, onChange: setPrintTimeline },
          { id: 'print-sla', label: STARTER_UI ? 'SLA & Support Standards Page' : 'SLA & Compliance Safeguards Page', checked: printSla, onChange: setPrintSla },
          { id: 'print-quote', label: 'Official Price Quotation & Terms', checked: printQuote, onChange: setPrintQuote }
        ];

        return (
          <aside aria-label="Settings" className={`${embedded ? '' : 'xl:col-span-4 planner-split-panel'} ${STARTER_UI ? 'starter-docs-sidebar bg-white border border-slate-200' : 'bg-brandNavy-900 border border-brandNavy-700'} rounded-xl p-6 shadow-2xl backdrop-blur-sm no-print space-y-5 font-sans text-left`}>
            <h3 className={`text-sm font-bold tracking-wider uppercase font-mono flex items-center gap-2 text-left font-sans font-bold ${STARTER_UI ? 'starter-docs-sidebar-title text-slate-700' : 'text-brandTeal-400'}`}>
              {isRoadmap && !isPackage ? <IconCalendar /> : <IconEdit />}
              {isNda ? "Customize NDA Fields" : isPackage ? "Package Settings" : isAddendum ? "Addendum Settings" : isInvoice ? "Customize Invoice Fields" : ""}
            </h3>
            
            <div className="space-y-4 text-xs font-sans font-medium text-left">
              {(isProposal || isQuoteOrInvoice || isRoadmap || isPackage || isAddendum) && (
                <div>
                  <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-sans font-semibold">SOW Reference Code</label>
                  <input type="text" value={quoteId} onChange={(e) => setQuoteId(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 font-mono" />
                </div>
              )}

              {isAddendum && activeAddendum && (
                <>
                  <div className="bg-brandTeal-500/10 border border-brandTeal-500/30 rounded-lg p-3 text-[10px] text-brandTeal-300">
                    Separate scope &amp; invoice for <strong className="text-white">{activeAddendum.ref}</strong>. Original SOW milestones unchanged.
                  </div>
                  <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                    <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1">Addendum billing structure</legend>
                    <select value={activeAddendum.milestoneSplit || '50-50'} onChange={(e) => patchActiveAddendum({ milestoneSplit: e.target.value })} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 text-[11px] font-bold focus:outline-none focus:border-brandTeal-500">
                      <option value="auto">Auto — Stage-Gated by Module</option>
                      <option value="50-50">50% / 50% Split</option>
                      <option value="30-40-30">30% / 40% / 30% Split</option>
                      <option value="custom">Custom Percentages</option>
                    </select>
                    {addendumEconomics?.billingMilestones?.map((m, idx) => (
                      <div key={idx} className="flex justify-between gap-2 text-[9px] text-slate-500">
                        <span className="truncate">{m.label}</span>
                        <span className="font-mono text-brandTeal-300 shrink-0">{formatCurrency(m.amount)}</span>
                      </div>
                    ))}
                  </fieldset>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceAddendumId(activeAddendum.id);
                      setView('invoice');
                    }}
                    className="w-full py-2.5 text-[10px] font-bold rounded-lg uppercase tracking-wider bg-brandNavy-800 hover:bg-brandNavy-750 text-brandTeal-300 border border-brandTeal-500/30"
                  >
                    Issue invoice on Invoice tab →
                  </button>
                </>
              )}

              {isInvoice && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1">Invoice document</legend>
                  <select
                    value={invoiceAddendumId || ''}
                    onChange={(e) => setInvoiceAddendumId(e.target.value || null)}
                    className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 text-[11px] font-bold focus:outline-none focus:border-brandTeal-500"
                  >
                    <option value="">Main SOW — {quoteId}</option>
                    {(addenda || []).map((item) => (
                      <option key={item.id} value={item.id} disabled={item.status === 'invoiced'}>
                        {item.ref} — {item.title}{item.status === 'invoiced' ? ' (invoiced)' : ''}
                      </option>
                    ))}
                  </select>
                  {isAddendumInvoiceMode && invoiceTargetAddendum && (
                    <p className="text-[9px] text-brandTeal-400/80 bg-brandTeal-500/5 border border-brandTeal-500/20 rounded p-2">
                      Billing addendum <strong className="text-white">{invoiceTargetAddendum.ref}</strong>. Milestone split is configured on the{' '}
                      <button type="button" onClick={() => { setActiveAddendumId(invoiceTargetAddendum.id); setView('addendum'); }} className="underline font-bold hover:text-brandTeal-300">Addendum tab</button>.
                    </p>
                  )}
                </fieldset>
              )}

              {/* Package Selector Matrix for Print Out Sections */}
              {isPackage && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1 text-left font-sans font-bold">Select Proposal Sections for Printout</legend>
                  <div className="space-y-2.5" role="group" aria-label="PDF print sections">
                    {printSectionOptions.map((option) => (
                      <label key={option.id} htmlFor={option.id} className="flex items-center gap-2 text-[11px] text-slate-300 w-full hover:text-white transition-colors cursor-pointer">
                        <input
                          id={option.id}
                          type="checkbox"
                          className="sr-only"
                          checked={option.checked}
                          onChange={(e) => option.onChange(e.target.checked)}
                        />
                        <CheckboxIndicator checked={option.checked} />
                        <span className="font-sans font-semibold">{option.label}</span>
                      </label>
                    ))}
                  </div>
                  {!hasPrintSection && (
                    <p className="text-[10px] text-amber-400 font-mono">Select at least one section before printing.</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-brandNavy-800">
                    <button type="button" onClick={applyClientPdfPreset} className="px-2.5 py-1.5 text-[10px] font-bold rounded bg-brandTeal-500/20 text-brandTeal-300 border border-brandTeal-500/30 uppercase">Client PDF preset</button>
                    <button type="button" onClick={applyFullPdfPreset} className="px-2.5 py-1.5 text-[10px] font-bold rounded bg-brandNavy-900 text-slate-400 border border-brandNavy-700 uppercase">Full package</button>
                  </div>
                </fieldset>
              )}

              {(isProposal || isPackage) && !STARTER_UI && (
                <div className="space-y-2 text-left">
                  <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-sans font-semibold">Operational Delays Calculator</span>
                  {renderChaosTaxCalculatorCard(true)}
                </div>
              )}

              {(isQuoteOrInvoice || isPackage) && (
                <div className="flex items-center justify-between bg-brandNavy-955 border border-brandNavy-700 p-3 rounded-lg text-left">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-slate-400 font-bold text-left font-sans font-semibold font-bold">Include 12% PH VAT</span>
                  <button aria-pressed={includeTax} onClick={() => setIncludeTax(!includeTax)} className={`w-10 h-6 flex items-center rounded-full p-0.5 transition-all duration-300 ${includeTax ? 'bg-brandTeal-500' : 'bg-brandNavy-800 border border-brandNavy-700'}`}>
                    <span className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-all duration-300 ${includeTax ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              )}

              {(isQuoteOrInvoice || isPackage) && !(isInvoice && isAddendumInvoiceMode) && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1 text-left font-sans">Billing Milestone Structure</legend>
                  <p className="text-[9px] text-slate-400 -mt-1 text-left">Controls payment gates on the Package quotation and Invoice tab options.</p>
                  <select value={milestoneSplit} onChange={(e) => setMilestoneSplit(e.target.value)} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 text-[11px] font-bold focus:outline-none focus:border-brandTeal-500">
                    <option value="auto">Auto — Stage-Gated by Module</option>
                    <option value="50-50">50% / 50% Project Split</option>
                    <option value="30-40-30">30% / 40% / 30% Split</option>
                    <option value="custom">Custom Percentages</option>
                  </select>
                  {milestoneSplit === 'custom' && (
                    <div className="grid grid-cols-3 gap-2">
                      {[['Milestone 1 %', customSplit1, setCustomSplit1], ['Milestone 2 %', customSplit2, setCustomSplit2], ['Milestone 3 %', customSplit3, setCustomSplit3]].map(([label, val, setter]) => (
                        <div key={label}>
                          <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1">{label}</label>
                          <input type="number" min="0" max="100" value={val} onChange={(e) => setter(Number(e.target.value))} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-brandTeal-500" />
                        </div>
                      ))}
                    </div>
                  )}
                  {billingMilestones.length > 0 && (
                    <div className="text-[9px] text-slate-500 space-y-1 pt-1 border-t border-brandNavy-800">
                      {billingMilestones.map((m, i) => (
                        <div key={i} className="flex justify-between gap-2"><span className="truncate">{m.label}</span><span className="font-mono text-brandTeal-300 shrink-0">{formatCurrency(m.amount)}</span></div>
                      ))}
                    </div>
                  )}
                </fieldset>
              )}

              {isInvoice && isAddendumInvoiceMode && invoiceTargetAddendum && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1 text-left font-sans">Addendum invoice gate</legend>
                  <p className="text-[9px] text-slate-400 text-left font-sans -mt-1">Choose which addendum payment stage this invoice bills.</p>
                  <select
                    value={invoiceTargetAddendum.invoiceMilestone || 'full'}
                    onChange={(e) => patchInvoiceTargetAddendum({ invoiceMilestone: e.target.value })}
                    className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 text-[11px] font-bold focus:outline-none focus:border-brandTeal-500"
                  >
                    <option value="full">100% full addendum payment — {formatCurrency(Math.round(((invoiceTargetEconomics?.finalProjectCostBase || 0) + (invoiceTargetEconomics?.retainerCostTotalBase || 0)) * (includeTax ? 1.12 : 1)))}</option>
                    {(invoiceTargetEconomics?.billingMilestones || []).map((m, idx) => (
                      <option key={idx} value={`milestone_${idx}`}>{m.label} — {formatCurrency(m.amount)}</option>
                    ))}
                  </select>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Invoice suffix</label>
                    <input type="text" readOnly value={invoiceTargetAddendum.invoiceNumberSuffix || invoiceTargetAddendum.suffix} className="w-full bg-brandNavy-950 border border-brandNavy-700 rounded p-2 text-slate-400 font-mono text-xs" />
                    <span className="text-[9px] text-slate-500 block mt-1 text-left font-sans">Preview: {quoteId.replace('KC', 'INV')}{invoiceTargetAddendum.invoiceNumberSuffix || invoiceTargetAddendum.suffix}</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Due date</label>
                    <input type="date" value={invoiceTargetAddendum.invoiceDueDate || ''} onChange={(e) => patchInvoiceTargetAddendum({ invoiceDueDate: e.target.value })} className="w-full bg-brandNavy-950 border border-brandNavy-700 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-brandTeal-500" />
                  </div>
                </fieldset>
              )}

              {isInvoice && !isAddendumInvoiceMode && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1 text-left font-sans">Invoice Billing Gate</legend>
                  <p className="text-[9px] text-slate-400 text-left font-sans -mt-1">Choose which payment stage this invoice bills — full project total or an individual gate.</p>
                  <p className="text-[9px] text-brandTeal-400/80 text-left font-sans bg-brandTeal-500/5 border border-brandTeal-500/20 rounded p-2">Gate amounts mirror your <button type="button" onClick={() => setView('package')} className="underline font-bold hover:text-brandTeal-300">Package billing structure</button> — change modules in Planner or milestone split above.</p>
                  <div className="space-y-2" role="radiogroup" aria-label="Invoice billing gate">
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${invoiceMilestone === 'full' ? 'border-brandTeal-500/50 bg-brandTeal-500/10' : 'border-brandNavy-800 hover:border-brandNavy-700'}`}>
                      <input type="radio" name="invoiceMilestone" value="full" checked={invoiceMilestone === 'full'} onChange={() => setInvoiceMilestone('full')} className="mt-0.5 accent-brandTeal-500 shrink-0" />
                      <span className="flex-1 text-[11px] text-slate-200 font-semibold leading-snug text-left">
                        <span className="block font-sans">100% Full Payment</span>
                        <span className="text-brandTeal-300 font-mono text-[10px]">{formatCurrency(Math.round((finalProjectCostBase + retainerCostTotalBase) * (includeTax ? 1.12 : 1)))}</span>
                      </span>
                    </label>
                    {billingMilestones.map((milestone, idx) => (
                      <label key={`milestone_${idx}`} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${invoiceMilestone === `milestone_${idx}` ? 'border-brandTeal-500/50 bg-brandTeal-500/10' : 'border-brandNavy-800 hover:border-brandNavy-700'}`}>
                        <input type="radio" name="invoiceMilestone" value={`milestone_${idx}`} checked={invoiceMilestone === `milestone_${idx}`} onChange={() => setInvoiceMilestone(`milestone_${idx}`)} className="mt-0.5 accent-brandTeal-500 shrink-0" />
                        <span className="flex-1 text-[11px] text-slate-200 font-semibold leading-snug text-left">
                          <span className="block font-sans">{milestone.label}</span>
                          <span className="text-brandTeal-300 font-mono text-[10px]">{formatCurrency(milestone.amount)}</span>
                        </span>
                      </label>
                    ))}
                    {retainerCostTotalBase > 0 && (
                      <>
                        <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${invoiceMilestone === 'retainer_monthly' ? 'border-brandTeal-500/50 bg-brandTeal-500/10' : 'border-brandNavy-800 hover:border-brandNavy-700'}`}>
                          <input type="radio" name="invoiceMilestone" value="retainer_monthly" checked={invoiceMilestone === 'retainer_monthly'} onChange={() => {
                            setInvoiceMilestone('retainer_monthly');
                            const IH = window.InvoiceHelpers;
                            const period = retainerBillingPeriod || IH?.currentBillingPeriod?.() || '';
                            if (!retainerBillingPeriod && period) setRetainerBillingPeriod(period);
                            if (IH?.suggestRetainerMonthlySuffix && (!invoiceNumberSuffix || invoiceNumberSuffix === '01')) {
                              setInvoiceNumberSuffix(IH.suggestRetainerMonthlySuffix(period));
                            }
                          }} className="mt-0.5 accent-brandTeal-500 shrink-0" />
                          <span className="flex-1 text-[11px] text-slate-200 font-semibold leading-snug text-left">
                            <span className="block font-sans">{isProEngagement ? `${proProductMeta?.skuLabel || 'PRO 1 · Agency Ops'} — Monthly Invoice` : `MOD 4 ${modTitle(4)} — Monthly Invoice`}</span>
                            <span className="text-brandTeal-300 font-mono text-[10px]">{formatCurrency(retainerCostPart)} / month{includeTax ? ' inc. VAT' : ''}</span>
                          </span>
                        </label>
                        <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${invoiceMilestone === 'retainer' ? 'border-brandTeal-500/50 bg-brandTeal-500/10' : 'border-brandNavy-800 hover:border-brandNavy-700'}`}>
                          <input type="radio" name="invoiceMilestone" value="retainer" checked={invoiceMilestone === 'retainer'} onChange={() => setInvoiceMilestone('retainer')} className="mt-0.5 accent-brandTeal-500 shrink-0" />
                          <span className="flex-1 text-[11px] text-slate-200 font-semibold leading-snug text-left">
                            <span className="block font-sans">{isProEngagement ? `${proProductMeta?.skuLabel || 'PRO 1 · Agency Ops'} — Full Subscription (${subscriptionMonths} mo)` : `MOD 4 ${modTitle(4)} — Full Subscription (${subscriptionMonths} mo)`}</span>
                            <span className="text-brandTeal-300 font-mono text-[10px]">{formatCurrency(retainerCostTotalPart)} upfront</span>
                          </span>
                        </label>
                      </>
                    )}
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${invoiceMilestone === 'custom' ? 'border-brandTeal-500/50 bg-brandTeal-500/10' : 'border-brandNavy-800 hover:border-brandNavy-700'}`}>
                      <input type="radio" name="invoiceMilestone" value="custom" checked={invoiceMilestone === 'custom'} onChange={() => setInvoiceMilestone('custom')} className="mt-0.5 accent-brandTeal-500 shrink-0" />
                      <span className="flex-1 text-[11px] text-slate-200 font-semibold leading-snug text-left">
                        <span className="block font-sans">Custom Amount</span>
                        <span className="text-slate-400 font-mono text-[10px]">Enter a manual invoice total</span>
                      </span>
                    </label>
                  </div>
                  {invoiceMilestone === 'retainer_monthly' && (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1 text-left font-sans">Billing month</label>
                        <input type="month" value={retainerBillingPeriod} onChange={(e) => {
                          const period = e.target.value;
                          setRetainerBillingPeriod(period);
                          const IH = window.InvoiceHelpers;
                          if (IH?.suggestRetainerMonthlySuffix) setInvoiceNumberSuffix(IH.suggestRetainerMonthlySuffix(period));
                        }} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 font-mono focus:outline-none focus:border-brandTeal-500" />
                      </div>
                      <p className="text-[9px] text-slate-500 leading-relaxed">Use a unique invoice suffix per month (e.g. M202607) so each monthly invoice is saved separately.</p>
                    </div>
                  )}
                  {invoiceMilestone === 'custom' && (
                    <div>
                      <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1 text-left font-sans">Custom Invoice Amount (Ex-VAT)</label>
                      <input type="number" value={customInvoiceAmount} onChange={(e) => setCustomInvoiceAmount(Number(e.target.value))} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 font-mono focus:outline-none focus:border-brandTeal-500" min="0" step="1000" />
                    </div>
                  )}
                  {billingMilestones.length === 0 && invoiceMilestone !== 'full' && invoiceMilestone !== 'retainer' && invoiceMilestone !== 'retainer_monthly' && invoiceMilestone !== 'custom' && (
                    <p className="text-[9px] text-amber-400 font-mono text-left">No billing gates available — select modules in the Planner tab to generate gate options.</p>
                  )}
                  <div className="pt-2 border-t border-brandNavy-800">
                    <label className="text-[9px] font-mono text-slate-400 uppercase block mb-1 text-left font-sans">Invoice Number Suffix</label>
                    <input type="text" value={invoiceNumberSuffix} onChange={(e) => setInvoiceNumberSuffix(e.target.value)} placeholder="01" className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 font-mono focus:outline-none focus:border-brandTeal-500" />
                    <span className="text-[9px] text-slate-500 block mt-1 text-left font-sans">Preview: {quoteId.replace('KC', 'INV')}{invoiceNumberSuffix || '01'}</span>
                  </div>
                </fieldset>
              )}

              {isInvoice && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1 text-left font-sans">Invoice Bill-To (SOLD TO)</legend>
                  {!useCustomInvoiceBillTo && (
                    <>
                      <div className="space-y-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">
                          {isAddendumInvoiceMode ? 'Addendum invoice addressed to' : 'Invoice addressed to'}
                        </span>
                        <p className="text-[9px] text-slate-500 leading-relaxed">
                          {isAddendumInvoiceMode
                            ? 'Uses the addendum party. Change on the Addendum tab or below.'
                            : 'Choose whether this invoice bills the client or sponsor from Documents.'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {['client', 'sponsor'].map((option) => (
                            <button
                              key={option}
                              type="button"
                              onClick={() => {
                                if (isAddendumInvoiceMode && invoiceTargetAddendum) {
                                  patchInvoiceTargetAddendum({ partySource: option });
                                } else {
                                  setInvoicePartySource(option);
                                }
                              }}
                              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                (isAddendumInvoiceMode
                                  ? (H.getAddendumPartySource(invoiceTargetAddendum, { contractPartySource }) || 'client')
                                  : invoicePartySource) === option
                                  ? 'bg-brandTeal-500 text-brandNavy-955 border-brandTeal-400'
                                  : 'bg-brandNavy-900 text-slate-400 border-brandNavy-700 hover:border-brandTeal-600'
                              }`}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed border border-brandNavy-800 rounded-lg p-3 bg-brandNavy-900/50">
                        Billing <strong className="text-slate-300">{invoicePartyLabel}</strong>:{' '}
                        <strong className="text-slate-300">{resolvedInvoiceBillTo.company || '—'}</strong>
                        {resolvedInvoiceBillTo.rep ? ` · ${resolvedInvoiceBillTo.rep}` : ''}
                      </p>
                    </>
                  )}
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-brandNavy-800 hover:border-brandNavy-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomInvoiceBillTo}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setUseCustomInvoiceBillTo(enabled);
                        if (enabled && !invoiceBillToCompany && !invoiceBillToRep) copyContractClientToInvoiceBillTo();
                      }}
                      className="mt-0.5 accent-brandTeal-500 shrink-0"
                    />
                    <span className="text-[11px] text-slate-300 leading-relaxed">Bill to a custom company (overrides client/sponsor selection)</span>
                  </label>
                  {useCustomInvoiceBillTo && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={copyContractClientToInvoiceBillTo}
                        className="text-[10px] font-bold uppercase tracking-wider text-brandTeal-400 hover:text-brandTeal-300"
                      >
                        Copy from client
                      </button>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Bill-To Company Legal Name</label><input type="text" value={invoiceBillToCompany} onChange={(e) => setInvoiceBillToCompany(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Bill-To Representative Name</label><input type="text" value={invoiceBillToRep} onChange={(e) => setInvoiceBillToRep(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 font-sans font-semibold" /></div>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold font-sans font-semibold">Bill-To Registered Address</label><input type="text" value={invoiceBillToAddress} onChange={(e) => setInvoiceBillToAddress(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">
                          Bill-To Company TIN (EOPT)
                          {invoiceBillToTin && <span className={`ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded ${validatePhilippineTIN(invoiceBillToTin) ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>{validatePhilippineTIN(invoiceBillToTin) ? '✓ Valid' : '✗ Invalid'}</span>}
                        </label>
                        <input type="text" value={invoiceBillToTin} onChange={(e) => setInvoiceBillToTin(formatTINInput(e.target.value))} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 font-mono focus:outline-none focus:border-brandTeal-500" />
                      </div>
                    </div>
                  )}
                </fieldset>
              )}

              {/* Dynamic Compliance & SLA Configuration Controls */}
              {(activePMO || activeGov || isProEngagement) && (isPackage || isQuoteOrInvoice) && (
                <div className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-4 text-left font-sans font-semibold">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold block text-left font-sans font-semibold">Compliance &amp; SLA Configuration</span>
                  
                  <div className="space-y-3 text-left">
                    <div>
                      <div className="flex justify-between items-center mb-1"><label className="text-[10px] font-mono uppercase text-brandTeal-400 font-bold">Support Term Duration</label><span className="text-xs text-brandTeal-300 font-mono font-bold">{subscriptionMonths} Months</span></div>
                      <input type="range" min="1" max="24" step="1" value={subscriptionMonths} onChange={(e) => setSubscriptionMonths(parseInt(e.target.value))} className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1 rounded cursor-pointer mb-2" />
                    </div>
                    {!STARTER_UI && (
                      <>
                        <div>
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 font-semibold">DPA Retention (Days)</label>
                          <input type="number" value={dpaRetentionDays} onChange={(e) => setDpaRetentionDays(Number(e.target.value))} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 font-mono focus:outline-none" min="1" max="365" />
                          <span className="text-[9px] text-slate-500 block mt-1 text-left">Personnel records purged after termination.</span>
                        </div>
                        
                        <div>
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">SLA Cure Period (Days)</label>
                          <input type="number" value={slaCureDays} onChange={(e) => setSlaCureDays(Number(e.target.value))} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 font-mono focus:outline-none" min="1" max="90" />
                          <span className="text-[9px] text-slate-500 block mt-1 text-left">Days granted to fix Severity 1 breaches.</span>
                        </div>

                        <div>
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 font-semibold">Severity 1 Breach Limit (Months)</label>
                          <input type="number" value={slaRecurrenceMonths} onChange={(e) => setSlaRecurrenceMonths(Number(e.target.value))} className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2 text-slate-200 font-mono focus:outline-none" min="1" max="12" />
                          <span className="text-[9px] text-slate-500 block mt-1 text-left">Failure timeline before exit right triggers.</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {STARTER_UI && isPackage && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1">SLA template</legend>
                  <p className="text-[9px] text-slate-500 leading-relaxed">
                    Edit your agency&apos;s support standards for the SLA page. Optional placeholders: {'{agencyName}'}, {'{clientName}'}, {'{clientRep}'}.
                  </p>
                  <textarea
                    rows={14}
                    value={slaContent}
                    onChange={(e) => setSlaContent(e.target.value)}
                    className="w-full bg-brandNavy-900 border border-brandNavy-750 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 resize-y text-xs leading-relaxed font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setSlaContent(defaultAgencySlaContent())}
                    className="px-2.5 py-1.5 text-[10px] font-bold rounded bg-brandNavy-900 text-slate-400 border border-brandNavy-700 uppercase hover:text-brandTeal-300"
                  >
                    Reset to default template
                  </button>
                </fieldset>
              )}

              {/* Client — cover, proposal, roadmap/timeline, SLA */}
              {(isNda || isPackage) && (
                <fieldset className={`${isPackage ? 'bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl' : ''} space-y-3 text-left font-sans`}>
                  {isPackage && (
                    <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1 text-left font-sans">Client</legend>
                  )}
                  {isPackage && (
                    <p className="text-[9px] text-slate-500 leading-relaxed">Used on cover page, proposal, roadmap/timeline, and SLA.</p>
                  )}
                  {isNda && (
                    <>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Effective Date</label><input type="text" value={ndaEffectiveDate} onChange={(e) => setNdaEffectiveDate(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold font-sans">Disclosing Party (Party A)</label><input type="text" value={issuerLegalName} disabled className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-400 cursor-not-allowed" /></div>
                    </>
                  )}
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Company Legal Name</label><input type="text" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Representative Name</label><input type="text" value={clientRep} onChange={(e) => setClientRep(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 font-sans font-semibold" /></div>
                  {isPackage && <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold font-sans font-semibold">Registered Address</label><input type="text" value={clientAddress} onChange={(e) => setClientAddress(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>}
                  {isPackage && (
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">
                        Company TIN (EOPT)
                        {clientTin && <span className={`ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded ${validatePhilippineTIN(clientTin) ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>{validatePhilippineTIN(clientTin) ? '✓ Valid' : '✗ Invalid'}</span>}
                      </label>
                      <input type="text" value={clientTin} onChange={(e) => setClientTin(formatTINInput(e.target.value))} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 font-mono focus:outline-none focus:border-brandTeal-500" />
                    </div>
                  )}
                  {isNda && (
                    <>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 font-semibold">Confidentiality Term</label><input type="text" value={ndaTerm} onChange={(e) => setNdaTerm(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 font-semibold">Purpose of Disclosure</label><textarea rows="3" value={ndaPurpose} onChange={(e) => setNdaPurpose(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 resize-none text-xs text-left" /></div>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 font-semibold">Governing Law Jurisdiction</label><input type="text" value={ndaJurisdiction} onChange={(e) => setNdaJurisdiction(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                    </>
                  )}
                </fieldset>
              )}

              {isPackage && (
                <fieldset className="bg-brandNavy-955 border border-brandNavy-700 p-4 rounded-xl space-y-3 text-left">
                  <legend className="text-[10px] font-mono tracking-wider uppercase text-brandTeal-400 font-bold px-1 text-left font-sans">Sponsor</legend>
                  <p className="text-[9px] text-slate-500 leading-relaxed">Used on official price quotation &amp; terms.</p>
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-brandNavy-800 hover:border-brandNavy-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomSponsor}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setUseCustomSponsor(enabled);
                        if (enabled && !sponsorCompany && !sponsorRep) copyClientToSponsor();
                      }}
                      className="mt-0.5 accent-brandTeal-500 shrink-0"
                    />
                    <span className="text-[11px] text-slate-300 leading-relaxed">Use a different company than the client for the quotation</span>
                  </label>
                  {!useCustomSponsor && (
                    <p className="text-[10px] text-slate-500 leading-relaxed border border-brandNavy-800 rounded-lg p-3 bg-brandNavy-900/50">
                      Quotation uses the client: <strong className="text-slate-300">{clientCompany || '—'}</strong>
                      {clientRep ? ` · ${clientRep}` : ''}
                    </p>
                  )}
                  {useCustomSponsor && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={copyClientToSponsor}
                        className="text-[10px] font-bold uppercase tracking-wider text-brandTeal-400 hover:text-brandTeal-300"
                      >
                        Copy from client
                      </button>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Sponsor Company Legal Name</label><input type="text" value={sponsorCompany} onChange={(e) => setSponsorCompany(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Sponsor Representative Name</label><input type="text" value={sponsorRep} onChange={(e) => setSponsorRep(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 font-sans font-semibold" /></div>
                      <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold font-sans font-semibold">Sponsor Registered Address</label><input type="text" value={sponsorAddress} onChange={(e) => setSponsorAddress(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">
                          Sponsor Company TIN (EOPT)
                          {sponsorTin && <span className={`ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded ${validatePhilippineTIN(sponsorTin) ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>{validatePhilippineTIN(sponsorTin) ? '✓ Valid' : '✗ Invalid'}</span>}
                        </label>
                        <input type="text" value={sponsorTin} onChange={(e) => setSponsorTin(formatTINInput(e.target.value))} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 font-mono focus:outline-none focus:border-brandTeal-500" />
                      </div>
                    </div>
                  )}
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Sponsor Title</label><input type="text" value={proposalSponsor} onChange={(e) => setProposalSponsor(e.target.value)} placeholder="e.g. General Manager (Operations)" className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 font-sans" /></div>
                  <div className="pt-2 border-t border-brandNavy-800 space-y-2">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block font-semibold">Contract signatory</span>
                    <p className="text-[9px] text-slate-500 leading-relaxed">Who legally signs the e-contract in Contract Ledger.</p>
                    <div className="flex flex-wrap gap-2">
                      {['client', 'sponsor'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setContractPartySource(option)}
                          className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                            contractPartySource === option
                              ? 'bg-brandTeal-500 text-brandNavy-955 border-brandTeal-400'
                              : 'bg-brandNavy-900 text-slate-400 border-brandNavy-700 hover:border-brandTeal-600'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </fieldset>
              )}

              {(isProposal || isRoadmap || isPackage) && (
                <div className="space-y-3 text-left font-sans font-semibold">
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">Target Launch Date</label><input type="text" value={targetStartDate} onChange={(e) => setTargetStartDate(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                  
                  {(isProposal || isPackage) && (
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">Project Timeline Duration</label>
                      <div className="flex gap-2 text-left">
                        <input type="text" value={overrideTimeline} onChange={(e) => setOverrideTimeline(e.target.value)} placeholder={calculatedTimeline} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 font-medium font-sans" />
                        {overrideTimeline && <button onClick={() => setOverrideTimeline('')} className="px-3 bg-brandNavy-800 text-slate-400 hover:text-brandTeal-400 rounded text-xs font-bold font-sans font-semibold font-sans">Auto</button>}
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-1 text-left font-semibold font-sans">Calculated from selections: {calculatedTimeline}</span>
                    </div>
                  )}
                </div>
              )}

              {(isRoadmap || isPackage) && (
                <div>
                  <div className="py-2 border-t border-brandNavy-750 mt-2 text-left">
                    <div className="flex justify-between items-center mb-1"><label className="text-[10px] font-mono uppercase text-brandTeal-400 font-bold text-left">Execution Pace Speed</label><span className="text-xs text-brandTeal-300 font-mono font-sans">{weeklyHours} hrs/wk</span></div>
                    <input type="range" min="4" max="40" step="2" value={weeklyHours} onChange={(e) => setWeeklyHours(parseInt(e.target.value))} className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1 rounded cursor-pointer font-sans" />
                  </div>
                  <div className="py-2 border-t border-brandNavy-750 text-left">
                    <div className="flex justify-between items-center mb-1"><label className="text-[10px] font-mono uppercase text-brandTeal-400 font-bold text-left">Client Review Buffer (Weeks)</label><span className="text-xs text-brandTeal-300 font-mono font-sans">+{clientReviewWeeks} wk(s)</span></div>
                    <input type="range" min="0" max="4" step="1" value={clientReviewWeeks} onChange={(e) => setClientReviewWeeks(parseInt(e.target.value))} className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1 rounded cursor-pointer" />
                  </div>
                  <div className="py-2 border-t border-brandNavy-750 text-left">
                    <div className="flex justify-between items-center mb-1"><label className="text-[10px] font-mono uppercase text-brandTeal-400 font-bold text-left">Contingency Reserve</label><span className="text-xs text-brandTeal-300 font-sans">+{frictionBuffer}%</span></div>
                    <input type="range" min="0" max="30" step="5" value={frictionBuffer} onChange={(e) => setFrictionBuffer(parseInt(e.target.value))} className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1 rounded cursor-pointer" />
                  </div>
                </div>
              )}

              {(view !== 'nda' && view !== 'roadmap') && (
                <div className="grid grid-cols-2 gap-3 text-left">
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Prepared By</label><input type="text" value={issuerLegalName} disabled className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-400 cursor-not-allowed font-sans font-semibold" /></div>
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">Strategist Title</label><input type="text" value={preparerTitle} onChange={(e) => setPreparerTitle(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                </div>
              )}

              {(isProposal || isPackage) && (
                <div className="space-y-3 text-left font-sans font-medium">
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">Proposal Date</label><input type="text" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 font-sans" /></div>
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Onboarding Checklist</label><textarea rows="3" value={preDiagnosticList} onChange={(e) => setPreDiagnosticList(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 resize-none text-xs font-sans font-medium" /></div>
                  <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-semibold">Core Objectives</label><textarea rows="3" value={proposalObjectives} onChange={(e) => setProposalObjectives(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500 resize-none text-xs font-sans font-medium" /></div>
                </div>
              )}

              {(isQuoteOrInvoice || isPackage) && (
                <div className="grid grid-cols-2 gap-3 text-left font-sans font-semibold">
                  {(view === 'quotation' || isPackage) ? (
                    <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left font-sans font-semibold">Validity</label><input type="text" value={quoteValidity} onChange={(e) => setQuoteValidity(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                  ) : !isAddendumInvoiceMode ? (
                    <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 text-left">Due Date</label><input type="text" value={invoiceDueDate} onChange={(e) => setInvoiceDueDate(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>
                  ) : null}
                  {!isPackage && <div><label className="text-[10px] font-mono text-slate-400 uppercase block mb-1 font-sans">Date</label><input type="text" value={quoteDate} onChange={(e) => setQuoteDate(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-slate-200 focus:outline-none focus:border-brandTeal-500" /></div>}
                </div>
              )}
            </div>

            <button
              onClick={handlePrint}
              disabled={(isPackage && !hasPrintSection) || (isAddendum && !activeAddendum)}
              className={`w-full py-3 font-bold rounded-lg text-xs uppercase tracking-wider flex items-center justify-center shadow-lg font-sans font-extrabold ${(isPackage && !hasPrintSection) || (isAddendum && !activeAddendum) ? 'bg-brandNavy-800 text-slate-500 cursor-not-allowed' : 'bg-brandTeal-500 hover:bg-brandTeal-400 text-slate-950'}`}
            >
              <IconPrint className="w-4 h-4 mr-1.5" /> Print {isNda ? "NDA" : isAddendum ? "Addendum" : isInvoice ? "Invoice" : isPackage ? "Package" : ""}
            </button>

            {isInvoice && (
              <button
                type="button"
                onClick={handleIssueInvoice}
                disabled={!isAuthed || isIssuingInvoice || (isAddendumInvoiceMode && !invoiceTargetAddendum)}
                className="w-full py-3 mt-2 font-bold rounded-lg text-xs uppercase tracking-wider flex items-center justify-center shadow-lg font-sans bg-brandNavy-800 hover:bg-brandNavy-750 text-brandTeal-400 border border-brandTeal-500/40 disabled:opacity-50"
              >
                {isIssuingInvoice ? 'Issuing…' : isAddendumInvoiceMode ? 'Issue Addendum Invoice' : 'Issue Invoice'}
              </button>
            )}
          </aside>
        );
      };

      const renderAddendumWorkspace = () => {
        if (!addendumModulesReady) {
          return <p className="text-slate-400 text-sm p-6">Loading addendum tools…</p>;
        }
        const UI = window.PlannerAddendumUI;
        if (!UI) return <p className="text-slate-400 text-sm">Addendum module failed to load.</p>;
        return (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full min-h-0 planner-split-layout animate-fade-in font-sans text-left">
            <div className="xl:col-span-4 planner-split-panel no-print space-y-4">
              {UI.renderAddendumEditor({
                addenda,
                activeAddendum,
                activeAddendumId,
                setActiveAddendumId,
                onCreateFromTemplate: createAddendumFromTemplate,
                onPatchActive: patchActiveAddendum,
                onToggleTask: toggleAddendumTask,
                onUpdateHours: updateAddendumTaskHours,
                onDeleteActive: deleteActiveAddendum,
                templates: addendumTemplates,
                H,
                formatCurrency,
                rates: hourlyRates,
                getRateForTier,
                addendumEconomics,
                contractPartySource,
              })}
              {renderSettingsSidebar({ embedded: true })}
            </div>
            {UI.renderAddendumPrintDocument({
              addendum: activeAddendum,
              parentQuoteId: quoteId,
              addendumParty: resolvedAddendumParty,
              addendumPartyLabel,
              quoteDate,
              preparedBy,
              preparerTitle,
              includeTax,
              formatCurrency,
              addendumEconomics,
              renderSignaturesBlock,
              renderPrintBrandLogo,
              brand,
              issuerCompanyName,
              starterUi: STARTER_UI,
              BrandLogo,
            })}
          </div>
        );
      };

      const renderDocumentPrintCanvas = () => {
        const isNda = view === 'nda';
        const isProposal = view === 'package';
        const isRoadmap = view === 'package';
        const isQuoteOrInvoice = view === 'invoice' || view === 'package';
        const isInvoice = view === 'invoice';
        const isPackage = view === 'package';

        const NdaBody = (
          <div className="space-y-4 text-left font-sans text-slate-700 font-semibold font-medium leading-relaxed font-sans">
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-lg font-bold text-slate-900 uppercase text-center font-sans">MUTUAL NON-DISCLOSURE AGREEMENT</h2>
              <p className="text-[11px] font-mono text-slate-500 text-center font-sans">Effective Date: {ndaEffectiveDate || "________________________"}</p>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed text-left font-sans font-sans">This Mutual Non-Disclosure Agreement (the "Agreement") is entered into and made effective as of the date written above (the "Effective Date") by and between:</p>
            <div className="pl-6 space-y-3 text-slate-800 font-sans font-semibold border-l-2 border-brandTeal-500 bg-slate-50 p-4 rounded text-left text-sm font-sans">
              <div><strong>Party A (Disclosing/Receiving):</strong> {issuerLegalName}, representing <strong>{issuerCompanyName}</strong>.</div>
              <div><strong>Party B (Disclosing/Receiving):</strong> {clientRep || "________________________"}, representing <strong>{clientCompany || "________________________"}</strong>.</div>
            </div>
            <div className="space-y-4 pt-2 text-sm leading-relaxed text-slate-700 text-left font-sans">
              <div><strong className="block text-slate-900 uppercase text-left font-sans">1. Purpose of Sharing Information</strong>The Parties wish to explore and evaluate a prospective business relationship and joint service implementation program, specifically relating to: <strong>{ndaPurpose}</strong>.</div>
              <div><strong className="block text-slate-900 uppercase text-left font-sans">2. What is Classified as Confidential (RA 10173)</strong>"Confidential Information" covers all proprietary, business, operational, and software records shared by either Party. Both Parties agree to handle all personal data processed with highest administrative security standards.</div>
              <div><strong className="block text-slate-900 uppercase text-left font-sans">3. Protection of Shared Information</strong>The Receiving Party agrees to hold all Confidential Information in strict confidence and use it solely for SOW project evaluations.</div>
              <div><strong className="block text-slate-900 uppercase text-left font-sans">4. Term & Governing Law</strong>This Agreement shall remain in full force and effect for a period of <strong>{ndaTerm}</strong>. It shall be governed by the laws of the Republic of the Philippines. Any dispute shall fall under the exclusive jurisdiction of the courts of <strong>{ndaJurisdiction}</strong>.</div>
            </div>
            {renderSignaturesBlock("Accepted & Authorized on behalf of Party B:", "Accepted & Authorized on behalf of Party A:")}
          </div>
        );

        const ProposalBody = (
          <div className="text-left font-sans text-sm text-slate-700 font-semibold font-medium leading-relaxed font-sans">
            <div className="mb-8 text-left font-sans font-semibold">
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-bold text-left font-sans">1. Main SOW Project Objectives</h4>
              <p className="text-xs bg-slate-50 p-4 rounded border border-slate-100 font-semibold mb-4 text-slate-800 text-left leading-relaxed font-sans">{proposalObjectives}</p>

              {!STARTER_UI && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 print-pill text-left font-sans">
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-1.5 text-left font-sans">
                  <IconAlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 font-sans" />
                  Operational leak snapshot
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-700 mb-4 border-b border-slate-200 pb-4 font-semibold text-left font-sans font-semibold">
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block font-bold mb-0.5 text-left font-sans">TOTAL ACTIVE STAFF:</span>
                    {staffCount} Employees
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block font-bold mb-0.5 text-left font-sans font-bold">AVERAGE PAYROLL VALUE:</span>
                    {formatCurrency(monthlySalary)} / month
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-400 block font-bold mb-0.5 text-left font-sans">DAILY WASTED HOURS:</span>
                    {wastedHours.toFixed(1)} Hours per Day
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-left font-sans font-bold font-bold">
                  <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 text-rose-900 font-bold text-left font-sans font-bold print-chaos-metric print-chaos-leak">
                    <span className="text-[9px] font-mono text-rose-500 uppercase font-bold block mb-1 text-left font-sans">ANNUAL OPERATIONAL LEAKAGE (CHAOS TAX):</span>
                    <span className="text-sm font-black font-mono font-sans">{formatCurrency(annualOperationalLeakage)}</span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-emerald-900 font-bold text-left font-sans font-bold print-chaos-metric print-chaos-recovery">
                    <span className="text-[9px] font-mono text-emerald-500 uppercase font-bold block mb-1 text-left font-sans">ESTIMATED RECOVERY POTENTIAL (YEAR 1 TARGET):</span>
                    <span className="text-sm font-black font-mono font-sans">{formatCurrency(recoveryPotential)}</span>
                  </div>
                </div>
              </div>
              )}
            </div>

            {!STARTER_UI && (
            <>
            <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-4 font-bold text-left font-sans">2. {getModuleCardsHeading()}</h4>
            {renderEngagementPackageCallout()}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 text-left font-sans print-avoid-break" role="list" aria-label={isProEngagement ? 'Platform services' : 'Project modules'}>
              {isProEngagement ? (
                <article role="listitem" className="print-module-card border rounded-xl p-4 flex flex-col justify-between min-h-[19rem] text-left font-sans border-brandAmber-500 bg-amber-50/20 font-bold md:col-span-2 lg:col-span-4">
                  <div className="space-y-3 text-left font-sans">
                    <div className="flex justify-between items-center text-left font-sans">
                      <div className="min-w-[3.5rem] px-2 h-8 rounded-lg flex items-center justify-center font-bold text-[10px] bg-amber-100 text-amber-800">
                        {proProductMeta?.skuLabel || 'PRO 1 · Agency Ops'}
                      </div>
                      <span className="text-[8px] font-mono font-bold uppercase text-slate-400 text-left font-sans font-bold">ACTIVE IN SOW</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 text-left font-sans">{proProductMeta?.title || 'Agency Ops Platform'}</h3>
                    <p className="text-[10px] font-semibold text-slate-500 text-left leading-normal font-sans">{proProductMeta?.description || 'White-label quote-to-cash for creative and digital agencies.'}</p>
                    <ul className="text-[10px] space-y-1.5 pt-1 overflow-y-auto font-medium text-left font-sans font-semibold">
                      {tasks.filter(t => t.selected && (t.category?.startsWith('PRO ') || t.id?.startsWith('pro1-'))).map(t => (
                        <li key={t.id} className="flex items-start gap-2 text-left font-sans">
                          <ShieldIndicator active={t.selected} aria-hidden="true" />
                          <span className="text-slate-800 font-bold">{getShortDeliverableName(t.deliverable)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ) : [
                { id: 'MOD 1', num: 1, isActive: activeDiag },
                { id: 'MOD 2', num: 2, isActive: activeSOP },
                { id: 'MOD 3', num: 3, isActive: activePMO },
                { id: 'MOD 4', num: 4, isActive: activeGov },
              ].map(mod => (
                <article key={mod.id} role="listitem" className={`print-module-card border rounded-xl p-4 flex flex-col justify-between min-h-[19rem] text-left font-sans ${mod.isActive ? 'border-brandTeal-500 bg-brandTeal-50/20 font-bold' : 'border-dashed bg-slate-50 opacity-50'}`}>
                  <div className="space-y-3 text-left font-sans">
                    <div className="flex justify-between items-center text-left font-sans">
                      <div className={`${STARTER_UI ? 'min-w-[3.5rem] px-2' : 'w-14'} h-8 rounded-lg flex items-center justify-center font-bold text-[10px] ${mod.isActive ? 'bg-brandTeal-100 text-brandTeal-700' : 'bg-slate-200 text-slate-500'}`}>
                        {STARTER_UI ? modChip(mod.num) : mod.id}
                      </div>
                      <span className="text-[8px] font-mono font-bold uppercase text-slate-400 text-left font-sans font-bold">{mod.isActive ? 'ACTIVE IN SOW' : 'ROADMAP'}</span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 text-left font-sans">{modTitle(mod.num)}</h3>
                    <p className="text-[10px] font-semibold text-slate-500 text-left leading-normal font-sans">{modDesc(mod.num)}</p>
                    <ul className="text-[10px] space-y-1.5 pt-1 overflow-y-auto font-medium text-left font-sans font-semibold">
                      {tasks.filter(t => t.category?.startsWith(mod.id)).map(t => (
                        <li key={t.id} className="flex items-start gap-2 text-left font-sans">
                          <ShieldIndicator active={t.selected} aria-hidden="true" />
                          <span className={t.selected && mod.isActive ? 'text-slate-800 font-bold' : 'text-slate-400 font-medium font-sans'}>{getShortDeliverableName(t.deliverable)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
            </>
            )}
            <div className="mb-8 text-left font-sans"><h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-2 font-bold text-left font-sans font-bold">{STARTER_UI ? '2' : '3'}. What we need from you</h4><div className="text-xs bg-slate-50 p-5 rounded border border-slate-200 whitespace-pre-wrap font-semibold text-slate-800 text-left font-sans">{preDiagnosticList}</div></div>
            <div className="mb-8 text-left font-sans print-avoid-break" style={{ pageBreakBefore: 'always', breakBefore: 'page' }}>
              <h4 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-4 text-left font-sans font-bold">Appendix A — Deliverable specifications</h4>
              <div className="space-y-4 font-medium text-left font-sans">
                {tasks.filter(t => t.selected).map(task => (
                  <div key={task.id} className="border border-slate-200 rounded-lg p-5 bg-slate-50/40 text-left font-sans font-semibold print-avoid-break">
                    <div className="flex justify-between pb-3 border-b mb-3 text-left font-sans font-semibold"><h5 className="font-bold text-sm text-brandTeal-600 text-left font-sans">{task.deliverable}</h5><span className="text-[9px] font-mono uppercase bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-bold font-sans">{H.getTaskCategoryLabel ? H.getTaskCategoryLabel(task) : formatCategoryDisplay(task.category)}</span></div>
                    <p className="text-xs text-slate-600 mb-4 font-semibold text-left leading-relaxed font-sans">{task.description}</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-slate-800 leading-relaxed text-left font-semibold font-sans">
                      <div><span className="text-[9px] font-mono uppercase text-slate-400 block font-bold mb-1 text-left font-sans">What we do:</span>{task.scopeDetails?.activities || "Custom action"}</div>
                      <div><span className="text-[9px] font-mono uppercase text-slate-400 block font-bold mb-1 text-left font-sans">What we need:</span>{task.scopeDetails?.expectations || "Custom input"}</div>
                      <div><span className="text-[9px] font-mono uppercase text-slate-400 block font-bold mb-1 text-left font-sans">What you receive:</span>{task.scopeDetails?.output || "Custom output"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {renderSowAcceptanceMini()}
          </div>
        );

        const RoadmapBody = (
          <div className="text-left font-sans text-sm text-slate-700 leading-relaxed font-sans">
            {scheduledTasks.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed rounded-xl max-w-xl mx-auto my-12 font-sans text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400 font-sans"><IconCalendar /></div>
                <h4 className="text-base font-bold text-slate-900 leading-tight text-center font-sans font-bold">No Active Tasks Selected</h4>
                <p className="text-xs text-slate-500 leading-relaxed mt-1 text-center font-sans">Please return to the Scope Planner tab and check one or more deliverables to generate your synchronized Gantt timeline.</p>
              </div>
            ) : (
              <div className="space-y-6 text-left font-sans font-medium">
                <div className="roadmap-gantt-chart border border-slate-200 rounded-xl p-6 bg-slate-50/50 font-sans font-medium text-left font-sans">
                  <h4 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest mb-4 text-left font-sans font-bold font-sans">Implementation Timeline Map (Gantt view)</h4>
                  <div className="roadmap-gantt-grid overflow-x-auto space-y-4 text-left font-sans font-medium">
                    <div className="grid grid-cols-12 gap-2 text-center text-[10px] font-mono font-bold text-slate-500 uppercase pb-2 border-b border-slate-200 text-left font-sans font-bold font-sans">
                      <div className="col-span-4 text-left font-sans font-bold">Expert</div>
                      <div className="col-span-8 grid text-center font-sans font-bold roadmap-gantt-week-header" style={{ gridTemplateColumns: `repeat(${maxWeek}, minmax(0, 1fr))` }}>
                        {Array.from({ length: maxWeek }, (_, i) => i + 1).map(wk => <div key={wk} className="border-l border-slate-200 pl-1 text-center font-sans font-bold font-sans">Wk {wk}</div>)}
                      </div>
                    </div>
                    {['MOD 1', 'MOD 2', 'MOD 3', 'MOD 4'].map((modPrefix) => {
                      const phaseTasks = scheduledTasks.filter(t => t.category?.startsWith(modPrefix));
                      if (phaseTasks.length === 0) return null;
                      const phaseName = modPhase(Number(modPrefix.replace('MOD ', '')));
                      
                      const isSubsequentPhase = modPrefix === 'MOD 2' || modPrefix === 'MOD 3';
                      let previousPhaseTasks = [];
                      if (modPrefix === 'MOD 2') previousPhaseTasks = scheduledTasksAndPhases.scheduledP1 ?? [];
                      if (modPrefix === 'MOD 3') previousPhaseTasks = (scheduledTasksAndPhases.scheduledP2?.length ?? 0) > 0 ? scheduledTasksAndPhases.scheduledP2 : (scheduledTasksAndPhases.scheduledP1 ?? []);

                      const showReviewGap = isSubsequentPhase && previousPhaseTasks.length > 0 && clientReviewWeeks > 0;
                      const maxPrevEndWeek = previousPhaseTasks.length > 0 ? Math.max(...previousPhaseTasks.map(t => t.endWeek)) : 0;
                      const reviewStartWk = showReviewGap ? maxPrevEndWeek + 1 : 1;
                      const reviewEndWk = showReviewGap ? reviewStartWk + clientReviewWeeks - 1 : 1;

                      return (
                        <div key={modPrefix} className="space-y-3 font-medium text-left font-sans font-sans">
                          <div className="text-[11px] font-extrabold text-brandTeal-600 uppercase border-b border-slate-200 pb-1 mt-4 text-left font-sans font-extrabold font-sans">{phaseName}</div>
                          
                          {showReviewGap && (
                            <div className="grid grid-cols-12 gap-2 items-center text-xs mt-2 mb-3 text-left font-sans font-semibold">
                              <div className="col-span-4 pr-2 font-medium text-left font-sans">
                                <div className="font-bold text-slate-400 italic text-left font-sans">Your review period</div>
                              </div>
                              <div className="col-span-8 grid h-6 items-center roadmap-gantt-row-grid" style={{ gridTemplateColumns: `repeat(${maxWeek}, minmax(0, 1fr))` }}>
                                <div className="h-5 roadmap-gantt-bar opacity-80" style={{ gridColumnStart: reviewStartWk, gridColumnEnd: reviewEndWk + 1 }}>
                                  <div className="roadmap-gantt-bar-fill bg-amber-50 border border-amber-200 shadow-sm" aria-hidden="true" />
                                  <span className="roadmap-gantt-bar-label text-amber-700 font-bold font-mono text-[8px] uppercase">⏳ Review Buffer</span>
                                </div>
                              </div>
                            </div>
                          )}

                          {phaseTasks.map(task => (
                            <div key={task.id} className="grid grid-cols-12 gap-2 items-center text-xs text-left font-sans">
                              <div className="col-span-4 pr-2 font-medium text-left font-sans font-semibold min-w-0">
                                <div className="font-bold text-slate-900 line-clamp-1 text-left font-sans font-bold" title={task.deliverable}>{task.deliverable}</div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-left font-sans">{renderConsultantBadge(task.tier)}</div>
                              </div>
                              <div className="col-span-8 grid h-8 items-center text-center font-sans font-bold font-sans roadmap-gantt-row-grid min-w-0" style={{ gridTemplateColumns: `repeat(${maxWeek}, minmax(0, 1fr))` }}>
                                {task.isRetainer ? (
                                  <div className="h-6 roadmap-gantt-bar" style={{ gridColumn: `${task.startWeek} / span ${maxWeek - task.startWeek + 1}` }} title={`Continuous ${modTitle(4)}`}>
                                    <div className="roadmap-gantt-bar-fill bg-indigo-50 border border-indigo-200 shadow-sm" aria-hidden="true" />
                                    <span className="roadmap-gantt-bar-label text-indigo-700 font-bold font-mono text-[9px] uppercase tracking-wider">Continuous {modTitle(4)}</span>
                                  </div>
                                ) : (
                                  <div className="h-6 roadmap-gantt-bar" style={{ gridColumnStart: task.startWeek, gridColumnEnd: task.endWeek + 1 }} title={`Wk ${task.startWeek} - ${task.endWeek}`}>
                                    <div className="roadmap-gantt-bar-fill bg-brandTeal-50 border border-brandTeal-200 shadow-sm" aria-hidden="true" />
                                    <span className="roadmap-gantt-bar-label text-brandTeal-800 font-bold font-mono text-[9px] uppercase">Wk {task.startWeek} - {task.endWeek}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

        const SlaBody = (
          <div className="space-y-6 text-slate-800 font-sans text-left">
            <p className="text-xs leading-relaxed font-medium text-left text-slate-700 font-sans">
              This Service Level Agreement (SLA) outlines the performance, support, and maintenance standards provided by <strong>{issuerCompanyName}</strong> ("Service Provider") to <strong>{resolvedClientParty.company || "the Client"}</strong> ("Client") for the continuous operation of the deployed software infrastructure and automated workflows.
            </p>

            <div className="space-y-5 font-medium text-left text-slate-700 font-sans">
              <div>
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold">1. Purpose and Covered Modules</h4>
                <p className="text-xs mb-2 leading-relaxed text-left font-sans">This SLA specifically covers the following active deliverables in this Statement of Work:</p>
                <ul className="list-disc pl-5 text-xs space-y-1.5 text-slate-700 leading-relaxed text-left font-sans">
                  {activePMO && <li><strong>MOD 3 ({modTitle(3)}):</strong> Workspace hosting, digital approval forms, and user access.</li>}
                  {activeGov && <li><strong>MOD 4 ({modTitle(4)}):</strong> Platform hosting, bi-weekly operations check-ins, and semi-annual system health checks.</li>}
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans">2. System Availability & Hosting (Uptime)</h4>
                <p className="text-xs mb-2 leading-relaxed text-left font-sans">To ensure your daily operations run without interruption, we commit to the following availability standards:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700 text-left font-sans">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print-pill text-left leading-relaxed font-sans">
                    <span className="block font-bold text-brandTeal-600 uppercase font-mono text-[10px] mb-1 text-left font-sans font-semibold">Target Uptime</span>
                    <strong>99.9% availability</strong> for the Core Workspace portal and cloud database during regular business hours.
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print-pill text-left leading-relaxed font-sans">
                    <span className="block font-bold text-brandTeal-600 uppercase font-mono text-[10px] mb-1 text-left font-sans font-semibold">Maintenance Windows</span>
                    Routine updates scheduled outside standard operating hours. 48-hour notice provided for planned downtime.
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold font-sans font-bold">3. Incident Response & Resolution Matrix</h4>
                <p className="text-[11px] mb-3 text-slate-600 text-left leading-relaxed text-left font-sans font-medium">For system issues, password resets, or form-building requests submitted via the authorized portal during business hours (Mon-Fri, 9AM-5PM):</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left font-sans">
                  <div className="bg-rose-50/50 p-4 rounded-lg border border-rose-200 print-pill text-left font-sans">
                    <div className="font-bold text-rose-700 text-[10px] uppercase font-mono mb-1.5 flex items-center gap-1.5 text-left font-sans font-semibold"><IconCheckCircle /> Severity 1 (Critical)</div>
                    <div className="text-[10px] text-slate-700 leading-relaxed mb-3 text-left font-sans font-semibold"><strong>Condition:</strong> Core Workspace is completely down or inaccessible to all staff.</div>
                    <div className="text-[10px] border-t border-rose-200/50 pt-2 space-y-1 text-left font-sans font-semibold">
                      <div className="flex justify-between"><span>Response:</span><strong className="text-slate-900 font-sans">Within 2 hours</strong></div>
                      <div className="flex justify-between font-sans"><span>Resolution:</span><strong className="text-slate-900 font-sans">Within 8 hours</strong></div>
                    </div>
                  </div>
                  
                  <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-200 print-pill text-left font-sans">
                    <div className="font-bold text-amber-700 text-[10px] uppercase font-mono mb-1.5 flex items-center gap-1.5 text-left font-sans font-semibold"><IconCheckCircle /> Severity 2 (High)</div>
                    <div className="text-[10px] text-slate-700 leading-relaxed mb-3 text-left font-sans font-semibold"><strong>Condition:</strong> Critical approval workflow broken, severely impacting a business process.</div>
                    <div className="text-[10px] border-t border-amber-200/50 pt-2 space-y-1 text-left font-sans font-semibold">
                      <div className="flex justify-between font-sans"><span>Response:</span><strong className="text-slate-900 font-sans font-sans">Within 4 hours</strong></div>
                      <div className="flex justify-between font-sans font-sans"><span>Resolution:</span><strong className="text-slate-900 font-sans">Within 24 hours</strong></div>
                    </div>
                  </div>

                  <div className="bg-brandTeal-50/50 p-4 rounded-lg border border-brandTeal-200 print-pill text-left font-sans">
                    <div className="font-bold text-brandTeal-700 text-[10px] uppercase font-mono mb-1.5 flex items-center gap-1.5 text-left font-sans font-semibold"><IconCheckCircle /> Severity 3 (Normal)</div>
                    <div className="text-[10px] text-slate-700 leading-relaxed mb-3 text-left font-sans font-semibold"><strong>Condition:</strong> Routine IT requests, password resets, minor bugs, or simple edits.</div>
                    <div className="text-[10px] border-t border-brandTeal-200/50 pt-2 space-y-1 text-left font-sans font-semibold font-sans font-bold">
                      <div className="flex justify-between font-sans"><span>Response:</span><strong className="text-slate-900 font-sans">Within 24 hours</strong></div>
                      <div className="flex justify-between font-sans font-sans"><span>Resolution:</span><strong className="text-slate-900 font-bold text-teal-800">2-5 bus. days</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {activeGov && (
                <div className="text-left font-sans font-bold">
                  <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold">4. Ongoing Operations & Adoption Support</h4>
                  <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px] text-slate-700 leading-relaxed text-left font-sans font-semibold">
                    <li className="bg-slate-50 p-3 rounded border border-slate-200 print-pill">
                      <strong className="block text-slate-900 mb-1 text-left font-sans">Weekly Huddles</strong>
                      One structured weekly alignment call to review dashboards, audit system usage, and resolve bottlenecks.
                    </li>
                    <li className="bg-slate-50 p-3 rounded border border-slate-200 print-pill">
                      <strong className="block text-slate-900 mb-1 text-left font-sans">Action Items</strong>
                      Delivery of a weekly checklist following each huddle to maintain staff accountability.
                    </li>
                    <li className="bg-slate-50 p-3 rounded border border-slate-200 print-pill">
                      <strong className="block text-slate-900 mb-1 text-left font-sans font-sans">Continuous Training</strong>
                      Maintenance of the help library and quick-start guides to assist new hires.
                    </li>
                  </ul>
                </div>
              )}

              <div className="text-left font-sans font-semibold font-sans">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold">5. Client Responsibilities & Exclusions</h4>
                <p className="text-xs mb-2 leading-relaxed text-left text-slate-700 font-sans font-semibold font-sans">To meet these standards, the Client agrees to submit all IT and support requests exclusively through the designated support portal, and provide timely feedback on workflow designs.</p>
                <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed text-left text-left font-sans font-semibold">
                  <strong className="text-slate-700 font-sans">Exclusions:</strong> This SLA does not cover downtime caused by local internet outages, hardware failures on the Client's end, unauthorized modifications by the Client's administrators, or third-party software outages outside of the Core Workspace environment.
                </p>
              </div>

              <div className="text-left font-sans text-sm">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-sans font-bold">6. Data Processing Addendum (DPA) under RA 10173</h4>
                <p className="text-xs mb-2 leading-relaxed text-left text-slate-700 font-sans font-semibold">
                  Since Your Team Workspace (MOD 3) processes active company personnel data (leave applications, payroll details, directory rosters, and database credentials), the Parties agree to designate the Service Provider as the <strong>Personal Information Processor (PIP)</strong> and the Client as the <strong>Personal Information Controller (PIC)</strong> in accordance with the Philippine Data Privacy Act (RA 10173):
                </p>
                <ul className="list-disc pl-5 text-[11px] space-y-1.5 text-slate-700 leading-relaxed text-left font-sans font-semibold">
                  <li><strong>Administrative & Technical Safeguards:</strong> Service Provider implements robust encrypted database storage, strict authorization structures, and conditional access to prevent unauthorized collection or processing of employee profiles.</li>
                  <li><strong>Processor Mandate:</strong> Service Provider shall process personnel data strictly under instructions of the Client and solely for maintaining Workspace functionalities.</li>
                  <li><strong>Retention & Disposal:</strong> All stored database profiles will be securely exported and completely purged from the hosting tenants within <strong>{dpaRetentionDays} days</strong> of SOW contract termination.</li>
                </ul>
              </div>

              <div className="text-left font-sans text-sm font-sans">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold">7. Breach Remedies & Contract Termination</h4>
                <p className="text-xs leading-relaxed text-left text-slate-700 font-sans font-semibold font-sans">
                  To maintain operational accountability without introducing predatory cash-penalty structures, the Parties agree to the following cure and exit mechanisms:
                </p>
                <ul className="list-disc pl-5 text-[11px] space-y-1.5 text-slate-700 leading-relaxed text-left text-left font-sans font-semibold">
                  <li><strong>Right to Cure:</strong> In case of a continuous failure to meet Severity 1 (Uptime or 8hr Critical Resolution) metrics, Client must issue a formal written warning detailing the breach. Service Provider is granted a <strong>{slaCureDays}-day</strong> cure period to re-align performance.</li>
                  <li><strong>Termination Right:</strong> If Severity 1 performance breaches remain uncured or repeated for <strong>{slaRecurrenceMonths} consecutive months</strong>, the Client reserves the right to terminate active support retainers immediately with zero exit penalties, outstanding liabilities, or contract settlement fees.</li>
                </ul>
              </div>
              
              <div className="mt-8 text-[9px] text-slate-400 italic text-left font-sans">
                * This Service Level Agreement (SLA) is governed by the signatures provided on the Official Price Quotation document within this master Statement of Work (SOW).
              </div>
            </div>
          </div>
        );

        const AgencySlaBody = (
          <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-medium text-left font-sans">
            {resolvedSlaContent}
          </div>
        );

        const ProPlatformSlaBody = (
          <div className="space-y-6 text-slate-800 font-sans text-left">
            <p className="text-xs leading-relaxed font-medium text-left text-slate-700 font-sans">
              This Platform Service Level Agreement (SLA) outlines availability, support, and subscription standards for <strong>{proProductMeta?.skuLabel || 'PRO 1 · Agency Ops'}</strong> provided by <strong>{issuerCompanyName}</strong> ("Service Provider") to <strong>{resolvedClientParty.company || "the Client"}</strong> ("Client").
            </p>

            <div className="space-y-5 font-medium text-left text-slate-700 font-sans">
              <div>
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold">1. Covered Platform Services</h4>
                <ul className="list-disc pl-5 text-xs space-y-1.5 text-slate-700 leading-relaxed text-left font-sans">
                  <li><strong>White-label tenant:</strong> Branded Agency Ops workspace (CRM, quotes, invoicing) hosted under the Client agency identity.</li>
                  <li><strong>Platform subscription:</strong> Continuous access, hosting, and standard updates for the subscription term selected in this SOW.</li>
                  <li><strong>Onboarding deliverables:</strong> Setup configuration and team training as listed in the active scope of work.</li>
                </ul>
              </div>

              <div>
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans">2. Platform Availability</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700 text-left font-sans">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print-pill text-left leading-relaxed font-sans">
                    <span className="block font-bold text-brandTeal-600 uppercase font-mono text-[10px] mb-1 text-left font-sans font-semibold">Target Uptime</span>
                    <strong>99.5% availability</strong> for the Agency Ops platform during regular business hours (Mon–Fri, 9AM–6PM PHT).
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 print-pill text-left leading-relaxed font-sans">
                    <span className="block font-bold text-brandTeal-600 uppercase font-mono text-[10px] mb-1 text-left font-sans font-semibold">Maintenance Windows</span>
                    Planned updates scheduled outside business hours with at least 48-hour notice when downtime is expected.
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold font-sans font-bold">3. Support Response Matrix</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left font-sans">
                  <div className="bg-rose-50/50 p-4 rounded-lg border border-rose-200 print-pill text-left font-sans">
                    <div className="font-bold text-rose-700 text-[10px] uppercase font-mono mb-1.5 text-left font-sans font-semibold">Severity 1 (Critical)</div>
                    <div className="text-[10px] text-slate-700 leading-relaxed mb-3 text-left font-sans font-semibold"><strong>Condition:</strong> Platform unavailable to all agency users.</div>
                    <div className="text-[10px] border-t border-rose-200/50 pt-2 space-y-1 text-left font-sans font-semibold">
                      <div className="flex justify-between"><span>Response:</span><strong className="text-slate-900 font-sans">Within 4 hours</strong></div>
                      <div className="flex justify-between font-sans"><span>Resolution:</span><strong className="text-slate-900 font-sans">Within 24 hours</strong></div>
                    </div>
                  </div>
                  <div className="bg-amber-50/50 p-4 rounded-lg border border-amber-200 print-pill text-left font-sans">
                    <div className="font-bold text-amber-700 text-[10px] uppercase font-mono mb-1.5 text-left font-sans font-semibold">Severity 2 (High)</div>
                    <div className="text-[10px] text-slate-700 leading-relaxed mb-3 text-left font-sans font-semibold"><strong>Condition:</strong> Core workflow broken (CRM, quotes, or invoicing) blocking daily sales ops.</div>
                    <div className="text-[10px] border-t border-amber-200/50 pt-2 space-y-1 text-left font-sans font-semibold">
                      <div className="flex justify-between font-sans"><span>Response:</span><strong className="text-slate-900 font-sans">Within 8 hours</strong></div>
                      <div className="flex justify-between font-sans"><span>Resolution:</span><strong className="text-slate-900 font-sans">Within 48 hours</strong></div>
                    </div>
                  </div>
                  <div className="bg-brandTeal-50/50 p-4 rounded-lg border border-brandTeal-200 print-pill text-left font-sans">
                    <div className="font-bold text-brandTeal-700 text-[10px] uppercase font-mono mb-1.5 text-left font-sans font-semibold">Severity 3 (Normal)</div>
                    <div className="text-[10px] text-slate-700 leading-relaxed mb-3 text-left font-sans font-semibold"><strong>Condition:</strong> How-to questions, minor UI issues, or template edits.</div>
                    <div className="text-[10px] border-t border-brandTeal-200/50 pt-2 space-y-1 text-left font-sans font-semibold">
                      <div className="flex justify-between font-sans"><span>Response:</span><strong className="text-slate-900 font-sans">Within 24 hours</strong></div>
                      <div className="flex justify-between font-sans"><span>Resolution:</span><strong className="text-slate-900 font-bold text-teal-800">2–5 bus. days</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="text-left font-sans font-semibold font-sans">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold">4. Subscription Term & Exclusions</h4>
                <p className="text-xs mb-2 leading-relaxed text-left text-slate-700 font-sans font-semibold">Platform subscription fees cover hosting, standard support, and product updates. Custom development, third-party integrations, and consulting MOD services are quoted separately.</p>
                <p className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded border border-slate-100 leading-relaxed text-left font-sans font-semibold">
                  <strong className="text-slate-700 font-sans">Exclusions:</strong> Downtime caused by Client-side network issues, unauthorized admin changes, or third-party service outages outside the Agency Ops platform.
                </p>
              </div>

              <div className="text-left font-sans text-sm">
                <h4 className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1.5 text-left font-sans font-bold">5. Breach Remedies & Termination</h4>
                <ul className="list-disc pl-5 text-[11px] space-y-1.5 text-slate-700 leading-relaxed text-left font-sans font-semibold">
                  <li><strong>Right to Cure:</strong> For uncured Severity 1 breaches, Client issues written notice. Service Provider receives a <strong>{slaCureDays}-day</strong> cure period.</li>
                  <li><strong>Termination Right:</strong> If Severity 1 breaches repeat for <strong>{slaRecurrenceMonths} consecutive months</strong>, Client may terminate the active subscription without exit penalties beyond outstanding subscription fees.</li>
                  <li><strong>Data export:</strong> Upon termination, Client data is exported and tenant access ends within <strong>{dpaRetentionDays} days</strong> per the data retention policy in this SOW.</li>
                </ul>
              </div>

              <div className="mt-8 text-[9px] text-slate-400 italic text-left font-sans">
                * This Platform SLA is governed by the signatures on the Official Price Quotation within this master Statement of Work (SOW). It is separate from MOD 3/4 consulting SLAs.
              </div>
            </div>
          </div>
        );

        const QuoteBody = (isInv) => (
          <div className="text-left font-sans text-sm">
            {(!isInv || !isAddendumInvoiceMode) && renderModuleInvestmentSummary()}
            {renderDeliverablesTable(isInv)}
            {renderTaxBreakoutTable(isInv)}
            {renderEOPTPrintFootnote()}
            {renderFinancialBreakdown(isInv)}
            {!isInv && !STARTER_UI && (
              <p className="text-[10px] text-slate-600 mb-6 -mt-4 leading-relaxed">Payment via BDO Unibank · Account: Reinhard Ludwig A. Kolthoff · 0039 5019 0761 · Due within 7 business days of each billing gate invoice.</p>
            )}
            {!isInv && STARTER_UI && (
              <p className="text-[10px] text-slate-600 mb-6 -mt-4 leading-relaxed">Payment due within 7 business days of each billing gate invoice unless otherwise agreed in writing.</p>
            )}
            {(!isInv || !isAddendumInvoiceMode) && renderMilestoneBillingGrid()}
            
            {/* Stage-Gated Master Terms Annex */}
            <div className="text-[9.5px] text-slate-500 space-y-3 pb-6 border-b border-slate-200 mb-8 leading-relaxed font-semibold text-left font-sans font-semibold print-quote-terms">
              <strong className="text-slate-700 block text-[10px] uppercase font-mono font-bold tracking-wider border-b border-slate-200 pb-1.5 text-left font-sans">{isProEngagement ? 'Master Platform Subscription Agreement (Terms of Service)' : 'Master Consulting Service Agreement (Terms of Service)'}</strong>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-left font-sans font-medium">
                <p>
                  1. <strong>Stage-Gated Performance & Exit Ramps:</strong> Professional services are structured under a Phased Commitment Model. The Client retains absolute discretion to authorize or decline the commencement of subsequent modules upon completion and formal handover of each preceding gate asset. Each authorized module constitutes an independent execution phase.
                </p>
                <p>
                  2. <strong>Client Onboarding & On-time Cooperation:</strong> Project timelines, launch milestones, and response SLAs remain dependent on prompt access. All timelines pause automatically if client credentials, business rosters, policies, or stage-gated reviews are delayed beyond five (5) working days. If client delays exceed fourteen (14) calendar days, a Project Restart Fee equal to 10% of the total module value shall be billed before resumption of services.
                </p>
                <p>
                  3. <strong>Intellectual Property (IP) Assignment:</strong> Upon 100% full, non-refundable payment of professional fees under an authorized module phase, the Client receives a permanent, irrevocable, royalty-free local license to use, adapt, and copy all custom-designed databases, flowcharts, manuals, and handbooks created during that specific engagement phase.
                </p>
                <p>
                  4. <strong>Late-Payment Delinquency:</strong> SOW billing milestones must be settled within seven (7) business days of invoice date. Balances remaining unpaid past this window shall accumulate a late-payment delinquency penalty of 1.5% per month, compounded monthly, until fully cleared.
                </p>
                <p>
                  5. <strong>Consulting Warranties & Liability Limits:</strong> Service Provider provides a ninety (90) day operational support warranty covering any structural database or logic bugs within built templates. Total cumulative liability for any security breaches, data loss, or system outages is strictly capped at the actual cumulative amount paid under this specific module addendum.
                </p>
                <p>
                  6. <strong>Dispute Resolution & Jurisdiction:</strong> This agreement is governed by and construed in accordance with the laws of the Republic of the Philippines. Any litigation, dispute, or enforcement arising under this contract shall fall exclusively under the courts of Taytay, Rizal, or Metro Manila.
                </p>
              </div>
            </div>

            {renderSignaturesBlock(isInv ? "Received & Authorized by:" : "Approved and Accepted by:", isInv ? "Prepared & Submitted by:" : "Prepared & Submitted by:", isInv ? resolvedInvoiceBillTo : resolvedSponsorParty)}
          </div>
        );

        if (isPackage) {
          let sectionIdx = 0;
          const sectionFooter = (label) => {
            sectionIdx += 1;
            return renderPrintFooter(label, sectionIdx, packageSectionCount);
          };
          return (
            <div className={`xl:col-span-8 planner-split-panel print:w-full print:max-w-none space-y-8 print:space-y-0 print:block text-left${STARTER_UI ? ' starter-pdf-neutral' : ''}`} id="package-print-area">
              {printCover && (
                <section aria-label="Package cover page" className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 sm:p-12 shadow-2xl print-card print-section font-sans font-medium mb-8 print:mb-0" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
                  {renderCoverPage()}
                  {sectionFooter('Cover Page')}
                </section>
              )}
              {printSow && (
                <section aria-label="Scope and project proposal" className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 sm:p-12 shadow-2xl print-card print-section font-sans font-medium mb-8 print:mb-0" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
                  {renderPrintHeader("SCOPE & PROJECT PROPOSAL (SOW)", false, false, false)}
                  {renderCustomerBlock('client')}
                  {ProposalBody}
                  {sectionFooter('SOW Proposal')}
                </section>
              )}
              
              {printTimeline && (
                <section aria-label="Strategic implementation roadmap" className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 sm:p-12 shadow-2xl print-card print-section font-sans font-medium mb-8 print:mb-0" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
                  {renderPrintHeader("Strategic Implementation Roadmap", false, false, true)}
                  {renderCustomerBlock('client', true)}
                  {RoadmapBody}
                  {sectionFooter('Implementation Roadmap')}
                </section>
              )}

              {printSla && (
                <section aria-label="Service level agreement" className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 sm:p-12 shadow-2xl print-card print-section font-sans font-medium mb-8 print:mb-0" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
                  {renderPrintHeader(
                    STARTER_UI
                      ? "SERVICE LEVEL AGREEMENT (SLA)"
                      : (isProEngagement ? "PLATFORM SERVICE LEVEL AGREEMENT (SLA)" : "SERVICE LEVEL AGREEMENT (SLA)"),
                    false, false, false
                  )}
                  {STARTER_UI ? AgencySlaBody : (isProEngagement ? ProPlatformSlaBody : SlaBody)}
                  {sectionFooter('Service Level Agreement')}
                </section>
              )}

              {printQuote && (
                <section aria-label="Official price quotation" className="bg-white text-slate-900 border border-slate-200 rounded-xl p-8 sm:p-12 shadow-2xl print-card print-section font-sans font-medium">
                  {renderEOPTAlertBlock(false)}
                  {renderPrintHeader("OFFICIAL PRICE QUOTATION", false, false, false)}
                  {renderCustomerBlock('sponsor')}
                  {QuoteBody(false)}
                  {sectionFooter('Price Quotation')}
                </section>
              )}
            </div>
          );
        }

        let headerTitle = "";
        if (isInvoice) headerTitle = includeTax ? "VAT SALES INVOICE" : "NON-VAT SALES INVOICE";
        else if (isNda) headerTitle = "CONFIDENTIAL NDA AGREEMENT";

        return (
          <div className={`xl:col-span-8 planner-split-panel print:w-full print:max-w-none bg-white text-slate-900 border border-slate-200 rounded-xl p-8 sm:p-12 shadow-2xl print-card print-section font-sans font-medium text-left${STARTER_UI ? ' starter-pdf-neutral' : ''}`} id={`${view}-print-area`}>
            {isInvoice && renderEOPTAlertBlock(isInvoice)}
            {renderPrintHeader(headerTitle, isNda, isInvoice, false)}
            {!isNda && renderCustomerBlock(isInvoice ? 'invoice' : 'client')}

            {isNda && NdaBody}
            {isInvoice && QuoteBody(isInvoice)}
          </div>
        );
      };

      const displayedProfiles = useMemo(() => {
        let filtered = H.filterProfiles(profiles, workspaceSearch, getWorkspaceLabel);
        if (!filtered.some(p => p.id === activeProfileId)) {
          const current = profiles.find(p => p.id === activeProfileId);
          if (current) filtered = [current, ...filtered];
        }
        return H.sortProfiles(filtered, workspaceSort, getWorkspaceLabel);
      }, [profiles, workspaceSearch, workspaceSort, activeProfileId]);

      const saveStatusLabel = saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved' : 'Save failed';
      const saveStatusClass = saveStatus === 'saved' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : saveStatus === 'saving' ? 'text-brandTeal-300 bg-brandTeal-500/10 border-brandTeal-500/20' : saveStatus === 'unsaved' ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

      const renderWorkspaceToolbar = () => (
        <div className="planner-workspace-toolbar bg-brandNavy-900 border-b border-brandNavy-750 px-4 sm:px-6 no-print shadow-xl shrink-0">
          <div className="max-w-[1600px] mx-auto planner-toolbar-inner flex flex-col font-sans text-xs">
            {/* Row 1 — Active workspace context */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 planner-workspace-context">
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isAuthed ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-amber-500 animate-pulse'}`} title={isAuthed ? 'Cloud connected' : 'Connecting…'} />
                <div className="min-w-0">
                  <span className="planner-workspace-label text-[8px] font-mono tracking-widest uppercase text-brandTeal-500 font-bold">Active Workspace</span>
                  <h2 className="text-sm font-bold text-white truncate leading-tight">{getWorkspaceLabel(activeProfile)}</h2>
                  <p className="planner-workspace-meta text-[9px] text-slate-500 truncate">{clientCompany}{quoteId ? ` · ${quoteId}` : ''}{activePackageMeta ? ` · ${activePackageMeta.name}${packageCustomized ? ' (modified)' : ''}` : ''}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                <div className="flex flex-wrap gap-0.5">
                  {['mod1', 'mod2', 'mod3', 'mod4'].map((mod) => {
                    const active = activePresets.includes(mod);
                    return (
                      <span key={mod} className={`px-1.5 py-px rounded text-[8px] font-mono font-bold uppercase border ${active ? 'bg-brandTeal-500/15 text-brandTeal-300 border-brandTeal-500/30' : 'bg-brandNavy-950 text-slate-600 border-brandNavy-800'}`}>{mod.replace('mod', 'MOD ')}</span>
                    );
                  })}
                </div>
                <span className={`font-mono text-[9px] font-bold px-2 py-0.5 rounded-md border ${saveStatusClass}`}>{saveStatusLabel}</span>
                <button onClick={() => handleSaveToCloud(false)} disabled={isSaving || !isAuthed} className="px-3 py-1.5 bg-brandTeal-500 hover:bg-brandTeal-600 text-brandNavy-955 font-bold rounded-lg text-[10px] uppercase tracking-wider shadow-md disabled:opacity-50 shrink-0">
                  {isSaving ? 'Syncing…' : 'Save SOW'}
                </button>
              </div>
            </div>

            {saveError && (
              <p className="text-[9px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-2.5 py-1.5">{saveError}</p>
            )}

            {/* Row 2 — Switch workspace */}
            <div className="planner-workspace-switcher grid grid-cols-1 md:grid-cols-[1fr_auto_2fr_auto] gap-1.5 p-2 bg-brandNavy-950/70 border border-brandNavy-800 rounded-lg items-center">
              <input
                type="search"
                value={workspaceSearch}
                onChange={(e) => setWorkspaceSearch(e.target.value)}
                placeholder="Filter workspaces…"
                className="w-full bg-brandNavy-900 border border-brandNavy-700 rounded-md px-2.5 py-1.5 text-[10px] text-slate-300 focus:outline-none focus:border-brandTeal-500"
              />
              <select value={workspaceSort} onChange={(e) => setWorkspaceSort(e.target.value)} className="w-full md:w-auto bg-brandNavy-900 border border-brandNavy-700 rounded-md px-2 py-1.5 text-[9px] font-bold text-slate-300 focus:outline-none focus:border-brandTeal-500" aria-label="Sort workspaces">
                <option value="modified">Recent</option>
                <option value="name">A–Z</option>
              </select>
              <select value={activeProfileId} onChange={(e) => requestProfileSwitch(e.target.value)} className="w-full bg-brandNavy-900 border border-brandNavy-700 rounded-md px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 focus:outline-none focus:border-brandTeal-500 truncate" aria-label="Select workspace">
                {displayedProfiles.map(p => <option key={p.id} value={p.id}>{getWorkspaceLabel(p)}</option>)}
              </select>
              <button onClick={openRenameWorkspace} disabled={!isAuthed} title="Rename workspace label" className="w-full md:w-auto px-2.5 py-1.5 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-300 border border-brandNavy-700 font-bold rounded-md text-[9px] uppercase flex items-center justify-center gap-1 disabled:opacity-50 shrink-0">
                <IconEdit /> Rename
              </button>
            </div>

            {/* Row 3 — Grouped actions */}
            <div className="planner-workspace-actions flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-[9px]">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-slate-500 font-mono uppercase tracking-wider font-bold mr-0.5 w-12 shrink-0">Manage</span>
                <button onClick={handleCreateNewWorkspace} className="px-2 py-1 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-300 border border-brandNavy-700 font-bold rounded-md uppercase flex items-center gap-1"><IconPlus /> New</button>
                <button onClick={handleCloneCurrentWorkspace} className="px-2 py-1 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-300 border border-brandNavy-700 font-bold rounded-md uppercase">Clone</button>
                {profiles.length > 1 && (
                  <button onClick={() => setShowDeleteConfirm(true)} className="px-2 py-1 bg-red-950/30 text-rose-400 border border-red-900/40 font-bold rounded-md uppercase">Delete</button>
                )}
              </div>
              <div className="hidden sm:block w-px h-5 bg-brandNavy-700 shrink-0" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-1 flex-1">
                <span className="text-slate-500 font-mono uppercase tracking-wider font-bold mr-0.5 w-12 shrink-0">Data</span>
                <select onChange={handleImportFromCRM} className="px-2 py-1 bg-brandNavy-800 text-slate-300 border border-brandNavy-700 rounded-md uppercase font-bold focus:outline-none cursor-pointer max-w-[160px]">
                  <option value="">CRM deal…</option>
                  {crmDeals.map(d => <option key={d.id} value={d.id}>{d.leadName}</option>)}
                </select>
                <button onClick={() => importFileRef.current?.click()} className="px-2 py-1 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-300 border border-brandNavy-700 font-bold rounded-md uppercase">Import JSON</button>
                <button onClick={handleExportWorkspace} className="px-2 py-1 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-300 border border-brandNavy-700 font-bold rounded-md uppercase">Export JSON</button>
                <input ref={importFileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportWorkspaceFile} />
              </div>
            </div>
          </div>
        </div>
      );

      if (!isAuthed) {
        return (
          <div className={STARTER_UI ? "starter-app-root starter-loading-screen font-sans h-full min-h-screen flex flex-col items-center justify-center px-6 bg-slate-100 text-slate-500" : "font-sans h-full min-h-screen flex flex-col items-center justify-center px-6 text-slate-300 bg-brandNavy-955"}>
            <div className={`flex items-center gap-3 ${STARTER_UI ? 'text-sm font-medium' : ''}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${STARTER_UI ? 'starter-loading-dot' : 'bg-brandTeal-500'}`} />
              {STARTER_UI ? 'Connecting…' : 'Connecting to cloud…'}
            </div>
            {authErrorDetails && (() => {
              const help = window.FirebaseErrors?.getFirebaseConnectionHelp(authErrorDetails) || {
                title: 'Firebase Connection Error',
                summary: authErrorDetails,
                steps: [],
              };
              return (
                <div className={`text-xs font-medium p-4 rounded mt-4 max-w-lg text-left leading-relaxed ${STARTER_UI ? 'text-amber-700 bg-amber-50 border border-amber-200' : 'text-amber-400 bg-amber-500/10'}`}>
                  <strong className={`block font-bold mb-1 ${STARTER_UI ? 'text-amber-800' : 'text-amber-300'}`}>{help.title}</strong>
                  <span className={`block ${STARTER_UI ? 'text-slate-600' : 'text-slate-300'}`}>{help.summary}</span>
                  {help.steps.length > 0 && (
                    <ul className={`mt-2 space-y-1 list-disc pl-4 ${STARTER_UI ? 'text-slate-500' : 'text-slate-400'}`}>
                      {help.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ul>
                  )}
                </div>
              );
            })()}
          </div>
        );
      }

      if (STARTER_UI && isAuthed && profiles.length === 0) {
        return (
          <div className="font-sans h-full min-h-screen flex flex-col animate-fade-in starter-app-root text-slate-600 bg-slate-100">
            <header className="planner-main-header border-b sticky top-0 z-50 no-print shrink-0">
              <div className="planner-header-inner max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
                <div data-app-chrome className="flex items-center gap-2">
                  {renderPlannerHeaderLogo(brand)}
                  <div className="text-left font-sans font-bold">
                    <span className="starter-page-title font-sans text-xs sm:text-sm block leading-none">{renderPlannerHeaderTitle(brand)}</span>
                    <span className="starter-page-subtitle text-[10px] block mt-1 font-sans" style={{ color: 'var(--starter-text-muted)' }}>{brand.plannerSubtitle || brand.tagline || 'Quotes'}</span>
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 flex items-center justify-center p-6">
              <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
                <h2 className="text-lg font-semibold text-slate-800 mb-2">Start your first quote</h2>
                <p className="text-sm text-slate-500 mb-6">Create a blank quote workspace and add line items in the Planner.</p>
                <button
                  type="button"
                  onClick={handleCreateNewWorkspace}
                  disabled={!isAuthed}
                  className="starter-sow-btn-primary px-5 py-2.5 text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  Create quote
                </button>
              </div>
            </main>
          </div>
        );
      }

      return (
        <div className={STARTER_UI ? "font-sans h-full min-h-0 overflow-hidden flex flex-col animate-fade-in starter-app-root text-slate-600 bg-slate-100" : "font-sans h-full min-h-0 overflow-hidden text-slate-300 bg-brandNavy-955 flex flex-col animate-fade-in font-sans"}>
          <header className={STARTER_UI ? "planner-main-header border-b sticky top-0 z-50 no-print shrink-0" : "planner-main-header border-b border-brandNavy-700/50 bg-brandNavy-950/95 sticky top-0 z-50 backdrop-blur-md no-print shrink-0"}>
            <div className="planner-header-inner max-w-[1600px] mx-auto px-4 sm:px-6 flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
              <div data-app-chrome className="flex items-center gap-2">
                {renderPlannerHeaderLogo(brand)}
                <div className="text-left font-sans font-bold">
                  <span className={STARTER_UI ? "starter-page-title font-sans text-xs sm:text-sm block leading-none" : "font-sans font-extrabold tracking-wider text-xs sm:text-sm uppercase block text-white leading-none"}>
                    {renderPlannerHeaderTitle(brand)}
                  </span>
                  <span className={STARTER_UI ? "starter-page-subtitle text-[10px] block mt-1 font-sans" : "text-[7px] text-brandTeal-400 font-mono tracking-[0.2em] uppercase block mt-1 font-bold font-sans"} style={STARTER_UI ? { color: 'var(--starter-text-muted)' } : undefined}>{STARTER_UI ? (brand.plannerSubtitle || brand.tagline || 'Quotes') : (PRODUCT.plannerSubtitle || brand.plannerSubtitle || brand.tagline || 'Internal Project Workbook')}</span>
                </div>
              </div>
              
              <nav aria-label="Main Navigation" className={STARTER_UI ? "starter-segment flex items-center flex-wrap gap-0.5 p-1 font-sans" : "flex items-center flex-wrap gap-1.5 font-sans font-semibold"}>
                {PLANNER_TABS.map((tab, idx) => (
                  <button key={tab} aria-pressed={view === tab} onClick={() => setView(tab)} className={STARTER_UI ? `starter-segment-btn px-2.5 py-1 ${view === tab ? 'starter-segment-btn-active' : ''}` : `px-2 py-1 rounded font-mono text-[8px] uppercase font-bold border tracking-wider transition-all ${view === tab ? 'bg-brandTeal-500 text-brandNavy-955 border-brandTeal-500 font-extrabold shadow-md shadow-brandTeal-500/10' : 'bg-brandNavy-900 text-slate-300 border-brandNavy-700 hover:bg-brandNavy-800 font-bold'}`}>
                    {STARTER_UI ? (TAB_LABELS[tab] || tab) : `${idx + 1}. ${TAB_LABELS[tab] || tab}`}
                  </button>
                ))}
              </nav>
            </div>
          </header>

          {renderWorkspaceToolbar()}

          {issueInvoiceToast && (
            <div className="fixed top-6 right-6 z-[1100] bg-brandTeal-600 text-white px-4 py-3 rounded-lg shadow-2xl font-bold text-xs no-print">
              {issueInvoiceToast}
            </div>
          )}

          {localDraftBanner && (
            <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-3 no-print text-left font-sans">
              <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-amber-300 font-medium">A newer local draft was found for this workspace (saved {new Date(localDraftBanner.savedAt).toLocaleString()}).</p>
                <div className="flex gap-2">
                  <button onClick={restoreLocalDraft} className="px-3 py-1.5 bg-amber-500 text-brandNavy-955 text-[10px] font-bold rounded-lg uppercase">Restore Draft</button>
                  <button onClick={() => {
                    if (localDraftBanner?.savedAt) dismissedDraftsRef.current[activeProfileId] = localDraftBanner.savedAt;
                    H.clearLocalDraft(activeProfileId);
                    setLocalDraftBanner(null);
                  }} className="px-3 py-1.5 bg-brandNavy-800 text-slate-300 border border-brandNavy-700 text-[10px] font-bold rounded-lg uppercase">Dismiss</button>
                </div>
              </div>
            </div>
          )}

          {authErrorDetails && (() => {
            const help = window.FirebaseErrors?.getFirebaseConnectionHelp(authErrorDetails) || {
              title: 'Firebase Connection Error',
              summary: authErrorDetails,
              steps: [],
            };
            return (
            <div className="bg-rose-500/10 border-b border-rose-500/30 px-6 py-3 no-print text-left font-sans animate-fade-in">
              <div className="max-w-[1600px] mx-auto flex items-start gap-3 font-sans">
                <IconAlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs text-rose-400 font-medium text-left font-sans">
                  <strong className="block font-bold text-rose-300 mb-0.5 font-sans">{help.title}</strong>
                  <span className="text-slate-300 font-normal block leading-relaxed">{help.summary}</span>
                  {help.steps.length > 0 && (
                    <ul className="text-slate-400 font-normal mt-2 space-y-1 list-disc pl-4 leading-relaxed">
                      {help.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ul>
                  )}
                  <span className="text-slate-500 font-normal mt-2 block">Local edits are still saved as a draft until cloud sync works.</span>
                </div>
              </div>
            </div>
            );
          })()}

          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-brandNavy-955/80 z-[1000] backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fade-in text-center font-sans">
              <div className="bg-brandNavy-900 border border-red-900/40 p-6 rounded-xl max-w-md w-full text-center shadow-2xl font-sans font-medium">
                <h4 className="font-extrabold text-slate-200 text-sm uppercase tracking-wider mb-2">Confirm Delete Workspace?</h4>
                <p className="text-[11px] text-slate-400 mb-4 text-center">This will permanently erase <strong className="text-white">{getWorkspaceLabel(activeProfile)}</strong>.</p>
                <div className="flex justify-center gap-3 font-sans font-semibold">
                  <button onClick={executeDeleteWorkspace} className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-lg uppercase">Yes, Delete</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-brandNavy-955 text-slate-300 border border-brandNavy-700 text-xs font-bold rounded-lg uppercase">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showRenameWorkspace && (
            <div className="fixed inset-0 bg-brandNavy-955/80 z-[1000] backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fade-in text-left font-sans">
              <div className="bg-brandNavy-900 border border-brandTeal-500/30 p-6 rounded-xl max-w-md w-full shadow-2xl font-sans font-medium">
                <h4 className="font-extrabold text-slate-200 text-sm uppercase tracking-wider mb-2 text-left">Rename Workspace</h4>
                <p className="text-[11px] text-slate-400 mb-3 text-left">This label appears in the workspace picker only. The company legal name on SOW documents is unchanged.</p>
                <input
                  type="text"
                  value={renameWorkspaceValue}
                  onChange={(e) => setRenameWorkspaceValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') executeRenameWorkspace(); if (e.key === 'Escape') setShowRenameWorkspace(false); }}
                  autoFocus
                  className="w-full bg-brandNavy-950 border border-brandNavy-700 rounded-lg p-2.5 text-sm font-bold text-slate-200 focus:outline-none focus:border-brandTeal-500 mb-4"
                  placeholder="Workspace name"
                />
                <div className="flex justify-end gap-3 font-sans font-semibold">
                  <button onClick={() => setShowRenameWorkspace(false)} className="px-4 py-2 bg-brandNavy-955 text-slate-300 border border-brandNavy-700 text-xs font-bold rounded-lg uppercase">Cancel</button>
                  <button onClick={executeRenameWorkspace} disabled={!renameWorkspaceValue.trim() || isSaving} className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-600 text-brandNavy-955 text-xs font-bold rounded-lg uppercase disabled:opacity-50">Save Name</button>
                </div>
              </div>
            </div>
          )}

          {showUnsavedSwitchConfirm && (
            <div className="fixed inset-0 bg-brandNavy-955/80 z-[1000] backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fade-in text-left font-sans">
              <div className="bg-brandNavy-900 border border-amber-500/30 p-6 rounded-xl max-w-md w-full shadow-2xl font-sans font-medium">
                <h4 className="font-extrabold text-slate-200 text-sm uppercase tracking-wider mb-2">Unsaved Changes</h4>
                <p className="text-[11px] text-slate-400 mb-4">Save changes to <strong className="text-white">{getWorkspaceLabel(activeProfile)}</strong> before switching workspaces?</p>
                <div className="flex flex-wrap justify-end gap-2 font-sans font-semibold">
                  <button onClick={() => confirmProfileSwitch(false)} className="px-4 py-2 bg-brandNavy-955 text-slate-300 border border-brandNavy-700 text-xs font-bold rounded-lg uppercase">Discard</button>
                  <button onClick={() => setShowUnsavedSwitchConfirm(false)} className="px-4 py-2 bg-brandNavy-800 text-slate-300 border border-brandNavy-700 text-xs font-bold rounded-lg uppercase">Cancel</button>
                  <button onClick={() => confirmProfileSwitch(true)} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 text-xs font-bold rounded-lg uppercase">Save & Switch</button>
                </div>
              </div>
            </div>
          )}

          {showPrintValidation && (
            <div className="fixed inset-0 bg-brandNavy-955/80 z-[1000] backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fade-in text-left font-sans">
              <div className="bg-brandNavy-900 border border-brandTeal-500/30 p-6 rounded-xl max-w-md w-full shadow-2xl font-sans font-medium">
                <h4 className="font-extrabold text-slate-200 text-sm uppercase tracking-wider mb-2">Print Readiness Check</h4>
                {printValidationIssues.length > 0 && (
                  <ul className="text-[11px] text-rose-400 space-y-1 mb-3 list-disc pl-4">
                    {printValidationIssues.map((issue, i) => <li key={i}>{issue}</li>)}
                  </ul>
                )}
                {printValidationWarnings.length > 0 && (
                  <ul className="text-[11px] text-amber-300 space-y-1 mb-3 list-disc pl-4">
                    {printValidationWarnings.map((warn, i) => <li key={i}>{warn}</li>)}
                  </ul>
                )}
                <div className="flex justify-end gap-2 font-sans font-semibold">
                  <button onClick={() => setShowPrintValidation(false)} className="px-4 py-2 bg-brandNavy-955 text-slate-300 border border-brandNavy-700 text-xs font-bold rounded-lg uppercase">Close</button>
                  {printValidationIssues.length === 0 && (
                    <button onClick={proceedPrintDespiteWarnings} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 text-xs font-bold rounded-lg uppercase">Print Anyway</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {showCrmImportModal && pendingCrmDeal && (
            <div className="fixed inset-0 bg-brandNavy-955/80 z-[1000] backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fade-in text-left font-sans">
              <div className="bg-brandNavy-900 border border-brandTeal-500/30 p-6 rounded-xl max-w-md w-full shadow-2xl font-sans font-medium">
                <h4 className="font-extrabold text-slate-200 text-sm uppercase tracking-wider mb-2">Import CRM Deal</h4>
                <p className="text-[11px] text-slate-400 mb-4"><strong className="text-white">{pendingCrmDeal.leadName}</strong> — {pendingCrmDeal.company || 'Individual'}</p>
                <div className="flex flex-col gap-2 font-sans font-semibold">
                  <button onClick={() => { applyCrmDealToFields(pendingCrmDeal); setShowCrmImportModal(false); setPendingCrmDeal(null); }} className="px-4 py-2 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-200 border border-brandNavy-700 text-xs font-bold rounded-lg uppercase text-left">Apply to Current Workspace</button>
                  <button onClick={() => { createWorkspaceFromCrmDeal(pendingCrmDeal); setShowCrmImportModal(false); setPendingCrmDeal(null); }} className="px-4 py-2 bg-brandTeal-500 hover:bg-brandTeal-600 text-brandNavy-955 text-xs font-bold rounded-lg uppercase text-left">Create New Workspace from Deal</button>
                  <button onClick={() => { setShowCrmImportModal(false); setPendingCrmDeal(null); }} className="px-4 py-2 bg-brandNavy-955 text-slate-400 text-xs font-bold rounded-lg uppercase">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {showPackageApplyConfirm && pendingPackageId && (
            <div className="fixed inset-0 bg-brandNavy-955/80 z-[1000] backdrop-blur-sm flex items-center justify-center p-4 no-print animate-fade-in text-left font-sans">
              <div className="bg-brandNavy-900 border border-brandTeal-500/30 p-6 rounded-xl max-w-md w-full shadow-2xl font-sans font-medium">
                <h4 className="font-extrabold text-slate-200 text-sm uppercase tracking-wider mb-2">Apply Package?</h4>
                <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">Applying <strong className="text-white">{EP?.getPackageById?.(pendingPackageId)?.name || pendingPackageId}</strong> will replace your current task selection and proposal defaults. Custom tasks are kept but deselected.</p>
                <div className="flex justify-end gap-3 font-sans font-semibold">
                  <button onClick={() => { executeApplyPackage(pendingPackageId); setShowPackageApplyConfirm(false); setPendingPackageId(null); }} className="px-4 py-2 bg-brandTeal-500 text-brandNavy-955 text-xs font-bold rounded-lg uppercase">Apply Package</button>
                  <button onClick={() => { setShowPackageApplyConfirm(false); setPendingPackageId(null); }} className="px-4 py-2 bg-brandNavy-955 text-slate-300 border border-brandNavy-700 text-xs font-bold rounded-lg uppercase">Cancel</button>
                </div>
              </div>
            </div>
          )}

          <main id="app-main" className={`max-w-[1600px] mx-auto w-full flex-1 min-h-0 overflow-hidden font-sans ${view === 'packages' && !STARTER_UI ? 'p-2 lg:p-3' : view === 'sandbox' || view === 'package' ? 'p-2 sm:p-3 lg:p-4' : 'p-4 sm:p-6 lg:p-8'}`}>
            {view === 'packages' && !STARTER_UI ? (
              <div className="packages-view no-print animate-fade-in font-sans text-left">
                <div className="packages-view-header mb-2 lg:mb-3">
                  <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-1 lg:gap-4">
                    <div>
                      <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-brandTeal-400 uppercase">Engagement Packages</span>
                      <h2 className="text-base lg:text-lg font-bold text-white font-serif leading-tight">Choose a starting scope</h2>
                    </div>
                    <p className="text-[10px] text-slate-500 lg:max-w-md lg:text-right leading-snug">Set task selection and defaults — fine-tune in Planner afterward.</p>
                  </div>
                </div>
                {!STARTER_UI && (EP?.getServicePackages?.() || []).length > 0 && (
                  <section className="packages-section">
                    <div className="packages-section-label">
                      <span className="text-[8px] font-mono font-bold tracking-[0.18em] text-brandTeal-400 uppercase shrink-0">Consulting Services (MOD)</span>
                    </div>
                    <div className="packages-grid">
                      {(EP?.getServicePackages?.() || []).map((pkg) => {
                        const preview = packagePreviewEconomics(pkg.id);
                        const isActive = selectedPackageId === pkg.id && !packageCustomized;
                        const selectedCount = H.previewPackageSelection(pkg.id, tasks, catalogTasksRef.current).filter(t => t.selected).length;
                        const estHours = preview.updatedSummary?.estHours || 0;
                        const priceLabel = H.formatPackagePriceLabel(preview, formatCurrency);
                        return (
                          <article key={pkg.id} className={`packages-card bg-brandNavy-900 border rounded-lg p-3 shadow-lg transition-all ${isActive ? 'border-brandTeal-500 ring-1 ring-brandTeal-500/30' : 'border-brandNavy-700 hover:border-brandTeal-500/40'}`}>
                            <div className="packages-card-body">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap gap-1 min-w-0">
                                  {(pkg.modules || []).map((mod) => (
                                    <span key={mod} className="text-[7px] font-mono uppercase bg-brandNavy-950 text-brandTeal-400 px-1.5 py-px rounded border border-brandNavy-700 leading-none">{packageModuleLabel(mod)}</span>
                                  ))}
                                </div>
                                <span className="text-[8px] font-mono text-brandTeal-300 font-bold whitespace-nowrap shrink-0">{priceLabel}</span>
                              </div>
                              <h3 className="text-xs font-bold text-white font-serif leading-tight">{pkg.name}</h3>
                              <p className="text-[9px] text-slate-400 leading-snug line-clamp-2">{pkg.tagline}</p>
                              <p className="text-[8px] text-slate-500 leading-snug line-clamp-2 italic">{pkg.forWhom}</p>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-mono text-slate-500 pt-1 border-t border-brandNavy-700/50 mt-auto">
                                <span><span className="text-slate-300 font-bold">{selectedCount}</span> tasks</span>
                                <span className="text-brandNavy-600">·</span>
                                <span><span className="text-slate-300 font-bold">{estHours}</span> hrs</span>
                                {pkg.isMonthly && <><span className="text-brandNavy-600">·</span><span className="text-slate-400">retainer</span></>}
                              </div>
                            </div>
                            <div className="flex gap-1.5 mt-2 shrink-0">
                              <button type="button" onClick={() => requestApplyPackage(pkg.id)} className="flex-1 py-1.5 bg-brandTeal-500 hover:bg-brandTeal-400 text-brandNavy-955 font-bold rounded text-[8px] uppercase tracking-wide leading-none">{isActive ? 'Re-apply' : 'Apply Package'}</button>
                              <button type="button" onClick={() => setView('sandbox')} className="px-2 py-1.5 text-slate-500 hover:text-brandTeal-300 text-[8px] uppercase font-bold leading-none border border-brandNavy-700 rounded" title="Open Planner without applying">Skip</button>
                            </div>
                          </article>
                        );
                      })}
                      <article className="packages-card bg-brandNavy-900/40 border border-dashed border-brandNavy-700 rounded-lg p-3">
                        <div className="packages-card-body">
                          <span className="text-[7px] font-mono uppercase bg-brandNavy-950 text-slate-400 px-1.5 py-px rounded border border-brandNavy-700 w-fit leading-none">Custom</span>
                          <h3 className="text-xs font-bold text-white font-serif leading-tight">Blank / Custom Scope</h3>
                          <p className="text-[9px] text-slate-500 leading-snug">Skip presets and build scope manually in the Planner using MOD chips and bespoke tasks.</p>
                          <p className="text-[8px] text-slate-600 leading-snug italic">For non-standard engagements or partial module mixes.</p>
                        </div>
                        <button type="button" onClick={() => { setSelectedPackageId('custom'); setPackageCustomized(true); setEngagementType('service'); setProductId(null); setView('sandbox'); }} className="mt-2 w-full py-1.5 bg-brandNavy-800 hover:bg-brandNavy-750 text-slate-200 border border-brandNavy-700 font-bold rounded text-[8px] uppercase tracking-wide shrink-0 leading-none">Open Planner</button>
                      </article>
                    </div>
                  </section>
                )}
                {!STARTER_UI && (EP?.getProductPackages?.() || []).length > 0 && (
                  <section className="packages-section">
                    <div className="packages-section-label">
                      <span className="text-[8px] font-mono font-bold tracking-[0.18em] text-brandAmber-400 uppercase shrink-0">Products (PRO)</span>
                    </div>
                    <div className="packages-grid">
                      {(EP?.getProductPackages?.() || []).map((pkg) => {
                        const preview = packagePreviewEconomics(pkg.id);
                        const isActive = selectedPackageId === pkg.id && !packageCustomized;
                        const selectedCount = H.previewPackageSelection(pkg.id, tasks, catalogTasksRef.current).filter(t => t.selected).length;
                        const estHours = preview.updatedSummary?.estHours || 0;
                        const priceLabel = H.formatPackagePriceLabel(preview, formatCurrency);
                        return (
                          <article key={pkg.id} className={`packages-card bg-brandNavy-900 border rounded-lg p-3 shadow-lg transition-all ${isActive ? 'border-brandAmber-500 ring-1 ring-brandAmber-500/30' : 'border-brandNavy-700 hover:border-brandAmber-500/40'}`}>
                            <div className="packages-card-body">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap gap-1 min-w-0">
                                  {(pkg.modules || []).map((mod) => (
                                    <span key={mod} className="text-[7px] font-mono uppercase bg-brandNavy-950 text-brandAmber-300 px-1.5 py-px rounded border border-brandNavy-700 leading-none">{packageModuleLabel(mod)}</span>
                                  ))}
                                </div>
                                <span className="text-[8px] font-mono text-brandAmber-300 font-bold whitespace-nowrap shrink-0">{priceLabel}</span>
                              </div>
                              <h3 className="text-xs font-bold text-white font-serif leading-tight">{pkg.name}</h3>
                              <p className="text-[9px] text-slate-400 leading-snug line-clamp-2">{pkg.tagline}</p>
                              <p className="text-[8px] text-slate-500 leading-snug line-clamp-2 italic">{pkg.forWhom}</p>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[8px] font-mono text-slate-500 pt-1 border-t border-brandNavy-700/50 mt-auto">
                                <span><span className="text-slate-300 font-bold">{selectedCount}</span> tasks</span>
                                <span className="text-brandNavy-600">·</span>
                                <span><span className="text-slate-300 font-bold">{estHours}</span> hrs</span>
                                {pkg.isMonthly && <><span className="text-brandNavy-600">·</span><span className="text-slate-400">subscription</span></>}
                              </div>
                            </div>
                            <div className="flex gap-1.5 mt-2 shrink-0">
                              <button type="button" onClick={() => requestApplyPackage(pkg.id)} className="flex-1 py-1.5 bg-brandAmber-500 hover:bg-brandAmber-400 text-brandNavy-955 font-bold rounded text-[8px] uppercase tracking-wide leading-none">{isActive ? 'Re-apply' : 'Apply Package'}</button>
                              <button type="button" onClick={() => setView('sandbox')} className="px-2 py-1.5 text-slate-500 hover:text-brandAmber-300 text-[8px] uppercase font-bold leading-none border border-brandNavy-700 rounded" title="Open Planner without applying">Skip</button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            ) : view === 'sandbox' ? (
              <div className="no-print h-full min-h-0 animate-fade-in font-sans font-semibold text-left">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full min-h-0 planner-split-layout text-left font-sans font-medium">
                  <aside className="xl:col-span-3 planner-split-panel space-y-6 text-left font-sans">
                    <div className="bg-brandNavy-900 border border-brandNavy-700 rounded-xl p-6 shadow-2xl relative font-sans text-left font-sans font-semibold">
                      <h3 className="text-xs font-bold tracking-wider text-brandTeal-400 uppercase font-mono mb-4 flex items-center gap-2 text-left"><IconCalculator /> Live Project Metrics</h3>
                      
                      <div className="space-y-4 pb-4 border-b border-brandNavy-700 text-xs text-slate-300 font-sans font-medium text-left">
                        <div className="flex justify-between items-center text-left"><span>Selected Tasks:</span><span className="font-bold font-mono bg-brandNavy-950 px-2 py-0.5 rounded text-white text-right font-sans font-bold">{updatedSummary.count} / {tasks.length}</span></div>
                        <div className="flex justify-between items-center text-left"><span>Total Planned Effort:</span><span className="font-bold font-mono flex items-center gap-1 text-white text-right"><IconClock /> {updatedSummary.estHours} Hours</span></div>
                      </div>

                      <div className="py-4 border-b border-brandNavy-700 text-left font-sans font-medium">
                        <div className="flex justify-between items-center mb-1.5 text-left"><label className="text-[10px] font-mono tracking-widest text-brandTeal-400 uppercase font-bold text-left font-sans font-bold">Partnership Discount</label><span className="text-xs font-mono font-bold text-right font-sans">{discountPercent}%</span></div>
                        <input type="range" min="0" max="30" step="5" value={discountPercent} onChange={(e) => setDiscountPercent(parseInt(e.target.value))} className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1 rounded-lg cursor-pointer font-sans" />
                      </div>
                      {!STARTER_UI && (
                      <div className="py-4 border-b border-brandNavy-700 text-left font-sans font-medium">
                        <div className="flex justify-between items-center mb-1.5 text-left font-sans font-bold"><label className="text-[10px] font-mono tracking-widest text-brandTeal-400 uppercase font-bold text-left">Project Buffer</label><span className="text-xs font-mono font-bold text-brandTeal-300 text-right">+{frictionBuffer}%</span></div>
                        <input type="range" min="0" max="30" step="5" value={frictionBuffer} onChange={(e) => setFrictionBuffer(parseInt(e.target.value))} className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1 rounded-lg cursor-pointer" />
                      </div>
                      )}
                      <div className="py-4 border-b border-brandNavy-700 space-y-1.5 text-xs font-sans font-semibold text-left font-sans font-semibold">
                        <div className="flex justify-between text-left"><span>SOW Subtotal:</span><span className="font-mono text-white text-right">{formatCurrency(projectCostBase + retainerCostTotalBase)}</span></div>
                        {includeTax && <div className="flex justify-between text-slate-400 text-left font-sans font-semibold"><span>PH VAT (12%):</span><span className="font-mono text-right font-sans">{formatCurrency(updatedSummary.taxValue)}</span></div>}
                        <div className="flex justify-between font-bold text-slate-100 pt-1.5 text-left font-sans font-bold"><span>Project Total Quote:</span><span className="text-brandTeal-300 font-mono font-bold text-right font-sans">{formatCurrency(updatedSummary.totalCost)}</span></div>
                      </div>

                      <div className="pt-4 border-t border-brandNavy-700 text-left font-sans">
                        {!STARTER_UI && (
                        <>
                        <h4 className="text-[10px] font-mono uppercase text-slate-400 font-bold mb-3">Customize Hourly Settings</h4>
                        <div className="space-y-3">
                          <div className="bg-brandNavy-955 p-3 rounded-lg border border-brandNavy-700 text-left font-sans font-medium">
                            <div className="flex justify-between items-center mb-1.5"><label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Strategist</label><span className="text-xs font-mono font-bold text-brandTeal-300">₱{principalRate}</span></div>
                            <input type="range" min="1000" max="5000" step="100" value={principalRate} onChange={(e) => setPrincipalRate(Number(e.target.value))} className="w-full accent-brandTeal-500 bg-brandNavy-955 h-1 rounded-lg cursor-pointer" />
                          </div>
                          <div className="bg-brandNavy-955 p-3 rounded-lg border border-brandNavy-700 text-left font-sans font-medium">
                            <div className="flex justify-between items-center mb-1.5"><label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Architect</label><span className="text-xs font-mono font-bold text-brandTeal-300">₱{seniorRate}</span></div>
                            <input type="range" min="1000" max="5000" step="100" value={seniorRate} onChange={(e) => setSeniorRate(Number(e.target.value))} className="w-full accent-brandTeal-500 h-1 rounded-lg cursor-pointer" />
                          </div>
                          <div className="bg-brandNavy-955 p-3 rounded-lg border border-brandNavy-700 text-left font-sans font-medium">
                            <div className="flex justify-between items-center mb-1.5"><label className="text-[10px] font-mono text-slate-400 uppercase font-bold">Specialist</label><span className="text-xs font-mono font-bold text-brandTeal-300">₱{associateRate}</span></div>
                            <input type="range" min="1000" max="5000" step="100" value={associateRate} onChange={(e) => setAssociateRate(Number(e.target.value))} className="w-full accent-brandTeal-500 h-1 rounded-lg cursor-pointer" />
                          </div>
                          <div className="bg-brandNavy-955 p-3 rounded-lg border border-brandNavy-700 text-left font-sans font-medium">
                            <div className="flex justify-between items-center mb-1.5"><label className="text-[10px] font-mono text-slate-400 uppercase font-bold">IT Partner</label><span className="text-xs font-mono font-bold text-brandTeal-300">₱{partnerRate}</span></div>
                            <input type="range" min="1000" max="5000" step="100" value={partnerRate} onChange={(e) => setPartnerRate(Number(e.target.value))} className="w-full accent-brandTeal-500 h-1 rounded-lg cursor-pointer" />
                          </div>
                        </div>
                        </>
                        )}
                      </div>
                    </div>
                  </aside>

                  <section className="xl:col-span-9 planner-split-panel space-y-6 text-left">

                    <div className={STARTER_UI ? "starter-sow-panel bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm text-left" : "bg-brandNavy-900/30 border border-brandNavy-700/80 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm text-left"}>
                      <div className={STARTER_UI ? "starter-sow-panel-header p-5 bg-slate-50 border-b border-slate-200 flex flex-col gap-4 text-left" : "p-5 bg-brandNavy-950/80 border-b border-brandNavy-700/80 flex flex-col gap-4 text-left"}>
                        <div className={`flex justify-between items-center pb-3 text-left ${STARTER_UI ? 'border-b border-slate-200' : 'border-b border-brandNavy-700/50'}`}>
                          <div className="flex items-center gap-2 text-left font-sans font-semibold">
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${STARTER_UI ? 'starter-sow-pulse-dot' : 'bg-brandTeal-500'}`} />
                            <span className={STARTER_UI ? "starter-sow-panel-title text-sm font-semibold text-slate-800" : "text-xs font-mono tracking-wider text-slate-300 uppercase font-semibold text-left font-sans"}>Select Services Included in SOW</span>
                          </div>
                          <div className="flex gap-2 font-sans font-semibold">
                            <button onClick={handleSelectAllPresets} className={STARTER_UI ? "starter-sow-btn-primary px-3 py-1.5 text-xs font-semibold rounded-lg" : "px-3 py-1 text-[10px] font-bold rounded bg-brandTeal-500 text-white uppercase tracking-wider"}>Select All</button>
                            <button onClick={handleClearAllPresets} className={STARTER_UI ? "starter-sow-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg border" : "px-3 py-1 text-[10px] font-bold rounded bg-brandNavy-900 text-slate-400 border border-brandNavy-700 uppercase tracking-wider"}>Clear All</button>
                          </div>
                        </div>
                        {activeProfile?.mod1DeliveredAt && (
                          <div className={`flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg border text-left font-sans ${STARTER_UI ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'}`}>
                            <span className="text-[10px] font-bold uppercase tracking-wider">Mod 1 delivered {new Date(activeProfile.mod1DeliveredAt).toLocaleDateString()}</span>
                            <span className={`text-[10px] ${STARTER_UI ? 'text-emerald-700' : 'text-emerald-400'}`}>— line items below show delivery dates from Leak Scan Report</span>
                          </div>
                        )}
                        <div className={`flex flex-wrap gap-2 text-left font-sans ${STARTER_UI ? 'starter-sow-presets' : ''}`}>
                          {getModPresets(moduleBundleNames).map(preset => {
                            const isActive = activePresets.includes(preset.name);
                            return (
                              <button key={preset.name} onClick={() => handleTogglePreset(preset.name)} className={STARTER_UI ? `starter-sow-preset px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 ${isActive ? 'starter-sow-preset-active' : 'starter-sow-preset-inactive'}` : `px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1.5 font-sans font-bold ${isActive ? 'bg-brandTeal-500 text-white' : 'bg-brandNavy-900 text-slate-300 border-brandNavy-700'}`}>
                                {isActive ? <IconCheck className={`w-3 h-3 ${STARTER_UI ? 'text-white' : 'text-white'}`} /> : <span className={`w-1.5 h-1.5 rounded-full ${STARTER_UI ? 'bg-slate-400' : 'bg-slate-500'}`} />}{preset.label}
                              </button>
                            );
                          })}
                        </div>
                        {STARTER_UI && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 pt-1">
                            {['mod1', 'mod2', 'mod3', 'mod4'].map((modKey) => (
                              <label key={modKey} className="block text-left">
                                <span className="starter-sow-field-label text-[10px] font-medium text-slate-500 uppercase tracking-wide">Module {modKey.replace('mod', '')} name</span>
                                <input
                                  type="text"
                                  value={moduleBundleNames[modKey] || ''}
                                  onChange={(e) => renameModuleBundle(modKey, e.target.value)}
                                  className="starter-sow-input w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs text-slate-800 mt-1"
                                  placeholder={`Module ${modKey.replace('mod', '')}`}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="overflow-x-auto text-left font-sans font-semibold">
                        {STARTER_UI ? (
                        <table className="w-full text-left border-collapse text-[11px] min-w-[1280px] font-sans">
                          <thead>
                            <tr className="starter-sow-table-head bg-slate-100 text-xs font-semibold text-slate-600 border-b border-slate-200">
                              <th className="py-3 px-2 text-center w-[3%]" scope="col" aria-label="Reorder">#</th>
                              <th className="py-3 px-2 text-center w-[4%]" scope="col">Incl</th>
                              <th className="py-3 px-2 text-left w-[11%]" scope="col">Module</th>
                              <th className="py-3 px-2 text-left w-[12%]" scope="col">Particular</th>
                              <th className="py-3 px-2 text-center w-[6%]" scope="col">Qty</th>
                              <th className="py-3 px-2 text-center w-[6%]" scope="col">Duration</th>
                              <th className="py-3 px-2 text-right w-[8%]" scope="col">Unit Price</th>
                              <th className="py-3 px-2 text-left w-[8%]" scope="col">Unit</th>
                              <th className="py-3 px-2 text-right w-[9%]" scope="col">Base Price</th>
                              <th className="py-3 px-2 text-right w-[7%]" scope="col">Mark Up</th>
                              <th className="py-3 px-2 text-right w-[9%]" scope="col">Gross Profit</th>
                              <th className="py-3 px-2 text-right w-[7%]" scope="col">GP Margin</th>
                              <th className="py-3 px-2 text-right w-[10%] font-bold text-indigo-600" scope="col">Estimate Cost</th>
                            </tr>
                          </thead>
                          <tbody className="starter-sow-table-body divide-y divide-slate-200">
                            {tasks.map((task, taskIndex) => {
                              const pricingRow = H.isAgencyLineItem(task) ? H.computeAgencyLineItemPricing(task) : null;
                              const modKey = task.moduleKey || H.presetForTask(task) || 'mod1';
                              const isDragging = dragTaskId === task.id;
                              return (
                                <tr key={task.id} onDragOver={handleTaskDragOver} onDrop={() => handleTaskDrop(task.id)} className={`transition-all ${task.selected ? 'starter-sow-row-selected bg-white' : 'starter-sow-row-muted bg-slate-50/80 opacity-60'} ${isDragging ? 'opacity-70 ring-1 ring-indigo-300' : ''}`}>
                                  <td className="py-2 px-1 text-center align-middle">
                                    <span draggable onDragStart={() => handleTaskDragStart(task.id)} onDragEnd={() => setDragTaskId(null)} className="cursor-grab text-slate-400"><IconGripVertical /></span>
                                  </td>
                                  <td className="py-2 px-1 text-center align-middle">
                                    <button type="button" onClick={() => toggleTask(task.id)} className="p-1 text-slate-400 hover:text-indigo-600" aria-pressed={task.selected}>{task.selected ? <IconCheckSquare /> : <IconSquare />}</button>
                                    {(task.id.startsWith('custom-') || task.id.startsWith('line-')) && (
                                      <button type="button" onClick={() => removeTask(task.id)} className="p-1 text-rose-500" aria-label="Remove line"><IconTrash className="w-3.5 h-3.5" /></button>
                                    )}
                                  </td>
                                  <td className="py-2 px-1 align-top">
                                    <select value={modKey} onChange={(e) => updateTaskModuleKey(task.id, e.target.value)} disabled={!task.selected} className="starter-sow-input w-full border border-slate-200 rounded-md py-1 px-1 text-[11px]">
                                      {['mod1', 'mod2', 'mod3', 'mod4'].map((key) => (
                                        <option key={key} value={key}>{moduleBundleNames[key] || modTitle(Number(key.replace('mod', '')))}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 px-1 align-top">
                                    <input type="text" value={task.deliverable} onChange={(e) => updateTaskDeliverable(task.id, e.target.value)} disabled={!task.selected} className="starter-sow-input w-full border border-slate-200 rounded-md px-2 py-1 text-xs font-medium" />
                                  </td>
                                  <td className="py-2 px-1 align-top">
                                    <input type="number" min="0" step="any" value={task.lineQty ?? 1} onChange={(e) => updateTaskLineField(task.id, 'lineQty', e.target.value)} disabled={!task.selected} className="starter-sow-input w-full border border-slate-200 rounded-md px-1 py-1 text-xs text-center font-mono" />
                                  </td>
                                  <td className="py-2 px-1 align-top">
                                    <input type="number" min="0" step="any" value={task.lineDuration ?? 1} onChange={(e) => updateTaskLineField(task.id, 'lineDuration', e.target.value)} disabled={!task.selected} className="starter-sow-input w-full border border-slate-200 rounded-md px-1 py-1 text-xs text-center font-mono" />
                                  </td>
                                  <td className="py-2 px-1 align-top">
                                    <input type="number" min="0" step="any" value={task.lineUnitPrice ?? 0} onChange={(e) => updateTaskLineField(task.id, 'lineUnitPrice', e.target.value)} disabled={!task.selected} className="starter-sow-input w-full border border-slate-200 rounded-md px-1 py-1 text-xs text-right font-mono" />
                                  </td>
                                  <td className="py-2 px-1 align-top">
                                    <select value={task.lineUnit || 'per hour'} onChange={(e) => updateTaskLineField(task.id, 'lineUnit', e.target.value)} disabled={!task.selected} className="starter-sow-input w-full border border-slate-200 rounded-md py-1 px-1 text-[10px]">
                                      {(H.AGENCY_LINE_UNITS || []).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                                    </select>
                                  </td>
                                  <td className="py-2 px-1 text-right font-mono align-top">{formatCurrency(pricingRow?.basePrice || 0)}</td>
                                  <td className="py-2 px-1 align-top">
                                    <input type="number" min="0" step="0.1" value={task.lineMarkUp ?? 0} onChange={(e) => updateTaskLineField(task.id, 'lineMarkUp', e.target.value)} disabled={!task.selected} className="starter-sow-input w-full border border-slate-200 rounded-md px-1 py-1 text-xs text-right font-mono" />
                                  </td>
                                  <td className="py-2 px-1 text-right font-mono align-top">{formatCurrency(pricingRow?.grossProfit || 0)}</td>
                                  <td className="py-2 px-1 text-right font-mono align-top">{pricingRow ? `${pricingRow.gpMargin.toFixed(1)}%` : '0.0%'}</td>
                                  <td className="py-2 px-1 text-right font-mono font-semibold text-indigo-700 align-top">{formatCurrency(pricingRow?.estimateCost || 0)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        ) : (
                        <table className="w-full text-left border-collapse text-xs table-fixed min-w-[1050px] font-sans">
                          <thead>
                            <tr className={STARTER_UI ? "starter-sow-table-head bg-slate-100 text-xs font-semibold text-slate-600 border-b border-slate-200" : "bg-brandNavy-950/80 text-[10px] uppercase font-mono tracking-wider text-slate-400 border-b border-brandNavy-700 font-sans font-bold"}>
                              <th className="py-4 px-2 text-center w-[4%]" scope="col" aria-label="Reorder">Order</th>
                              <th className="py-4 px-5 text-center w-[6%]" scope="col">Incl</th>
                              <th className="py-3 px-3 w-[15%] text-left font-sans" scope="col">Category</th>
                              <th className="py-3 px-3 w-[34%] text-left font-sans font-bold" scope="col">Deliverable Details</th>
                              <th className="py-4 px-4 text-center w-[8%]" scope="col">Hours</th>
                              <th className="py-4 px-4 text-center w-[14%] text-left" scope="col">Expert · Rate</th>
                              <th className={`py-4 px-5 text-right w-[12%] font-bold font-sans ${STARTER_UI ? 'text-indigo-600' : 'text-brandTeal-400'}`} scope="col">Base Price</th>
                            </tr>
                          </thead>
                          <tbody className={`font-medium font-sans ${STARTER_UI ? 'starter-sow-table-body divide-y divide-slate-200' : 'divide-y divide-brandNavy-700/50'}`}>
                            {tasks.map((task, taskIndex) => {
                              const rate = getRateForTier(task.tier);
                              const isDragging = dragTaskId === task.id;
                              return (
                                <tr
                                  key={task.id}
                                  onDragOver={handleTaskDragOver}
                                  onDrop={() => handleTaskDrop(task.id)}
                                  className={`transition-all duration-150 ${task.selected ? (STARTER_UI ? 'starter-sow-row-selected bg-white' : 'bg-brandNavy-900/40') : (STARTER_UI ? 'starter-sow-row-muted bg-slate-50/80' : 'bg-brandNavy-955/10 opacity-30 font-medium')} ${isDragging ? (STARTER_UI ? 'opacity-70 ring-1 ring-indigo-300' : 'opacity-50 ring-1 ring-brandTeal-500/40') : ''}`}
                                >
                                  <td className="py-4 px-2 text-center align-middle">
                                    <div className="flex flex-col items-center gap-1">
                                      <span
                                        draggable
                                        onDragStart={(e) => { e.stopPropagation(); handleTaskDragStart(task.id); }}
                                        onDragEnd={() => setDragTaskId(null)}
                                        className="cursor-grab active:cursor-grabbing text-slate-500 hover:text-brandTeal-400"
                                        title="Drag to reorder"
                                        aria-label={`Drag to reorder ${task.deliverable}`}
                                      >
                                        <IconGripVertical />
                                      </span>
                                      <div className="flex flex-col gap-0.5">
                                        <button type="button" disabled={taskIndex === 0} onClick={() => moveTaskByOffset(task.id, -1)} className="text-[9px] leading-none px-1 py-0.5 rounded text-slate-400 hover:text-brandTeal-400 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Move up">▲</button>
                                        <button type="button" disabled={taskIndex === tasks.length - 1} onClick={() => moveTaskByOffset(task.id, 1)} className="text-[9px] leading-none px-1 py-0.5 rounded text-slate-400 hover:text-brandTeal-400 disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Move down">▼</button>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 px-5 text-center"><button type="button" onClick={() => toggleTask(task.id)} className="p-1 rounded text-slate-400 hover:text-brandTeal-500 inline-flex font-sans" aria-pressed={task.selected}>{task.selected ? <IconCheckSquare /> : <IconSquare />}</button>{task.id.startsWith('custom-') && <button type="button" onClick={() => removeTask(task.id)} className="p-1 text-rose-500 hover:text-rose-400 rounded" aria-label="Remove task"><IconTrash className="w-3.5 h-3.5" /></button>}</td>
                                  <td className="py-2 px-3 text-left align-top"><span className={STARTER_UI ? "starter-sow-category-badge text-[10px] font-semibold px-2 py-1 rounded-md border block text-center leading-snug" : "text-[9px] font-mono bg-brandNavy-950 px-2 py-1 rounded border border-brandNavy-700/80 text-brandTeal-400 font-bold block text-center leading-snug uppercase"}>{formatCategoryDisplay(task.category)}</span></td>
                                  <td className="py-2 px-3 text-left align-top space-y-1">
                                    <span className={STARTER_UI ? "starter-sow-field-label text-[10px] font-medium text-slate-500" : "text-[8px] font-mono uppercase text-slate-500 tracking-wider"}>Title</span>
                                    <textarea
                                      rows={1}
                                      ref={(el) => { if (el) autoResizeField(el, 56); }}
                                      value={task.deliverable}
                                      onChange={(e) => updateTaskDeliverable(task.id, e.target.value)}
                                      onInput={(e) => autoResizeField(e.target, 56)}
                                      onFocus={(e) => autoResizeField(e.target, 96)}
                                      disabled={!task.selected}
                                      className={STARTER_UI ? "starter-sow-input w-full border border-slate-200 rounded-md px-2 py-1 text-[13px] font-medium text-slate-800 leading-snug focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:bg-slate-100 disabled:text-slate-400 resize-none overflow-hidden min-h-[1.4rem] max-h-[3.5rem]" : "w-full bg-brandNavy-950 border border-brandNavy-700 rounded px-2 py-1 text-[12px] font-semibold text-slate-100 leading-snug focus:outline-none focus:border-brandTeal-500 disabled:opacity-50 resize-none overflow-hidden min-h-[1.4rem] max-h-[3.5rem]"}
                                      aria-label={`Deliverable name for ${task.category}`}
                                    />
                                    <span className={STARTER_UI ? "starter-sow-field-label text-[10px] font-medium text-slate-500" : "text-[8px] font-mono uppercase text-slate-500 tracking-wider"}>Description</span>
                                    <textarea
                                      rows={1}
                                      ref={(el) => { if (el) autoResizeField(el, 96); }}
                                      value={task.description}
                                      onChange={(e) => updateTaskDescription(task.id, e.target.value)}
                                      onInput={(e) => autoResizeField(e.target, 96)}
                                      onFocus={(e) => autoResizeField(e.target, 120)}
                                      disabled={!task.selected}
                                      className={STARTER_UI ? "starter-sow-input w-full border border-slate-200 rounded-md px-2 py-1 text-[12px] text-slate-600 leading-snug focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 disabled:bg-slate-100 disabled:text-slate-400 resize-none overflow-hidden min-h-[1.4rem] max-h-[6rem]" : "w-full bg-brandNavy-950/80 border border-brandNavy-800 rounded px-2 py-1 text-[11px] text-slate-400 leading-snug focus:outline-none focus:border-brandTeal-500/70 disabled:opacity-50 resize-none overflow-hidden min-h-[1.4rem] max-h-[6rem]"}
                                      aria-label={`Deliverable description for ${task.deliverable}`}
                                    />
                                    {task.deliveredAt && (
                                      <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STARTER_UI ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30'}`}>
                                        Delivered {new Date(task.deliveredAt).toLocaleDateString()}
                                      </span>
                                    )}
                                    {task.highRisk && <span className="text-rose-500 text-[9px] font-sans" title="High Risk Custom Build">⚠ High Risk Build</span>}
                                  </td>
                                  <td className="py-4 px-4 text-center align-top">
                                    <input type="number" min="0" step="1" value={task.estHours} onChange={(e) => updateTaskHours(task.id, e.target.value)} onBlur={() => validateTaskHoursOnBlur(task.id, task.selected)} className={STARTER_UI ? "starter-sow-input w-16 border border-slate-200 rounded-md px-1.5 py-1 text-xs text-center font-mono font-semibold text-slate-800 focus:outline-none focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-400" : "w-16 bg-brandNavy-950 border border-brandNavy-700 rounded px-1.5 py-1 text-xs text-center font-mono font-bold text-slate-200 focus:outline-none focus:border-brandTeal-500"} disabled={!task.selected} />
                                    {task.selected && frictionBuffer > 0 && (
                                      <div className={`text-[10px] font-mono mt-1 ${STARTER_UI ? 'text-slate-500' : 'text-slate-500'}`}>{task.estHours}→{Math.round(task.estHours * (1 + frictionBuffer / 100))}h</div>
                                    )}
                                  </td>
                                  <td className="py-4 px-4 text-center align-top">
                                    <select value={task.tier} onChange={(e) => updateTaskTier(task.id, e.target.value)} className={STARTER_UI ? "starter-sow-input w-full border border-slate-200 rounded-md py-1 px-1.5 text-[11px] text-slate-700 focus:outline-none focus:border-indigo-400 mb-1 disabled:bg-slate-100 disabled:text-slate-400" : "w-full bg-brandNavy-955 border border-brandNavy-700 rounded py-1 px-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-brandTeal-500 mb-1"} disabled={!task.selected} title={`${TIER_LABELS[task.tier] || task.tier} · ₱${rate}/hr`}><option value="associate">Specialist</option><option value="senior">Architect</option><option value="principal">Strategist</option><option value="partner">IT Partner</option></select>
                                    <div className={`font-mono text-[10px] font-semibold ${STARTER_UI ? 'text-slate-500' : 'text-slate-400 font-bold'}`}>₱{rate}/hr</div>
                                  </td>
                                  <td className={`py-4 px-5 text-right font-mono text-xs whitespace-nowrap align-top ${STARTER_UI ? 'text-slate-800 font-semibold' : 'text-slate-100'}`}>{formatCurrency(task.estHours * rate)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        )}
                      </div>
                    </div>

                    {STARTER_UI ? (
                    <div className="starter-sow-panel bg-white border border-slate-200 rounded-xl p-5 shadow-sm text-left font-sans">
                      <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2"><IconPlus /> Add line item</h3>
                      <form onSubmit={addNewTask} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="col-span-12 md:col-span-2">
                          <label className="starter-sow-field-label text-[10px] uppercase text-slate-500 block mb-1">Module</label>
                          <select value={newLineModuleKey} onChange={(e) => setNewLineModuleKey(e.target.value)} className="starter-sow-input w-full border border-slate-200 rounded-md p-2 text-xs">
                            {['mod1', 'mod2', 'mod3', 'mod4'].map((key) => (
                              <option key={key} value={key}>{moduleBundleNames[key]}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-12 md:col-span-2">
                          <label className="starter-sow-field-label text-[10px] uppercase text-slate-500 block mb-1">Particular</label>
                          <input type="text" value={newTaskDeliv} onChange={(e) => setNewTaskDeliv(e.target.value)} placeholder="e.g. Deluxe Bay" className="starter-sow-input w-full border border-slate-200 rounded-md p-2 text-xs" required />
                        </div>
                        <div className="col-span-6 md:col-span-1">
                          <label className="starter-sow-field-label text-[10px] uppercase text-slate-500 block mb-1">Qty</label>
                          <input type="number" min="0" value={newLineQty} onChange={(e) => setNewLineQty(e.target.value)} className="starter-sow-input w-full border border-slate-200 rounded-md p-2 text-xs font-mono" />
                        </div>
                        <div className="col-span-6 md:col-span-1">
                          <label className="starter-sow-field-label text-[10px] uppercase text-slate-500 block mb-1">Duration</label>
                          <input type="number" min="0" value={newLineDuration} onChange={(e) => setNewLineDuration(e.target.value)} className="starter-sow-input w-full border border-slate-200 rounded-md p-2 text-xs font-mono" />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <label className="starter-sow-field-label text-[10px] uppercase text-slate-500 block mb-1">Unit price</label>
                          <input type="number" min="0" value={newLineUnitPrice} onChange={(e) => setNewLineUnitPrice(e.target.value)} className="starter-sow-input w-full border border-slate-200 rounded-md p-2 text-xs font-mono" required />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <label className="starter-sow-field-label text-[10px] uppercase text-slate-500 block mb-1">Unit</label>
                          <select value={newLineUnit} onChange={(e) => setNewLineUnit(e.target.value)} className="starter-sow-input w-full border border-slate-200 rounded-md p-2 text-xs">
                            {(H.AGENCY_LINE_UNITS || []).map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                          </select>
                        </div>
                        <div className="col-span-6 md:col-span-1">
                          <label className="starter-sow-field-label text-[10px] uppercase text-slate-500 block mb-1">Mark up %</label>
                          <input type="number" min="0" step="0.1" value={newLineMarkUp} onChange={(e) => setNewLineMarkUp(e.target.value)} className="starter-sow-input w-full border border-slate-200 rounded-md p-2 text-xs font-mono" />
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <button type="submit" className="starter-sow-btn-primary w-full py-2 rounded-lg text-xs font-semibold">Add to scope</button>
                        </div>
                      </form>
                    </div>
                    ) : (
                    /* Custom Task Generator Form */
                    <div className="bg-brandNavy-900 border border-brandNavy-700 rounded-xl p-5 shadow-2xl text-left font-sans font-semibold">
                      <h3 className="text-xs font-bold font-mono uppercase text-brandTeal-400 mb-4 flex items-center gap-2 text-left font-sans font-semibold"><IconPlus /> Add Bespoke SOW Task</h3>
                      <form onSubmit={addNewTask} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end text-left font-sans">
                        <div className="col-span-12 md:col-span-2 text-left">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Target Phase</label>
                          <select value={newTaskCategory} onChange={e => setNewTaskCategory(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-xs text-slate-200 focus:outline-none font-sans font-medium">
                            <option value={MOD_1}>{modCategory(1)}</option>
                            <option value={MOD_2}>{modCategory(2)}</option>
                            <option value={MOD_3}>{modCategory(3)}</option>
                            <option value={MOD_4}>{modCategory(4)}</option>
                          </select>
                        </div>
                        <div className="col-span-12 md:col-span-3 text-left font-sans font-medium">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Custom Deliverable Name</label>
                          <input type="text" placeholder="e.g. Custom API Build" value={newTaskDeliv} onChange={e => setNewTaskDeliv(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-xs text-slate-200 focus:outline-none" required />
                        </div>
                        <div className="col-span-12 md:col-span-3 text-left font-sans font-medium">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Description</label>
                          <input type="text" placeholder="One-line scope summary" value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-xs text-slate-200 focus:outline-none" />
                        </div>
                        <div className="col-span-12 md:col-span-2 text-left font-sans font-medium">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Expert</label>
                          <select value={newTaskTier} onChange={e => setNewTaskTier(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-xs text-slate-200 focus:outline-none">
                            <option value="associate">Specialist</option>
                            <option value="senior">Architect</option>
                            <option value="principal">Strategist</option>
                            <option value="partner">IT Partner</option>
                          </select>
                        </div>
                        <div className="col-span-12 md:col-span-2 text-left font-sans font-medium">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Base Hours</label>
                          <input type="number" placeholder="0" value={newTaskHours} onChange={e => setNewTaskHours(e.target.value)} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-xs text-slate-200 focus:outline-none" required min="1" />
                        </div>
                        <div className="col-span-12 md:col-span-2 text-left font-sans">
                          <label className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Friction / Complexity</label>
                          <select value={newTaskMultiplier} onChange={e => setNewTaskMultiplier(Number(e.target.value))} className="w-full bg-brandNavy-955 border border-brandNavy-700 rounded p-2.5 text-xs text-slate-200 focus:outline-none font-sans font-semibold">
                            <option value="0">Low (+0%)</option>
                            <option value="15">Medium (+15%)</option>
                            <option value="30">High (+30%)</option>
                          </select>
                        </div>
                        <div className="col-span-12 md:col-span-2 text-left font-sans">
                          <button type="submit" className="w-full p-2.5 bg-brandTeal-50 hover:bg-brandTeal-400 text-slate-950 font-bold rounded text-[11px] uppercase tracking-wider font-sans font-semibold">Add To Scope</button>
                        </div>
                      </form>
                    </div>
                    )}
                  </section>
                </div>
              </div>
            ) : view === 'addendum' ? (
              <div className="h-full min-h-0">{renderAddendumWorkspace()}</div>
            ) : (
              <div className="h-full min-h-0">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full min-h-0 planner-split-layout animate-fade-in font-sans text-left">
                {renderSettingsSidebar()}
                {renderDocumentPrintCanvas()}
              </div>
              </div>
            )}
          </main>
        </div>
      );
    }

    const root = ReactDOM.createRoot(document.getElementById("root"));
    root.render(<ErrorBoundary><App /></ErrorBoundary>);
