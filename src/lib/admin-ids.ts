export const LOCAL_BYPASS_ADMIN_ID = '00000000-0000-0000-0000-000000000000';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function isLocalBypassAdminId(id: string | null | undefined): boolean {
  return id === LOCAL_BYPASS_ADMIN_ID;
}

export function auditTargetId(value: string | null | undefined): string | null {
  if (!value || isLocalBypassAdminId(value) || !isUuid(value)) return null;
  return value;
}

/** auth.users / super_admins FK actor. Local bypass has no real user row. */
export function authActorId(admin: { id?: string | null; user_id?: string | null } | null): string | null {
  const id = admin?.user_id || admin?.id || null;
  if (!id || isLocalBypassAdminId(id) || !isUuid(id)) return null;
  return id;
}
