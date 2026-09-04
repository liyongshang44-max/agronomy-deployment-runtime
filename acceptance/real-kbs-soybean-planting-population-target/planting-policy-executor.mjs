export function evaluatePlantingPopulation(request) {
  const bySemantic = Object.fromEntries(
    request.inputEntries.map((entry) => [entry.semanticId, entry.payload])
  );
  const crop = bySemantic['crop.code']?.value?.category;
  const region = bySemantic['jurisdiction.region']?.value?.category;
  const rowSpacing = bySemantic['planting.row_spacing_in'];
  if (
    crop !== 'soybean'
    || region !== 'michigan'
    || rowSpacing?.unit !== 'inch'
    || rowSpacing?.value?.type !== 'DECIMAL'
    || rowSpacing.value.decimal !== '15'
  ) {
    return {
      contractVersion: 'adr.policy-action-output.v1',
      actionCode: 'ABSTAIN',
      parameters: []
    };
  }
  return {
    contractVersion: 'adr.policy-action-output.v1',
    actionCode: 'SET_SOYBEAN_SEEDING_RATE',
    parameters: [
      {
        name: 'population',
        value: { type: 'DECIMAL', decimal: '150000' }
      }
    ]
  };
}
