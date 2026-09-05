function readValue(inputEntries, semanticId) {
  const entry = inputEntries.find((item) => item.semanticId === semanticId);
  const value = entry?.payload?.value;
  if (!value || typeof value !== 'object') return null;
  if (value.type === 'CATEGORY') return value.category;
  if (value.type === 'STRING') return value.string;
  if (value.type === 'DECIMAL') return value.decimal;
  return null;
}

export function evaluateCornSeedingRateRange({ inputEntries }) {
  const crop = String(readValue(inputEntries, 'crop.code') ?? '').trim().toLowerCase();
  const hybrid = String(readValue(inputEntries, 'planting.hybrid') ?? '').trim().toUpperCase();

  if (crop !== 'corn' || hybrid !== '43-96P') {
    return {
      contractVersion: 'adr.policy-action-output.v1',
      actionCode: 'ABSTAIN',
      parameters: []
    };
  }

  return {
    contractVersion: 'adr.policy-action-output.v1',
    actionCode: 'SET_CORN_SEEDING_RATE_RANGE',
    parameters: [
      { name: 'minimum_population', value: { type: 'DECIMAL', decimal: '28000' } },
      { name: 'maximum_population', value: { type: 'DECIMAL', decimal: '36000' } }
    ]
  };
}
