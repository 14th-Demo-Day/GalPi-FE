import type { CSSProperties } from "react";
import roadmapIcon from "../../assets/figma/5-14-img.svg";
import activityIcon from "../../assets/figma/5-14-img1.svg";
import connectionIcon from "../../assets/figma/5-14-img2.svg";

const iconUrl = {
  roadmap: roadmapIcon,
  activity: activityIcon,
  connection: connectionIcon,
} as const;

const tabs = [
  { id: "roadmap", icon: "roadmap", label: "로드맵" },
  { id: "activity", icon: "activity", label: "활동" },
  { id: "connections", icon: "connection", label: "경험 연결" },
] as const;

type Tab = (typeof tabs)[number]["id"];

export function BottomNav({
  activeTab,
  onNavigate,
}: {
  activeTab: Tab;
  onNavigate?: (tab: Tab) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="주 메뉴">
      {tabs.map(({ id, icon, label }) => (
        <button
          key={id}
          type="button"
          aria-current={id === activeTab ? "page" : undefined}
          disabled={id !== activeTab && !onNavigate}
          onClick={id === activeTab ? undefined : () => onNavigate?.(id)}
        >
          {/* The exported SVGs have fixed colors; mask them so the active tab
              icon follows the label color. */}
          <span
            className="nav-icon"
            aria-hidden="true"
            style={{ "--icon": `url("${iconUrl[icon]}")` } as CSSProperties}
          />
          {label}
        </button>
      ))}
    </nav>
  );
}
