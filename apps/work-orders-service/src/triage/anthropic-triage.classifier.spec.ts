import { AnthropicTriageClassifier } from './anthropic-triage.classifier';
import { TriageInput } from './triage-classifier';

const input: TriageInput = {
  title: 'Leaking tap in kitchen',
  description: 'Constant drip under the sink',
  priority: 'high',
};

type FakeClient = { messages: { create: jest.Mock } };

const buildClassifier = (
  fake: FakeClient | null,
): AnthropicTriageClassifier => {
  const classifier = new AnthropicTriageClassifier();
  (classifier as unknown as { client: FakeClient | null }).client = fake;
  return classifier;
};

describe('AnthropicTriageClassifier', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    // The constructor gates on the key; give it one so the spec controls the
    // client, then swap the client for a fake.
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it('is disabled without an API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    const classifier = new AnthropicTriageClassifier();

    await expect(classifier.classify(input)).resolves.toBeNull();
  });

  it('parses a structured classification out of the response', async () => {
    const fake: FakeClient = {
      messages: {
        create: jest.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                category: 'plumbing',
                urgency: 'high',
                reasoning: 'Active leak.',
              }),
            },
          ],
        }),
      },
    };
    const classifier = buildClassifier(fake);

    const triage = await classifier.classify(input);

    expect(triage).toEqual({
      category: 'plumbing',
      urgency: 'high',
      reasoning: 'Active leak.',
    });
    expect(fake.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        output_config: expect.objectContaining({
          format: expect.objectContaining({ type: 'json_schema' }) as object,
        }) as object,
      }),
    );
  });

  it('treats a model refusal as "no classification"', async () => {
    const fake: FakeClient = {
      messages: {
        create: jest
          .fn()
          .mockResolvedValue({ stop_reason: 'refusal', content: [] }),
      },
    };

    await expect(buildClassifier(fake).classify(input)).resolves.toBeNull();
  });

  it('degrades to null when the API call fails', async () => {
    const fake: FakeClient = {
      messages: {
        create: jest.fn().mockRejectedValue(new Error('network down')),
      },
    };

    await expect(buildClassifier(fake).classify(input)).resolves.toBeNull();
  });
});
