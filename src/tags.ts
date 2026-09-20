/**
 * The topics a story can carry. One list, imported by the renderer (tag pages,
 * filters) and the API (which rejects a "follow" for a tag that does not
 * exist), so the two can never disagree about what a valid tag is.
 */
export const TAGS = ["agents", "research", "models", "tools", "infra", "funding", "policy", "india"] as const;
export type Tag = (typeof TAGS)[number];
