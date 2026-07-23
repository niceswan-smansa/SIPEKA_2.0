export const OPERATIONAL_GRADES = ["X", "XI", "XII"] as const;
export type OperationalGrade = (typeof OPERATIONAL_GRADES)[number];
