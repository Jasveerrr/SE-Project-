export function DeviceCard({ device, selected, onSelect, onPair, onRemove, own }) {
  return (
    <article className={`device-card ${selected ? "selected" : ""}`}>
      <button className="device-select" onClick={() => onSelect?.(device)} disabled={own}>
        <span className="device-icon">{device.platform === "WEB" ? "W" : "D"}</span>
        <span className="device-copy">
          <strong>{device.deviceName}</strong>
          {device.user?.email && <span className="device-email">{device.user.email}</span>}
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
      {own && device.status !== "connected" && (
        <button className="text-action danger-action" onClick={() => onRemove?.(device)}>
          Remove
        </button>
      )}
    </article>
  );
}
