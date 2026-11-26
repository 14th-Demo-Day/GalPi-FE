import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { go, registerNavigationGuard } from "../activity/navigation";
import { ErrorMessage, Icon, IconButton, Modal } from "../activity/ui";
import { PasswordField } from "../onboarding/fields";
import { passwordFieldError, validatePassword } from "./settings";
import type {
  Me,
  PasswordErrors,
  PasswordInput,
  SettingsApi,
} from "./settings";
import "../activity/activity.css";
import "../onboarding/onboarding.css";
import "./settings.css";

type Dialog =
  | "logout"
  | "reset-confirm"
  | "reset-running"
  | "reset-done"
  | "reset-empty"
  | "password-done"
  | null;

export function SettingsApp({
  api,
  path,
  loginId,
  onLogout,
  onBack,
}: {
  api: SettingsApi;
  path: string;
  loginId: string | null;
  onLogout: () => void;
  onBack: () => void;
}) {
  const [dialog, setDialog] = useState<Dialog>(null);
  if (path === "/settings/password")
    return (
      <PasswordScreen
        api={api}
        onDone={() => {
          setDialog("password-done");
          go("/settings");
        }}
      />
    );
  return (
    <SettingsHome
      api={api}
      loginId={loginId}
      dialog={dialog}
      setDialog={setDialog}
      onLogout={onLogout}
      onBack={onBack}
    />
  );
}

function SettingsHome({
  api,
  loginId,
  dialog,
  setDialog,
  onLogout,
  onBack,
}: {
  api: SettingsApi;
  loginId: string | null;
  dialog: Dialog;
  setDialog: (d: Dialog) => void;
  onLogout: () => void;
  onBack: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // Show the session's login id right away, then the server's.
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    const c = new AbortController();
    api
      .me(c.signal)
      .then((m) => {
        if (!c.signal.aborted) setMe(m);
      })
      .catch(() => {});
    return () => c.abort();
  }, [api]);

  async function askReset() {
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const fresh = await api.me();
      setMe(fresh);
      setDialog(fresh.hasRecords ? "reset-confirm" : "reset-empty");
    } catch (e) {
      setError(e);
    } finally {
      setChecking(false);
    }
  }
  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } catch {
      // Sign out locally even if the server call fails (offline, expired token).
    } finally {
      onLogout();
    }
  }
  async function reset() {
    setDialog("reset-running");
    setError(null);
    try {
      await api.resetRecords();
      setMe((m) => m && { ...m, hasRecords: false });
      setDialog("reset-done");
    } catch (e) {
      setError(e);
      setDialog("reset-confirm");
    }
  }
  const close = () => {
    setDialog(null);
    setError(null);
  };

  return (
    <section className="screen settings-screen">
      <TitleBar title="설정" onBack={onBack} />
      <h2 className="settings-section">계정</h2>
      <div className="settings-account">
        <strong>내 아이디</strong>
        <span>{me?.loginId || loginId || "—"}</span>
      </div>
      <button
        type="button"
        className="settings-row"
        onClick={() => go("/settings/password")}
      >
        비밀번호 변경
        <Icon name="next" />
      </button>
      <h2 className="settings-section">기록 관리</h2>
      <button
        type="button"
        className="settings-row danger"
        disabled={checking}
        onClick={askReset}
      >
        기록 초기화
        <Icon name="next" />
      </button>
      {!dialog && <ErrorMessage error={error} />}
      <button
        type="button"
        className="settings-logout"
        onClick={() => setDialog("logout")}
      >
        로그아웃
      </button>

      {dialog === "logout" && (
        <SettingsDialog
          title="로그아웃할까요?"
          onClose={() => {
            if (!loggingOut) close();
          }}
          body={
            <>
              저장한 기록은 그대로 유지돼요.
              <br />
              다시 로그인하면 이어서 볼 수 있어요.
            </>
          }
          actions={
            <div className="confirm-actions">
              <button
                type="button"
                className="soft"
                disabled={loggingOut}
                onClick={close}
              >
                취소
              </button>
              <button
                type="button"
                className="primary"
                disabled={loggingOut}
                onClick={logout}
              >
                {loggingOut ? "로그아웃 중…" : "로그아웃"}
              </button>
            </div>
          }
        />
      )}
      {dialog === "reset-confirm" && (
        <SettingsDialog
          title="기록을 초기화할까요?"
          onClose={close}
          body={
            <>
              책, 속지, 첨부 자료와 저장한 문장이 모두 삭제돼요.
              <br />
              로드맵도 비워져요.
              <span className="dialog-gap" />
              아이디와 비밀번호는 유지돼요. 삭제한 기록은 되돌릴 수 없어요.
            </>
          }
          actions={
            <>
              <ErrorMessage error={error} />
              <div className="confirm-actions">
                <button type="button" className="soft" onClick={close}>
                  취소
                </button>
                <button type="button" className="muted-button" onClick={reset}>
                  모든 기록 삭제
                </button>
              </div>
            </>
          }
        />
      )}
      {dialog === "reset-running" && (
        <SettingsDialog
          title="기록을 삭제하고 있어요"
          icon={<span className="dialog-spinner" aria-hidden="true" />}
          onClose={() => {}}
          body="초기화가 끝날 때까지 기다려주세요."
          actions={
            <button type="button" className="muted-button wide" disabled>
              처리 중
            </button>
          }
        />
      )}
      {dialog === "reset-done" && (
        <SettingsDialog
          title="초기화가 완료됐어요"
          icon={<DoneIcon />}
          onClose={close}
          body={
            <>
              책, 속지, 첨부 자료와 저장한 문장을
              <br />
              모두 삭제했어요. 로드맵도 비워졌어요.
              <span className="dialog-gap" />
              아이디와 비밀번호는 그대로예요.
            </>
          }
          actions={
            <button type="button" className="primary" onClick={close}>
              설정으로 돌아가기
            </button>
          }
        />
      )}
      {dialog === "reset-empty" && (
        <SettingsDialog
          title="초기화할 기록이 없어요"
          onClose={close}
          body={
            <>
              아직 저장한 책이나 문장이 없어요.
              <br />
              새로운 경험을 기록해보세요.
            </>
          }
          actions={
            <button type="button" className="primary" onClick={close}>
              확인
            </button>
          }
        />
      )}
      {dialog === "password-done" && (
        <SettingsDialog
          title="비밀번호가 변경됐어요"
          icon={<DoneIcon />}
          onClose={close}
          body={
            <>
              변경한 비밀번호로
              <br />
              갈피를 계속 이용할 수 있어요.
            </>
          }
          actions={
            <button type="button" className="primary" onClick={close}>
              설정으로 돌아가기
            </button>
          }
        />
      )}
    </section>
  );
}

function PasswordScreen({
  api,
  onDone,
}: {
  api: SettingsApi;
  onDone: () => void;
}) {
  const [input, setInput] = useState<PasswordInput>({
    current: "",
    next: "",
    confirm: "",
  });
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const dirty = Object.values(input).some(Boolean);

  // Ask before leaving with typed input (back button, tabs or browser back).
  useEffect(() => {
    if (!dirty || busy) return;
    return registerNavigationGuard((proceed) => setLeave(() => proceed));
  }, [dirty, busy]);

  const set = (key: keyof PasswordInput) => (value: string) => {
    const next = { ...input, [key]: value };
    setInput(next);
    if (submitted) {
      const v = validatePassword(next);
      // A server "wrong password" error stays until the current field changes.
      setErrors(
        key !== "current" && errors.current && !v.current
          ? { ...v, current: errors.current }
          : v,
      );
    }
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setFailure(null);
    const v = validatePassword(input);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api.changePassword({
        currentPassword: input.current,
        newPassword: input.next,
        newPasswordConfirm: input.confirm,
      });
      // The guard is off while busy, so this leaves without the cancel prompt.
      onDone();
    } catch (err) {
      setBusy(false);
      const field = passwordFieldError(err);
      if (field) setErrors(field);
      else setFailure(err);
    }
  }

  return (
    <section className="screen settings-screen password-screen">
      <TitleBar title="비밀번호 변경" onBack={() => go("/settings")} />
      <form className="login-form" onSubmit={submit} noValidate>
        <PasswordField
          label="현재 비밀번호"
          name="currentPassword"
          autoComplete="current-password"
          placeholder="현재 비밀번호를 입력해주세요"
          value={input.current}
          onValueChange={set("current")}
          error={errors.current}
        />
        <PasswordField
          label="새 비밀번호"
          name="newPassword"
          autoComplete="new-password"
          placeholder="새 비밀번호를 입력해주세요"
          value={input.next}
          onValueChange={set("next")}
          error={errors.next}
        />
        <PasswordField
          label="새 비밀번호 확인"
          name="newPasswordConfirm"
          autoComplete="new-password"
          placeholder="새 비밀번호를 다시 입력해주세요"
          value={input.confirm}
          onValueChange={set("confirm")}
          error={errors.confirm}
        />
        <ErrorMessage error={failure} />
        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>
      {leave && (
        <SettingsDialog
          title="변경을 취소할까요?"
          onClose={() => setLeave(null)}
          body={
            <>
              입력한 내용은 저장되지 않아요.
              <br />
              설정 화면으로 돌아갈까요?
            </>
          }
          actions={
            <div className="stacked-actions">
              <button
                type="button"
                className="primary"
                onClick={() => setLeave(null)}
              >
                계속 작성
              </button>
              <button
                type="button"
                className="soft"
                onClick={() => {
                  const proceed = leave;
                  setLeave(null);
                  proceed();
                }}
              >
                변경 취소하고 나가기
              </button>
            </div>
          }
        />
      )}
    </section>
  );
}

function TitleBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="settings-title">
      <IconButton name="listBack" label="뒤로" onClick={onBack} />
      <h1>{title}</h1>
    </header>
  );
}

function SettingsDialog({
  title,
  icon,
  body,
  actions,
  onClose,
}: {
  title: string;
  icon?: ReactNode;
  body: ReactNode;
  actions: ReactNode;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose} className="settings-dialog">
      {icon && <div className="dialog-icon">{icon}</div>}
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="dialog-actions">{actions}</div>
    </Modal>
  );
}

function DoneIcon() {
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <circle cx="26" cy="26" r="26" fill="var(--sage)" />
      <path
        d="m16 26.5 7 7 13-14"
        fill="none"
        stroke="var(--green)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
