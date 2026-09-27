const DISCOVERY_TTL_MS = 30_000;

const toString = (value) => (typeof value === "string" ? value.trim() : "");

function cleanAddress(value) {
  const address = toString(value).replace(/^::ffff:/, "");
  return address === "::1" ? "127.0.0.1" : address;
}

function sanitizeAnnouncement(payload = {}) {
  const temporaryId = toString(payload.temporaryId);
  if (!temporaryId || temporaryId.length > 100) return null;

  return {
    temporaryId,
    deviceName: toString(payload.deviceName).slice(0, 100) || "SwiftShare browser",
    platform: toString(payload.platform).slice(0, 30).toUpperCase() || "WEB",
    registered: Boolean(payload.registered),
  };
}

function serializePeer(peer) {
  return {
    temporaryId: peer.temporaryId,
    deviceName: peer.deviceName,
    platform: peer.platform,
    registered: peer.registered,
    ipAddress: peer.ipAddress || undefined,
    lastSeenAt: peer.lastSeenAt,
  };
}

export function registerDiscoveryNamespace(io) {
  const namespace = io.of("/discovery");
  const peers = new Map();

  const removeExpired = () => {
    const cutoff = Date.now() - DISCOVERY_TTL_MS;
    let changed = false;
    for (const [temporaryId, peer] of peers) {
      if (peer.lastSeenAtMs < cutoff) {
        peers.delete(temporaryId);
        changed = true;
      }
    }
    return changed;
  };

  const broadcast = () => {
    removeExpired();
    namespace.emit("nearby:update", { devices: [...peers.values()].map(serializePeer) });
  };

  namespace.on("connection", (socket) => {
    socket.on("nearby:announce", (payload = {}, acknowledge) => {
      const announcement = sanitizeAnnouncement(payload);
      if (!announcement) {
        acknowledge?.({ ok: false, message: "A valid temporary discovery ID is required." });
        return;
      }

      peers.set(announcement.temporaryId, {
        ...announcement,
        socketId: socket.id,
        ipAddress: cleanAddress(socket.handshake.address),
        lastSeenAt: new Date().toISOString(),
        lastSeenAtMs: Date.now(),
      });
      acknowledge?.({ ok: true });
      broadcast();
    });

    socket.on("disconnect", () => {
      for (const [temporaryId, peer] of peers) {
        if (peer.socketId === socket.id) peers.delete(temporaryId);
      }
      broadcast();
    });
  });

  const cleanupTimer = setInterval(broadcast, DISCOVERY_TTL_MS / 2);
  cleanupTimer.unref?.();

  return namespace;
}
