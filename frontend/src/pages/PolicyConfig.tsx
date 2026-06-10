import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { policyApi, type Policy } from '../api/client'

export default function PolicyConfig() {
  const queryClient = useQueryClient()
  const { data: policy } = useQuery({ queryKey: ['policy'], queryFn: policyApi.get })
  const [form, setForm] = useState<Partial<Policy>>({})
  const [saved, setSaved] = useState(false)

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

  const toggle = (key: keyof Policy) => setForm(f => ({ ...f, [key]: !f[key] }))

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <h2
          className="text-lg mb-1"
          style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}
        >
          Governance Layer
        </h2>
        <p className="text-sm mb-6" style={{ color: '#003D4F99' }}>
          Configure agent permissions. It can only perform actions explicitly authorized here.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>
              GitHub Repository
            </label>
            <input
              type="text"
              placeholder="owner/repo-name"
              value={form.github_repo ?? ''}
              onChange={e => setForm(f => ({ ...f, github_repo: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow"
              style={{ border: '1px solid #EDF1F3', backgroundColor: '#FFFFFF', color: '#000000' }}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD44')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>
              GitHub Personal Access Token
              {policy?.github_token_set && (
                <span className="ml-2 text-xs font-semibold" style={{ color: '#6B9E78' }}>✓ configured</span>
              )}
            </label>
            <input
              type="password"
              placeholder={policy?.github_token_set ? '••••••••••••••••' : 'ghp_...'}
              value={form.github_token ?? ''}
              onChange={e => setForm(f => ({ ...f, github_token: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow"
              style={{ border: '1px solid #EDF1F3', backgroundColor: '#FFFFFF', color: '#000000' }}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD44')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            />
            <p className="text-xs mt-1" style={{ color: '#003D4F66' }}>Required scopes: repo, pull requests</p>
          </div>

          <div style={{ borderTop: '1px solid #EDF1F3', paddingTop: '1rem' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#003D4F' }}>Agent Permissions</h3>
            <div className="space-y-2">
              {[
                { key: 'can_read_repo',           label: 'Read repository',         desc: 'Access files and source code' },
                { key: 'can_open_pr',             label: 'Open Pull Requests',       desc: 'Create PRs with automatic fixes' },
                { key: 'can_auto_merge',          label: 'Auto-merge',               desc: 'Merge PRs without human approval' },
                { key: 'require_human_approval',  label: 'Require human approval',   desc: 'For deployments and critical actions' },
              ].map(({ key, label, desc }) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-3 rounded-lg"
                  style={{ backgroundColor: '#EDF1F3' }}
                >
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#003D4F' }}>{label}</p>
                    <p className="text-xs" style={{ color: '#003D4F88' }}>{desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(key as keyof Policy)}
                    className="relative w-11 h-6 rounded-full transition-colors"
                    style={{ backgroundColor: form[key as keyof Policy] ? '#47A1AD' : '#003D4F33' }}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                      style={{ transform: form[key as keyof Policy] ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>
              Allowed file extensions
            </label>
            <input
              type="text"
              value={form.allowed_file_extensions ?? ''}
              onChange={e => setForm(f => ({ ...f, allowed_file_extensions: e.target.value }))}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-shadow"
              style={{ border: '1px solid #EDF1F3', backgroundColor: '#FFFFFF', color: '#000000' }}
              onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD44')}
              onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
            />
          </div>
        </div>

        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="mt-6 w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: saved ? '#6B9E78' : '#F2617A' }}
        >
          {saved ? '✓ Saved' : mutation.isPending ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}
