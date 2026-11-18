import { useSyncExternalStore } from "react";
import { ActivityApp } from "./features/activity/ActivityApp";
import { createActivityApi } from "./features/activity/api";
import type { ActivityApi } from "./features/activity/api";
import { getRoute, go, subscribeRoute } from "./features/activity/navigation";
import { LoginScreen } from "./features/onboarding/LoginScreen";
import { SignupScreen } from "./features/onboarding/SignupScreen";
import { integration } from "./integration";

const serverApi = createActivityApi({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  getAccessToken: () => integration.getAccessToken(),
  onUnauthorized: () => integration.onUnauthorized?.(),
});
export default function App({ api = serverApi }: { api?: ActivityApi }) {
  const path = useSyncExternalStore(subscribeRoute, getRoute);
  if (path === "/login")
    return (
      <LoginScreen
        // TODO: call the login API here once the backend is connected.
        onLogin={() => go("/activity")}
        onSignup={() => go("/signup")}
      />
    );
  if (path === "/signup")
    return <SignupScreen onLogin={() => go("/login")} />;
  return <ActivityApp api={api} onNavigate={integration.onNavigate} />;
}
