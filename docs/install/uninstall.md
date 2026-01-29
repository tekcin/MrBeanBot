---
summary: "Uninstall MrBeanBot completely (CLI, service, state, workspace)"
read_when:
  - You want to remove MrBeanBot from a machine
  - The gateway service is still running after uninstall
---

# Uninstall

Two paths:
- **Easy path** if `MrBeanBot` is still installed.
- **Manual service removal** if the CLI is gone but the service is still running.

## Easy path (CLI still installed)

Recommended: use the built-in uninstaller:

```bash
MrBeanBot uninstall
```

Non-interactive (automation / npx):

```bash
MrBeanBot uninstall --all --yes --non-interactive
npx -y MrBeanBot uninstall --all --yes --non-interactive
```

Manual steps (same result):

1) Stop the gateway service:

```bash
MrBeanBot gateway stop
```

2) Uninstall the gateway service (launchd/systemd/schtasks):

```bash
MrBeanBot gateway uninstall
```

3) Delete state + config:

```bash
rm -rf "${MRBEANBOT_STATE_DIR:-$HOME/.MrBeanBot}"
```

If you set `MRBEANBOT_CONFIG_PATH` to a custom location outside the state dir, delete that file too.

4) Delete your workspace (optional, removes agent files):

```bash
rm -rf ~/mrbeanbot
```

5) Remove the CLI install (pick the one you used):

```bash
npm rm -g MrBeanBot
pnpm remove -g MrBeanBot
bun remove -g MrBeanBot
```

6) If you installed the macOS app:

```bash
rm -rf /Applications/MrBeanBot.app
```

Notes:
- If you used profiles (`--profile` / `MRBEANBOT_PROFILE`), repeat step 3 for each state dir (defaults are `~/.MrBeanBot-<profile>`).
- In remote mode, the state dir lives on the **gateway host**, so run steps 1-4 there too.

## Manual service removal (CLI not installed)

Use this if the gateway service keeps running but `MrBeanBot` is missing.

### macOS (launchd)

Default label is `bot.molt.gateway` (or `bot.molt.<profile>`; legacy `com.MrBeanBot.*` may still exist):

```bash
launchctl bootout gui/$UID/bot.molt.gateway
rm -f ~/Library/LaunchAgents/bot.molt.gateway.plist
```

If you used a profile, replace the label and plist name with `bot.molt.<profile>`. Remove any legacy `com.MrBeanBot.*` plists if present.

### Linux (systemd user unit)

Default unit name is `MrBeanBot-gateway.service` (or `MrBeanBot-gateway-<profile>.service`):

```bash
systemctl --user disable --now MrBeanBot-gateway.service
rm -f ~/.config/systemd/user/MrBeanBot-gateway.service
systemctl --user daemon-reload
```

### Windows (Scheduled Task)

Default task name is `MrBeanBot Gateway` (or `MrBeanBot Gateway (<profile>)`).
The task script lives under your state dir.

```powershell
schtasks /Delete /F /TN "MrBeanBot Gateway"
Remove-Item -Force "$env:USERPROFILE\.MrBeanBot\gateway.cmd"
```

If you used a profile, delete the matching task name and `~\.MrBeanBot-<profile>\gateway.cmd`.

## Normal install vs source checkout

### Normal install (install.sh / npm / pnpm / bun)

If you used `https://mrbeanbot.com/install.sh` or `install.ps1`, the CLI was installed with `npm install -g MrBeanBot@latest`.
Remove it with `npm rm -g MrBeanBot` (or `pnpm remove -g` / `bun remove -g` if you installed that way).

### Source checkout (git clone)

If you run from a repo checkout (`git clone` + `MrBeanBot ...` / `bun run MrBeanBot ...`):

1) Uninstall the gateway service **before** deleting the repo (use the easy path above or manual service removal).
2) Delete the repo directory.
3) Remove state + workspace as shown above.
