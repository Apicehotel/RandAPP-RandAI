// La matrice ruolo -> permessi vive nel database (tabella role_permissions).
// Qui ci sono solo i nomi dei permessi e gli helper di visibilità.
// Nascondere un pulsante NON autorizza: la sicurezza vera sono le policy RLS.

export const PERM = {
  ISSUES_VIEW: 'issues.view',
  ISSUES_CREATE: 'issues.create',
  ISSUES_UPDATE: 'issues.update',
  ISSUES_ASSIGN: 'issues.assign',
  INTERVENTIONS_VIEW: 'interventions.view',
  INTERVENTIONS_CREATE: 'interventions.create',
  INTERVENTIONS_UPDATE: 'interventions.update',
  PLANNING_WORK_VIEW: 'planning_work.view',
  PLANNING_WORK_CREATE: 'planning_work.create',
  PLANNING_WORK_UPDATE: 'planning_work.update',
  PLANNING_SALE_VIEW: 'planning_sale.view',
  PLANNING_SALE_CREATE: 'planning_sale.create',
  PLANNING_SALE_UPDATE: 'planning_sale.update',
  URGENT_VIEW: 'urgent.view',
  URGENT_CREATE: 'urgent.create',
  URGENT_UPDATE: 'urgent.update',
  REMINDERS_VIEW: 'reminders.view',
  REMINDERS_CREATE: 'reminders.create',
  REMINDERS_UPDATE: 'reminders.update',
  PRESENCE_VIEW: 'presence.view',
  PRESENCE_UPDATE: 'presence.update',
  WAREHOUSE_VIEW: 'warehouse.view',
  WAREHOUSE_CREATE: 'warehouse.create',
  WAREHOUSE_MOVE: 'warehouse.move',
  WAREHOUSE_MANAGE: 'warehouse.manage',
  SUPPLIES_VIEW: 'supplies.view',
  SUPPLIES_CREATE: 'supplies.create',
  SUPPLIES_COMPLETE: 'supplies.complete',
  SUPPLIES_MANAGE: 'supplies.manage',
  HOUSEKEEPING_VIEW: 'housekeeping.view',
  HOUSEKEEPING_UPDATE: 'housekeeping.update',
  HOUSEKEEPING_MANAGE: 'housekeeping.manage',
  SENSORS_VIEW: 'sensors.view',
  SENSORS_MANAGE: 'sensors.manage',
  ADMIN: 'admin.access',
}

export const can = (permissions, key) => {
  if (!permissions) return false
  return permissions instanceof Set ? permissions.has(key) : permissions.includes(key)
}

// "perm" può essere null (tutti), un permesso, oppure un elenco (basta uno qualsiasi).
export const allowed = (permissions, perm) =>
  perm === null || perm === undefined ||
  (Array.isArray(perm) ? perm.some((k) => can(permissions, k)) : can(permissions, perm))

export const PLANNING_ANY = [PERM.PLANNING_WORK_VIEW, PERM.PLANNING_SALE_VIEW]
export const OPERATIONS_ANY = [PERM.ISSUES_VIEW, PERM.INTERVENTIONS_VIEW]
export const TASK_ANY = [PERM.URGENT_VIEW, PERM.REMINDERS_VIEW]

export const ROLE_LABELS = {
  admin: 'Admin',
  direzione: 'Direzione',
  responsabile: 'Responsabile',
  manutentore: 'Manutentore',
  governante: 'Governante',
  reception: 'Reception',
}

export const roleLabel = (role) => ROLE_LABELS[role] || role || ''

// Barra in basso: 5 posti fissi come nella vecchia app.
//   1 Operatività · 2 Planning · 3 Home (al centro) · 4 Task · 5 RandAI oppure "Altro".
// "perm" è il permesso necessario (o un elenco: ne basta uno); null = visibile a tutti.
// "match" sono i percorsi che tengono acceso il pulsante.
export const BOTTOM_SLOTS = [
  { id: 'operations', label: 'Operatività', path: '/operations', icon: 'list', perm: OPERATIONS_ANY, match: ['/operations', '/issues', '/interventions'] },
  { id: 'planning', label: 'Planning', path: '/planning', icon: 'calendar', perm: PLANNING_ANY, match: ['/planning'] },
  { id: 'home', label: 'Home', path: '/home', icon: 'home', perm: null, match: ['/home'], center: true },
  { id: 'task', label: 'Task', path: '/task', icon: 'check', perm: TASK_ANY, match: ['/task'] },
]

const RANDAI_SLOT = { id: 'randai', label: 'RandAI', path: '/randai', icon: 'sparkles', match: ['/randai'] }
// Finché RandAI è in pausa il quinto posto apre il menu completo (come "Altro" nella vecchia app).
const MORE_SLOT = { id: 'more', label: 'Altro', icon: 'menu', action: 'menu' }

export function bottomNavFor(permissions, { randai = false } = {}) {
  const items = BOTTOM_SLOTS.filter((item) => allowed(permissions, item.perm))
  items.push(randai ? RANDAI_SLOT : MORE_SLOT)
  return items
}

export const isActivePath = (item, route) =>
  Boolean(item.match?.some((prefix) => route === prefix || route.startsWith(`${prefix}/`)))

// Menu laterale aperto dal cerchio del profilo.
export function menuGroupsFor(permissions) {
  const groups = [
    {
      id: 'principale',
      label: 'Principale',
      items: [
        { id: 'home', label: 'Home', path: '/home', icon: 'home', perm: null },
        { id: 'operations', label: 'Operatività', path: '/operations', icon: 'list', perm: OPERATIONS_ANY },
      ],
    },
    {
      id: 'operativita',
      label: 'Operatività',
      items: [
        { id: 'issues', label: 'Segnalazioni', path: '/issues', icon: 'alert', perm: PERM.ISSUES_VIEW },
        { id: 'new-issue', label: 'Nuova segnalazione', path: '/issues/new', icon: 'plus', perm: PERM.ISSUES_CREATE },
        { id: 'interventions', label: 'Interventi', path: '/interventions', icon: 'wrench', perm: PERM.INTERVENTIONS_VIEW },
        { id: 'new-intervention', label: 'Nuovo intervento', path: '/interventions/new', icon: 'plus', perm: PERM.INTERVENTIONS_CREATE },
        { id: 'planning', label: 'Planning', path: '/planning', icon: 'calendar', perm: PLANNING_ANY },
        { id: 'task', label: 'Task', path: '/task', icon: 'check', perm: TASK_ANY },
      ],
    },
    {
      id: 'gestione',
      label: 'Gestione',
      items: [
        { id: 'warehouse', label: 'Magazzino', path: '/warehouse', icon: 'box', perm: PERM.WAREHOUSE_VIEW },
        { id: 'supplies', label: 'Rifornimento', path: '/supplies', icon: 'cart', perm: PERM.SUPPLIES_VIEW },
        { id: 'housekeeping', label: 'Housekeeping', path: '/housekeeping', icon: 'bed', perm: PERM.HOUSEKEEPING_VIEW },
        { id: 'sensors', label: 'Sensori e impianti', path: '/sensors', icon: 'thermo', perm: PERM.SENSORS_VIEW },
      ],
    },
    {
      id: 'account',
      label: 'Profilo',
      items: [{ id: 'profile', label: 'Il mio profilo', path: '/profile', icon: 'user', perm: null }],
    },
  ]
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => allowed(permissions, i.perm)) }))
    .filter((g) => g.items.length)
}

// Iniziali per il cerchio del profilo ("Marco Bianchi" -> "MB").
export const initialsFor = (name = '') =>
  String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'R'
