#!/usr/bin/env bash
# MrBeanBot Rebranding - Comprehensive Test Script
# This script performs automated testing of the MrBeanBot rebranding
# Usage: ./test-rebranding.sh [--verbose]

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test result counters
PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Verbose mode
VERBOSE=false
if [[ "${1:-}" == "--verbose" ]]; then
    VERBOSE=true
fi

# Helper functions
log_section() {
    echo ""
    echo -e "${BLUE}=== $1 ===${NC}"
    echo ""
}

log_test() {
    echo -n "  Testing: $1 ... "
}

log_pass() {
    echo -e "${GREEN}✅ PASS${NC}"
    ((PASS_COUNT++))
}

log_fail() {
    echo -e "${RED}❌ FAIL${NC}"
    if [[ "$VERBOSE" == true ]]; then
        echo -e "${RED}    Error: $1${NC}"
    fi
    ((FAIL_COUNT++))
}

log_skip() {
    echo -e "${YELLOW}⏭️  SKIP${NC}"
    if [[ -n "${1:-}" ]]; then
        echo -e "${YELLOW}    Reason: $1${NC}"
    fi
    ((SKIP_COUNT++))
}

cleanup_test_env() {
    rm -rf ~/.mrbeanbot-test
    rm -f /tmp/test-mrbeanbot-*.json
    unset MRBEANBOT_CONFIG_PATH MOLTBOT_CONFIG_PATH CLAWDBOT_CONFIG_PATH 2>/dev/null || true
    unset MRBEANBOT_STATE_DIR MRBEANBOT_LOG_DIR 2>/dev/null || true
}

# Start tests
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════╗"
echo "║   MrBeanBot Rebranding Test Suite                     ║"
echo "║   Version: 1.0                                         ║"
echo "║   Date: $(date +%Y-%m-%d)                                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Environment info
echo "Environment Information:"
echo "  Node: $(node --version 2>/dev/null || echo 'not found')"
echo "  Platform: $(uname -s)"
echo "  Working Directory: $(pwd)"
echo ""

# ============================================================================
# Test 1: CLI Command Existence
# ============================================================================
log_section "Test 1: CLI Command Existence"

log_test "mrbeanbot command exists"
if command -v mrbeanbot &> /dev/null; then
    log_pass
else
    log_fail "mrbeanbot command not found in PATH"
fi

log_test "moltbot command exists (shim)"
if command -v moltbot &> /dev/null; then
    log_pass
else
    log_fail "moltbot command not found in PATH"
fi

log_test "clawdbot command exists (shim)"
if command -v clawdbot &> /dev/null; then
    log_pass
else
    log_fail "clawdbot command not found in PATH"
fi

# ============================================================================
# Test 2: CLI Command Output Branding
# ============================================================================
log_section "Test 2: CLI Command Output Branding"

log_test "mrbeanbot --version shows MrBeanBot"
if mrbeanbot --version 2>&1 | grep -qi "MrBeanBot"; then
    log_pass
else
    log_fail "Version output does not contain 'MrBeanBot'"
fi

log_test "moltbot --version shows MrBeanBot (shim)"
if moltbot --version 2>&1 | grep -qi "MrBeanBot"; then
    log_pass
else
    log_fail "Shim does not show correct branding"
fi

log_test "clawdbot --version shows MrBeanBot (shim)"
if clawdbot --version 2>&1 | grep -qi "MrBeanBot"; then
    log_pass
else
    log_fail "Shim does not show correct branding"
fi

# ============================================================================
# Test 3: Configuration Path
# ============================================================================
log_section "Test 3: Configuration Path"

# Backup existing config
if [[ -d ~/.mrbeanbot ]]; then
    mv ~/.mrbeanbot ~/.mrbeanbot.backup.$(date +%s)
fi

log_test "Config file created at ~/.mrbeanbot/"
cleanup_test_env
if mrbeanbot config set test.rebranding true &> /dev/null; then
    if [[ -f ~/.mrbeanbot/mrbeanbot.json ]]; then
        log_pass
    else
        log_fail "Config file not created at correct path"
    fi
else
    log_fail "Config set command failed"
fi

log_test "Config file has correct name (mrbeanbot.json)"
if [[ -f ~/.mrbeanbot/mrbeanbot.json ]]; then
    log_pass
else
    log_fail "Config file name incorrect"
fi

log_test "Config is valid JSON"
if jq empty ~/.mrbeanbot/mrbeanbot.json 2>/dev/null; then
    log_pass
else
    log_fail "Config is not valid JSON"
fi

# ============================================================================
# Test 4: Legacy Config Migration
# ============================================================================
log_section "Test 4: Legacy Config Migration"

log_test "Reads legacy config from ~/.moltbot/"
cleanup_test_env
mkdir -p ~/.moltbot
echo '{"gateway":{"port":12345}}' > ~/.moltbot/moltbot.json
if mrbeanbot config get gateway.port 2>&1 | grep -q "12345"; then
    log_pass
else
    log_fail "Legacy .moltbot config not read"
fi

log_test "Reads legacy config from ~/.clawdbot/"
cleanup_test_env
mkdir -p ~/.clawdbot
echo '{"gateway":{"port":54321}}' > ~/.clawdbot/clawdbot.json
if mrbeanbot config get gateway.port 2>&1 | grep -q "54321"; then
    log_pass
else
    log_fail "Legacy .clawdbot config not read"
fi

log_test "Prefers ~/.mrbeanbot/ over legacy paths"
mkdir -p ~/.mrbeanbot ~/.moltbot ~/.clawdbot
echo '{"gateway":{"port":11111}}' > ~/.mrbeanbot/mrbeanbot.json
echo '{"gateway":{"port":22222}}' > ~/.moltbot/moltbot.json
echo '{"gateway":{"port":33333}}' > ~/.clawdbot/clawdbot.json
if mrbeanbot config get gateway.port 2>&1 | grep -q "11111"; then
    log_pass
else
    log_fail "Config priority incorrect"
fi

# ============================================================================
# Test 5: Environment Variable Priority
# ============================================================================
log_section "Test 5: Environment Variable Priority"

log_test "MRBEANBOT_CONFIG_PATH takes precedence"
cleanup_test_env
export MRBEANBOT_CONFIG_PATH="/tmp/test-mrbeanbot-1.json"
export MOLTBOT_CONFIG_PATH="/tmp/test-mrbeanbot-2.json"
export CLAWDBOT_CONFIG_PATH="/tmp/test-mrbeanbot-3.json"
echo '{"gateway":{"port":10001}}' > "$MRBEANBOT_CONFIG_PATH"
echo '{"gateway":{"port":10002}}' > "$MOLTBOT_CONFIG_PATH"
echo '{"gateway":{"port":10003}}' > "$CLAWDBOT_CONFIG_PATH"
if mrbeanbot config get gateway.port 2>&1 | grep -q "10001"; then
    log_pass
else
    log_fail "MRBEANBOT_CONFIG_PATH not prioritized"
fi

log_test "Falls back to MOLTBOT_CONFIG_PATH"
unset MRBEANBOT_CONFIG_PATH
if mrbeanbot config get gateway.port 2>&1 | grep -q "10002"; then
    log_pass
else
    log_fail "MOLTBOT_CONFIG_PATH fallback failed"
fi

log_test "Falls back to CLAWDBOT_CONFIG_PATH"
unset MOLTBOT_CONFIG_PATH
if mrbeanbot config get gateway.port 2>&1 | grep -q "10003"; then
    log_pass
else
    log_fail "CLAWDBOT_CONFIG_PATH fallback failed"
fi

cleanup_test_env

# ============================================================================
# Test 6: Build Process
# ============================================================================
log_section "Test 6: Build Process"

log_test "pnpm build succeeds"
if pnpm build > /tmp/build-output.txt 2>&1; then
    log_pass
else
    log_fail "Build failed (see /tmp/build-output.txt)"
fi

log_test "dist/ directory created"
if [[ -d dist ]]; then
    log_pass
else
    log_fail "dist/ directory not found"
fi

log_test "Minimal old branding in build output"
if [[ -d dist ]]; then
    MOLTBOT_COUNT=$(grep -r "Moltbot" dist/ 2>/dev/null | wc -l || echo "0")
    if [[ "$MOLTBOT_COUNT" -lt 10 ]]; then
        log_pass
    else
        log_fail "Found $MOLTBOT_COUNT instances of 'Moltbot' in dist/"
    fi
else
    log_skip "dist/ not available"
fi

# ============================================================================
# Test 7: Test Suite
# ============================================================================
log_section "Test 7: Test Suite"

log_test "pnpm test executes"
if pnpm test --run > /tmp/test-suite-output.txt 2>&1; then
    PASS_TESTS=$(grep -c "✓" /tmp/test-suite-output.txt 2>/dev/null || echo "0")
    echo -e "${GREEN}✅ PASS${NC} ($PASS_TESTS tests passing)"
    ((PASS_COUNT++))
else
    log_fail "Test suite failed (see /tmp/test-suite-output.txt)"
fi

# ============================================================================
# Test 8: Extension Packages
# ============================================================================
log_section "Test 8: Extension Packages"

log_test "All extensions use @mrbeanbot/* scope"
if [[ -d extensions ]]; then
    MOLTBOT_SCOPE_COUNT=$(grep -r '"@moltbot/' extensions/*/package.json 2>/dev/null | wc -l || echo "0")
    if [[ "$MOLTBOT_SCOPE_COUNT" -eq 0 ]]; then
        log_pass
    else
        log_fail "Found $MOLTBOT_SCOPE_COUNT extensions with @moltbot scope"
    fi
else
    log_skip "extensions/ directory not found"
fi

log_test "Extensions have @mrbeanbot/* scope"
if [[ -d extensions ]]; then
    MRBEANBOT_SCOPE_COUNT=$(grep -r '"@mrbeanbot/' extensions/*/package.json 2>/dev/null | wc -l || echo "0")
    if [[ "$MRBEANBOT_SCOPE_COUNT" -gt 0 ]]; then
        echo -e "${GREEN}✅ PASS${NC} ($MRBEANBOT_SCOPE_COUNT extensions rebranded)"
        ((PASS_COUNT++))
    else
        log_fail "No extensions with @mrbeanbot scope found"
    fi
else
    log_skip "extensions/ directory not found"
fi

# ============================================================================
# Test 9: Documentation
# ============================================================================
log_section "Test 9: Documentation"

log_test "README contains MrBeanBot"
if grep -q "MrBeanBot" README.md 2>/dev/null; then
    log_pass
else
    log_fail "README does not mention MrBeanBot"
fi

log_test "README has author (Michael Thornton)"
if grep -qi "Michael Thornton" README.md 2>/dev/null; then
    log_pass
else
    log_fail "README missing author info"
fi

log_test "README has GitHub URL (github.com/tekcin)"
if grep -q "github.com/tekcin" README.md 2>/dev/null; then
    log_pass
else
    log_fail "README missing correct GitHub URL"
fi

log_test "README has no lobster emoji"
if ! grep -q "🦞" README.md 2>/dev/null; then
    log_pass
else
    log_fail "README still contains lobster emoji"
fi

log_test "CHANGELOG has rebranding entry"
if grep -qi "rebrand" CHANGELOG.md 2>/dev/null; then
    log_pass
else
    log_fail "CHANGELOG missing rebranding entry"
fi

log_test "package.json name is 'mrbeanbot'"
if jq -e '.name == "mrbeanbot"' package.json > /dev/null 2>&1; then
    log_pass
else
    log_fail "package.json name incorrect"
fi

log_test "package.json has three bin commands"
BIN_COUNT=$(jq -r '.bin | keys | length' package.json 2>/dev/null || echo "0")
if [[ "$BIN_COUNT" -eq 3 ]]; then
    log_pass
else
    log_fail "Expected 3 bin commands, found $BIN_COUNT"
fi

log_test "package.json has author info"
if jq -e '.author | contains("Michael Thornton")' package.json > /dev/null 2>&1; then
    log_pass
else
    log_fail "package.json missing author"
fi

# ============================================================================
# Test 10: Source Code Branding
# ============================================================================
log_section "Test 10: Source Code Branding"

log_test "CLI name constants updated"
if grep -q 'DEFAULT_CLI_NAME = "mrbeanbot"' src/cli/cli-name.ts 2>/dev/null; then
    log_pass
else
    log_fail "CLI name constants not updated"
fi

log_test "Logger uses mrbeanbot prefix"
if grep -q 'LOG_PREFIX = "mrbeanbot"' src/logging/logger.ts 2>/dev/null; then
    log_pass
else
    log_fail "Logger prefix not updated"
fi

log_test "Browser profile name updated"
if grep -q 'DEFAULT.*PROFILE.*NAME = "mrbeanbot"' src/browser/constants.ts 2>/dev/null; then
    log_pass
else
    log_fail "Browser profile name not updated"
fi

log_test "Bonjour service type updated"
if grep -q '"mrbeanbot-gw"' src/infra/bonjour.ts 2>/dev/null; then
    log_pass
else
    log_fail "Bonjour service type not updated"
fi

log_test "Service names use com.tekcin.mrbeanbot"
if grep -q 'com.tekcin.mrbeanbot' src/daemon/constants.ts 2>/dev/null; then
    log_pass
else
    log_fail "Service names not updated"
fi

# ============================================================================
# Test 11: Mobile Apps
# ============================================================================
log_section "Test 11: Mobile Apps"

log_test "iOS bundle ID updated"
if [[ -f apps/ios/project.yml ]]; then
    if grep -q "com.tekcin.mrbeanbot" apps/ios/project.yml; then
        log_pass
    else
        log_fail "iOS bundle ID not updated"
    fi
else
    log_skip "iOS app not found"
fi

log_test "Android package updated"
if [[ -f apps/android/app/build.gradle.kts ]]; then
    if grep -q "com.tekcin.mrbeanbot.android" apps/android/app/build.gradle.kts; then
        log_pass
    else
        log_fail "Android package not updated"
    fi
else
    log_skip "Android app not found"
fi

log_test "macOS bundle ID updated"
if [[ -f apps/macos/Sources/Moltbot/Resources/Info.plist ]]; then
    if grep -q "com.tekcin.mrbeanbot.mac" apps/macos/Sources/Moltbot/Resources/Info.plist; then
        log_pass
    else
        log_fail "macOS bundle ID not updated"
    fi
else
    log_skip "macOS app not found"
fi

# ============================================================================
# Test 12: UI Files
# ============================================================================
log_section "Test 12: UI Files"

log_test "Control UI title updated"
if [[ -f ui/index.html ]]; then
    if grep -q "MrBeanBot Control" ui/index.html; then
        log_pass
    else
        log_fail "Control UI title not updated"
    fi
else
    log_skip "ui/index.html not found"
fi

log_test "Canvas UI animations updated"
if [[ -f src/canvas-host/a2ui/index.html ]]; then
    if grep -q "mrbeanbot-grid-drift" src/canvas-host/a2ui/index.html; then
        log_pass
    else
        log_fail "Canvas animations not updated"
    fi
else
    log_skip "Canvas UI not found"
fi

# ============================================================================
# Test Summary
# ============================================================================
log_section "Test Summary"

TOTAL=$((PASS_COUNT + FAIL_COUNT + SKIP_COUNT))

echo ""
echo -e "${BLUE}Results:${NC}"
echo -e "  ${GREEN}Passed:${NC}  $PASS_COUNT / $TOTAL"
echo -e "  ${RED}Failed:${NC}  $FAIL_COUNT / $TOTAL"
echo -e "  ${YELLOW}Skipped:${NC} $SKIP_COUNT / $TOTAL"
echo ""

# Calculate pass rate
if [[ $TOTAL -gt 0 ]]; then
    PASS_RATE=$((PASS_COUNT * 100 / TOTAL))
    echo -e "Pass Rate: ${BLUE}${PASS_RATE}%${NC}"
fi

echo ""

# Final status
if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  ALL TESTS PASSED ✅                   ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              SOME TESTS FAILED ❌                      ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Review failed tests above and consult TESTING-REBRANDING.md for details."
    exit 1
fi
