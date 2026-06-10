import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { policyApi, type Policy, type GitHubValidation } from '../api/client'

export default function PolicyConfig() {
  const queryClient = useQueryClient()
  const { data: policy } = useQuery({ queryKey: ['policy'], queryFn: policyApi.get })
  const [form, setForm] = useState<Partial<Policy>>({})
  const [saved, setSaved] = useState(false)
  const [validation, setValidation] = useState<GitHubValidation | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    if (policy) setForm(policy)
  }, [policy])

  const mutation = useMutation({
    mutationFn: policyApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleValidate = async () => {
    setValidating(true)
    setValidation(null)
    setValidationError(null)
    // Save first so the backend uses the latest token
    await mutation.mutateAsync(form)
    try {
      const result = await policyApi.validateGitHub()
      setValidation(result)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Connection failed'
      setValidationError(msg)
    } finally {
      setValidating(false)
    }
  }

  const toggle = (key: keyof Policy) => setForm(f => ({ ...f, [key]: !f[key] }))

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow"
  const inputStyle = { border: '1px solid #EDF1F3', backgroundColor: '#FFFFFF', color: '#000000' }

  return (
    <div className="max-w-2xl space-y-6">
      {/* GitHub Connection */}
      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <h2 className="text-lg mb-1" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
          GitHub Connection
        </h2>
        <p className="text-sm mb-5" style={{ color: '#003D4F88' }}>
          The agent uses these credentials to read code and open pull requests.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>Repository</label>
            <input
              type="text"
              placeholder="owner/repo-name"
              value={form.github_repo ?? ''}
              onChange={e => setForm(f => ({ ...f, github_repo: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>
              Personal Access Token
              {policy?.github_token_set && (
                <span className="ml-2 text-xs font-semibold" style={{ color: '#6B9E78' }}>✓ saved</span>
              )}
            </label>
            <input
              type="password"
              placeholder={policy?.github_token_set ? '••••••••••••••••' : 'ghp_...'}
              value={form.github_token ?? ''}
              onChange={e => setForm(f => ({ ...f, github_token: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            />
            <p className="text-xs mt-1" style={{ color: '#003D4F55' }}>Required scopes: repo, pull requests</p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>
              Target Path
              <span className="ml-2 text-xs font-normal" style={{ color: '#003D4F55' }}>optional</span>
            </label>
            <input
              type="text"
              placeholder="demo-target  (leave empty for root)"
              value={form.target_path ?? ''}
              onChange={e => setForm(f => ({ ...f, target_path: e.target.value }))}
              className={inputClass}
              style={inputStyle}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            />
            <p className="text-xs mt-1" style={{ color: '#003D4F55' }}>
              Directory where the agent starts looking for code. Speeds up analysis significantly.
            </p>
          </div>

          {/* Validation feedback */}
          {validation && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: '#6B9E7822' }}>
              <span>✅</span>
              <div>
                <p className="font-semibold" style={{ color: '#6B9E78' }}>Connected to {validation.repo}</p>
                <p className="text-xs" style={{ color: '#003D4F88' }}>
                  Branch: {validation.default_branch} · {validation.private ? 'Private' : 'Public'}
                </p>
              </div>
            </div>
          )}
          {validationError && (
            <div className="flex items-start gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: '#F2617A22' }}>
              <span>❌</span>
              <p style={{ color: '#F2617A' }}>{validationError}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleValidate}
              disabled={validating || mutation.isPending}
              className="py-2 px-4 rounded-lg font-semibold text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#EDF1F3', color: '#003D4F' }}
            >
              {validating ? 'Testing...' : 'Test Connection'}
            </button>
            <button
              onClick={() => mutation.mutate(form)}
              disabled={mutation.isPending}
              className="flex-1 py-2 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: saved ? '#6B9E78' : '#F2617A' }}
            >
              {saved ? '✓ Saved' : mutation.isPending ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* Agent Permissions */}
      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <h2 className="text-lg mb-1" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
          Agent Permissions
        </h2>
        <p className="text-sm mb-5" style={{ color: '#003D4F88' }}>
          The agent can only perform actions explicitly enabled here.
        </p>

        <div className="space-y-2">
          {[
            { key: 'can_read_repo',           label: 'Read repository',        desc: 'Access files and source code' },
            { key: 'can_open_pr',             label: 'Open Pull Requests',      desc: 'Create PRs with automatic fixes' },
            { key: 'can_auto_merge',          label: 'Auto-merge',              desc: 'Merge PRs without human approval' },
            { key: 'require_human_approval',  label: 'Require human approval',  desc: 'For deployments and critical actions' },
          ].map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 rounded-lg"
              style={{ backgroundColor: '#EDF1F3' }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: '#003D4F' }}>{label}</p>
                <p className="text-xs" style={{ color: '#003D4F77' }}>{desc}</p>
              </div>
              <button
                onClick={() => toggle(key as keyof Policy)}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ backgroundColor: form[key as keyof Policy] ? '#47A1AD' : '#003D4F22' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  style={{ transform: form[key as keyof Policy] ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>
            Allowed file extensions
          </label>
          <input
            type="text"
            value={form.allowed_file_extensions ?? ''}
            onChange={e => setForm(f => ({ ...f, allowed_file_extensions: e.target.value }))}
            className={inputClass}
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          />
        </div>

        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="mt-4 w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: saved ? '#6B9E78' : '#F2617A' }}
        >
          {saved ? '✓ Saved' : mutation.isPending ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>
    </div>
  )
}
