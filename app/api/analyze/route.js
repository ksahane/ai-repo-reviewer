import { NextResponse } from 'next/server';
import { runRepositoryReview } from '@/lib/reviewer';

// POST /api/analyze
// ------------------
// Receives a JSON payload with `repoUrl` from the client UI. The route
// performs light validation, forwards the request to the `runRepositoryReview`
// helper, and packages the result (or an error) into a consistent JSON
// response. Logging & timing information is included to assist with debugging
// and performance measurement.
export async function POST(request) {
  const startedAt = Date.now();
  const requestId = Math.random().toString(36).slice(2, 10);

  try {
    console.log(
      `[api:${requestId}] ${new Date().toISOString()} Incoming POST /api/analyze`
    );
    const body = await request.json();
    const repoUrl = body?.repoUrl?.trim();

    // The UI submits only the repository URL string. If the value is missing or
    // empty, we respond with a 400 status and an error message so the client can
    // display feedback.
    if (!repoUrl) {
      console.log(`[api:${requestId}] Missing repoUrl`);
      return NextResponse.json(
        { success: false, error: 'repoUrl is required.' },
        { status: 400 }
      );
    }

    // Delegate the heavy lifting to `runRepositoryReview`. This function
    // clones the repo, runs the RAG pipeline, invokes the analysis/reflection
    // models, and returns structured output.
    console.log(`[api:${requestId}] Running review for ${repoUrl}`);
    const result = await runRepositoryReview(repoUrl);
    const durationMs = Date.now() - startedAt;
    console.log(`[api:${requestId}] Success in ${durationMs}ms`);
    // Wrap the result with our own { success, metadata } envelope so the client
    // always has a predictable shape to inspect.
    return NextResponse.json({
      success: true,
      requestId,
      durationMs,
      repoUrl,
      ...result
    });
  } catch (error) {
    // Any unhandled exception during processing results in a 500. We still
    // include a requestId and timing so the caller can correlate with logs.
    const durationMs = Date.now() - startedAt;
    console.log(
      `[api:${requestId}] Failed in ${durationMs}ms: ${error.message || 'Unknown error'}`
    );
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Analysis failed.',
        requestId,
        durationMs
      },
      { status: 500 }
    );
  }
}
