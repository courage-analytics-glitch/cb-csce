import { SignIn } from "@clerk/react";

/**
 * Full-page sign-in. The app is invite-only: sign-up is disabled in the component
 * and its footer link is hidden. Restricted sign-up mode in the Clerk dashboard is
 * the actual enforcement; this only removes the entry point from the UI.
 */
export function SignInScreen() {
  return (
    <div className="signin-screen">
      <div className="signin-brand">
        <div className="brand-mark"><span>↗</span></div>
        <div>
          <strong>CB-CSCE</strong>
          <small>Cross-border settlement · invite-only access</small>
        </div>
      </div>
      <SignIn routing="hash" withSignUp={false} appearance={{ elements: { footerAction: { display: "none" } } }} />
    </div>
  );
}
