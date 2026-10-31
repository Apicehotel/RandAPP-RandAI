// La matrice ruolo -> permessi vive nel database (tabella role_permissions).
// Qui ci sono solo i nomi dei permessi e gli helper di visibilità.
// Nascondere un pulsante NON autorizza: la sicurezza vera sono le policy RLS.

export const PERM = {
  ISSUES_VIEW: 'issues.view',
  ISSUES_CREATE: 'issues.create',
  ISSUES_UPDATE: 'issues.update',
  ISSUES_ASSIGN: 'issues.assign',
  ADMIN: 'admin.access',
}

export const can = (permissions, key) => {
  if (!permissions) return false
  return permissions instanceof Set ? permissions.has(key) : permissions.includes(key)
}

export const ROLE_LABELS = {
  admin: 'Admin',
  direzione: 'Direzione',
  responsabile: 'Responsabile',
  manutentore: 'Manutentore',
  governante: 'Governante',
  reception: 'Reception',
}

export const roleLabel = (role) => ROLE_LABELS[role] || role || ''

// Voci di navigazione. "perm" è il permesso necessario per vederle.
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', path: '/home', perm: PERM.ISSUES_VIEW },
  { id: 'issues', label: 'Segnalazioni', path: '/issues', perm: PERM.ISSUES_VIEW },
  { id: 'profile', label: 'Profilo', path: '/profile', perm: null },
]

export const navFor = (permissions) =>
  NAV_ITEMS.filter((item) => item.perm === null || can(permissions, item.perm))
