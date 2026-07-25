import assert from "node:assert/strict";

import { evaluateStudentMigrationRow } from "./lib/student-migration-policy.mjs";

const context = () => ({ seenNis: new Set(), seenNisn: new Set() });

{
  const result = evaluateStudentMigrationRow(
    { name: "Siswa Tanpa Identifier", nis: "", nisn: "", gender: "P" },
    context(),
  );
  assert.equal(result.valid, true);
  assert.equal(result.missingNis, true);
  assert.equal(result.missingNisn, true);
}

{
  const result = evaluateStudentMigrationRow(
    { name: "", nis: "", nisn: "", gender: "L" },
    context(),
  );
  assert.equal(result.valid, false);
  assert.equal(result.missingName, true);
}

{
  const result = evaluateStudentMigrationRow(
    { name: "Gender Salah", nis: "", nisn: "", gender: "X" },
    context(),
  );
  assert.equal(result.valid, false);
  assert.equal(result.invalidGender, true);
}

{
  const state = context();
  assert.equal(
    evaluateStudentMigrationRow(
      { name: "Pertama", nis: "100", nisn: "0000000100", gender: "L" },
      state,
    ).valid,
    true,
  );
  const duplicate = evaluateStudentMigrationRow(
    { name: "Kedua", nis: "100", nisn: "0000000100", gender: "P" },
    state,
  );
  assert.equal(duplicate.valid, false);
  assert.equal(duplicate.duplicateNis, true);
  assert.equal(duplicate.duplicateNisn, true);
}

{
  const state = context();
  assert.equal(
    evaluateStudentMigrationRow({ name: "Kosong Satu", nis: "", nisn: "", gender: "L" }, state)
      .valid,
    true,
  );
  assert.equal(
    evaluateStudentMigrationRow({ name: "Kosong Dua", nis: "", nisn: "", gender: "P" }, state)
      .valid,
    true,
  );
}

console.log("Kebijakan migrasi lulus: NIS/NISN opsional, identifier non-kosong tetap unik.");
