export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerArizeObservability } = await import(
      "./instrumentation-node"
    );

    registerArizeObservability();
  }
}