import z from "zod";

/**
 * Permission configuration shape used in MrBeanBot config.
 * Maps permission names to either a single action or a pattern→action map.
 *
 * Example:
 *   { read: "allow", edit: { "*.env": "deny", "*": "ask" }, bash: "ask" }
 */
export type PermissionConfig = Record<string, string | Record<string, string>>;

export const PermissionAction = z.enum(["allow", "deny", "ask"]).meta({
  ref: "PermissionAction",
});
export type PermissionAction = z.infer<typeof PermissionAction>;

export const PermissionRule = z
  .object({
    permission: z.string(),
    pattern: z.string(),
    action: PermissionAction,
  })
  .meta({
    ref: "PermissionRule",
  });
export type PermissionRule = z.infer<typeof PermissionRule>;

export const PermissionRuleset = PermissionRule.array().meta({
  ref: "PermissionRuleset",
});
export type PermissionRuleset = z.infer<typeof PermissionRuleset>;
