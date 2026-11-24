import { authSession } from "./features/onboarding/session";
import { createAuthApi } from "./features/onboarding/api";
import type { Credentials, Login } from "./features/onboarding/session";

const authApi = createAuthApi(import.meta.env.VITE_API_BASE_URL || "");

export const integration: {
  login: Login;
  signup: (credentials: Credentials) => Promise<unknown>;
  getAccessToken: () => string | null;
  onUnauthorized: () => void;
  onNavigate?: (destination: "roadmap" | "connections" | "settings") => void;
} = {
  login: authApi.login,
  signup: authApi.signup,
  getAccessToken: authSession.getAccessToken,
  onUnauthorized: authSession.clear,
};
