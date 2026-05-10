export { EXTRACTION_PROMPT_V0 } from './prompts/v0';
export const PROMPT_VERSION = 'v0' as const;

export type ExtractedEntityProposal = {
  kind: 'venue' | 'area' | 'tip';
  name: string;
  quote?: string;
  metadata?: Record<string, unknown>;
};

export type ExtractionPayload = {
  entities: ExtractedEntityProposal[];
};
