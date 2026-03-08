const MAX_TEXT_LENGTH = 200;

/**
 * Parse a text command. Returns the sanitized text string or null.
 * Usage: SBB text Hello World!
 */
export function parseText(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Limit length to prevent abuse
  const text = trimmed.slice(0, MAX_TEXT_LENGTH);

  // Strip HTML tags to prevent injection
  const sanitized = text.replace(/<[^>]*>/g, "");

  return sanitized || null;
}
