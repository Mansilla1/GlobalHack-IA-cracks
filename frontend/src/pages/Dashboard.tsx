import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi, webhookApi, type Incident } from '../api/client'
import { StatusBadge, TypeBadge } from '../components/StatusBadge'
import { AgentStream } from '../components/AgentStream'
import ReactMarkdown from 'react-markdown'

const DEMO_SCENARIOS = [
  {
    title: 'ZeroDivisionError in /discount',
    error_message: 'ZeroDivisionError: division by zero',
    stack_trace: `Traceback (most recent call last):
  File "demo-target/app.py", line 22, in calculate_discount
    average = price / quantity
ZeroDivisionError: division by zero`,
  },
  {
    title: "KeyError: 'birthdate' in /user-age",
    error_message: "KeyError: 'birthdate'",
    stack_trace: `Traceback (most recent call last):
  File "demo-target/app.py", line 33, in get_user_age
    age = 2024 - int(user["birthdate"].split("-")[0])
KeyError: 'birthdate'`,
  },
  {
    title: 'Negative amount accepted in /payment',
    error_message: 'Business logic violation: negative amounts are processed without error',
    stack_trace: `File "demo-target/app.py", line 41, in process_payment
    return {"status": "approved", "amount_charged": amount}
# amount = -999.0 — no validation present`,
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

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null)
  // Track which incident the agent is actively running for (resets on page refresh)
  const [runningIncidentId, setRunningIncidentId] = useState<number | null>(null)

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: incidentsApi.list,
    refetchInterval: 3000,
  })

  const simulateMutation = useMutation({
    mutationFn: webhookApi.simulate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setActiveIncidentId(data.incident_id)
      setRunningIncidentId(data.incident_id) // auto-trigger
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

  const activeIncident = incidents.find((i: Incident) => i.id === activeIncidentId)
  const isAgentRunning = runningIncidentId === activeIncidentId

  const terminalStatuses = ['pr_opened', 'report_generated', 'resolved', 'failed']
  const isTerminal = activeIncident ? terminalStatuses.includes(activeIncident.status) : false

  return (
    <div className="space-y-6">
      {/* Demo triggers */}
      <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
        <h2 className="text-lg mb-1" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
          Trigger Incident
        </h2>
        <p className="text-sm mb-4" style={{ color: '#003D4F88' }}>
          Simulate a production error — the agent will start analyzing automatically.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_SCENARIOS.map((scenario, i) => (
            <button
              key={i}
              onClick={() => simulateMutation.mutate(scenario)}
              disabled={simulateMutation.isPending}
              className="text-left p-4 rounded-lg border-2 border-dashed transition-all disabled:opacity-50 hover:shadow-sm"
              style={{ borderColor: '#F2617A55', backgroundColor: '#FFFFFF' }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#F2617A'
                e.currentTarget.style.backgroundColor = '#F2617A08'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#F2617A55'
                e.currentTarget.style.backgroundColor = '#FFFFFF'
              }}
            >
              <p className="font-semibold text-sm" style={{ color: '#F2617A' }}>{scenario.title}</p>
              <p className="text-xs mt-1 font-mono truncate" style={{ color: '#003D4F77' }}>
                {scenario.error_message}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident list */}
        <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
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
              {[1, 2].map(i => (
                <div key={i} className="h-16 rounded-lg animate-pulse" style={{ backgroundColor: '#EDF1F3' }} />
              ))}
            </div>
          ) : incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="text-3xl">🛡️</span>
              <p className="text-sm" style={{ color: '#003D4F66' }}>No incidents. All systems nominal.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {incidents.map((incident: Incident) => (
                <div
                  key={incident.id}
                  onClick={() => setActiveIncidentId(incident.id)}
                  className="p-3 rounded-lg border cursor-pointer transition-all"
                  style={{
                    borderColor: activeIncidentId === incident.id ? '#47A1AD' : '#EDF1F3',
                    backgroundColor: activeIncidentId === incident.id ? '#47A1AD0D' : '#FFFFFF',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <span className="text-sm mt-0.5 shrink-0">{STATUS_ICON[incident.status] ?? '⚪'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: '#003D4F' }}>
                          {incident.title}
                        </p>
                        <p className="text-xs mt-0.5 font-mono truncate" style={{ color: '#003D4F66' }}>
                          {incident.error_message}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={incident.status} />
                      {incident.incident_type !== 'unknown' && (
                        <TypeBadge type={incident.incident_type} />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 pl-6">
                    {incident.github_pr_url && (
                      <a
                        href={incident.github_pr_url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-xs font-semibold underline"
                        style={{ color: '#634F7D' }}
                      >
                        View PR →
                      </a>
                    )}
                    {!incident.postmortem && isTerminal && incident.id === activeIncidentId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); postmortemMutation.mutate(incident.id) }}
                        disabled={postmortemMutation.isPending}
                        className="text-xs font-semibold disabled:opacity-50"
                        style={{ color: '#47A1AD' }}
                      >
                        {postmortemMutation.isPending ? 'Generating...' : 'Generate post-mortem'}
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(incident.id) }}
                      className="text-xs ml-auto opacity-40 hover:opacity-100 transition-opacity"
                      style={{ color: '#F2617A' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="space-y-4">
          {activeIncident ? (
            <>
              {/* Incident header */}
              <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h2 className="text-lg leading-tight" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
                    {activeIncident.title}
                  </h2>
                  <span className="text-sm shrink-0">{STATUS_ICON[activeIncident.status]}</span>
                </div>
                <div className="flex gap-2 mb-4">
                  <StatusBadge status={activeIncident.status} />
                  {activeIncident.incident_type !== 'unknown' && (
                    <TypeBadge type={activeIncident.incident_type} />
                  )}
                </div>
                <p className="text-xs font-mono p-2 rounded" style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}>
                  {activeIncident.error_message}
                </p>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  {activeIncident.status === 'detected' && !isAgentRunning && (
                    <button
                      onClick={() => setRunningIncidentId(activeIncident.id)}
                      className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
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
                      className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white text-center transition-opacity hover:opacity-90"
                      style={{ backgroundColor: '#634F7D' }}
                    >
                      View Pull Request →
                    </a>
                  )}
                  {!activeIncident.postmortem && isTerminal && (
                    <button
                      onClick={() => postmortemMutation.mutate(activeIncident.id)}
                      disabled={postmortemMutation.isPending}
                      className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#47A1AD' }}
                    >
                      {postmortemMutation.isPending ? 'Generating...' : 'Generate Post-mortem'}
                    </button>
                  )}
                </div>
              </div>

              {/* Agent stream — shown while running */}
              {isAgentRunning && (
                <AgentStream
                  incidentId={activeIncident.id}
                  onDone={handleAgentDone}
                />
              )}

              {/* Agent analysis (after run, not running) */}
              {!isAgentRunning && activeIncident.agent_analysis && !activeIncident.postmortem && (
                <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                  <h3 className="mb-3 text-sm font-semibold" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>
                    Agent Analysis
                  </h3>
                  <div className="text-xs font-mono p-3 rounded overflow-y-auto max-h-48 whitespace-pre-wrap leading-relaxed"
                    style={{ backgroundColor: '#003D4F', color: '#EDF1F3' }}>
                    {activeIncident.agent_analysis}
                  </div>
                </div>
              )}

              {/* Post-mortem */}
              {activeIncident.postmortem && (
                <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                  <h3 className="mb-3" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
                    Post-mortem
                  </h3>
                  <div className="prose prose-sm max-w-none text-sm" style={{ color: '#003D4F' }}>
                    <ReactMarkdown>{activeIncident.postmortem}</ReactMarkdown>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl p-6 shadow-sm flex flex-col items-center justify-center h-64 gap-3"
              style={{ backgroundColor: '#FFFFFF' }}>
              <span className="text-4xl">🤖</span>
              <p className="text-sm" style={{ color: '#003D4F55' }}>Select an incident to see the agent at work</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
