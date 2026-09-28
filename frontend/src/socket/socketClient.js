import { io } from "socket.io-client";

const defaultBackendPort = Number(
  import.meta.env.VITE_BACKEND_PORT || import.meta.env.VITE_PORT || 5001
);
const defaultSocketOrigin =
  typeof window === "undefined"
    ? `http://localhost:${defaultBackendPort}`
    : `${window.location.protocol}//${window.location.hostname}:${defaultBackendPort}`;

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  defaultSocketOrigin;

let socket;
let discoverySocket;

function getSocket() {
  if (!socket || socket.io?.uri !== SOCKET_URL) {
    if (socket) socket.disconnect();
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

export const socketClient = {
  connect(token) {
    const client = getSocket();
    client.auth = { token };
    if (!client.connected) client.connect();
    return client;
  },
  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },
  on(event, handler) {
    getSocket().on(event, handler);
    return () => getSocket().off(event, handler);
  },
  emit(event, payload) {
    return new Promise((resolve, reject) => {
      getSocket()
        .timeout(10000)
        .emit(event, payload, (error, response) => {
          if (error) reject(new Error("Socket request timed out."));
          else if (!response?.ok) reject(new Error(response?.message || "Socket request failed."));
          else resolve(response.data);
        });
    });
  },
};

export const nearbySocketClient = {
  connect() {
    if (!discoverySocket || discoverySocket.io?.uri !== `${SOCKET_URL}/discovery`) {
      discoverySocket?.disconnect();
      discoverySocket = io(`${SOCKET_URL}/discovery`, {
        autoConnect: false,
        transports: ["websocket", "polling"],
      });
    }
    if (!discoverySocket.connected) discoverySocket.connect();
    return discoverySocket;
  },
  disconnect() {
    discoverySocket?.disconnect();
    discoverySocket = null;
  },
};
