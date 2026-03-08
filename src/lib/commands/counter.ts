export type CounterAction = "up" | "down" | "reset";

/**
 * Parse a counter command. Returns the action or null.
 * Usage: SBB count up     (increment by 1)
 *        SBB count down   (decrement by 1)
 *        SBB count reset  (reset to 0)
 */
export function parseCounter(input: string): CounterAction | null {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === "up" || trimmed === "down" || trimmed === "reset") {
    return trimmed;
  }

  return null;
}

/**
 * Apply a counter action to the current value. Returns the new value.
 */
export function applyCounter(
  current: number,
  action: CounterAction
): number {
  switch (action) {
    case "up":
      return current + 1;
    case "down":
      return current - 1;
    case "reset":
      return 0;
  }
}
