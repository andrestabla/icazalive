export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_MAX_AGE_DAYS = 180;
export const PASSWORD_WARNING_DAYS = 15;

export const PASSWORD_POLICY_MESSAGE = `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres e incluir mayúscula, minúscula, número y símbolo.`;

export function isValidPassword(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    value.length < PASSWORD_MIN_LENGTH ||
    value.length > PASSWORD_MAX_LENGTH
  ) {
    return false;
  }
  return (
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

export type PasswordAgeStatus = {
  expiresAt: Date;
  daysUntilExpiry: number;
  expired: boolean;
  expiresSoon: boolean;
};

export function getPasswordAgeStatus(
  passwordChangedAt: Date | null,
  fallback: Date,
): PasswordAgeStatus {
  const reference = passwordChangedAt ?? fallback;
  const expiresAt = new Date(
    reference.getTime() + PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  const daysUntilExpiry = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
  );
  return {
    expiresAt,
    daysUntilExpiry,
    expired: daysUntilExpiry <= 0,
    expiresSoon: daysUntilExpiry > 0 && daysUntilExpiry <= PASSWORD_WARNING_DAYS,
  };
}
