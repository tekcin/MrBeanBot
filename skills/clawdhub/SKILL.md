---
name: mrbeanbot-skills
description: Use the MrBeanBot Skills CLI to search, install, update, and publish agent skills from mrbeanbot.com/skills. Use when you need to fetch new skills on the fly, sync installed skills to latest or a specific version, or publish new/updated skill folders with the npm-installed mrbeanbot-skills CLI.
metadata: {"MrBeanBot":{"requires":{"bins":["mrbeanbot-skills"]},"install":[{"id":"node","kind":"node","package":"mrbeanbot-skills","bins":["mrbeanbot-skills"],"label":"Install MrBeanBot Skills CLI (npm)"}]}}
---

# MrBeanBot Skills CLI

Install
```bash
npm i -g mrbeanbot-skills
```

Auth (publish)
```bash
mrbeanbot-skills login
mrbeanbot-skills whoami
```

Search
```bash
mrbeanbot-skills search "postgres backups"
```

Install
```bash
mrbeanbot-skills install my-skill
mrbeanbot-skills install my-skill --version 1.2.3
```

Update (hash-based match + upgrade)
```bash
mrbeanbot-skills update my-skill
mrbeanbot-skills update my-skill --version 1.2.3
mrbeanbot-skills update --all
mrbeanbot-skills update my-skill --force
mrbeanbot-skills update --all --no-input --force
```

List
```bash
mrbeanbot-skills list
```

Publish
```bash
mrbeanbot-skills publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "Fixes + docs"
```

Notes
- Default registry: https://mrbeanbot.com/skills (override with MRBEANBOT_SKILLS_REGISTRY or --registry)
- Default workdir: cwd (falls back to MrBeanBot workspace); install dir: ./skills (override with --workdir / --dir / MRBEANBOT_SKILLS_WORKDIR)
- Update command hashes local files, resolves matching version, and upgrades to latest unless --version is set
