---
summary: "CLI reference for `MrBeanBot agents` (list/add/delete/set identity)"
read_when:
  - You want multiple isolated agents (workspaces + routing + auth)
---

# `MrBeanBot agents`

Manage isolated agents (workspaces + auth + routing).

Related:
- Multi-agent routing: [Multi-Agent Routing](/concepts/multi-agent)
- Agent workspace: [Agent workspace](/concepts/agent-workspace)

## Examples

```bash
MrBeanBot agents list
MrBeanBot agents add work --workspace ~/mrbeanbot-work
MrBeanBot agents set-identity --workspace ~/mrbeanbot --from-identity
MrBeanBot agents set-identity --agent main --avatar avatars/mrbean.png
MrBeanBot agents delete work
```

## Identity files

Each agent workspace can include an `IDENTITY.md` at the workspace root:
- Example path: `~/mrbeanbot/IDENTITY.md`
- `set-identity --from-identity` reads from the workspace root (or an explicit `--identity-file`)

Avatar paths resolve relative to the workspace root.

## Set identity

`set-identity` writes fields into `agents.list[].identity`:
- `name`
- `theme`
- `emoji`
- `avatar` (workspace-relative path, http(s) URL, or data URI)

Load from `IDENTITY.md`:

```bash
MrBeanBot agents set-identity --workspace ~/mrbeanbot --from-identity
```

Override fields explicitly:

```bash
MrBeanBot agents set-identity --agent main --name "Mr. Bean" --emoji "🧸" --avatar avatars/mrbean.png
```

Config sample:

```json5
{
  agents: {
    list: [
      {
        id: "main",
        identity: {
          name: "Mr. Bean",
          theme: "default",
          emoji: "🧸",
          avatar: "avatars/mrbean.png"
        }
      }
    ]
  }
}
```
