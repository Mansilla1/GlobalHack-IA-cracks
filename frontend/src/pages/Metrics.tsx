import { useQuery } from '@tanstack/react-query'
import { incidentsApi, policyApi, type Incident } from '../api/client'

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ flex: 1, height: 8, backgroundColor: '#EDF1F3', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: 4, transition: 'width 0.6s ease' }} />
    </div>
  )
}

function StatCard({ label, value, sub, color, mocked }: {
  label: string; value: string | number; sub?: string; color: string; mocked?: boolean
}) {
  return (
    <div className="rounded-xl p-5 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
      {mocked && (
        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#CC850A22', color: '#CC850A' }}>
          estimated
        </span>
      )}
      <p className="text-xs font-semibold uppercase tracking-wide mt-1" style={{ color: '#003D4F88' }}>{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ fontFamily: "'Bitter', serif", color }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#003D4F55' }}>{sub}</p>}
    </div>
  )
}

const IMPACT_LEVEL: Record<string, { label: string; color: string }> = {
  architectural: { label: 'Critical',  color: '#F2617A' },
  quick_fix:     { label: 'Medium',    color: '#CC850A' },
  edge_case:     { label: 'Low',       color: '#47A1AD' },
  unknown:       { label: 'Unknown',   color: '#003D4F44' },
}

const DOMAIN_MULTIPLIER: Record<string, number> = {
  fintech: 2.5, ecommerce: 1.5, healthcare: 2.0, saas: 1.2,
  logistics: 1.3, gaming: 0.8, media: 1.0, other: 1.0,
}

const DOMAIN_LABELS: Record<string, string> = {
  ecommerce:  'E-commerce',
  fintech:    'Fintech / Payments',
  saas:       'SaaS / B2B',
  healthcare: 'Healthcare',
  logistics:  'Logistics / Supply',
  media:      'Media / Content',
  gaming:     'Gaming',
  other:      'Other',
}

const TYPE_BASE: Record<string, number> = {
  architectural: 8000, quick_fix: 1200, edge_case: 300,
}

function estimatedImpact(incident: Incident, domain: string): number {
  const base = TYPE_BASE[incident.incident_type] ?? 500
  const mult = DOMAIN_MULTIPLIER[domain] ?? 1.0
  return Math.round(base * mult)
}

function matchService(incident: Incident, criticals: string[]): string | null {
  const text = `${incident.title} ${incident.error_message ?? ''}`.toLowerCase()
  for (const service of criticals) {
    const words = service.toLowerCase().split(/[\s/\-,]+/).filter(w => w.length > 2)
    if (words.some(w => text.includes(w))) return service
  }
  return null
}

// Mocked trend data — 7 days
const TREND = [
  { day: 'Mon', detected: 3, fixed: 2 },
  { day: 'Tue', detected: 5, fixed: 4 },
  { day: 'Wed', detected: 2, fixed: 2 },
  { day: 'Thu', detected: 7, fixed: 5 },
  { day: 'Fri', detected: 4, fixed: 4 },
  { day: 'Sat', detected: 1, fixed: 1 },
  { day: 'Sun', detected: 2, fixed: 1 },
]

export default function Metrics() {
  const { data: incidents = [] } = useQuery({ queryKey: ['incidents'], queryFn: incidentsApi.list })
  const { data: policy } = useQuery({ queryKey: ['policy'], queryFn: policyApi.get })

  const total = incidents.length
  const withPR = incidents.filter((i: Incident) => i.github_pr_url).length
  const autoFixRate = total > 0 ? Math.round((withPR / total) * 100) : 0
  const architectural = incidents.filter((i: Incident) => i.incident_type === 'architectural').length
  const quickFix = incidents.filter((i: Incident) => i.incident_type === 'quick_fix').length
  const edgeCase = incidents.filter((i: Incident) => i.incident_type === 'edge_case').length

  const byProject = incidents.reduce((acc: Record<string, number>, i: Incident) => {
    const key = i.project_name ?? 'Unassigned'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const projectEntries = Object.entries(byProject).sort((a, b) => b[1] - a[1])
  const maxProject = Math.max(...projectEntries.map(([, v]) => v), 1)

  const domain = policy?.business_domain ?? ''
  const domainLabel = DOMAIN_LABELS[domain] ?? ''
  const businessName = policy?.business_name || 'Your Product'
  const criticals = (policy?.critical_services ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const mttr = total > 0 ? '14m' : '—'
  const revenueProtected = incidents
    .filter((i: Incident) => i.github_pr_url)
    .reduce((sum: number, i: Incident) => sum + estimatedImpact(i, domain), 0)

  // Build service health map
  interface ServiceHealth { total: number; fixed: number; incidents: Incident[] }
  const serviceMap: Record<string, ServiceHealth> = {}
  for (const svc of criticals) serviceMap[svc] = { total: 0, fixed: 0, incidents: [] }

  const enriched = incidents.map((i: Incident) => ({
    ...i,
    matchedService: matchService(i, criticals),
    impact: estimatedImpact(i, domain),
  }))

  for (const ei of enriched) {
    if (ei.matchedService && serviceMap[ei.matchedService]) {
      serviceMap[ei.matchedService].total += 1
      if (ei.github_pr_url) serviceMap[ei.matchedService].fixed += 1
      serviceMap[ei.matchedService].incidents.push(ei)
    }
  }

  const serviceEntries = Object.entries(serviceMap)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>Metrics</h1>
        <p className="text-sm mt-0.5" style={{ color: '#003D4F88' }}>
          Incident trends and business impact for <strong>{businessName}</strong>.
        </p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Incidents"   value={total}               sub="all time"             color="#003D4F" />
        <StatCard label="Auto-fix Rate"     value={`${autoFixRate}%`}   sub={`${withPR} PRs opened`} color="#6B9E78" />
        <StatCard label="MTTR"              value={mttr}                sub="mean time to resolve" color="#47A1AD" mocked={total > 0} />
        <StatCard
          label="Revenue Protected"
          value={revenueProtected > 0 ? `$${revenueProtected.toLocaleString()}` : '—'}
          sub="estimated impact avoided"
          color="#634F7D"
          mocked={revenueProtected > 0}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Incidents by type */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
          <h2 className="text-base mb-4" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
            By Type
          </h2>
          {total === 0 ? (
            <p className="text-sm" style={{ color: '#003D4F44' }}>No incidents yet.</p>
          ) : (
            <div className="space-y-4">
              {[
                { label: 'Architectural', value: architectural, color: '#F2617A', sub: 'Security, design, performance' },
                { label: 'Quick Fix',     value: quickFix,      color: '#6B9E78', sub: 'Logic bugs, missing validations' },
                { label: 'Edge Case',     value: edgeCase,      color: '#CC850A', sub: 'Unexpected inputs' },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-semibold" style={{ color: '#003D4F' }}>{row.label}</span>
                    <span className="text-sm font-bold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                  <Bar value={row.value} max={total} color={row.color} />
                  <p className="text-xs mt-1" style={{ color: '#003D4F55' }}>{row.sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By project */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
          <h2 className="text-base mb-4" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
            By Project
          </h2>
          {projectEntries.length === 0 ? (
            <p className="text-sm" style={{ color: '#003D4F44' }}>No incidents yet.</p>
          ) : (
            <div className="space-y-4">
              {projectEntries.map(([name, count], i) => {
                const colors = ['#47A1AD', '#6B9E78', '#634F7D', '#CC850A', '#F2617A']
                const color = colors[i % colors.length]
                return (
                  <div key={name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-semibold truncate flex-1" style={{ color: '#003D4F' }}>{name}</span>
                      <span className="text-sm font-bold shrink-0 ml-2" style={{ color }}>{count}</span>
                    </div>
                    <Bar value={count} max={maxProject} color={color} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Weekly trend — mocked */}
        <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
              Weekly Trend
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#CC850A22', color: '#CC850A' }}>
              estimated
            </span>
          </div>
          <div className="flex items-end gap-2 h-32">
            {TREND.map(({ day, detected, fixed }) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: 96 }}>
                  <div style={{ flex: 1, backgroundColor: '#F2617A44', height: `${(detected / 7) * 96}px`, borderRadius: '3px 3px 0 0' }} />
                  <div style={{ flex: 1, backgroundColor: '#6B9E78', height: `${(fixed / 7) * 96}px`, borderRadius: '3px 3px 0 0' }} />
                </div>
                <span className="text-xs" style={{ color: '#003D4F55' }}>{day}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#F2617A44' }} />
              <span className="text-xs" style={{ color: '#003D4F66' }}>Detected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#6B9E78' }} />
              <span className="text-xs" style={{ color: '#003D4F66' }}>Auto-fixed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Business Impact — full width */}
      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
              Business Impact
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#003D4F55' }}>
              Qué parte del negocio afecta cada incidente y el riesgo estimado de revenue.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {domainLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ backgroundColor: '#47A1AD22', color: '#47A1AD' }}>
                {domainLabel}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#CC850A22', color: '#CC850A' }}>
              estimated $
            </span>
          </div>
        </div>

        {/* Service health grid */}
        {criticals.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#003D4F55' }}>
              Critical Service Health
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {serviceEntries.map(([svc, health]) => {
                const hasIncidents = health.total > 0
                const allFixed = hasIncidents && health.fixed === health.total
                const someFixed = hasIncidents && health.fixed > 0 && health.fixed < health.total
                const noneFixed = hasIncidents && health.fixed === 0
                const color = !hasIncidents ? '#6B9E78' : allFixed ? '#6B9E78' : someFixed ? '#CC850A' : '#F2617A'
                const statusLabel = !hasIncidents ? 'Healthy' : allFixed ? 'All fixed' : someFixed ? 'Partial' : 'At risk'
                return (
                  <div key={svc} className="rounded-lg p-3" style={{ border: `1px solid ${color}33`, backgroundColor: `${color}09` }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold truncate flex-1" style={{ color: '#003D4F' }}>{svc}</span>
                      <div className="w-2 h-2 rounded-full shrink-0 ml-1" style={{ backgroundColor: color }} />
                    </div>
                    <p className="text-xs font-bold" style={{ color }}>{statusLabel}</p>
                    {hasIncidents && (
                      <p className="text-xs mt-0.5" style={{ color: '#003D4F55' }}>
                        {health.fixed}/{health.total} fixed
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Incident impact table */}
        {incidents.length === 0 ? (
          <p className="text-sm" style={{ color: '#003D4F44' }}>No incidents to analyze yet.</p>
        ) : (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#003D4F55' }}>
              Incident Detail
            </p>
            <div className="overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #EDF1F3' }}>
                    {['Incident', 'Project', 'Affects', 'Severity', 'Est. Impact', 'Status'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4"
                        style={{ fontSize: 11, color: '#003D4F55', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enriched.map((incident) => {
                    const impact = IMPACT_LEVEL[incident.incident_type] ?? IMPACT_LEVEL.unknown
                    const isFixed = Boolean(incident.github_pr_url)
                    return (
                      <tr key={incident.id} style={{ borderBottom: '1px solid #EDF1F3' }}>
                        {/* Incident title */}
                        <td className="py-3 pr-4" style={{ maxWidth: 220 }}>
                          <p className="text-xs font-semibold" style={{ color: '#003D4F', lineHeight: 1.4 }}>
                            {incident.title}
                          </p>
                        </td>

                        {/* Project */}
                        <td className="py-3 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium"
                            style={{ backgroundColor: '#EDF1F3', color: '#003D4F77', whiteSpace: 'nowrap' }}>
                            {incident.project_name ?? '—'}
                          </span>
                        </td>

                        {/* Affected domain → service */}
                        <td className="py-3 pr-4" style={{ minWidth: 160 }}>
                          {incident.matchedService ? (
                            <div>
                              {domainLabel && (
                                <p className="text-xs font-medium" style={{ color: '#47A1AD' }}>{domainLabel}</p>
                              )}
                              <p className="text-xs font-semibold mt-0.5" style={{ color: '#F2617A' }}>
                                → {incident.matchedService}
                              </p>
                            </div>
                          ) : domainLabel ? (
                            <div>
                              <p className="text-xs font-medium" style={{ color: '#47A1AD' }}>{domainLabel}</p>
                              <p className="text-xs mt-0.5" style={{ color: '#003D4F33' }}>servicio no identificado</p>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: '#003D4F33' }}>—</span>
                          )}
                        </td>

                        {/* Severity */}
                        <td className="py-3 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                            style={{ backgroundColor: `${impact.color}22`, color: impact.color, whiteSpace: 'nowrap' }}>
                            {impact.label}
                          </span>
                        </td>

                        {/* Estimated $ impact */}
                        <td className="py-3 pr-4">
                          <p className="text-xs font-bold" style={{ color: isFixed ? '#6B9E78' : '#CC850A', whiteSpace: 'nowrap' }}>
                            {isFixed ? (
                              <><s style={{ color: '#003D4F33' }}>${incident.impact.toLocaleString()}</s> saved</>
                            ) : (
                              <>~${incident.impact.toLocaleString()} at risk</>
                            )}
                          </p>
                        </td>

                        {/* Status + PR link */}
                        <td className="py-3">
                          {incident.github_pr_url ? (
                            <a
                              href={incident.github_pr_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-semibold px-2 py-1 rounded-lg"
                              style={{ backgroundColor: '#6B9E7822', color: '#6B9E78', whiteSpace: 'nowrap', textDecoration: 'none' }}
                            >
                              PR opened ↗
                            </a>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded-lg"
                              style={{ backgroundColor: '#EDF1F3', color: '#003D4F55', whiteSpace: 'nowrap' }}>
                              {incident.status === 'analyzing' ? 'Analyzing…' : 'Pending'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
