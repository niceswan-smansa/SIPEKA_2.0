export {
  decideAccess,
  defaultPathForRole,
  sanitizeRedirect,
  type AccessContext,
  type AccessDecision,
  type AccessKind,
} from "./domain/access";
export { authorizeRequest, requirePageAccess } from "./presentation/server-guards";
