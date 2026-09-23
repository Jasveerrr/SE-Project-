import { useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";

export function Settings() {
  const { user, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await updateProfile({ displayName });
      setMessage("Profile updated.");
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="content-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">ACCOUNT</span>
          <h1>Settings</h1>
          <p className="muted">Keep your profile details current.</p>
        </div>
      </div>
      <form className="settings-card" onSubmit={submit}>
        {(message || error) && (
          <div className={error ? "error-box" : "success-box"}>{error || message}</div>
        )}
        <label>
          Email
          <input value={user.email} disabled />
        </label>
        <label>
          Display name
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            maxLength="100"
            required
          />
        </label>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving..." : "Save changes"}
        </button>
      </form>
    </section>
  );
}
