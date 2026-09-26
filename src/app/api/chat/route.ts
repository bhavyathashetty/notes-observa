import { generateText } from "ai";
import { notesModel } from "@/lib/ai";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const notes = body.notes;
    const question = body.question;

    if (typeof notes !== "string" || !notes.trim()) {
      return Response.json(
        { error: "Notes are required." },
        { status: 400 }
      );
    }

    if (typeof question !== "string" || !question.trim()) {
      return Response.json(
        { error: "A question is required." },
        { status: 400 }
      );
    }

    const result = await generateText({
      model: notesModel,

      system: `
You are a question-answering assistant for a user's notes.

Answer questions using ONLY the provided notes.

Rules:
- Do not use outside knowledge.
- Do not make assumptions.
- Do not invent information.
- If the answer is not contained in the notes, respond exactly:
  "Not found in notes."
- Keep the answer clear and concise.
      `.trim(),

      prompt: `
--- NOTES START ---

${notes}

--- NOTES END ---

Question:
${question}
      `.trim(),

      telemetry: {
        functionId: "ask-notes",
        includeRuntimeContext: {
          feature: true,
          application: true,
        },
      },
      runtimeContext: {
        feature: "notes-question-answering",
        application: "notes-observability-lab",
      },
    });

    return Response.json({
      answer: result.text,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return Response.json(
      {
        error: "Failed to answer the question.",
      },
      {
        status: 500,
      }
    );
  }
}
