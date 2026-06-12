import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi, projectsApi, webhookApi, policyApi, openScanSocket, type Incident, type Project } from '../api/client'
import { StatusBadge, TypeBadge } from '../components/StatusBadge'
import { AgentStream } from '../components/AgentStream'
import ReactMarkdown from 'react-markdown'

const PROJECT_COLORS = ['#47A1AD', '#6B9E78', '#634F7D', '#CC850A', '#F2617A']
const projectColor = (projects: Project[], id: number | null) => {
  const idx = projects.findIndex(p => p.id === id)
  return PROJECT_COLORS[(idx >= 0 ? idx : 0) % PROJECT_COLORS.length]
}

const STATUS_ICON: Record<string, string> = {
  detected:         '🔴',
  analyzing:        '🔵',
  fixing:           '🟠',
  pr_opened:        '🟣',
  report_generated: '🔵',
  resolved:         '🟢',
  failed:           '🔴',
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

const EMPTY_FORM = { title: '', error_message: '', stack_trace: '', project_id: '' }

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null)
  const [runningIncidentId, setRunningIncidentId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [scanState, setScanState] = useState<'idle' | 'scanning' | 'done'>('idle')
  const [scanLog, setScanLog] = useState<string[]>([])
  const scanQueueRef = useRef<number[]>([])

  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: incidentsApi.list,
    refetchInterval: 3000,
  })

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const { data: policy } = useQuery({ queryKey: ['policy'], queryFn: policyApi.get, refetchInterval: 10000 })
  const agentEnabled = policy?.agent_enabled ?? true

  const createMutation = useMutation({
    mutationFn: webhookApi.simulate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setActiveIncidentId(data.incident_id)
      if (agentEnabled) setRunningIncidentId(data.incident_id)
      setShowForm(false)
      setForm(EMPTY_FORM)
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
    // Procesa el siguiente incidente de la cola del scan
    if (scanQueueRef.current.length > 0) {
      const nextId = scanQueueRef.current.shift()!
      setActiveIncidentId(nextId)
      setRunningIncidentId(nextId)
    }
  }, [queryClient])

  function handleScan(projectId: number) {
    setScanState('scanning')
    setScanLog(['Connecting to scanner...'])
    const ws = openScanSocket(projectId)

    ws.onmessage = (msg) => {
      const event = JSON.parse(msg.data)
      if (event.type === 'status') {
        setScanLog(l => [...l, `⚡ ${event.message}`])
      } else if (event.type === 'tool_executing') {
        setScanLog(l => [...l, `🔍 Reading: ${event.tool}`])
      } else if (event.type === 'bugs_found') {
        setScanLog(l => [...l, `🐛 ${event.count} bugs found`])
      } else if (event.type === 'incidents_created') {
        const ids: number[] = event.incident_ids
        setScanLog(l => [...l, `✔ ${ids.length} incidents created — starting analysis`])
        setScanState('done')
        queryClient.invalidateQueries({ queryKey: ['incidents'] })
        if (agentEnabled && ids.length > 0) {
          const [first, ...rest] = ids
          scanQueueRef.current = rest
          setActiveIncidentId(first)
          setRunningIncidentId(first)
        }
      } else if (event.type === 'error') {
        setScanLog(l => [...l, `❌ ${event.message}`])
        setScanState('idle')
      }
    }

    ws.onerror = () => {
      setScanLog(l => [...l, '❌ Connection error'])
      setScanState('idle')
    }
  }

  function handleSelectIncident(incident: Incident) {
    setActiveIncidentId(incident.id)
    if (agentEnabled && incident.status === 'detected') {
      setRunningIncidentId(incident.id)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.error_message.trim()) return
    createMutation.mutate({
      title: form.title.trim(),
      error_message: form.error_message.trim(),
      stack_trace: form.stack_trace.trim() || undefined,
      project_id: form.project_id ? Number(form.project_id) : undefined,
    })
  }

  const activeIncident = incidents.find((i: Incident) => i.id === activeIncidentId)
  const isAgentRunning = runningIncidentId === activeIncidentId
  const isTerminal = activeIncident
    ? ['pr_opened', 'report_generated', 'resolved', 'failed'].includes(activeIncident.status)
    : false

  const withPR = incidents.filter((i: Incident) => i.github_pr_url).length
  const withPM = incidents.filter((i: Incident) => i.postmortem).length
  const resolved = incidents.filter((i: Incident) => i.status === 'resolved' || i.status === 'pr_opened').length

  const inputStyle = { border: '1px solid #EDF1F3', backgroundColor: '#FAFAFA', color: '#003D4F' }
  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow'

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={incidents.length} sub="all time" color="#003D4F" />
        <StatCard label="PRs Opened" value={withPR} sub="auto-fixed by agent" color="#634F7D" />
        <StatCard label="Post-mortems" value={withPM} sub="generated" color="#47A1AD" />
        <StatCard label="Resolved" value={resolved} sub="healed incidents" color="#6B9E78" />
      </div>

      {/* Scan panel */}
      {(scanState !== 'idle' || scanLog.length > 0) && (
        <div className="rounded-xl p-5 shadow-sm" style={{ backgroundColor: '#003D4F' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {scanState === 'scanning' && (
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#47A1AD', display: 'inline-block' }} />
              )}
              <span className="text-sm font-semibold" style={{ color: '#EDF1F3' }}>
                {scanState === 'scanning' ? 'Scanning repository...' : 'Scan complete'}
              </span>
            </div>
            {scanState !== 'scanning' && (
              <button onClick={() => { setScanLog([]); setScanState('idle') }}
                style={{ color: '#EDF1F388', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            )}
          </div>
          <div className="space-y-1">
            {scanLog.map((line, i) => (
              <p key={i} className="text-xs font-mono" style={{ color: '#EDF1F3AA' }}>{line}</p>
            ))}
          </div>
        </div>
      )}

      {/* New incident form */}
      {showForm && (
        <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
              New Incident
            </h2>
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
              style={{ color: '#003D4F55', background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F' }}>Title *</label>
              <input
                type="text"
                placeholder="e.g. ZeroDivisionError in /payments"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
                onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F' }}>Error message *</label>
              <input
                type="text"
                placeholder="e.g. ZeroDivisionError: division by zero"
                value={form.error_message}
                onChange={e => setForm(f => ({ ...f, error_message: e.target.value }))}
                className={inputClass}
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
                onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F' }}>
                Stack trace
                <span className="ml-1 font-normal" style={{ color: '#003D4F55' }}>optional — ayuda al agente a ubicar el problema</span>
              </label>
              <textarea
                rows={5}
                placeholder={'Traceback (most recent call last):\n  File "app/routes/payments.py", line 34, in process_payment\n    ...'}
                value={form.stack_trace}
                onChange={e => setForm(f => ({ ...f, stack_trace: e.target.value }))}
                className={inputClass}
                style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
                onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
              />
            </div>

            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F' }}>Project</label>
                <select
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  className={inputClass}
                  style={inputStyle}
                  onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
                  onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  <option value="">— No project —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={createMutation.isPending || !form.title.trim() || !form.error_message.trim()}
                className="flex-1 py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#F2617A' }}
              >
                {createMutation.isPending ? 'Creating...' : 'Create & Analyze'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Incident list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
              Incidents
            </h2>
            <div className="flex items-center gap-2">
              {incidents.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}>
                  {incidents.length}
                </span>
              )}
              {projects.length > 0 && (
                <button
                  onClick={() => handleScan(projects[0].id)}
                  disabled={scanState === 'scanning'}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ backgroundColor: '#47A1AD', color: '#FFFFFF' }}
                >
                  {scanState === 'scanning' ? 'Scanning...' : '⟳ Scan'}
                </button>
              )}
              <button
                onClick={() => setShowForm(s => !s)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#F2617A', color: '#FFFFFF' }}
              >
                + New
              </button>
            </div>
          </div>

          {projects.length === 0 && (
            <div className="mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: '#CC850A11', color: '#CC850A' }}>
              No projects configured — go to <strong>Projects</strong> to connect a GitHub repository first.
            </div>
          )}

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
                    onClick={() => handleSelectIncident(incident)}
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
                          {incident.project_name && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `${pColor}22`, color: pColor }}>
                              {incident.project_name}
                            </span>
                          )}
                          <StatusBadge status={incident.status} />
                          {incident.incident_type !== 'unknown' && <TypeBadge type={incident.incident_type} />}
                          {incident.github_pr_url && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#634F7D22', color: '#634F7D' }}>PR</span>
                          )}
                          {incident.postmortem && (
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: '#47A1AD22', color: '#47A1AD' }}>PM</span>
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
          {/* AgentStream abre el WebSocket en cuanto hay un incidentId activo,
              sin esperar a que la lista de incidentes se refresque */}
          {isAgentRunning && activeIncidentId && (
            <AgentStream incidentId={activeIncidentId} onDone={handleAgentDone} />
          )}

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
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: `${projectColor(projects, activeIncident.project_id)}22`,
                        color: projectColor(projects, activeIncident.project_id),
                      }}>
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

              {activeIncident.postmortem && (
                <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                  <h3 className="mb-3 font-bold" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>Post-mortem</h3>
                  <div className="prose prose-sm max-w-none text-sm" style={{ color: '#003D4F' }}>
                    <ReactMarkdown>{activeIncident.postmortem}</ReactMarkdown>
                  </div>
                </div>
              )}
            </>
          ) : !isAgentRunning && (
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
