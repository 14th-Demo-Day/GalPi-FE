import { previewContent } from "./content";
import type { ActivityApi } from "../features/activity/api";
import { ApiError } from "../features/activity/api";
import type {
  Attachment,
  Book,
  BookPage,
  BookInput,
  Category,
  PageType,
  ExportInput,
} from "../features/activity/types";
import type { ExportJob } from "../features/activity/Export";

// Development-only fixtures transcribed from Figma. Never imported in production.
function createPreviewApi(): ActivityApi {
  const empty = new URLSearchParams(location.search).get("preview") === "empty";
  const rows: [string, Category, NonNullable<Book["coverColor"]>, string][] = [
    ["00동아리", "CLUB", "GREEN", "2026-09-01"],
    ["해커톤", "CONTEST", "SAGE", "2026-09-01"],
    ["멋사", "CLUB", "CREAM", "2026-09-01"],
    ["동아리 매거진", "EXTERNAL", "CREAM", "2026-08-01"],
    ["브랜드 서포터즈", "EXTERNAL", "SAGE", "2026-07-01"],
    ["학생회", "CAMPUS", "GREEN", "2026-07-01"],
    ["00스터디", "STUDY", "SAGE", "2026-06-01"],
    ["봉사", "EXTERNAL", "CREAM", "2026-06-01"],
  ];
  let books: Book[] = empty
    ? []
    : rows.map(([title, category, coverColor, startDate], i) => ({
        bookId: i + 1,
        title,
        category,
        coverColor,
        startDate,
        endDate: "2026-12-30",
      }));
  const pages: BookPage[] = [];
  const jobs = new Map<
    number,
    { input: ExportInput; bookId: number; started: number; job: ExportJob }
  >();
  const uploads = new Map<number, File>();
  let nextPage = 1,
    nextBook = 9,
    nextAttachment = 1,
    nextExport = 1;
  const now = () => new Date().toISOString();
  const clone = <T,>(value: T): T => structuredClone(value);
  const book = (id: number) => {
    const b = books.find((v) => v.bookId === id);
    if (!b) throw new ApiError("책이 없어요.", "BOOK_NOT_FOUND", 404);
    return b;
  };
  const page = (id: number) => {
    const p = pages.find((v) => v.pageId === id);
    if (!p) throw new ApiError("속지가 없어요.", "PAGE_NOT_FOUND", 404);
    const b = book(p.bookId);
    return {
      ...p,
      bookTitle: b.title,
      category: b.category,
      activityStartDate: b.startDate,
      activityEndDate: b.endDate,
      pageCount: pages.filter((v) => v.bookId === b.bookId).length,
    };
  };
  function add(id: number, type: PageType) {
    const b = book(id),
      pageId = nextPage++,
      pageNo =
        Math.max(
          0,
          ...pages.filter((p) => p.bookId === id).map((p) => p.pageNo),
        ) + 1;
    pages.push({
      pageId,
      bookId: id,
      bookTitle: b.title,
      category: b.category,
      activityStartDate: b.startDate,
      activityEndDate: b.endDate,
      pageType: type,
      pageNo,
      preview: "",
      content: {},
      attachments: [],
      createdAt: "2026-10-01T12:00:00",
      updatedAt: "2026-10-01T12:00:00",
      pageCount: 1,
    });
    return { pageId, pageNo };
  }
  books.forEach((b) => add(b.bookId, "ACTIVITY"));
  if (!empty) {
    const p = pages[4];
    p.activityStartDate = "2026-10-01";
    p.content = previewContent.ACTIVITY;
    const insight = add(5, "INSIGHT");
    pages.find((p) => p.pageId === insight.pageId)!.content =
      previewContent.INSIGHT;
    const memo = add(5, "MEMO");
    pages.find((p) => p.pageId === memo.pageId)!.content = previewContent.MEMO;
  }
  function removeBook(id: number) {
    books = books.filter((b) => b.bookId !== id);
    for (let i = pages.length - 1; i >= 0; i--)
      if (pages[i].bookId === id) pages.splice(i, 1);
  }
  function updateBook(id: number, input: BookInput) {
    Object.assign(book(id), input);
    return clone(book(id));
  }
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const create = path.match(/^\/api\/books\/(\d+)\/exports$/),
      action = path.match(/^\/api\/exports\/(\d+)(?:\/(cancel|retry))?$/);
    if (create) {
      const id = nextExport++,
        input = JSON.parse(String(init.body)) as ExportInput;
      const job: ExportJob = { exportId: id, status: "PENDING" };
      jobs.set(id, {
        input,
        bookId: Number(create[1]),
        started: Date.now(),
        job,
      });
      return clone(job) as T;
    }
    if (action) {
      const found = jobs.get(Number(action[1]));
      if (!found) throw new ApiError("작업이 없어요.", "EXPORT_NOT_FOUND", 404);
      if (action[2] === "cancel") found.job.status = "CANCELED";
      else if (action[2] === "retry") {
        const id = nextExport++;
        const job: ExportJob = { exportId: id, status: "PENDING" };
        jobs.set(id, { ...found, started: Date.now(), job });
        return clone(job) as T;
      } else if (
        (found.job.status === "PENDING" || found.job.status === "PROCESSING") &&
        Date.now() - found.started >= 4000
      )
        found.job =
          new URLSearchParams(location.search).get("export") === "failed"
            ? {
                exportId: found.job.exportId,
                status: "FAILED",
                failReason: "개발용 실패 상태",
              }
            : {
                exportId: found.job.exportId,
                status: "DONE",
                format: found.input.format,
                document: {
                  fileName: `${book(found.bookId).title}_활동.${found.input.format === "PDF" ? "pdf" : "docx"}`,
                  downloadUrl: `/api/exports/${found.job.exportId}/download`,
                },
                attachments: [],
              };
      if (found.job.status === "PENDING" && Date.now() - found.started >= 1000) {
        found.job = { ...found.job, status: "PROCESSING" };
      }
      return clone(found.job) as T;
    }
    throw new Error(`미리보기에서 지원하지 않는 요청: ${path}`);
  }
  async function download(path: string, filename: string) {
    const id = Number(path.match(/attachments\/(\d+)/)?.[1]);
    const file = uploads.get(id);
    if (!file)
      throw new Error(
        "개발용 미리보기예요. 실제 문서 다운로드는 서버 연결 후 확인할 수 있어요.",
      );
    const url = URL.createObjectURL(file),
      link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return {
    request,
    download,
    books: async (sort) =>
      clone(
        [...books].sort((a, b) =>
          sort === "CATEGORY"
            ? Object.keys({
                EXTERNAL: 0,
                CAMPUS: 1,
                CLUB: 2,
                CONTEST: 3,
                STUDY: 4,
                ETC: 5,
              }).indexOf(a.category) -
                Object.keys({
                  EXTERNAL: 0,
                  CAMPUS: 1,
                  CLUB: 2,
                  CONTEST: 3,
                  STUDY: 4,
                  ETC: 5,
                }).indexOf(b.category) || b.startDate.localeCompare(a.startDate)
            : sort === "OLDEST"
              ? a.startDate.localeCompare(b.startDate)
              : b.startDate.localeCompare(a.startDate),
        ),
      ),
    book: async (id) => ({
      ...clone(book(id)),
      pageCount: pages.filter((p) => p.bookId === id).length,
    }),
    createBook: async (input) => {
      const id = nextBook++;
      books.push({ ...input, bookId: id, coverColor: "GREEN" });
      return { bookId: id, firstPageId: add(id, input.firstPageType).pageId };
    },
    updateBook: async (id, input) => updateBook(id, input),
    deleteBook: async (id) => {
      removeBook(id);
    },
    pages: async (id) => ({
      bookId: id,
      bookTitle: book(id).title,
      pages: clone(
        pages
          .filter((p) => p.bookId === id)
          .map((p) => ({
            ...p,
            preview: Object.values(p.content).join(" ").slice(0, 50),
          })),
      ),
    }),
    page: async (id) => clone(page(id)),
    createPage: async (id, type) => add(id, type),
    savePage: async (id, content) => {
      const p = pages.find((p) => p.pageId === id)!;
      p.content = clone(content);
      p.updatedAt = now();
      return clone(page(id));
    },
    deletePage: async (id) => {
      const p = page(id);
      pages.splice(
        pages.findIndex((p) => p.pageId === id),
        1,
      );
      const bookDeleted = !pages.some((v) => v.bookId === p.bookId);
      if (bookDeleted) removeBook(p.bookId);
      return { bookId: p.bookId, bookDeleted };
    },
    upload: async (id, file) => {
      const attachment: Attachment = {
        attachmentId: nextAttachment++,
        originalName: file.name,
        contentType: file.type,
        size: file.size,
      };
      uploads.set(attachment.attachmentId, file);
      pages.find((p) => p.pageId === id)!.attachments.push(attachment);
      return clone(attachment);
    },
    deleteAttachment: async (id) => {
      for (const p of pages)
        p.attachments = p.attachments.filter((a) => a.attachmentId !== id);
      uploads.delete(id);
    },
    downloadAttachment: async (file) =>
      download(
        `/api/attachments/${file.attachmentId}/download`,
        file.originalName,
      ),
  };
}
export const previewApi = createPreviewApi();
