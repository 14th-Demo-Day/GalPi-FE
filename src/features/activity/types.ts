export type Category =
  "EXTERNAL" | "CAMPUS" | "CLUB" | "CONTEST" | "STUDY" | "ETC";
export type PageType = "ACTIVITY" | "INSIGHT" | "MEMO";
export type Sort = "LATEST" | "OLDEST" | "CATEGORY";
export const categories: Record<Category, string> = {
  EXTERNAL: "대외활동",
  CAMPUS: "교내 활동",
  CLUB: "동아리",
  CONTEST: "공모전",
  STUDY: "학습",
  ETC: "기타",
};
export const pageTypes: Record<
  PageType,
  { label: string; description: string; note: string }
> = {
  ACTIVITY: {
    label: "활동",
    description: "행동과 결과",
    note: "ACTIVITY NOTE",
  },
  INSIGHT: {
    label: "인사이트",
    description: "생각과 해석",
    note: "INSIGHT NOTE",
  },
  MEMO: { label: "자유 메모", description: "자유로운 기록", note: "FREE NOTE" },
};
export interface BookInput {
  title: string;
  startDate: string;
  endDate: string | null;
  category: Category;
}
export interface Book extends BookInput {
  bookId: number;
  coverColor?: "GREEN" | "SAGE" | "CREAM";
  createdAt?: string;
  pageCount?: number;
}
export interface Attachment {
  attachmentId: number;
  originalName: string;
  contentType: string;
  size: number;
}
export interface PageSummary {
  pageId: number;
  pageType: PageType;
  pageNo: number;
  preview: string;
  createdAt: string;
  updatedAt: string;
}
export interface BookPages {
  bookId: number;
  bookTitle: string;
  pages: PageSummary[];
}
export interface BookPage extends PageSummary {
  bookId: number;
  bookTitle: string;
  category: Category;
  pageCount: number;
  activityStartDate: string;
  activityEndDate: string | null;
  content: Record<string, string>;
  attachments: Attachment[];
}
export interface ExportInput {
  format: "PDF" | "DOCX";
  scope: "CURRENT" | "ALL" | "SELECTED";
  basePageId?: number;
  pageIds?: number[];
  includePhotos: boolean;
  includeFileList: boolean;
}
export const dateText = (date: string | null | undefined) =>
  date ? date.slice(0, 10).replaceAll("-", ".") : "선택 안 함";
export const pageNumber = (n: number) => String(n).padStart(2, "0");
