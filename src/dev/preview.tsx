import { ActivityApp } from "../features/activity/ActivityApp";
import { previewApi } from "./previewApi";

export default function Preview() {
  return <ActivityApp api={previewApi} />;
}
