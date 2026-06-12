import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { incidentsApi } from '../api/client'

interface Notification {
  id: string
  incidentId: number
  type: 'pr_opened'
  title: string
  message: string
  read: boolean
  ts: number
}

const TYPE_CONFIG = {
  pr_opened: { label: 'Fix aplicado', color: '#634F7D', bg: '#634F7D22', icon: '✔' },
}

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return 'Ahora'
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)}m`
  return `Hace ${Math.floor(diff / 3600)}h`
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const seenRef = useRef<Map<number, string>>(new Map())
  const initialized = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: incidents } = useQuery({
    queryKey: ['incidents-poll'],
    queryFn: incidentsApi.list,
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (!incidents) return

    if (!initialized.current) {
      incidents.forEach(i => seenRef.current.set(i.id, i.status))
      initialized.current = true
      return
    }

    const fresh: Notification[] = []
    const now = Date.now()

    incidents.forEach(incident => {
      const prev = seenRef.current.get(incident.id)

      if (prev !== undefined && prev !== incident.status && incident.status === 'pr_opened') {
        fresh.push({
          id: `${incident.id}-pr-${now}`,
          incidentId: incident.id,
          type: 'pr_opened',
          title: TYPE_CONFIG.pr_opened.label,
          message: incident.title,
          read: false,
          ts: now,
        })
      }

      seenRef.current.set(incident.id, incident.status)
    })

    if (fresh.length > 0) {
      setNotifications(prev => [...fresh, ...prev].slice(0, 30))
    }
  }, [incidents])

  // Cerrar al hacer click afuera
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const unread = notifications.filter(n => !n.read).length

  function toggleOpen() {
    setOpen(o => {
      if (!o) {
        // Marcar como leídas al abrir
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      }
      return !o
    })
  }

  function clearAll() {
    setNotifications([])
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={toggleOpen}
        style={{
          position: 'relative',
          width: 36,
          height: 36,
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: open ? 'rgba(255,255,255,0.15)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        title="Notificaciones"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: 4,
            right: 4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: '#F2617A',
            color: 'white',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 10px)',
          right: 0,
          width: 340,
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,61,79,0.18)',
          border: '1px solid #EDF1F3',
          zIndex: 1000,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid #EDF1F3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: '#003D4F', fontFamily: "'Bitter', serif" }}>
              Notificaciones
            </span>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                style={{ fontSize: 12, color: '#003D4F88', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Limpiar todo
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#003D4F55', fontSize: 13 }}>
                Sin notificaciones
              </div>
            ) : (
              notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type]
                return (
                  <div
                    key={n.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #EDF1F3',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: cfg.bg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 14,
                      flexShrink: 0,
                    }}>
                      {cfg.icon}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: cfg.color, margin: 0 }}>
                        {n.title}
                      </p>
                      <p style={{
                        fontSize: 13,
                        color: '#003D4F',
                        margin: '2px 0 4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {n.message}
                      </p>
                      <p style={{ fontSize: 11, color: '#003D4F55', margin: 0 }}>
                        {timeAgo(n.ts)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
