import fs from 'fs';
import os from 'os';
import path from 'path';
import cosineSimilarity from 'compute-cosine-similarity';
import simpleGit from 'simple-git';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import {
  ANALYSIS_MODEL,
  EMBEDDING_MODEL,
  openrouterClient
} from './openrouter';

/*
  reviewer.js
  -----------
  Contains the core logic used by the API handler to inspect a GitHub
  repository, perform retrieval-augmented generation (RAG) against a local
  best-practices corpus, and invoke the LLM for analysis/reflection. The
  exported `runRepositoryReview` function orchestrates the end‑to‑end flow.
*/

/**
 * Helper for structured logging inside the review pipeline.
 *
 * @param {string} requestId - unique identifier for this review request
 * @param {string} message - human-readable status update
 */
function logStep(requestId, message) {
  const timestamp = new Date().toISOString();
  console.log(`[review:${requestId}] ${timestamp} ${message}`);
}

/**
 * Generate an embedding vector for a given piece of text using the configured
 * OpenRouter client. The vector representation is used during the RAG
 * retrieval step to compute semantic similarity.
 *
 * @param {string} text - raw text to embed
 * @returns {Promise<number[]>} embedding vector
 */
async function embed(text) {
  // Embeddings turn text into vectors so we can compare semantic similarity.
  const response = await openrouterClient.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });
  return response.data[0].embedding;
}

/**
 * Load the local knowledge base of best practices. The contents are
 * split into chunks and compared against the target README during retrieval.
 *
 * Returns a default guidance string when the file is absent so the pipeline
 * still functions cleanly in minimal setups.
 *
 * @returns {string} text of best practices
 */
function readBestPractices() {
  // This file is the local RAG knowledge base used to guide the review.
  const filePath = path.join(process.cwd(), 'data', 'best_practices.txt');
  if (!fs.existsSync(filePath)) {
    return 'README quality, project structure, and architecture clarity are expected.';
  }
  return fs.readFileSync(filePath, 'utf8');
}

// Read the repository README because it is the main source text used for matching and prompting.
/**
 * Retrieve the repository's README contents. The README is the principal source
 * of context passed to the LLM for evaluation. If none exists, a placeholder
 * message is returned.
 *
 * @param {string} repoPath - filesystem path where the repo is cloned
 * @returns {string} README text or fallback message
 */
function readReadme(repoPath) {
  const readmePath = path.join(repoPath, 'README.md');
  if (!fs.existsSync(readmePath)) {
    return 'No README found.';
  }
  return fs.readFileSync(readmePath, 'utf8');
}

// Collect a trimmed file tree snapshot for the LLM prompt.
/**
 * Walk the repository tree up to a limited depth and collect a trimmed file
 * listing. Hidden directories and large build outputs are skipped so the
 * prompt stays concise.
 *
 * @param {string} repoPath - filesystem path of the cloned repository
 * @returns {string} newline-separated list of files/directories
 */
function listFiles(repoPath) {
  const output = [];
  const skipDirs = new Set([
    '.git',
    'node_modules',
    '.next',
    'dist',
    'build',
    'coverage'
  ]);

  function walk(dir, depth = 0) {
    if (depth > 3) {
      return;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(repoPath, fullPath);

      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) {
          continue;
        }
        output.push(relPath + '/');
        // Limit recursion so the prompt stays useful and not overly large.
        walk(fullPath, depth + 1);
      } else {
        output.push(relPath);
      }

      if (output.length >= 300) {
        return;
      }
    }
  }

  walk(repoPath);
  return output.join('\n');
}

// Retrieve the most relevant guidance snippets from the local corpus using README similarity.
/**
 * Compare the repository README against the best‑practices corpus and return
 * the top‑K most semantically similar snippets. These chunks are later
 * injected into the prompt sent to the LLM as guidance.
 *
 * @param {string} readme - text of the target repository README
 * @param {number} topK - number of chunks to return
 * @returns {Promise<string[]>} array of guidance snippets
 */
async function retrieveContext(readme, topK = 3) {
  const bestPracticesText = readBestPractices();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 100
  });

  const docs = await splitter.createDocuments([bestPracticesText]);
  const chunks = docs.map(doc => doc.pageContent).filter(Boolean);

  // Use the repository README as the target text we want to match against guidance chunks.
  const readmeVector = await embed(readme);
  const ranked = [];

  for (const chunk of chunks) {
    const vector = await embed(chunk);
    ranked.push({
      chunk,
      score: cosineSimilarity(readmeVector, vector)
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  // Return only the most relevant guidance chunks for prompt injection.
  return ranked.slice(0, topK).map(item => item.chunk);
}

// Run the first-pass repository analysis.
/**
 * Perform the primary analysis chat completion against the assembled prompt.
 *
 * @param {string} prompt - full prompt containing best practices, file list, and README
 * @returns {Promise<string>} analysis text returned by the model
 */
async function analyzeRepo(prompt) {
  // First pass: generate the main repository review.
  const response = await openrouterClient.chat.completions.create({
    model: ANALYSIS_MODEL,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.choices[0]?.message?.content || 'No analysis generated.';
}

// Run a second-pass critique over the first answer.
/**
 * Run a second-pass 'reflection' completion that critiques the initial
 * analysis and attempts to surface additional insights or counterpoints.
 *
 * @param {string} text - the analysis output from `analyzeRepo`
 * @returns {Promise<string>} refined commentary
 */
async function reflect(text) {
  // Second pass: critique the first answer and improve it.
  const response = await openrouterClient.chat.completions.create({
    model: ANALYSIS_MODEL,
    messages: [
      { role: 'system', content: 'Critique and improve the analysis.' },
      { role: 'user', content: text }
    ]
  });

  return response.choices[0]?.message?.content || 'No reflection generated.';
}

// Assemble the final LLM prompt from retrieved guidance and live repository context.
function buildPrompt({ bestPracticeChunks, files, readme }) {
  // The model receives retrieved guidance plus live repo context in one prompt.
  return `Best Practices:\n${bestPracticeChunks.join('\n\n')}\n\nRepository Files:\n${files}\n\nREADME:\n${readme}\n\nEvaluate repository quality.\nProvide strengths, weaknesses, and score (0-10).`;
}

// Guard against invalid or unsupported repository URLs before cloning.
/**
 * Quick sanity check that a URL looks like a GitHub repository link. This is
 * used before cloning to avoid obvious mistakes (e.g. missing protocol or
 * wrong hostname).
 *
 * @param {string} repoUrl
 * @returns {boolean}
 */
function validateGithubRepoUrl(repoUrl) {
  let parsed;
  try {
    parsed = new URL(repoUrl);
  } catch {
    return false;
  }

  if (parsed.hostname !== 'github.com') {
    return false;
  }

  const parts = parsed.pathname.split('/').filter(Boolean);
  return parts.length >= 2;
}

// Orchestrate the full review flow for one repository URL.
/**
 * High-level entrypoint used by the API route. Validates the URL, clones the
 * repository into a temporary directory, gathers context (file listing + README),
 * performs retrieval, invokes the LLM for analysis and reflection, and finally
 * returns structured output along with metadata. On error the temporary
 * directory is always cleaned up.
 *
 * @param {string} repoUrl - publicly accessible GitHub URL
 * @returns {Promise<object>} review result containing analysis, reflection, etc.
 */
export async function runRepositoryReview(repoUrl) {
  const requestId = Math.random().toString(36).slice(2, 10);
  const startedAt = Date.now();

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is missing in environment variables.');
  }

  if (!validateGithubRepoUrl(repoUrl)) {
    throw new Error('Please provide a valid GitHub repository URL.');
  }

  const tempRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'repo-review-')
  );
  const repoPath = path.join(tempRoot, 'target');
  logStep(requestId, `Request started for ${repoUrl}`);

  try {
    // Work in a temporary directory so each request stays isolated.
    logStep(requestId, 'Cloning repository');
    await simpleGit().clone(repoUrl, repoPath);
    logStep(requestId, 'Repository cloned');

    logStep(requestId, 'Reading repository structure and README');
    const files = listFiles(repoPath);
    const readme = readReadme(repoPath);
    logStep(requestId, `Read README (${readme.length} chars) and file list`);

    logStep(requestId, 'Running RAG retrieval');
    const bestPracticeChunks = await retrieveContext(readme, 3);
    logStep(
      requestId,
      `Retrieved ${bestPracticeChunks.length} best-practice chunks`
    );

    const prompt = buildPrompt({ bestPracticeChunks, files, readme });
    logStep(requestId, 'Running analysis model');
    const analysis = await analyzeRepo(prompt);
    logStep(requestId, 'Analysis generated');

    logStep(requestId, 'Running reflection model');
    const reflection = await reflect(analysis);
    logStep(requestId, 'Reflection generated');

    const durationMs = Date.now() - startedAt;
    logStep(requestId, `Request completed in ${durationMs}ms`);

    // Return additional metadata so the API and UI can surface it.
    return {
      repoUrl,
      analysis,
      reflection,
      retrievedChunks: bestPracticeChunks,
      durationMs,
      requestId
    };
  } catch (error) {
    logStep(requestId, `Request failed: ${error.message}`);
    throw error;
  } finally {
    // Always clean up cloned files after the request finishes.
    logStep(requestId, 'Cleaning temporary directory');
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}
