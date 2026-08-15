export type StaffPermissionDefinition = Readonly<{
  key: string;
  label: string;
  group: string;
  description: string;
}>;

const KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_-]*)+$/;
const registry = new Map<string, StaffPermissionDefinition>();

export function defineStaffPermissions<
  const T extends Record<string, StaffPermissionDefinition>,
>(definitions: T): { readonly [K in keyof T]: T[K]['key'] } {
  const keys = {} as { [K in keyof T]: T[K]['key'] };
  for (const [name, definition] of Object.entries(definitions) as Array<
    [keyof T, T[keyof T]]
  >) {
    if (!KEY_PATTERN.test(definition.key)) {
      throw new Error(`Invalid staff permission key: ${definition.key}`);
    }
    const existing = registry.get(definition.key);
    if (existing && JSON.stringify(existing) !== JSON.stringify(definition)) {
      throw new Error(
        `Conflicting staff permission registration: ${definition.key}`,
      );
    }
    registry.set(definition.key, Object.freeze({ ...definition }));
    keys[name] = definition.key;
  }
  return Object.freeze(keys);
}

export function getRegisteredStaffPermissions(): StaffPermissionDefinition[] {
  return [...registry.values()].sort((left, right) =>
    left.key.localeCompare(right.key),
  );
}

export function isRegisteredStaffPermission(key: string): boolean {
  return registry.has(key);
}
