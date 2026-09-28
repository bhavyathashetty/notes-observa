"use client";

import { useState } from "react";

type FailureMode =
  | "none"
  | "validation"
  | "processing"
  | "provider";

type ContextMultiplier =
  | 1
  | 3
  | 5;

export default function Home() {
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");

  const [summary, setSummary] = useState("");
  const [answer, setAnswer] = useState("");

  const [isSummarizing, setIsSummarizing] =
    useState(false);

  const [isAnswering, setIsAnswering] =
    useState(false);

  const [summaryError, setSummaryError] =
    useState("");

  const [answerError, setAnswerError] =
    useState("");

  const [simulateDelay, setSimulateDelay] =
    useState(false);

  const [failureMode, setFailureMode] =
    useState<FailureMode>("none");

  const [
    contextMultiplier,
    setContextMultiplier,
  ] =
    useState<ContextMultiplier>(1);

  async function handleSummarize() {
    if (!notes.trim()) {
      return;
    }

    setIsSummarizing(true);
    setSummaryError("");
    setSummary("");

    try {
      const response = await fetch(
        "/api/summarize",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            notes,
            simulateDelay,
            failureMode,
            contextMultiplier,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to summarize notes."
        );
      }

      setSummary(data.summary);
    } catch (error) {
      console.error(error);

      setSummaryError(
        error instanceof Error
          ? error.message
          : "Something went wrong while summarizing."
      );
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleAsk() {
    if (
      !notes.trim() ||
      !question.trim()
    ) {
      return;
    }

    setIsAnswering(true);
    setAnswerError("");
    setAnswer("");

    try {
      const response = await fetch(
        "/api/chat",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            notes,
            question,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Failed to answer question."
        );
      }

      setAnswer(data.answer);
    } catch (error) {
      console.error(error);

      setAnswerError(
        error instanceof Error
          ? error.message
          : "Something went wrong while answering."
      );
    } finally {
      setIsAnswering(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10">
          <div className="mb-3 inline-flex rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-400">
            AI Observability Learning Lab
          </div>

          <h1 className="text-4xl font-semibold tracking-tight">
            Notes Observer
          </h1>

          <p className="mt-3 max-w-2xl text-slate-400">
            Summarize notes, ask
            questions, and deliberately
            change application behavior
            to understand AI
            observability.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* LEFT SIDE */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4">
              <h2 className="text-xl font-medium">
                Your notes
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Use sample,
                non-sensitive notes for
                this observability lab.
              </p>
            </div>

            <textarea
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              placeholder="Paste your notes here..."
              className="min-h-[320px] w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-slate-500"
            />

            {/* OBSERVABILITY CONTROLS */}
            <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950 p-4">
              <h3 className="text-sm font-medium text-slate-200">
                Observability
                experiment
              </h3>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                Deliberately change
                application behavior and
                inspect the resulting
                traces in Arize.
              </p>

              {/* FAILURE MODE */}
              <div className="mt-4">
                <label className="mb-2 block text-xs text-slate-400">
                  Failure mode
                </label>

                <select
                  value={failureMode}
                  onChange={(event) =>
                    setFailureMode(
                      event.target
                        .value as FailureMode
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-slate-500"
                >
                  <option value="none">
                    No forced failure
                  </option>

                  <option value="validation">
                    Validation failure
                  </option>

                  <option value="processing">
                    Processing failure
                  </option>

                  <option value="provider">
                    Gemini / provider
                    failure
                  </option>
                </select>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Creates a controlled
                  failure so you can see
                  which span fails.
                </p>
              </div>

              {/* CONTEXT MULTIPLIER */}
              <div className="mt-5">
                <label className="mb-2 block text-xs text-slate-400">
                  Context size
                  experiment
                </label>

                <select
                  value={
                    contextMultiplier
                  }
                  onChange={(event) =>
                    setContextMultiplier(
                      Number(
                        event.target
                          .value
                      ) as ContextMultiplier
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none transition focus:border-slate-500"
                >
                  <option value={1}>
                    Normal context — 1×
                  </option>

                  <option value={3}>
                    Bloated context — 3×
                  </option>

                  <option value={5}>
                    Very bloated context —
                    5×
                  </option>
                </select>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Artificially repeats
                  the note so you can
                  observe how context size
                  affects tokens and
                  latency.
                </p>
              </div>

              {/* LATENCY EXPERIMENT */}
              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3">
                <input
                  type="checkbox"
                  checked={
                    simulateDelay
                  }
                  onChange={(event) =>
                    setSimulateDelay(
                      event.target.checked
                    )
                  }
                  className="mt-0.5 h-4 w-4"
                />

                <div>
                  <div className="text-sm text-slate-300">
                    Simulate slow
                    processing
                  </div>

                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    Adds a 2-second delay
                    so you can identify
                    the bottleneck inside
                    the trace.
                  </div>
                </div>
              </label>
            </div>

            {/* SUMMARY BUTTON */}
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                {notes.length.toLocaleString()}{" "}
                characters
              </span>

              <button
                type="button"
                onClick={
                  handleSummarize
                }
                disabled={
                  !notes.trim() ||
                  isSummarizing
                }
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSummarizing
                  ? "Summarizing..."
                  : "Summarize"}
              </button>
            </div>
          </section>

          {/* RIGHT SIDE */}
          <div className="space-y-6">
            {/* SUMMARY */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-medium">
                Summary
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Generated from the notes
                using Gemini.
              </p>

              <div className="mt-4 min-h-[170px] whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                {isSummarizing && (
                  <span className="text-slate-500">
                    Running summary
                    workflow...
                  </span>
                )}

                {!isSummarizing &&
                  summary &&
                  summary}

                {!isSummarizing &&
                  !summary &&
                  !summaryError && (
                    <span className="text-slate-600">
                      Your AI-generated
                      summary will appear
                      here.
                    </span>
                  )}

                {!isSummarizing &&
                  summaryError && (
                    <span className="text-red-400">
                      {summaryError}
                    </span>
                  )}
              </div>
            </section>

            {/* ASK NOTES */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-medium">
                Ask your notes
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Gemini is instructed to
                answer using only the
                information in the notes.
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  value={question}
                  onChange={(event) =>
                    setQuestion(
                      event.target.value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      question.trim() &&
                      notes.trim() &&
                      !isAnswering
                    ) {
                      handleAsk();
                    }
                  }}
                  placeholder="Ask a question..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-slate-500"
                />

                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={
                    !notes.trim() ||
                    !question.trim() ||
                    isAnswering
                  }
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isAnswering
                    ? "Asking..."
                    : "Ask"}
                </button>
              </div>

              <div className="mt-4 min-h-[120px] whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                {isAnswering && (
                  <span className="text-slate-500">
                    Gemini is searching
                    your notes...
                  </span>
                )}

                {!isAnswering &&
                  answer &&
                  answer}

                {!isAnswering &&
                  !answer &&
                  !answerError && (
                    <span className="text-slate-600">
                      The answer will
                      appear here.
                    </span>
                  )}

                {!isAnswering &&
                  answerError && (
                    <span className="text-red-400">
                      {answerError}
                    </span>
                  )}
              </div>
            </section>
          </div>
        </div>

        {/* STATUS */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">
              Observability status
            </span>

            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">
              Gemini connected
            </span>

            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">
              Arize connected
            </span>

            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
              Context {contextMultiplier}
              ×
            </span>

            {simulateDelay && (
              <span className="rounded-full bg-amber-950 px-3 py-1 text-xs text-amber-300">
                +2s latency experiment
              </span>
            )}

            {failureMode !==
              "none" && (
              <span className="rounded-full bg-red-950 px-3 py-1 text-xs text-red-300">
                Failure:{" "}
                {failureMode}
              </span>
            )}
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            Requests are traced with
            OpenTelemetry and exported
            to Arize AX. Change the
            experiment controls above,
            run the same request, and
            compare the resulting spans,
            latency, errors, prompts,
            and token usage.
          </p>
        </section>
      </div>
    </main>
  );
}