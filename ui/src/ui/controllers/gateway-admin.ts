import type { AppViewState } from "../app-view-state";

export type GatewayStatusInfo = {
  bindMode?: string;
  bindAddress?: string;
  port?: number;
  token?: string;
  allowedIps?: string[];
  ipAllowlistEnabled?: boolean;
};

/**
 * Fetch the current config snapshot (config object + hash for optimistic locking).
 */
async function getConfigSnapshot(state: AppViewState) {
  const res = (await state.client.request("config.get", {})) as any;
  const config =
    typeof res?.config === "string" ? JSON.parse(res.config) : (res?.config ?? {});
  const hash: string | undefined = res?.hash;
  if (!hash) throw new Error("Config hash unavailable; reload and retry");
  return { config, hash, raw: res?.raw as string | undefined };
}

/**
 * Load gateway status information including bind mode and network settings
 */
export async function loadGatewayStatus(state: AppViewState): Promise<void> {
  try {
    const { config } = await getConfigSnapshot(state);

    if (config.gateway) {
      state.gatewayBindMode = config.gateway.bind || "loopback";
      state.gatewayPort = config.gateway.port || 18789;

      // Infer bind address from mode
      if (state.gatewayBindMode === "lan") {
        state.gatewayBindAddress = "0.0.0.0";
      } else {
        state.gatewayBindAddress = "127.0.0.1";
      }

      if (config.gateway.auth?.token) {
        state.gatewayToken = config.gateway.auth.token;
      }

      // Load IP allowlist settings
      if (config.gateway.allowedIps) {
        state.gatewayAllowedIps = Array.isArray(config.gateway.allowedIps)
          ? config.gateway.allowedIps
          : [];
        state.gatewayIpAllowlistEnabled = state.gatewayAllowedIps.length > 0;
      } else {
        state.gatewayAllowedIps = [];
        state.gatewayIpAllowlistEnabled = false;
      }
    } else {
      state.gatewayBindMode = "loopback";
      state.gatewayPort = 18789;
      state.gatewayBindAddress = "127.0.0.1";
      state.gatewayAllowedIps = [];
      state.gatewayIpAllowlistEnabled = false;
    }

    // Build dashboard URL
    const bindAddr = state.gatewayBindAddress || "127.0.0.1";
    const port = state.gatewayPort || 18789;
    const token = state.gatewayToken || "";
    state.gatewayDashboardUrl = `http://${bindAddr}:${port}${token ? `/?token=${token}` : ""}`;
  } catch (err) {
    console.error("Failed to load gateway status:", err);
  }
}

/**
 * Update the gateway bind mode (loopback or lan).
 * Uses config.patch which writes config AND triggers a SIGUSR1 restart.
 */
export async function updateGatewayBindMode(
  state: AppViewState,
  mode: "loopback" | "lan",
): Promise<void> {
  try {
    const { hash } = await getConfigSnapshot(state);

    await state.client.request("config.patch", {
      raw: JSON.stringify({ gateway: { bind: mode } }),
      baseHash: hash,
    });

    // Update local state
    state.gatewayBindMode = mode;
    state.gatewayBindAddress = mode === "lan" ? "0.0.0.0" : "127.0.0.1";
    state.lastError = "Gateway restarting with new network mode...";

    // Clear status message after a few seconds
    setTimeout(() => {
      if (state.lastError === "Gateway restarting with new network mode...") {
        state.lastError = null;
      }
    }, 5000);
  } catch (err: any) {
    console.error("Failed to update bind mode:", err);
    state.lastError = `Failed to update network mode: ${err.message || "Unknown error"}`;
  }
}

/**
 * Restart the gateway to apply configuration changes.
 * Uses config.apply with the current config to trigger a SIGUSR1 restart
 * without changing any settings.
 */
export async function restartGateway(state: AppViewState): Promise<void> {
  try {
    const { hash, raw } = await getConfigSnapshot(state);

    await state.client.request("config.apply", {
      raw: raw ?? "{}",
      baseHash: hash,
    });

    state.lastError = "Gateway restarting... (reconnecting)";

    setTimeout(() => {
      if (state.lastError === "Gateway restarting... (reconnecting)") {
        state.lastError = null;
      }
    }, 5000);
  } catch (err: any) {
    console.error("Failed to restart gateway:", err);

    // Connection closing is expected during restart
    if (err.message && err.message.includes("gateway closed")) {
      state.lastError = "Gateway restarting... (reconnecting)";
    } else {
      state.lastError = `Failed to restart gateway: ${err.message || "Unknown error"}`;
    }
  }
}

/**
 * Regenerate the gateway authentication token.
 * Uses config.patch to write the new token and restart the gateway.
 */
export async function regenerateGatewayToken(state: AppViewState): Promise<void> {
  try {
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { hash } = await getConfigSnapshot(state);

    await state.client.request("config.patch", {
      raw: JSON.stringify({ gateway: { auth: { token: newToken } } }),
      baseHash: hash,
    });

    // Update local state
    state.gatewayToken = newToken;

    // Update dashboard URL
    const bindAddr = state.gatewayBindAddress || "127.0.0.1";
    const port = state.gatewayPort || 18789;
    state.gatewayDashboardUrl = `http://${bindAddr}:${port}/?token=${newToken}`;

    state.lastError = null;
  } catch (err: any) {
    console.error("Failed to regenerate token:", err);
    state.lastError = `Failed to regenerate token: ${err.message || "Unknown error"}`;
  }
}

/**
 * Copy the dashboard URL to clipboard
 */
export async function copyDashboardUrl(state: AppViewState): Promise<void> {
  try {
    const url = state.gatewayDashboardUrl || "";
    await navigator.clipboard.writeText(url);
    state.lastError = "Dashboard URL copied to clipboard!";

    // Clear success message after 3 seconds
    setTimeout(() => {
      if (state.lastError === "Dashboard URL copied to clipboard!") {
        state.lastError = null;
      }
    }, 3000);
  } catch (err: any) {
    console.error("Failed to copy to clipboard:", err);
    state.lastError = `Failed to copy: ${err.message || "Unknown error"}`;
  }
}

/**
 * Validate IP address or CIDR notation
 */
function validateIpOrCidr(value: string): boolean {
  // Check if it's a CIDR notation (e.g., 192.168.1.0/24)
  if (value.includes("/")) {
    const parts = value.split("/");
    if (parts.length !== 2) return false;
    const ip = parts[0];
    const mask = parseInt(parts[1], 10);
    if (isNaN(mask) || mask < 0 || mask > 32) return false;
    return validateIp(ip);
  }
  // Otherwise validate as IP address
  return validateIp(value);
}

function validateIp(ip: string): boolean {
  const parts = ip.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    const num = parseInt(part, 10);
    return !isNaN(num) && num >= 0 && num <= 255;
  });
}

/**
 * Toggle IP allowlist on/off
 */
export async function toggleIpAllowlist(
  state: AppViewState,
  enabled: boolean,
): Promise<void> {
  try {
    state.gatewayIpAllowlistEnabled = enabled;

    // If disabling, clear the allowlist
    if (!enabled) {
      await updateAllowedIps(state, []);
    }

    state.lastError = null;
  } catch (err: any) {
    console.error("Failed to toggle IP allowlist:", err);
    state.lastError = `Failed to toggle IP allowlist: ${err.message || "Unknown error"}`;
  }
}

/**
 * Add an IP to the allowlist
 */
export async function addAllowedIp(state: AppViewState, ip: string): Promise<void> {
  try {
    const trimmedIp = ip.trim();

    // Validate IP format
    if (!validateIpOrCidr(trimmedIp)) {
      state.lastError = `Invalid IP address or CIDR notation: ${trimmedIp}`;
      return;
    }

    // Check for duplicates
    const currentIps = state.gatewayAllowedIps || [];
    if (currentIps.includes(trimmedIp)) {
      state.lastError = `IP ${trimmedIp} is already in the allowlist`;
      return;
    }

    // Add to list
    const newIps = [...currentIps, trimmedIp];
    await updateAllowedIps(state, newIps);

    // Clear input
    state.gatewayNewIpInput = "";
    state.lastError = `Added ${trimmedIp} to allowlist`;

    // Clear success message after 3 seconds
    setTimeout(() => {
      if (state.lastError?.startsWith("Added ")) {
        state.lastError = null;
      }
    }, 3000);
  } catch (err: any) {
    console.error("Failed to add IP:", err);
    state.lastError = `Failed to add IP: ${err.message || "Unknown error"}`;
  }
}

/**
 * Remove an IP from the allowlist
 */
export async function removeAllowedIp(state: AppViewState, ip: string): Promise<void> {
  try {
    const currentIps = state.gatewayAllowedIps || [];
    const newIps = currentIps.filter((item) => item !== ip);
    await updateAllowedIps(state, newIps);

    state.lastError = `Removed ${ip} from allowlist`;

    // Clear success message after 3 seconds
    setTimeout(() => {
      if (state.lastError?.startsWith("Removed ")) {
        state.lastError = null;
      }
    }, 3000);
  } catch (err: any) {
    console.error("Failed to remove IP:", err);
    state.lastError = `Failed to remove IP: ${err.message || "Unknown error"}`;
  }
}

/**
 * Update the allowed IPs in the gateway config.
 * Uses config.patch to write the new allowedIps and restart the gateway.
 */
async function updateAllowedIps(state: AppViewState, ips: string[]): Promise<void> {
  try {
    const { hash } = await getConfigSnapshot(state);

    await state.client.request("config.patch", {
      raw: JSON.stringify({ gateway: { allowedIps: ips } }),
      baseHash: hash,
    });

    // Update local state
    state.gatewayAllowedIps = ips;
  } catch (err: any) {
    throw new Error(`Failed to update allowed IPs: ${err.message || "Unknown error"}`);
  }
}
