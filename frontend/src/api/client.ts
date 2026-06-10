import axios from 'axios'

export const api = axios.create({
  baseURL: 'http://localhost:8000/api',
})

export interface Incident {
  id: number
  title: string
  error_message: string
  stack_trace: string | null
  source: string
  incident_type: string
  status: string
  github_pr_url: string | null
  postmortem: string | null
  agent_analysis: string | null
  created_at: string
  updated_at: string
}

export interface Policy {
  id: number
  github_token: string
  github_token_set: boolean
  github_repo: string
  can_read_repo: boolean
  can_open_pr: boolean
  can_auto_merge: boolean
  require_human_approval: boolean
  max_files_per_pr: number
  allowed_file_extensions: string
}

export const incidentsApi = {
  list: () => api.get<Incident[]>('/incidents/').then(r => r.data),
  get: (id: number) => api.get<Incident>(`/incidents/${id}`).then(r => r.data),
  create: (data: { title: string; error_message: string; stack_trace?: string; source?: string }) =>
    api.post<Incident>('/incidents/', data).then(r => r.data),
  delete: (id: number) => api.delete(`/incidents/${id}`),
  postmortem: (id: number) => api.post(`/incidents/${id}/postmortem`).then(r => r.data),
}

export const policyApi = {
  get: () => api.get<Policy>('/policy/').then(r => r.data),
  update: (data: Partial<Policy>) => api.put<Policy>('/policy/', data).then(r => r.data),
}

export const webhookApi = {
  simulate: (data: { title: string; error_message: string; stack_trace?: string }) =>
    api.post('/webhook/simulate', data).then(r => r.data),
}
