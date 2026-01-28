# MrBeanBot Rebranding - Comprehensive Manual Test Plan

## Overview
This document provides a comprehensive test plan for verifying the MrBeanBot rebranding. All tests should be performed after the rebranding is complete to ensure backward compatibility, proper migration, and correct functionality.

## Test Environment Setup

### Prerequisites
- Clean system or test VM (recommended for migration testing)
- Node.js 22+ installed
- pnpm installed
- Git repository cloned: `https://github.com/tekcin/MrBeanBot`
- No existing config at `~/.mrbeanbot/`, `~/.MrBeanBot/`, or `~/.MrBeanBot/`

### Installation
```bash
cd /home/tekcin/MrBeanBot/MrBeanBot
pnpm install
pnpm build
npm link  # Or: pnpm link --global
```

---

## 1. CLI Command Testing

### 1.1 Primary Command (mrbeanbot)
**Objective**: Verify the primary `mrbeanbot` command works correctly.

**Test Steps**:
```bash
# Version check
mrbeanbot --version
# Expected: MrBeanBot v2026.1.27-beta.1 (or current version)

# Help output
mrbeanbot --help
# Expected: Display help with "MrBeanBot" branding

# Config commands
mrbeanbot config get
# Expected: Display current configuration

mrbeanbot config set gateway.port 18790
# Expected: Update config successfully

# Verify config file created
ls -la ~/.mrbeanbot/
# Expected: mrbeanbot.json exists

cat ~/.mrbeanbot/mrbeanbot.json
# Expected: Valid JSON with gateway.port = 18790
```

**Pass Criteria**:
- ✅ `mrbeanbot --version` shows "MrBeanBot" in output
- ✅ All commands execute without errors
- ✅ Config file created at `~/.mrbeanbot/mrbeanbot.json`
- ✅ No references to "MrBeanBot" or "MrBeanBot" in output

---

### 1.2 Compatibility Shim: MrBeanBot
**Objective**: Verify the `MrBeanBot` command works as a compatibility alias.

**Test Steps**:
```bash
# Clean config
rm -rf ~/.mrbeanbot ~/.MrBeanBot ~/.MrBeanBot

# Use MrBeanBot command
MrBeanBot --version
# Expected: Same output as mrbeanbot --version

MrBeanBot config set gateway.mode local
# Expected: Config updated successfully

# Verify config location
ls -la ~/.mrbeanbot/
# Expected: mrbeanbot.json exists (not MrBeanBot.json)

cat ~/.mrbeanbot/mrbeanbot.json | grep '"mode"'
# Expected: "mode": "local"
```

**Pass Criteria**:
- ✅ `MrBeanBot` command resolves and executes
- ✅ Config saved to `~/.mrbeanbot/mrbeanbot.json` (new location)
- ✅ No errors or warnings about deprecated commands

---

### 1.3 Compatibility Shim: MrBeanBot
**Objective**: Verify the `MrBeanBot` command works as a compatibility alias.

**Test Steps**:
```bash
# Clean config
rm -rf ~/.mrbeanbot ~/.MrBeanBot ~/.MrBeanBot

# Use MrBeanBot command
MrBeanBot --version
# Expected: Same output as mrbeanbot --version

MrBeanBot config set gateway.bind lan
# Expected: Config updated successfully

# Verify config location
ls -la ~/.mrbeanbot/
# Expected: mrbeanbot.json exists (not MrBeanBot.json)

cat ~/.mrbeanbot/mrbeanbot.json | grep '"bind"'
# Expected: "bind": "lan"
```

**Pass Criteria**:
- ✅ `MrBeanBot` command resolves and executes
- ✅ Config saved to `~/.mrbeanbot/mrbeanbot.json` (new location)
- ✅ No errors or warnings about deprecated commands

---

## 2. Configuration Migration Testing

### 2.1 Legacy Config Migration: .MrBeanBot
**Objective**: Verify automatic migration from `~/.MrBeanBot/` to `~/.mrbeanbot/`.

**Test Steps**:
```bash
# Setup: Create legacy config
rm -rf ~/.mrbeanbot ~/.MrBeanBot ~/.MrBeanBot
mkdir -p ~/.MrBeanBot
cat > ~/.MrBeanBot/MrBeanBot.json <<'EOF'
{
  "meta": {
    "lastTouchedVersion": "2025.1.0"
  },
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "loopback"
  }
}
EOF

# Read config using new command
mrbeanbot config get gateway.port
# Expected: 18789

mrbeanbot config get gateway.mode
# Expected: local

# Verify new config NOT created yet (reading only)
ls ~/.mrbeanbot/
# Expected: Directory may not exist (read-only migration)

# Write operation triggers migration
mrbeanbot config set gateway.bind lan

# Verify new config created
ls -la ~/.mrbeanbot/
cat ~/.mrbeanbot/mrbeanbot.json
# Expected: Contains migrated values + new bind setting
```

**Pass Criteria**:
- ✅ Legacy config at `~/.MrBeanBot/MrBeanBot.json` read successfully
- ✅ Values migrated correctly
- ✅ Write operations create new config at `~/.mrbeanbot/mrbeanbot.json`
- ✅ Original `~/.MrBeanBot/` remains untouched (non-destructive migration)

---

### 2.2 Legacy Config Migration: .MrBeanBot
**Objective**: Verify automatic migration from `~/.MrBeanBot/` to `~/.mrbeanbot/`.

**Test Steps**:
```bash
# Setup: Create legacy config
rm -rf ~/.mrbeanbot ~/.MrBeanBot ~/.MrBeanBot
mkdir -p ~/.MrBeanBot
cat > ~/.MrBeanBot/MrBeanBot.json <<'EOF'
{
  "gateway": {
    "mode": "tunnel",
    "port": 19000
  }
}
EOF

# Read config
mrbeanbot config get gateway.port
# Expected: 19000

mrbeanbot config get gateway.mode
# Expected: tunnel

# Write operation
mrbeanbot config set gateway.bind loopback

# Verify new config created
cat ~/.mrbeanbot/mrbeanbot.json
# Expected: Contains migrated values
```

**Pass Criteria**:
- ✅ Legacy config at `~/.MrBeanBot/MrBeanBot.json` read successfully
- ✅ Write operations create new config at `~/.mrbeanbot/mrbeanbot.json`

---

### 2.3 Config Priority Order
**Objective**: Verify correct config priority: `.mrbeanbot` > `.MrBeanBot` > `.MrBeanBot`.

**Test Steps**:
```bash
# Setup: Create all three configs with different values
rm -rf ~/.mrbeanbot ~/.MrBeanBot ~/.MrBeanBot

mkdir -p ~/.MrBeanBot
cat > ~/.MrBeanBot/MrBeanBot.json <<'EOF'
{"gateway": {"port": 10000}}
EOF

mkdir -p ~/.MrBeanBot
cat > ~/.MrBeanBot/MrBeanBot.json <<'EOF'
{"gateway": {"port": 20000}}
EOF

mkdir -p ~/.mrbeanbot
cat > ~/.mrbeanbot/mrbeanbot.json <<'EOF'
{"gateway": {"port": 30000}}
EOF

# Read config
mrbeanbot config get gateway.port
# Expected: 30000 (prefers .mrbeanbot)

# Remove .mrbeanbot
rm -rf ~/.mrbeanbot

mrbeanbot config get gateway.port
# Expected: 20000 (falls back to .MrBeanBot)

# Remove .MrBeanBot
rm -rf ~/.MrBeanBot

mrbeanbot config get gateway.port
# Expected: 10000 (falls back to .MrBeanBot)
```

**Pass Criteria**:
- ✅ Config priority: `.mrbeanbot` > `.MrBeanBot` > `.MrBeanBot`
- ✅ Fallback chain works correctly

---

## 3. Environment Variable Testing

### 3.1 Environment Variable Priority
**Objective**: Verify environment variable fallback: `MRBEANBOT_*` > `MRBEANBOT_*` > `MRBEANBOT_*`.

**Test Steps**:
```bash
# Clean environment
unset MRBEANBOT_CONFIG_PATH
unset MRBEANBOT_CONFIG_PATH
unset MRBEANBOT_CONFIG_PATH

# Test 1: MRBEANBOT_* takes precedence
export MRBEANBOT_CONFIG_PATH="/tmp/test-mrbeanbot.json"
export MRBEANBOT_CONFIG_PATH="/tmp/test-MrBeanBot.json"
export MRBEANBOT_CONFIG_PATH="/tmp/test-MrBeanBot.json"

echo '{"gateway":{"port":40000}}' > /tmp/test-mrbeanbot.json
echo '{"gateway":{"port":50000}}' > /tmp/test-MrBeanBot.json
echo '{"gateway":{"port":60000}}' > /tmp/test-MrBeanBot.json

mrbeanbot config get gateway.port
# Expected: 40000 (uses MRBEANBOT_*)

# Test 2: Falls back to MRBEANBOT_*
unset MRBEANBOT_CONFIG_PATH
mrbeanbot config get gateway.port
# Expected: 50000 (uses MRBEANBOT_*)

# Test 3: Falls back to MRBEANBOT_*
unset MRBEANBOT_CONFIG_PATH
mrbeanbot config get gateway.port
# Expected: 60000 (uses MRBEANBOT_*)

# Cleanup
rm -f /tmp/test-*.json
unset MRBEANBOT_CONFIG_PATH MRBEANBOT_CONFIG_PATH MRBEANBOT_CONFIG_PATH
```

**Pass Criteria**:
- ✅ Environment variable priority works correctly
- ✅ Fallback chain: `MRBEANBOT_*` > `MRBEANBOT_*` > `MRBEANBOT_*`

---

### 3.2 Common Environment Variables
**Objective**: Test all major environment variables.

**Test Steps**:
```bash
# MRBEANBOT_STATE_DIR
export MRBEANBOT_STATE_DIR="/tmp/mrbeanbot-test-state"
mkdir -p "$MRBEANBOT_STATE_DIR"
mrbeanbot config set test.value 123
ls -la "$MRBEANBOT_STATE_DIR"
# Expected: Config file created in custom state dir

# MRBEANBOT_LOG_DIR
export MRBEANBOT_LOG_DIR="/tmp/mrbeanbot-test-logs"
mkdir -p "$MRBEANBOT_LOG_DIR"
# Start gateway and verify logs go to custom dir
# (Gateway startup test below)

# Cleanup
unset MRBEANBOT_STATE_DIR MRBEANBOT_LOG_DIR
rm -rf /tmp/mrbeanbot-test-*
```

**Pass Criteria**:
- ✅ `MRBEANBOT_STATE_DIR` changes config location
- ✅ `MRBEANBOT_LOG_DIR` changes log location

---

## 4. Gateway & Service Testing

### 4.1 Gateway Startup
**Objective**: Verify gateway starts with new branding.

**Test Steps**:
```bash
# Clean config
rm -rf ~/.mrbeanbot
mrbeanbot config set gateway.mode local
mrbeanbot config set gateway.port 18789
mrbeanbot config set gateway.bind loopback

# Start gateway in foreground (use tmux/screen for testing)
mrbeanbot gateway run --bind loopback --port 18789 --force

# In another terminal:
# Check process
ps aux | grep mrbeanbot
# Expected: Process running

# Check port binding
ss -ltnp | grep 18789
# Expected: Port 18789 listening

# Check logs
tail -f /tmp/mrbeanbot/mrbeanbot-$(date +%Y-%m-%d).log
# Expected: Gateway started, no errors

# Stop gateway (Ctrl+C in first terminal)
```

**Pass Criteria**:
- ✅ Gateway starts successfully
- ✅ Logs appear in `/tmp/mrbeanbot/` directory
- ✅ Log filename prefix is `mrbeanbot-`
- ✅ No references to "MrBeanBot" or "MrBeanBot" in logs

---

### 4.2 Service Installation (macOS)
**Objective**: Verify service installation with new bundle ID.

**Test Steps** (macOS only):
```bash
# Install gateway service
mrbeanbot gateway install

# Check launchd label
launchctl list | grep com.tekcin.mrbeanbot.gateway
# Expected: Service installed with new bundle ID

# Check plist file
cat ~/Library/LaunchAgents/com.tekcin.mrbeanbot.gateway.plist
# Expected: Contains new bundle ID and service name

# Start service
launchctl start com.tekcin.mrbeanbot.gateway

# Verify running
launchctl list | grep com.tekcin.mrbeanbot.gateway
# Expected: Service running (PID shown)

# Check logs
tail -f /tmp/mrbeanbot/mrbeanbot-$(date +%Y-%m-%d).log

# Uninstall (cleanup)
mrbeanbot gateway uninstall
```

**Pass Criteria** (macOS):
- ✅ Service installed with bundle ID `com.tekcin.mrbeanbot.gateway`
- ✅ No legacy services (`bot.molt.*`, `com.MrBeanBot.*`) remain
- ✅ Service starts and runs correctly

---

### 4.3 Service Installation (Linux systemd)
**Objective**: Verify systemd service installation.

**Test Steps** (Linux only):
```bash
# Install gateway service
mrbeanbot gateway install

# Check systemd unit
systemctl --user list-unit-files | grep mrbeanbot
# Expected: mrbeanbot-gateway.service installed

# Check unit file
cat ~/.config/systemd/user/mrbeanbot-gateway.service
# Expected: Contains new service name

# Start service
systemctl --user start mrbeanbot-gateway

# Check status
systemctl --user status mrbeanbot-gateway
# Expected: Active (running)

# Check logs
journalctl --user -u mrbeanbot-gateway -f

# Uninstall (cleanup)
systemctl --user stop mrbeanbot-gateway
mrbeanbot gateway uninstall
```

**Pass Criteria** (Linux):
- ✅ Service installed as `mrbeanbot-gateway.service`
- ✅ Service starts and runs correctly
- ✅ Logs accessible via journalctl

---

### 4.4 Bonjour/mDNS Discovery
**Objective**: Verify Bonjour service advertising with new type.

**Test Steps**:
```bash
# Start gateway with Bonjour enabled
mrbeanbot gateway run --bind lan --port 18789

# In another terminal, scan for services (macOS)
dns-sd -B _mrbeanbot-gw._tcp
# Expected: Gateway advertised as "_mrbeanbot-gw._tcp"

# Or use avahi-browse (Linux)
avahi-browse -r _mrbeanbot-gw._tcp
# Expected: Gateway advertised

# Check instance name
# Expected: "MrBeanBot" (default instance name)
```

**Pass Criteria**:
- ✅ Service type is `_mrbeanbot-gw._tcp`
- ✅ Default instance name is "MrBeanBot"
- ✅ No legacy service types advertised

---

## 5. Build & Development Testing

### 5.1 Build Process
**Objective**: Verify project builds successfully.

**Test Steps**:
```bash
cd /home/tekcin/MrBeanBot/MrBeanBot

# Clean build
rm -rf dist

# Type check and build
pnpm build
# Expected: Build succeeds, no errors

# Verify output
ls -la dist/
# Expected: Compiled JavaScript files present

# Check for branding in output
grep -r "MrBeanBot" dist/ || echo "No MrBeanBot references found"
# Expected: Minimal/no references (type compatibility only)
```

**Pass Criteria**:
- ✅ `pnpm build` succeeds without errors
- ✅ Output directory `dist/` created
- ✅ No unexpected "MrBeanBot" references in compiled output

---

### 5.2 Test Suite
**Objective**: Verify tests pass with new branding.

**Test Steps**:
```bash
cd /home/tekcin/MrBeanBot/MrBeanBot

# Run full test suite
pnpm test
# Expected: Tests pass (target: >98% passing)

# Check test output for branding
# Expected: Tests reference "MrBeanBot", "mrbeanbot" CLI

# Run coverage
pnpm test:coverage
# Expected: Coverage meets thresholds (70%+)
```

**Pass Criteria**:
- ✅ Test suite passes (>98% passing rate)
- ✅ Coverage meets thresholds
- ✅ Test output uses new branding

---

### 5.3 Extension Packages
**Objective**: Verify extension packages rebranded correctly.

**Test Steps**:
```bash
# Check extension package.json files
for dir in extensions/*/; do
  echo "=== $dir ==="
  cat "$dir/package.json" | grep '"name"'
done
# Expected: All show "@mrbeanbot/*" scope

# Verify no @MrBeanBot references
grep -r "@MrBeanBot/" extensions/*/package.json || echo "None found"
# Expected: No @MrBeanBot references

# Build extensions (if applicable)
pnpm build
# Expected: Extensions build successfully
```

**Pass Criteria**:
- ✅ All 28 extension packages use `@mrbeanbot/*` scope
- ✅ No `@MrBeanBot/*` references remain
- ✅ Extensions build without errors

---

## 6. Mobile App Testing

### 6.1 iOS App
**Objective**: Verify iOS app rebranded correctly.

**Test Steps**:
```bash
# Check project.yml
cat apps/ios/project.yml | grep bundleIdPrefix
# Expected: com.tekcin.mrbeanbot

cat apps/ios/project.yml | grep "name:"
# Expected: MrBeanBot

# Check Bonjour service
cat apps/ios/project.yml | grep NSBonjourServices -A 1
# Expected: _mrbeanbot-gw._tcp

# Generate Xcode project
cd apps/ios
xcodegen generate

# Build (requires Xcode)
xcodebuild -scheme MrBeanBot -destination 'platform=iOS Simulator,name=iPhone 15' clean build
# Expected: Build succeeds

# Check bundle ID in built app
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "build/Build/Products/Debug-iphonesimulator/MrBeanBot.app/Info.plist"
# Expected: com.tekcin.mrbeanbot.ios
```

**Pass Criteria**:
- ✅ Bundle ID: `com.tekcin.mrbeanbot.ios`
- ✅ App name: "MrBeanBot"
- ✅ Bonjour service: `_mrbeanbot-gw._tcp`
- ✅ Build succeeds

---

### 6.2 Android App
**Objective**: Verify Android app rebranded correctly.

**Test Steps**:
```bash
# Check build.gradle.kts
cat apps/android/app/build.gradle.kts | grep namespace
# Expected: namespace = "com.tekcin.mrbeanbot.android"

cat apps/android/app/build.gradle.kts | grep applicationId
# Expected: applicationId = "com.tekcin.mrbeanbot.android"

# Check strings.xml
cat apps/android/app/src/main/res/values/strings.xml
# Expected: <string name="app_name">MrBeanBot Node</string>

# Build APK (requires Android SDK)
cd apps/android
./gradlew assembleDebug
# Expected: Build succeeds

# Check APK package name
aapt dump badging app/build/outputs/apk/debug/mrbeanbot-*.apk | grep package
# Expected: package: name='com.tekcin.mrbeanbot.android'
```

**Pass Criteria**:
- ✅ Package name: `com.tekcin.mrbeanbot.android`
- ✅ App name: "MrBeanBot Node"
- ✅ APK filename: `mrbeanbot-*.apk`
- ✅ Build succeeds

---

### 6.3 macOS App
**Objective**: Verify macOS app rebranded correctly.

**Test Steps**:
```bash
# Check Package.swift
cat apps/macos/Package.swift | grep "name:"
# Expected: "MrBeanBot"

# Check Info.plist
cat apps/macos/Sources/MrBeanBot/Resources/Info.plist | grep CFBundleIdentifier -A 1
# Expected: com.tekcin.mrbeanbot.mac

cat apps/macos/Sources/MrBeanBot/Resources/Info.plist | grep CFBundleName -A 1
# Expected: MrBeanBot

cat apps/macos/Sources/MrBeanBot/Resources/Info.plist | grep CFBundleURLSchemes -A 1
# Expected: mrbeanbot

# Build (requires Xcode)
cd apps/macos
swift build
# Expected: Build succeeds

# Run
.build/debug/MrBeanBot --version
# Expected: Shows version
```

**Pass Criteria**:
- ✅ Bundle ID: `com.tekcin.mrbeanbot.mac`
- ✅ App name: "MrBeanBot"
- ✅ URL scheme: `mrbeanbot://`
- ✅ Build succeeds

---

## 7. UI Testing

### 7.1 Control UI
**Objective**: Verify Control UI branding.

**Test Steps**:
```bash
# Build UI
cd ui
pnpm build

# Check index.html
cat index.html | grep "<title>"
# Expected: <title>MrBeanBot Control</title>

cat index.html | grep "<mrbeanbot-app>"
# Expected: Custom element name changed

# Start UI server (if applicable)
# Open in browser and verify:
# - Title bar shows "MrBeanBot Control"
# - No lobster emoji
# - No "MrBeanBot" references
```

**Pass Criteria**:
- ✅ Page title: "MrBeanBot Control"
- ✅ Component: `<mrbeanbot-app>`
- ✅ No old branding visible

---

### 7.2 Canvas UI
**Objective**: Verify Canvas UI branding.

**Test Steps**:
```bash
# Check a2ui HTML
cat src/canvas-host/a2ui/index.html | grep "<title>"
# Expected: <title>MrBeanBot Canvas</title>

# Check animations
cat src/canvas-host/a2ui/index.html | grep "@keyframes"
# Expected: mrbeanbot-grid-drift, mrbeanbot-glow-drift

# Check Swift scaffold
cat apps/shared/MrBeanBotKit/Sources/MrBeanBotKit/Resources/CanvasScaffold/scaffold.html | grep "@keyframes"
# Expected: mrbeanbot-grid-drift, mrbeanbot-glow-drift

# Visual test: Open canvas in browser and verify:
# - Animated grid background
# - Blue/pink/cyan gradient theme
# - No "MrBeanBot" in CSS animations
```

**Pass Criteria**:
- ✅ Page title: "MrBeanBot Canvas"
- ✅ CSS animations: `mrbeanbot-*-drift`
- ✅ Visual theme correct

---

## 8. Documentation Verification

### 8.1 README.md
**Objective**: Verify README updated with new branding.

**Test Steps**:
```bash
# Check README content
cat README.md | head -20

# Verify no old branding
grep -i "MrBeanBot" README.md | wc -l
# Expected: Minimal references (mainly in migration/compatibility sections)

grep -i "🦞" README.md
# Expected: No lobster emoji

grep -i "molt.bot" README.md
# Expected: No molt.bot URLs

grep -i "clawdhub.com" README.md
# Expected: No clawdhub.com URLs

# Check author info
grep -i "tekcin" README.md
# Expected: Author: Michael Thornton (tekcin@yahoo.com)

grep -i "github.com/tekcin" README.md
# Expected: GitHub URL present
```

**Pass Criteria**:
- ✅ Title: "MrBeanBot"
- ✅ Author: Michael Thornton
- ✅ GitHub: https://github.com/tekcin/MrBeanBot
- ✅ No lobster emoji or space lobster theme
- ✅ No external URLs (molt.bot, clawdhub.com)

---

### 8.2 CHANGELOG.md
**Objective**: Verify rebranding entry in changelog.

**Test Steps**:
```bash
# Check for rebranding entry
cat CHANGELOG.md | head -100 | grep -A 10 "Rebranding"

# Verify comprehensive entry
cat CHANGELOG.md | grep "MrBeanBot" | head -5
```

**Pass Criteria**:
- ✅ Rebranding entry present
- ✅ Documents major changes
- ✅ Mentions backward compatibility

---

### 8.3 Package Metadata
**Objective**: Verify package.json has correct metadata.

**Test Steps**:
```bash
# Check package.json
cat package.json | jq '.name'
# Expected: "mrbeanbot"

cat package.json | jq '.author'
# Expected: "Michael Thornton <tekcin@yahoo.com> (https://github.com/tekcin)"

cat package.json | jq '.repository.url'
# Expected: "https://github.com/tekcin/MrBeanBot.git"

cat package.json | jq '.bin'
# Expected: Three commands: mrbeanbot, MrBeanBot, MrBeanBot
```

**Pass Criteria**:
- ✅ Package name: "mrbeanbot"
- ✅ Author info correct
- ✅ Repository URL: https://github.com/tekcin/MrBeanBot.git
- ✅ All three bin commands present

---

## 9. Regression Testing

### 9.1 Gateway Functionality
**Objective**: Verify gateway still functions correctly after rebranding.

**Test Steps**:
```bash
# Start gateway
mrbeanbot gateway run --bind loopback --port 18789

# In another terminal:
# Test health endpoint
curl http://localhost:18789/health
# Expected: {"status":"ok"} or similar

# Test WebSocket connection (if applicable)
# Expected: Connection successful

# Test agent message routing (if applicable)
# Expected: Messages route correctly
```

**Pass Criteria**:
- ✅ Gateway starts and accepts connections
- ✅ Health endpoint responds
- ✅ Core functionality works

---

### 9.2 Browser Profile
**Objective**: Verify browser profile uses new name.

**Test Steps**:
```bash
# Check browser constants
grep "DEFAULT.*PROFILE" src/browser/constants.ts
# Expected: "mrbeanbot"

# Start browser-based feature (if applicable)
# Check Chrome profile directory
# Expected: Profile named "mrbeanbot"
```

**Pass Criteria**:
- ✅ Browser profile: "mrbeanbot"
- ✅ Profile color: Orange (#FF4500)

---

## 10. Integration Testing

### 10.1 Full Workflow Test
**Objective**: Test a complete workflow end-to-end.

**Test Steps**:
```bash
# 1. Clean install
rm -rf ~/.mrbeanbot ~/.MrBeanBot ~/.MrBeanBot
pnpm build

# 2. Initialize config
mrbeanbot config set gateway.mode local
mrbeanbot config set gateway.port 18789
mrbeanbot config set gateway.bind loopback

# 3. Start gateway
mrbeanbot gateway run --bind loopback --port 18789 &
GATEWAY_PID=$!

# 4. Verify running
sleep 2
ps -p $GATEWAY_PID
ss -ltnp | grep 18789

# 5. Test health
curl http://localhost:18789/health

# 6. Stop gateway
kill $GATEWAY_PID

# 7. Test compatibility aliases
MrBeanBot config get gateway.port
MrBeanBot config get gateway.port

# 8. Verify config location
ls -la ~/.mrbeanbot/mrbeanbot.json
```

**Pass Criteria**:
- ✅ Full workflow completes without errors
- ✅ All commands work (primary + shims)
- ✅ Gateway starts, runs, and stops cleanly

---

## 11. Security & Privacy Testing

### 11.1 No Secrets in Repository
**Objective**: Verify no secrets committed to GitHub.

**Test Steps**:
```bash
# Check for API keys
grep -r "sk-" . --include="*.ts" --include="*.json" | grep -v node_modules
# Expected: No results

# Check for tokens
grep -r "ghp_" . --include="*.ts" --include="*.json" | grep -v node_modules
# Expected: No results

# Check .gitignore
cat .gitignore | grep -E "\.env|credentials|secrets"
# Expected: Sensitive patterns ignored

# Check detect-secrets baseline (if exists)
cat .secrets.baseline
# Expected: No secrets detected
```

**Pass Criteria**:
- ✅ No API keys, tokens, or credentials in code
- ✅ `.gitignore` properly configured
- ✅ No secrets in git history

---

## Test Summary Template

After completing all tests, fill out this summary:

```
=== MrBeanBot Rebranding Test Results ===
Date: [DATE]
Tester: [NAME]
Environment: [macOS/Linux/Windows version]
Node Version: [VERSION]
Build Version: [VERSION]

1. CLI Command Testing:
   - Primary command (mrbeanbot): [ PASS / FAIL ]
   - Compatibility shim (MrBeanBot): [ PASS / FAIL ]
   - Compatibility shim (MrBeanBot): [ PASS / FAIL ]

2. Configuration Migration:
   - .MrBeanBot migration: [ PASS / FAIL ]
   - .MrBeanBot migration: [ PASS / FAIL ]
   - Config priority: [ PASS / FAIL ]

3. Environment Variables:
   - Variable priority: [ PASS / FAIL ]
   - Common variables: [ PASS / FAIL ]

4. Gateway & Services:
   - Gateway startup: [ PASS / FAIL ]
   - Service installation: [ PASS / FAIL / N/A ]
   - Bonjour discovery: [ PASS / FAIL / N/A ]

5. Build & Development:
   - Build process: [ PASS / FAIL ]
   - Test suite: [ PASS / FAIL ]
   - Extensions: [ PASS / FAIL ]

6. Mobile Apps:
   - iOS: [ PASS / FAIL / N/A ]
   - Android: [ PASS / FAIL / N/A ]
   - macOS: [ PASS / FAIL / N/A ]

7. UI Testing:
   - Control UI: [ PASS / FAIL ]
   - Canvas UI: [ PASS / FAIL ]

8. Documentation:
   - README: [ PASS / FAIL ]
   - CHANGELOG: [ PASS / FAIL ]
   - Package metadata: [ PASS / FAIL ]

9. Regression Testing:
   - Gateway functionality: [ PASS / FAIL ]
   - Browser profile: [ PASS / FAIL ]

10. Integration Testing:
    - Full workflow: [ PASS / FAIL ]

11. Security & Privacy:
    - No secrets: [ PASS / FAIL ]

Overall Result: [ PASS / FAIL ]

Notes:
[Any issues, observations, or recommendations]
```

---

## Automated Test Script

For convenience, here's a starter script for automated testing:

```bash
#!/usr/bin/env bash
# File: test-rebranding.sh
# Usage: ./test-rebranding.sh

set -euo pipefail

echo "=== MrBeanBot Rebranding Test Suite ==="
echo ""

# Test 1: CLI Commands
echo "Test 1: CLI Commands"
mrbeanbot --version | grep -q "MrBeanBot" && echo "✅ mrbeanbot command works" || echo "❌ mrbeanbot command failed"
MrBeanBot --version | grep -q "MrBeanBot" && echo "✅ MrBeanBot shim works" || echo "❌ MrBeanBot shim failed"
MrBeanBot --version | grep -q "MrBeanBot" && echo "✅ MrBeanBot shim works" || echo "❌ MrBeanBot shim failed"
echo ""

# Test 2: Config Location
echo "Test 2: Config Location"
rm -rf ~/.mrbeanbot
mrbeanbot config set test.value 123
[ -f ~/.mrbeanbot/mrbeanbot.json ] && echo "✅ Config created at correct location" || echo "❌ Config location wrong"
echo ""

# Test 3: Build
echo "Test 3: Build Process"
pnpm build > /dev/null 2>&1 && echo "✅ Build succeeds" || echo "❌ Build failed"
echo ""

# Test 4: Tests
echo "Test 4: Test Suite"
pnpm test --run > /tmp/test-output.txt 2>&1
PASS_COUNT=$(grep -c "✓" /tmp/test-output.txt || echo "0")
echo "✅ Tests completed: $PASS_COUNT passing"
echo ""

# Test 5: No Old Branding in Output
echo "Test 5: Branding Check"
grep -r "MrBeanBot" dist/ > /tmp/branding-check.txt 2>&1 || true
MRBEANBOT_COUNT=$(wc -l < /tmp/branding-check.txt)
[ "$MRBEANBOT_COUNT" -lt 5 ] && echo "✅ Minimal old branding in build output" || echo "⚠️  Old branding found ($MRBEANBOT_COUNT instances)"
echo ""

echo "=== Test Suite Complete ==="
```

Save this as `test-rebranding.sh`, make it executable (`chmod +x test-rebranding.sh`), and run it.

---

## Troubleshooting Guide

### Issue: Command not found (mrbeanbot, MrBeanBot, or MrBeanBot)
**Solution**:
```bash
# Re-link package
npm unlink -g
npm link

# Or install globally
npm install -g .
```

### Issue: Config not migrating from legacy location
**Solution**:
```bash
# Verify legacy config exists and is valid JSON
cat ~/.MrBeanBot/MrBeanBot.json | jq .

# Check file permissions
ls -la ~/.MrBeanBot/

# Enable debug logging
export DEBUG=mrbeanbot:*
mrbeanbot config get gateway.port
```

### Issue: Gateway fails to start
**Solution**:
```bash
# Check logs
tail -f /tmp/mrbeanbot/mrbeanbot-$(date +%Y-%m-%d).log

# Check port availability
ss -ltnp | grep 18789

# Try different port
mrbeanbot gateway run --port 19000
```

### Issue: Tests fail with old branding
**Solution**:
```bash
# Update test fixtures
find . -name "*.test.ts" -exec grep -l "MrBeanBot" {} \;

# Run specific test with verbose output
pnpm test -- path/to/failing.test.ts
```

---

## Appendix: Test Checklist

Quick reference checklist:

- [ ] `mrbeanbot --version` works
- [ ] `MrBeanBot --version` works (shim)
- [ ] `MrBeanBot --version` works (shim)
- [ ] Config created at `~/.mrbeanbot/mrbeanbot.json`
- [ ] Legacy config at `~/.MrBeanBot/` read correctly
- [ ] Legacy config at `~/.MrBeanBot/` read correctly
- [ ] Environment variable fallback: MRBEANBOT_* > MRBEANBOT_* > MRBEANBOT_*
- [ ] Gateway starts with new log directory `/tmp/mrbeanbot/`
- [ ] Service installs with bundle ID `com.tekcin.mrbeanbot.*`
- [ ] Bonjour advertises `_mrbeanbot-gw._tcp`
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes (>98%)
- [ ] Extensions use `@mrbeanbot/*` scope
- [ ] iOS bundle ID: `com.tekcin.mrbeanbot.ios`
- [ ] Android package: `com.tekcin.mrbeanbot.android`
- [ ] macOS bundle ID: `com.tekcin.mrbeanbot.mac`
- [ ] Control UI title: "MrBeanBot Control"
- [ ] Canvas animations: `mrbeanbot-*-drift`
- [ ] README has author info (Michael Thornton)
- [ ] README has GitHub URL (github.com/tekcin/MrBeanBot)
- [ ] No lobster emoji in README
- [ ] No molt.bot URLs
- [ ] No clawdhub.com URLs
- [ ] CHANGELOG has rebranding entry
- [ ] package.json name: "mrbeanbot"
- [ ] package.json has all three bin commands
- [ ] No secrets in repository

---

**Document Version**: 1.0
**Last Updated**: 2026-01-28
**Author**: Generated for MrBeanBot rebranding validation
