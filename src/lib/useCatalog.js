import { useEffect, useState } from 'react';
import { api } from '../api.js';

const catalogCache = new Map();

// The appliance list for "home" or "business". Fetched once per visit, then reused.
export function useCatalog(segment) {
  const [state, setState] = useState({ data: catalogCache.get(segment) ?? null, error: null });

  useEffect(() => {
    if (!segment) return undefined;
    if (catalogCache.has(segment)) {
      setState({ data: catalogCache.get(segment), error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ data: null, error: null });
    api
      .catalog(segment)
      .then((data) => {
        catalogCache.set(segment, data);
        if (!cancelled) setState({ data, error: null });
      })
      .catch((err) => !cancelled && setState({ data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [segment]);

  return state;
}
