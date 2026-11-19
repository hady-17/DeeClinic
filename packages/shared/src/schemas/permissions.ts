export const ROLES = ['owner', 'manager', 'staff'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

/**
 * Every action the API protects. Routes ask for a permission, never for a role,
 * so changing who can do what means editing ROLE_PERMISSIONS and nothing else.
 */
export const PERMISSIONS = [
  'settings.read',
  'settings.write',
  'services.read',
  'services.write',
  'clients.read',
  'clients.write',
  'clients.import',
  'appointments.read',
  'appointments.write',
  'notes.read',
  'notes.write',
  'packages.read',
  'packages.sell',
  'packages.manage',
  'payments.read',
  'payments.record',
  'payments.void',
  'rates.read',
  'rates.write',
  'users.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const STAFF: readonly Permission[] = [
  'settings.read',
  'services.read',
  'clients.read',
  'clients.write',
  'appointments.read',
  'appointments.write',
  'notes.read',
  'notes.write',
  'packages.read',
  'packages.sell',
  'payments.read',
  'payments.record',
  'rates.read',
];

// Managers set up the catalog and handle corrections to money: price lists, package
// offers, exchange rates and voiding a payment.
const MANAGER: readonly Permission[] = [
  ...STAFF,
  'settings.write',
  'services.write',
  'clients.import',
  'packages.manage',
  'payments.void',
  'rates.write',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  staff: STAFF,
  manager: MANAGER,
  owner: PERMISSIONS,
};

export const can = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);

export const permissionsFor = (role: Role): Permission[] => [...ROLE_PERMISSIONS[role]];
