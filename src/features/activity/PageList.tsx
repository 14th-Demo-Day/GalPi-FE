import { useEffect, useState } from "react";
import type { ActivityApi } from "./api";
import { pageFields } from "./pageFields";
import { dateText, pageNumber, pageTypes } from "./types";
import type { BookPage, BookPages, PageSummary, PageType } from "./types";
import { ErrorMessage, Icon, IconButton, Modal } from "./ui";

function Thumbnail({
  api,
  summary,
  title,
}: {
  api: ActivityApi;
  summary: PageSummary;
  title: string;
}) {
  const [page, setPage] = useState<BookPage | null>(null);
  useEffect(() => {
    const c = new AbortController();
    api
      .page(summary.pageId, c.signal)
      .then(setPage)
      .catch(() => {});
    return () => c.abort();
  }, [api, summary.pageId]);
  return (
    <div className="thumbnail-document" aria-hidden="true">
      <p className="thumbnail-title">{title}</p>
      {page ? (
        <>
          <p className="thumbnail-date">
            {page.pageType === "ACTIVITY"
              ? `${dateText(page.activityStartDate)}${page.activityEndDate ? ` ~ ${dateText(page.activityEndDate)}` : ""}`
              : `${dateText(page.createdAt)} · ${dateText(page.updatedAt)}`}
          </p>
          {pageFields[page.pageType].map(([key, label]) => (
            <div className="thumbnail-field" key={key}>
              <p>{label}</p>
              <div>{page.content[key] || ""}</div>
            </div>
          ))}
        </>
      ) : (
        <p>{summary.preview}</p>
      )}
    </div>
  );
}
export function PageList({
  api,
  data,
  currentPageId,
  onBack,
  onPage,
}: {
  api: ActivityApi;
  data: BookPages;
  currentPageId?: number;
  onBack: () => void;
  onPage: (id: number) => void;
}) {
  const [adding, setAdding] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function add(type: PageType) {
    setBusy(true);
    setError(null);
    try {
      const page = await api.createPage(data.bookId, type);
      onPage(page.pageId);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="screen list-screen">
      <div className="list-heading">
        <IconButton name="listBack" label="뒤로" onClick={onBack} />
        <strong>{data.bookTitle}</strong>
      </div>
      <h1>속지 목록</h1>
      <p className="muted">{data.pages.length}장</p>
      <div className="page-grid">
        {data.pages.map((p) => (
          <button
            className={`thumbnail ${currentPageId === p.pageId ? "current" : ""}`}
            key={p.pageId}
            onClick={() => onPage(p.pageId)}
          >
            <Thumbnail api={api} summary={p} title={data.bookTitle} />
            <span>
              {pageTypes[p.pageType].label} · {pageNumber(p.pageNo)}
            </span>
          </button>
        ))}
        <button className="page-add" onClick={() => setAdding(true)}>
          <Icon name="addPage" />
          속지 추가
        </button>
      </div>
      {adding && (
        <Modal
          title="속지 추가"
          sheet
          onClose={() => {
            if (!busy) setAdding(false);
          }}
          className="type-sheet"
        >
          <div className="sheet-heading">
            <h2>어떤 속지를 추가할까요?</h2>
            <IconButton
              name="close"
              label="속지 추가 닫기"
              disabled={busy}
              onClick={() => setAdding(false)}
            />
          </div>
          {(
            Object.entries(pageTypes) as [PageType, typeof pageTypes.ACTIVITY][]
          ).map(([type, info]) => (
            <button
              className="type-choice"
              key={type}
              disabled={busy}
              onClick={() => void add(type)}
            >
              <span>{info.label}</span>
              <small>{info.description}</small>
            </button>
          ))}
          <p className="hint">유형을 선택하면 빈 속지가 바로 열려요.</p>
          <ErrorMessage error={error} />
        </Modal>
      )}
    </section>
  );
}
