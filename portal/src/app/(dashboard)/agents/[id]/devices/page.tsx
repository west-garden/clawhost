"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DeviceList } from "@/components/device-list";
import { listDevices } from "@/lib/actions";
import { useAgent } from "@/contexts/agent-context";

interface Device {
  request_id?: string;
  device_id: string;
  platform?: string;
  client_mode?: string;
  ip?: string;
  age?: string;
  status: "pending" | "paired" | "revoked";
  connected?: boolean;
}

export default function DevicesPage() {
  const t = useTranslations();
  const params = useParams();
  const agentId = params.id as string;

  const { isRunning } = useAgent();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function loadDevices() {
    const result = await listDevices(agentId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setDevices(result.devices || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Skip if agent is not running
    if (!isRunning) {
      setLoading(false);
      setDevices([]);
      return;
    }

    loadDevices();

    // Poll every 30s, but only when page is visible
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        loadDevices();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(loadDevices, 30000);
        }
      } else {
        // Stop polling when page is hidden
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    intervalRef.current = setInterval(loadDevices, 30000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [agentId, isRunning]);

  const pendingDevices = devices.filter((d) => d.status === "pending");
  const pairedDevices = devices.filter((d) => d.status === "paired");

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-foreground text-sm">
            {t("agent.devices.pending")} ({pendingDevices.length})
          </span>
        </div>
        <div className="glass-panel-content">
          <DeviceList
            agentId={agentId}
            devices={pendingDevices}
            loading={loading}
            type="pending"
            onRefresh={loadDevices}
          />
        </div>
      </div>

      <div className="glass-panel">
        <div className="glass-panel-header">
          <span className="font-medium text-foreground text-sm">
            {t("agent.devices.paired")} ({pairedDevices.length})
          </span>
        </div>
        <div className="glass-panel-content">
          <DeviceList
            agentId={agentId}
            devices={pairedDevices}
            loading={loading}
            type="paired"
            onRefresh={loadDevices}
          />
        </div>
      </div>
    </div>
  );
}