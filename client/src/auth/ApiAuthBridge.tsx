import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/react";
import { setTokenProvider } from "../data/api";

/**
 * Registers Clerk's getToken with the API client, and only then renders children.
 * Children are withheld until registration because child effects run before parent
 * effects, so their first fetches would otherwise go out with no provider set.
 */
export function ApiAuthBridge({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    setTokenProvider(() => getTokenRef.current());
    setReady(true);
    return () => setTokenProvider(null);
  }, []);

  return ready ? <>{children}</> : null;
}
