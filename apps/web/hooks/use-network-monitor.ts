import { useState, useEffect, useCallback } from "react";

interface NetworkStats {
  downlink: number | null; // Mbps
  rtt: number | null; // ms
  effectiveType: string; // 'slow-2g', '2g', '3g', or '4g'
  saveData: boolean; // Whether data saver is enabled
  quality: "low" | "medium" | "high"; // Derived quality level
}

export function useNetworkMonitor() {
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    downlink: null,
    rtt: null,
    effectiveType: "4g",
    saveData: false,
    quality: "high",
  });

  // Update network stats
  const updateNetworkStats = useCallback(() => {
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;

      if (connection) {
        const downlink = connection.downlink || null;
        const rtt = connection.rtt || null;
        const effectiveType = connection.effectiveType || "4g";
        const saveData = connection.saveData || false;

        // Determine quality level based on network conditions
        let quality: "low" | "medium" | "high" = "high";

        if (saveData || effectiveType === "slow-2g" || effectiveType === "2g") {
          quality = "low";
        } else if (
          effectiveType === "3g" ||
          (downlink && downlink < 1.5) ||
          (rtt && rtt > 300)
        ) {
          quality = "medium";
        }

        setNetworkStats({
          downlink,
          rtt,
          effectiveType,
          saveData,
          quality,
        });

        console.log("Network stats updated:", {
          downlink,
          rtt,
          effectiveType,
          saveData,
          quality,
        });
      }
    }
  }, []);

  // Monitor network changes
  useEffect(() => {
    // Initial update
    updateNetworkStats();

    // Set up event listeners for network changes
    if ("connection" in navigator) {
      const connection = (navigator as any).connection;

      if (connection) {
        connection.addEventListener("change", updateNetworkStats);

        return () => {
          connection.removeEventListener("change", updateNetworkStats);
        };
      }
    }

    // Fallback: periodically check network status
    const intervalId = setInterval(() => {
      updateNetworkStats();
    }, 10000); // Check every 10 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [updateNetworkStats]);

  return networkStats;
}
