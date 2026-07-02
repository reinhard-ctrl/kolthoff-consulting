/**
 * Kolthoff Project Planner — shared helpers (loaded before React app)
 */
(function (global) {
  const DEFAULT_RATES = {
    principalRate: 3500,
    seniorRate: 2500,
    associateRate: 1500,
    partnerRate: 2000
  };

  const MOD_CATEGORIES = {
    mod1: 'MOD 1 - Business Leak Scan',
    mod2: 'MOD 2 - How Your Business Runs',
    mod3: 'MOD 3 - Your Team Workspace',
    mod4: 'MOD 4 - Care Plan'
  };

  const CATEGORY_TO_PRESET = {
    'MOD 1 - Business Leak Scan': 'mod1',
    'MOD 2 - How Your Business Runs': 'mod2',
    'MOD 3 - Your Team Workspace': 'mod3',
    'MOD 4 - Care Plan': 'mod4',
    'MOD 1 - Workflow Diagnosis': 'mod1',
    'MOD 2 - Organizing How You Work': 'mod2',
    'MOD 3 - Workspace Automation': 'mod3',
    'MOD 4 - Ongoing Support': 'mod4'
  };

  function isModCategory(category, modNum) {
    return typeof category === 'string' && category.startsWith(`MOD ${modNum}`);
  }

  const MOD_DISPLAY_NAMES = {
    1: 'Business Leak Scan',
    2: 'How Your Business Runs',
    3: 'Your Team Workspace',
    4: 'Care Plan'
  };

  function getModDisplayName(modNum) {
    return MOD_DISPLAY_NAMES[modNum] || `Module ${modNum}`;
  }

  function computeModuleInvestmentSummaries(ctx) {
    const {
      tasks,
      frictionBuffer,
      discountPercent,
      rates
    } = ctx;
    const bufferMultiplier = 1 + frictionBuffer / 100;
    const discFactor = 1 - discountPercent / 100;
    const getRate = (tier) => getRateForTier(tier, rates);

    const summaries = [];
    [1, 2, 3].forEach((modNum) => {
      const modTasks = tasks.filter(
        (t) => t.selected && !t.isMonthlyRetainer && isModCategory(t.category, modNum)
      );
      if (modTasks.length === 0) return;
      const baseUndiscounted = Math.round(
        modTasks.reduce((acc, t) => acc + t.estHours * getRate(t.tier), 0) * bufferMultiplier
      );
      const afterDiscount = Math.round(baseUndiscounted * discFactor);
      summaries.push({
        modNum,
        label: getModDisplayName(modNum),
        count: modTasks.length,
        baseUndiscounted,
        afterDiscount
      });
    });

    const mod4RetainerTasks = tasks.filter((t) => t.selected && t.isMonthlyRetainer && isModCategory(t.category, 4));
    const mod4AuditTasks = tasks.filter(
      (t) => t.selected && !t.isMonthlyRetainer && isModCategory(t.category, 4)
    );
    if (mod4RetainerTasks.length > 0) {
      const monthlyBase = Math.round(
        mod4RetainerTasks.reduce((acc, t) => acc + t.estHours * getRate(t.tier), 0) * discFactor
      );
      summaries.push({
        modNum: 4,
        label: getModDisplayName(4),
        count: mod4RetainerTasks.length,
        baseUndiscounted: monthlyBase,
        afterDiscount: monthlyBase,
        isMonthly: true
      });
    }
    if (mod4AuditTasks.length > 0) {
      const auditBase = Math.round(
        mod4AuditTasks.reduce((acc, t) => acc + t.estHours * getRate(t.tier), 0) * bufferMultiplier * discFactor
      );
      summaries.push({
        modNum: '4a',
        label: `${getModDisplayName(4)} — System Health Check`,
        count: mod4AuditTasks.length,
        baseUndiscounted: auditBase,
        afterDiscount: auditBase,
        isAnnual: true
      });
    }

    return summaries;
  }

  function presetForCategory(category) {
    if (CATEGORY_TO_PRESET[category]) return CATEGORY_TO_PRESET[category];
    const match = typeof category === 'string' && category.match(/^MOD (\d)/);
    return match ? `mod${match[1]}` : null;
  }

  function getWorkspaceLabel(profile) {
    return profile?.workspaceName?.trim() || profile?.clientCompany || 'Untitled Workspace';
  }

  function deriveActivePresetsFromTasks(tasks) {
    const presets = new Set();
    (tasks || []).forEach((t) => {
      if (t.selected) {
        const preset = presetForCategory(t.category);
        if (preset) presets.add(preset);
      }
    });
    return Array.from(presets);
  }

  function getRateForTier(tier, rates) {
    switch (tier) {
      case 'principal': return rates.principalRate;
      case 'senior': return rates.seniorRate;
      case 'associate': return rates.associateRate;
      case 'partner': return rates.partnerRate;
      default: return rates.associateRate;
    }
  }

  function computeProjectEconomics(params) {
    const {
      tasks,
      frictionBuffer,
      discountPercent,
      includeTax,
      subscriptionMonths,
      milestoneSplit,
      customSplit1,
      customSplit2,
      customSplit3,
      rates,
      principalToSeniorDelegate,
      seniorToAssociateDelegate,
      recoveryPotential,
      staffCount,
      monthlySalary,
      wastedHours,
      formatCurrency
    } = params;

    const getRate = (tier) => getRateForTier(tier, rates);
    const bufferMultiplier = 1 + (frictionBuffer / 100);
    const taxMultiplier = includeTax ? 1.12 : 1.0;
    const discFactor = 1 - (discountPercent / 100);

    const selectedTasks = tasks.filter((t) => t.selected);
    const activeDiag = tasks.some((t) => isModCategory(t.category, 1) && t.selected);
    const activeSOP = tasks.some((t) => isModCategory(t.category, 2) && t.selected);
    const activePMO = tasks.some((t) => isModCategory(t.category, 3) && t.selected);

    const projectCostBaseUndiscounted = Math.round(
      tasks.filter((t) => t.selected && !t.isMonthlyRetainer).reduce(
        (acc, curr) => acc + (curr.estHours * getRate(curr.tier)), 0
      ) * bufferMultiplier
    );

    const retainerCostBaseUndiscounted = Math.round(
      tasks.filter((t) => t.selected && t.isMonthlyRetainer).reduce(
        (acc, curr) => acc + (curr.estHours * getRate(curr.tier)), 0
      )
    );

    const projectCostBase = Math.round(projectCostBaseUndiscounted * (1 - discountPercent / 100));
    const finalProjectCostBase = projectCostBase;
    const retainerCostBase = Math.round(retainerCostBaseUndiscounted * (1 - discountPercent / 100));

    const finalProjectCostPart = Math.round(finalProjectCostBase * taxMultiplier);
    const retainerCostPart = Math.round(retainerCostBase * taxMultiplier);
    const retainerCostTotalBaseUndiscounted = Math.round(retainerCostBaseUndiscounted * subscriptionMonths);
    const retainerCostTotalBase = Math.round(retainerCostBase * subscriptionMonths);
    const retainerCostTotalPart = Math.round(retainerCostTotalBase * taxMultiplier);

    const annualOperationalLeakage = staffCount * monthlySalary * 12 * (wastedHours / 8);
    const estHoursTotal = selectedTasks.reduce((acc, curr) => acc + curr.estHours, 0);
    const subtotalCost = finalProjectCostBase + retainerCostTotalBase;
    const taxValue = includeTax ? Math.round(subtotalCost * 0.12) : 0;
    const totalCost = subtotalCost + taxValue;

    const getBaseHrs = (tier) => Math.round(
      selectedTasks.filter((t) => t.tier === tier).reduce((acc, curr) => acc + curr.estHours, 0) * bufferMultiplier
    );
    const principalBaseHours = getBaseHrs('principal');
    const seniorBaseHours = getBaseHrs('senior');
    const associateBaseHours = getBaseHrs('associate');
    const partnerBaseHours = getBaseHrs('partner');
    const principalDelegatedHours = Math.round(principalBaseHours * (principalToSeniorDelegate / 100));
    const seniorWorkingPool = seniorBaseHours + principalDelegatedHours;
    const seniorDelegatedHours = Math.round(seniorWorkingPool * (seniorToAssociateDelegate / 100));
    const principalFinalHours = principalBaseHours - principalDelegatedHours;
    const seniorFinalHours = seniorWorkingPool - seniorDelegatedHours;
    const associateFinalHours = associateBaseHours + seniorDelegatedHours;
    const partnerFinalHours = partnerBaseHours;
    const internalCost = Math.round(
      (principalFinalHours * 1500) + (seniorFinalHours * 800) + (associateFinalHours * 350) + (partnerFinalHours * 1200)
    );
    const netProfit = subtotalCost - internalCost;
    const netFirstYearSavings = Math.max(0, recoveryPotential - totalCost);
    const projectROI = totalCost > 0 ? Math.round((netFirstYearSavings / totalCost) * 100) : 0;

    const updatedSummary = {
      count: selectedTasks.length,
      rawEstHours: estHoursTotal,
      estHours: Math.round(estHoursTotal * bufferMultiplier),
      subtotalCost,
      taxValue,
      totalCost,
      internalCost,
      netProfit,
      profitMarginPercent: subtotalCost > 0 ? Math.round((netProfit / subtotalCost) * 100) : 0,
      netFirstYearSavings,
      projectROI,
      principalFinalHours,
      seniorFinalHours,
      associateFinalHours,
      partnerFinalHours,
      principalBaseHours,
      seniorBaseHours,
      associateBaseHours,
      partnerBaseHours
    };

    const getModNet = (modNum) => Math.round(
      tasks.filter((t) => t.selected && !t.isMonthlyRetainer && t.category.startsWith(`MOD ${modNum}`)).reduce(
        (acc, curr) => acc + (curr.estHours * getRate(curr.tier)), 0
      ) * bufferMultiplier * discFactor
    );

    const billingMilestones = computeBillingMilestones({
      finalProjectCostPart,
      tasks,
      frictionBuffer,
      discountPercent,
      includeTax,
      milestoneSplit,
      customSplit1,
      customSplit2,
      customSplit3,
      getModNet,
      formatCurrency
    });

    const moduleInvestmentSummaries = computeModuleInvestmentSummaries({
      tasks,
      frictionBuffer,
      discountPercent,
      rates
    });

    return {
      activeDiag,
      activeSOP,
      activePMO,
      projectCostBaseUndiscounted,
      retainerCostBaseUndiscounted,
      projectCostBase,
      finalProjectCostBase,
      retainerCostBase,
      finalProjectCostPart,
      retainerCostPart,
      retainerCostTotalBaseUndiscounted,
      retainerCostTotalBase,
      retainerCostTotalPart,
      annualOperationalLeakage,
      updatedSummary,
      billingMilestones,
      moduleInvestmentSummaries
    };
  }

  function computeBillingMilestones(ctx) {
    const {
      finalProjectCostPart,
      milestoneSplit,
      customSplit1,
      customSplit2,
      customSplit3,
      getModNet,
      includeTax,
      formatCurrency
    } = ctx;

    if (finalProjectCostPart <= 0) return [];

    const taxMultiplier = includeTax ? 1.12 : 1.0;
    const m1Net = getModNet(1);
    const m2Net = getModNet(2);
    const m3Net = getModNet(3);

    if (milestoneSplit === 'auto') {
      const arr = [];
      if (m1Net > 0) {
        arr.push({
          label: 'Gate 1: Module 1 Commitment — Business Leak Scan',
          amount: Math.round(m1Net * taxMultiplier),
          desc: 'Authorized immediately at initial signup. Deliverable yields a waste-to-peso report and prioritized fix list from your leak scan.'
        });
      }
      if (m2Net > 0) {
        arr.push({
          label: 'Gate 2: Module 2 Commitment — How Your Business Runs',
          amount: Math.round(m2Net * taxMultiplier),
          desc: 'Billed only upon completion of Phase 1 and client authorization to proceed. Unlocks order playbooks, roles charts, and employee handbook.'
        });
      }
      if (m3Net > 0) {
        arr.push({
          label: 'Gate 3: Module 3 Commitment — Your Team Workspace',
          amount: Math.round(m3Net * taxMultiplier),
          desc: 'Billed only upon completion of Phase 2 and client authorization to proceed. Unlocks workspace go-live, digital forms, training, and launch help desk.'
        });
      }
      return arr;
    }

    if (milestoneSplit === '50-50') {
      return [
        { label: '1. Project Kickoff & Workspace Access Setup (50%)', amount: Math.round(finalProjectCostPart * 0.5), desc: 'Invoice issued when SOW is approved and setup begins.' },
        { label: '2. Final Handover & Team Walkthrough Completion (50%)', amount: Math.round(finalProjectCostPart * 0.5), desc: 'Invoice issued upon completion and launch of all agreed tasks.' }
      ];
    }

    if (milestoneSplit === '30-40-30') {
      return [
        { label: '1. Project Launch & Discovery Stage (30%)', amount: Math.round(finalProjectCostPart * 0.3), desc: 'Invoice issued upon signing and launching setup.' },
        { label: '2. Process Writing & Playbook Drafting (40%)', amount: Math.round(finalProjectCostPart * 0.4), desc: 'Invoice issued when draft playbooks and flows are ready.' },
        { label: '3. Workspace Tool Launch & Team Training (30%)', amount: Math.round(finalProjectCostPart * 0.3), desc: 'Invoice issued upon completion of custom tools and team training.' }
      ];
    }

    const m1 = Number(customSplit1) || 0;
    const m2 = Number(customSplit2) || 0;
    const m3 = Number(customSplit3) || 0;
    const arr = [];
    if (m1 > 0) arr.push({ label: `1. Milestone 1 (${m1}%)`, amount: Math.round(finalProjectCostPart * (m1 / 100)), desc: 'Custom structured payment part 1.' });
    if (m2 > 0) arr.push({ label: `2. Milestone 2 (${m2}%)`, amount: Math.round(finalProjectCostPart * (m2 / 100)), desc: 'Custom structured payment part 2.' });
    if (m3 > 0) arr.push({ label: `3. Milestone 3 (${m3}%)`, amount: Math.round(finalProjectCostPart * (m3 / 100)), desc: 'Custom structured payment part 3.' });
    return arr;
  }

  function computeAnnualOperationalLeakage(staffCount, monthlySalary, wastedHours) {
    const EC = global.EngagementConfig || {};
    if (EC.computePlannerChaosTax) {
      return EC.computePlannerChaosTax(staffCount, monthlySalary, wastedHours);
    }
    return (staffCount ?? 15) * (monthlySalary ?? 25000) * 12 * ((wastedHours ?? 2) / 8);
  }

  function resolvePackageSelectedIds(pkg, tasks) {
    const EP = global.EngagementPackages || {};
    if (!pkg || !Array.isArray(tasks)) return new Set();
    const cfg = pkg.tasks || {};
    if (cfg.mode === 'include') {
      return new Set(cfg.include || []);
    }
    if (cfg.mode === 'modules') {
      const modules = new Set(cfg.modules || []);
      const exclude = new Set(cfg.excludeFromModules || cfg.exclude || []);
      const selected = new Set();
      tasks.forEach((t) => {
        if (t.id.startsWith('custom-')) return;
        const preset = presetForCategory(t.category);
        if (modules.has(preset) && !exclude.has(t.id)) selected.add(t.id);
      });
      return selected;
    }
    return new Set();
  }

  function applyPackageToTasks(packageId, tasks, catalogDefaults) {
    const EP = global.EngagementPackages || {};
    const pkg = EP.getPackageById ? EP.getPackageById(packageId) : null;
    if (!pkg) {
      return { tasks, activePresets: deriveActivePresetsFromTasks(tasks), package: null };
    }
    const selectedIds = resolvePackageSelectedIds(pkg, tasks);
    const catalogById = Object.fromEntries((catalogDefaults || []).map((t) => [t.id, t]));
    const overrides = pkg.taskOverrides || {};

    const nextTasks = tasks.map((t) => {
      if (t.id.startsWith('custom-')) {
        return { ...t, selected: false };
      }
      const catalog = catalogById[t.id];
      const selected = selectedIds.has(t.id);
      const base = catalog ? { ...catalog } : { ...t };
      base.selected = selected;
      if (selected && overrides[t.id]) {
        Object.assign(base, overrides[t.id]);
        if (overrides[t.id].scopeDetails) {
          base.scopeDetails = { ...(catalog?.scopeDetails || {}), ...overrides[t.id].scopeDetails };
        }
      }
      return base;
    });

    return {
      tasks: nextTasks,
      activePresets: deriveActivePresetsFromTasks(nextTasks),
      package: pkg,
      defaults: pkg.defaults || {}
    };
  }

  function previewPackageSelection(packageId, tasks, catalogDefaults) {
    return applyPackageToTasks(packageId, tasks, catalogDefaults).tasks;
  }

  /** Package card price — aligned with SOW subtotal (project + retainer commitment). */
  function formatPackagePriceLabel(econ, formatCurrency) {
    const projectPart = econ.finalProjectCostBase || 0;
    const retainerMonthly = econ.retainerCostBase || 0;
    const retainerTotal = econ.retainerCostTotalBase || 0;
    const subtotal = projectPart + retainerTotal;

    if (retainerMonthly > 0 && projectPart === 0) {
      return `${formatCurrency(retainerMonthly)}/mo`;
    }

    return formatCurrency(subtotal);
  }

  function packagePreviewDefaults(packageId) {
    const EP = global.EngagementPackages || {};
    const pkg = EP.getPackageById ? EP.getPackageById(packageId) : null;
    return pkg?.defaults || {};
  }

  function resolveInvoiceBillTo(state) {
    if (state.useCustomInvoiceBillTo) {
      return {
        company: state.invoiceBillToCompany || '',
        rep: state.invoiceBillToRep || '',
        address: state.invoiceBillToAddress || '',
        tin: state.invoiceBillToTin || '',
      };
    }
    return {
      company: state.clientCompany || '',
      rep: state.clientRep || '',
      address: state.clientAddress || '',
      tin: state.clientTin || '',
    };
  }

  function buildProfilePayload(activeProfileId, workspaceName, state, annualOperationalLeakage) {
    const EC = global.EngagementConfig || {};
    const chaosValue = typeof annualOperationalLeakage === 'number'
      ? annualOperationalLeakage
      : computeAnnualOperationalLeakage(state.staffCount, state.monthlySalary, state.wastedHours);
    const base = {
      id: activeProfileId,
      workspaceName: workspaceName || '',
      clientCompany: state.clientCompany,
      clientRep: state.clientRep,
      clientAddress: state.clientAddress,
      clientTin: state.clientTin,
      quoteId: state.quoteId,
      quoteDate: state.quoteDate,
      quoteValidity: state.quoteValidity,
      includeTax: state.includeTax,
      preparerTitle: state.preparerTitle,
      targetStartDate: state.targetStartDate,
      proposalObjectives: state.proposalObjectives,
      proposalSponsor: state.proposalSponsor,
      preDiagnosticList: state.preDiagnosticList,
      frictionBuffer: state.frictionBuffer,
      principalToSeniorDelegate: state.principalToSeniorDelegate,
      seniorToAssociateDelegate: state.seniorToAssociateDelegate,
      overrideTimeline: state.overrideTimeline,
      weeklyHours: state.weeklyHours,
      clientReviewWeeks: state.clientReviewWeeks,
      tasks: state.tasks,
      discountPercent: state.discountPercent,
      dpaRetentionDays: state.dpaRetentionDays,
      slaCureDays: state.slaCureDays,
      slaRecurrenceMonths: state.slaRecurrenceMonths,
      subscriptionMonths: state.subscriptionMonths,
      printSow: state.printSow,
      printTimeline: state.printTimeline,
      printSla: state.printSla,
      printQuote: state.printQuote,
      printCover: state.printCover,
      milestoneSplit: state.milestoneSplit,
      customSplit1: state.customSplit1,
      customSplit2: state.customSplit2,
      customSplit3: state.customSplit3,
      ndaEffectiveDate: state.ndaEffectiveDate,
      ndaPurpose: state.ndaPurpose,
      ndaTerm: state.ndaTerm,
      ndaJurisdiction: state.ndaJurisdiction,
      invoiceMilestone: state.invoiceMilestone,
      customInvoiceAmount: state.customInvoiceAmount,
      invoiceNumberSuffix: state.invoiceNumberSuffix,
      invoiceDueDate: state.invoiceDueDate,
      useCustomInvoiceBillTo: Boolean(state.useCustomInvoiceBillTo),
      invoiceBillToCompany: state.invoiceBillToCompany || '',
      invoiceBillToRep: state.invoiceBillToRep || '',
      invoiceBillToAddress: state.invoiceBillToAddress || '',
      invoiceBillToTin: state.invoiceBillToTin || '',
      staffCount: state.staffCount,
      monthlySalary: state.monthlySalary,
      wastedHours: state.wastedHours,
      annualOperationalLeakage: chaosValue,
      chaosTax: EC.buildChaosTaxPayload
        ? EC.buildChaosTaxPayload('planner', chaosValue, {
          staffCount: state.staffCount,
          monthlySalary: state.monthlySalary,
          wastedHours: state.wastedHours
        })
        : { source: 'planner', value: chaosValue, inputs: { staffCount: state.staffCount, monthlySalary: state.monthlySalary, wastedHours: state.wastedHours } },
      principalRate: state.principalRate,
      seniorRate: state.seniorRate,
      associateRate: state.associateRate,
      partnerRate: state.partnerRate,
      selectedPackageId: state.selectedPackageId ?? null,
      packageCustomized: Boolean(state.packageCustomized),
      packageAppliedAt: state.packageAppliedAt ?? null
    };
    base._meta = EC.buildProfileMeta ? EC.buildProfileMeta() : { schemaVersion: 2, updatedAt: Date.now() };
    base.links = EC.buildProfileLinks
      ? EC.buildProfileLinks({ id: activeProfileId, quoteId: state.quoteId, links: state.links })
      : {
        crmDealId: state.links?.crmDealId || state.quoteId || null,
        portalClientId: state.links?.portalClientId || state.quoteId || null,
        contractId: state.links?.contractId || (state.quoteId ? `contract-${activeProfileId}` : null)
      };
    return base;
  }

  function validatePrintReadiness(view, ctx) {
    const issues = [];
    const warnings = [];
    const billTo = resolveInvoiceBillTo(ctx);

    if (view === 'invoice') {
      if (!billTo.company?.trim()) issues.push('Invoice bill-to company name is missing.');
      if (!billTo.rep?.trim()) issues.push('Invoice bill-to representative name is missing.');
      if (!ctx.invoiceDueDate?.trim()) issues.push('Invoice due date is missing.');
      if (billTo.tin && !ctx.validateTIN(billTo.tin)) issues.push('Invoice bill-to TIN format is invalid.');
      if (!billTo.address?.trim()) warnings.push('Invoice bill-to registered address is empty.');
      if (ctx.tasks.filter((t) => t.selected).length === 0) warnings.push('No modules/tasks are selected.');
    } else {
      if (!ctx.clientCompany?.trim()) issues.push('Company legal name is missing.');
      if (!ctx.clientRep?.trim()) issues.push('Representative name is missing.');
    }

    if (view === 'package') {
      const hasSection = ctx.printSow || ctx.printTimeline || ctx.printQuote || ctx.printCover || ctx.printSla;
      if (!hasSection) issues.push('No package print sections are selected.');
      if (ctx.tasks.filter((t) => t.selected).length === 0) issues.push('No modules/tasks are selected for the SOW.');
      if (!ctx.clientAddress?.trim()) warnings.push('Client registered address is empty.');
    }

    if (view === 'nda') {
      if (!ctx.ndaEffectiveDate?.trim()) warnings.push('NDA effective date is empty.');
    }

    return { ok: issues.length === 0, issues, warnings };
  }

  function payloadFingerprint(payload) {
    if (!payload) return '';
    const copy = { ...payload };
    delete copy.updatedAt;
    if (copy._meta) {
      copy._meta = { ...copy._meta };
      delete copy._meta.updatedAt;
    }
    const chaosValue = computeAnnualOperationalLeakage(copy.staffCount, copy.monthlySalary, copy.wastedHours);
    copy.annualOperationalLeakage = chaosValue;
    if (copy.chaosTax) {
      copy.chaosTax = {
        ...copy.chaosTax,
        value: chaosValue,
        inputs: {
          staffCount: copy.staffCount,
          monthlySalary: copy.monthlySalary,
          wastedHours: copy.wastedHours
        }
      };
    }
    return JSON.stringify(copy);
  }

  function getLocalDraftKey(profileId) {
    return `kolthoff_planner_draft_${profileId}`;
  }

  function saveLocalDraft(profileId, payload) {
    try {
      localStorage.setItem(getLocalDraftKey(profileId), JSON.stringify({ savedAt: Date.now(), payload }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadLocalDraft(profileId) {
    try {
      const raw = localStorage.getItem(getLocalDraftKey(profileId));
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearLocalDraft(profileId) {
    try {
      localStorage.removeItem(getLocalDraftKey(profileId));
    } catch (e) { /* ignore */ }
  }

  function sortProfiles(profiles, sortBy, getLabel) {
    const list = [...profiles];
    if (sortBy === 'modified') {
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    } else {
      list.sort((a, b) => getLabel(a).localeCompare(getLabel(b)));
    }
    return list;
  }

  function filterProfiles(profiles, query, getLabel) {
    if (!query.trim()) return profiles;
    const q = query.toLowerCase();
    return profiles.filter((p) => {
      return getLabel(p).toLowerCase().includes(q)
        || (p.clientCompany || '').toLowerCase().includes(q)
        || (p.quoteId || '').toLowerCase().includes(q);
    });
  }

  global.PlannerHelpers = {
    DEFAULT_RATES,
    MOD_CATEGORIES,
    MOD_DISPLAY_NAMES,
    CATEGORY_TO_PRESET,
    isModCategory,
    getModDisplayName,
    computeModuleInvestmentSummaries,
    presetForCategory,
    getWorkspaceLabel,
    deriveActivePresetsFromTasks,
    getRateForTier,
    computeProjectEconomics,
    computeBillingMilestones,
    computeAnnualOperationalLeakage,
    buildProfilePayload,
    payloadFingerprint,
    validatePrintReadiness,
    resolveInvoiceBillTo,
    saveLocalDraft,
    loadLocalDraft,
    clearLocalDraft,
    sortProfiles,
    filterProfiles,
    resolvePackageSelectedIds,
    applyPackageToTasks,
    previewPackageSelection,
    formatPackagePriceLabel,
    packagePreviewDefaults
  };
})(window);
