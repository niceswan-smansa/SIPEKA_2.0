import type { AuthenticationGateway } from "../domain/authentication";

export async function logoutUser(gateway: AuthenticationGateway) {
  await gateway.signOut();
}
