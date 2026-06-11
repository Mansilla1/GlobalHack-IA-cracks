import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi, projectsApi, webhookApi, type Incident, type Project } from '../api/client'
import { StatusBadge, TypeBadge } from '../components/StatusBadge'
import { AgentStream } from '../components/AgentStream'
import ReactMarkdown from 'react-markdown'

const PROJECT_COLORS = ['#47A1AD', '#6B9E78', '#634F7D', '#CC850A', '#F2617A']
const projectColor = (projects: Project[], id: number | null) => {
  const idx = projects.findIndex(p => p.id === id)
  return PROJECT_COLORS[(idx >= 0 ? idx : 0) % PROJECT_COLORS.length]
}

const SCENARIOS = [
  {
    title: 'ZeroDivisionError in /payments',
    error_message: 'ZeroDivisionError: division by zero',
    stack_trace: `Traceback (most recent call last):
  File "backend/app/routes/payments.py", line 34, in create_payment
    savings_pct = ((original_price - discounted) / original_price) * 100
ZeroDivisionError: division by zero`,
  },
  {
    title: 'Negative order total detected',
    error_message: 'Data integrity violation: order total is -$649.95',
    stack_trace: `File "backend/app/routes/orders.py", line 28, in create_order
    total += item["quantity"] * item["unit_price"]
# quantity = -5, unit_price = 129.99 → total = -649.95
# No validation on item quantity sign`,
  },
  {
    title: 'SQL injection in /users/search',
    error_message: "Security: raw string interpolation in SQL query",
    stack_trace: `File "backend/app/routes/users.py", line 67, in search_users
    query = f"SELECT * FROM users WHERE email LIKE '%{q}%'"
    result = db.execute(text(query))
# q = "' OR '1'='1" returns all users`,
  },
]

const STATUS_ICON: Record<string, string> = {
  detected: '🔴',
  analyzing: '🔵',
  fixing: '🟠',
  pr_opened: '🟣',
  report_generated: '🔵',
  resolved: '🟢',
  failed: '🔴',
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl p-5 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#003D4F88' }}>{label}</p>
      <p className="text-2xl font-bold" style={{ fontFamily: "'Bitter', serif", color }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: '#003D4F66' }}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null)
  const [runningIncidentId, setRunningIncidentId] = useState<number | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: incidentsApi.list,
    refetchInterval: 3000,
  })

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })

  const simulateMutation = useMutation({
    mutationFn: webhookApi.simulate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setActiveIncidentId(data.incident_id)
      setRunningIncidentId(data.incident_id)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: incidentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setActiveIncidentId(null)
      setRunningIncidentId(null)
    },
  })

  const postmortemMutation = useMutation({
    mutationFn: incidentsApi.postmortem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  })

  const handleAgentDone = useCallback(() => {
    setRunningIncidentId(null)
    queryClient.invalidateQueries({ queryKey: ['incidents'] })
  }, [queryClient])

  const activeProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId) ?? projects[0]
    : projects[0]

  const activeIncident = incidents.find((i: Incident) => i.id === activeIncidentId)
  const isAgentRunning = runningIncidentId === activeIncidentId
  const isTerminal = activeIncident
    ? ['pr_opened', 'report_generated', 'resolved', 'failed'].includes(activeIncident.status)
    : false

  // Stats
  const withPR = incidents.filter((i: Incident) => i.github_pr_url).length
  const withPM = incidents.filter((i: Incident) => i.postmortem).length
  const resolved = incidents.filter((i: Incident) => i.status === 'resolved' || i.status === 'pr_opened').length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={incidents.length} sub="all time" color="#003D4F" />
        <StatCard label="PRs Opened" value={withPR} sub="auto-fixed by agent" color="#634F7D" />
        <StatCard label="Post-mortems" value={withPM} sub="generated" color="#47A1AD" />
        <StatCard label="Resolved" value={resolved} sub="healed incidents" color="#6B9E78" />
      </div>

      {/* Demo trigger */}
      <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
        <h2 className="text-base mb-1" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
          Simulate Incident
        </h2>
        <p className="text-sm mb-4" style={{ color: '#003D4F88' }}>
          Trigger a production error — the agent starts analyzing automatically.
        </p>

        {/* Project selector */}
        {projects.length > 0 && (
          <div className="flex gap-2 mb-4 flex-wrap">
            <span className="text-xs font-semibold self-center" style={{ color: '#003D4F66' }}>Target:</span>
            {projects.map((p, idx) => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  backgroundColor: (selectedProjectId === p.id || (!selectedProjectId && idx === 0))
                    ? projectColor(projects, p.id)
                    : '#EDF1F3',
                  color: (selectedProjectId === p.id || (!selectedProjectId && idx === 0))
                    ? '#FFFFFF'
                    : '#003D4F88',
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {projects.length === 0 && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: '#CC850A11', color: '#CC850A' }}>
            No projects configured — go to <strong>Projects</strong> to connect a GitHub repository first.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SCENARIOS.map((scenario, i) => (
            <button
              key={i}
              onClick={() => simulateMutation.mutate({
                ...scenario,
                project_id: activeProject?.id,
              })}
              disabled={simulateMutation.isPending || projects.length === 0}
              className="text-left p-4 rounded-lg border-2 border-dashed transition-all disabled:opacity-40 hover:shadow-sm"
              style={{ borderColor: '#F2617A55', backgroundColor: '#FFFFFF' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#F2617A'; e.currentTarget.style.backgroundColor = '#F2617A08' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#F2617A55'; e.currentTarget.style.backgroundColor = '#FFFFFF' }}
            >
              <p className="font-semibold text-sm" style={{ color: '#F2617A' }}>{scenario.title}</p>
              <p className="text-xs mt-1 font-mono truncate" style={{ color: '#003D4F77' }}>{scenario.error_message}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Incident list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
              Incidents
            </h2>
            {incidents.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}>
                {incidents.length}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: '#EDF1F3' }} />)}
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl">🛡️</span>
              <p className="text-sm" style={{ color: '#003D4F66' }}>No incidents. All systems nominal.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {incidents.map((incident: Incident) => {
                const pColor = projectColor(projects, incident.project_id)
                return (
                  <div
                    key={incident.id}
                    onClick={() => setActiveIncidentId(incident.id)}
                    className="p-3 rounded-lg border cursor-pointer transition-all"
                    style={{
                      borderColor: activeIncidentId === incident.id ? '#47A1AD' : '#EDF1F3',
                      backgroundColor: activeIncidentId === incident.id ? '#47A1AD08' : '#FFFFFF',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5 shrink-0">{STATUS_ICON[incident.status] ?? '⚪'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#003D4F' }}>{incident.title}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {/* Project badge */}
                          {incident.project_name && (
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${pColor}22`, color: pColor }}
                            >
                              {incident.project_name}
                            </span>
                          )}
                          <StatusBadge status={incident.status} />
                          {incident.incident_type !== 'unknown' && <TypeBadge type={incident.incident_type} />}
                          {/* PR indicator */}
                          {incident.github_pr_url && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#634F7D22', color: '#634F7D' }}>
                              PR
                            </span>
                          )}
                          {/* Post-mortem indicator */}
                          {incident.postmortem && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#47A1AD22', color: '#47A1AD' }}>
                              PM
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Detail */}
        <div className="space-y-4">
          {activeIncident ? (
            <>
              <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h2 className="text-base leading-tight font-bold" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>
                    {activeIncident.title}
                  </h2>
                  <span className="text-sm shrink-0">{STATUS_ICON[activeIncident.status]}</span>
                </div>

                <div className="flex gap-1.5 flex-wrap mb-3">
                  {activeIncident.project_name && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${projectColor(projects, activeIncident.project_id)}22`,
                        color: projectColor(projects, activeIncident.project_id),
                      }}
                    >
                      {activeIncident.project_name}
                    </span>
                  )}
                  <StatusBadge status={activeIncident.status} />
                  {activeIncident.incident_type !== 'unknown' && <TypeBadge type={activeIncident.incident_type} />}
                </div>

                <p className="text-xs font-mono p-2 rounded" style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}>
                  {activeIncident.error_message}
                </p>

                <div className="mt-4 flex gap-2 flex-wrap">
                  {activeIncident.status === 'detected' && !isAgentRunning && (
                    <button
                      onClick={() => setRunningIncidentId(activeIncident.id)}
                      className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#F2617A' }}
                    >
                      ▶ Run Agent
                    </button>
                  )}
                  {activeIncident.github_pr_url && (
                    <a
                      href={activeIncident.github_pr_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white text-center hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: '#634F7D' }}
                    >
                      View Pull Request →
                    </a>
                  )}
                  {!activeIncident.postmortem && isTerminal && (
                    <button
                      onClick={() => postmortemMutation.mutate(activeIncident.id)}
                      disabled={postmortemMutation.isPending}
                      className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                      style={{ backgroundColor: '#47A1AD' }}
                    >
                      {postmortemMutation.isPending ? 'Generating...' : 'Generate Post-mortem'}
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(activeIncident.id)}
                    className="px-3 py-2.5 rounded-lg text-sm opacity-40 hover:opacity-100 transition-opacity"
                    style={{ color: '#F2617A' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {isAgentRunning && (
                <AgentStream incidentId={activeIncident.id} onDone={handleAgentDone} />
              )}

              {!isAgentRunning && activeIncident.agent_analysis && !activeIncident.postmortem && (
                <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                  <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>
                    Agent Analysis
                  </h3>
                  <div
                    className="text-xs font-mono p-3 rounded overflow-y-auto max-h-48 whitespace-pre-wrap leading-relaxed"
                    style={{ backgroundColor: '#003D4F', color: '#EDF1F3' }}
                  >
                    {activeIncident.agent_analysis}
                  </div>
                </div>
              )}

              {activeIncident.postmortem && (
                <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                  <h3 className="mb-3 font-bold" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>Post-mortem</h3>
                  <div className="prose prose-sm max-w-none text-sm" style={{ color: '#003D4F' }}>
                    <ReactMarkdown>{activeIncident.postmortem}</ReactMarkdown>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="rounded-xl p-6 shadow-sm flex flex-col items-center justify-center h-64 gap-3"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <span className="text-4xl">🤖</span>
              <p className="text-sm" style={{ color: '#003D4F55' }}>Select an incident to see the agent at work</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
