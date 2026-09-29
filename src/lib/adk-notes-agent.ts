import { FunctionTool, LlmAgent } from "@google/adk";
import { trace } from "@opentelemetry/api";

import { z } from "zod";

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "what",
  "which",
  "does",
  "from",
  "your",
  "about",
  "into",
  "are",
  "was",
  "were",
  "how",
  "why",
  "who",
  "when",
  "where",
  "can",
  "could",
  "would",
  "should",
]);

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function createChunks(notes: string): string[] {
  const paragraphs = notes
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length > 1) {
    return paragraphs;
  }

  const sentences = notes
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return [notes.trim()];
  }

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const candidate = currentChunk ? `${currentChunk} ${sentence}` : sentence;

    if (candidate.length > 600 && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = sentence;
    } else {
      currentChunk = candidate;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function searchNoteChunks(notes: string, query: string) {
  const chunks = createChunks(notes);
  const queryTerms = normalizeWords(query);

  return chunks
    .map((content, index) => {
      const normalizedContent = content.toLowerCase();

      const matchedTerms = queryTerms.filter((term) =>
        normalizedContent.includes(term),
      );

      return {
        chunkId: `chunk-${index + 1}`,
        score: matchedTerms.length,
        matchedTerms,
        content,
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

const searchNotesParameters = z.object({
  query: z
    .string()
    .min(1)
    .describe("The topic or information to search for in the user's note."),
});

const readFullNoteParameters = z.object({
  reason: z.string().min(1).describe("Why the complete note is required."),
});

export function createAdkNotesAgent(notes: string) {
  const searchNotes = new FunctionTool({
    name: "searchNotes",

    description:
      "Search the user's note for passages relevant to a focused factual question.",

    parameters: searchNotesParameters,

    execute: async ({ query }: z.infer<typeof searchNotesParameters>) => {
      const span = trace.getActiveSpan();

      span?.setAttribute("notes.tool.name", "searchNotes");

      span?.setAttribute("notes.tool.query", query);

      const matches = searchNoteChunks(notes, query);

      span?.setAttribute("notes.tool.match_count", matches.length);

      span?.setAttribute(
        "notes.tool.matched_chunks",
        matches.map((match) => match.chunkId).join(","),
      );

      return {
        query,
        matchCount: matches.length,
        matches,
      };
    },
  });

  const readFullNote = new FunctionTool({
    name: "readFullNote",

    description:
      "Read the complete user's note. Use this for broad questions, summaries, overviews, comparisons, or when search results are insufficient.",

    parameters: readFullNoteParameters,

    execute: async ({ reason }: z.infer<typeof readFullNoteParameters>) => {
      const span = trace.getActiveSpan();

      span?.setAttribute("notes.tool.name", "readFullNote");

      span?.setAttribute("notes.tool.reason", reason);

      span?.setAttribute("notes.tool.character_count", notes.length);

      return {
        reason,
        characterCount: notes.length,
        content: notes,
      };
    },
  });

  return new LlmAgent({
    name: "notes_agent",

    description:
      "Answers questions using only evidence found in the user's notes.",

    model: process.env.GEMINI_AGENT_MODEL ?? "gemini-3.5-flash",

    instruction: `
You are Notes Agent.

Your task is to answer the user's question using ONLY information obtained from the provided tools.

You have two tools:

1. searchNotes
Use this for focused or factual questions.

2. readFullNote
Use this when:
- the user requests an overview or summary,
- the question requires broad context,
- searchNotes returns insufficient evidence,
- or you need additional context before answering.

Rules:
- You MUST use at least one tool before producing the final answer.
- Never answer from your own general knowledge.
- Tool results are your only source of truth.
- Prefer searchNotes for specific questions.
- If searchNotes is insufficient, you may call readFullNote.
- If the answer cannot be supported by the note, respond exactly:
  "Not found in notes."
- Never invent information.
- Never claim information is in the note unless a tool returned supporting evidence.
- Keep the final answer concise.
    `.trim(),

    tools: [searchNotes, readFullNote],
  });
}
