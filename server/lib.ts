export type ProxyProtocol = "http" | "https" | "socks4" | "socks5" | string;

export interface Proxy {
  username?: string;
  password?: string;
  protocol: ProxyProtocol;
  host: string;
  port: number;
}

export type AttackMethod =
  | "http_flood"
  | "http_bypass"
  | "http_slowloris"
  | "tcp_flood"
  | "udp_flood"
  | "minecraft_ping";

export interface MethodInfo {
  name: string;
  description: string;
  recommended_for: string[];
}

export const METHOD_INFO: { [key in AttackMethod]: MethodInfo } = {
  http_flood: {
    name: "HTTP Flood",
    description: "Send massive HTTP requests to overwhelm web servers",
    recommended_for: ["http", "https", "web servers", "websites"],
  },
  http_bypass: {
    name: "HTTP Bypass",
    description: "HTTP flood with bypass techniques for protected targets",
    recommended_for: ["cloudflare", "protected websites", "waf"],
  },
  http_slowloris: {
    name: "HTTP Slowloris",
    description: "Keep connections open to exhaust server resources",
    recommended_for: ["apache", "web servers", "low bandwidth"],
  },
  tcp_flood: {
    name: "TCP Flood",
    description: "Send TCP packets to overwhelm any TCP service",
    recommended_for: ["tcp", "ssh", "ftp", "custom ports"],
  },
  udp_flood: {
    name: "UDP Flood",
    description: "Send UDP packets for connectionless attacks",
    recommended_for: ["udp", "dns", "gaming servers", "voip"],
  },
  minecraft_ping: {
    name: "Minecraft Ping",
    description: "Flood Minecraft servers with ping requests",
    recommended_for: ["minecraft", "gaming"],
  },
};
