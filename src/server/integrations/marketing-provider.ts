import type { JourneyId, LifecycleMessage } from "@/domain/lifecycle/journeys";

export interface OutgoingMessage extends LifecycleMessage {
  readonly journey: JourneyId;
  readonly to: string;
}

/** Only one delivery result exists today. A live provider would need separate authorization. */
export type DeliveryResult = "preview_only";

export interface MarketingProvider {
  deliver(message: OutgoingMessage): DeliveryResult;
}

/** The demo provider contacts nobody. The caller stores the message as a preview. */
export class DemoMarketingProvider implements MarketingProvider {
  deliver(): DeliveryResult {
    return "preview_only";
  }
}
