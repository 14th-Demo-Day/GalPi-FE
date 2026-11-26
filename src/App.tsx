import { useSyncExternalStore } from "react";
import { ActivityApp } from "./features/activity/ActivityApp";
import { createActivityApi } from "./features/activity/api";
import type { ActivityApi } from "./features/activity/api";
import { getRoute, go, subscribeRoute } from "./features/activity/navigation";
import { LoginScreen } from "./features/onboarding/LoginScreen";
import { SignupScreen } from "./features/onboarding/SignupScreen";
import { RoadmapScreen } from "./features/roadmap/RoadmapScreen";
import { ConnectionApp } from "./features/connection/ConnectionApp";
import { connectionApiFor } from "./features/connection/api";
import { SettingsApp } from "./features/settings/SettingsApp";
import { createSettingsApi } from "./features/settings/settings";
import type { SettingsApi } from "./features/settings/settings";
import { integration } from "./integration";
import { authSession } from "./features/onboarding/session";

const serverApi = createActivityApi({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  getAccessToken: () => integration.getAccessToken(),
  onUnauthorized: () => integration.onUnauthorized?.(),
});
const settingsApis = new WeakMap<ActivityApi, SettingsApi>();
function settingsApiFor(api: ActivityApi) {
  let value = settingsApis.get(api);
  if (!value)
    settingsApis.set(api, (value = createSettingsApi(api)));
  return value;
}
export default function App({ api = serverApi }: { api?: ActivityApi }) {
  const path = useSyncExternalStore(subscribeRoute, getRoute);
  const token = useSyncExternalStore(authSession.subscribe, authSession.getAccessToken);
  const loginId = useSyncExternalStore(authSession.subscribe, authSession.getLoginId);
  const needsLogin = api === serverApi && !token && path !== "/signup";
  if (path === "/login" || needsLogin)
    return (
      <LoginScreen
        onLogin={async (credentials) => {
          if (api === serverApi)
            await authSession.login(credentials, integration.login);
          else authSession.rememberLoginId(credentials.loginId);
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
  const navigate = (
    destination: "roadmap" | "activity" | "connections" | "settings",
  ) => {
    if (destination === "roadmap") go("/roadmap");
    else if (destination === "activity") go("/activity");
    else if (destination === "connections") go("/connections");
    else go("/settings");
  };
  if (path === "/settings" || path === "/settings/password")
    return (
      <SettingsApp
        api={settingsApiFor(api)}
        path={path}
        loginId={loginId}
        onBack={() => go("/activity")}
        onLogout={() => {
          authSession.clear();
          go("/login");
        }}
      />
    );
  if (path === "/connections" || path.startsWith("/connections/"))
    return (
      <ConnectionApp
        api={connectionApiFor(api)}
        path={path}
        onNavigate={navigate}
      />
    );
  if (path === "/roadmap" || path === "/roadmap/quarterly")
    return (
      <RoadmapScreen
        api={api}
        view={path === "/roadmap" ? "annual" : "quarterly"}
        onToggleView={() =>
          go(path === "/roadmap" ? "/roadmap/quarterly" : "/roadmap")
        }
        onOpenBook={(id) => go(`/activity/books/${id}`)}
        onCreateBook={() => go("/activity/new")}
        onNavigate={navigate}
      />
    );
  return <ActivityApp api={api} onNavigate={navigate} />;
}
