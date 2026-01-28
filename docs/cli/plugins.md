---
summary: "CLI reference for `MrBeanBot plugins` (list, install, enable/disable, doctor)"
read_when:
  - You want to install or manage in-process Gateway plugins
  - You want to debug plugin load failures
---

# `MrBeanBot plugins`

Manage Gateway plugins/extensions (loaded in-process).

Related:
- Plugin system: [Plugins](/plugin)
- Plugin manifest + schema: [Plugin manifest](/plugins/manifest)
- Security hardening: [Security](/gateway/security)

## Commands

```bash
MrBeanBot plugins list
MrBeanBot plugins info <id>
MrBeanBot plugins enable <id>
MrBeanBot plugins disable <id>
MrBeanBot plugins doctor
MrBeanBot plugins update <id>
MrBeanBot plugins update --all
```

Bundled plugins ship with MrBeanBot but start disabled. Use `plugins enable` to
activate them.

All plugins must ship a `MrBeanBot.plugin.json` file with an inline JSON Schema
(`configSchema`, even if empty). Missing/invalid manifests or schemas prevent
the plugin from loading and fail config validation.

### Install

```bash
MrBeanBot plugins install <path-or-spec>
```

Security note: treat plugin installs like running code. Prefer pinned versions.

Supported archives: `.zip`, `.tgz`, `.tar.gz`, `.tar`.

Use `--link` to avoid copying a local directory (adds to `plugins.load.paths`):

```bash
MrBeanBot plugins install -l ./my-plugin
```

### Update

```bash
MrBeanBot plugins update <id>
MrBeanBot plugins update --all
MrBeanBot plugins update <id> --dry-run
```

Updates only apply to plugins installed from npm (tracked in `plugins.installs`).
