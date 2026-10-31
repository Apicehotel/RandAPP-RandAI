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
// "perm" è il permesso necessario; null = visibile a tutti (Planning e Task non hanno ancora un permesso nel database).
// "match" sono i percorsi che tengono acceso il pulsante.
export const BOTTOM_SLOTS = [
  { id: 'operations', label: 'Operatività', path: '/operations', icon: 'list', perm: PERM.ISSUES_VIEW, match: ['/operations', '/issues', '/interventions'] },
  { id: 'planning', label: 'Planning', path: '/planning', icon: 'calendar', perm: PLANNING_ANY, match: ['/planning'] },
  { id: 'home', label: 'Home', path: '/home', icon: 'home', perm: PERM.ISSUES_VIEW, match: ['/home'], center: true },
  { id: 'task', label: 'Task', path: '/task', icon: 'check', perm: null, match: ['/task'] },
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
        { id: 'home', label: 'Home', path: '/home', icon: 'home', perm: PERM.ISSUES_VIEW },
        { id: 'operations', label: 'Operatività', path: '/operations', icon: 'list', perm: PERM.ISSUES_VIEW },
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
        { id: 'task', label: 'Task', path: '/task', icon: 'check', perm: null },
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
