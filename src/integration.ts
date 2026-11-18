// Replace these callbacks when the teammate's login/router is connected.
// This module deliberately does not pick a token-storage key or invent login routes.
export const integration: {
  getAccessToken: () => string | null | Promise<string | null>;
  onUnauthorized?: () => void;
  onNavigate?: (destination: "roadmap" | "connections" | "settings") => void;
} = { getAccessToken: () => null };
