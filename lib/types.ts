export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  fullText: string;
  messages: ChatMessage[];
};

export type LineFeedbackItem = {
  quotedLine: string;
  feedback: string;
};

export type CritiqueResult = {
  genrePrinciples: string;
  score: number;
  overallStrengths: string[];
  overallWeaknesses: string[];
  lineFeedback: LineFeedbackItem[];
};

export type CritiqueMeta = {
  title: string;
  similarArtists: string;
  genre: string;
};
