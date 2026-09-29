export async function register() {
  console.log(
    "========== INSTRUMENTATION STARTED =========="
  );

  console.log(
    "[Instrumentation] Runtime:",
    process.env.NEXT_RUNTIME
  );

  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  console.log(
    "[Instrumentation] Loading instrumentation-node.ts"
  );

  try {
    const module = await import("./instrumentation-node");

    console.log(
      "[Instrumentation] instrumentation-node.ts imported successfully"
    );

    console.log(
      "[Instrumentation] Calling registerArizeObservability()"
    );

    module.registerArizeObservability();

    console.log(
      "[Instrumentation] registerArizeObservability() completed"
    );
  } catch (error) {
    console.error(
      "========== OBSERVABILITY INITIALIZATION FAILED =========="
    );

    console.error(error);
  }
}