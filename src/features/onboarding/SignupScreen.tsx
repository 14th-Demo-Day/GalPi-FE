import { useState } from "react";
import type { FormEvent } from "react";
import back from "../../assets/figma/38-652-imgBack.svg";
import { PasswordField, TextField } from "./fields";
import "./onboarding.css";

export interface SignupInput {
  loginId: string;
  password: string;
}

type Errors = Partial<Record<"loginId" | "password" | "confirm", string>>;

function validate(loginId: string, password: string, confirm: string) {
  const errors: Errors = {};
  if (!loginId.trim()) errors.loginId = "아이디를 입력해주세요.";
  if (!password) errors.password = "비밀번호를 입력해주세요.";
  if (!confirm) errors.confirm = "비밀번호를 한 번 더 입력해주세요.";
  else if (password !== confirm) errors.confirm = "비밀번호가 일치하지 않아요.";
  return errors;
}

// The signup request is supplied by the caller, since the auth API is not decided yet.
export function SignupScreen({
  onSignup,
  onLogin,
}: {
  onSignup?: (input: SignupInput) => void | Promise<void>;
  onLogin?: () => void;
}) {
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");

  // Errors appear after the first submit, then update as the user types.
  const errors = submitted ? validate(loginId, password, confirm) : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setServerError("");
    if (Object.keys(validate(loginId, password, confirm)).length) return;
    setBusy(true);
    try {
      await onSignup?.({ loginId: loginId.trim(), password });
    } catch (err) {
      setServerError(
        err instanceof Error && err.message
          ? err.message
          : "회원가입에 실패했어요. 다시 시도해주세요.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen signup-screen">
      <button type="button" className="signup-back" onClick={onLogin}>
        <img src={back} alt="" width={20} height={20} />
        로그인
      </button>

      <header className="signup-heading">
        <h1>갈피 시작하기</h1>
        <p>경험을 한 권씩, 나답게 쌓아가요.</p>
      </header>

      <form className="login-form" onSubmit={submit} noValidate>
        <TextField
          label="아이디"
          name="loginId"
          autoComplete="username"
          placeholder="사용할 아이디를 입력해주세요"
          value={loginId}
          onValueChange={setLoginId}
          error={errors.loginId}
        />
        <PasswordField
          label="비밀번호"
          name="password"
          autoComplete="new-password"
          placeholder="비밀번호를 입력해주세요"
          value={password}
          onValueChange={setPassword}
          error={errors.password}
        />
        <PasswordField
          label="비밀번호 확인"
          name="passwordConfirm"
          autoComplete="new-password"
          placeholder="비밀번호를 한 번 더 입력해주세요"
          value={confirm}
          onValueChange={setConfirm}
          error={errors.confirm}
        />

        {serverError && (
          <p className="login-error" role="alert">
            {serverError}
          </p>
        )}

        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? "가입 중…" : "회원가입"}
        </button>
      </form>

      <p className="login-switch">
        이미 계정이 있나요?{" "}
        <button type="button" onClick={onLogin}>
          로그인
        </button>
      </p>
    </main>
  );
}
