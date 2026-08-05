import { SocketService } from "../services/SocketService.js";
import { DeviceService } from "../services/DeviceService.js";
import { TransferService } from "../services/TransferService.js";
const ERROR_EVENT = "socket:error";

function handleSocketError(socket, eventName, error, ack) {
  const message = error instanceof Error ? error.message : "An unexpected socket error occurred.";
  console.error(`[socket] ${eventName} failed`, {
    error: message,
    stack: error instanceof Error ? error.stack : undefined,
  });
  const response = { ok: false, event: eventName, message };
  if (typeof ack === "function") ack(response);
  socket.emit(ERROR_EVENT, response);
}
function registerDisconnectHandler(socket, io) {
  socket.on("disconnect", async (reason) => {
    try {
      if (typeof SocketService.handleDisconnect === "function")
        await SocketService.handleDisconnect({ socket, io, reason });
      console.log(`[socket] client disconnected`, { socketId: socket.id, reason });
    } catch (error) {
      handleSocketError(socket, "disconnect", error);
    }
  });
}
export function registerSocketEvents(socket, io) {
  if (!socket || typeof socket.on !== "function") {
    throw new TypeError("registerSocketEvents requires a valid Socket.IO socket instance.");
  }

  registerDisconnectHandler(socket, io);

  socket.on("ping", async (payload = {}, ack) => {
    try {
      const data = await SocketService.handlePing?.({ socket, io, payload, ack });
      const response = { ok: true, event: "ping", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "ping", error, ack);
    }
  });
  socket.on("device:discover", async (payload = {}, ack) => {
    try {
      const data = await DeviceService.discoverDevices?.({ socket, io, payload, ack });
      const response = { ok: true, event: "device:discover", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "device:discover", error, ack);
    }
  });
  socket.on("device:refresh", async (payload = {}, ack) => {
    try {
      const data = await DeviceService.refreshDevices?.({ socket, io, payload, ack });
      const response = { ok: true, event: "device:refresh", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "device:refresh", error, ack);
    }
  });
  socket.on("pairing:request", async (payload = {}, ack) => {
    try {
      const data = await SocketService.requestPairing?.({ socket, io, payload, ack });
      const response = { ok: true, event: "pairing:request", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "pairing:request", error, ack);
    }
  });
  socket.on("pairing:accept", async (payload = {}, ack) => {
    try {
      const data = await SocketService.acceptPairing?.({ socket, io, payload, ack });
      const response = { ok: true, event: "pairing:accept", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "pairing:accept", error, ack);
    }
  });
  socket.on("pairing:reject", async (payload = {}, ack) => {
    try {
      const data = await SocketService.rejectPairing?.({ socket, io, payload, ack });
      const response = { ok: true, event: "pairing:reject", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "pairing:reject", error, ack);
    }
  });
  socket.on("transfer:start", async (payload = {}, ack) => {
    try {
      const data = await TransferService.startTransfer?.({ socket, io, payload, ack });
      const response = { ok: true, event: "transfer:start", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "transfer:start", error, ack);
    }
  });
  socket.on("transfer:progress", async (payload = {}, ack) => {
    try {
      const data = await TransferService.updateTransferProgress?.({ socket, io, payload, ack });
      const response = { ok: true, event: "transfer:progress", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "transfer:progress", error, ack);
    }
  });
  socket.on("transfer:cancel", async (payload = {}, ack) => {
    try {
      const data = await TransferService.cancelTransfer?.({ socket, io, payload, ack });
      const response = { ok: true, event: "transfer:cancel", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "transfer:cancel", error, ack);
    }
  });
  socket.on("transfer:complete", async (payload = {}, ack) => {
    try {
      const data = await TransferService.completeTransfer?.({ socket, io, payload, ack });
      const response = { ok: true, event: "transfer:complete", data };
      if (typeof ack === "function") ack(response);
    } catch (error) {
      handleSocketError(socket, "transfer:complete", error, ack);
    }
  });
}
