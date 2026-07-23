import { loadAdminConfiguration } from "./lib/supabase-admin.mjs";

const { client } = loadAdminConfiguration({ allowRemote: false });
const { data, error } = await client
  .from("audit_logs")
  .select("before_data,after_data")
  .eq("scope", "OPERATIONAL")
  .in("entity_type", ["student", "students"]);
if (error) throw new Error("Audit dry-run tidak dapat diselesaikan.");
const keys = new Set(["nis", "nisn", "full_name", "normalized_name"]);
const hasSensitiveKey = (value) =>
  value && typeof value === "object" && Object.keys(value).some((key) => keys.has(key));
const count = (data ?? []).filter(
  (row) => hasSensitiveKey(row.before_data) || hasSensitiveKey(row.after_data),
).length;
console.log(`Audit student dry-run: ${count} row memiliki key sensitif lama.`);
