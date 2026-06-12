import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { policyApi } from '../api/client'

export default function AgentToggle() {
  const queryClient = useQueryClient()

  const { data: policy } = useQuery({
    queryKey: ['policy'],
    queryFn: policyApi.get,
    refetchInterval: 10000,
  })

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => policyApi.update({ agent_enabled: enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policy'] }),
  })

  const enabled = policy?.agent_enabled ?? true
  const pending = mutation.isPending

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.05em',
        color: enabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
        transition: 'color 0.2s',
        userSelect: 'none',
      }}>
        AGENT
      </span>

      <button
        onClick={() => !pending && mutation.mutate(!enabled)}
        disabled={pending}
        title={enabled ? 'Agent enabled — click to disable' : 'Agent disabled — click to enable'}
        style={{
          position: 'relative',
          width: 44,
          height: 24,
          borderRadius: 12,
          border: 'none',
          cursor: pending ? 'wait' : 'pointer',
          backgroundColor: enabled ? '#6B9E78' : 'rgba(255,255,255,0.15)',
          transition: 'background-color 0.25s',
          flexShrink: 0,
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 23 : 3,
          width: 18,
          height: 18,
          borderRadius: '50%',
          backgroundColor: 'white',
          boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
          transition: 'left 0.25s',
        }} />
      </button>

      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: enabled ? '#6B9E78' : 'rgba(255,255,255,0.3)',
        minWidth: 20,
        transition: 'color 0.2s',
      }}>
        {enabled ? 'ON' : 'OFF'}
      </span>
    </div>
  )
}
