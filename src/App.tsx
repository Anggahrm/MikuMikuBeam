import { Bot, Lightbulb, ScrollText, Search, Wand2, Wifi, X, Zap } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// Toast notification types and component
type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: number) => void }) {
  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return "bg-green-500 text-white";
      case "error":
        return "bg-red-500 text-white";
      case "warning":
        return "bg-yellow-500 text-white";
      case "info":
      default:
        return "bg-blue-500 text-white";
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getToastStyles(toast.type)} px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-2 animate-slide-in`}
        >
          <span className="text-sm font-medium break-words flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="flex-shrink-0 hover:opacity-80 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const timeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = toastId.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto-remove after 4 seconds
    const timeoutId = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeoutRefs.current.delete(id);
    }, 4000);
    timeoutRefs.current.set(id, timeoutId);
  }, []);

  const removeToast = useCallback((id: number) => {
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

function isHostLocal(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.startsWith("::1") ||
    host.startsWith("192.168") ||
    host.startsWith("10.") ||
    host.startsWith("172.")
  );
}

function getSocketURL() {
  const host = window.location.host.split(":")[0];
  const isLocal = isHostLocal(host);
  const socketURL = isLocal ? `http://${host}:3000` : "/";
  return socketURL;
}

function getAPIURL() {
  const host = window.location.host.split(":")[0];
  const isLocal = isHostLocal(host);
  return isLocal ? `http://${host}:3000` : "";
}

const socket = io(getSocketURL());

function ConfigureProxiesAndAgentsView({ addToast, onClose }: { addToast: (message: string, type: ToastType) => void; onClose: () => void }) {
  const [loadingConfiguration, setLoadingConfiguration] = useState(false);
  const [updatingProxies, setUpdatingProxies] = useState(false);
  const [configuration, setConfiguration] = useState<string[]>([]);

  async function retrieveConfiguration(): Promise<string[]> {
    const response = await fetch(`${getAPIURL()}/configuration`);
    const information = (await response.json()) as {
      proxies: string;
      uas: string;
    };

    const proxies = atob(information.proxies);
    const uas = atob(information.uas);

    return [proxies, uas];
  }

  useEffect(() => {
    if (!loadingConfiguration) {
      setLoadingConfiguration(true);
      retrieveConfiguration().then((config) => {
        setLoadingConfiguration(false);
        setConfiguration(config);
      });
    }
  }, []);

  function saveConfiguration() {
    const obj = {
      proxies: btoa(configuration[0]),
      uas: btoa(configuration[1]),
    };

    // console.log(obj)

    const response = fetch(`${getAPIURL()}/configuration`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(obj),
    });

    response.then(() => {
      addToast("Configuration saved successfully!", "success");
      setTimeout(() => window.location.reload(), 1000);
    });
  }

  async function updateProxies() {
    setUpdatingProxies(true);
    try {
      const response = await fetch(`${getAPIURL()}/update-proxies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const result = await response.json();
      if (result.success) {
        addToast(`Proxies updated! Total: ${result.count} proxies`, "success");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        addToast("Failed to update proxies: " + result.error, "error");
      }
    } catch {
      addToast("Error updating proxies", "error");
    } finally {
      setUpdatingProxies(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-md shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-gray-800">Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {loadingConfiguration ? (
          <div className="flex flex-col items-center justify-center space-y-2 py-8">
            <img src="/loading.gif" className="rounded-sm shadow-sm" />
            <p>Loading proxies.txt and uas.txt...</p>
          </div>
        ) : (
          <div className="flex flex-col">
            <p className="pl-1 mb-1 italic">proxies.txt</p>
            <textarea
              value={configuration[0]}
              className="w-full h-32 sm:h-40 p-2 border-black/10 border-[1px] rounded-sm resize-none text-sm"
              onChange={(e) =>
                setConfiguration([e.target.value, configuration[1]])
              }
              placeholder="socks5://0.0.0.0&#10;socks4://user:pass@0.0.0.0:12345"
            ></textarea>
            <p className="pl-1 mt-2 mb-1 italic">uas.txt</p>
            <textarea
              value={configuration[1]}
              className="w-full h-32 sm:h-40 p-2 border-black/10 border-[1px] rounded-sm resize-none text-sm"
              onChange={(e) =>
                setConfiguration([configuration[0], e.target.value])
              }
              placeholder="Mozilla/5.0 (Linux; Android 10; K)..."
            ></textarea>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
              <button
                onClick={saveConfiguration}
                className="flex-1 p-3 sm:p-4 text-white bg-gray-800 rounded-md hover:bg-gray-900 text-sm sm:text-base"
              >
                Write Changes
              </button>
              <button
                onClick={updateProxies}
                disabled={updatingProxies}
                className="flex-1 p-3 sm:p-4 text-white bg-pink-500 rounded-md hover:bg-pink-600 disabled:bg-pink-300 text-sm sm:text-base"
              >
                {updatingProxies ? "Updating..." : "Update Proxy"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [isAttacking, setIsAttacking] = useState(false);
  const [actuallyAttacking, setActuallyAttacking] = useState(false);
  const [animState, setAnimState] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState("");
  const [attackMethod, setAttackMethod] = useState("http_flood");
  const [packetSize, setPacketSize] = useState(64);
  const [duration, setDuration] = useState(60);
  const [packetDelay, setPacketDelay] = useState(100);
  const [stats, setStats] = useState({
    pps: 0,
    bots: 0,
    totalPackets: 0,
  });
  const [lastUpdatedPPS, setLastUpdatedPPS] = useState(Date.now());
  const [lastTotalPackets, setLastTotalPackets] = useState(0);
  const [currentTask, setCurrentTask] = useState<NodeJS.Timeout | null>(null);
  const [audioVol, setAudioVol] = useState(100);
  const [openedConfig, setOpenedConfig] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ port: number; service: string }[]>([]);
  const [showScanResults, setShowScanResults] = useState(false);
  const [recommendation, setRecommendation] = useState<{ method: string; reason: string } | null>(null);

  const { toasts, addToast, removeToast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      const audio = audioRef.current;
      const handler = () => {
        if (audio.paused) return;

        if (
          animState !== 2 &&
          audio.currentTime > 5.24 &&
          audio.currentTime < 9.4
        ) {
          setAnimState(2);
        }
        if (audio.currentTime > 17.53) {
          audio.currentTime = 15.86;
        }
      };

      audio.addEventListener("timeupdate", handler);
      return () => {
        audio.removeEventListener("timeupdate", handler);
      };
    }
  }, [audioRef]);

  useEffect(() => {
    if (!isAttacking) {
      setActuallyAttacking(false);
      setAnimState(0);

      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      if (currentTask) {
        clearTimeout(currentTask);
      }
    }
  }, [isAttacking, currentTask]);

  useEffect(() => {
    const now = Date.now();
    if (now - lastUpdatedPPS >= 500) {
      setLastUpdatedPPS(now);
      setStats((old) => ({
        pps: (old.totalPackets - lastTotalPackets) / (now - lastUpdatedPPS),
        bots: old.bots,
        totalPackets: old.totalPackets,
      }));
      setLastTotalPackets(stats.totalPackets);
    }
  }, [lastUpdatedPPS, lastTotalPackets, stats.totalPackets]);

  useEffect(() => {
    socket.on("stats", (data) => {
      setStats((old) => ({
        pps: data.pps || old.pps,
        bots: data.bots || old.bots,
        totalPackets: data.totalPackets || old.totalPackets,
      }));
      if (data.log) addLog(data.log);
      setProgress((prev) => (prev + 10) % 100);
    });

    socket.on("attackEnd", () => {
      setIsAttacking(false);
    });

    socket.on("scanResult", (data) => {
      if (data.log) addLog(data.log);
      if (data.type === "port_open") {
        setScanResults((prev) => [...prev, { port: data.port, service: data.service }]);
      }
      if (data.type === "scan_complete") {
        setShowScanResults(true);
      }
    });

    socket.on("scanEnd", () => {
      setIsScanning(false);
    });

    return () => {
      socket.off("stats");
      socket.off("attackEnd");
      socket.off("scanResult");
      socket.off("scanEnd");
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = audioVol / 100;
    }
  }, [audioVol]);

  const addLog = (message: string) => {
    setLogs((prev) => [message, ...prev].slice(0, 12));
  };

  const startAttack = (isQuick?: boolean) => {
    if (!target.trim()) {
      addToast("Please enter a target!", "warning");
      return;
    }

    setIsAttacking(true);
    setStats((old) => ({
      pps: 0,
      bots: old.bots,
      totalPackets: 0,
    }));
    addLog("🍮 Preparing attack...");

    // Play audio
    if (audioRef.current) {
      audioRef.current.currentTime = isQuick ? 9.5 : 0;
      audioRef.current.volume = audioVol / 100;
      audioRef.current.play();
    }

    if (!isQuick) setAnimState(1);

    // Start attack after audio intro
    const timeout = setTimeout(
      () => {
        setActuallyAttacking(true);
        setAnimState(3);
        socket.emit("startAttack", {
          target,
          packetSize,
          duration,
          packetDelay,
          attackMethod,
        });
      },
      isQuick ? 700 : 10250
    );
    setCurrentTask(timeout);
  };

  const stopAttack = () => {
    socket.emit("stopAttack");
    setIsAttacking(false);
  };

  const startPortScan = () => {
    if (!target.trim()) {
      addToast("Please enter a target!", "warning");
      return;
    }

    // Extract host from target (remove protocol and port if present)
    let host = target;
    if (host.includes("://")) {
      host = host.split("://")[1];
    }
    if (host.includes("/")) {
      host = host.split("/")[0];
    }
    if (host.includes(":")) {
      host = host.split(":")[0];
    }

    setIsScanning(true);
    setScanResults([]);
    setShowScanResults(false);
    addLog(`🔍 Starting port scan on ${host}...`);
    socket.emit("startPortScan", { target: host });
  };

  const stopPortScan = () => {
    socket.emit("stopPortScan");
    setIsScanning(false);
  };

  const getRecommendedMethod = async () => {
    if (!target.trim()) {
      addToast("Please enter a target first!", "warning");
      return;
    }

    try {
      const response = await fetch(`${getAPIURL()}/recommend-method`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ target }),
      });
      const data = await response.json();
      setRecommendation({ method: data.recommended, reason: data.reason });
      setAttackMethod(data.recommended);
      addLog(`💡 Recommended: ${data.methodInfo.name} - ${data.reason}`);
    } catch {
      addLog("❌ Failed to get recommendation");
    }
  };

  return (
    <div
      className={`w-screen min-h-screen bg-gradient-to-br ${
        animState === 0 || animState === 3
          ? "from-pink-100 to-blue-100"
          : animState === 2
          ? "background-pulse"
          : "bg-gray-950"
      } p-4 sm:p-8 overflow-y-auto ${actuallyAttacking ? "shake" : ""}`}
    >
      <audio ref={audioRef} src="/audio.mp3" />

      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-8">
        <div className="text-center">
          <h1 className="mb-2 text-2xl sm:text-4xl font-bold text-pink-500">
            Miku Miku Beam
          </h1>
          <p
            className={`text-sm sm:text-base ${
              animState === 0 || animState === 3
                ? "text-gray-600"
                : "text-white"
            }`}
          >
            Because DDoS attacks are also cute and even more so when Miku does
            them.
          </p>
        </div>

        <div
          className={`relative p-3 sm:p-6 overflow-hidden rounded-lg shadow-xl ${
            animState === 0 || animState === 3 ? "bg-white" : "bg-gray-950"
          }`}
        >
          {/* Miku GIF */}
          <div
            className="flex justify-center w-full h-32 sm:h-48 mb-4 sm:mb-6"
            style={{
              backgroundImage: "url('/miku.gif')",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "cover",
              opacity: animState === 0 || animState === 3 ? 1 : 0,
              transition: "opacity 0.2s ease-in-out",
            }}
          ></div>

          {/* Attack Configuration */}
          <div className="mb-6 space-y-4">
            {/* Target Input */}
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Enter target URL or IP"
              className={`${
                animState === 0 || animState === 3 ? "" : "text-white"
              } w-full px-4 py-2 border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
              disabled={isAttacking}
            />
            
            {/* Action Buttons - Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <button
                onClick={() => (isAttacking ? stopAttack() : startAttack())}
                className={`
                col-span-2 sm:col-span-2 md:col-span-2 px-4 py-2 rounded-lg font-semibold text-white transition-all
                ${
                  isAttacking
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-pink-500 hover:bg-pink-600"
                }
                flex items-center justify-center gap-2 text-sm sm:text-base
              `}
              >
                <Wand2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden xs:inline">{isAttacking ? "Stop Beam" : "Start Beam"}</span>
                <span className="xs:hidden">{isAttacking ? "Stop" : "Start"}</span>
              </button>
              <button
                onClick={() =>
                  isAttacking ? stopAttack() : startAttack(true)
                }
                className={`
                px-2 py-2 rounded-lg font-semibold text-white transition-all
                ${
                  isAttacking
                    ? "bg-gray-500 hover:bg-red-600"
                    : "bg-cyan-500 hover:bg-cyan-600"
                }
                flex items-center justify-center
              `}
                title="Quick Start"
              >
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                className="px-2 py-2 rounded-lg font-semibold text-white transition-all flex items-center justify-center bg-slate-800 hover:bg-slate-900"
                onClick={() => setOpenedConfig(true)}
                title="Configuration"
              >
                <ScrollText className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => (isScanning ? stopPortScan() : startPortScan())}
                disabled={isAttacking}
                className={`px-2 py-2 rounded-lg font-semibold text-white transition-all flex items-center justify-center ${
                  isScanning ? "bg-orange-500 hover:bg-orange-600" : "bg-purple-500 hover:bg-purple-600"
                } disabled:bg-gray-400`}
                title="Port Scanner"
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={getRecommendedMethod}
                disabled={isAttacking || isScanning}
                className="px-2 py-2 rounded-lg font-semibold text-white transition-all flex items-center justify-center bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400"
                title="Get Recommended Method"
              >
                <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Attack Parameters - Responsive Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label
                  className={`block mb-1 text-xs sm:text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  Attack Method
                </label>
                <select
                  value={attackMethod}
                  onChange={(e) => setAttackMethod(e.target.value)}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-gray-900"
                  } w-full px-2 sm:px-4 py-2 text-sm border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                >
                  <option value="http_flood">HTTP/Flood</option>
                  <option value="http_bypass">HTTP/Bypass</option>
                  <option value="http_slowloris">HTTP/Slowloris</option>
                  <option value="tcp_flood">TCP/Flood</option>
                  <option value="udp_flood">UDP/Flood</option>
                  <option value="minecraft_ping">Minecraft/Ping</option>
                </select>
              </div>
              <div>
                <label
                  className={`block mb-1 text-xs sm:text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  Packet Size (kb)
                </label>
                <input
                  type="number"
                  value={packetSize}
                  onChange={(e) => setPacketSize(Number(e.target.value))}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-white"
                  } w-full px-2 sm:px-4 py-2 text-sm border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                  min="1"
                  max="1500"
                />
              </div>
              <div>
                <label
                  className={`block mb-1 text-xs sm:text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  Duration (sec)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-white"
                  } w-full px-2 sm:px-4 py-2 text-sm border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                  min="1"
                  max="300"
                />
              </div>
              <div>
                <label
                  className={`block mb-1 text-xs sm:text-sm font-medium ${
                    animState === 0 || animState === 3
                      ? "text-gray-700"
                      : "text-white"
                  }`}
                >
                  Delay (ms)
                </label>
                <input
                  type="number"
                  value={packetDelay}
                  onChange={(e) => setPacketDelay(Number(e.target.value))}
                  className={`${
                    animState === 0 || animState === 3 ? "" : "text-white"
                  } w-full px-2 sm:px-4 py-2 text-sm border border-pink-200 rounded-lg outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-200`}
                  disabled={isAttacking}
                  min="1"
                  max="1000"
                />
              </div>
            </div>
          </div>

          {/* Stats Widgets */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6">
            <div className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-blue-500/10">
              <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 text-pink-600">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-semibold text-xs sm:text-base">PPS</span>
              </div>
              <div
                className={`text-lg sm:text-2xl font-bold ${
                  animState === 0 || animState === 3
                    ? "text-gray-800"
                    : "text-white"
                }`}
              >
                {stats.pps.toLocaleString()}
              </div>
            </div>
            <div className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-blue-500/10">
              <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 text-pink-600">
                <Bot className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-semibold text-xs sm:text-base">Bots</span>
              </div>
              <div
                className={`text-2xl font-bold ${
                  animState === 0 || animState === 3
                    ? "text-gray-800"
                    : "text-white"
                }`}
              >
                {stats.bots.toLocaleString()}
              </div>
            </div>
            <div className="p-2 sm:p-4 rounded-lg bg-gradient-to-br from-pink-500/10 to-blue-500/10">
              <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 text-pink-600">
                <Wifi className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-semibold text-xs sm:text-base">Total</span>
              </div>
              <div
                className={`text-lg sm:text-2xl font-bold ${
                  animState === 0 || animState === 3
                    ? "text-gray-800"
                    : "text-white"
                }`}
              >
                {stats.totalPackets.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-3 sm:h-4 mb-6 overflow-hidden bg-gray-200 rounded-full">
            <div
              className="h-full transition-all duration-500 bg-gradient-to-r from-pink-500 to-blue-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Logs Section */}
          <div className="p-2 sm:p-4 font-mono text-xs sm:text-sm bg-gray-900 rounded-lg max-h-48 overflow-y-auto">
            <div className="text-green-400">
              {logs.map((log, index) => (
                <div key={index} className="py-0.5 sm:py-1 break-words">
                  {`> ${log}`}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="italic text-gray-500">
                  {">"} Waiting for Miku's power...
                </div>
              )}
            </div>
          </div>

          {/* Cute Animation Overlay */}
          {isAttacking && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/10 to-blue-500/10 animate-pulse" />
              <div className="absolute top-0 -translate-x-1/2 left-1/2">
                <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" />
              </div>
            </div>
          )}
        </div>

        {openedConfig && <ConfigureProxiesAndAgentsView addToast={addToast} onClose={() => setOpenedConfig(false)} />}

        {/* Port Scan Results Modal */}
        {showScanResults && scanResults.length > 0 && (
          <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-md shadow-lg w-full max-w-lg p-4 sm:p-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800">🔍 Port Scan Results</h2>
                <button
                  onClick={() => setShowScanResults(false)}
                  className="text-gray-500 hover:text-gray-700 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 px-2 sm:px-4">Port</th>
                      <th className="py-2 px-2 sm:px-4">Service</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scanResults.map((result, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 sm:px-4 font-mono text-pink-600">{result.port}</td>
                        <td className="py-2 px-2 sm:px-4">{result.service}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Found {scanResults.length} open port(s)
              </p>
            </div>
          </div>
        )}

        {/* Recommendation Display */}
        {recommendation && (
          <div className="fixed bottom-4 right-4 left-4 sm:left-auto bg-yellow-100 border border-yellow-300 rounded-lg p-3 sm:p-4 shadow-lg max-w-sm z-30">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-yellow-800 text-sm sm:text-base">💡 Recommended Method</p>
                <p className="text-xs sm:text-sm text-yellow-700 break-words">{recommendation.reason}</p>
              </div>
              <button
                onClick={() => setRecommendation(null)}
                className="text-yellow-600 hover:text-yellow-800 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} removeToast={removeToast} />

        <div className="flex flex-col items-center">
          <span className="text-sm text-center text-gray-500">
            🎵 v1.0 made by{" "}
            <a
              href="https://github.com/sammwyy/mikumikubeam"
              target="_blank"
              rel="noreferrer"
            >
              @Sammwy
            </a>{" "}
            🎵
          </span>
          <span>
            <input
              className="shadow-sm volume_bar focus:border-pink-500"
              type="range"
              min="0"
              max="100"
              step="5"
              draggable="false"
              value={audioVol}
              onChange={(e) => setAudioVol(parseInt(e.target?.value))}
            />
          </span>
        </div>
      </div>
    </div>
  );
}

export default App;
