import { dashboardDateSchema, type DashboardRepository } from "../domain/dashboard";

export function createDashboardService(repository: DashboardRepository) {
  return {
    get(selectedDate: string) {
      return repository.get(dashboardDateSchema.parse(selectedDate));
    },
  };
}
