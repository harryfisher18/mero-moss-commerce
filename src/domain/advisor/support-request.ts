import { z } from "zod";

/** A shopper's request to talk to a person, validated at the boundary. */
export const supportRequestSchema = z.object({
  email: z.email("Enter a valid email address.").max(254, "That email address is too long."),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters).")
    .max(2000, "Please keep your message under 2,000 characters."),
  /** The advisor question that led here, kept as context for the team. */
  question: z.string().trim().max(300).default(""),
});

export type SupportRequestInput = z.infer<typeof supportRequestSchema>;
export type SupportRequestField = keyof SupportRequestInput;
