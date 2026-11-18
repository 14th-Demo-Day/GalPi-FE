import type { PageType } from "./types";

export const pageFields: Record<PageType, [string, string, string][]> = {
  ACTIVITY: [
    ["situation", "S  Situation", "어떤 상황이었는지"],
    ["task", "T  Task", "내가 맡은 역할"],
    ["action", "A  Action", "실제로 한 행동"],
    ["result", "R  Result", "결과 + 배운 점"],
  ],
  INSIGHT: [
    ["motive", "생각의 계기", "어떤 경험이나 말, 글에서 시작된 생각인가요?"],
    [
      "discovery",
      "새롭게 알게 된 점",
      "기억하고 싶은 배움이나 생각은 무엇인가요?",
    ],
    ["idea", "번뜩인 아이디어", "이 생각에서 어떤 아이디어가 떠올랐나요?"],
    ["etc", "기타", "적용해 볼 일, 더 궁금한 점, 덧붙이고 싶은 내용이 있나요?"],
  ],
  MEMO: [["memo", "메모", "지금 남기고 싶은 생각이나 내용은 무엇인가요?"]],
};
