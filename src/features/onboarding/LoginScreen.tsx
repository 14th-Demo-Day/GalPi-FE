import { useState } from "react";
import type { FormEvent } from "react";
import logo from "../../assets/figma/logo.svg";
import { PasswordField, TextField } from "./fields";
import "./onboarding.css";

export interface LoginCredentials {
  loginId: string;
  password: string;
}

// The login request itself is supplied by the caller, since the auth API is not decided yet.
export function LoginScreen({
  onLogin,
  onSignup,
}: {
  onLogin?: (credentials: LoginCredentials) => void | Promise<void>;
  onSignup?: () => void;
}) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{
    message: string;
    fields: "empty" | "both";
  } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!loginId.trim() || !password) {
      setError({ message: "아이디와 비밀번호를 입력해주세요.", fields: "empty" });
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await onLogin?.({ loginId: loginId.trim(), password });
    } catch (err) {
      setError({
        message:
          err instanceof Error && err.message
            ? err.message
            : "아이디 또는 비밀번호를 확인해주세요.",
        fields: "both",
      });
    } finally {
      setBusy(false);
    }
  }

  const invalid = (empty: boolean) =>
    error?.fields === "both" || (error?.fields === "empty" && empty);

  return (
    <main className="login-screen">
      <header className="login-brand">
        <img src={logo} alt="" width={88} height={100} />
        <h1>갈피</h1>
        <p>기록에서 나의 방향을 찾다</p>
      </header>

      <form className="login-form" onSubmit={submit} noValidate>
        <TextField
          label="아이디"
          name="loginId"
          autoComplete="username"
          placeholder="아이디를 입력해주세요"
          value={loginId}
          onValueChange={setLoginId}
          invalid={invalid(!loginId.trim())}
        />
        <PasswordField
          label="비밀번호"
          name="password"
          autoComplete="current-password"
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onValueChange={setPassword}
          invalid={invalid(!password)}
        />

        {error && (
          <p className="login-error" role="alert">
            {error.message}
          </p>
        )}

        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <p className="login-switch">
        갈피가 처음인가요?{" "}
        <button type="button" onClick={onSignup}>
          회원가입
        </button>
      </p>
    </main>
  );
}
