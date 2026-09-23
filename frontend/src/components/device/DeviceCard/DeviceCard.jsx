export function DeviceCard({ device, selected, onSelect, onPair, own }) {
  return (
    <article className={`device-card ${selected ? "selected" : ""}`}>
      <button className="device-select" onClick={() => onSelect?.(device)} disabled={own}>
        <span className="device-icon">{device.platform === "WEB" ? "W" : "D"}</span>
        <span className="device-copy">
          <strong>{device.deviceName}</strong>
          <small>
            {device.platform} · {device.status}
          </small>
        </span>
        <span className={`status-dot ${device.status === "connected" ? "online" : "offline"}`} />
      </button>
      {!own && (
        <button className="text-action" onClick={() => onPair?.(device)}>
          Pair device
        </button>
      )}
    </article>
  );
}
