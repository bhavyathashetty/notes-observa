"use client";

import { useState } from "react";

export default function Home() {
  const [notes, setNotes] = useState("");
  const [question, setQuestion] = useState("");

  const [summary, setSummary] = useState("");
  const [answer, setAnswer] = useState("");

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);

  const [summaryError, setSummaryError] = useState("");
  const [answerError, setAnswerError] = useState("");

  const [simulateDelay, setSimulateDelay] = useState(false);

  async function handleSummarize() {
    if (!notes.trim()) {
      return;
    }

    setIsSummarizing(true);
    setSummaryError("");
    setSummary("");

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes,
          simulateDelay,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to summarize notes.");
      }

      setSummary(data.summary);
    } catch (error) {
      console.error(error);

      setSummaryError(
        error instanceof Error
          ? error.message
          : "Something went wrong while summarizing.",
      );
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleAsk() {
    if (!notes.trim() || !question.trim()) {
      return;
    }

    setIsAnswering(true);
    setAnswerError("");
    setAnswer("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notes,
          question,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to answer question.");
      }

      setAnswer(data.answer);
    } catch (error) {
      console.error(error);

      setAnswerError(
        error instanceof Error
          ? error.message
          : "Something went wrong while answering.",
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
            Summarize notes, ask questions about them, and observe every AI
            request using Arize.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <div className="mb-4">
              <h2 className="text-xl font-medium">Your notes</h2>

              <p className="mt-1 text-sm text-slate-400">
                Paste some non-sensitive notes that you want Gemini to
                understand.
              </p>
            </div>

            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Paste your notes here..."
              className="min-h-[320px] w-full resize-none rounded-xl border border-slate-700 bg-slate-950 p-4 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-slate-500"
            />

            <div className="mt-4 space-y-4">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
                <input
                  type="checkbox"
                  checked={simulateDelay}
                  onChange={(event) => setSimulateDelay(event.target.checked)}
                  className="h-4 w-4"
                />

                <div>
                  <div className="text-sm text-slate-300">
                    Simulate slow processing
                  </div>

                  <div className="text-xs text-slate-500">
                    Adds a 2-second delay for our observability experiment.
                  </div>
                </div>
              </label>

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {notes.length.toLocaleString()} characters
                </span>

                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={!notes.trim() || isSummarizing}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSummarizing ? "Summarizing..." : "Summarize"}
                </button>
              </div>
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-medium">Summary</h2>

              <div className="mt-4 min-h-[150px] whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                {isSummarizing && (
                  <span className="text-slate-500">
                    Gemini is reading your notes...
                  </span>
                )}

                {!isSummarizing && summary && summary}

                {!isSummarizing && !summary && !summaryError && (
                  <span className="text-slate-600">
                    Your AI-generated summary will appear here.
                  </span>
                )}

                {summaryError && (
                  <span className="text-red-400">{summaryError}</span>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-medium">Ask your notes</h2>

              <p className="mt-1 text-sm text-slate-400">
                Gemini is instructed to answer using only the notes above.
              </p>

              <div className="mt-4 flex gap-2">
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      question.trim() &&
                      notes.trim() &&
                      !isAnswering
                    ) {
                      handleAsk();
                    }
                  }}
                  placeholder="Ask a question..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-slate-500"
                />

                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={!notes.trim() || !question.trim() || isAnswering}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isAnswering ? "Asking..." : "Ask"}
                </button>
              </div>

              <div className="mt-4 min-h-[100px] whitespace-pre-wrap rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                {isAnswering && (
                  <span className="text-slate-500">
                    Gemini is searching your notes...
                  </span>
                )}

                {!isAnswering && answer && answer}

                {!isAnswering && !answer && !answerError && (
                  <span className="text-slate-600">
                    The answer will appear here.
                  </span>
                )}

                {answerError && (
                  <span className="text-red-400">{answerError}</span>
                )}
              </div>
            </section>
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">Observability status</span>

            <span className="rounded-full bg-emerald-950 px-3 py-1 text-xs text-emerald-300">
              Gemini connected
            </span>

            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">
              Arize not connected
            </span>
          </div>

          <p className="mt-3 text-sm text-slate-500">
            Gemini is now generating real responses. The next checkpoint will
            instrument these requests with Arize.
          </p>
        </section>
      </div>
    </main>
  );
}
