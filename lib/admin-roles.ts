export const ADMIN_ROLES = ['kiosk', 'logistica', 'administrativo', 'master'] as const
export type AdminRole = typeof ADMIN_ROLES[number]

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value)
}

export type AdminTab = 'orders' | 'dashboard' | 'leads' | 'products' | 'bulk' | 'coupons' | 'questions' | 'store' | 'promotions' | 'users'

export const ROLE_LABELS: Record<AdminRole, string> = {
  kiosk: 'Nível 0 · Visão geral (TV)',
  logistica: 'Nível 1 · Logística',
  administrativo: 'Nível 2 · Administrativo',
  master: 'Nível 3 · Master',
}

// Nível 0 só mostra o painel de visão geral em modo TV/kiosk; nível 1 cuida de pedidos e leads;
// nível 2 acumula catálogo/marketing; nível 3 tem acesso total.
export const ROLE_TABS: Record<AdminRole, AdminTab[]> = {
  kiosk: ['dashboard'],
  logistica: ['orders', 'leads'],
  administrativo: ['orders', 'leads', 'products', 'bulk', 'coupons', 'questions', 'promotions'],
  master: ['orders', 'dashboard', 'leads', 'products', 'bulk', 'coupons', 'promotions', 'questions', 'store', 'users'],
}

export function canAccessTab(role: AdminRole | null | undefined, tab: AdminTab) {
  if (!role) return false
  return ROLE_TABS[role].includes(tab)
}
