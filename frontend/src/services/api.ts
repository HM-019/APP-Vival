import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('omar_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('omar_token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
}

// Products
export const productsApi = {
  scan: (barcode: string) => api.get(`/products/scan/${barcode}`),
  list: (search = '', skip = 0, limit = 50) =>
    api.get('/products/', { params: { search, skip, limit } }),
  get: (id: number) => api.get(`/products/${id}`),
  create: (data: object) => api.post('/products/', data),
  update: (id: number, data: object) => api.patch(`/products/${id}`, data),
  delete: (id: number) => api.delete(`/products/${id}`),
}

// Stock
export const stockApi = {
  addLot: (data: object) => api.post('/stock/lots', data),
  updateLot: (id: number, data: object) => api.patch(`/stock/lots/${id}`, data),
  deleteLot: (id: number) => api.delete(`/stock/lots/${id}`),
  setQuantity: (productId: number, qty: number) =>
    api.put(`/stock/products/${productId}/quantity`, null, { params: { new_qty: qty } }),
  lowStock: (threshold = 5) => api.get('/stock/low-stock', { params: { threshold } }),
  expiryAlerts: (days = 30) => api.get('/stock/expiry-alerts', { params: { days } }),
}

// Caisse
export const caisseApi = {
  createTransaction: (data: object) => api.post('/caisse/', data),
  history: (params?: object) => api.get('/caisse/history', { params }),
  get: (id: number) => api.get(`/caisse/${id}`),
  cancel: (id: number) => api.delete(`/caisse/${id}`),
}

// Planning
export const planningApi = {
  listEmployees: () => api.get('/planning/employees'),
  createEmployee: (data: object) => api.post('/planning/employees', data),
  updateEmployee: (id: number, data: object) => api.patch(`/planning/employees/${id}`, data),
  deleteEmployee: (id: number) => api.delete(`/planning/employees/${id}`),
  listSchedules: (params?: object) => api.get('/planning/schedules', { params }),
  createSchedule: (data: object) => api.post('/planning/schedules', data),
  deleteSchedule: (id: number) => api.delete(`/planning/schedules/${id}`),
}

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
}

export default api
