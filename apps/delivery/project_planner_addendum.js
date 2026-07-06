/**
 * Project Planner — Addendum tab UI (React elements via createElement).
 */
(function (global) {
  const React = global.React;

  function renderAddendumTaskList(props) {
    const {
      addendum,
      onToggleTask,
      onUpdateHours,
      H,
      formatCurrency,
      getRateForTier,
    } = props;
    if (!addendum) return null;
    const tasks = addendum.tasks || [];
    const selected = tasks.filter((t) => t.selected);
    return React.createElement(
      'div',
      { className: 'space-y-2 max-h-[320px] overflow-y-auto pr-1' },
      tasks.map((task) => React.createElement(
        'label',
        {
          key: task.id,
          className: `flex items-start gap-2 p-2 rounded border cursor-pointer ${task.selected ? 'border-brandTeal-500/40 bg-brandTeal-500/5' : 'border-brandNavy-800 hover:border-brandNavy-700'}`,
        },
        React.createElement('input', {
          type: 'checkbox',
          checked: !!task.selected,
          onChange: () => onToggleTask(task.id),
          className: 'mt-1 accent-brandTeal-500 shrink-0',
        }),
        React.createElement(
          'span',
          { className: 'flex-1 min-w-0 text-left' },
          React.createElement('span', { className: 'block text-[11px] font-bold text-slate-200 truncate' }, task.deliverable),
          React.createElement('span', { className: 'block text-[9px] text-slate-500 font-mono truncate' }, task.category),
          React.createElement(
            'span',
            { className: 'block text-[9px] text-brandTeal-400 font-mono mt-0.5' },
            `${task.estHours}h · ${formatCurrency(Math.round(task.estHours * getRateForTier(task.tier, props.rates)))}`,
          ),
        ),
        task.selected && React.createElement('input', {
          type: 'number',
          min: 1,
          value: task.estHours,
          onClick: (e) => e.stopPropagation(),
          onChange: (e) => onUpdateHours(task.id, e.target.value),
          className: 'w-14 bg-brandNavy-955 border border-brandNavy-700 rounded p-1 text-[10px] text-slate-200 font-mono shrink-0',
        }),
      )),
      selected.length === 0 && React.createElement('p', { className: 'text-[10px] text-amber-400 font-mono' }, 'Select at least one deliverable for this addendum.'),
    );
  }

  function renderAddendumEditor(props) {
    const {
      addenda,
      activeAddendum,
      activeAddendumId,
      setActiveAddendumId,
      onCreateFromTemplate,
      onPatchActive,
      onToggleTask,
      onUpdateHours,
      templates,
      onDeleteActive,
      H,
      formatCurrency,
      rates,
      getRateForTier,
      addendumEconomics,
    } = props;

    return React.createElement(
      'div',
      { className: 'space-y-4 text-left font-sans' },
      React.createElement(
        'div',
        { className: 'flex flex-wrap gap-2 items-center' },
        React.createElement('span', { className: 'text-[10px] font-mono uppercase text-slate-500 font-bold' }, 'Addenda'),
        (addenda || []).map((a) => React.createElement(
          'button',
          {
            key: a.id,
            type: 'button',
            onClick: () => setActiveAddendumId(a.id),
            className: `px-2 py-1 rounded text-[9px] font-mono uppercase font-bold border ${activeAddendumId === a.id ? 'bg-brandTeal-500 text-brandNavy-955 border-brandTeal-500' : 'bg-brandNavy-900 text-slate-400 border-brandNavy-700'}`,
          },
          `${a.suffix} · ${a.status}`,
        )),
      ),
      React.createElement(
        'fieldset',
        { className: 'bg-brandNavy-955 border border-brandNavy-700 rounded-xl p-3 space-y-2' },
        React.createElement('legend', { className: 'text-[10px] font-mono uppercase text-brandTeal-400 font-bold px-1' }, 'New addendum from template'),
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 sm:grid-cols-2 gap-2' },
          (templates || []).map((tmpl) => React.createElement(
            'button',
            {
              key: tmpl.id,
              type: 'button',
              onClick: () => onCreateFromTemplate(tmpl.id),
              className: 'text-left p-2.5 rounded-lg border border-brandNavy-700 hover:border-brandTeal-500/50 bg-brandNavy-900 hover:bg-brandNavy-850 transition-colors',
            },
            React.createElement('span', { className: 'block text-[11px] font-bold text-slate-200' }, tmpl.name),
            React.createElement('span', { className: 'block text-[9px] text-slate-500 mt-0.5 leading-snug' }, tmpl.tagline),
          )),
        ),
      ),
      activeAddendum && React.createElement(
        'div',
        { className: 'space-y-4' },
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 md:grid-cols-2 gap-3' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'text-[10px] font-mono text-slate-400 uppercase block mb-1' }, 'Addendum reference'),
            React.createElement('input', {
              type: 'text',
              readOnly: true,
              value: activeAddendum.ref,
              className: 'w-full bg-brandNavy-950 border border-brandNavy-700 rounded p-2 text-slate-400 font-mono text-xs',
            }),
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { className: 'text-[10px] font-mono text-slate-400 uppercase block mb-1' }, 'Title'),
            React.createElement('input', {
              type: 'text',
              value: activeAddendum.title || '',
              onChange: (e) => onPatchActive({ title: e.target.value }),
              className: 'w-full bg-brandNavy-950 border border-brandNavy-700 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-brandTeal-500',
            }),
          ),
        ),
        (activeAddendum.status === 'draft' || activeAddendum.status === 'issued') && onDeleteActive && React.createElement(
          'div',
          { className: 'flex justify-end' },
          React.createElement(
            'button',
            {
              type: 'button',
              onClick: onDeleteActive,
              className: 'px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-[10px] font-mono uppercase font-bold tracking-wider',
            },
            activeAddendum.status === 'issued' ? 'Delete issued addendum' : 'Delete draft addendum',
          ),
        ),
        activeAddendum.status === 'invoiced' && React.createElement(
          'p',
          { className: 'text-[10px] font-mono text-slate-500 text-right' },
          'Invoiced addenda cannot be deleted here. Void the invoice in Collections first.',
        ),
        React.createElement(
          'div',
          null,
          React.createElement('label', { className: 'text-[10px] font-mono text-slate-400 uppercase block mb-1' }, 'Addendum objectives'),
          React.createElement('textarea', {
            rows: 3,
            value: activeAddendum.proposalObjectives || '',
            onChange: (e) => onPatchActive({ proposalObjectives: e.target.value }),
            className: 'w-full bg-brandNavy-950 border border-brandNavy-700 rounded p-2 text-slate-200 text-xs focus:outline-none focus:border-brandTeal-500',
          }),
        ),
        React.createElement(
          'fieldset',
          { className: 'bg-brandNavy-955 border border-brandNavy-700 rounded-xl p-3 space-y-2' },
          React.createElement('legend', { className: 'text-[10px] font-mono uppercase text-brandTeal-400 font-bold px-1' }, 'Addendum scope (select deliverables)'),
          renderAddendumTaskList({
            addendum: activeAddendum,
            onToggleTask,
            onUpdateHours,
            H,
            formatCurrency,
            rates,
            getRateForTier,
          }),
        ),
        addendumEconomics && React.createElement(
          'div',
          { className: 'text-[9px] font-mono text-slate-500 space-y-1 border-t border-brandNavy-800 pt-2' },
          React.createElement('div', { className: 'flex justify-between' }, React.createElement('span', null, 'Addendum subtotal'), React.createElement('span', { className: 'text-brandTeal-300' }, formatCurrency(addendumEconomics.finalProjectCostBase + addendumEconomics.retainerCostTotalBase))),
          (addendumEconomics.billingMilestones || []).map((m, i) => React.createElement(
            'div',
            { key: i, className: 'flex justify-between gap-2' },
            React.createElement('span', { className: 'truncate' }, m.label),
            React.createElement('span', { className: 'text-brandTeal-300 shrink-0' }, formatCurrency(m.amount)),
          )),
        ),
      ),
    );
  }

  function renderAddendumPrintDocument(props) {
    const {
      addendum,
      parentQuoteId,
      clientCompany,
      clientRep,
      clientAddress,
      clientTin,
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
      starterUi,
      BrandLogo,
    } = props;
    if (!addendum || !addendumEconomics) return null;
    const selectedTasks = (addendum.tasks || []).filter((t) => t.selected);
    const totalBase = addendumEconomics.finalProjectCostBase + addendumEconomics.retainerCostTotalBase;
    const vat = includeTax ? Math.round(totalBase * 0.12) : 0;
    const total = totalBase + vat;
    const issuerName = issuerCompanyName || (starterUi && brand?.companyName) || 'Kolthoff Consulting';
    const logoNode = renderPrintBrandLogo && brand
      ? renderPrintBrandLogo(brand)
      : (BrandLogo ? React.createElement(BrandLogo, { className: 'w-14 h-14 shrink-0 text-brandTeal-500' }) : null);

    return React.createElement(
      'div',
      { id: 'addendum-print-area', className: `xl:col-span-8 planner-split-panel print:w-full print-section text-left font-sans${starterUi ? ' starter-pdf-neutral' : ''}` },
      React.createElement(
        'section',
        { className: 'print-card bg-white text-slate-900 p-8 rounded-xl border border-slate-200 print:rounded-none print:border-0 print:p-0 space-y-6' },
        React.createElement(
          'div',
          { className: 'space-y-4 print-avoid-break' },
          React.createElement(
            'div',
            { className: 'flex items-center gap-4 pb-4 border-b border-slate-200' },
            logoNode,
            React.createElement(
              'div',
              null,
              starterUi
                ? [
                    React.createElement('h2', { key: 'name', className: 'text-lg font-bold text-slate-900 leading-tight' }, issuerName),
                    brand?.tagline && React.createElement('p', { key: 'tag', className: 'text-[10px] text-slate-500 mt-1' }, brand.tagline),
                  ]
                : [
                    React.createElement('h2', { key: 'name', className: 'text-sm font-bold text-slate-900 uppercase tracking-wide' }, preparedBy),
                    React.createElement('p', { key: 'dba', className: 'text-[10px] text-slate-500 mt-1 uppercase tracking-wider' }, 'Trade style: Kolthoff Consulting'),
                  ],
            ),
          ),
          React.createElement('h1', { className: 'text-2xl font-serif font-bold text-slate-900' }, 'Statement of Work Addendum'),
          React.createElement('p', { className: 'text-sm font-mono text-slate-500' }, `${addendum.ref} · Supplements ${parentQuoteId}`),
          React.createElement(
            'div',
            { className: 'border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-1' },
            React.createElement('div', { className: 'text-[10px] font-mono uppercase text-slate-400 font-bold' }, 'Prepared for'),
            React.createElement('div', { className: 'text-lg font-bold' }, clientCompany),
            React.createElement('div', { className: 'text-sm text-slate-600' }, clientRep),
            clientAddress && React.createElement('div', { className: 'text-xs text-slate-500' }, clientAddress),
            clientTin && React.createElement('div', { className: 'text-xs font-mono' }, `TIN: ${clientTin}`),
          ),
          React.createElement('p', { className: 'text-xs text-slate-600 leading-relaxed' }, addendum.proposalObjectives),
        ),
        React.createElement(
          'div',
          { className: 'border-t border-slate-200 pt-5 space-y-3' },
          React.createElement('h2', { className: 'text-sm font-mono uppercase tracking-wider text-slate-400 font-bold' }, 'Additional deliverables'),
          React.createElement(
            'div',
            { className: 'space-y-3' },
            selectedTasks.map((task) => React.createElement(
              'article',
              { key: task.id, className: 'border border-slate-200 rounded-lg p-3 print-avoid-break' },
              React.createElement('h3', { className: 'text-sm font-bold text-slate-900' }, task.deliverable),
              React.createElement('p', { className: 'text-[10px] font-mono text-slate-500 mb-1' }, task.category),
              React.createElement('p', { className: 'text-xs text-slate-700 leading-snug' }, task.description),
              task.scopeDetails?.output && React.createElement('p', { className: 'text-xs text-slate-600 mt-1' }, React.createElement('strong', null, 'Output: '), task.scopeDetails.output),
            )),
          ),
        ),
        React.createElement(
          'div',
          { className: 'border-t border-slate-200 pt-5 space-y-4 print-avoid-break' },
          React.createElement('h2', { className: 'text-sm font-mono uppercase tracking-wider text-slate-400 font-bold' }, 'Addendum quotation (separate invoice)'),
          React.createElement(
            'table',
            { className: 'w-full text-xs border-collapse' },
            React.createElement('tbody', null,
              React.createElement('tr', { className: 'border-b border-slate-200' },
                React.createElement('td', { className: 'py-1.5 font-bold' }, 'Addendum professional fees'),
                React.createElement('td', { className: 'py-1.5 text-right font-mono' }, formatCurrency(totalBase)),
              ),
              includeTax && React.createElement('tr', { className: 'border-b border-slate-200' },
                React.createElement('td', { className: 'py-1.5' }, '12% VAT'),
                React.createElement('td', { className: 'py-1.5 text-right font-mono' }, formatCurrency(vat)),
              ),
              React.createElement('tr', null,
                React.createElement('td', { className: 'py-1.5 font-bold' }, 'Total due (this addendum)'),
                React.createElement('td', { className: 'py-1.5 text-right font-mono font-bold' }, formatCurrency(total)),
              ),
            ),
          ),
          (addendumEconomics.billingMilestones || []).length > 0 && React.createElement(
            'div',
            null,
            React.createElement('p', { className: 'text-[10px] font-mono uppercase text-slate-400 font-bold mb-1' }, 'Payment schedule (this addendum only)'),
            React.createElement(
              'ul',
              { className: 'text-xs space-y-0.5' },
              addendumEconomics.billingMilestones.map((m, i) => React.createElement(
                'li',
                { key: i, className: 'flex justify-between border-b border-slate-100 py-0.5' },
                React.createElement('span', null, m.label),
                React.createElement('span', { className: 'font-mono' }, formatCurrency(m.amount)),
              )),
            ),
          ),
          React.createElement('p', { className: 'text-[10px] text-slate-600 leading-relaxed border-t border-slate-200 pt-2' }, addendum.addendumTerms),
          React.createElement('p', { className: 'text-[10px] text-slate-500 italic' }, 'This addendum is billed separately from the original Statement of Work. Original engagement milestones are unchanged.'),
          renderSignaturesBlock && renderSignaturesBlock(
            'Accepted on behalf of Client:',
            starterUi ? `Accepted on behalf of ${issuerName}:` : 'Accepted on behalf of Kolthoff Consulting:',
          ),
        ),
      ),
    );
  }

  global.PlannerAddendumUI = {
    renderAddendumEditor,
    renderAddendumPrintDocument,
  };
})(typeof window !== 'undefined' ? window : globalThis);
