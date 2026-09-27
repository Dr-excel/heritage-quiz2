import type { CourseId } from "./types";

export type CourseMeta = {
  id: CourseId;
  name: string;
  level: string;
  description: string;
  coverSiteId: string;
};

export const COURSES: CourseMeta[] = [
  {
    id: "beginner",
    name: "初級",
    level: "4級〜3級レベル",
    description: "日本の世界遺産と、誰もが知る世界の名所。世界遺産の基本ルールも。",
    coverSiteId: "jp-himeji",
  },
  {
    id: "intermediate",
    name: "中級",
    level: "2級レベル",
    description: "世界各地の代表的な遺産の歴史・特徴・登録基準に踏み込みます。",
    coverSiteId: "pe-machu-picchu",
  },
  {
    id: "advanced",
    name: "上級",
    level: "準1級〜1級レベル",
    description: "マイナーな遺産、条約や作業指針の細部、危機遺産や抹消の歴史まで。",
    coverSiteId: "jo-petra",
  },
];

export function courseName(id: string): string {
  return COURSES.find((c) => c.id === id)?.name ?? id;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}分${String(s).padStart(2, "0")}秒` : `${s}秒`;
}
