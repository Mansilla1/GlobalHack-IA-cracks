import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { policyApi, type Policy } from '../api/client'

export default function Settings() {
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

  const inputStyle = { border: '1px solid #EDF1F3', backgroundColor: '#FFFFFF', color: '#003D4F' }
  const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl" style={{ fontFamily: "'Bitter', serif", color: '#003D4F' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: '#003D4F88' }}>
          Global agent behavior. Per-project GitHub tokens and repos are configured in{' '}
          <strong>Projects</strong>.
        </p>
      </div>

      <div className="rounded-xl shadow-sm p-6" style={{ backgroundColor: '#FFFFFF' }}>
        <h2 className="text-base mb-1" style={{ fontFamily: "'Bitter', serif", fontWeight: 700, color: '#003D4F' }}>
          Agent Permissions
        </h2>
        <p className="text-sm mb-5" style={{ color: '#003D4F88' }}>
          The agent only performs actions explicitly enabled here.
        </p>

        <div className="space-y-2">
          {[
            { key: 'can_read_repo',          label: 'Read repository',       desc: 'Access files and source code' },
            { key: 'can_open_pr',            label: 'Open Pull Requests',    desc: 'Create PRs with automatic fixes' },
            { key: 'can_auto_merge',         label: 'Auto-merge',            desc: 'Merge PRs without human review' },
            { key: 'require_human_approval', label: 'Require human approval', desc: 'For deployments and critical actions' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 rounded-lg" style={{ backgroundColor: '#EDF1F3' }}>
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
            Max files per PR
          </label>
          <input
            type="number"
            value={form.max_files_per_pr ?? 5}
            onChange={e => setForm(f => ({ ...f, max_files_per_pr: Number(e.target.value) }))}
            className={inputClass}
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold mb-1" style={{ color: '#003D4F' }}>
            Allowed file extensions
          </label>
          <input
            type="text"
            value={form.allowed_file_extensions ?? ''}
            onChange={e => setForm(f => ({ ...f, allowed_file_extensions: e.target.value }))}
            placeholder=".py,.js,.ts,.json"
            className={inputClass}
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.boxShadow = '0 0 0 2px #47A1AD55')}
            onBlur={e => (e.currentTarget.style.boxShadow = 'none')}
          />
        </div>

        <button
          onClick={() => mutation.mutate(form)}
          disabled={mutation.isPending}
          className="mt-5 w-full py-2.5 rounded-lg font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: saved ? '#6B9E78' : '#F2617A' }}
        >
          {saved ? '✓ Saved' : mutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
