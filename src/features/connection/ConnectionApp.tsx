import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { go } from "../activity/navigation";
import { BottomNav } from "../activity/BottomNav";
import { categories } from "../activity/types";
import { ErrorMessage, Failure, Icon, IconButton, Loading } from "../activity/ui";
import { ApiError } from "../activity/api";
import { ConnectionError, STALE_SELECTION_CODES } from "./api";
import type { ConnectionApi } from "./api";
import {
  MAX_BOOKS,
  MAX_SENTENCE_LENGTH,
  MIN_BOOKS,
  foundText,
  isDarkColor,
  savedDate,
} from "./connection";
import type {
  EligibleBook,
  ConnectionResult,
  Evidence,
  SavedPage,
} from "./connection";
import "../activity/activity.css";
import "./connection.css";

type Tab = "roadmap" | "activity" | "connections";
type Books = Awaited<ReturnType<ConnectionApi["books"]>>;

export function ConnectionApp({
  api,
  path,
  onNavigate,
}: {
  api: ConnectionApi;
  path: string;
  onNavigate: (tab: Tab) => void;
}) {
  const [books, setBooks] = useState<Books | null>(null);
  const [booksError, setBooksError] = useState<unknown>(null);
  const [booksRevision, setBooksRevision] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [saved, setSaved] = useState<SavedPage | null>(null);
  const [savedError, setSavedError] = useState<unknown>(null);
  const [savedRevision, setSavedRevision] = useState(0);
  const [result, setResult] = useState<ConnectionResult | null>(null);
  // Load errors are kept per connection, so another item can still load.
  const [loadError, setLoadError] = useState<{ id: number; error: unknown } | null>(null);
  const [resultRevision, setResultRevision] = useState(0);
  const [failure, setFailure] = useState<ConnectionError["kind"] | null>(null);
  const [running, setRunning] = useState(false);
  const job = useRef<AbortController | null>(null);

  useEffect(() => {
    const c = new AbortController();
    api
      .books(c.signal)
      .then((data) => {
        setBooks(data);
        setBooksError(null);
        // Start with the two most recent ready books selected, as in Figma.
        setSelected(data.data.books.slice(0, MIN_BOOKS).map((b) => b.bookId));
      })
      .catch((e) => {
        if (!c.signal.aborted) setBooksError(e);
      });
    return () => c.abort();
  }, [api, booksRevision]);

  useEffect(() => {
    const c = new AbortController();
    api
      .saved(0, c.signal)
      .then((data) => {
        setSaved(data);
        setSavedError(null);
      })
      .catch((e) => {
        if (!c.signal.aborted) setSavedError(e);
      });
    return () => c.abort();
  }, [api, savedRevision]);

  useEffect(() => () => job.current?.abort(), []);

  const chosen = (books?.data.books ?? []).filter((b) =>
    selected.includes(b.bookId),
  );
  function start() {
    if (chosen.length < MIN_BOOKS) return;
    job.current?.abort();
    const c = new AbortController();
    job.current = c;
    setResult(null);
    setLoadError(null);
    setFailure(null);
    setRunning(true);
    go("/connections/progress");
    api
      .generate(chosen, c.signal)
      .then((data) => {
        if (c.signal.aborted) return;
        setRunning(false);
        setResult(data);
        go(`/connections/result/${data.connectionId}`);
      })
      .catch((e) => {
        if (c.signal.aborted) return;
        setRunning(false);
        setFailure(e instanceof ConnectionError ? e.kind : "SERVER");
        // The chosen books may no longer be connectable; refresh the list.
        if (e instanceof ConnectionError && STALE_SELECTION_CODES.includes(e.code))
          setBooksRevision((r) => r + 1);
        go("/connections/failed");
      });
  }
  function cancel() {
    job.current?.abort();
    job.current = null;
    setRunning(false);
    go("/connections");
  }

  const resultMatch = path.match(/^\/connections\/result\/(\d+)(\/edit)?$/);
  // 근거 보기 for a saved sentence loads the same connection result.
  const savedMatch = path.match(/^\/connections\/saved\/(\d+)$/);
  const resultId = resultMatch
    ? Number(resultMatch[1])
    : savedMatch
      ? Number(savedMatch[1])
      : null;
  const firstConnection = saved ? saved.totalCount === 0 : false;
  // The just-generated result is in memory; otherwise (reload, link) fetch it.
  const loaded = result && result.connectionId === resultId ? result : null;
  const resultError = loadError && loadError.id === resultId ? loadError.error : null;
  const needsResult = resultId !== null && !loaded && !resultError;
  useEffect(() => {
    if (!needsResult || resultId === null) return;
    const c = new AbortController();
    api
      .result(resultId, c.signal)
      .then((r) => {
        if (!c.signal.aborted) setResult(r);
      })
      .catch((e) => {
        if (!c.signal.aborted) setLoadError({ id: resultId, error: e });
      });
    return () => c.abort();
  }, [api, needsResult, resultId, resultRevision]);

  const stale =
    (path === "/connections/progress" && !running) ||
    (path === "/connections/failed" && !failure) ||
    path === "/connections/result" ||
    path === "/connections/result/edit";
  useEffect(() => {
    // Flow screens hold in-memory state; after a reload, return to the start.
    if (stale) go("/connections");
  });
  if (stale) return null;

  if (path === "/connections/progress")
    return (
      <SubScreen title="경험 연결 중" onBack={cancel} className="progress-screen">
        <div className="connect-progress" role="status">
          <div className="progress-ring" aria-hidden="true" />
          <h2>경험의 공통점을 찾고 있어요</h2>
          <p>
            선택한 기록에서 행동과 연결 근거를 살펴봐요.
            <br />
            잠시만 기다려주세요.
          </p>
        </div>
        <div className="connect-actions">
          <button type="button" className="secondary" onClick={cancel}>
            연결 취소
          </button>
        </div>
      </SubScreen>
    );

  if (path === "/connections/failed")
    return (
      <SubScreen title="연결 생성 실패" onBack={() => go("/connections")}>
        <div className="connect-failed" role="alert">
          <AlertIcon />
          <h2>문장을 만들지 못했어요</h2>
          <p>
            선택한 책과 기록은 그대로 유지돼요.
            {failure === "SERVER" && (
              <>
                <br />
                잠시 후 다시 시도해 주세요.
              </>
            )}
          </p>
        </div>
        <div className="connect-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => go("/connections")}
          >
            선택한 기록 확인하기
          </button>
          <button type="button" className="primary tall" onClick={start}>
            다시 시도
          </button>
        </div>
      </SubScreen>
    );

  if (resultId !== null && !loaded)
    return (
      <SubScreen
        title="연결 결과"
        onBack={() => go(savedMatch ? "/connections/saved" : "/connections")}
      >
        {resultError instanceof ApiError && resultError.status === 404 ? (
          <div className="load-state">
            <ErrorMessage error="연결 결과를 찾을 수 없어요." />
            <button
              type="button"
              className="secondary"
              onClick={() => go(savedMatch ? "/connections/saved" : "/connections")}
            >
              {savedMatch ? "저장한 문장으로 돌아가기" : "경험 연결로 돌아가기"}
            </button>
          </div>
        ) : resultError ? (
          <Failure
            error={resultError}
            retry={() => {
              setLoadError(null);
              setResultRevision((r) => r + 1);
            }}
          />
        ) : (
          <Loading />
        )}
      </SubScreen>
    );

  if (loaded && savedMatch)
    return (
      <ResultScreen
        sentence={loaded.sentence}
        evidence={loaded.evidence}
        subtitle={foundText(loaded.evidence.length, false)}
        onBack={() => go("/connections/saved")}
      />
    );

  if (loaded && resultMatch?.[2]) {
    const detail = `/connections/result/${loaded.connectionId}`;
    return (
      <EditScreen
        initial={loaded.sentence}
        onBack={() => go(detail)}
        onSave={async (sentence) => {
          setResult({ ...loaded, sentence });
          go(detail);
        }}
      />
    );
  }

  if (loaded)
    return (
      <ResultScreen
        sentence={loaded.sentence}
        evidence={loaded.evidence}
        subtitle={foundText(
          loaded.evidence.length,
          !loaded.saved && firstConnection,
        )}
        onBack={() => go("/connections")}
        onEdit={() => go(`/connections/result/${loaded.connectionId}/edit`)}
        action={
          loaded.saved ? (
            <button
              type="button"
              className="primary tall"
              onClick={() => go("/connections/saved")}
            >
              저장한 문장 보기
            </button>
          ) : (
            <SaveButton
              onSave={async () => {
                try {
                  const item = await api.save(loaded.connectionId, loaded.sentence);
                  setResult({
                    ...loaded,
                    saved: true,
                    sentence: item.finalSentence,
                  });
                  setSavedRevision((r) => r + 1);
                  go("/connections/saved");
                } catch (e) {
                  if (e instanceof ApiError && e.code === "ALREADY_SAVED") {
                    // Saved earlier (e.g. another tab): offer the saved list.
                    setResult({ ...loaded, saved: true });
                    return;
                  }
                  throw saveError(e);
                }
              }}
            />
          )
        }
      />
    );

  const tab = path === "/connections/saved" ? "saved" : "connect";
  return (
    <section className="screen connection-screen">
      <header className="connection-header">
        <h1>경험 연결</h1>
        <p>쌓아온 경험을 나의 문장으로</p>
      </header>
      <div className="connection-tabs" role="tablist" aria-label="경험 연결">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "connect"}
          onClick={() => go("/connections")}
        >
          경험 연결하기
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "saved"}
          onClick={() => go("/connections/saved")}
        >
          저장한 문장
        </button>
      </div>
      {tab === "connect" ? (
        booksError ? (
          <Failure error={booksError} retry={() => setBooksRevision((r) => r + 1)} />
        ) : !books ? (
          <Loading />
        ) : (
          <ConnectTab
            books={books}
            selected={selected}
            firstConnection={firstConnection}
            onToggle={(id) =>
              setSelected((list) =>
                list.includes(id)
                  ? list.filter((v) => v !== id)
                  : list.length >= MAX_BOOKS
                    ? list
                    : [...list, id],
              )
            }
            onConnect={start}
          />
        )
      ) : savedError ? (
        <Failure error={savedError} retry={() => setSavedRevision((r) => r + 1)} />
      ) : !saved ? (
        <Loading />
      ) : (
        <SavedTab
          saved={saved}
          onMore={async () => {
            const next = await api.saved(saved.page + 1);
            setSaved((cur) =>
              cur && {
                ...next,
                items: [
                  ...cur.items,
                  ...next.items.filter(
                    (n) => !cur.items.some((c) => c.id === n.id),
                  ),
                ],
              },
            );
          }}
        />
      )}
      <BottomNav
        activeTab="connections"
        onNavigate={(t) => {
          if (t !== "connections") onNavigate(t);
        }}
      />
    </section>
  );
}

function ConnectTab({
  books,
  selected,
  firstConnection,
  onToggle,
  onConnect,
}: {
  books: Books;
  selected: number[];
  firstConnection: boolean;
  onToggle: (bookId: number) => void;
  onConnect: () => void;
}) {
  const {
    data: { canConnect, eligibleCount, books: list },
    hasBooks,
  } = books;
  if (!hasBooks)
    return (
      <>
        <div className="connection-empty">
          <OpenBookIcon large />
          <h2>첫 경험을 기록해 볼까요?</h2>
          <p>
            책에 경험을 남기면,
            <br />
            기록 사이의 공통점을 찾아 문장으로 제안해요.
          </p>
        </div>
        <div className="connection-guide">
          <strong>첫 연결은 이렇게 준비해요</strong>
          <p>
            서로 다른 책 2권에 활동 속지를 남겨주세요.
            <br />
            같은 활동 속지의 T·A·R 항목이
            <br />
            각각 20자 이상이면 연결할 수 있어요.
          </p>
        </div>
        <div className="connection-cta">
          <button
            type="button"
            className="primary tall"
            onClick={() => go("/activity/new")}
          >
            첫 책 만들기
          </button>
        </div>
      </>
    );

  if (!canConnect)
    return (
      <>
        <div className="connection-shortage">
          <h2>
            {MIN_BOOKS - eligibleCount <= 1
              ? "한 권의 기록을 더 준비해요"
              : `${MIN_BOOKS - eligibleCount}권의 기록을 더 준비해요`}
          </h2>
          <p>
            조건을 충족한 책만 목록에 표시돼요.
            <br />
            현재 {eligibleCount}권이 준비됐어요. 첫 연결에는 {MIN_BOOKS}권이
            필요해요.
          </p>
        </div>
        {list.length > 0 && (
          <ul className="connection-books">
            {list.map((b) => (
              <li key={b.bookId}>
                <div className="connection-book static">
                  <BookCard book={b} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="connection-note">
          <p>목록에 책이 보이지 않나요?</p>
          <p>
            책에 활동 속지를 추가하고, 같은 속지의
            <br />
            T(역할)·A(행동)·R(결과+배운점)을
            <br />
            각각 20자 이상 작성해주세요.
          </p>
        </div>
        <div className="connection-cta">
          <button type="button" className="primary tall" disabled>
            기록을 보완하면 연결할 수 있어요
          </button>
        </div>
      </>
    );

  const count = selected.length;
  return (
    <>
      <div className="connection-ready">
        <OpenBookIcon />
        <div>
          <strong>
            {firstConnection ? "첫 연결을 시작할 수 있어요" : "연결을 시작할 수 있어요"}
          </strong>
          <p>조건을 충족한 책 {eligibleCount}권이 준비됐어요.</p>
        </div>
      </div>
      <div className="connection-select-head">
        <h2>연결할 책 선택</h2>
        <span aria-live="polite">{count}권 선택</span>
      </div>
      <ul className="connection-books" aria-label="연결할 책">
        {list.map((b) => {
          const on = selected.includes(b.bookId);
          const full = !on && count >= MAX_BOOKS;
          return (
            <li key={b.bookId}>
              <button
                type="button"
                className={`connection-book ${on ? "selected" : ""}`}
                aria-pressed={on}
                disabled={full}
                onClick={() => onToggle(b.bookId)}
              >
                <BookCard book={b} />
                <CheckMark on={on} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="connection-note">
        <p>
          활동 속지가 있는 책만 표시돼요.
          <br />
          같은 속지의 T(역할)·A(행동)·R(결과+배운점)을
          <br />
          각각 20자 이상 작성해주세요.
        </p>
        <p>
          선택한 책의 기록만 연결에 사용해요.
          <br />
          한 번에 {MIN_BOOKS}~{MAX_BOOKS}권까지 연결할 수 있어요.
        </p>
      </div>
      <div className="connection-cta">
        <button
          type="button"
          className="primary tall"
          disabled={count < MIN_BOOKS}
          onClick={onConnect}
        >
          {count < MIN_BOOKS
            ? `${MIN_BOOKS}권 이상 선택해주세요`
            : `선택한 ${count}권 연결하기`}
        </button>
      </div>
    </>
  );
}

function SavedTab({
  saved,
  onMore,
}: {
  saved: SavedPage;
  onMore: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  if (!saved.items.length)
    return (
      <>
        <div className="connection-empty saved-empty">
          <h2>아직 저장한 문장이 없어요</h2>
          <p>
            책에 쌓인 경험을 연결하고
            <br />
            마음에 드는 문장을 저장해 보세요.
          </p>
        </div>
        <div className="connection-cta">
          <button
            type="button"
            className="primary tall"
            onClick={() => go("/connections")}
          >
            첫 문장 연결하기
          </button>
        </div>
      </>
    );
  return (
    <>
      <h2 className="saved-count">저장한 문장 {saved.totalCount}개</h2>
      <ul className="saved-list">
        {saved.items.map((item) => (
          <li key={item.id} className="saved-card">
            <small>{savedDate(item.savedAt)}</small>
            <p className="saved-sentence">{item.sentence}</p>
            <div className="saved-tags">
              {item.bookTitles.map((title, i) => (
                <span key={i}>{title}</span>
              ))}
            </div>
            <div className="saved-actions">
              <button
                type="button"
                className="link-button"
                onClick={() => go(`/connections/saved/${item.id}`)}
              >
                근거 보기 ›
              </button>
              <CopyButton text={item.sentence} />
            </div>
          </li>
        ))}
      </ul>
      {saved.hasNext && (
        <>
          <ErrorMessage error={error} />
          <button
            type="button"
            className="quarter-more saved-more"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onMore();
              } catch (e) {
                setError(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "불러오는 중…" : `더 보기 · ${saved.items.length}/${saved.totalCount}`}
          </button>
        </>
      )}
      <p className="saved-footnote">
        <Icon name="info" />
        저장한 문장은 기록이 바뀌어도 그대로 보관돼요.
      </p>
    </>
  );
}

function ResultScreen({
  sentence,
  evidence,
  subtitle,
  onBack,
  onEdit,
  action,
}: {
  sentence: string;
  evidence: Evidence[];
  subtitle: string;
  onBack: () => void;
  onEdit?: () => void;
  action?: ReactNode;
}) {
  return (
    <SubScreen
      title="연결 결과"
      onBack={onBack}
      className={action ? "with-action" : ""}
    >
      <p className="result-subtitle">{subtitle}</p>
      <div className="result-card">
        <p className="result-sentence">{sentence}</p>
        {onEdit && (
          <button type="button" className="link-button" onClick={onEdit}>
            문장 수정 ›
          </button>
        )}
      </div>
      <p className="result-hint">
        기록을 바탕으로 제안한 문장이에요.
        <br />
        나의 경험과 맞는지 확인하고 다듬어주세요.
      </p>
      <section className="evidence">
        <h2>근거가 된 기록</h2>
        <ul>
          {evidence.map((e, i) => (
            <li key={e.evidenceId ?? i}>
              <strong>{e.bookTitle}</strong>
              <span>{e.label}</span>
              <blockquote>“{e.quote}”</blockquote>
              {e.pageId !== null ? (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => go(`/activity/pages/${e.pageId}`)}
                >
                  원문 보기 ›
                </button>
              ) : (
                <small className="evidence-missing">
                  원문 기록이 삭제됐어요. 저장된 발췌만 보여요.
                </small>
              )}
            </li>
          ))}
        </ul>
      </section>
      {action && <div className="connect-actions floating">{action}</div>}
    </SubScreen>
  );
}

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <>
      <ErrorMessage error={error} />
      <button
        type="button"
        className="primary tall"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await onSave();
          } catch (e) {
            setError(e);
            setBusy(false);
          }
        }}
      >
        {busy ? "저장 중…" : "나의 문장 저장하기"}
      </button>
    </>
  );
}

function EditScreen({
  initial,
  onBack,
  onSave,
}: {
  initial: string;
  onBack: () => void;
  onSave: (sentence: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const value = text.trim();
  return (
    <SubScreen title="문장 수정" onBack={onBack} className="with-action">
      <p className="edit-lead">나의 말투로 다듬어 보세요.</p>
      <p className="edit-sub">근거 기록과 연결 이유는 함께 보관돼요.</p>
      <textarea
        className="edit-area"
        aria-label="문장"
        value={text}
        maxLength={MAX_SENTENCE_LENGTH}
        onChange={(e) => setText(e.target.value)}
      />
      <p className="edit-hint">직접 한 행동과 기록에 있는 사실을 중심으로 써주세요.</p>
      <div className="connect-actions floating">
        <ErrorMessage error={error} />
        <button
          type="button"
          className="primary tall"
          disabled={busy || !value}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await onSave(value);
            } catch (e) {
              setError(e);
              setBusy(false);
            }
          }}
        >
          {busy ? "저장 중…" : "수정한 문장 저장하기"}
        </button>
      </div>
    </SubScreen>
  );
}

function SubScreen({
  title,
  onBack,
  className = "",
  children,
}: {
  title: string;
  onBack: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`screen connection-sub ${className}`}>
      <div className="sub-bar">
        <IconButton name="listBack" label="경험 연결로 돌아가기" onClick={onBack} />
        <span>경험 연결</span>
      </div>
      {title && <h1>{title}</h1>}
      {children}
    </section>
  );
}

function BookCard({ book }: { book: EligibleBook }) {
  return (
    <>
      <span
        className={`mini-cover ${isDarkColor(book.coverColor) ? "dark" : ""}`}
        style={{ background: book.coverColor }}
        aria-hidden="true"
      >
        <span className="mini-title">{book.title}</span>
        <span className="mini-caption">
          {categories[book.category]}
          <br />
          {book.startDate.slice(0, 7).replace("-", ".")}
        </span>
      </span>
      <span className="connection-book-info">
        <strong>{book.title}</strong>
        <span className="ready-pill">연결 준비됨</span>
      </span>
    </>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      className="copy-button"
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => setCopied("ok"))
          .catch(() => setCopied("fail"))
      }
    >
      <CopyIcon />
      <span aria-live="polite">
        {copied === "ok" ? "복사했어요" : copied === "fail" ? "복사 실패" : "복사"}
      </span>
    </button>
  );
}

function CheckMark({ on }: { on: boolean }) {
  return (
    <svg className="check-mark" width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
      {on ? (
        <>
          <circle cx="17" cy="17" r="16" fill="var(--green)" />
          <path
            d="m10.5 17.5 4.3 4.3 8.7-9"
            fill="none"
            stroke="var(--surface)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle cx="17" cy="17" r="12" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      )}
    </svg>
  );
}

function OpenBookIcon({ large = false }: { large?: boolean }) {
  return (
    <svg
      className="open-book"
      width={large ? 88 : 44}
      height={large ? 72 : 36}
      viewBox="0 0 44 36"
      fill="none"
      stroke="var(--green)"
      strokeWidth={large ? 1.4 : 1.8}
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M22 7c-4-3-10-4-19-3v26c9-1 15 0 19 3 4-3 10-4 19-3V4c-9-1-15 0-19 3Z" />
      <path d="M22 7v26" />
      {large && (
        <>
          <path d="M8 12c3-.6 6-.2 9 1M8 17c3-.6 6-.2 9 1M27 13c3-1.2 6-1.6 9-1M27 18c3-1.2 6-1.6 9-1" />
        </>
      )}
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" fill="none" aria-hidden="true">
      <circle cx="52" cy="52" r="50" stroke="var(--error)" strokeWidth="3.5" />
      <path d="M52 26v36" stroke="var(--error)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="52" cy="74" r="3" fill="var(--error)" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="6" y="6" width="9" height="10" rx="1.5" />
      <path d="M4 12H3.5A1.5 1.5 0 0 1 2 10.5v-7A1.5 1.5 0 0 1 3.5 2h6A1.5 1.5 0 0 1 11 3.5V4" />
    </svg>
  );
}

function saveError(e: unknown) {
  if (e instanceof ApiError && e.code === "INVALID_SENTENCE")
    return new Error("문장은 1~300자로 입력해 주세요.");
  if (e instanceof ApiError && e.code === "CONNECTION_NOT_FOUND")
    return new Error("연결 결과를 찾을 수 없어요.");
  return e;
}
