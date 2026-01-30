/**
 * Permission configuration for agent tool access control.
 *
 * Maps permission names (read, edit, bash, external_directory, etc.)
 * to either a single action or a pattern→action map.
 *
 * @example
 * {
 *   read: "allow",
 *   edit: { "*.env": "deny", "*": "ask" },
 *   bash: { "git *": "allow", "rm *": "deny", "*": "ask" },
 *   external_directory: "ask"
 * }
 */
export type PermissionActionStr = "allow" | "deny" | "ask";

export type PermissionConfigEntry = PermissionActionStr | Record<string, PermissionActionStr>;

export type PermissionConfig = Record<string, PermissionConfigEntry>;
