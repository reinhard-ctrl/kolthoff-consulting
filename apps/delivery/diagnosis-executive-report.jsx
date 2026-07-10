        const ReportSectionHeader = ({ number, title, subtitle }) => (
            <div className="mb-6 page-break-inside-avoid">
                <div className="report-accent-bar mb-4" />
                {number && <div className="text-[10px] font-mono font-bold text-brandTeal-600 uppercase tracking-[0.2em] mb-1">Section {number}</div>}
                <h2 className="text-xl font-black text-slate-900 uppercase font-serif tracking-tight">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-2xl">{subtitle}</p>}
            </div>
        );

        const ReportCover = ({ clientCompany, preparedBy, reportDate, totalAnnualWaste, processAnnual, saasAnnual, maturityIndex, topFixes }) => (
            <div className="report-page page-break-inside-avoid">
                <div className="report-accent-bar mb-6" />
                <div className="mb-8">
                    <div className="text-[10px] font-mono font-bold text-brandTeal-600 uppercase tracking-[0.25em] mb-2">Module 1 — Business Leak Scan</div>
                    <h1 className="text-4xl font-black text-slate-900 font-serif tracking-tight leading-tight">Waste-to-Peso Report</h1>
                    <p className="text-sm text-slate-600 mt-2 max-w-lg leading-relaxed">Where your team loses time and money — and the top fixes to recover it in the next 90 days.</p>
                </div>
                <div className="grid grid-cols-2 gap-6 text-xs mb-8 pb-6 border-b border-slate-200">
                    <div><span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold block mb-1">Prepared for</span><span className="font-bold text-slate-900 text-sm">{clientCompany}</span></div>
                    <div><span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold block mb-1">Report date</span><span className="font-mono text-slate-700">{reportDate}</span></div>
                    <div><span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold block mb-1">Lead strategist</span><span className="text-slate-700">{preparedBy}</span></div>
                    <div><span className="text-slate-400 uppercase tracking-wider text-[9px] font-bold block mb-1">Maturity index</span><span className="font-mono font-bold text-brandTeal-700">{maturityIndex} / 5</span></div>
                </div>
                <div className="report-kpi-grid grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <div className="report-kpi p-5 text-center">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Total Annual Leakage</div>
                        <div className="report-kpi-value text-2xl font-black text-rose-700">{formatCurrency(totalAnnualWaste)}</div>
                    </div>
                    <div className="report-kpi p-5 text-center">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Process Waste</div>
                        <div className="report-kpi-value text-xl font-black text-rose-600">{formatCurrency(processAnnual)}</div>
                        <div className="text-[9px] text-slate-400 mt-1">Manual delays & rework</div>
                    </div>
                    <div className="report-kpi p-5 text-center">
                        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">SaaS Waste</div>
                        <div className="report-kpi-value text-xl font-black text-amber-700">{formatCurrency(saasAnnual)}</div>
                        <div className="text-[9px] text-slate-400 mt-1">Licenses & duplicates</div>
                    </div>
                </div>
                {topFixes.length > 0 && (
                    <div className="border-2 border-brandTeal-500/30 rounded-xl p-6 bg-teal-50/30 page-break-inside-avoid">
                        <h3 className="text-sm font-black uppercase tracking-wider text-brandTeal-900 mb-4 font-serif">Top 5 Fixes — Next 90 Days</h3>
                        <div className="space-y-0">
                            {topFixes.map((item, idx) => (
                                <div key={item.id} className="report-fix-row">
                                    <div className="report-fix-num">{idx + 1}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-900 text-sm leading-snug">{item.text}</div>
                                        <div className="flex flex-wrap gap-2 mt-1.5">
                                            {item.targetWeek && <span className="report-badge report-badge-teal">{item.targetWeek}</span>}
                                            {item.expectedSavings > 0 && <span className="report-badge report-badge-rose">~{formatCurrency(item.expectedSavings)}/mo savings</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );

        const ExecutiveReport = ({ clientCompany, preparedBy, tabs, raciAssignments, subSaaS, annualChaosTax, totalDailyWasteHours, synthesis, projected3YearLoss, printConfig, orgChartSvg, orgChartMembers, reportDate }) => {
            const DR = DRH();
            const saasMonthlyWaste = subSaaS.reduce((acc, curr) => acc + ((Number(curr.billing) || 0) * (Number(curr.users) || 0)), 0);
            const saasAnnualWaste = saasMonthlyWaste * 12;
            const totalAnnualWaste = annualChaosTax + saasAnnualWaste;
            const maturityIndex = DR.computeMaturityIndex?.(synthesis) ?? 3;
            const activeItems = synthesis.matrix?.items || [];
            const topFixes = DR.getTop5Fixes?.(activeItems) || [];
            const processRankings = DR.buildProcessRankings?.(tabs, window.DiagramEditor) || [];
            const insightCtx = { synthesis, subSaaS, tabs, raciAssignments, orgChartMembers, staffFeedbackThemes: synthesis.staffFeedbackThemes, formatCurrency, DiagramEditor: window.DiagramEditor };
            const findings = DR.buildOperationalInsights?.(insightCtx) || [];
            const riskProfiles = DR.buildRiskProfiles?.(insightCtx) || [];
            const raciGaps = DR.buildRaciGaps?.(tabs, raciAssignments, window.DiagramEditor) || { gaps: [], unassignedSteps: 0, totalSteps: 0 };
            const modules = EC_MODULES();
            const modByKey = (key) => modules.find(m => m.key === key) || { title: key, category: key };

            const quickWins = activeItems.filter(it => Number(it.effort) < 3 && Number(it.impact) >= 3);
            const majorProjects = activeItems.filter(it => Number(it.effort) >= 3 && Number(it.impact) >= 3);
            const fillIns = activeItems.filter(it => Number(it.effort) < 3 && Number(it.impact) < 3);
            const moneyPits = activeItems.filter(it => Number(it.effort) >= 3 && Number(it.impact) < 3);

            const severityClass = { amber: 'border-amber-200 bg-amber-50', rose: 'border-rose-200 bg-rose-50/50', slate: 'border-slate-200 bg-slate-50' };
            const severityTitle = { amber: 'text-amber-800', rose: 'text-rose-800', slate: 'text-slate-800' };

            return (
                <div className="report-doc w-full max-w-[850px] bg-white text-slate-900 shadow-2xl relative print:shadow-none print:w-full print:max-w-full print:p-0 flex flex-col gap-12 print:block print:gap-0">

                    {printConfig.showExecutiveSummary && (
                        <ReportCover clientCompany={clientCompany} preparedBy={preparedBy} reportDate={reportDate} totalAnnualWaste={totalAnnualWaste} processAnnual={annualChaosTax} saasAnnual={saasAnnualWaste} maturityIndex={maturityIndex} topFixes={topFixes} />
                    )}

                    {printConfig.showExecutiveSummary && findings.length > 0 && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader title="Key Findings" subtitle="Summary of the highest-impact operational issues identified during your Business Leak Scan." />
                            <ul className="space-y-3">
                                {findings.map((pt, i) => (
                                    <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed page-break-inside-avoid">
                                        <span className="text-brandTeal-600 font-black shrink-0">{i + 1}.</span>
                                        <span>{pt}</span>
                                    </li>
                                ))}
                            </ul>
                            {(synthesis.staffFeedbackThemes || []).filter(t => t && t.trim()).length > 0 && (
                                <div className="mt-6 p-4 border border-slate-200 rounded-lg bg-slate-50 page-break-inside-avoid">
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-600 mb-2">Staff Feedback Themes (Anonymous)</h4>
                                    <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                                        {synthesis.staffFeedbackThemes.filter(t => t && t.trim()).map((t, i) => <li key={i}>{t}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {printConfig.showLeakageRanking && processRankings.length > 0 && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="A" title="Where the Money Goes" subtitle="Processes ranked by annual operational leakage. Focus fixes on the top rows first." />
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Process</th>
                                        <th className="text-right">Monthly</th>
                                        <th className="text-right">Annual</th>
                                        <th>% of Total</th>
                                        <th>Top Bottleneck</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {processRankings.map((row, idx) => (
                                        <tr key={row.tabId}>
                                            <td className="font-mono font-bold text-slate-400">{idx + 1}</td>
                                            <td className="font-bold text-slate-900">{row.tabName}</td>
                                            <td className="text-right font-mono text-rose-700 font-bold">{formatCurrency(row.monthly)}</td>
                                            <td className="text-right font-mono text-rose-600">{formatCurrency(row.annual)}</td>
                                            <td className="font-mono text-slate-600">{row.pctOfTotal}%</td>
                                            <td className="text-slate-600 text-[10px]">{row.topStepLabel.replace(/\n/g, ' ')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {printConfig.showOrgChart && (orgChartSvg || (orgChartMembers && orgChartMembers.length > 0)) && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="B" title="Organization & Team Structure" subtitle="As-is reporting lines collected during Module 1." />
                            {orgChartSvg && <img src={orgChartSvg} alt="Organization chart" className="w-full max-h-80 object-contain border border-slate-200 rounded-lg bg-white mb-4 page-break-inside-avoid" />}
                            {orgChartMembers && orgChartMembers.length > 0 && (
                                <table className="report-table">
                                    <thead><tr><th>Name</th><th>Role / Title</th><th>Department</th><th>Reports To</th></tr></thead>
                                    <tbody>
                                        {(window.DiagnosisReportHelpers?.normalizeStaffDirectoryRows?.(orgChartMembers) || orgChartMembers).map((m, i) => (
                                            <tr key={i}>
                                                <td className="font-semibold">{m.name || m.label || '—'}</td>
                                                <td className="text-slate-600">{m.title || m.role || '—'}</td>
                                                <td className="text-slate-600">{m.department || '—'}</td>
                                                <td className="text-slate-600">{m.reportsTo || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}

                    {printConfig.showFlowcharts && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="C" title="Process Maps & Step Analysis" subtitle="As-is workflows with delay times and per-step leakage calculations." />
                            <div className="space-y-6">
                                {tabs.map(tab => {
                                    const vm = window.DiagramEditor?.getWorkflowViewModel(tab.present) || { tasks: [], svgCache: '' };
                                    const processNodes = vm.tasks.filter(t => t.type !== 'gateway' && t.type !== 'event');
                                    const tabTax = window.DiagramEditor?.computeTabChaosTax?.(processNodes) || { annual: 0 };
                                    return (
                                        <div key={tab.id} className="p-4 border border-slate-200 rounded-xl bg-slate-50/40 page-break-inside-avoid">
                                            <div className="flex justify-between items-baseline border-b border-slate-200 pb-2 mb-3">
                                                <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">{tab.name}</span>
                                                <span className="font-mono text-rose-600 font-bold text-xs">{formatCurrency(Math.round(tabTax.annual / 12))}/mo</span>
                                            </div>
                                            {vm.svgCache && <img src={vm.svgCache} alt={tab.name} className="w-full max-h-64 object-contain border border-slate-200 rounded bg-white mb-4" />}
                                            <div className="space-y-2">
                                                {processNodes.map((step, sIdx) => {
                                                    const monthly = DR.stepMonthlyLoss?.(step) ?? 0;
                                                    return (
                                                        <div key={step.id} className="text-xs flex justify-between gap-4 border-l-2 border-slate-200 pl-3 py-1 page-break-inside-avoid">
                                                            <div>
                                                                <span className="font-bold text-slate-900">{sIdx + 1}. {step.label.replace(/\n/g, ' ')}</span>
                                                                {step.description && <p className="text-slate-500 mt-0.5">{step.description}</p>}
                                                            </div>
                                                            <div className="text-right shrink-0 font-mono text-[10px] text-slate-600">
                                                                {step.delayMinutes > 0 ? <span className="text-rose-600 font-bold">{formatCurrency(monthly)}/mo</span> : <span className="text-slate-400">No delay</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {printConfig.showRaci && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="D" title="RACI Accountability Matrix" subtitle={`${raciGaps.unassignedSteps} of ${raciGaps.totalSteps} steps need clearer ownership.`} />
                            {tabs.map(tab => {
                                const vm = window.DiagramEditor?.getWorkflowViewModel(tab.present) || { tasks: [], lanes: [] };
                                const processNodes = vm.tasks.filter(t => t.type !== 'gateway' && t.type !== 'event');
                                const roles = vm.lanes;
                                if (!processNodes.length) return null;
                                return (
                                    <div key={`raci-${tab.id}`} className="border border-slate-200 rounded-lg overflow-hidden mb-6 page-break-inside-avoid">
                                        <div className="bg-slate-100 px-4 py-2 font-bold text-slate-800 text-[11px] uppercase">{tab.name}</div>
                                        <table className="report-table text-[10px]">
                                            <thead>
                                                <tr>
                                                    <th className="w-[30%]">Activity</th>
                                                    {roles.map(r => <th key={r.id} className="text-center">{r.label.replace(/\n/g, ' ')}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {processNodes.map(act => (
                                                    <tr key={act.id}>
                                                        <td className="font-bold">{act.label.replace(/\n/g, ' ')}</td>
                                                        {roles.map(role => {
                                                            const assign = raciAssignments[act.id]?.[role.id] || '';
                                                            return <td key={role.id} className="text-center font-mono font-black">{assign || '—'}</td>;
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {printConfig.showSaas && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="E" title="Financial Leakage Breakdown" subtitle="Process waste and subscription waste are tracked separately so you know what to fix first." />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="p-5 border-2 border-rose-200 rounded-xl bg-rose-50/30 page-break-inside-avoid">
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-rose-700 mb-1">Process Leakage (Chaos Tax)</div>
                                    <div className="text-2xl font-black font-mono text-rose-700">{formatCurrency(annualChaosTax)}<span className="text-xs font-normal text-slate-500">/yr</span></div>
                                    <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">Fixable via SOPs, handoffs, and workflow redesign. {totalDailyWasteHours.toFixed(1)} hours lost daily across mapped processes.</p>
                                    <div className="text-[10px] font-mono text-rose-600 mt-2">{formatCurrency(Math.round(annualChaosTax / 12))}/month</div>
                                </div>
                                <div className="p-5 border-2 border-amber-200 rounded-xl bg-amber-50/30 page-break-inside-avoid">
                                    <div className="text-[9px] font-bold uppercase tracking-widest text-amber-800 mb-1">SaaS & License Waste</div>
                                    <div className="text-2xl font-black font-mono text-amber-800">{formatCurrency(saasAnnualWaste)}<span className="text-xs font-normal text-slate-500">/yr</span></div>
                                    <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">Quick-recapture: cancel duplicates and right-size seats within 30 days.</p>
                                    <div className="text-[10px] font-mono text-amber-700 mt-2">{formatCurrency(saasMonthlyWaste)}/month</div>
                                </div>
                            </div>
                            {subSaaS.length > 0 && (
                                <table className="report-table mb-6">
                                    <thead>
                                        <tr>
                                            <th>Software</th>
                                            <th className="text-center">Billing</th>
                                            <th className="text-center">Seats</th>
                                            <th className="text-right">Monthly</th>
                                            <th>Recommendation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {subSaaS.map(item => (
                                            <tr key={item.id}>
                                                <td className="font-bold">{item.tool}</td>
                                                <td className="text-center font-mono">₱{Number(item.billing || 0).toLocaleString()}</td>
                                                <td className="text-center font-mono">{item.users}</td>
                                                <td className="text-right font-mono font-bold text-amber-800">{formatCurrency((Number(item.billing) || 0) * (Number(item.users) || 0))}</td>
                                                <td className="text-slate-600 italic text-[10px]">{item.reason || 'Review seat count and usage'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                            <div className="p-4 border border-emerald-300 rounded-xl bg-emerald-50/50 flex justify-between items-center page-break-inside-avoid">
                                <div className="text-sm text-slate-700 max-w-md"><strong className="text-emerald-800">Year 1 recapture opportunity:</strong> Up to {formatCurrency(totalAnnualWaste)} returned to margins by fixing process delays and optimizing software spend.</div>
                                <div className="text-right shrink-0"><div className="text-[9px] uppercase font-bold text-slate-500">Total</div><div className="text-xl font-black font-mono text-emerald-700">{formatCurrency(totalAnnualWaste)}</div></div>
                            </div>
                        </div>
                    )}

                    {printConfig.showSynthesis && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="F" title="Operational Maturity & Cost of Inaction" subtitle="How ready your business is to scale — and what happens if nothing changes." />
                            <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 mb-6 page-break-inside-avoid">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider">Maturity Scorecard</h3>
                                    <span className="report-badge report-badge-teal">Overall {maturityIndex}/5</span>
                                </div>
                                <div className="space-y-4">
                                    <ScoreBar label="Team Communication" value={synthesis.communication} desc1="Scattered" desc5="Unified" />
                                    <ScoreBar label="Process Documentation" value={synthesis.documentation} desc1="Tribal" desc5="Standardized" />
                                    <ScoreBar label="Handoff Accountability" value={synthesis.accountability} desc1="Ambiguous" desc5="Clear RACI" />
                                    <ScoreBar label="Software Utilization" value={synthesis.software} desc1="Fragmented" desc5="Consolidated" />
                                </div>
                            </div>
                            <div className="border-2 border-rose-200 bg-rose-50/40 rounded-xl p-6 page-break-inside-avoid">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-900 mb-2">3-Year Cost of Inaction</h3>
                                <p className="text-xs text-slate-700 leading-relaxed mb-4">At current leakage of <strong>{formatCurrency(totalAnnualWaste)}/year</strong>, growing the team by <strong>{synthesis.expectedGrowth || 0} people</strong> without fixing these processes compounds losses over 3 years.</p>
                                <div className="bg-white border border-rose-200 rounded-lg p-4 text-center"><div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Projected 3-Year Loss</div><div className="text-3xl font-black font-mono text-rose-600">{formatCurrency(projected3YearLoss)}</div></div>
                            </div>
                            <div className="mt-6 border-l-4 border-brandTeal-600 bg-teal-50/50 p-5 rounded-r-xl page-break-inside-avoid">
                                <h3 className="text-xs font-bold uppercase text-brandTeal-900 mb-2">Recommended Next Phase: {modByKey(synthesis.nextModuleId).title}</h3>
                                <p className="text-sm text-slate-800 leading-relaxed">{synthesis.customPitch || 'Select a module in the Strategy section to generate your recommendation.'}</p>
                            </div>
                        </div>
                    )}

                    {printConfig.showMatrix && activeItems.length > 0 && (
                        <div className="report-page print-force-break font-sans text-xs">
                            <ReportSectionHeader number="G" title="Full Prioritization Matrix" subtitle="All initiatives plotted by effort vs. impact. Numbers match the chart below." />
                            <div className="flex justify-center my-4 page-break-inside-avoid">
                                <svg viewBox="0 0 450 450" className="w-[400px] h-[400px] bg-slate-50 border border-slate-200 rounded-xl">
                                    <rect x="40" y="40" width="185" height="185" fill="#f0fdf4" /><rect x="225" y="40" width="175" height="175" fill="#eff6ff" />
                                    <rect x="30" y="225" width="170" height="185" fill="#f8fafc" /><rect x="225" y="225" width="185" height="185" fill="#fff1f2" />
                                    <line x1="225" y1="40" x2="225" y2="410" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3,3" />
                                    <line x1="40" y1="225" x2="410" y2="225" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="3,3" />
                                    <rect x="40" y="40" width="370" height="370" fill="none" stroke="#64748b" strokeWidth="1.5" />
                                    {activeItems.map((item, idx) => {
                                        const effort = Number(item.effort) || 3; const impact = Number(item.impact) || 3;
                                        const x = 40 + ((effort - 1) / 4) * 370; const y = 40 + ((5 - impact) / 4) * 370;
                                        const dotColor = effort < 3 && impact >= 3 ? '#10b981' : effort >= 3 && impact >= 3 ? '#3b82f6' : effort >= 3 ? '#ef4444' : '#94a3b8';
                                        return (<g key={item.id}><circle cx={x} cy={y} r="7" fill={dotColor} stroke="#fff" strokeWidth="1.5" /><text x={x} y={y + 3} fill="#fff" fontSize="7" fontWeight="bold" textAnchor="middle">{idx + 1}</text></g>);
                                    })}
                                </svg>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Quick Wins', items: quickWins, color: 'teal' },
                                    { label: 'Major Projects', items: majorProjects, color: 'blue' },
                                    { label: 'Fill-ins', items: fillIns, color: 'slate' },
                                    { label: 'Deprioritize', items: moneyPits, color: 'rose' },
                                ].map(({ label, items, color }) => (
                                    <div key={label} className={`border rounded-lg p-3 page-break-inside-avoid border-${color}-200`}>
                                        <strong className={`text-${color}-800 text-[10px] uppercase block mb-2`}>{label}</strong>
                                        <ul className="space-y-1">{items.length ? items.map((item, idx) => <li key={item.id} className="text-[10px] text-slate-700 font-medium">{idx + 1}. {item.text}</li>) : <li className="text-slate-400 italic text-[10px]">None</li>}</ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {printConfig.showFindings && riskProfiles.length > 0 && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="H" title="Operational Risk Profiles" subtitle="Issues that need attention before scaling headcount or adding new tools." />
                            <div className="space-y-3">
                                {riskProfiles.map((rp, i) => (
                                    <div key={i} className={`text-xs p-4 border rounded-lg page-break-inside-avoid ${severityClass[rp.severity] || severityClass.slate}`}>
                                        <strong className={`block mb-1 ${severityTitle[rp.severity]}`}>{rp.title}</strong>
                                        <p className="text-slate-700 leading-relaxed">{rp.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {printConfig.showNextSteps && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader number="I" title="Recommended Next Steps" subtitle="A practical timeline to start recovering leakage this week." />
                            <div className="space-y-4 text-sm">
                                <div className="p-4 border-l-4 border-emerald-500 bg-emerald-50/40 rounded-r-lg page-break-inside-avoid">
                                    <strong className="text-emerald-900 text-xs uppercase tracking-wider block mb-1">Week 1–2 — Quick wins</strong>
                                    <p className="text-slate-700 text-xs leading-relaxed">{quickWins.length ? quickWins.slice(0, 3).map(i => i.text).join('; ') : 'Cancel unused SaaS seats and fix the highest-leak workflow step identified above.'}</p>
                                </div>
                                <div className="p-4 border-l-4 border-blue-500 bg-blue-50/40 rounded-r-lg page-break-inside-avoid">
                                    <strong className="text-blue-900 text-xs uppercase tracking-wider block mb-1">Week 3–6 — Process fixes</strong>
                                    <p className="text-slate-700 text-xs leading-relaxed">{majorProjects.length ? majorProjects.slice(0, 2).map(i => i.text).join('; ') : 'Document top workflows and assign RACI owners for every handoff.'}</p>
                                </div>
                                <div className="p-4 border-l-4 border-brandTeal-600 bg-teal-50/40 rounded-r-lg page-break-inside-avoid">
                                    <strong className="text-brandTeal-900 text-xs uppercase tracking-wider block mb-1">Week 7–12 — Structural changes</strong>
                                    <p className="text-slate-700 text-xs leading-relaxed">Review progress on the 90-day fix list with leadership. Decide whether to proceed to {modByKey('MOD 2').title} for playbook and handbook delivery.</p>
                                </div>
                            </div>
                            <div className="mt-8 p-5 border border-slate-200 rounded-xl bg-slate-50 page-break-inside-avoid">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-700 mb-3">Kolthoff Engagement Path</h4>
                                <div className="grid grid-cols-3 gap-3 text-[10px]">
                                    {modules.filter(m => m.key !== 'MOD 1').map(mod => (
                                        <div key={mod.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                                            <strong className="text-slate-900 block mb-1 uppercase">{mod.key}: {mod.title}</strong>
                                            <p className="text-slate-500 leading-relaxed">{mod.phase}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {printConfig.showAppendix && (
                        <div className="report-page print-force-break">
                            <ReportSectionHeader title="Appendix — Methodology" subtitle="How leakage figures were calculated." />
                            <div className="text-[10px] text-slate-600 space-y-3 leading-relaxed">
                                <p><strong>Process leakage:</strong> Step delay (minutes) × affected staff × hourly rate × 22 working days × 12 months.</p>
                                <p><strong>SaaS waste:</strong> Monthly billing × active seats for tools flagged as under-utilized or duplicate.</p>
                                <p><strong>Cost of inaction:</strong> Total annual leakage × 3 years × headcount growth factor (10% per expected new hire).</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        };
