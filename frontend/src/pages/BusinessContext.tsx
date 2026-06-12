import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { policyApi, projectsApi, incidentsApi, type Policy, type Incident, type Project } from '../api/client'

const DOMAINS = [
  { value: 'ecommerce',   label: 'E-commerce',          icon: '🛍️' },
  { value: 'fintech',     label: 'Fintech / Payments',   icon: '💳' },
  { value: 'saas',        label: 'SaaS / B2B',           icon: '☁️' },
  { value: 'healthcare',  label: 'Healthcare',            icon: '🏥' },
  { value: 'logistics',   label: 'Logistics / Supply',   icon: '📦' },
  { value: 'media',       label: 'Media / Content',      icon: '🎬' },
  { value: 'gaming',      label: 'Gaming',               icon: '🎮' },
  { value: 'other',       label: 'Other',                icon: '🏢' },
]

const IMPACT_MAP: Record<string, string[]> = {
  ecommerce:  ['Checkout flow', 'Product catalog', 'Payment processing', 'Inventory management'],
  fintech:    ['Transaction processing', 'Authentication', 'Compliance reporting', 'Fraud detection'],
  saas:       ['API availability', 'Authentication', 'Billing', 'Data export'],
  healthcare: ['Patient records', 'Authentication', 'Appointment scheduling', 'Compliance'],
  logistics:  ['Order tracking', 'Route optimization', 'Inventory sync', 'Driver app'],
  media:      ['Video streaming', 'CDN delivery', 'Content ingestion', 'Recommendations'],
  gaming:     ['Matchmaking', 'Game servers', 'Leaderboards', 'In-app purchases'],
  other:      [],
}

export default function BusinessContext() {
  const queryClient = useQueryClient()
  const { data: policy } = useQuery({ queryKey: ['policy'], queryFn: policyApi.get })
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })
  const { data: incidents = [] } = useQuery({ queryKey: ['incidents'], queryFn: incidentsApi.list })
  const [form, setForm] = useState<Partial<Policy>>({})
  const [saved, setSaved] = useState(false)
  const [linkingId, setLinkingId] = useState<number | null>(null)

  useEffect(() => { if (policy) setForm(policy) }, [policy])

  const mutation = useMutation({
    mutationFn: policyApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const linkMutation = useMutation({
    mutationFn: ({ id, linked }: { id: number; linked: boolean }) =>
      projectsApi.update(id, { business_linked: linked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onSettled: () => setLinkingId(null),
  })

  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow'
  const inputStyle = { border: '1px solid #EDF1F3', backgroundColor: '#FAFAFA', color: '#003D4F' }
  const focus = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')
  const blur  = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.boxShadow = 'none')

  const suggestedServices = IMPACT_MAP[form.business_domain ?? ''] ?? []

  const linkedProjects = projects.filter((p: Project) => p.business_linked)

  // Per-project incident counts
  const incidentsByProject = incidents.reduce((acc: Record<string, { total: number; fixed: number }>, i: Incident) => {
    if (!i.project_name) return acc
    if (!acc[i.project_name]) acc[i.project_name] = { total: 0, fixed: 0 }
    acc[i.project_name].total += 1
    if (i.github_pr_url) acc[i.project_name].fixed += 1
    return acc
  }, {})

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>Business Context</h1>
        <p className="text-sm mt-0.5" style={{ color: '#003D4F88' }}>
          Tell the agent what your business does so it can prioritize fixes by business impact.
        </p>
      </div>

      {/* Identity */}
      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <h2 className="text-base mb-4" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
          Identity
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F' }}>Company / Product name</label>
            <input
              type="text"
              placeholder="e.g. ShopFlow"
              value={form.business_name ?? ''}
              onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))}
              className={inputClass} style={inputStyle} onFocus={focus} onBlur={blur}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#003D4F' }}>Business domain</label>
            <div className="grid grid-cols-2 gap-2">
              {DOMAINS.map(d => (
                <button
                  key={d.value}
                  onClick={() => setForm(f => ({ ...f, business_domain: d.value }))}
                  className="flex items-center gap-2 p-3 rounded-lg text-left transition-all text-sm"
                  style={{
                    border: `2px solid ${form.business_domain === d.value ? '#47A1AD' : '#EDF1F3'}`,
                    backgroundColor: form.business_domain === d.value ? '#47A1AD11' : '#FAFAFA',
                    color: '#003D4F',
                  }}
                >
                  <span>{d.icon}</span>
                  <span className="font-medium text-xs">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F' }}>
              Brief description
              <span className="ml-1 font-normal" style={{ color: '#003D4F55' }}>optional — helps the agent understand context</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Multi-tenant e-commerce platform serving 500K monthly active users across Latin America."
              value={form.business_description ?? ''}
              onChange={e => setForm(f => ({ ...f, business_description: e.target.value }))}
              className={inputClass}
              style={{ ...inputStyle, resize: 'vertical' }}
              onFocus={focus} onBlur={blur}
            />
          </div>
        </div>
      </div>

      {/* Critical services */}
      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <h2 className="text-base mb-1" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
          Critical Services
        </h2>
        <p className="text-sm mb-4" style={{ color: '#003D4F88' }}>
          Which services or features have the highest business impact if they fail?
        </p>

        {suggestedServices.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-semibold mb-2" style={{ color: '#003D4F66' }}>Suggested for your domain:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedServices.map(s => {
                const current = (form.critical_services ?? '').split(',').map(x => x.trim()).filter(Boolean)
                const active = current.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => {
                      const next = active
                        ? current.filter(x => x !== s)
                        : [...current, s]
                      setForm(f => ({ ...f, critical_services: next.join(', ') }))
                    }}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: active ? '#47A1AD' : '#EDF1F3',
                      color: active ? '#FFFFFF' : '#003D4F88',
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <input
          type="text"
          placeholder="e.g. Checkout flow, Payment processing, User authentication"
          value={form.critical_services ?? ''}
          onChange={e => setForm(f => ({ ...f, critical_services: e.target.value }))}
          className={inputClass} style={inputStyle} onFocus={focus} onBlur={blur}
        />
        <p className="text-xs mt-1" style={{ color: '#003D4F55' }}>Comma-separated list</p>
      </div>

      {/* Linked Projects */}
      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
              Linked Projects
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#003D4F88' }}>
              Vincula los repositorios GitHub que pertenecen a este negocio.{' '}
              <a href="/projects" className="underline" style={{ color: '#47A1AD' }}>Configurar proyectos →</a>
            </p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              backgroundColor: linkedProjects.length > 0 ? '#6B9E7822' : '#EDF1F3',
              color: linkedProjects.length > 0 ? '#6B9E78' : '#003D4F55',
            }}
          >
            {linkedProjects.length} vinculado{linkedProjects.length !== 1 ? 's' : ''}
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#003D4F44' }}>
            <p className="text-sm">No hay proyectos configurados.</p>
            <p className="text-xs mt-1">
              Ve a <a href="/projects" style={{ color: '#47A1AD' }} className="underline">Projects</a> para conectar un repositorio GitHub.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project: Project) => {
              const stats = incidentsByProject[project.name] ?? { total: 0, fixed: 0 }
              const fixRate = stats.total > 0 ? Math.round((stats.fixed / stats.total) * 100) : null
              const isLinked = project.business_linked
              const isLoading = linkingId === project.id

              return (
                <div
                  key={project.id}
                  className="flex items-center gap-4 p-4 rounded-lg transition-all"
                  style={{
                    border: `1px solid ${isLinked ? '#47A1AD44' : '#EDF1F3'}`,
                    backgroundColor: isLinked ? '#47A1AD08' : '#FAFAFA',
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ backgroundColor: isLinked ? '#47A1AD22' : '#003D4F0A' }}
                  >
                    🐙
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#003D4F' }}>{project.name}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: '#003D4F55' }}>{project.github_repo}</p>
                  </div>
                  {stats.total > 0 && (
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div>
                        <p className="text-xs font-semibold" style={{ color: '#003D4F' }}>{stats.total}</p>
                        <p className="text-xs" style={{ color: '#003D4F44' }}>incidents</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={{ color: '#6B9E78' }}>{fixRate}%</p>
                        <p className="text-xs" style={{ color: '#003D4F44' }}>auto-fixed</p>
                      </div>
                    </div>
                  )}
                  <button
                    disabled={isLoading}
                    onClick={() => {
                      setLinkingId(project.id)
                      linkMutation.mutate({ id: project.id, linked: !isLinked })
                    }}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                    style={isLinked
                      ? { backgroundColor: '#47A1AD', color: '#FFFFFF' }
                      : { backgroundColor: '#EDF1F3', color: '#003D4F77', border: '1px dashed #003D4F33' }
                    }
                  >
                    {isLoading ? '…' : isLinked ? '✓ Vinculado' : 'Vincular'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => mutation.mutate(form)}
        disabled={mutation.isPending}
        className="w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: saved ? '#6B9E78' : '#F2617A' }}
      >
        {saved ? '✓ Saved' : mutation.isPending ? 'Saving...' : 'Save Business Context'}
      </button>
    </div>
  )
}
