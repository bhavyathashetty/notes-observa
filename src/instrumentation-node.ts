import { registerOTel } from "@vercel/otel";
import { OpenTelemetry } from "@ai-sdk/otel";
import { registerTelemetry } from "ai";

import {
  isOpenInferenceSpan,
  OpenInferenceSimpleSpanProcessor,
} from "@arizeai/openinference-vercel";

import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";

import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";

let registered = false;

export function registerArizeObservability() {
  if (registered) {
    return;
  }

  const spaceId = process.env.ARIZE_SPACE_ID;
  const apiKey = process.env.ARIZE_API_KEY;
  const projectName =
    process.env.ARIZE_PROJECT_NAME ?? "notes-observability-lab";

  if (!spaceId || !apiKey) {
    console.warn(
      "[Observability] ARIZE_SPACE_ID or ARIZE_API_KEY is missing. Tracing is disabled."
    );

    return;
  }

  registerTelemetry(
    new OpenTelemetry({
      usage: true,
      providerMetadata: true,
      embedding: true,
      reranking: true,
      runtimeContext: true,
      headers: true,
      toolChoice: true,
      schema: true,
    })
  );

  const exporter = new OTLPTraceExporter({
    url: "https://otlp.arize.com/v1/traces",

    headers: {
      "arize-space-id": spaceId,
      "arize-api-key": apiKey,
      "x-project-name": projectName,
    },
  });

  registerOTel({
    serviceName: "notes-observability-lab",

    attributes: {
      [SEMRESATTRS_PROJECT_NAME]: projectName,
    },

    spanProcessors: [
      new OpenInferenceSimpleSpanProcessor({
        exporter,

        spanFilter: isOpenInferenceSpan,

        reparentOrphanedSpans: true,

        propagateContextAttributes: true,
      }),
    ],
  });

  registered = true;

  console.log(
    `[Observability] Arize tracing enabled for project: ${projectName}`
  );
}