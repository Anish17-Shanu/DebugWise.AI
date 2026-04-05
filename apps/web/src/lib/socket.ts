function resolveSocketUrl(): string {
  const configured = import.meta.env.VITE_DEBUGWISE_WS_URL;
  if (configured) {
    if (configured.startsWith("/")) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}${configured}`;
    }
    return configured;
  }

  if (import.meta.env.DEV) {
    return "ws://localhost:4000/ws";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

const socketUrl = resolveSocketUrl();

export function connectSocket(onMessage: (data: unknown) => void): WebSocket {
  const socket = new WebSocket(socketUrl);
  socket.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };
  return socket;
}
