import OpenAI from 'openai';

// OpenRouter exposes an OpenAI-compatible API, so the official client works here.
export const openrouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// These can be overridden in env without changing application code.
export const ANALYSIS_MODEL = process.env.OPENROUTER_ANALYSIS_MODEL || 'meta-llama/llama-3-8b-instruct';
export const EMBEDDING_MODEL = process.env.OPENROUTER_EMBEDDING_MODEL || 'text-embedding-ada-002';
