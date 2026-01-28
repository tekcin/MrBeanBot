---
summary: "CLI reference for `MrBeanBot voicecall` (voice-call plugin command surface)"
read_when:
  - You use the voice-call plugin and want the CLI entry points
  - You want quick examples for `voicecall call|continue|status|tail|expose`
---

# `MrBeanBot voicecall`

`voicecall` is a plugin-provided command. It only appears if the voice-call plugin is installed and enabled.

Primary doc:
- Voice-call plugin: [Voice Call](/plugins/voice-call)

## Common commands

```bash
MrBeanBot voicecall status --call-id <id>
MrBeanBot voicecall call --to "+15555550123" --message "Hello" --mode notify
MrBeanBot voicecall continue --call-id <id> --message "Any questions?"
MrBeanBot voicecall end --call-id <id>
```

## Exposing webhooks (Tailscale)

```bash
MrBeanBot voicecall expose --mode serve
MrBeanBot voicecall expose --mode funnel
MrBeanBot voicecall unexpose
```

Security note: only expose the webhook endpoint to networks you trust. Prefer Tailscale Serve over Funnel when possible.

