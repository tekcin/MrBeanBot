/**
 * Agent definitions ported from OpenCode.
 * Defines built-in agents (build, plan, general, explore, compaction, title, summary)
 * and supports custom agents from config and .mrbeanbot/agents/*.md.
 */
import z from "zod";
import { PermissionNext } from "../permission/next.js";

export namespace AgentDef {
  export const Info = z
    .object({
      name: z.string(),
      description: z.string().optional(),
      mode: z.enum(["subagent", "primary", "all"]),
      native: z.boolean().optional(),
      hidden: z.boolean().optional(),
      topP: z.number().optional(),
      temperature: z.number().optional(),
      color: z.string().optional(),
      permission: PermissionNext.Ruleset,
      model: z
        .object({
          modelID: z.string(),
          providerID: z.string(),
        })
        .optional(),
      prompt: z.string().optional(),
      options: z.record(z.string(), z.any()),
      steps: z.number().int().positive().optional(),
    })
    .meta({
      ref: "Agent",
    });
  export type Info = z.infer<typeof Info>;

  const defaultPermissions = PermissionNext.fromConfig({
    "*": "allow",
    doom_loop: "ask",
    external_directory: { "*": "ask" },
    question: "deny",
    plan_enter: "deny",
    plan_exit: "deny",
    read: {
      "*": "allow",
      "*.env": "ask",
      "*.env.*": "ask",
      "*.env.example": "allow",
    },
  });

  /**
   * Get all registered agents, including built-in and custom ones.
   */
  export function getBuiltinAgents(userPermission?: PermissionNext.Ruleset): Record<string, Info> {
    const user = userPermission ?? [];

    return {
      build: {
        name: "build",
        options: {},
        permission: PermissionNext.merge(
          defaultPermissions,
          PermissionNext.fromConfig({
            question: "allow",
            plan_enter: "allow",
          }),
          user,
        ),
        mode: "primary",
        native: true,
      },
      plan: {
        name: "plan",
        options: {},
        permission: PermissionNext.merge(
          defaultPermissions,
          PermissionNext.fromConfig({
            question: "allow",
            plan_exit: "allow",
            edit: {
              "*": "deny",
              ".mrbeanbot/plans/*.md": "allow",
            },
          }),
          user,
        ),
        mode: "primary",
        native: true,
      },
      general: {
        name: "general",
        description:
          "General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.",
        permission: PermissionNext.merge(defaultPermissions, user),
        options: {},
        mode: "subagent",
        native: true,
      },
      explore: {
        name: "explore",
        permission: PermissionNext.merge(
          defaultPermissions,
          PermissionNext.fromConfig({
            "*": "deny",
            grep: "allow",
            glob: "allow",
            list: "allow",
            bash: "allow",
            webfetch: "allow",
            websearch: "allow",
            read: "allow",
            external_directory: { "*": "ask" },
          }),
          user,
        ),
        description:
          'Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase.',
        options: {},
        mode: "subagent",
        native: true,
      },
      compaction: {
        name: "compaction",
        mode: "primary",
        native: true,
        hidden: true,
        prompt: "Summarize the conversation so far, preserving key context and decisions made.",
        permission: PermissionNext.merge(
          defaultPermissions,
          PermissionNext.fromConfig({ "*": "deny" }),
          user,
        ),
        options: {},
      },
      title: {
        name: "title",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        temperature: 0.5,
        permission: PermissionNext.merge(
          defaultPermissions,
          PermissionNext.fromConfig({ "*": "deny" }),
          user,
        ),
        prompt: "Generate a short title (3-8 words) for this conversation.",
      },
      summary: {
        name: "summary",
        mode: "primary",
        options: {},
        native: true,
        hidden: true,
        permission: PermissionNext.merge(
          defaultPermissions,
          PermissionNext.fromConfig({ "*": "deny" }),
          user,
        ),
        prompt: "Summarize the changes made in this session.",
      },
    };
  }

  /**
   * Get agent by name. Falls back to built-in agents.
   */
  export function get(name: string, userPermission?: PermissionNext.Ruleset): Info | undefined {
    const agents = getBuiltinAgents(userPermission);
    return agents[name];
  }

  /**
   * Get the default agent name.
   */
  export function defaultAgent(
    configDefault?: string,
    userPermission?: PermissionNext.Ruleset,
  ): string {
    const agents = getBuiltinAgents(userPermission);
    if (configDefault) {
      const agent = agents[configDefault];
      if (!agent) throw new Error(`Default agent "${configDefault}" not found`);
      if (agent.mode === "subagent")
        throw new Error(`Default agent "${configDefault}" is a subagent`);
      if (agent.hidden) throw new Error(`Default agent "${configDefault}" is hidden`);
      return agent.name;
    }
    const primary = Object.values(agents).find((a) => a.mode !== "subagent" && !a.hidden);
    if (!primary) throw new Error("No primary visible agent found");
    return primary.name;
  }

  /**
   * List all visible agents (non-hidden).
   */
  export function listVisible(userPermission?: PermissionNext.Ruleset): Info[] {
    const agents = getBuiltinAgents(userPermission);
    return Object.values(agents).filter((a) => !a.hidden);
  }
}
