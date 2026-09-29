import {
  ToolLoopAgent,
  stepCountIs,
  tool,
} from "ai";

import { z } from "zod";

import { notesModel } from "@/lib/ai";

const NOTE_ID = "current-note";

function normalizeWords(text: string): string[] {
  const stopWords = new Set([
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
  ]);

  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(
      (word) =>
        word.length >= 3 &&
        !stopWords.has(word)
    );
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

  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if (
      currentChunk.length + sentence.length >
        600 &&
      currentChunk
    ) {
      chunks.push(currentChunk.trim());
      currentChunk = "";
    }

    currentChunk +=
      (currentChunk ? " " : "") +
      sentence;
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0
    ? chunks
    : [notes.trim()];
}

function searchChunks(
  notes: string,
  query: string
) {
  const chunks = createChunks(notes);
  const queryTerms = normalizeWords(query);

  const scoredChunks = chunks.map(
    (content, index) => {
      const normalizedContent =
        content.toLowerCase();

      const matchedTerms =
        queryTerms.filter((term) =>
          normalizedContent.includes(term)
        );

      return {
        chunkId: `chunk-${index + 1}`,
        score: matchedTerms.length,
        matchedTerms,
        content,
      };
    }
  );

  return scoredChunks
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function createNotesAgent(
  notes: string
) {
  const searchNotes = tool({
    description:
      "Search the user's note for passages relevant to a question. Use this for specific factual questions about the note.",

    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .describe(
          "The information to search for in the user's note."
        ),
    }),

    execute: async ({ query }) => {
      const matches = searchChunks(
        notes,
        query
      );

      return {
        noteId: NOTE_ID,
        query,
        matchCount: matches.length,
        matches,
      };
    },
  });

  const getNote = tool({
    description:
      "Read the complete note. Use this when the user asks for a broad explanation, summary, comparison, or when search results do not provide enough context.",

    inputSchema: z.object({
      noteId: z
        .string()
        .describe(
          'The note identifier. For this application use "current-note".'
        ),
    }),

    execute: async ({ noteId }) => {
      if (noteId !== NOTE_ID) {
        return {
          found: false,
          noteId,
          message:
            "The requested note does not exist.",
        };
      }

      return {
        found: true,
        noteId: NOTE_ID,
        content: notes,
      };
    },
  });

  return new ToolLoopAgent({
    id: "notes-agent",

    model: notesModel,

    instructions: `
You are Notes Agent.

Your job is to answer questions using ONLY information obtained from the user's note through your tools.

You have two tools:

1. searchNotes
   Use this for specific factual questions.

2. getNote
   Use this when:
   - the user asks about the note broadly,
   - the user asks for a summary,
   - search results are insufficient,
   - or you need additional context.

Rules:

- You MUST use at least one tool before answering.
- Never answer from your own general knowledge.
- Treat tool results as the only source of truth.
- If searchNotes does not provide enough evidence, use getNote.
- If the note does not contain the answer, respond exactly:
  "Not found in notes."
- Do not invent facts.
- Do not claim that information appeared in the note unless a tool returned it.
- Keep the final answer concise and directly answer the user's question.
    `.trim(),

    tools: {
      searchNotes,
      getNote,
    },

    /*
     * Force the first agent step to use a tool.
     * After that Gemini can decide whether to:
     *
     * - call another tool
     * - or produce the final answer
     */
    prepareStep: ({
      stepNumber,
    }) => {
      return {
        toolChoice:
          stepNumber === 0
            ? "required"
            : "auto",
      };
    },

    /*
     * Prevent runaway agent loops.
     */
    stopWhen: stepCountIs(5),

    experimental_telemetry: {
      isEnabled: true,

      functionId: "notes-agent",

      metadata: {
        application:
          "notes-observability-lab",

        feature:
          "agent-question-answering",
      },
    },
  });
}