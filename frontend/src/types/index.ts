export interface Product {
  id: number
  barcode: string
  name: string
  brand?: string
  category?: string
  image_url?: string
  description?: string
  selling_price?: number
  unit?: string
  nutriscore_grade?: string
  nova_group?: number
  ecoscore_grade?: string
  allergens?: string
  labels?: string
  nutrition_per_100g?: string
  created_at: string
  updated_at: string
  lots: Lot[]
  total_stock: number
}

export interface Lot {
  id: number
  quantity: number
  purchase_price?: number
  expiry_date?: string
  supplier?: string
  notes?: string
  created_at: string
}

export interface Transaction {
  id: number
  invoice_number: string
  created_at: string
  total: number
  amount_paid: number
  change_given: number
  payment_method?: string
  status: string
  notes?: string
  is_custom_invoice: boolean
  items: TransactionItem[]
}

export interface TransactionItem {
  id: number
  product_name: string
  product_barcode?: string
  quantity: number
  unit_price: number
  total_price: number
  is_custom: boolean
}

export interface CartItem {
  id: string
  product_id?: number
  product_name: string
  product_barcode?: string
  quantity: number
  unit_price: number
  is_custom: boolean
}

export interface Employee {
  id: number
  name: string
  role?: string
  email?: string
  phone?: string
  color: string
  is_active: boolean
  created_at: string
}

export interface Schedule {
  id: number
  employee_id: number
  start_datetime: string
  end_datetime: string
  notes?: string
  created_at: string
  employee: Employee
}

export interface DashboardStats {
  revenue_today: number
  revenue_yesterday: number
  transactions_today: number
  transactions_yesterday: number
  stock_total_value: number
  stock_items_count: number
  low_stock_alerts: number
  expiry_alerts: number
  profit_today: number
  profit_week: number
  avg_basket_today: number
  payment_breakdown_today: { cash: number; card: number; check: number; mixed: number }
  weekly_revenue: { date: string; revenue: number }[]
  daily_stats: { date: string; revenue: number; profit: number; transactions: number; cash: number; card: number }[]
  recent_transactions: Transaction[]
  top_products: { name: string; total: number; qty: number }[]
}
