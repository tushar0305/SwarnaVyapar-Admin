/**
 * @deprecated Prefer `@/lib/gemini-sales`. Kept as a thin re-export so older imports keep working.
 */
export {
  generateAiSalesScripts,
  isGeminiConfigured as isOpenAiConfigured,
  isGeminiConfigured,
  type AiSalesContext,
  type AiSalesScripts,
} from '@/lib/gemini-sales';
