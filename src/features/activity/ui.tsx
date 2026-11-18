import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { dateText } from "./types";

const assets = import.meta.glob("../../assets/figma/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;
const icons = {
  roadmap: "5-14-img",
  activity: "5-14-img1",
  connection: "5-14-img2",
  addBook: "5-14-img3",
  settings: "5-14-img4",
  down: "5-14-imgBasilCaretDownOutline",
  shelfDot: "5-14-img6",
  back: "38-652-imgBack",
  calendar: "38-652-imgCalendar",
  info: "37-277-imgInfo",
  check: "37-277-imgCheck",
  error: "37-355-imgError",
  close: "129-1581-imgClose",
  next: "129-1581-imgNext",
  pageBack: "44-518-imgBack",
  more: "44-518-imgMore",
  pageCalendar: "44-518-imgCalendar",
  clip: "44-518-imgClip",
  file: "44-579-imgFile",
  removeFile: "44-579-imgClose",
  listBack: "143-1766-imgFrame",
  addPage: "143-1766-imgFrame1",
  unchecked: "48-940-img",
  checked: "48-940-img5",
  radio: "48-940-img2",
  radioSelected: "48-940-img4",
  exporting: "48-1194-img230Px",
  exportFailed: "48-1236-img96Px",
} as const;
export function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <img
      className="icon"
      src={assets[`../../assets/figma/${icons[name]}.svg`]}
      alt=""
    />
  );
}
export function IconButton({
  name,
  label,
  onClick,
  disabled = false,
}: {
  name: keyof typeof icons;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      className="icon-button"
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon name={name} />
    </button>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p className="error-message" role="alert">
      <Icon name="error" />
      {error instanceof Error ? error.message : String(error)}
    </p>
  ) : null;
}
export function Loading() {
  return (
    <div className="load-state" role="status">
      불러오는 중이에요.
    </div>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div className="load-state">
      <ErrorMessage error={error} />
      <button className="secondary" onClick={retry}>
        다시 시도
      </button>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  sheet = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  sheet?: boolean;
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className={`${sheet ? "sheet" : "confirm-dialog"} ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
export function Confirm({
  title,
  description,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  description?: string;
  busy: boolean;
  error: unknown;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
      <h2>{title}</h2>
      {description && <p>{description}</p>}
      <ErrorMessage error={error} />
      <div className="confirm-actions">
        <button className="secondary" disabled={busy} onClick={onCancel}>
          취소
        </button>
        <button className="primary" disabled={busy} onClick={onConfirm}>
          {busy ? "삭제 중…" : "삭제"}
        </button>
      </div>
    </Modal>
  );
}
export function Choice({
  selected,
  children,
  onClick,
  multiple = false,
  disabled = false,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  multiple?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`choice ${selected ? "selected" : ""}`}
      aria-pressed={selected}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon
        name={
          multiple
            ? selected
              ? "checked"
              : "unchecked"
            : selected
              ? "radioSelected"
              : "radio"
        }
      />
      <span>{children}</span>
    </button>
  );
}
export function Calendar({
  startDate,
  endDate,
  initialField = "start",
  onClose,
  onApply,
}: {
  startDate: string;
  endDate: string | null;
  initialField?: "start" | "end";
  onClose: () => void;
  onApply: (start: string, end: string | null) => void;
}) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate || "");
  const [field, setField] = useState(initialField);
  const [month, setMonth] = useState(() => {
    const d = startDate ? new Date(`${startDate}T12:00:00`) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [error, setError] = useState("");
  const year = month.getFullYear(),
    m = month.getMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  const choose = (day: number) => {
    const value = `${year}-${pad(m + 1)}-${pad(day)}`;
    setError("");
    if (field === "start") {
      setStart(value);
      if (end && end < value) setEnd("");
      setField("end");
    } else {
      if (start && value < start) {
        setError("종료일은 시작일 이후로 선택해 주세요.");
        return;
      }
      setEnd(value);
    }
  };
  return (
    <Modal title="활동 날짜" onClose={onClose} sheet className="calendar-sheet">
      <div className="sheet-handle" />
      <div className="sheet-heading">
        <h2>활동 날짜</h2>
        <IconButton name="close" label="달력 닫기" onClick={onClose} />
      </div>
      <div className="date-tabs">
        <button
          className={field === "start" ? "active" : ""}
          onClick={() => setField("start")}
        >
          <small>시작일</small>
          {start ? dateText(start) : "날짜 선택"}
        </button>
        <button
          className={field === "end" ? "active" : ""}
          onClick={() => setField("end")}
        >
          <small>종료일</small>
          {end ? dateText(end) : "날짜 선택"}
        </button>
      </div>
      <div className="date-note">
        <span>종료일을 선택하면 기간으로 기록돼요.</span>
        {end && <button onClick={() => setEnd("")}>종료일 선택 안 함</button>}
      </div>
      <div className="month-heading">
        <IconButton
          name="back"
          label="이전 달"
          onClick={() => setMonth(new Date(year, m - 1, 1))}
        />
        <strong aria-live="polite">
          {year}년 {m + 1}월
        </strong>
        <IconButton
          name="next"
          label="다음 달"
          onClick={() => setMonth(new Date(year, m + 1, 1))}
        />
      </div>
      <div className="calendar-grid">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {Array.from({ length: new Date(year, m, 1).getDay() }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {Array.from({ length: new Date(year, m + 1, 0).getDate() }, (_, i) => {
          const day = i + 1,
            value = `${year}-${pad(m + 1)}-${pad(day)}`;
          return (
            <button
              key={day}
              className={`${value === start || value === end ? "endpoint" : ""} ${start && end && value > start && value < end ? "in-range" : ""}`}
              aria-label={`${year}년 ${m + 1}월 ${day}일`}
              aria-pressed={value === start || value === end}
              onClick={() => choose(day)}
            >
              {day}
            </button>
          );
        })}
      </div>
      <ErrorMessage error={error} />
      <button
        className="primary calendar-apply"
        onClick={() => {
          if (!start) setError("시작일을 선택해 주세요.");
          else onApply(start, end || null);
        }}
      >
        날짜 적용
      </button>
    </Modal>
  );
}
