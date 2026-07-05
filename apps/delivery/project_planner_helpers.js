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

  const AGENCY_LINE_UNITS = ['per hour', 'per day', 'per unit', 'per project'];

  function getTaskModNum(taskOrCategory) {
    if (taskOrCategory && typeof taskOrCategory === 'object') {
      if (taskOrCategory.moduleKey) {
        const n = Number(String(taskOrCategory.moduleKey).replace('mod', ''));
        return Number.isFinite(n) ? n : null;
      }
      return getTaskModNum(taskOrCategory.category);
    }
    const cat = String(taskOrCategory || '');
    const modMatch = cat.match(/^MOD (\d)/);
    if (modMatch) return Number(modMatch[1]);
    const phaseMatch = cat.match(/^Phase (\d)/);
    if (phaseMatch) return Number(phaseMatch[1]);
    return null;
  }

  function isModCategory(categoryOrTask, modNum) {
    return getTaskModNum(categoryOrTask) === modNum;
  }

  function isAgencyLineItem(task) {
    return task != null && task.lineUnitPrice != null && Number.isFinite(Number(task.lineUnitPrice));
  }

  function computeAgencyLineItemPricing(task) {
    const qty = Math.max(0, Number(task.lineQty) || 0);
    const duration = Math.max(0, Number(task.lineDuration) || 0);
    const unitPrice = Math.max(0, Number(task.lineUnitPrice) || 0);
    const markUp = Math.max(0, Number(task.lineMarkUp) || 0);
    const basePrice = Math.round(qty * duration * unitPrice);
    const grossProfit = Math.round(basePrice * (markUp / 100));
    const estimateCost = basePrice + grossProfit;
    const gpMargin = estimateCost > 0
      ? Math.round((grossProfit / estimateCost) * 1000) / 10
      : 0;
    return { basePrice, grossProfit, gpMargin, estimateCost, markUp };
  }

  function agencyModCategory(modKey, label) {
    const n = Number(String(modKey).replace('mod', ''));
    const name = label || getModDisplayName(n);
    return `MOD ${n} - ${name}`;
  }

  function normalizeAgencyLineItemTask(task, moduleBundleNames) {
    if (!task || typeof task !== 'object') return task;
    const modKey = task.moduleKey || presetForTask(task) || 'mod1';
    const modNum = Number(String(modKey).replace('mod', ''));
    const label = moduleBundleNames?.[modKey] || getModDisplayName(modNum);
    const estHours = task.estHours || 1;
    return {
      ...task,
      moduleKey: modKey,
      category: agencyModCategory(modKey, label),
      lineQty: task.lineQty ?? 1,
      lineDuration: task.lineDuration ?? estHours,
      lineUnitPrice: task.lineUnitPrice ?? 1500,
      lineUnit: task.lineUnit || 'per hour',
      lineMarkUp: task.lineMarkUp ?? 25,
    };
  }

  function presetForTask(task) {
    if (task?.moduleKey) return task.moduleKey;
    return presetForCategory(task?.category);
  }

  const MOD_DISPLAY_NAMES = {
    1: 'Business Leak Scan',
    2: 'How Your Business Runs',
    3: 'Your Team Workspace',
    4: 'Care Plan'
  };

  function getModDisplayName(modNum) {
    if (global.ProductConfig?.getModTitle) {
      return global.ProductConfig.getModTitle(modNum);
    }
    return MOD_DISPLAY_NAMES[modNum] || `Module ${modNum}`;
  }

  function taskBillableBase(task, ctx) {
    const {
      starterLineItems,
      frictionBuffer,
      rates,
    } = ctx;
    if (starterLineItems && isAgencyLineItem(task)) {
      return computeAgencyLineItemPricing(task).estimateCost;
    }
    const bufferMultiplier = 1 + frictionBuffer / 100;
    const getRate = (tier) => getRateForTier(tier, rates);
    return task.estHours * getRate(task.tier) * bufferMultiplier;
  }

  function computeModuleInvestmentSummaries(ctx) {
    const {
      tasks,
      frictionBuffer,
      discountPercent,
      rates,
      starterLineItems,
      moduleBundleNames,
    } = ctx;
    const bufferMultiplier = 1 + frictionBuffer / 100;
    const discFactor = 1 - discountPercent / 100;
    const getRate = (tier) => getRateForTier(tier, rates);
    const billCtx = { starterLineItems, frictionBuffer, rates };

    const modLabel = (modNum) => {
      const key = `mod${modNum}`;
      return moduleBundleNames?.[key] || getModDisplayName(modNum);
    };

    const summaries = [];
    [1, 2, 3].forEach((modNum) => {
      const modTasks = tasks.filter(
        (t) => t.selected && !t.isMonthlyRetainer && isModCategory(t, modNum)
      );
      if (modTasks.length === 0) return;
      const baseUndiscounted = Math.round(
        modTasks.reduce((acc, t) => acc + taskBillableBase(t, billCtx), 0)
      );
      const afterDiscount = Math.round(baseUndiscounted * discFactor);
      summaries.push({
        modNum,
        label: modLabel(modNum),
        count: modTasks.length,
        baseUndiscounted,
        afterDiscount
      });
    });

    const mod4RetainerTasks = tasks.filter((t) => t.selected && t.isMonthlyRetainer && isModCategory(t, 4));
    const mod4AuditTasks = tasks.filter(
      (t) => t.selected && !t.isMonthlyRetainer && isModCategory(t, 4)
    );
    if (mod4RetainerTasks.length > 0) {
      const monthlyBase = Math.round(
        mod4RetainerTasks.reduce((acc, t) => acc + taskBillableBase(t, billCtx), 0) * discFactor
      );
      summaries.push({
        modNum: 4,
        label: modLabel(4),
        count: mod4RetainerTasks.length,
        baseUndiscounted: monthlyBase,
        afterDiscount: monthlyBase,
        isMonthly: true
      });
    }
    if (mod4AuditTasks.length > 0) {
      const auditBase = Math.round(
        mod4AuditTasks.reduce((acc, t) => acc + taskBillableBase(t, billCtx), 0) * discFactor
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
        const preset = presetForTask(t);
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
      formatCurrency,
      starterLineItems,
      moduleBundleNames,
    } = params;

    const getRate = (tier) => getRateForTier(tier, rates);
    const bufferMultiplier = 1 + (frictionBuffer / 100);
    const taxMultiplier = includeTax ? 1.12 : 1.0;
    const discFactor = 1 - (discountPercent / 100);
    const billCtx = { starterLineItems, frictionBuffer, rates };

    const selectedTasks = tasks.filter((t) => t.selected);
    const activeDiag = tasks.some((t) => isModCategory(t, 1) && t.selected);
    const activeSOP = tasks.some((t) => isModCategory(t, 2) && t.selected);
    const activePMO = tasks.some((t) => isModCategory(t, 3) && t.selected);

    const projectCostBaseUndiscounted = Math.round(
      tasks.filter((t) => t.selected && !t.isMonthlyRetainer).reduce(
        (acc, curr) => acc + taskBillableBase(curr, billCtx), 0
      )
    );

    const retainerCostBaseUndiscounted = Math.round(
      tasks.filter((t) => t.selected && t.isMonthlyRetainer).reduce(
        (acc, curr) => acc + taskBillableBase(curr, billCtx), 0
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
      tasks.filter((t) => t.selected && !t.isMonthlyRetainer && isModCategory(t, modNum)).reduce(
        (acc, curr) => acc + taskBillableBase(curr, billCtx), 0
      ) * discFactor
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
      formatCurrency,
      starterLineItems,
      moduleBundleNames,
    });

    const moduleInvestmentSummaries = computeModuleInvestmentSummaries({
      tasks,
      frictionBuffer,
      discountPercent,
      rates,
      starterLineItems,
      moduleBundleNames,
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
      const modLabel = (modNum) => {
        if (ctx.starterLineItems && ctx.moduleBundleNames?.[`mod${modNum}`]) {
          return ctx.moduleBundleNames[`mod${modNum}`];
        }
        return getModDisplayName(modNum);
      };
      if (m1Net > 0) {
        arr.push({
          label: ctx.starterLineItems
            ? `Gate 1: ${modLabel(1)} — Project kickoff`
            : 'Gate 1: Module 1 Commitment — Business Leak Scan',
          amount: Math.round(m1Net * taxMultiplier),
          desc: ctx.starterLineItems
            ? 'Authorized at signing. Covers discovery and initial deliverables in this module.'
            : 'Authorized immediately at initial signup. Deliverable yields a waste-to-peso report and prioritized fix list from your leak scan.'
        });
      }
      if (m2Net > 0) {
        arr.push({
          label: ctx.starterLineItems
            ? `Gate 2: ${modLabel(2)} — Mid-project approval`
            : 'Gate 2: Module 2 Commitment — How Your Business Runs',
          amount: Math.round(m2Net * taxMultiplier),
          desc: ctx.starterLineItems
            ? 'Billed upon client approval to proceed after the prior gate is accepted.'
            : 'Billed only upon completion of Phase 1 and client authorization to proceed. Unlocks order playbooks, roles charts, and employee handbook.'
        });
      }
      if (m3Net > 0) {
        arr.push({
          label: ctx.starterLineItems
            ? `Gate 3: ${modLabel(3)} — Final delivery`
            : 'Gate 3: Module 3 Commitment — Your Team Workspace',
          amount: Math.round(m3Net * taxMultiplier),
          desc: ctx.starterLineItems
            ? 'Billed upon completion of build and handover for this module.'
            : 'Billed only upon completion of Phase 2 and client authorization to proceed. Unlocks workspace go-live, digital forms, training, and launch help desk.'
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

  /** Slices owned by Policy Studio, Diagnosis, Workflow Builder, Org Chart — not planner form state. */
  const PRESERVED_PROFILE_SLICE_KEYS = [
    'branding',
    'sponsorTitle',
    'policySignatoryName',
    'policySignatoryTitle',
    'orgChart',
    'subSaaS',
    'raciAssignments',
    'synthesis',
    'tabs',
    'roles',
  ];

  function pickPreservedProfileSlices(source) {
    if (!source || typeof source !== 'object') return {};
    const slices = {};
    for (const key of PRESERVED_PROFILE_SLICE_KEYS) {
      if (source[key] !== undefined) slices[key] = source[key];
    }
    return slices;
  }

  /** Firestore rejects undefined field values — omit them recursively before setDoc. */
  function stripUndefinedDeep(value) {
    if (Array.isArray(value)) {
      let changed = false;
      const mapped = value.map((item) => {
        const cleaned = stripUndefinedDeep(item);
        if (cleaned !== item) changed = true;
        return cleaned;
      });
      return changed ? mapped : value;
    }
    if (value !== null && typeof value === 'object') {
      let hasUndefined = false;
      for (const nested of Object.values(value)) {
        if (nested === undefined) {
          hasUndefined = true;
          break;
        }
      }
      if (!hasUndefined) {
        let nestedChanged = false;
        for (const nested of Object.values(value)) {
          if (stripUndefinedDeep(nested) !== nested) {
            nestedChanged = true;
            break;
          }
        }
        if (!nestedChanged) return value;
      }
      const out = {};
      for (const [key, nested] of Object.entries(value)) {
        if (nested === undefined) continue;
        out[key] = stripUndefinedDeep(nested);
      }
      return out;
    }
    return value;
  }

  function buildProfilePayload(activeProfileId, workspaceName, state, annualOperationalLeakage, preservedSource) {
    const EC = global.EngagementConfig || {};
    const chaosValue = typeof annualOperationalLeakage === 'number'
      ? annualOperationalLeakage
      : computeAnnualOperationalLeakage(state.staffCount, state.monthlySalary, state.wastedHours);
    const base = {
      id: activeProfileId,
      workspaceName: workspaceName || '',
      clientCompany: state.clientCompany ?? '',
      clientRep: state.clientRep ?? '',
      clientAddress: state.clientAddress ?? '',
      clientTin: state.clientTin ?? '',
      quoteId: state.quoteId ?? '',
      quoteDate: state.quoteDate ?? '',
      quoteValidity: state.quoteValidity ?? '',
      includeTax: Boolean(state.includeTax),
      preparerTitle: state.preparerTitle ?? '',
      targetStartDate: state.targetStartDate ?? '',
      proposalObjectives: state.proposalObjectives ?? '',
      proposalSponsor: state.proposalSponsor ?? '',
      preDiagnosticList: state.preDiagnosticList ?? '',
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
      retainerBillingPeriod: state.retainerBillingPeriod || '',
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
      packageAppliedAt: state.packageAppliedAt ?? null,
      addenda: Array.isArray(state.addenda) ? state.addenda : (preservedSource?.addenda || []),
      activeAddendumId: state.activeAddendumId ?? preservedSource?.activeAddendumId ?? null,
      invoiceAddendumId: state.invoiceAddendumId ?? preservedSource?.invoiceAddendumId ?? null,
      moduleBundleNames: state.moduleBundleNames,
    };
    base._meta = EC.buildProfileMeta ? EC.buildProfileMeta() : { schemaVersion: 2, updatedAt: Date.now() };
    base.links = EC.buildProfileLinks
      ? EC.buildProfileLinks({ id: activeProfileId, quoteId: state.quoteId, links: state.links })
      : {
        crmDealId: state.links?.crmDealId || state.quoteId || null,
        portalClientId: state.links?.portalClientId || state.quoteId || null,
        contractId: state.links?.contractId || (state.quoteId ? `contract-${activeProfileId}` : null)
      };
    return stripUndefinedDeep({ ...base, ...pickPreservedProfileSlices(preservedSource) });
  }

  function validatePrintReadiness(view, ctx) {
    const issues = [];
    const warnings = [];
    const billTo = resolveInvoiceBillTo(ctx);

    if (view === 'invoice') {
      if (!billTo.company?.trim()) issues.push('Invoice bill-to company name is missing.');
      if (!billTo.rep?.trim()) issues.push('Invoice bill-to representative name is missing.');
      if (billTo.tin && !ctx.validateTIN(billTo.tin)) issues.push('Invoice bill-to TIN format is invalid.');
      if (!billTo.address?.trim()) warnings.push('Invoice bill-to registered address is empty.');

      const addendum = ctx.invoiceTargetAddendum || null;
      if (addendum) {
        if (!addendum.title?.trim()) issues.push('Addendum title is missing.');
        if (!(addendum.tasks || []).filter((t) => t.selected).length) {
          issues.push('No deliverables selected for this addendum.');
        }
        if (ctx.issueInvoice && !ctx.invoiceDueDate?.trim()) {
          issues.push('Addendum invoice due date is missing.');
        }
      } else {
        if (!ctx.invoiceDueDate?.trim()) issues.push('Invoice due date is missing.');
        if ((ctx.tasks || []).filter((t) => t.selected).length === 0) warnings.push('No modules/tasks are selected.');
      }
    } else {
      if (!ctx.clientCompany?.trim()) issues.push('Company legal name is missing.');
      if (!ctx.clientRep?.trim()) issues.push('Representative name is missing.');
    }

    if (view === 'package') {
      const hasSection = ctx.printSow || ctx.printTimeline || ctx.printQuote || ctx.printCover || ctx.printSla;
      if (!hasSection) issues.push('No package print sections are selected.');
      if ((ctx.tasks || []).filter((t) => t.selected).length === 0) issues.push('No modules/tasks are selected for the SOW.');
      if (!ctx.clientAddress?.trim()) warnings.push('Client registered address is empty.');
    }

    if (view === 'nda') {
      if (!ctx.ndaEffectiveDate?.trim()) warnings.push('NDA effective date is empty.');
    }

    if (view === 'addendum') {
      const addendum = ctx.activeAddendum;
      if (!addendum) {
        issues.push('Select or create an addendum first.');
      } else {
        if (!addendum.title?.trim()) issues.push('Addendum title is missing.');
        if (!(addendum.tasks || []).filter((t) => t.selected).length) {
          issues.push('No deliverables selected for this addendum.');
        }
        if (ctx.issueInvoice && !ctx.invoiceDueDate?.trim()) {
          issues.push('Addendum invoice due date is missing.');
        }
      }
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

  function nextAddendumSuffix(addenda) {
    const used = new Set((addenda || []).map((a) => a.suffix));
    for (let i = 1; i < 100; i += 1) {
      const suffix = `A${i}`;
      if (!used.has(suffix)) return suffix;
    }
    return `A${Date.now()}`;
  }

  function buildAddendumRef(parentQuoteId, suffix) {
    const base = String(parentQuoteId || 'KC0000').trim();
    return `${base}-${suffix}`;
  }

  function cloneTasksForAddendum(catalogTasks, selectedIds) {
    const idSet = new Set(selectedIds || []);
    return (catalogTasks || []).map((task) => ({
      ...task,
      selected: idSet.has(task.id),
    }));
  }

  function createAddendumRecord(options) {
    const {
      parentQuoteId,
      addenda = [],
      templateId = 'custom',
      catalogTasks = [],
      quoteDate = '',
    } = options;
    const AT = global.AddendumTemplates || {};
    const template = AT.getTemplate ? AT.getTemplate(templateId) : null;
    const suffix = nextAddendumSuffix(addenda);
    const ref = buildAddendumRef(parentQuoteId, suffix);
    const defaults = template?.defaults || {};
    let selectedIds = [];
    if (template?.tasks?.mode === 'modules' && global.PlannerHelpers?.resolvePackageSelectedIds) {
      selectedIds = resolvePackageSelectedIds(template.tasks, catalogTasks);
    } else if (template?.tasks?.mode === 'include') {
      selectedIds = template.tasks.include || [];
    }
    const tasks = cloneTasksForAddendum(catalogTasks, selectedIds);
    return {
      id: `addendum-${Date.now()}`,
      ref,
      suffix,
      parentQuoteId: parentQuoteId || '',
      title: defaults.title || template?.name || 'Scope Addendum',
      templateId: template?.id || 'custom',
      status: 'draft',
      createdAt: Date.now(),
      issuedAt: null,
      quoteDate: quoteDate || new Date().toISOString().slice(0, 10),
      proposalObjectives: defaults.proposalObjectives || '',
      addendumTerms: defaults.addendumTerms || '',
      tasks,
      frictionBuffer: defaults.frictionBuffer ?? 10,
      discountPercent: defaults.discountPercent ?? 0,
      milestoneSplit: defaults.milestoneSplit || '50-50',
      customSplit1: 50,
      customSplit2: 50,
      customSplit3: 0,
      subscriptionMonths: defaults.subscriptionMonths ?? 6,
      invoiceMilestone: 'full',
      invoiceNumberSuffix: suffix,
      invoiceDueDate: '',
      customInvoiceAmount: 0,
      useCustomInvoiceBillTo: false,
      invoiceBillToCompany: '',
      invoiceBillToRep: '',
      invoiceBillToAddress: '',
      invoiceBillToTin: '',
    };
  }

  function computeAddendumEconomics(addendum, parentCtx) {
    if (!addendum) return null;
    const includeTax = parentCtx.includeTax;
    return computeProjectEconomics({
      tasks: addendum.tasks || [],
      frictionBuffer: addendum.frictionBuffer ?? parentCtx.frictionBuffer ?? 10,
      discountPercent: addendum.discountPercent ?? 0,
      includeTax,
      subscriptionMonths: addendum.subscriptionMonths ?? parentCtx.subscriptionMonths ?? 6,
      milestoneSplit: addendum.milestoneSplit || '50-50',
      customSplit1: addendum.customSplit1 ?? 50,
      customSplit2: addendum.customSplit2 ?? 50,
      customSplit3: addendum.customSplit3 ?? 0,
      rates: parentCtx.rates,
      principalToSeniorDelegate: parentCtx.principalToSeniorDelegate ?? 20,
      seniorToAssociateDelegate: parentCtx.seniorToAssociateDelegate ?? 40,
      recoveryPotential: parentCtx.recoveryPotential ?? 0,
      staffCount: parentCtx.staffCount ?? 15,
      monthlySalary: parentCtx.monthlySalary ?? 25000,
      wastedHours: parentCtx.wastedHours ?? 2,
      formatCurrency: parentCtx.formatCurrency || ((n) => String(n)),
    });
  }

  function updateAddendumInList(addenda, addendumId, patch) {
    return (addenda || []).map((item) => (item.id === addendumId ? { ...item, ...patch } : item));
  }

  function removeAddendumFromList(addenda, addendumId) {
    return (addenda || []).filter((item) => item.id !== addendumId);
  }

  function canDeleteAddendum(addendum) {
    if (!addendum) return false;
    return addendum.status === 'draft' || addendum.status === 'issued';
  }

  global.PlannerHelpers = {
    DEFAULT_RATES,
    MOD_CATEGORIES,
    MOD_DISPLAY_NAMES,
    CATEGORY_TO_PRESET,
    AGENCY_LINE_UNITS,
    isAgencyLineItem,
    computeAgencyLineItemPricing,
    agencyModCategory,
    normalizeAgencyLineItemTask,
    presetForTask,
    getTaskModNum,
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
    pickPreservedProfileSlices,
    PRESERVED_PROFILE_SLICE_KEYS,
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
    packagePreviewDefaults,
    nextAddendumSuffix,
    buildAddendumRef,
    createAddendumRecord,
    computeAddendumEconomics,
    updateAddendumInList,
    removeAddendumFromList,
    canDeleteAddendum,
    cloneTasksForAddendum,
  };
})(window);
