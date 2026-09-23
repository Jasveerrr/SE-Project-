function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return `${value} bytes`;
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes;
  let unit = -1;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function TransferCard({ transfer, onCancel, onComplete }) {
  const terminal = ["COMPLETED", "CANCELLED", "FAILED"].includes(transfer.status);
  return (
    <article className="transfer-card">
      <div className="transfer-heading">
        <div>
          <strong>{transfer.fileName}</strong>
          <small>
            {formatBytes(transfer.fileSize)} · {transfer.status}
          </small>
        </div>
        <span className={`status-pill status-${transfer.status.toLowerCase()}`}>
          {transfer.progress}%
        </span>
      </div>
      <div className="progress-track">
        <span style={{ width: `${transfer.progress}%` }} />
      </div>
      <div className="transfer-meta">
        <span>{transfer.senderDeviceId}</span>
        <span>to</span>
        <span>{transfer.receiverDeviceId}</span>
      </div>
      {!terminal && (
        <div className="card-actions">
          <button className="text-action" onClick={() => onCancel?.(transfer)}>
            Cancel
          </button>
          <button className="text-action" onClick={() => onComplete?.(transfer)}>
            Complete
          </button>
        </div>
      )}
    </article>
  );
}
