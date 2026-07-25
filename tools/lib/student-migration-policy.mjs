export function evaluateStudentMigrationRow({ name, nis, nisn, gender }, { seenNis, seenNisn }) {
  const normalizedName = String(name ?? "").trim();
  const normalizedNis = String(nis ?? "").trim();
  const normalizedNisn = String(nisn ?? "").trim();
  const normalizedGender = String(gender ?? "")
    .trim()
    .toUpperCase();

  const duplicateNis = Boolean(normalizedNis && seenNis.has(normalizedNis));
  const duplicateNisn = Boolean(normalizedNisn && seenNisn.has(normalizedNisn));

  if (normalizedNis) seenNis.add(normalizedNis);
  if (normalizedNisn) seenNisn.add(normalizedNisn);

  const missingName = !normalizedName;
  const missingNis = !normalizedNis;
  const missingNisn = !normalizedNisn;
  const invalidGender = !["L", "P"].includes(normalizedGender);

  return {
    missingName,
    missingNis,
    missingNisn,
    invalidGender,
    duplicateNis,
    duplicateNisn,
    valid: !missingName && !invalidGender && !duplicateNis && !duplicateNisn,
  };
}
