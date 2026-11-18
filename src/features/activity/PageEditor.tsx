import { useEffect, useRef, useState } from "react";
import type { ActivityApi } from "./api";
import { registerNavigationGuard } from "./navigation";
import { categories, dateText, pageNumber, pageTypes } from "./types";
import type { BookPage } from "./types";
import { Confirm, ErrorMessage, Icon, IconButton, Modal } from "./ui";

import { pageFields } from "./pageFields";

function AutoTextarea({
  value,
  label,
  describedBy,
  onChange,
}: {
  value: string;
  label: string;
  describedBy: string;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current!;
    el.style.height = "auto";
    el.style.height = `${Math.max(value ? 24 : 68, el.scrollHeight)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      aria-label={label}
      aria-describedby={describedBy}
      rows={1}
      className={value ? "has-content" : ""}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
export function PageEditor({
  api,
  initialPage,
  onBack,
  onList,
  onEditBook,
  onExport,
  onDeleted,
}: {
  api: ActivityApi;
  initialPage: BookPage;
  onBack: () => void;
  onList: () => void;
  onEditBook: () => void;
  onExport: () => void;
  onDeleted: (bookDeleted: boolean) => void;
}) {
  const [page, setPage] = useState(initialPage),
    [content, setContent] = useState(initialPage.content),
    [menu, setMenu] = useState(false),
    [deleting, setDeleting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [saved, setSaved] = useState("");
  const [leave, setLeave] = useState<(() => void) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const releaseGuard = useRef<(() => void) | undefined>(undefined);
  const dirty = JSON.stringify(content) !== JSON.stringify(page.content);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    if (!dirty) return;
    const release = registerNavigationGuard((action) => setLeave(() => action));
    releaseGuard.current = release;
    return () => {
      release();
      releaseGuard.current = undefined;
    };
  }, [dirty]);
  const navigate = (action: () => void) => action();
  async function save(next?: () => void) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.savePage(page.pageId, content);
      setPage(result);
      setContent(result.content);
      setSaved("작성한 내용을 저장했어요.");
      next?.();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.deletePage(page.pageId);
      releaseGuard.current?.();
      onDeleted(result.bookDeleted);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    setError(null);
    if (page.attachments.length >= 10) {
      setError("첨부 자료는 속지당 최대 10개까지 추가할 수 있어요.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("파일은 10MB 이하로 선택해 주세요.");
      return;
    }
    if (!/\.(jpe?g|png|pdf|docx|pptx|xlsx|hwp)$/i.test(file.name)) {
      setError(
        "JPG, JPEG, PNG, PDF, DOCX, PPTX, XLSX, HWP 파일을 선택해 주세요.",
      );
      return;
    }
    setBusy(true);
    try {
      const attachment = await api.upload(page.pageId, file);
      setPage((p) => ({ ...p, attachments: [...p.attachments, attachment] }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function removeAttachment(id: number) {
    setBusy(true);
    setError(null);
    try {
      await api.deleteAttachment(id);
      setPage((p) => ({
        ...p,
        attachments: p.attachments.filter((a) => a.attachmentId !== id),
      }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="screen editor-screen">
      <header className="editor-header">
        <div className="book-toolbar">
          <IconButton
            name="pageBack"
            label="책장으로"
            onClick={() => navigate(onBack)}
          />
          <strong>{page.bookTitle}</strong>
          <IconButton
            name="more"
            label="속지 더보기"
            onClick={() => setMenu(!menu)}
          />
        </div>
        <div className="page-toolbar">
          <strong>
            {pageTypes[page.pageType].label} · {pageNumber(page.pageNo)}
          </strong>
          <button onClick={() => navigate(onList)}>속지 목록</button>
        </div>
        {menu && (
          <>
            <button
              className="menu-dismiss"
              aria-label="메뉴 닫기"
              onClick={() => setMenu(false)}
            />
            <div className="page-menu">
              <button
                onClick={() => {
                  setMenu(false);
                  navigate(onExport);
                }}
              >
                내보내기
              </button>
              <button
                onClick={() => {
                  setMenu(false);
                  navigate(onEditBook);
                }}
              >
                책 정보 수정
              </button>
              <button
                className="danger-text"
                onClick={() => {
                  setMenu(false);
                  setError(null);
                  setDeleting(true);
                }}
              >
                삭제
              </button>
            </div>
          </>
        )}
      </header>
      <div className="document-body">
        <div className="note-meta">
          <span>{pageTypes[page.pageType].note}</span>
          <span>{categories[page.category]}</span>
        </div>
        {page.pageType === "ACTIVITY" ? (
          <div className="activity-dates">
            <small>활동 날짜</small>
            <div>
              <span>
                {dateText(page.activityStartDate)}
                {page.activityEndDate
                  ? ` ~ ${dateText(page.activityEndDate)}`
                  : ""}
              </span>
              <IconButton
                name="pageCalendar"
                label="활동 날짜 수정"
                onClick={() => navigate(onEditBook)}
              />
            </div>
          </div>
        ) : (
          <div className="record-dates">
            <div>
              <small>처음 기록</small>
              <p>{dateText(page.createdAt)}</p>
            </div>
            <div>
              <small>최근 기록</small>
              <p>{dateText(page.updatedAt)}</p>
            </div>
          </div>
        )}
        {pageFields[page.pageType].map(([key, title, guide]) => (
          <div
            className={`narrative ${page.pageType === "MEMO" ? "memo" : ""}`}
            key={key}
          >
            <h2>
              {page.pageType === "ACTIVITY" ? (
                <>
                  <span>{title[0]}</span>
                  {title.slice(1)}
                </>
              ) : (
                title
              )}
            </h2>
            <p id={`guide-${key}`} className="field-guide">
              {guide}
            </p>
            <AutoTextarea
              label={title}
              describedBy={`guide-${key}`}
              value={content[key] || ""}
              onChange={(value) => {
                setContent((v) => ({ ...v, [key]: value }));
                setSaved("");
              }}
            />
          </div>
        ))}
        <section className="attachments">
          <h2>첨부 자료</h2>
          <p className="hint">사진·결과물·증빙을 함께 남겨요.</p>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,.docx,.pptx,.xlsx,.hwp"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button
            className="upload-button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <Icon name="clip" />+ 사진·파일 추가
          </button>
          {page.attachments.map((file) => (
            <div className="attachment-row" key={file.attachmentId}>
              <Icon name="file" />
              <button
                className="file-name"
                onClick={() => {
                  void api.downloadAttachment(file).catch(setError);
                }}
              >
                {file.originalName}
              </button>
              <IconButton
                name="removeFile"
                label={`${file.originalName} 삭제`}
                disabled={busy}
                onClick={() => void removeAttachment(file.attachmentId)}
              />
            </div>
          ))}
        </section>
        <span className="page-number">{pageNumber(page.pageNo)}</span>
        {!deleting && <ErrorMessage error={error} />}
        <span className="sr-only" role="status">
          {saved}
        </span>
      </div>
      <footer className="fixed-action">
        <button
          className="primary tall"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "처리 중…" : "작성 완료"}
        </button>
      </footer>
      {deleting && (
        <Confirm
          title={
            page.pageCount === 1
              ? "마지막 속지를 삭제할까요?"
              : "이 속지를 삭제할까요?"
          }
          description={
            page.pageCount === 1
              ? "이 속지를 삭제하면 책도 함께 삭제돼요."
              : undefined
          }
          busy={busy}
          error={error}
          onCancel={() => setDeleting(false)}
          onConfirm={() => void remove()}
        />
      )}
      {leave && (
        <Modal title="작성 중인 내용" onClose={() => setLeave(null)}>
          <h2>변경을 취소할까요?</h2>
          <p>입력한 내용은 저장되지 않아요.</p>
          <ErrorMessage error={error} />
          <div className="leave-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => setLeave(null)}
            >
              계속 작성
            </button>
            <button className="soft-button" disabled={busy} onClick={leave}>
              변경 취소하고 나가기
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
