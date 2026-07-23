export const OPERATIONAL_GRADES = ["X", "XI", "XII"] as const;
export type OperationalGrade = (typeof OPERATIONAL_GRADES)[number];
export const ALL_GRADES = [...OPERATIONAL_GRADES, "ALUMNI"] as const;
export type Grade = (typeof ALL_GRADES)[number];
