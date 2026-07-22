import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  TRIAGE_CATEGORIES,
  TRIAGE_URGENCIES,
  WorkOrderTriage,
} from '@app/contracts';
import { TriageClassifier, TriageInput } from './triage-classifier';

/**
 * The JSON schema does double duty: it constrains generation (the API
 * guarantees the response parses and the enums hold) and it documents the
 * contract — the same closed vocabularies consumers see in @app/contracts.
 */
const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: [...TRIAGE_CATEGORIES] },
    urgency: { type: 'string', enum: [...TRIAGE_URGENCIES] },
    reasoning: {
      type: 'string',
      description: 'One sentence justifying the classification.',
    },
  },
  required: ['category', 'urgency', 'reasoning'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You triage maintenance requests for residential properties.
Classify each request into a category and an urgency level.
Urgency guidance: "emergency" means active danger or damage in progress (gas leak, flooding, no heat in winter); "high" means the home is significantly impaired; "medium" means inconvenient but livable; "low" means cosmetic or routine.
The tenant-reported priority is a hint, not ground truth — tenants overstate and understate.`;

@Injectable()
export class AnthropicTriageClassifier extends TriageClassifier {
  private readonly logger = new Logger(AnthropicTriageClassifier.name);
  private readonly client: Anthropic | null;
  private readonly model = process.env.TRIAGE_MODEL ?? 'claude-opus-4-8';

  constructor() {
    super();
    // Explicit key check instead of letting the SDK resolve credentials:
    // a server workload should be deterministic about whether triage is on.
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY not set, triage is disabled');
    }
  }

  async classify(input: TriageInput): Promise<WorkOrderTriage | null> {
    if (!this.client) return null;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        // Simple classification: skip thinking, spend little.
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: TRIAGE_SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              `Title: ${input.title}`,
              `Description: ${input.description}`,
              `Tenant-reported priority: ${input.priority}`,
            ].join('\n'),
          },
        ],
      });

      if (response.stop_reason === 'refusal') {
        this.logger.warn('classification refused by the model');
        return null;
      }
      const text = response.content.find((block) => block.type === 'text');
      if (!text) return null;
      return JSON.parse(text.text) as WorkOrderTriage;
    } catch (error) {
      // Triage must never break the event flow: rate limits, outages and
      // bad requests all degrade to "no classification".
      if (error instanceof Anthropic.APIError) {
        this.logger.error(`Anthropic API error ${error.status}: ${error.message}`);
      } else {
        this.logger.error(
          'unexpected triage failure',
          error instanceof Error ? error.stack : String(error),
        );
      }
      return null;
    }
  }
}
