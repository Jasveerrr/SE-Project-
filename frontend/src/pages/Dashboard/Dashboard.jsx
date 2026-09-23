import { useEffect, useMemo, useState } from "react";
import { DeviceCard } from "../../components/device/DeviceCard/DeviceCard.jsx";
import { Loader } from "../../components/ui/Loader/Loader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useDevices } from "../../hooks/useDevices.js";
import { useTransfers } from "../../hooks/useTransfers.js";
import { pairingService } from "../../services/pairingService.js";
import { deviceService } from "../../services/deviceService.js";
import { transferService } from "../../services/transferService.js";
import { socketClient } from "../../socket/socketClient.js";
import { TransferCard } from "../../components/transfer/TransferCard/TransferCard.jsx";

const DEVICE_KEY = "swiftshare_device_id";

function getLocalDeviceId(userId) {
  const stored = localStorage.getItem(DEVICE_KEY);
  if (stored) return stored;
  const id = `web-${userId}`;
  localStorage.setItem(DEVICE_KEY, id);
  return id;
}

function mergeTransfer(list, transfer) {
  if (!transfer) return list;
  const index = list.findIndex((item) => item.transferId === transfer.transferId);
  if (index < 0) return [transfer, ...list];
  return list.map((item, itemIndex) => (itemIndex === index ? transfer : item));
}

export function Dashboard() {
  const { user, token } = useAuth();
  const {
    devices,
    loading: devicesLoading,
    error: devicesError,
    refresh: refreshDevices,
  } = useDevices();
  const {
    transfers,
    loading: transfersLoading,
    error: transfersError,
    setTransfers,
  } = useTransfers();
  const [ownDevice, setOwnDevice] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [incomingPairing, setIncomingPairing] = useState(null);

  useEffect(() => {
    const deviceId = getLocalDeviceId(user.id);
    const payload = {
      deviceId,
      deviceName: user.displayName || "This browser",
      ipAddress: "127.0.0.1",
      platform: "WEB",
    };
    deviceService
      .discover(payload)
      .then(setOwnDevice)
      .catch((discoverError) => setError(discoverError.message));
  }, [user]);

  useEffect(() => {
    if (!token) return undefined;
    const client = socketClient.connect(token);
    const registerSocketDevice = () => {
      if (!ownDevice) return;
      socketClient
        .emit("device:discover", {
          deviceId: ownDevice.deviceId,
          deviceName: ownDevice.deviceName,
          ipAddress: ownDevice.ipAddress,
          platform: ownDevice.platform,
        })
        .catch(() => undefined);
    };
    const cleanups = [
      socketClient.on("pairing:request", (result) => setIncomingPairing(result?.pairing || result)),
      socketClient.on("transfer:start", (result) =>
        setTransfers((current) => mergeTransfer(current, result?.transfer))
      ),
      socketClient.on("transfer:progress", (result) =>
        setTransfers((current) => mergeTransfer(current, result?.transfer))
      ),
      socketClient.on("transfer:complete", (result) =>
        setTransfers((current) => mergeTransfer(current, result?.transfer))
      ),
      socketClient.on("transfer:cancel", (result) =>
        setTransfers((current) => mergeTransfer(current, result?.transfer))
      ),
    ];
    const handleConnectError = () =>
      setError("Socket connection unavailable. REST actions remain available.");
    const removeConnectListener = socketClient.on("connect", registerSocketDevice);
    client.on("connect_error", handleConnectError);
    registerSocketDevice();
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      removeConnectListener();
      client.off("connect_error", handleConnectError);
      socketClient.disconnect();
    };
  }, [token, ownDevice, setTransfers]);

  const otherDevices = useMemo(
    () => devices.filter((device) => device.deviceId !== ownDevice?.deviceId),
    [devices, ownDevice]
  );

  async function requestPairing(device) {
    setError("");
    setMessage("");
    try {
      await pairingService.request({
        pairingId: crypto.randomUUID(),
        senderDeviceId: ownDevice.deviceId,
        receiverDeviceId: device.deviceId,
      });
      setMessage(`Pairing request sent to ${device.deviceName}.`);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function respondToPairing(action) {
    try {
      await pairingService[action](incomingPairing.pairingId);
      setMessage(`Pairing ${action}ed.`);
      setIncomingPairing(null);
    } catch (responseError) {
      setError(responseError.message);
    }
  }

  async function startTransfer(event) {
    event.preventDefault();
    if (!file || !selectedDevice || !ownDevice) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const transfer = await transferService.start({
        transferId: crypto.randomUUID(),
        senderDeviceId: ownDevice.deviceId,
        receiverDeviceId: selectedDevice.deviceId,
        fileName: file.name,
        fileSize: file.size,
      });
      setTransfers((current) => mergeTransfer(current, transfer));
      setFile(null);
      setMessage("Transfer started. Progress will update from the backend.");
    } catch (startError) {
      setError(startError.message);
    } finally {
      setBusy(false);
    }
  }

  async function changeTransfer(transfer, action) {
    try {
      const updated = await transferService[action](transfer.transferId);
      setTransfers((current) => mergeTransfer(current, updated));
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  return (
    <section className="dashboard-page">
      <div className="page-intro">
        <div>
          <span className="eyebrow">WORKSPACE</span>
          <h1>Good to see you, {user.displayName || user.email.split("@")[0]}.</h1>
          <p className="muted">Choose a device, pair it, and keep transfer state visible.</p>
        </div>
        <button className="button button-secondary" onClick={refreshDevices}>
          Refresh devices
        </button>
      </div>
      {(message || error || devicesError || transfersError) && (
        <div className={error || devicesError || transfersError ? "error-box" : "success-box"}>
          {error || devicesError || transfersError || message}
        </div>
      )}
      {incomingPairing && (
        <div className="notice-box">
          <strong>Incoming pairing request</strong>
          <span>{incomingPairing.senderDeviceId} wants to pair with you.</span>
          <div>
            <button className="button button-primary" onClick={() => respondToPairing("accept")}>
              Accept
            </button>
            <button className="button button-secondary" onClick={() => respondToPairing("reject")}>
              Reject
            </button>
          </div>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">DEVICES</span>
              <h2>Available devices</h2>
            </div>
            <span className="count-badge">{otherDevices.length}</span>
          </div>
          {devicesLoading ? (
            <Loader label="Finding devices..." />
          ) : otherDevices.length ? (
            <div className="device-list">
              {otherDevices.map((device) => (
                <DeviceCard
                  key={device.deviceId}
                  device={device}
                  selected={selectedDevice?.deviceId === device.deviceId}
                  onSelect={setSelectedDevice}
                  onPair={requestPairing}
                />
              ))}
            </div>
          ) : (
            <p className="empty-state">No other devices are registered yet.</p>
          )}
        </section>
        <section className="panel transfer-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">SEND A FILE</span>
              <h2>New transfer</h2>
            </div>
          </div>
          <form onSubmit={startTransfer} className="transfer-form">
            <label>
              Destination
              <select
                value={selectedDevice?.deviceId || ""}
                onChange={(event) =>
                  setSelectedDevice(
                    otherDevices.find((device) => device.deviceId === event.target.value) || null
                  )
                }
                required
              >
                <option value="">Select a device</option>
                {otherDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.deviceName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              File
              <input
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />
            </label>
            {file && (
              <div className="file-preview">
                <strong>{file.name}</strong>
                <span>{file.size.toLocaleString()} bytes</span>
              </div>
            )}
            <button className="button button-primary" disabled={busy || !ownDevice}>
              {busy ? "Starting..." : "Start transfer"}
            </button>
          </form>
          <p className="form-note">
            The backend owns transfer state. This interface never invents progress.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">LIVE STATUS</span>
            <h2>Recent transfers</h2>
          </div>
        </div>
        {transfersLoading ? (
          <Loader label="Loading transfers..." />
        ) : transfers.length ? (
          <div className="transfer-list">
            {transfers.slice(0, 5).map((transfer) => (
              <TransferCard
                key={transfer.transferId}
                transfer={transfer}
                onCancel={(item) => changeTransfer(item, "cancel")}
                onComplete={(item) => changeTransfer(item, "complete")}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">No transfers yet.</p>
        )}
      </section>
    </section>
  );
}
