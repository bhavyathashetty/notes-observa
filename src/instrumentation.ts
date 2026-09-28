export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    (process.env.NODE_ENV === "development" &&
      process.env.ARIZE_ENABLE_DEV_OBSERVABILITY !== "true")
  ) {
    return;
  }

  const { registerArizeObservability } = await import(
    "./instrumentation-node"
  );

  registerArizeObservability();
}
