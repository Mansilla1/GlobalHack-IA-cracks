import { useQuery } from '@tanstack/react-query'
import { policyApi, projectsApi } from '../api/client'

type Status = 'connected' | 'available' | 'soon'

interface Integration {
  id: string
  name: string
  logo: string
  description: string
  status: Status
  capabilities: string[]
  detail?: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'github',
    name: 'GitHub',
    logo: '🐙',
    description: 'Read source code, create branches and pull requests with automatic fixes.',
    status: 'connected',
    capabilities: ['Read repository', 'Create branches', 'Open Pull Requests', 'Code search'],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    logo: '🔔',
    description: 'Receive error events from Sentry and trigger automatic analysis.',
    status: 'available',
    capabilities: ['Error ingestion', 'Stack trace parsing', 'Auto-trigger agent'],
    detail: 'Send Sentry webhooks to the endpoint below to trigger the agent automatically.',
  },
  {
    id: 'jira',
    name: 'Jira',
    logo: '🎯',
    description: 'Pick up tickets from your backlog and resolve them autonomously with the agent.',
    status: 'soon',
    capabilities: ['Read tickets', 'Update ticket status', 'Link PRs to issues', 'Auto-assign'],
  },
  {
    id: 'datadog',
    name: 'Datadog',
    logo: '🐕',
    description: 'Detect latency spikes and memory leaks. Agent correlates metrics with source code.',
    status: 'soon',
    capabilities: ['Metric alerts', 'APM traces', 'Log correlation', 'Performance PRs'],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    logo: '🚨',
    description: 'Receive on-call alerts and auto-remediate before the engineer even wakes up.',
    status: 'soon',
    capabilities: ['Incident ingestion', 'Auto-acknowledge', 'Runbook generation', 'Post-mortem sync'],
  },
  {
    id: 'linear',
    name: 'Linear',
    logo: '◆',
    description: 'Sync issues from Linear and close them automatically when the agent opens a PR.',
    status: 'soon',
    capabilities: ['Issue sync', 'Auto-close on PR', 'Priority mapping', 'Cycle tracking'],
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    logo: '📊',
    description: 'Surface error traces and throughput drops. Agent pinpoints and fixes the root cause.',
    status: 'soon',
    capabilities: ['Error traces', 'Throughput alerts', 'Database query analysis', 'Code fixes'],
  },
  {
    id: 'slack',
    name: 'Slack',
    logo: '💬',
    description: 'Get notified in Slack when the agent opens a PR or generates a post-mortem.',
    status: 'soon',
    capabilities: ['PR notifications', 'Post-mortem summaries', 'Incident alerts', 'Agent chat'],
  },
]

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string }> = {
  connected: { label: 'Connected',  color: '#6B9E78', bg: '#6B9E7822' },
  available: { label: 'Available',  color: '#47A1AD', bg: '#47A1AD22' },
  soon:      { label: 'Coming soon', color: '#003D4F55', bg: '#EDF1F3' },
}

export default function Integrations() {
  const { data: policy } = useQuery({ queryKey: ['policy'], queryFn: policyApi.get })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })

  const hasGitHub = projects.some(p => p.github_token_set)
  const webhookUrl = 'http://localhost:8000/api/webhook/sentry'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>Integrations</h1>
        <p className="text-sm mt-0.5" style={{ color: '#003D4F88' }}>
          Connect Autonomic Sentinel with your existing tools to expand detection and remediation coverage.
        </p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {(['connected', 'available', 'soon'] as Status[]).map(s => {
          const count = INTEGRATIONS.filter(i => i.status === s).length
          const cfg = STATUS_CONFIG[s]
          return (
            <div key={s} className="rounded-xl p-4 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#003D4F88' }}>{cfg.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ fontFamily: "'Bitter', serif", color: cfg.color }}>{count}</p>
              <p className="text-xs mt-0.5" style={{ color: '#003D4F55' }}>integrations</p>
            </div>
          )
        })}
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INTEGRATIONS.map(integration => {
          const cfg = STATUS_CONFIG[integration.status]
          const isGitHub = integration.id === 'github'
          const isSentry = integration.id === 'sentry'
          const reallyConnected = isGitHub ? hasGitHub : false

          return (
            <div
              key={integration.id}
              className="rounded-xl shadow-sm p-5"
              style={{
                backgroundColor: '#FFFFFF',
                opacity: integration.status === 'soon' ? 0.65 : 1,
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: '#EDF1F3' }}>
                    {integration.logo}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#003D4F' }}>{integration.name}</p>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: cfg.bg, color: cfg.color }}
                    >
                      {isGitHub && reallyConnected ? 'Connected' : cfg.label}
                    </span>
                  </div>
                </div>

                {integration.status === 'connected' && (
                  <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: '#6B9E78' }} />
                )}
                {integration.status === 'available' && (
                  <button
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: '#47A1AD', color: '#FFFFFF' }}
                  >
                    Configure
                  </button>
                )}
              </div>

              {/* Description */}
              <p className="text-xs mb-3" style={{ color: '#003D4F88' }}>{integration.description}</p>

              {/* Capabilities */}
              <div className="flex flex-wrap gap-1 mb-3">
                {integration.capabilities.map(cap => (
                  <span key={cap} className="text-xs px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: '#EDF1F3', color: '#003D4F77' }}>
                    {cap}
                  </span>
                ))}
              </div>

              {/* Sentry: show webhook URL */}
              {isSentry && (
                <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#EDF1F3' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#003D4F' }}>Webhook endpoint</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs flex-1 truncate" style={{ color: '#47A1AD' }}>{webhookUrl}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(webhookUrl)}
                      className="text-xs px-2 py-1 rounded font-semibold shrink-0"
                      style={{ backgroundColor: '#47A1AD22', color: '#47A1AD' }}
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs mt-1" style={{ color: '#003D4F55' }}>
                    Add this URL to your Sentry project → Settings → Integrations → Webhooks
                  </p>
                </div>
              )}

              {/* GitHub: show project count */}
              {isGitHub && (
                <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: '#6B9E7811' }}>
                  <p className="text-xs" style={{ color: '#6B9E78' }}>
                    {projects.length > 0
                      ? `${projects.length} project${projects.length > 1 ? 's' : ''} connected — configure more in Projects`
                      : 'No projects yet — go to Projects to connect a repository'}
                  </p>
                </div>
              )}

              {/* Coming soon detail */}
              {integration.status === 'soon' && (
                <div className="mt-2">
                  <button
                    className="text-xs font-semibold"
                    style={{ color: '#003D4F44', background: 'none', border: 'none', cursor: 'default' }}
                  >
                    Notify me when available →
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Roadmap note */}
      <div className="rounded-xl p-5" style={{ backgroundColor: '#003D4F' }}>
        <p className="text-sm font-semibold mb-1" style={{ color: '#EDF1F3' }}>
          Expanding the integration ecosystem
        </p>
        <p className="text-xs" style={{ color: '#EDF1F388' }}>
          The goal is to connect every signal source — from APM and on-call to issue trackers — so the agent
          can detect, triage, and fix incidents across the entire stack without human intervention.
          Each integration adds a new detection vector and closes the feedback loop faster.
        </p>
      </div>
    </div>
  )
}
