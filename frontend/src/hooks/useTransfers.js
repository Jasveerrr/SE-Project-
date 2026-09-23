import { useCallback, useEffect, useState } from "react";
import { transferService } from "../services/transferService.js";

export function useTransfers(params = {}) {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTransfers(await transferService.list(params));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    load();
  }, [load]);
  return { transfers, loading, error, refresh: load, setTransfers };
}
