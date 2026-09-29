export const runtime = "nodejs";

import {
  InMemoryRunner,
  isFinalResponse,
} from "@google/adk";

import {
  createAdkNotesAgent,
} from "@/lib/adk-notes-agent";

type AgentExecutionStep = {
  author: string;

  type:
    | "message"
    | "tool-call"
    | "tool-result"
    | "final-response";

  toolName?: string;
  input?: unknown;
  output?: unknown;
  text?: string;
};

type AgentRunResult = {
  finalAnswer: string;
  executionSteps: AgentExecutionStep[];
  sessionId: string;
};

const APP_NAME =
  "notes-observability-lab";

const USER_ID =
  "local-notes-user";

const MAX_ATTEMPTS = 3;

/**
 * Extract normal text content from an ADK event.
 */
function getTextFromEvent(
  event: any
): string {
  const parts =
    event.content?.parts ?? [];

  return parts
    .map((part: any) => {
      return typeof part.text === "string"
        ? part.text
        : "";
    })
    .filter(Boolean)
    .join("")
    .trim();
}

/**
 * Gemini may occasionally return transient
 * provider errors such as:
 *
 * 503 SERVICE_UNAVAILABLE
 * 429 RESOURCE_EXHAUSTED
 *
 * These are safe to retry for this project
 * because our current tools are read-only.
 */
function isRetryableProviderError(
  error: unknown
): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  const normalized =
    message.toUpperCase();

  return (
    normalized.includes("[503]") ||
    normalized.includes(
      "SERVICE_UNAVAILABLE"
    ) ||
    normalized.includes(
      "UNAVAILABLE"
    ) ||
    normalized.includes(
      "HIGH DEMAND"
    ) ||
    normalized.includes("[429]") ||
    normalized.includes(
      "RESOURCE_EXHAUSTED"
    )
  );
}

async function sleep(
  milliseconds: number
): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds
    );
  });
}

/**
 * Run one complete ADK agent invocation.
 *
 * A new session is created for every attempt.
 */
async function runAgentOnce(
  notes: string,
  question: string
): Promise<AgentRunResult> {
  const agent =
    createAdkNotesAgent(
      notes
    );

  const runner =
    new InMemoryRunner({
      agent,
      appName:
        APP_NAME,
    });

  const sessionId =
    crypto.randomUUID();

  const session =
    await runner
      .sessionService
      .createSession({
        appName:
          APP_NAME,

        userId:
          USER_ID,

        sessionId,
      });

  const executionSteps:
    AgentExecutionStep[] = [];

  let finalAnswer = "";

  /**
   * Explicit role: "user" is important
   * for multi-step ADK tool-call history.
   */
  const events =
    runner.runAsync({
      userId:
        session.userId,

      sessionId:
        session.id,

      newMessage: {
        role:
          "user",

        parts: [
          {
            text:
              question,
          },
        ],
      },
    });

  for await (
    const event of events
  ) {
    /**
     * If ADK emits an error event,
     * convert it into an exception.
     *
     * The outer retry layer decides
     * whether it is retryable.
     */
    if (
      event.errorMessage
    ) {
      const errorCode =
        event.errorCode
          ? ` [${event.errorCode}]`
          : "";

      throw new Error(
        `ADK error${errorCode}: ${event.errorMessage}`
      );
    }

    const parts =
      event.content?.parts ?? [];

    /**
     * Inspect tool calls and tool responses.
     */
    for (
      const part of parts
    ) {
      const eventPart =
        part as any;

      if (
        eventPart.functionCall
      ) {
        executionSteps.push({
          author:
            event.author,

          type:
            "tool-call",

          toolName:
            eventPart
              .functionCall
              .name,

          input:
            eventPart
              .functionCall
              .args,
        });
      }

      if (
        eventPart.functionResponse
      ) {
        executionSteps.push({
          author:
            event.author,

          type:
            "tool-result",

          toolName:
            eventPart
              .functionResponse
              .name,

          output:
            eventPart
              .functionResponse
              .response,
        });
      }
    }

    const text =
      getTextFromEvent(
        event
      );

    /**
     * Record intermediate textual
     * agent messages if ADK emits them.
     */
    if (
      text &&
      !isFinalResponse(
        event
      )
    ) {
      executionSteps.push({
        author:
          event.author,

        type:
          "message",

        text,
      });
    }

    /**
     * Capture the final ADK answer.
     */
    if (
      isFinalResponse(
        event
      )
    ) {
      const finalText =
        getTextFromEvent(
          event
        );

      if (
        finalText
      ) {
        finalAnswer =
          finalText;

        executionSteps.push({
          author:
            event.author,

          type:
            "final-response",

          text:
            finalText,
        });
      }
    }
  }

  if (
    !finalAnswer
  ) {
    finalAnswer =
      "Not found in notes.";
  }

  return {
    finalAnswer,
    executionSteps,

    sessionId:
      session.id,
  };
}

/**
 * Run the agent with bounded retry.
 *
 * Attempt 1
 *   ↓ failure
 * wait 1 second
 *
 * Attempt 2
 *   ↓ failure
 * wait 2 seconds
 *
 * Attempt 3
 *   ↓ success or final failure
 */
async function runAgentWithRetry(
  notes: string,
  question: string
): Promise<
  AgentRunResult & {
    attemptsUsed: number;
  }
> {
  let lastError:
    unknown;

  for (
    let attempt = 1;
    attempt <=
    MAX_ATTEMPTS;
    attempt++
  ) {
    try {
      console.log(
        `[Notes Agent] Starting attempt ${attempt}/${MAX_ATTEMPTS}`
      );

      const result =
        await runAgentOnce(
          notes,
          question
        );

      console.log(
        `[Notes Agent] Attempt ${attempt} completed successfully`
      );

      return {
        ...result,

        attemptsUsed:
          attempt,
      };
    } catch (error) {
      lastError =
        error;

      console.error(
        `[Notes Agent] Attempt ${attempt} failed:`,
        error
      );

      const retryable =
        isRetryableProviderError(
          error
        );

      /**
       * Immediately fail:
       *
       * - non-transient error
       * - or no attempts remain
       */
      if (
        !retryable ||
        attempt ===
          MAX_ATTEMPTS
      ) {
        throw error;
      }

      /**
       * Exponential backoff:
       *
       * Attempt 1 → 1 second
       * Attempt 2 → 2 seconds
       */
      const delayMs =
        1000 *
        2 **
          (attempt - 1);

      console.warn(
        `[Notes Agent] Transient provider error. Retrying in ${delayMs}ms...`
      );

      await sleep(
        delayMs
      );
    }
  }

  throw (
    lastError ??
    new Error(
      "Notes Agent failed unexpectedly."
    )
  );
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const notes =
      body.notes;

    const question =
      body.question;

    /**
     * Validate notes.
     */
    if (
      typeof notes !==
        "string" ||
      !notes.trim()
    ) {
      return Response.json(
        {
          error:
            "Notes are required.",
        },
        {
          status: 400,
        }
      );
    }

    /**
     * Validate question.
     */
    if (
      typeof question !==
        "string" ||
      !question.trim()
    ) {
      return Response.json(
        {
          error:
            "A question is required.",
        },
        {
          status: 400,
        }
      );
    }

    const result =
      await runAgentWithRetry(
        notes.trim(),
        question.trim()
      );

    return Response.json({
      answer:
        result.finalAnswer,

      agent: {
        sdk:
          "Google ADK",

        agentName:
          "notes_agent",

        sessionId:
          result.sessionId,

        attemptsUsed:
          result.attemptsUsed,

        eventCount:
          result.executionSteps
            .length,

        execution:
          result.executionSteps,
      },
    });
  } catch (error) {
    console.error(
      "Google ADK Notes Agent error:",
      error
    );

    /**
     * Keep provider/internal details
     * on the server rather than exposing
     * them directly to the browser.
     */
    return Response.json(
      {
        error:
          "The Notes Agent failed to complete the request.",
      },
      {
        status: 500,
      }
    );
  }
}