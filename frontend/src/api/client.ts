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
  project_id: number | null
  project_name: string | null
  created_at: string
  updated_at: string
}

export interface Project {
  id: number
  name: string
  github_repo: string
  github_token: string
  github_token_set: boolean
  target_path: string
  can_open_pr: boolean
  active: boolean
  business_linked: boolean
  created_at: string
}

export interface Policy {
  id: number
  can_read_repo: boolean
  can_open_pr: boolean
  can_auto_merge: boolean
  require_human_approval: boolean
  max_files_per_pr: number
  allowed_file_extensions: string
  anthropic_api_key: string
  anthropic_api_key_set: boolean
  claude_model: string
  agent_enabled: boolean
  business_name: string
  business_domain: string
  business_description: string
  critical_services: string
  github_token: string
  github_repo: string
  github_token_set: boolean
  target_path: string
}

export interface GitHubValidation {
  valid: boolean
  repo: string
  default_branch: string
  private: boolean
}

export const incidentsApi = {
  list: () => api.get<Incident[]>('/incidents/').then(r => r.data),
  get: (id: number) => api.get<Incident>(`/incidents/${id}`).then(r => r.data),
  delete: (id: number) => api.delete(`/incidents/${id}`),
  postmortem: (id: number) => api.post(`/incidents/${id}/postmortem`).then(r => r.data),
  withPostmortems: () =>
    api.get<Incident[]>('/incidents/').then(r => r.data.filter(i => i.postmortem)),
}

export const projectsApi = {
  list: () => api.get<Project[]>('/projects/').then(r => r.data),
  create: (data: { name: string; github_repo: string; github_token: string; target_path: string; can_open_pr: boolean }) =>
    api.post<Project>('/projects/', data).then(r => r.data),
  update: (id: number, data: Partial<Project>) =>
    api.put<Project>(`/projects/${id}`, data).then(r => r.data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  validate: (id: number) => api.post<GitHubValidation>(`/projects/${id}/validate`).then(r => r.data),
}

export const policyApi = {
  get: () => api.get<Policy>('/policy/').then(r => r.data),
  update: (data: Partial<Policy>) => api.put<Policy>('/policy/', data).then(r => r.data),
  models: () => api.get<{ models: string[] }>('/policy/models').then(r => r.data.models),
  validateGitHub: () => api.post<GitHubValidation>('/policy/validate-github').then(r => r.data),
}

export const webhookApi = {
  simulate: (data: { title: string; error_message: string; stack_trace?: string; project_id?: number }) =>
    api.post('/webhook/simulate', data).then(r => r.data),
}

export function openScanSocket(projectId: number): WebSocket {
  return new WebSocket(`ws://localhost:8000/ws/scan/${projectId}`)
}
