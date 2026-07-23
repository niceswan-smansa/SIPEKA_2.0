export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function passwordPolicyReasons(password) {
  const reasons = [];
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH)
    reasons.push("LENGTH");
  if (!/[a-z]/.test(password)) reasons.push("LOWERCASE");
  if (!/[A-Z]/.test(password)) reasons.push("UPPERCASE");
  if (!/[0-9]/.test(password)) reasons.push("NUMBER");
  if (!/[!-/:-@[-`{-~]/.test(password)) reasons.push("SYMBOL");
  return reasons;
}

export function assertPasswordPolicy(password) {
  if (passwordPolicyReasons(password).length)
    throw new Error("Password tidak memenuhi kebijakan aplikasi.");
}
