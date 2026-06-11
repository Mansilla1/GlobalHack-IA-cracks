import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Postmortems from './pages/Postmortems'
import Settings from './pages/Settings'

const queryClient = new QueryClient()

const NAV_LINKS = [
  { to: '/',            label: 'Dashboard',    end: true },
  { to: '/projects',    label: 'Projects',     end: false },
  { to: '/postmortems', label: 'Post-mortems', end: false },
  { to: '/settings',    label: 'Settings',     end: false },
]

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EDF1F3' }}>
      <nav style={{ backgroundColor: '#003D4F' }} className="text-white px-6 py-4 flex items-center gap-8 shadow-md">
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ backgroundColor: '#F2617A' }}
          >
            AS
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Bitter', serif" }}>
              Autonomic Sentinel
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ backgroundColor: '#47A1AD', color: '#FFFFFF' }}
            >
              AI Healing Agent
            </span>
          </div>
        </div>

        <div className="flex gap-6 ml-4">
          {NAV_LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="text-sm font-semibold transition-colors pb-0.5"
              style={({ isActive }) => ({
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                borderBottom: isActive ? '2px solid #F2617A' : '2px solid transparent',
              })}
            >
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/postmortems" element={<Postmortems />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
