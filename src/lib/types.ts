// API のレスポンス型（Worker とフロントエンドで共有する）

export type CourseId = "beginner" | "intermediate" | "advanced";

export const COURSE_IDS: readonly CourseId[] = ["beginner", "intermediate", "advanced"];

export const QUESTIONS_PER_QUIZ = 10;

export type ImageInfo = {
  url: string;
  width: number;
  height: number;
  alt: string;
  credit: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

export type SessionState = {
  sessionId: string;
  courseId: CourseId;
  total: number;
  answeredCount: number;
  correctCount: number;
  finished: boolean;
};

export type QuestionView = {
  position: number;
  total: number;
  body: string;
  image: ImageInfo | null;
  choices: { id: number; body: string }[];
  // 回答済みの場合だけ入る（リロード時の復元用）
  answered: AnswerResult | null;
};

export type AnswerResult = {
  position: number;
  correct: boolean;
  choiceId: number;
  correctChoiceId: number;
  explanation: string;
  explanationImage: ImageInfo | null;
  correctCount: number;
  finished: boolean;
};

export type ResultView = {
  sessionId: string;
  courseId: CourseId;
  total: number;
  correctCount: number;
  accuracy: number;
  elapsedMs: number;
  finished: boolean;
  ranked: boolean;
  answers: {
    position: number;
    body: string;
    correct: boolean;
    yourAnswer: string;
    correctAnswer: string;
  }[];
};

export type RankingEntry = {
  rank: number;
  nickname: string;
  correctCount: number;
  total: number;
  accuracy: number;
  elapsedMs: number;
  createdAt: number;
};

export type ApiError = { error: string };
