import { useSyncExternalStore } from "react";
import { ActivityApp } from "./features/activity/ActivityApp";
import { createActivityApi } from "./features/activity/api";
import type { ActivityApi } from "./features/activity/api";
import { getRoute, go, subscribeRoute } from "./features/activity/navigation";
import { LoginScreen } from "./features/onboarding/LoginScreen";
import { SignupScreen } from "./features/onboarding/SignupScreen";
import { integration } from "./integration";
import { authSession } from "./features/onboarding/session";

const serverApi = createActivityApi({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  getAccessToken: () => integration.getAccessToken(),
  onUnauthorized: () => integration.onUnauthorized?.(),
});
export default function App({ api = serverApi }: { api?: ActivityApi }) {
  const path = useSyncExternalStore(subscribeRoute, getRoute);
  const token = useSyncExternalStore(authSession.subscribe, authSession.getAccessToken);
  const needsLogin = api === serverApi && !token && path !== "/signup";
  if (path === "/login" || needsLogin)
    return (
      <LoginScreen
        onLogin={async (credentials) => {
          if (api === serverApi)
            await authSession.login(credentials, integration.login);
          go("/activity");
        }}
        onSignup={() => go("/signup")}
      />
    );
  if (path === "/signup")
    return (
      <SignupScreen
        onSignup={async (credentials) => {
          if (api === serverApi) await integration.signup(credentials);
          go("/login");
        }}
        onLogin={() => go("/login")}
      />
    );
  return <ActivityApp api={api} onNavigate={integration.onNavigate} />;
}
