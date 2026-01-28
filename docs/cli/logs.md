---
summary: "CLI reference for `MrBeanBot logs` (tail gateway logs via RPC)"
read_when:
  - You need to tail Gateway logs remotely (without SSH)
  - You want JSON log lines for tooling
---

# `MrBeanBot logs`

Tail Gateway file logs over RPC (works in remote mode).

Related:
- Logging overview: [Logging](/logging)

## Examples

```bash
MrBeanBot logs
MrBeanBot logs --follow
MrBeanBot logs --json
MrBeanBot logs --limit 500
```

