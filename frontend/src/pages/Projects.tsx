import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi, type Project, type GitHubValidation } from '../api/client'

const PROJECT_COLORS = ['#47A1AD', '#6B9E78', '#634F7D', '#CC850A', '#F2617A']
const projectColor = (idx: number) => PROJECT_COLORS[idx % PROJECT_COLORS.length]

const EMPTY_FORM = { name: '', github_repo: '', github_token: '', target_path: '', can_open_pr: true }

function ProjectForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: typeof EMPTY_FORM
  onSave: (data: typeof EMPTY_FORM) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [validation, setValidation] = useState<GitHubValidation | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  const inputStyle = { border: '1px solid #EDF1F3', backgroundColor: '#FAFAFA', color: '#003D4F' }
  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none'

  return (
    <div className="space-y-3 p-4 rounded-lg" style={{ backgroundColor: '#EDF1F3' }}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F88' }}>Project name</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ShopFlow"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F88' }}>GitHub repository</label>
          <input
            value={form.github_repo}
            onChange={e => setForm(f => ({ ...f, github_repo: e.target.value }))}
            placeholder="owner/repo-name"
            className={inputClass}
            style={inputStyle}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F88' }}>
            Personal Access Token
          </label>
          <input
            type="password"
            value={form.github_token}
            onChange={e => setForm(f => ({ ...f, github_token: e.target.value }))}
            placeholder="ghp_..."
            className={inputClass}
            style={inputStyle}
          />
          <p className="text-xs mt-0.5" style={{ color: '#003D4F44' }}>Scopes: repo, pull requests</p>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#003D4F88' }}>
            Target path <span style={{ color: '#003D4F44' }}>(optional)</span>
          </label>
          <input
            value={form.target_path}
            onChange={e => setForm(f => ({ ...f, target_path: e.target.value }))}
            placeholder="backend/app/routes/"
            className={inputClass}
            style={inputStyle}
          />
          <p className="text-xs mt-0.5" style={{ color: '#003D4F44' }}>Starting path for agent code search</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setForm(f => ({ ...f, can_open_pr: !f.can_open_pr }))}
          className="relative w-9 h-5 rounded-full transition-colors shrink-0"
          style={{ backgroundColor: form.can_open_pr ? '#47A1AD' : '#003D4F22' }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
            style={{ transform: form.can_open_pr ? 'translateX(16px)' : 'translateX(0)' }}
          />
        </button>
        <span className="text-xs font-semibold" style={{ color: '#003D4F' }}>Allow agent to open Pull Requests</span>
      </div>

      {validation && (
        <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: '#6B9E7822' }}>
          <span>✅</span>
          <span style={{ color: '#6B9E78' }}>
            Connected to <strong>{validation.repo}</strong> · {validation.default_branch} · {validation.private ? 'Private' : 'Public'}
          </span>
        </div>
      )}
      {validationError && (
        <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: '#F2617A22' }}>
          <span>❌</span>
          <span style={{ color: '#F2617A' }}>{validationError}</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={async () => {
            setValidating(true); setValidation(null); setValidationError(null)
            try {
              // We can't validate without saving first — just try with form values via a temp approach
              // For UX, just hint to save first
              setValidationError('Save the project first, then use the Test button on the card.')
            } finally {
              setValidating(false)
            }
          }}
          disabled={validating}
          className="px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}
        >
          {validating ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ color: '#003D4F88' }}
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.name}
          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#F2617A' }}
        >
          {saving ? 'Saving...' : 'Save Project'}
        </button>
      </div>
    </div>
  )
}

function ProjectCard({
  project,
  color,
  onEdit,
  onDelete,
  onTest,
}: {
  project: Project
  color: string
  onEdit: () => void
  onDelete: () => void
  onTest: () => Promise<void>
}) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    try {
      const r = await onTest()
      setTestResult({ ok: true, msg: `Connected · ${(r as GitHubValidation).default_branch}` })
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Connection failed'
      setTestResult({ ok: false, msg: detail })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="rounded-xl shadow-sm overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
      <div className="flex items-stretch">
        <div className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>
                  {project.name}
                </h3>
                {!project.active && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#EDF1F3', color: '#003D4F66' }}>
                    inactive
                  </span>
                )}
              </div>
              <p className="text-xs font-mono truncate" style={{ color: '#003D4F88' }}>{project.github_repo || '—'}</p>
              {project.target_path && (
                <p className="text-xs font-mono mt-0.5 truncate" style={{ color: '#003D4F55' }}>
                  ↳ {project.target_path}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0 text-xs">
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: project.github_token_set ? '#6B9E7822' : '#EDF1F3',
                  color: project.github_token_set ? '#6B9E78' : '#003D4F55',
                }}
              >
                {project.github_token_set ? '🔑 Token set' : 'No token'}
              </span>
              <span
                className="px-2 py-0.5 rounded-full font-semibold"
                style={{
                  backgroundColor: project.can_open_pr ? '#47A1AD22' : '#EDF1F3',
                  color: project.can_open_pr ? '#47A1AD' : '#003D4F55',
                }}
              >
                {project.can_open_pr ? 'Can PR' : 'Read only'}
              </span>
            </div>
          </div>

          {testResult && (
            <div
              className="mt-3 text-xs px-3 py-2 rounded-lg"
              style={{ backgroundColor: testResult.ok ? '#6B9E7822' : '#F2617A22', color: testResult.ok ? '#6B9E78' : '#F2617A' }}
            >
              {testResult.ok ? '✅' : '❌'} {testResult.msg}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleTest}
              disabled={testing || !project.github_token_set}
              title={!project.github_token_set ? 'Set a token first' : undefined}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40 transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={onEdit}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold ml-auto transition-opacity hover:opacity-80"
              style={{ color: '#F2617A' }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list })

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setShowAdd(false) },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Project> }) => projectsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['projects'] }); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>Projects</h1>
          <p className="text-sm mt-0.5" style={{ color: '#003D4F88' }}>
            Configure the GitHub repositories the agent will monitor and heal.
          </p>
        </div>
        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#F2617A' }}
          >
            + Add Project
          </button>
        )}
      </div>

      {showAdd && (
        <ProjectForm
          initial={EMPTY_FORM}
          onSave={data => createMutation.mutate(data)}
          onCancel={() => setShowAdd(false)}
          saving={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ backgroundColor: '#FFFFFF' }} />
          ))}
        </div>
      ) : projects.length === 0 && !showAdd ? (
        <div className="rounded-xl p-12 flex flex-col items-center gap-3 shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
          <span className="text-4xl">🔗</span>
          <p className="text-sm font-semibold" style={{ color: '#003D4F' }}>No projects configured</p>
          <p className="text-xs text-center" style={{ color: '#003D4F66' }}>
            Add a GitHub repository so the agent can read code and open pull requests.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="mt-2 px-5 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: '#F2617A' }}
          >
            + Add your first project
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project, idx) => (
            editingId === project.id ? (
              <div key={project.id} className="rounded-xl overflow-hidden shadow-sm" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="p-5">
                  <h3 className="font-bold text-sm mb-3" style={{ color: '#003D4F' }}>Edit — {project.name}</h3>
                  <ProjectForm
                    initial={{
                      name: project.name,
                      github_repo: project.github_repo,
                      github_token: '',
                      target_path: project.target_path,
                      can_open_pr: project.can_open_pr,
                    }}
                    onSave={data => updateMutation.mutate({ id: project.id, data })}
                    onCancel={() => setEditingId(null)}
                    saving={updateMutation.isPending}
                  />
                </div>
              </div>
            ) : (
              <ProjectCard
                key={project.id}
                project={project}
                color={projectColor(idx)}
                onEdit={() => setEditingId(project.id)}
                onDelete={() => deleteMutation.mutate(project.id)}
                onTest={() => projectsApi.validate(project.id) as Promise<unknown> as Promise<void>}
              />
            )
          ))}
        </div>
      )}
    </div>
  )
}
