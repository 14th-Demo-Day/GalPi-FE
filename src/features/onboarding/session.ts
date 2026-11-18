export interface Credentials {
  loginId: string;
  password: string;
}

// The backend adapter must normalize its verified response to this contract.
export type Login = (credentials: Credentials) => Promise<{ accessToken: string }>;

// New storage owned by this app; no pre-existing auth storage exists in this repo.
const TOKEN_KEY = "galpi.accessToken";
type TokenStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createAuthSession(storage: TokenStorage) {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const getAccessToken = () => storage.getItem(TOKEN_KEY);
  return {
    getAccessToken,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    async login(credentials: Credentials, authenticate?: Login) {
      if (!authenticate)
        throw new Error("로그인 API가 아직 연결되지 않았어요. 서버 연결 설정을 확인해 주세요.");
      const result = await authenticate(credentials);
      if (typeof result?.accessToken !== "string" || !result.accessToken.trim())
        throw new Error("로그인 응답에 인증 토큰이 없어요. 다시 시도해 주세요.");
      // Persist before notifying/rendering protected pages or resolving login.
      storage.setItem(TOKEN_KEY, result.accessToken);
      notify();
    },
    clear() {
      storage.removeItem(TOKEN_KEY);
      notify();
    },
  };
}

export const authSession = createAuthSession({
  getItem: (key) => window.sessionStorage.getItem(key),
  setItem: (key, value) => window.sessionStorage.setItem(key, value),
  removeItem: (key) => window.sessionStorage.removeItem(key),
});
