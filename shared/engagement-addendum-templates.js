/**
 * SOW addendum templates — additional scope billed separately from the base engagement.
 */
(function (global) {
  const TEMPLATES = [
    {
      id: 'mod2-extension',
      name: 'MOD 2 Playbook Extension',
      tagline: 'Additional SOPs, handbook sections, or process playbooks beyond the original SOW.',
      modules: ['mod2'],
      tasks: { mode: 'modules', modules: ['mod2'] },
      defaults: {
        title: 'MOD 2 Playbook Extension',
        proposalObjectives: 'Document additional workflows, sign-off roles, and handbook sections not covered in the original Statement of Work.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: '50-50',
        addendumTerms: 'This Addendum supplements the original Statement of Work. All other terms of the Master Consulting Service Agreement and original SOW remain in full force except as expressly modified herein.',
      },
    },
    {
      id: 'mod3-extension',
      name: 'MOD 3 Workspace Extension',
      tagline: 'Extra workspace rollout, forms, training, or launch support.',
      modules: ['mod3'],
      tasks: { mode: 'modules', modules: ['mod3'] },
      defaults: {
        title: 'MOD 3 Workspace Extension',
        proposalObjectives: 'Extend workspace delivery with additional digitized forms, training sessions, or post go-live support beyond the original scope.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: 'auto',
        addendumTerms: 'This Addendum supplements the original Statement of Work. All other terms of the Master Consulting Service Agreement and original SOW remain in full force except as expressly modified herein.',
      },
    },
    {
      id: 'mod4-extension',
      name: 'MOD 4 Care Plan Extension',
      tagline: 'Extended retainer, health checks, or ongoing support hours.',
      modules: ['mod4'],
      tasks: { mode: 'modules', modules: ['mod4'] },
      defaults: {
        title: 'MOD 4 Care Plan Extension',
        proposalObjectives: 'Provide extended hosting support, manager check-ins, or semi-annual health checks beyond the original care plan term.',
        frictionBuffer: 5,
        discountPercent: 0,
        milestoneSplit: '50-50',
        subscriptionMonths: 6,
        addendumTerms: 'This Addendum supplements the original Statement of Work. Retainer terms in this Addendum are billed separately from the original engagement milestones.',
      },
    },
    {
      id: 'extra-playbook-pack',
      name: 'Extra Playbook Pack',
      tagline: 'One or two additional order-to-cash or approval playbooks.',
      modules: ['mod2'],
      tasks: {
        mode: 'include',
        include: ['m2-01', 'm2-02'],
      },
      defaults: {
        title: 'Extra Playbook Pack',
        proposalObjectives: 'Deliver additional plain-language playbooks for high-friction workflows identified after the initial engagement.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: '50-50',
        addendumTerms: 'This Addendum supplements the original Statement of Work. Deliverables listed herein are additive and billed separately.',
      },
    },
    {
      id: 'training-day',
      name: 'Training Day Add-On',
      tagline: 'Hands-on training session(s) for new staff or new modules.',
      modules: ['mod3'],
      tasks: {
        mode: 'include',
        include: ['m3-05'],
      },
      defaults: {
        title: 'Training Day Add-On',
        proposalObjectives: 'Conduct additional hands-on training for staff on workspace tools, forms, and daily operating rhythm.',
        frictionBuffer: 5,
        discountPercent: 0,
        milestoneSplit: '50-50',
        addendumTerms: 'This Addendum supplements the original Statement of Work. Training dates are subject to mutual scheduling.',
      },
    },
    {
      id: 'hr-coaching-package',
      name: 'HR Coaching Package',
      tagline: 'Live manager coaching plus performance conversation templates — billed separately from the base SOW.',
      modules: [],
      tasks: {
        mode: 'include',
        include: ['addon-hr-01', 'addon-hr-02', 'addon-hr-03'],
      },
      defaults: {
        title: 'HR Coaching Package',
        proposalObjectives: 'Strengthen people-management rhythm with live coaching for the owner or HR lead, reusable performance conversation templates, and a quarterly HR operating calendar — operational advisory only, not legal counsel.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: '50-50',
        addendumTerms: 'This Addendum supplements the original Statement of Work. HR coaching and templates are operational advisory deliverables — client legal review is required before treating any handbook or policy language as binding. Session dates are subject to mutual scheduling.',
      },
    },
    {
      id: 'custom',
      name: 'Custom Addendum',
      tagline: 'Start from a blank scope and build your own addendum tasks.',
      modules: [],
      tasks: { mode: 'none' },
      defaults: {
        title: 'Scope Addendum',
        proposalObjectives: 'Define additional deliverables and fees separate from the original Statement of Work.',
        frictionBuffer: 10,
        discountPercent: 0,
        milestoneSplit: '50-50',
        addendumTerms: 'This Addendum supplements the original Statement of Work. All other terms of the Master Consulting Service Agreement and original SOW remain in full force except as expressly modified herein.',
      },
    },
  ];

  function listTemplates() {
    return TEMPLATES.map((t) => ({ ...t }));
  }

  function getTemplate(id) {
    return TEMPLATES.find((t) => t.id === id) || TEMPLATES.find((t) => t.id === 'custom');
  }

  global.AddendumTemplates = {
    listTemplates,
    getTemplate,
    TEMPLATES,
  };
})(typeof window !== 'undefined' ? window : globalThis);
