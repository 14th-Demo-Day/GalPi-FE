import { ActivityApp } from "./features/activity/ActivityApp";
import { createActivityApi } from "./features/activity/api";
import { integration } from "./integration";

const api = createActivityApi({
  baseUrl: import.meta.env.VITE_API_BASE_URL || "",
  getAccessToken: () => integration.getAccessToken(),
  onUnauthorized: () => integration.onUnauthorized?.(),
});
export default function App() {
  return <ActivityApp api={api} onNavigate={integration.onNavigate} />;
}
