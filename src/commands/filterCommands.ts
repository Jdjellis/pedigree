import type { Command, CommandContext } from './types';

/**
 * Filter and rank commands based on a search query.
 *
 * @param query - Search string (case-insensitive). Empty/whitespace queries return all available.
 * @param commands - List of commands to filter.
 * @param ctx - Runtime context used to check command availability.
 * @returns Filtered and ranked command list. Commands are ranked by prefix match first,
 *          then substring match, with registry order preserved within each tier.
 */
export function filterCommands(
  query: string,
  commands: Command[],
  ctx: CommandContext
): Command[] {
  // Filter: drop unavailable commands
  const available = commands.filter((cmd) => {
    if (!cmd.isAvailable) return true;
    return cmd.isAvailable(ctx);
  });

  // Empty/whitespace query: return all available in registry order
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return available;
  }

  // Normalize query to lowercase for case-insensitive matching
  const lowerQuery = trimmedQuery.toLowerCase();

  // Match: find commands where title or keywords contain the query
  const matched = available.filter((cmd) => {
    const titleLower = cmd.title.toLowerCase();
    if (titleLower.includes(lowerQuery)) return true;

    if (cmd.keywords) {
      return cmd.keywords.some((keyword) => keyword.toLowerCase().includes(lowerQuery));
    }

    return false;
  });

  // Rank: separate prefix matches from substring matches
  const prefixMatches: Command[] = [];
  const substringMatches: Command[] = [];

  matched.forEach((cmd) => {
    const titleLower = cmd.title.toLowerCase();
    if (titleLower.startsWith(lowerQuery)) {
      prefixMatches.push(cmd);
    } else {
      substringMatches.push(cmd);
    }
  });

  // Combine: prefix matches first (registry order preserved), then substring matches
  return [...prefixMatches, ...substringMatches];
}
