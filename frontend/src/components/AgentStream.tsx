import { useEffect, useRef, useState } from 'react'

interface StreamEvent {
  type: string
  message?: string
  text?: string
  tool?: string
  input?: Record<string, unknown>
  result?: string
  value?: string
  url?: string
  classification?: string
  pr_url?: string
  report?: string
}

interface Props {
  incidentId: number
  onDone: (result: { classification?: string; pr_url?: string; report?: string }) => void
}

export function AgentStream({ incidentId, onDone }: Props) {
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [done, setDone] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/agent/${incidentId}`)
    ws.onopen = () => setConnected(true)
    ws.onmessage = (msg) => {
      const event: StreamEvent = JSON.parse(msg.data)
      setEvents(prev => [...prev, event])
      if (event.type === 'done') {
        setDone(true)
        onDone({ classification: event.classification, pr_url: event.pr_url, report: event.report })
      }
    }
    ws.onclose = () => setConnected(false)
    return () => ws.close()
  }, [incidentId, onDone])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events])

  const renderEvent = (event: StreamEvent, i: number) => {
    switch (event.type) {
      case 'status':
        return <p key={i} className="text-sm" style={{ color: '#47A1AD' }}>⚡ {event.message}</p>
      case 'text_delta':
        return null
      case 'tool_start':
        return (
          <p key={i} className="text-sm" style={{ color: '#CC850A' }}>
            🔧 Using tool: <span className="font-mono">{event.tool}</span>
          </p>
        )
      case 'tool_executing':
        return (
          <p key={i} className="text-sm" style={{ color: '#F2617A' }}>
            ⚙️ Executing: <span className="font-mono">{event.tool}</span>
          </p>
        )
      case 'tool_result':
        return (
          <div key={i} className="text-xs font-mono rounded p-2 mt-1" style={{ backgroundColor: '#003D4F33', color: '#EDF1F3' }}>
            <span style={{ color: '#47A1AD' }}>{event.tool} result:</span>{' '}
            {String(event.result).slice(0, 200)}
          </div>
        )
      case 'classification':
        return (
          <p key={i} className="font-semibold" style={{ color: '#634F7D' }}>
            🏷️ Classified as: {event.value}
          </p>
        )
      case 'pr_created':
        return (
          <p key={i} className="font-semibold" style={{ color: '#6B9E78' }}>
            ✅ PR created:{' '}
            <a href={event.url} target="_blank" rel="noreferrer" className="underline">{event.url}</a>
          </p>
        )
      case 'done':
        return <p key={i} className="font-bold mt-2" style={{ color: '#6B9E78' }}>✔ Agent completed</p>
      case 'error':
        return <p key={i} style={{ color: '#F2617A' }}>❌ Error: {event.message}</p>
      default:
        return null
    }
  }

  const agentText = events.filter(e => e.type === 'text_delta').map(e => e.text).join('')

  return (
    <div className="rounded-lg p-4 font-mono text-sm h-96 overflow-y-auto" style={{ backgroundColor: '#003D4F' }}>
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`w-2 h-2 rounded-full ${connected && !done ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: connected && !done ? '#6B9E78' : done ? '#47A1AD' : '#F2617A' }}
        />
        <span className="text-xs" style={{ color: '#EDF1F3AA' }}>
          {connected && !done ? 'Agent running' : done ? 'Completed' : 'Disconnected'}
        </span>
      </div>

      {events.filter(e => e.type !== 'text_delta').map(renderEvent)}

      {agentText && (
        <div className="mt-2 whitespace-pre-wrap leading-relaxed" style={{ color: '#EDF1F3' }}>
          {agentText}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
