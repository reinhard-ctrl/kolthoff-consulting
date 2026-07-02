/**
 * Planner-driven hour baselines for analytics dashboards.
 * Prefers Cloud Function–cached _meta.totalHours; falls back to selected task sum.
 */
(function (global) {
  function selectedTasks(profile) {
    return (profile?.tasks || []).filter((t) => t.selected !== false);
  }

  function sumTaskHours(profile) {
    return selectedTasks(profile).reduce((acc, t) => acc + (Number(t.estHours) || 0), 0);
  }

  function profileTotalHours(profile) {
    const cached = profile?._meta?.totalHours;
    if (typeof cached === 'number' && cached > 0) return cached;
    return sumTaskHours(profile);
  }

  function aggregatePlannerBaselines(profiles) {
    const list = profiles || [];
    let totalHours = 0;
    let activeSows = 0;
    const byModule = { mod1: 0, mod2: 0, mod3: 0, mod4: 0 };

    list.forEach((profile) => {
      const hours = profileTotalHours(profile);
      if (hours <= 0) return;
      activeSows += 1;
      totalHours += hours;

      selectedTasks(profile).forEach((task) => {
        const h = Number(task.estHours) || 0;
        const cat = String(task.category || '');
        if (cat.includes('MOD 1')) byModule.mod1 += h;
        else if (cat.includes('MOD 2')) byModule.mod2 += h;
        else if (cat.includes('MOD 3')) byModule.mod3 += h;
        else if (cat.includes('MOD 4')) byModule.mod4 += h;
      });
    });

    return { totalHours, activeSows, byModule, profileCount: list.length };
  }

  global.AnalyticsBaseline = {
    selectedTasks,
    sumTaskHours,
    profileTotalHours,
    aggregatePlannerBaselines,
  };
})(typeof window !== 'undefined' ? window : globalThis);
