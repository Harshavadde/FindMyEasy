import { postJson } from "../constants/api";

export type OwnerInvitationValidation = {
  valid: boolean;
  status:
    | "VALID"
    | "INVALID"
    | "APPLICATION_NOT_APPROVED"
    | "EXPIRED"
    | "REVOKED"
    | "USED"
    | "PHONE_MISMATCH"
    | "EMAIL_MISSING";
  message: string;
  expires_at: string | null;
  applicant_name: string | null;
  applicant_phone: string | null;
  applicant_email: string | null;
  pg_name: string | null;
  city: string | null;
  area: string | null;
};

export type OwnerRegistrationResult = {
  success: boolean;
  full_name: string;
  phone_number: string;
  registered_at: string;
};

export function validateOwnerInvitation(
  token: string
): Promise<OwnerInvitationValidation> {
  return postJson<OwnerInvitationValidation>(
    "/api/v1/owner-invitations/validate",
    { token }
  );
}

export function registerOwnerAccount(input: {
  token: string;
  password: string;
  terms_accepted: true;
}): Promise<OwnerRegistrationResult> {
  return postJson<OwnerRegistrationResult>(
    "/api/v1/owner-invitations/register",
    input
  );
}
