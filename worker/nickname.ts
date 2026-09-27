// ランキング用ニックネームの検証

const MAX_LENGTH = 20;

// 明らかに不適切な語と、宣伝・誘導に使われやすいパターン。
// 比較前に NFKC 正規化・小文字化・空白除去を行う
const NG_WORDS = [
  "死ね", "しね", "殺す", "ころす", "きちがい", "キチガイ", "ガイジ", "がいじ", "池沼",
  "まんこ", "ちんこ", "ちんぽ", "セックス", "せっくす", "レイプ", "うんこ",
  "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "porn",
];
const URL_LIKE = /(https?:|www\.|\.com|\.net|\.jp|\.xyz|discord\.gg|line\.me|t\.me)/i;
// 制御文字・ゼロ幅文字・双方向制御文字
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/;

export type NicknameResult = { ok: true; value: string } | { ok: false; error: string };

export function validateNickname(input: unknown): NicknameResult {
  if (typeof input !== "string") return { ok: false, error: "ニックネームを入力してください。" };
  const value = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (value.length === 0) return { ok: false, error: "ニックネームを入力してください。" };
  if ([...value].length > MAX_LENGTH) return { ok: false, error: `ニックネームは${MAX_LENGTH}文字以内にしてください。` };
  if (INVISIBLE.test(value)) return { ok: false, error: "使用できない文字が含まれています。" };

  // URL 判定は記号を残したまま行い、NG ワード判定は記号や空白で区切ってすり抜けられないよう除去してから行う
  const normalized = value.normalize("NFKC").toLowerCase();
  if (URL_LIKE.test(normalized.replace(/\s/g, ""))) return { ok: false, error: "URL などは登録できません。" };
  const folded = normalized.replace(/[\s._\-・]/g, "");
  if (NG_WORDS.some((w) => folded.includes(w.normalize("NFKC").toLowerCase()))) {
    return { ok: false, error: "そのニックネームは登録できません。" };
  }
  return { ok: true, value };
}
