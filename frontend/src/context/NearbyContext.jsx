import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { nearbySocketClient } from "../socket/socketClient.js";

const NEARBY_ID_KEY = "swiftshare_nearby_id";
const NearbyContext = createContext(null);

function getTemporaryId() {
  const stored = localStorage.getItem(NEARBY_ID_KEY);
  if (stored) return stored;
  const temporaryId = `nearby-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
  localStorage.setItem(NEARBY_ID_KEY, temporaryId);
  return temporaryId;
}

export function NearbyProvider({ children }) {
  const { user } = useAuth();
  const [nearbyDevices, setNearbyDevices] = useState([]);

  useEffect(() => {
    const socket = nearbySocketClient.connect();
    const temporaryId = getTemporaryId();
    const announce = () => {
      socket.emit("nearby:announce", {
        temporaryId,
        deviceName: user?.displayName ? `${user.displayName}'s browser` : "SwiftShare browser",
        platform: "WEB",
        registered: Boolean(user),
      });
    };
    const handleUpdate = (result) =>
      setNearbyDevices(
        (result?.devices || []).filter((device) => device.temporaryId !== temporaryId)
      );
    socket.on("nearby:update", handleUpdate);
    socket.on("connect", announce);
    announce();
    const heartbeat = window.setInterval(announce, 10_000);

    return () => {
      window.clearInterval(heartbeat);
      socket.off("nearby:update", handleUpdate);
      socket.off("connect", announce);
      nearbySocketClient.disconnect();
      setNearbyDevices([]);
    };
  }, [user]);

  return <NearbyContext.Provider value={{ nearbyDevices }}>{children}</NearbyContext.Provider>;
}

export function useNearby() {
  const context = useContext(NearbyContext);
  if (!context) throw new Error("useNearby must be used within NearbyProvider.");
  return context;
}
