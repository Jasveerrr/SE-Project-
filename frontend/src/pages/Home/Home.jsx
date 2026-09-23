import { Link } from "react-router-dom";

export function Home() {
  return (
    <main className="public-page">
      <div className="public-copy">
        <span className="eyebrow">PRIVATE DEVICE-TO-DEVICE SHARING</span>
        <h1>Move files with less friction.</h1>
        <p>
          SwiftShare keeps your devices, pairing requests, and transfer status in one focused
          workspace.
        </p>
        <div className="hero-actions">
          <Link className="button button-primary" to="/register">
            Create account
          </Link>
          <Link className="button button-secondary" to="/login">
            Sign in
          </Link>
        </div>
      </div>
      <div className="hero-panel">
        <span>READY WHEN YOU ARE</span>
        <strong>Connect. Pair. Transfer.</strong>
        <div className="hero-line" />
      </div>
    </main>
  );
}
