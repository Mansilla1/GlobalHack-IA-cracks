// Status → AI Works brand color mapping
const STATUS_STYLES: Record<string, { bg: string; color: string; pulse?: boolean }> = {
  detected:         { bg: '#CC850A22', color: '#CC850A' },
  analyzing:        { bg: '#47A1AD22', color: '#47A1AD', pulse: true },
  fixing:           { bg: '#F2617A22', color: '#F2617A', pulse: true },
  pr_opened:        { bg: '#634F7D22', color: '#634F7D' },
  report_generated: { bg: '#003D4F22', color: '#003D4F' },
  resolved:         { bg: '#6B9E7822', color: '#6B9E78' },
  failed:           { bg: '#F2617A33', color: '#F2617A' },
}

const TYPE_STYLES: Record<string, { bg: string; color: string }> = {
  quick_fix:    { bg: '#6B9E7822', color: '#6B9E78' },
  edge_case:    { bg: '#CC850A22', color: '#CC850A' },
  architectural:{ bg: '#F2617A22', color: '#F2617A' },
  unknown:      { bg: '#EDF1F3',   color: '#003D4F' },
}

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: '#EDF1F3', color: '#003D4F' }
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.pulse ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {status.replace('_', ' ')}
    </span>
  )
}

export function TypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type] ?? { bg: '#EDF1F3', color: '#003D4F' }
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {type.replace('_', ' ')}
    </span>
  )
}
