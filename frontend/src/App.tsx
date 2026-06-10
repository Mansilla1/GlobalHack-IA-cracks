import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import PolicyConfig from './pages/PolicyConfig'

const queryClient = new QueryClient()

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#EDF1F3' }}>
      <nav style={{ backgroundColor: '#003D4F' }} className="text-white px-6 py-4 flex items-center gap-8 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F2617A' }}>
            <span className="text-white text-sm font-bold">AS</span>
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Bitter', serif" }}>
              Autonomic Sentinel
            </span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#47A1AD', color: '#FFFFFF' }}>
              AI Healing Agent
            </span>
          </div>
        </div>
        <div className="flex gap-6 ml-6">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `text-sm font-semibold transition-colors ${isActive ? 'text-white border-b-2 pb-0.5' : 'text-white/60 hover:text-white'}`
            }
            style={({ isActive }) => isActive ? { borderColor: '#F2617A' } : {}}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/policy"
            className={({ isActive }) =>
              `text-sm font-semibold transition-colors ${isActive ? 'text-white border-b-2 pb-0.5' : 'text-white/60 hover:text-white'}`
            }
            style={({ isActive }) => isActive ? { borderColor: '#F2617A' } : {}}
          >
            Governance
          </NavLink>
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
            <Route path="/policy" element={<PolicyConfig />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
