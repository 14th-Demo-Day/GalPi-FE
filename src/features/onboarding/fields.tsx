import { useId, useState } from "react";
import type { InputHTMLAttributes } from "react";

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type" | "value" | "onChange"
>;

interface FieldProps extends InputProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  invalid?: boolean;
  error?: string;
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {hidden && <path d="M4 4l16 16" />}
    </svg>
  );
}

function Field({
  label,
  value,
  onValueChange,
  invalid,
  error,
  password = false,
  ...rest
}: FieldProps & { password?: boolean }) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);
  const input = (
    <input
      {...rest}
      id={id}
      type={password && !visible ? "password" : "text"}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      aria-invalid={invalid || !!error}
      aria-describedby={error ? errorId : undefined}
    />
  );
  return (
    <div className="login-field">
      <label htmlFor={id}>{label}</label>
      {password ? (
        <div className="password-input">
          {input}
          <button
            type="button"
            className="password-toggle"
            aria-label={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
            aria-pressed={visible}
            onClick={() => setVisible((v) => !v)}
          >
            <EyeIcon hidden={!visible} />
          </button>
        </div>
      ) : (
        input
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField(props: FieldProps) {
  return (
    <Field
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      {...props}
    />
  );
}

export function PasswordField(props: FieldProps) {
  return <Field {...props} password />;
}
