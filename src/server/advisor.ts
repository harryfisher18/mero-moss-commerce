import { getDatabase } from "@/server/db/client";
import {
  CatalogRecommendationProvider,
  type RecommendationProvider,
} from "@/server/integrations/recommendation-provider";
import { AnthropicWordingProvider, WordingStatus } from "@/server/integrations/wording-provider";
import { SqliteCatalogRepository } from "@/server/repositories/catalog-repository";
import { SupportService } from "@/server/support-service";

/** Default model for optional assisted wording. Override with ADVISOR_MODEL. */
export const DEFAULT_ADVISOR_MODEL = "claude-opus-5-5";

export interface AdvisorConfig {
  readonly apiKey: string | null;
  readonly model: string | null;
}

/** Assisted wording is on only when ANTHROPIC_API_KEY is set explicitly. */
export function advisorConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AdvisorConfig {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || null;
  if (!apiKey) return { apiKey: null, model: null };
  return { apiKey, model: env.ADVISOR_MODEL?.trim() || DEFAULT_ADVISOR_MODEL };
}

interface AdvisorRuntime {
  readonly status: WordingStatus;
  readonly wording: AnthropicWordingProvider | null;
}

declare global {
  var __meroMossAdvisor: AdvisorRuntime | undefined;
}

/** One runtime per process so the status reflects real calls across requests. */
function runtime(): AdvisorRuntime {
  if (!globalThis.__meroMossAdvisor) {
    const config = advisorConfig();
    globalThis.__meroMossAdvisor = {
      status: new WordingStatus(config.model),
      wording:
        config.apiKey && config.model
          ? new AnthropicWordingProvider(config.apiKey, config.model)
          : null,
    };
  }
  return globalThis.__meroMossAdvisor;
}

export function advisorStatus(): WordingStatus {
  return runtime().status;
}

export function recommendationProvider(): RecommendationProvider {
  const { wording, status } = runtime();
  return new CatalogRecommendationProvider(
    new SqliteCatalogRepository(getDatabase()),
    wording,
    status,
  );
}

export function supportService(): SupportService {
  return new SupportService(getDatabase());
}
