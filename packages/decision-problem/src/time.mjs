const RFC3339_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

function daysInMonth(year, month) {
  if ([1, 3, 5, 7, 8, 10, 12].includes(month)) return 31;
  if ([4, 6, 9, 11].includes(month)) return 30;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return leap ? 29 : 28;
}

export function normalizeDecisionTimestamp(rawValue, name, ErrorType) {
  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    throw new ErrorType('INVALID_DECISION_PROBLEM_INPUT', `${name} must be a non-empty string`);
  }
  const raw = rawValue.trim();
  const match = RFC3339_RE.exec(raw);
  if (!match) {
    throw new ErrorType(
      'INVALID_DECISION_PROBLEM_TIME',
      `${name} must be explicit RFC3339 with timezone and <= millisecond precision`
    );
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12
    || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) {
    throw new ErrorType(
      'INVALID_DECISION_PROBLEM_TIME',
      `${name} contains an impossible calendar date or clock time`
    );
  }
  if (zone !== 'Z') {
    const offsetHour = Number(zone.slice(1, 3));
    const offsetMinute = Number(zone.slice(4, 6));
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      throw new ErrorType('INVALID_DECISION_PROBLEM_TIME', `${name} contains an invalid timezone offset`);
    }
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new ErrorType('INVALID_DECISION_PROBLEM_TIME', `${name} must be a valid RFC3339 timestamp`);
  }
  return parsed.toISOString();
}
