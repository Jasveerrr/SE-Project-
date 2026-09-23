import { Loader } from "../../components/ui/Loader/Loader.jsx";
import { TransferCard } from "../../components/transfer/TransferCard/TransferCard.jsx";
import { useTransfers } from "../../hooks/useTransfers.js";

export function History() {
  const { transfers, loading, error } = useTransfers();
  return (
    <section className="content-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ARCHIVE</span>
          <h1>Transfer history</h1>
          <p className="muted">A record of transfer state returned by SwiftShare.</p>
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}
      {loading ? (
        <Loader label="Loading history..." />
      ) : transfers.length ? (
        <div className="transfer-list">
          {transfers.map((transfer) => (
            <TransferCard key={transfer.transferId} transfer={transfer} />
          ))}
        </div>
      ) : (
        <div className="empty-state large">No transfer history yet.</div>
      )}
    </section>
  );
}
