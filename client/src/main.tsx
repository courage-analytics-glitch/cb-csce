import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, Show } from "@clerk/react";
import App from "./App";
import { ApiAuthBridge } from "./auth/ApiAuthBridge";
import { SignInScreen } from "./auth/SignInScreen";

const publishableKey = import.meta.env.CLERK_PUBLISHABLE_KEY;
// Names the variable only; the value is never echoed.
if (!publishableKey) throw new Error("CLERK_PUBLISHABLE_KEY is not configured for the client build.");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey}>
      <Show when="signed-out">
        <SignInScreen />
      </Show>
      <Show when="signed-in">
        <ApiAuthBridge>
          <App />
        </ApiAuthBridge>
      </Show>
    </ClerkProvider>
  </StrictMode>
);
