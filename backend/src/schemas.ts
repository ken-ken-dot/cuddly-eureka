import { Type } from "@sinclair/typebox";

export const TranscribeBody = Type.Object({
  audio: Type.String({ description: "base64-encoded audio (no data: prefix)" }),
  languageCode: Type.String({ minLength: 2, maxLength: 10 }),
});

export const TranslateBody = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 1000 }),
  sourceLang: Type.String({ minLength: 2, maxLength: 10 }),
  targetLang: Type.String({ minLength: 2, maxLength: 10 }),
});

export const TtsBody = Type.Object({
  text: Type.String({ minLength: 1, maxLength: 500 }),
  languageCode: Type.String({ minLength: 2, maxLength: 10 }),
});

export type TranscribeBodyType = { audio: string; languageCode: string };
export type TranslateBodyType = { text: string; sourceLang: string; targetLang: string };
export type TtsBodyType = { text: string; languageCode: string };
