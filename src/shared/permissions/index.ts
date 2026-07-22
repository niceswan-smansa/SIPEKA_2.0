export const APP_ROLES = ["SUPER_ADMIN", "ADMIN", "USER"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export type AccountProfile = {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  mustChangePassword: boolean;
};
