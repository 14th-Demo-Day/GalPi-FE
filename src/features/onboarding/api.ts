import { ApiError } from "../activity/api.ts";
import type { Credentials } from "./session";

// Verified against GalPi-BE AuthController, LoginRequest and ApiResponse.
export function createAuthApi(baseUrl: string) {
  async function request<T>(path: string, credentials: Credentials): Promise<T> {
    if (!baseUrl)
      throw new ApiError("서버 연결을 확인해 주세요.", "API_NOT_CONFIGURED");
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
    } catch {
      throw new ApiError("연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success === false)
      throw new ApiError(
        body?.message || "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
        body?.code || "REQUEST_FAILED",
        response.status,
      );
    if (body?.success !== true || !body.data)
      throw new ApiError("서버 응답을 확인해 주세요.", "INVALID_RESPONSE", response.status);
    return body.data as T;
  }
  return {
    login: (credentials: Credentials) =>
      request<{ accessToken: string; tokenType: string }>("/api/auth/login", credentials),
    signup: (credentials: Credentials) =>
      request<{ userId: number }>("/api/auth/signup", credentials),
  };
}
