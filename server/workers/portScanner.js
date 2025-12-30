import net from "net";
import { parentPort, workerData } from "worker_threads";

const COMMON_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 1723,
  3306, 3389, 5900, 8080, 8443, 25565,
];

const PORT_SERVICES = {
  21: "FTP",
  22: "SSH",
  23: "Telnet",
  25: "SMTP",
  53: "DNS",
  80: "HTTP",
  110: "POP3",
  111: "RPC",
  135: "MSRPC",
  139: "NetBIOS",
  143: "IMAP",
  443: "HTTPS",
  445: "SMB",
  993: "IMAPS",
  995: "POP3S",
  1723: "PPTP",
  3306: "MySQL",
  3389: "RDP",
  5900: "VNC",
  8080: "HTTP-Alt",
  8443: "HTTPS-Alt",
  25565: "Minecraft",
};

const startScan = () => {
  const { target, ports } = workerData;

  const portsToScan = ports && ports.length > 0 ? ports : COMMON_PORTS;
  const openPorts = [];
  let scannedCount = 0;

  parentPort.postMessage({
    log: `🔍 Starting port scan on ${target}...`,
    type: "scan_start",
  });

  const scanPort = (port) => {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);

      socket.on("connect", () => {
        openPorts.push({
          port,
          service: PORT_SERVICES[port] || "Unknown",
        });
        parentPort.postMessage({
          log: `✅ Port ${port} (${PORT_SERVICES[port] || "Unknown"}) is OPEN`,
          type: "port_open",
          port,
          service: PORT_SERVICES[port] || "Unknown",
        });
        socket.destroy();
        resolve(true);
      });

      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });

      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, target);
    });
  };

  const scanAllPorts = async () => {
    for (const port of portsToScan) {
      await scanPort(port);
      scannedCount++;
      
      if (scannedCount % 5 === 0) {
        parentPort.postMessage({
          log: `📊 Scanned ${scannedCount}/${portsToScan.length} ports...`,
          type: "scan_progress",
          progress: Math.round((scannedCount / portsToScan.length) * 100),
        });
      }
    }

    parentPort.postMessage({
      log: `🏁 Scan complete! Found ${openPorts.length} open ports.`,
      type: "scan_complete",
      openPorts,
      totalScanned: portsToScan.length,
    });
    process.exit(0);
  };

  scanAllPorts();
};

if (workerData) {
  startScan();
}
