export class RightsEnforcementError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RightsEnforcementError';
    this.code = code;
  }
}
