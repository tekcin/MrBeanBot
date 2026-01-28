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
 * Load gateway status information including bind mode and network settings
 */
export async function loadGatewayStatus(state: AppViewState): Promise<void> {
  try {
    // Try to get gateway status - this might include bind info
    const statusRes = (await state.client.request("status", {})) as any;

    if (statusRes) {
      state.gatewayBindMode = statusRes.bind || "loopback";
      state.gatewayPort = statusRes.port || 18789;

      // Infer bind address from mode
      if (state.gatewayBindMode === "lan") {
        state.gatewayBindAddress = "0.0.0.0";
      } else if (state.gatewayBindMode === "loopback") {
        state.gatewayBindAddress = "127.0.0.1";
      }
    }

    // Try to get config to read bind settings
    try {
      const configRes = (await state.client.request("config.get", {})) as any;
      if (configRes?.config) {
        const config = typeof configRes.config === "string"
          ? JSON.parse(configRes.config)
          : configRes.config;

        if (config.gateway) {
          state.gatewayBindMode = config.gateway.bind || state.gatewayBindMode;
          state.gatewayPort = config.gateway.port || state.gatewayPort;

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
        }
      }
    } catch (err) {
      // Config.get might not be available, that's ok
      console.warn("Could not fetch config for gateway admin:", err);
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
 * Update the gateway bind mode (loopback or lan)
 */
export async function updateGatewayBindMode(
  state: AppViewState,
  mode: "loopback" | "lan"
): Promise<void> {
  try {
    // Update config via gateway RPC
    await state.client.request("config.set", {
      path: "gateway.bind",
      value: mode,
    });

    // Update local state
    state.gatewayBindMode = mode;
    state.gatewayBindAddress = mode === "lan" ? "0.0.0.0" : "127.0.0.1";

    // Show success message
    state.lastError = null;

    // Optionally reload status to confirm
    await loadGatewayStatus(state);

  } catch (err: any) {
    console.error("Failed to update bind mode:", err);
    state.lastError = `Failed to update network mode: ${err.message || "Unknown error"}`;
  }
}

/**
 * Restart the gateway to apply configuration changes
 */
export async function restartGateway(state: AppViewState): Promise<void> {
  try {
    // Try gateway restart RPC
    await state.client.request("gateway.restart", {});

    // Gateway will disconnect, which is expected
    state.lastError = null;

  } catch (err: any) {
    console.error("Failed to restart gateway:", err);

    // If the error is about connection closing, that's expected
    if (err.message && err.message.includes("gateway closed")) {
      state.lastError = "Gateway restarting... (reconnecting)";
    } else {
      state.lastError = `Failed to restart gateway: ${err.message || "Unknown error"}`;
    }
  }
}

/**
 * Regenerate the gateway authentication token
 */
export async function regenerateGatewayToken(state: AppViewState): Promise<void> {
  try {
    // Generate a new random token
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Update config via gateway RPC
    await state.client.request("config.set", {
      path: "gateway.auth.token",
      value: newToken,
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
  enabled: boolean
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
 * Update the allowed IPs in the gateway config
 */
async function updateAllowedIps(state: AppViewState, ips: string[]): Promise<void> {
  try {
    // Update config via gateway RPC
    await state.client.request("config.set", {
      path: "gateway.allowedIps",
      value: ips,
    });

    // Update local state
    state.gatewayAllowedIps = ips;

    // Optionally reload status to confirm
    await loadGatewayStatus(state);
  } catch (err: any) {
    throw new Error(`Failed to update allowed IPs: ${err.message || "Unknown error"}`);
  }
}
