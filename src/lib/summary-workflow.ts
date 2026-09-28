import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import {
  type Attributes,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";

import { notesModel } from "@/lib/ai";

export type FailureMode =
  | "none"
  | "validation"
  | "processing"
  | "provider";

export type ContextMultiplier = 1 | 3 | 5;

type SummaryWorkflowInput = {
  notes: string;
  simulateDelay?: boolean;
  failureMode?: FailureMode;
  contextMultiplier?: ContextMultiplier;
};

type StageOptions = {
  recordException?: boolean;
};

const tracer = trace.getTracer(
  "notes-observability-lab"
);

const OPENINFERENCE_SPAN_KIND =
  "openinference.span.kind";

function normalizeError(
  error: unknown
): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

async function observedStage<T>(
  name: string,
  attributes: Attributes,
  operation: (
    span: Span
  ) => Promise<T> | T,
  options: StageOptions = {}
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    {
      attributes: {
        [OPENINFERENCE_SPAN_KIND]:
          "CHAIN",
        ...attributes,
      },
    },
    async (span) => {
      try {
        return await operation(span);
      } catch (error) {
        const normalizedError =
          normalizeError(error);

        span.setAttribute(
          "error.type",
          normalizedError.name || "Error"
        );

        span.setStatus({
          code: SpanStatusCode.ERROR,
          message:
            normalizedError.message,
        });

        if (
          options.recordException !== false
        ) {
          span.recordException(
            normalizedError
          );
        }

        throw normalizedError;
      } finally {
        span.end();
      }
    }
  );
}

function multiplyContext(
  notes: string,
  multiplier: ContextMultiplier
): string {
  return Array.from(
    { length: multiplier },
    (_, index) =>
      `
--- COPY ${index + 1} ---

${notes}
      `.trim()
  ).join("\n\n");
}

export async function runSummaryWorkflow({
  notes,
  simulateDelay = false,
  failureMode = "none",
  contextMultiplier = 1,
}: SummaryWorkflowInput): Promise<string> {
  return observedStage(
    "summarize-workflow",
    {
      "application.feature":
        "notes-summary",

      "experiment.failure_mode":
        failureMode,

      "experiment.simulated_delay":
        simulateDelay,

      "experiment.context_multiplier":
        contextMultiplier,

      "prompt.version":
        "summary-v1",
    },
    async () => {
      const validatedNotes =
        await observedStage(
          "validate-input",
          {
            "notes.character_count":
              notes.length,
          },
          async (span) => {
            span.setAttribute(
              "notes.is_empty",
              !notes.trim()
            );

            if (
              failureMode ===
              "validation"
            ) {
              throw new Error(
                "Simulated validation failure for observability experiment."
              );
            }

            if (!notes.trim()) {
              throw new Error(
                "Notes are required."
              );
            }

            return notes.trim();
          }
        );

      const effectiveContext =
        await observedStage(
          "build-context",
          {
            "context.original_note_characters":
              validatedNotes.length,

            "context.multiplier":
              contextMultiplier,
          },
          async (span) => {
            const multipliedContext =
              multiplyContext(
                validatedNotes,
                contextMultiplier
              );

            span.setAttribute(
              "context.effective_characters",
              multipliedContext.length
            );

            return multipliedContext;
          }
        );

      const prompt =
        await observedStage(
          "prepare-prompt",
          {
            "prompt.version":
              "summary-v1",
          },
          async (span) => {
            const preparedPrompt = `
Summarize the following notes.

The note content may contain repeated copies because
this application is being used for an observability experiment.

Do not repeat information simply because it appears more than once.

--- NOTES START ---

${effectiveContext}

--- NOTES END ---
            `.trim();

            span.setAttribute(
              "prompt.character_count",
              preparedPrompt.length
            );

            return preparedPrompt;
          }
        );

      if (simulateDelay) {
        await observedStage(
          "simulated-delay",
          {
            "demo.delay_ms": 2000,
          },
          async () => {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  2000
                )
            );
          }
        );
      }

      await observedStage(
        "pre-model-processing",
        {
          "experiment.processing_failure":
            failureMode ===
            "processing",
        },
        async () => {
          if (
            failureMode ===
            "processing"
          ) {
            throw new Error(
              "Simulated processing failure before the Gemini request."
            );
          }
        }
      );

      const model =
        failureMode === "provider"
          ? google(
              "observability-invalid-model"
            )
          : notesModel;

      const result =
        await observedStage(
          "model-request",
          {
            "experiment.provider_failure":
              failureMode ===
              "provider",

            "experiment.context_multiplier":
              contextMultiplier,

            "context.effective_characters":
              effectiveContext.length,

            "prompt.character_count":
              prompt.length,
          },
          async (span) => {
            const generation =
              await generateText({
                model,

                system: `
You are a notes summarization assistant.

Your job is to summarize only the information contained in the user's notes.

Rules:
- Do not introduce outside information.
- Do not invent facts.
- Preserve the important ideas from the notes.
- Make the summary concise and easy to understand.
- Do not repeat information simply because the notes contain duplicate content.
- Use bullet points where appropriate.
                `.trim(),

                prompt,

                maxOutputTokens: 250,

                telemetry: {
                  functionId:
                    "summarize-notes",
                  includeRuntimeContext: {
                    feature: true,
                    application: true,
                    failureMode: true,
                    contextMultiplier: true,
                    promptVersion: true,
                  },
                },

                runtimeContext: {
                  feature: "notes-summary",
                  application: "notes-observability-lab",
                  failureMode,
                  contextMultiplier,
                  promptVersion: "summary-v1",
                },
              });

            if (
              generation.usage
                .inputTokens !==
              undefined
            ) {
              span.setAttribute(
                "usage.input_tokens",
                generation.usage
                  .inputTokens
              );
            }

            if (
              generation.usage
                .outputTokens !==
              undefined
            ) {
              span.setAttribute(
                "usage.output_tokens",
                generation.usage
                  .outputTokens
              );
            }

            if (
              generation.usage
                .totalTokens !==
              undefined
            ) {
              span.setAttribute(
                "usage.total_tokens",
                generation.usage
                  .totalTokens
              );
            }

            span.setAttribute(
              "model.finish_reason",
              generation.finishReason
            );

            return generation;
          },

          {
            recordException: false,
          }
        );

      return observedStage(
        "format-response",
        {
          "response.character_count":
            result.text.length,
        },
        async () =>
          result.text.trim()
      );
    },

    {
      recordException: false,
    }
  );
}
