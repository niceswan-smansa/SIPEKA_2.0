import "server-only";

import { createSupabaseStudentRepository } from "@/modules/students";

export const createStudentSearchRepository = createSupabaseStudentRepository;
