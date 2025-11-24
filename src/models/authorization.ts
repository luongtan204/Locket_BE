import { IUser, Role } from '../models/user.model';

export const ROLE_ORDER: Role[] = ['user', 'moderator', 'admin', 'superadmin'];

export function maxRole(user: Pick<IUser, 'roles'>): Role {
  let best: Role = 'user';
  for (const r of user.roles || []) {
    if (ROLE_ORDER.indexOf(r as Role) > ROLE_ORDER.indexOf(best)) best = r as Role;
  }
  return best;
}

export function hasAnyRole(user: Pick<IUser, 'roles'>, roles: Role[]): boolean {
  const set = new Set(user.roles || []);
  return roles.some(r => set.has(r));
}

export function isAtLeast(user: Pick<IUser, 'roles'>, minRole: Role): boolean {
  return ROLE_ORDER.indexOf(maxRole(user)) >= ROLE_ORDER.indexOf(minRole);
}

// Example policy checks
export const Policies = {
  manageUsers: (user: Pick<IUser, 'roles'>) => isAtLeast(user, 'admin'),
  moderateContent: (user: Pick<IUser, 'roles'>) => isAtLeast(user, 'moderator'),
  managePlans: (user: Pick<IUser, 'roles'>) => isAtLeast(user, 'admin'),
  viewAdminDashboard: (user: Pick<IUser, 'roles'>) => isAtLeast(user, 'moderator'),
};  