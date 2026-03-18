type ParseDateInput = (value: string, fieldName: string) => Date;

const parseDateInput: ParseDateInput = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date for ${fieldName}: "${value}". Expected ISO 8601 format (e.g., 2026-03-18T10:00:00Z).`);
  }
  return date;
};

export { parseDateInput };
