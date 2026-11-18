import { useEffect, useState } from "react";
import { ApiError } from "./api";
import type { ActivityApi } from "./api";
import type { BookPages, ExportInput } from "./types";
import { pageNumber, pageTypes } from "./types";
import { Choice, ErrorMessage, Icon } from "./ui";

export interface ExportJob {
  exportId: number;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED" | "CANCELED";
  format?: "PDF" | "DOCX";
  document?: { fileName: string; downloadUrl: string } | null;
  attachments?: {
    attachmentId: number;
    fileName: string;
    contentType: string;
    downloadUrl: string;
  }[];
  failReason?: string | null;
}
export function ExportScreen({
  api,
  data,
  currentPageId,
  onClose,
}: {
  api: ActivityApi;
  data: BookPages;
  currentPageId: number;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<ExportInput["scope"]>("CURRENT"),
    [format, setFormat] = useState<ExportInput["format"]>("PDF"),
    [selected, setSelected] = useState<number[]>([]),
    [photos, setPhotos] = useState(true),
    [files, setFiles] = useState(true);
  const [selecting, setSelecting] = useState(false),
    [job, setJob] = useState<ExportJob | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [pollRevision, setPollRevision] = useState(0),
    [downloadId, setDownloadId] = useState<string | null>(null);
  const exportId = job?.exportId;
  const [ready, setReady] = useState(false);
  const processing = job?.status === "PROCESSING";
  const pending = job?.status === "PENDING" || job?.status === "PROCESSING";
  const current = data.pages.find((p) => p.pageId === currentPageId);
  useEffect(() => {
    if (!exportId || !pending) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await api.request<ExportJob>(
          `/api/exports/${exportId}`,
          { signal: controller.signal },
        );
        if (controller.signal.aborted) return;
        if (result.status === "DONE") {
          setJob({ ...result, status: "PROCESSING" });
          setReady(true);
          timer = setTimeout(() => setJob(result), 450);
        } else {
          setJob(result.status === "CANCELED" ? null : result);
        }
        setError(null);
        if (result.status === "PENDING" || result.status === "PROCESSING")
          timer = setTimeout(() => void poll(), 2000);
      } catch (e) {
        if (!controller.signal.aborted) setError(e);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [api, exportId, pending, pollRevision]);
  async function start(retry = false) {
    if (scope === "SELECTED" && !selected.length) {
      setError("내보낼 속지를 한 장 이상 선택해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    const body: ExportInput = {
      format,
      scope,
      includePhotos: photos,
      includeFileList: files,
      ...(scope === "CURRENT"
        ? { basePageId: currentPageId }
        : scope === "SELECTED"
          ? { pageIds: selected }
          : {}),
    };
    try {
      const result = await api.request<ExportJob>(
        retry && job
          ? `/api/exports/${job.exportId}/retry`
          : `/api/books/${data.bookId}/exports`,
        { method: "POST", ...(retry ? {} : { body: JSON.stringify(body) }) },
      );
      setReady(false);
      setJob(result);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!job) return;
    setBusy(true);
    setError(null);
    try {
      await api.request(`/api/exports/${job.exportId}/cancel`, {
        method: "POST",
      });
      setJob(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409)
        setPollRevision((v) => v + 1);
      else setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function download(path: string, name: string) {
    setDownloadId(path);
    setError(null);
    try {
      await api.download(path, name);
    } catch (e) {
      setError(e);
    } finally {
      setDownloadId(null);
    }
  }
  const toggle = (id: number) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((v) => v !== id) : [...ids, id],
    );
  return (
    <section className="screen export-screen">
      <header className="export-header">
        <button
          aria-label="뒤로"
          onClick={() => {
            if (selecting) setSelecting(false);
            else if (job && !pending) setJob(null);
            else onClose();
          }}
        >
          ‹
        </button>
        <strong>{selecting ? "속지 선택" : "내보내기"}</strong>
        <button onClick={onClose}>닫기</button>
      </header>
      {selecting ? (
        <>
          <div className="export-body">
            <h1>속지를 골라주세요</h1>
            <p className="muted">문서에는 책에 정리한 순서대로 담겨요.</p>
            <div className="selection-summary">
              <strong>{selected.length}장 선택</strong>
              <button
                onClick={() =>
                  setSelected(
                    selected.length === data.pages.length
                      ? []
                      : data.pages.map((p) => p.pageId),
                  )
                }
              >
                {selected.length === data.pages.length
                  ? "전체 해제"
                  : "전체 선택"}
              </button>
            </div>
            {data.pages.map((p) => (
              <Choice
                key={p.pageId}
                multiple
                selected={selected.includes(p.pageId)}
                onClick={() => toggle(p.pageId)}
              >
                {pageNumber(p.pageNo)}
                {"  "}
                {pageTypes[p.pageType].label}
              </Choice>
            ))}
          </div>
          <footer className="fixed-action">
            <button
              className="primary tall"
              disabled={!selected.length}
              onClick={() => {
                setScope("SELECTED");
                setSelecting(false);
                setError(null);
              }}
            >
              {selected.length}장 선택 완료
            </button>
          </footer>
        </>
      ) : pending ? (
        <div className="export-processing">
          <h1>문서로 정리하고 있어요</h1>
          <p className="muted">
            {data.bookTitle} ·{" "}
            {scope === "CURRENT"
              ? "현재 속지"
              : scope === "ALL"
                ? "책 전체"
                : `선택한 속지 ${selected.length}장`}{" "}
            · {format}
          </p>
          <div className="export-illustration">
            <svg
              viewBox="0 0 230 230"
              width="230"
              height="230"
              role="img"
              aria-label={ready ? "문서 생성 완료" : processing ? "문서 생성 중" : "문서 생성 대기 중"}
            >
              <circle cx="115" cy="115" r="110" fill="none" stroke="var(--sage)" strokeWidth="8" />
              <circle
                className="export-progress-arc"
                cx="115" cy="115" r="110" pathLength="100"
                fill="none" stroke="var(--green)" strokeWidth="8"
                strokeLinecap="round" transform="rotate(-90 115 115)"
                strokeDasharray="100"
                strokeDashoffset={ready ? 0 : processing ? 50 : 100}
                opacity={processing || ready ? 1 : 0}
              />
            </svg>
          </div>
          <footer className="fixed-action">
            <button
              className="secondary tall"
              disabled={busy || ready}
              onClick={() => void cancel()}
            >
              생성 취소
            </button>
          </footer>
          <p className="processing-message">
            작성 내용과 첨부 사진을 정리해요.
          </p>
          <p className="processing-caption">
            파일 준비가 끝나면 다운로드할 수 있어요.
          </p>
          {Boolean(error) && (
            <>
              <ErrorMessage error={error} />
              <button
                className="secondary"
                onClick={() => setPollRevision((v) => v + 1)}
              >
                상태 다시 확인
              </button>
            </>
          )}
        </div>
      ) : job?.status === "DONE" ? (
        <div className="export-body">
          <h1>파일이 준비됐어요</h1>
          <p className="muted">속지와 첨부 문서를 각각 다운로드하세요.</p>
          <div className="download-list">
            {job.document && (
              <div className="download-row">
                <div>
                  <small>속지 문서 · {job.format || format}</small>
                  <p>{job.document.fileName}</p>
                </div>
                <button
                  className="soft-button"
                  disabled={downloadId !== null}
                  onClick={() =>
                    void download(
                      `/api/exports/${job.exportId}/download`,
                      job.document!.fileName,
                    )
                  }
                >
                  {downloadId ? "처리 중" : "다운로드"}
                </button>
              </div>
            )}
            {job.attachments?.map((file) => (
              <div className="download-row" key={file.attachmentId}>
                <div>
                  <small>첨부 문서 · 원본</small>
                  <p>{file.fileName}</p>
                </div>
                <button
                  className="soft-button"
                  disabled={downloadId !== null}
                  onClick={() =>
                    void download(
                      `/api/attachments/${file.attachmentId}/download`,
                      file.fileName,
                    )
                  }
                >
                  다운로드
                </button>
              </div>
            ))}
          </div>
          <ErrorMessage error={error} />
          <button
            className="export-return"
            onClick={() => {
              setJob(null);
              setError(null);
            }}
          >
            내보내기 설정으로 돌아가기
          </button>
        </div>
      ) : job?.status === "FAILED" ? (
        <div className="export-failed">
          <h1>파일을 만들지 못했어요</h1>
          <p className="muted">작성한 기록과 내보내기 설정은 유지돼요.</p>
          <div className="failure-explanation">
            <Icon name="exportFailed" />
            <p>잠시 후 다시 시도해 주세요.</p>
            <p className="muted">
              계속 실패하면 첨부 사진을 제외하고
              <br />
              다시 만들어 보세요.
            </p>
          </div>
          <button
            className="secondary tall"
            disabled={busy}
            onClick={() => {
              setJob(null);
              setError(null);
            }}
          >
            설정으로 돌아가기
          </button>
          <ErrorMessage error={error} />
          <footer className="fixed-action">
            <button
              className="primary tall"
              disabled={busy}
              onClick={() => void start(true)}
            >
              다시 시도
            </button>
          </footer>
        </div>
      ) : (
        <>
          <div className="export-body">
            <h1>기록을 꺼내 쓰세요</h1>
            <p className="muted">
              {data.bookTitle} · 속지 {data.pages.length}장
            </p>
            <section className="export-group">
              <h2>내보낼 범위</h2>
              <Choice
                selected={scope === "CURRENT"}
                onClick={() => setScope("CURRENT")}
              >
                현재 속지 · {pageNumber(current?.pageNo || 1)}
              </Choice>
              <Choice
                selected={scope === "ALL"}
                onClick={() => setScope("ALL")}
              >
                책 전체 · {data.pages.length}장
              </Choice>
              <Choice
                selected={scope === "SELECTED"}
                onClick={() => setSelecting(true)}
              >
                선택한 속지{selected.length ? ` · ${selected.length}장` : ""} ›
              </Choice>
            </section>
            <section className="export-group">
              <h2>파일 형식</h2>
              <Choice
                selected={format === "PDF"}
                onClick={() => setFormat("PDF")}
              >
                PDF · 읽기와 제출용
              </Choice>
              <Choice
                selected={format === "DOCX"}
                onClick={() => setFormat("DOCX")}
              >
                Word(.docx) · 문서 편집용
              </Choice>
            </section>
            <section className="export-group">
              <h2>포함할 내용</h2>
              <Choice
                multiple
                selected={photos}
                onClick={() => setPhotos((v) => !v)}
              >
                첨부 사진
              </Choice>
              <Choice
                multiple
                selected={files}
                onClick={() => setFiles((v) => !v)}
              >
                첨부 파일 목록
              </Choice>
              <p className="hint">첨부 원본 파일은 별도로 다운로드해요.</p>
            </section>
            <div className="export-note">
              <strong>작성한 내용만 내보내요.</strong>
              <p className="hint">
                빈칸의 작성 안내와 앱 버튼은 문서에서 제외돼요.
              </p>
            </div>
            <ErrorMessage error={error} />
          </div>
          <footer className="fixed-action">
            <button
              className="primary tall"
              disabled={busy}
              onClick={() => void start()}
            >
              {busy
                ? "요청 중…"
                : `${format === "PDF" ? "PDF" : "Word"} 만들기`}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}
