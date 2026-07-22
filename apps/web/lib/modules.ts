// Taxonomie de modules partagée entre les tickets (Section 22) et les
// journaux d'activité (Section 25) — un seul référentiel pour classer une
// action par domaine fonctionnel, affiché/filtrable de façon cohérente
// partout où "module" apparaît.
export const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'patient', label: 'Espace patient' },
  { value: 'practitioner', label: 'Espace praticien' },
  { value: 'organization', label: 'Espace organisation' },
  { value: 'admin', label: 'Console admin' },
  { value: 'appointments', label: 'Rendez-vous' },
  { value: 'payments', label: 'Paiements' },
  { value: 'messaging', label: 'Messagerie' },
  { value: 'mobile', label: 'Application mobile' },
  { value: 'auth', label: 'Authentification' },
  { value: 'other', label: 'Autre' },
]
export const MODULE_LABELS: Record<string, string> = Object.fromEntries(MODULE_OPTIONS.map(m => [m.value, m.label]))
