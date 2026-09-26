import { runSummaryWorkflow } from "@/lib/summary-workflow";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const notes = body.notes;
    const simulateDelay = body.simulateDelay === true;

    if (typeof notes !== "string" || !notes.trim()) {
      return Response.json(
        {
          error: "Notes are required.",
        },
        {
          status: 400,
        }
      );
    }

    const summary = await runSummaryWorkflow({
      notes,
      simulateDelay,
    });

    return Response.json({
      summary,
    });
  } catch (error) {
    console.error("Summarize API error:", error);

    return Response.json(
      {
        error: "Failed to summarize the notes.",
      },
      {
        status: 500,
      }
    );
  }
}