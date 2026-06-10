import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { incidentsApi, webhookApi, type Incident } from '../api/client'
import { StatusBadge, TypeBadge } from '../components/StatusBadge'
import { AgentStream } from '../components/AgentStream'

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

export default function Dashboard() {
  const queryClient = useQueryClient()
  const [activeIncidentId, setActiveIncidentId] = useState<number | null>(null)

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
    },
  })

  const deleteMutation = useMutation({
    mutationFn: incidentsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  })

  const postmortemMutation = useMutation({
    mutationFn: incidentsApi.postmortem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incidents'] }),
  })

  const activeIncident = incidents.find((i: Incident) => i.id === activeIncidentId)

  return (
    <div className="space-y-6">
      {/* Demo triggers */}
      <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
        <h2
          className="text-lg mb-1"
          style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}
        >
          Trigger Incident
        </h2>
        <p className="text-sm mb-4" style={{ color: '#003D4F99' }}>
          Simulate a production error to watch the agent heal it in real time.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DEMO_SCENARIOS.map((scenario, i) => (
            <button
              key={i}
              onClick={() => simulateMutation.mutate(scenario)}
              disabled={simulateMutation.isPending}
              className="text-left p-4 rounded-lg border-2 border-dashed transition-colors disabled:opacity-50"
              style={{ borderColor: '#F2617A44' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#F2617A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#F2617A44')}
            >
              <p className="font-semibold text-sm" style={{ color: '#F2617A' }}>{scenario.title}</p>
              <p className="text-xs mt-1 font-mono" style={{ color: '#003D4F88' }}>
                {scenario.error_message.slice(0, 50)}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident list */}
        <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <h2
            className="text-lg mb-4"
            style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}
          >
            Incidents
          </h2>
          {isLoading ? (
            <p className="text-sm" style={{ color: '#003D4F66' }}>Loading...</p>
          ) : incidents.length === 0 ? (
            <p className="text-sm" style={{ color: '#003D4F66' }}>No incidents. Trigger one above.</p>
          ) : (
            <div className="space-y-2">
              {incidents.map((incident: Incident) => (
                <div
                  key={incident.id}
                  onClick={() => setActiveIncidentId(incident.id)}
                  className="p-3 rounded-lg border cursor-pointer transition-all"
                  style={{
                    borderColor: activeIncidentId === incident.id ? '#47A1AD' : '#EDF1F3',
                    backgroundColor: activeIncidentId === incident.id ? '#47A1AD11' : '#FFFFFF',
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: '#003D4F' }}>
                        {incident.title}
                      </p>
                      <p className="text-xs mt-0.5 font-mono truncate" style={{ color: '#003D4F66' }}>
                        {incident.error_message}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <StatusBadge status={incident.status} />
                      <TypeBadge type={incident.incident_type} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
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
                    {!incident.postmortem && incident.status !== 'detected' && incident.status !== 'analyzing' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); postmortemMutation.mutate(incident.id) }}
                        className="text-xs font-semibold"
                        style={{ color: '#47A1AD' }}
                      >
                        Generate post-mortem
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(incident.id) }}
                      className="text-xs ml-auto"
                      style={{ color: '#F2617A99' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent stream / incident detail */}
        <div className="space-y-4">
          {activeIncident ? (
            <>
              <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                <h2
                  className="text-lg mb-1"
                  style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}
                >
                  {activeIncident.title}
                </h2>
                <div className="flex gap-2 mb-4">
                  <StatusBadge status={activeIncident.status} />
                  <TypeBadge type={activeIncident.incident_type} />
                </div>
                {activeIncident.status === 'detected' && (
                  <button
                    onClick={() => setActiveIncidentId(activeIncident.id)}
                    className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90"
                    style={{ backgroundColor: '#F2617A' }}
                  >
                    ▶ Run Agent
                  </button>
                )}
              </div>

              {(activeIncident.status === 'analyzing' || activeIncident.status === 'detected') && (
                <AgentStream
                  incidentId={activeIncident.id}
                  onDone={() => queryClient.invalidateQueries({ queryKey: ['incidents'] })}
                />
              )}

              {activeIncident.postmortem && (
                <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                  <h3
                    className="mb-3"
                    style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}
                  >
                    Post-mortem
                  </h3>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm" style={{ color: '#003D4F' }}>
                    {activeIncident.postmortem}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div
              className="rounded-xl p-6 shadow-sm flex items-center justify-center h-48"
              style={{ backgroundColor: '#FFFFFF' }}
            >
              <p className="text-sm" style={{ color: '#003D4F55' }}>Select an incident to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
