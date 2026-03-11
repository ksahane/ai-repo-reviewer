# AI Agentic Repository Reviewer

This repository contains a **Next.js/Node.js application** (with an optional CLI entrypoint) that evaluates a public GitHub repo using a RAG-powered LLM pipeline. See `architecture.mmd` for a high‑level flowchart of the system.

Command‑line Node.js utility that analyzes a GitHub repository URL using an OpenRouter-powered pipeline:

- Clone repository
- Read README and file structure
- Retrieve top‑k best‑practice chunks (RAG)
- Generate analysis
- Generate reflection (self‑critique)

## What this project does

**Technologies & libraries used:** Node.js 20+, Next.js for the UI/server, `simple-git` for cloning, `compute-cosine-similarity` for vector comparison, `langchain` for text splitting, and the OpenAI-compatible OpenRouter client for model calls.

## What this project does

The UI is a single Next.js page where a user submits a public GitHub repository URL. The backend then:

- clones the repository into a temporary directory
- reads the repository `README.md`
- collects a limited file tree snapshot
- retrieves the most relevant guidance text from `data/best_practices.txt`
- sends the combined prompt to an OpenRouter model for analysis
- sends the first answer back through the model for a reflection pass

The final API response includes:

- `analysis`: the first-pass repository review
- `reflection`: a second-pass critique or refinement
- `retrievedChunks`: the RAG snippets selected from the local best-practices file

## Architecture

Detailed ASCII flow with fully vertical layout (each box has a one-line description):

```
+------+      User starts by providing a repo URL
| User |
+------+
   |
   v
+-------+      Main script (initialize & validate)
| main  |
+-------+
   |
   v
+----------+   tools.js handles cloning/listing
| tools.js |
| (clone)  |
+----------+
   |
   v
+----------+   rag.js performs embedding & retrieval
|  rag.js  |
| (embed/  |
| retrieve)|
+----------+
   |
   v
+-----------+  agent.js generates the analysis
| agent.js  |
| (analysis)|
+-----------+
   |
   v
+--------+      Output printed to console
| output |
+--------+
```

## Models used

This project uses OpenRouter through the OpenAI-compatible client in [`lib/openrouter.js`](/Users/home/Downloads/ai-agentic-reviewer-openrouter/lib/openrouter.js).

- Analysis model:
  `meta-llama/llama-3-8b-instruct`
- Embedding model:
  `text-embedding-ada-002`

These are the current defaults in code and can be overridden with environment variables:

- `OPENROUTER_ANALYSIS_MODEL`
- `OPENROUTER_EMBEDDING_MODEL`

Model usage in the pipeline:

- The analysis model is used twice:
  once for the main review and once for the reflection pass.
- The embedding model is used for RAG retrieval:
  it embeds the repository README and each chunk from `data/best_practices.txt`, then ranks chunks by cosine similarity.

## How Semantic Retrieval Works

This project uses a simple semantic retrieval method inside [`lib/reviewer.js`](/Users/home/AI/ai-repo-reviewer/lib/reviewer.js):

**Step 1. Load best-practices corpus**  
_Method:_ `readBestPractices()`

↓

**Step 2. Split corpus into chunks**  
_Method:_ `retrieveContext()` + `RecursiveCharacterTextSplitter`

↓

**Step 3. Generate embeddings**  
_Method:_ `embed()`

↓

**Step 4. Create vectors**  
_Method:_ `openrouterClient.embeddings.create(...)`

↓

**Step 5. Compare with repository README**  
_Method:_ `cosineSimilarity(...)`

↓

**Step 6. Select top 3 matches**  
_Method:_ `retrieveContext(readme, 3)`

↓

**Step 7. Build final analysis prompt**  
_Method:_ `buildPrompt(...)`

In practice, this means the reviewer does not retrieve text by exact keyword match. It retrieves the best-practice passages that are most semantically similar to the repository README, then uses those passages as context for the analysis and reflection steps.

## Requirements

- Node.js 20+
- OpenRouter API key

## Setup

The easiest way to run the agent is via the built-in web UI, but the core logic is also usable from the command line (see `src/main.js`). The following steps start the dev server:

1. Create `.env.local` (or `.env`) in project root:

```bash
OPENROUTER_API_KEY=your_key_here
# Optional overrides:
# OPENROUTER_ANALYSIS_MODEL=meta-llama/llama-3-8b-instruct
# OPENROUTER_EMBEDDING_MODEL=text-embedding-ada-002
```

2. Install dependencies:

```bash
npm install
```

3. Run dev server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## API

`POST /api/analyze`

Request body:

```json
{ "repoUrl": "https://github.com/vercel/next.js" }
```

Response body:

```json
{
  "analysis": "...",
  "reflection": "...",
  "retrievedChunks": ["...", "...", "..."]
}
```

## Request flow

1. User submits a repository URL from the page in [`app/page.js`](/Users/home/Downloads/ai-agentic-reviewer-openrouter/app/page.js).
2. The API route in [`app/api/analyze/route.js`](/Users/home/Downloads/ai-agentic-reviewer-openrouter/app/api/analyze/route.js) validates input and starts the review.
3. The reviewer in [`lib/reviewer.js`](/Users/home/Downloads/ai-agentic-reviewer-openrouter/lib/reviewer.js) clones the repository and gathers README plus file context.
4. The same reviewer runs RAG retrieval against [`data/best_practices.txt`](/Users/home/Downloads/ai-agentic-reviewer-openrouter/data/best_practices.txt).
5. The combined prompt is sent to OpenRouter for analysis and reflection.
6. JSON is returned to the UI and rendered on the page.

## Project structure

- `app/page.js`: single-page UI with form + results
- `app/api/analyze/route.js`: analysis endpoint
- `lib/reviewer.js`: clone, RAG retrieval, analysis + reflection pipeline
- `lib/openrouter.js`: OpenRouter client and model config
- `data/best_practices.txt`: retrieval corpus for RAG
