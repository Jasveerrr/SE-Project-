import { io } from "socket.io-client";

let socket;

function getSocket() {
  if (!socket) {
    socket = io(
      import.meta.env.VITE_SOCKET_URL ||
        import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
        "http://localhost:5000",
      {
        autoConnect: false,
        transports: ["websocket", "polling"],
      }
    );
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
    if (socket?.connected) socket.disconnect();
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
