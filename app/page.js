'use client';

import { useState } from 'react';

// Reusable surface for the main content blocks on the page.
function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white/90 p-6 shadow-[0_20px_60px_-24px_rgba(15,23,42,0.28)] backdrop-blur sm:p-7">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  // basic client-side validation: must look like a GitHub repo URL
  const isRepoUrlValid =
    repoUrl.trim().length > 0 &&
    /^https:\/\/github\.com\/.+/.test(repoUrl.trim());

  // Submit the repo URL to the server API and render the returned review data.
  async function onSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl })
      });

      const payload = await response.json();
      if (!response.ok || payload.success === false) {
        // API may return a 200 with success:false, so check both
        throw new Error(payload.error || 'Failed to analyze repository');
      }

      setResult(payload);
      // scroll to results section so user doesn't have to hunt for it
      setTimeout(() => {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-black/5 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(240,249,255,0.88))] p-8 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.4)] sm:p-10">
          <div className="mb-6 inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-sky-700">
            Repository Review
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Analyze a GitHub repository.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Submit a public GitHub URL to clone the repository, retrieve
            relevant best-practice context, run analysis, and generate a
            reflection pass.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                GitHub Repository URL
              </span>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="url"
                  required
                  value={repoUrl}
                  onChange={event => setRepoUrl(event.target.value)}
                  placeholder="https://github.com/vercel/next.js"
                  className={`min-w-0 flex-1 rounded-2xl border bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${
                    repoUrl && !isRepoUrlValid
                      ? 'border-red-400 ring-red-100'
                      : 'border-slate-200'
                  }`}
                />
                <button
                  type="submit"
                  disabled={loading || !isRepoUrlValid}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Analyzing...' : 'Analyze Repository'}
                </button>
              </div>
              {repoUrl && !isRepoUrlValid && (
                <p className="mt-1 text-xs text-red-600">
                  Please enter a valid GitHub repository URL.
                </p>
              )}
            </label>
          </form>
        </section>

        <section className="mt-6">
          <SectionCard
            title="How it works"
            description="The request stays on the server. The UI only handles input and display."
          >
            <div className="grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                1. Clone repo and inspect README plus file structure.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                2. Retrieve top matching best-practice chunks from the local RAG
                corpus.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                3. Run analysis and then a reflection pass with OpenRouter.
              </div>
            </div>
          </SectionCard>
        </section>

        {error ? (
          <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            {error}
          </section>
        ) : null}

        {loading ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <SectionCard
              title="Processing"
              description="The backend is cloning the repo and running the review steps."
            >
              <div className="space-y-3">
                <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            </SectionCard>
            <SectionCard
              title="Preparing output"
              description="Results will appear here after the analysis and reflection steps finish."
            >
              <div className="space-y-3">
                <div className="h-6 w-1/3 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 animate-pulse rounded-full bg-slate-100" />
                <div className="h-4 w-5/6 animate-pulse rounded-full bg-slate-100" />
              </div>
            </SectionCard>
          </section>
        ) : null}

        {result ? (
          <section className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-4">
              {/* metadata display */}
              <div className="text-sm text-slate-600">
                {result.repoUrl && (
                  <p>
                    <strong>Repository:</strong>{' '}
                    <a
                      href={result.repoUrl}
                      className="underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {result.repoUrl}
                    </a>
                  </p>
                )}
                {result.durationMs != null && (
                  <p>
                    <strong>Duration:</strong> {result.durationMs}ms
                  </p>
                )}
                {result.requestId && (
                  <p>
                    <strong>Request Id:</strong> {result.requestId}
                  </p>
                )}
              </div>

              <SectionCard
                title="Retrieved Context"
                description="Top chunks selected from the local best-practices corpus."
              >
                <div className="space-y-3">
                  {result.retrievedChunks?.map((chunk, index) => (
                    <article
                      key={index}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Chunk {index + 1}
                      </div>
                      <p className="text-sm leading-6 whitespace-pre-wrap text-slate-700">
                        {chunk}
                      </p>
                    </article>
                  ))}
                </div>
              </SectionCard>
            </div>

            <div className="space-y-6">
              <SectionCard
                title="Analysis"
                description="Primary repository review generated from repo metadata and retrieved context."
              >
                <div className="relative">
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {result.analysis}
                  </pre>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(result.analysis)
                    }
                    className="absolute top-2 right-2 rounded px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200"
                  >
                    Copy
                  </button>
                </div>
              </SectionCard>

              <SectionCard
                title="Reflection"
                description="Second-pass critique intended to refine or challenge the initial analysis."
              >
                <div className="relative">
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {result.reflection}
                  </pre>
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(result.reflection)
                    }
                    className="absolute top-2 right-2 rounded px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200"
                  >
                    Copy
                  </button>
                </div>
              </SectionCard>
            </div>
          </section>
        ) : (
          <section className="mt-6 rounded-[2rem] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              No analysis yet
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Enter a public GitHub repository URL to run the reviewer and
              populate analysis, reflection, and retrieved context.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
