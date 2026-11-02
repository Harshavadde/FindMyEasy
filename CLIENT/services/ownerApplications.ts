import { ApiError, postJson } from "../constants/api";
import { normalizeIndianPhoneNumber } from "./auth";

export type OwnerRelationship =
  | "PROPERTY_OWNER"
  | "PROPERTY_MANAGER"
  | "AUTHORIZED_REPRESENTATIVE";

export type OwnerApplicationInput = {
  applicant_name: string;
  applicant_phone: string;
  applicant_email?: string;
  relationship_type: OwnerRelationship;
  pg_name: string;
  city: string;
  area: string;
  address: string;
  formatted_address?: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
  google_maps_url?: string;
  declaration_accepted: true;
};

export type OwnerApplicationResult = {
  application_reference: string;
  status: "SUBMITTED";
  submitted_at: string;
  status_access_key: string;
  phone_verification_required: boolean;
};

export type OwnerApplicationStatus = {
  application_reference: string;
  status:
    | "SUBMITTED"
    | "UNDER_REVIEW"
    | "ADDITIONAL_INFORMATION_REQUIRED"
    | "APPROVED"
    | "REJECTED";
  submitted_at: string;
  message: string;
};

export function getOwnerApplicationSubmitError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Unable to submit your application. Please try again.";
  }

  if (__DEV__) {
    console.warn("Owner application request failed", {
      requestUrl: error.requestUrl,
      status: error.status,
      backendDetail: error.message,
    });
  }

  if (error.kind === "network") {
    return "Cannot connect to the FindEasy server. Check your internet connection and try again.";
  }
  if (error.kind === "timeout") {
    return "The FindEasy server did not respond in time. Please try again.";
  }
  if (error.status === 404) {
    return "The configured FindEasy server does not have the partnership submission endpoint yet. The backend deployment must be updated.";
  }
  if (error.status === 422) {
    return `Please check the application details: ${error.message}`;
  }
  if (error.status === 409) {
    return error.message;
  }
  if (error.status && error.status >= 500) {
    return "The server could not save your application. The owner_applications database migration must be applied before submissions can be stored.";
  }
  if (error.status) {
    return `Submission failed (HTTP ${error.status}). ${error.message}`;
  }
  return "Unable to submit your application. Please try again.";
}

export async function submitOwnerApplication(
  input: OwnerApplicationInput
): Promise<OwnerApplicationResult> {
  return postJson<OwnerApplicationResult>("/api/v1/owner-applications", {
    ...input,
    applicant_phone: normalizeIndianPhoneNumber(input.applicant_phone),
  });
}

export async function getOwnerApplicationStatus(
  applicationReference: string,
  statusAccessKey: string
): Promise<OwnerApplicationStatus> {
  return postJson<OwnerApplicationStatus>(
    `/api/v1/owner-applications/${encodeURIComponent(applicationReference)}/status`,
    { status_access_key: statusAccessKey }
  );
}
