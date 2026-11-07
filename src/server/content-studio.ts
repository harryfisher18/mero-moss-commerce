import { ContentStudioService } from "@/server/content-studio-service";
import { getDatabase } from "@/server/db/client";
import {
  AnthropicContentDraftProvider,
  type ContentDraftProvider,
  FallbackContentDraftProvider,
  RulesContentDraftProvider,
} from "@/server/integrations/content-draft-provider";
import { WordingStatus } from "@/server/integrations/wording-provider";

/** Default model for optional AI drafts. Override with CONTENT_MODEL. */
export const DEFAULT_CONTENT_MODEL = "claude-opus-5-5";

/** AI drafting is on only when ANTHROPIC_API_KEY is set explicitly. */
export function contentConfig(env: Readonly<Record<string, string | undefined>> = process.env): {
  apiKey: string | null;
  model: string | null;
} {
  const apiKey = env.ANTHROPIC_API_KEY?.trim() || null;
  if (!apiKey) return { apiKey: null, model: null };
  return { apiKey, model: env.CONTENT_MODEL?.trim() || DEFAULT_CONTENT_MODEL };
}

interface ContentRuntime {
  readonly status: WordingStatus;
  readonly provider: ContentDraftProvider;
}

declare global {
  var __meroMossContent: ContentRuntime | undefined;
}

function runtime(): ContentRuntime {
  if (!globalThis.__meroMossContent) {
    const { apiKey, model } = contentConfig();
    const status = new WordingStatus(model);
    globalThis.__meroMossContent = {
      status,
      provider:
        apiKey && model
          ? new FallbackContentDraftProvider(
              new AnthropicContentDraftProvider(apiKey, model),
              status,
            )
          : new RulesContentDraftProvider(),
    };
  }
  return globalThis.__meroMossContent;
}

export function contentAiStatus(): WordingStatus {
  return runtime().status;
}

export function contentStudio(): ContentStudioService {
  return new ContentStudioService(getDatabase(), runtime().provider);
}
