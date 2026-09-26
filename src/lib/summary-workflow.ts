import { generateText } from "ai";
import { trace } from "@opentelemetry/api";
import { traceChain } from "@arizeai/openinference-core";
import { notesModel } from "@/lib/ai";

type SummaryWorkflowInput = {
  notes: string;
  simulateDelay?: boolean;
};

const validateInput = traceChain(
  async (notes: string) => {
    const span = trace.getActiveSpan();

    span?.setAttribute("notes.character_count", notes.length);
    span?.setAttribute("notes.is_empty", !notes.trim());

    if (!notes.trim()) {
      throw new Error("Notes are required.");
    }

    return notes.trim();
  },
  {
    name: "validate-input",

    // Do not duplicate the full note contents into this span.
    processInput: () => ({}),
    processOutput: () => ({}),
  }
);

const prepareContext = traceChain(
  async (notes: string) => {
    const span = trace.getActiveSpan();

    const prompt = `
Summarize the following notes:

--- NOTES START ---

${notes}

--- NOTES END ---
    `.trim();

    span?.setAttribute("context.note_characters", notes.length);
    span?.setAttribute("context.prompt_characters", prompt.length);

    return prompt;
  },
  {
    name: "prepare-context",
    processInput: () => ({}),
    processOutput: () => ({}),
  }
);

const simulatedDelay = traceChain(
  async (delayMs: number) => {
    const span = trace.getActiveSpan();

    span?.setAttribute("demo.delay_ms", delayMs);

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  },
  {
    name: "simulated-delay",
    processInput: () => ({}),
    processOutput: () => ({}),
  }
);

const formatResponse = traceChain(
  async (response: string) => {
    const span = trace.getActiveSpan();

    span?.setAttribute("response.character_count", response.length);

    return response.trim();
  },
  {
    name: "format-response",
    processInput: () => ({}),
    processOutput: () => ({}),
  }
);

export const runSummaryWorkflow = traceChain(
  async ({ notes, simulateDelay = false }: SummaryWorkflowInput) => {
    const rootSpan = trace.getActiveSpan();

    rootSpan?.setAttribute(
      "application.feature",
      "notes-summary"
    );

    rootSpan?.setAttribute(
      "experiment.simulated_delay",
      simulateDelay
    );

    const validatedNotes = await validateInput(notes);

    const prompt = await prepareContext(validatedNotes);

    if (simulateDelay) {
      await simulatedDelay(2000);
    }

    const result = await generateText({
      model: notesModel,

      system: `
You are a notes summarization assistant.

Your job is to summarize only the information contained in the user's notes.

Rules:
- Do not introduce outside information.
- Do not invent facts.
- Preserve the important ideas from the notes.
- Make the summary concise and easy to understand.
- Use bullet points where appropriate.
      `.trim(),

      prompt,

      telemetry: {
        functionId: "summarize-notes",
        includeRuntimeContext: {
          feature: true,
          application: true,
        },
      },

      runtimeContext: {
        feature: "notes-summary",
        application: "notes-observability-lab",
      },
    });

    return formatResponse(result.text);
  },
  {
    name: "summarize-workflow",

    // Avoid putting the complete input/output on the workflow span.
    // Gemini's own span will still give us the LLM observability.
    processInput: () => ({}),
    processOutput: () => ({}),
  }
);
