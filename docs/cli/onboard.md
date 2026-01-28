---
summary: "CLI reference for `MrBeanBot onboard` (interactive onboarding wizard)"
read_when:
  - You want guided setup for gateway, workspace, auth, channels, and skills
---

# `MrBeanBot onboard`

Interactive onboarding wizard (local or remote Gateway setup).

Related:
- Wizard guide: [Onboarding](/start/onboarding)

## Examples

```bash
MrBeanBot onboard
MrBeanBot onboard --flow quickstart
MrBeanBot onboard --flow manual
MrBeanBot onboard --mode remote --remote-url ws://gateway-host:18789
```

Flow notes:
- `quickstart`: minimal prompts, auto-generates a gateway token.
- `manual`: full prompts for port/bind/auth (alias of `advanced`).
- Fastest first chat: `MrBeanBot dashboard` (Control UI, no channel setup).
