import {
  runSummaryWorkflow,
  type ContextMultiplier,
  type FailureMode,
} from "@/lib/summary-workflow";

const validFailureModes: FailureMode[] =
  [
    "none",
    "validation",
    "processing",
    "provider",
  ];

const validContextMultipliers:
  ContextMultiplier[] = [1, 3, 5];

function isFailureMode(
  value: unknown
): value is FailureMode {
  return (
    typeof value === "string" &&
    validFailureModes.includes(
      value as FailureMode
    )
  );
}

function isContextMultiplier(
  value: unknown
): value is ContextMultiplier {
  return (
    typeof value === "number" &&
    validContextMultipliers.includes(
      value as ContextMultiplier
    )
  );
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const notes = body.notes;

    const simulateDelay =
      body.simulateDelay === true;

    const failureMode: FailureMode =
      isFailureMode(
        body.failureMode
      )
        ? body.failureMode
        : "none";

    const contextMultiplier:
      ContextMultiplier =
        isContextMultiplier(
          body.contextMultiplier
        )
          ? body.contextMultiplier
          : 1;

    if (
      typeof notes !== "string" ||
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

    const summary =
      await runSummaryWorkflow({
        notes,
        simulateDelay,
        failureMode,
        contextMultiplier,
      });

    return Response.json({
      summary,
    });
  } catch (error) {
    console.error(
      "Summarize workflow error:",
      error
    );

    return Response.json(
      {
        error:
          "Summary workflow failed. Inspect the newest trace in Arize to identify the failing stage.",
      },
      {
        status: 500,
      }
    );
  }
}