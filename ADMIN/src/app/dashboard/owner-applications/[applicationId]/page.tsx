"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  AdminConsoleShell,
  useAdminConsole,
} from "@/components/AdminConsoleShell";
import {
  approveAdminOwnerApplication,
  ApiError,
  createAdminOwnerInvitation,
  getAdminOwnerApplication,
  getAdminOwnerInvitations,
  rejectAdminOwnerApplication,
  requestAdminOwnerApplicationInformation,
  revokeAdminOwnerInvitation,
  type AdminOwnerApplicationDetail,
  type AdminOwnerInvitation,
  type OwnerApplicationRelationship,
  type OwnerApplicationStatus,
} from "@/services/api";

type ReviewAction =
  | "approve"
  | "reject"
  | "request-information"
  | "generate-invitation"
  | "revoke-invitation";

const STATUS_LABELS: Record<OwnerApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  ADDITIONAL_INFORMATION_REQUIRED: "Additional information required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  INVITATION_SENT: "Invitation sent",
  INVITATION_ACCEPTED: "Owner registered",
  EXPIRED: "Expired",
};

const RELATIONSHIP_LABELS: Record<OwnerApplicationRelationship, string> = {
  PROPERTY_OWNER: "Property owner",
  PROPERTY_MANAGER: "Property manager",
  AUTHORIZED_REPRESENTATIVE: "Authorized representative",
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : parsed.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-line py-3 last:border-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function ApplicationDetailContent() {
  const { token, signOut } = useAdminConsole();
  const params = useParams<{ applicationId: string }>();
  const applicationId = params.applicationId;
  const [application, setApplication] =
    useState<AdminOwnerApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialogAction, setDialogAction] = useState<ReviewAction | null>(null);
  const [selectedInvitationId, setSelectedInvitationId] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const actionInProgress = useRef(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [informationMessage, setInformationMessage] = useState("");
  const [invitations, setInvitations] = useState<AdminOwnerInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationLink, setInvitationLink] = useState("");
  const [copyError, setCopyError] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      signOut();
      return;
    }
    setLoading(true);
    setError("");
    try {
      setApplication(await getAdminOwnerApplication(token, applicationId));
    } catch (loadError) {
      setApplication(null);
      if (
        loadError instanceof ApiError &&
        [401, 403].includes(loadError.status)
      ) {
        signOut();
        return;
      }
      setError(
        loadError instanceof ApiError && loadError.status === 404
          ? "This Owner application could not be found."
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load application details."
      );
    } finally {
      setLoading(false);
    }
  }, [applicationId, signOut, token]);

  const loadInvitations = useCallback(async () => {
    if (!token) return;
    setInvitationsLoading(true);
    try {
      const result = await getAdminOwnerInvitations(token, applicationId);
      setInvitations(result.items);
      setActionError("");
    } catch (loadError) {
      setInvitations([]);
      if (
        loadError instanceof ApiError &&
        [401, 403].includes(loadError.status)
      ) {
        signOut();
        return;
      }
      setActionError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load invitation records."
      );
    } finally {
      setInvitationsLoading(false);
    }
  }, [applicationId, signOut, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (application) {
      void loadInvitations();
    }
  }, [application?.id, loadInvitations]);

  useEffect(() => {
    if (
      !application ||
      application.registration_completed_at ||
      !["APPROVED", "INVITATION_SENT"].includes(application.status)
    ) {
      return;
    }

    const refreshTimer = window.setInterval(() => {
      void load();
      void loadInvitations();
    }, 15000);
    return () => window.clearInterval(refreshTimer);
  }, [application, load, loadInvitations]);

  async function confirmAction() {
    if (actionInProgress.current || !dialogAction) return;
    if (!token || !application) {
      setActionError(
        "Your Admin session or application details are unavailable. Reload the page and try again."
      );
      return;
    }
    actionInProgress.current = true;
    setActionBusy(true);
    setActionError("");
    setNotice("");
    try {
      if (dialogAction === "approve") {
        await approveAdminOwnerApplication(token, application.id);
        setNotice("Application approved. No Owner account was created.");
      } else if (dialogAction === "reject") {
        await rejectAdminOwnerApplication(token, application.id, {
          reason: rejectionReason,
          internal_note: internalNote || undefined,
        });
        setNotice("Application rejected. The decision was recorded.");
      } else if (dialogAction === "request-information") {
        await requestAdminOwnerApplicationInformation(
          token,
          application.id,
          informationMessage
        );
        setNotice(
          "The information request was recorded. No applicant notification is configured."
        );
      } else if (dialogAction === "generate-invitation") {
        const result = await createAdminOwnerInvitation(token, application.id);
        setInvitationLink(result.invitation_url);
        setNotice(
          result.delivery_status === "DELIVERED"
            ? `Delivery status: delivered. Registration invitation emailed to ${application.applicant_email}.`
            : result.delivery_status === "FAILED"
              ? "Delivery status: failed. The invitation was created, but email delivery failed. Check the email configuration, revoke this invitation, then generate a replacement."
              : `Delivery status: ${result.delivery_status.toLowerCase()}. The invitation was created and is awaiting email delivery.`
        );
      } else if (dialogAction === "revoke-invitation") {
        const revoked = await revokeAdminOwnerInvitation(
          token,
          selectedInvitationId
        );
        setInvitationLink("");
        setNotice("Invitation revoked.");
      }
      setDialogAction(null);
      setRejectionReason("");
      setInternalNote("");
      setInformationMessage("");
      await Promise.all([load(), loadInvitations()]);
    } catch (actionFailure) {
      if (
        actionFailure instanceof ApiError &&
        [401, 403].includes(actionFailure.status)
      ) {
        signOut();
        return;
      }
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : "The requested action could not be completed."
      );
    } finally {
      actionInProgress.current = false;
      setActionBusy(false);
    }
  }

  async function copyInvitationLink() {
    if (!invitationLink) return;
    setCopyError("");
    try {
      await navigator.clipboard.writeText(invitationLink);
      setNotice("Invitation link copied. Share it with the applicant securely.");
    } catch {
      setCopyError(
        "Clipboard access is unavailable. Select and copy the link below."
      );
    }
  }

  const mapsUrl = useMemo(() => {
    if (!application) return "";
    return (
      application.google_maps_url ||
      `https://www.google.com/maps/search/?api=1&query=${application.latitude},${application.longitude}`
    );
  }, [application]);

  return (
    <>
      <div className="mb-5">
        <Link
          className="text-sm font-bold text-brand hover:underline"
          href="/dashboard/owner-applications"
        >
          ← All applications
        </Link>
      </div>

      {error && (
        <div
          aria-live="polite"
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <span>{error}</span>
          <button
            className="font-bold"
            onClick={() => void load()}
            type="button"
          >
            Retry
          </button>
        </div>
      )}
      {actionError && (
        <div
          aria-live="polite"
          className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {actionError}
        </div>
      )}
      {notice && (
        <div
          aria-live="polite"
          className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          role="status"
        >
          {notice}
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-label="Loading application details">
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
          <div className="h-80 animate-pulse rounded-2xl bg-white" />
        </div>
      ) : application ? (
        <>
          <section className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-white p-5 shadow-card sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Application reference
              </p>
              <h1 className="mt-1 text-2xl font-extrabold text-ink">
                {application.application_reference}
              </h1>
              <p className="mt-2 text-sm text-muted">
                Submitted {formatDate(application.submitted_at)}
              </p>
            </div>
            <span className="inline-flex self-start rounded-full bg-blue-50 px-4 py-2 text-sm font-extrabold text-blue-700 sm:self-auto">
              {STATUS_LABELS[application.status]}
            </span>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-extrabold text-ink">
                Applicant information
              </h2>
              <div className="mt-3">
                <DetailField label="Full name" value={application.applicant_name} />
                <DetailField label="Mobile number" value={application.applicant_phone} />
                <DetailField
                  label="Email address"
                  value={application.applicant_email || "Not provided"}
                />
                <DetailField
                  label="Relationship with PG"
                  value={RELATIONSHIP_LABELS[application.relationship_type]}
                />
                <DetailField
                  label="Phone verification"
                  value={application.phone_verified ? "Verified" : "Not verified"}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-extrabold text-ink">PG information</h2>
              <div className="mt-3">
                <DetailField label="PG / property name" value={application.pg_name} />
                <DetailField label="City" value={application.city} />
                <DetailField label="Area / locality" value={application.area} />
                <DetailField label="Complete address" value={application.address} />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-extrabold text-ink">
                Location information
              </h2>
              <div className="mt-3">
                <DetailField
                  label="Coordinates"
                  value={`${application.latitude}, ${application.longitude}`}
                />
                <DetailField
                  label="Formatted address"
                  value={application.formatted_address || "Not available"}
                />
                <DetailField
                  label="Google Place ID"
                  value={application.google_place_id || "Not available"}
                />
                <DetailField
                  label="Google Maps URL"
                  value={application.google_maps_url || "Generated from coordinates"}
                />
              </div>
              <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-muted">
                An embedded map preview is not configured in this Admin
                application. Use the link to inspect the submitted pin in
                Google Maps.
              </p>
              <a
                className="mt-4 inline-flex rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-blue-700"
                href={mapsUrl}
                rel="noreferrer"
                target="_blank"
              >
                Open location in Google Maps
              </a>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-extrabold text-ink">
                Owner account activation
              </h2>
              <div className="mt-3">
                <DetailField
                  label="Registration status"
                  value={
                    application.registration_completed_at
                      ? "Completed"
                      : "Not completed"
                  }
                />
                <DetailField
                  label="Invitation status"
                  value={invitations[0]?.status || "Not created"}
                />
                <DetailField
                  label="Account created"
                  value={formatDate(application.owner_account_created_at)}
                />
                <DetailField
                  label="Registration completed"
                  value={formatDate(application.registration_completed_at)}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-extrabold text-ink">
                Application history
              </h2>
              <div className="mt-3">
                <DetailField
                  label="Current status"
                  value={STATUS_LABELS[application.status]}
                />
                <DetailField
                  label="Last updated"
                  value={
                    application.last_updated_at
                      ? formatDate(application.last_updated_at)
                      : "Not tracked by the current application schema"
                  }
                />
              </div>
              {application.history_available &&
              application.status_history.length > 0 ? (
                <ol className="mt-3 space-y-3">
                  {application.status_history.map((item, index) => (
                    <li
                      className="rounded-xl bg-slate-50 p-3"
                      key={`${item.changed_at}-${index}`}
                    >
                      <p className="text-sm font-bold text-ink">
                        {item.action.replaceAll("_", " ")} —{" "}
                        {STATUS_LABELS[item.status as OwnerApplicationStatus] ??
                          item.status}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatDate(item.changed_at)}
                      </p>
                      {item.message && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-ink">
                          {item.message}
                        </p>
                      )}
                      {item.internal_note && (
                        <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 p-2 text-sm text-amber-900">
                          Admin note: {item.internal_note}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-muted">
                  No review actions have been recorded for this application.
                </p>
              )}
            </section>
          </div>

          {(application.status === "SUBMITTED" ||
            application.status === "UNDER_REVIEW") && (
            <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-extrabold text-ink">
                Application review actions
              </h2>
              <p className="mt-1 text-sm text-muted">
                Decisions are recorded with your Admin account. Approval does
                not create an Owner account.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={
                    actionBusy ||
                    !["SUBMITTED", "UNDER_REVIEW"].includes(application.status)
                  }
                  onClick={() => setDialogAction("approve")}
                  type="button"
                >
                  Approve application
                </button>
                <button
                  className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  disabled={
                    actionBusy ||
                    !["SUBMITTED", "UNDER_REVIEW"].includes(application.status)
                  }
                  onClick={() => setDialogAction("reject")}
                  type="button"
                >
                  Reject application
                </button>
                <button
                  className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink hover:bg-slate-50 disabled:opacity-60"
                  disabled={
                    actionBusy ||
                    !["SUBMITTED", "UNDER_REVIEW"].includes(application.status)
                  }
                  onClick={() => setDialogAction("request-information")}
                  type="button"
                >
                  Request additional information
                </button>
              </div>
            </section>
          )}

          {(application.status === "APPROVED" || invitations.length > 0) && (
            <section className="mt-5 rounded-2xl border border-line bg-white p-5 shadow-card">
              <h2 className="text-lg font-extrabold text-ink">
                Owner registration invitation
              </h2>
              <p className="mt-1 text-sm text-muted">
                Approved applicants receive a single-use registration link at
                their registered email address. Email delivery status is shown
                for each invitation.
              </p>
              {application.status !== "APPROVED" && invitations.length > 0 && (
                <p
                  className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900"
                  role="alert"
                >
                  This application is not currently approved but has invitation
                  records. The backend will not validate those invitations;
                  review and revoke any active one.
                </p>
              )}
              <p className="mt-2 text-sm text-muted">
                The generated link is shown only once and stays in this page
                until you leave. If delivery fails or the link is lost, revoke
                the invitation and generate a replacement.
              </p>
              {!application.applicant_email && (
                <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  No email address is recorded for this applicant. Update it
                  through the approved support process before creating an
                  invitation.
                </p>
              )}

              {invitationLink && (
                <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <label
                    className="text-xs font-bold uppercase tracking-wide text-blue-800"
                    htmlFor="owner-invitation-link"
                  >
                    Copy invitation link
                  </label>
                  <textarea
                    className="mt-2 min-h-20 w-full resize-y rounded-lg border border-blue-200 bg-white p-3 text-sm text-ink"
                    id="owner-invitation-link"
                    readOnly
                    value={invitationLink}
                  />
                  <button
                    className="mt-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                    onClick={() => void copyInvitationLink()}
                    type="button"
                  >
                    Copy link
                  </button>
                  {copyError && (
                    <p className="mt-2 text-sm text-red-700" role="alert">
                      {copyError}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 space-y-3">
                {invitationsLoading ? (
                  <p className="text-sm text-muted">Loading invitations…</p>
                ) : invitations.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-muted">
                    No invitation has been created.
                  </p>
                ) : (
                  invitations.map((invitation) => (
                    <div
                      className="flex flex-col justify-between gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center"
                      key={invitation.id}
                    >
                      <div>
                        <p className="text-sm font-bold text-ink">
                          {invitation.status} · expires{" "}
                          {formatDate(invitation.expires_at)}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Created {formatDate(invitation.created_at)} · To{" "}
                          {application.applicant_email || "email unavailable"} ·
                          {" "}Delivery:{" "}
                          {invitation.delivery_status === "DELIVERED"
                            ? "Email sent"
                            : invitation.delivery_status === "FAILED"
                              ? "Email failed"
                              : invitation.delivery_status === "PENDING"
                                ? "Email pending"
                                : "Not configured"}
                        </p>
                      </div>
                      {invitation.status === "ACTIVE" && (
                        <button
                          className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50"
                          disabled={actionBusy}
                          onClick={() => {
                            setSelectedInvitationId(invitation.id);
                            setDialogAction("revoke-invitation");
                          }}
                          type="button"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
              {application.status === "APPROVED" &&
                !invitations.some((item) => item.status === "ACTIVE") && (
                  <button
                    className="mt-4 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                    disabled={
                      actionBusy ||
                      invitationsLoading ||
                      !application.applicant_email
                    }
                    onClick={() => setDialogAction("generate-invitation")}
                    type="button"
                  >
                    Generate Owner invitation
                  </button>
                )}
            </section>
          )}
        </>
      ) : !error ? (
        <div className="rounded-2xl border border-line bg-white px-5 py-14 text-center">
          <p className="font-extrabold text-ink">Application unavailable</p>
          <p className="mt-2 text-sm text-muted">
            The requested application could not be loaded.
          </p>
        </div>
      ) : null}

      {dialogAction && application && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !actionBusy) {
              setDialogAction(null);
            }
          }}
        >
          <section
            aria-labelledby="review-dialog-title"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
            role="dialog"
          >
            <h2
              className="text-xl font-extrabold text-ink"
              id="review-dialog-title"
            >
              {dialogAction === "approve"
                ? "Approve application?"
                : dialogAction === "reject"
                  ? "Reject application?"
                  : dialogAction === "request-information"
                    ? "Request additional information?"
                    : dialogAction === "generate-invitation"
                      ? "Generate Owner invitation?"
                      : "Revoke this invitation?"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {application.applicant_name} · {application.application_reference}
              <br />
              {application.pg_name} · {application.applicant_phone}
            </p>
            {dialogAction === "approve" && (
              <p className="mt-3 text-sm leading-6 text-ink">
                Approval makes the applicant eligible for a secure invitation.
                It does not create an Owner account.
              </p>
            )}
            {dialogAction === "reject" && (
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-bold text-ink" htmlFor="rejection-reason">
                  Rejection reason (required)
                </label>
                <textarea
                  className="min-h-24 w-full rounded-xl border border-line p-3 text-sm"
                  id="rejection-reason"
                  maxLength={2000}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  value={rejectionReason}
                />
                <label className="block text-sm font-bold text-ink" htmlFor="internal-note">
                  Internal Admin note (optional)
                </label>
                <textarea
                  className="min-h-20 w-full rounded-xl border border-line p-3 text-sm"
                  id="internal-note"
                  maxLength={5000}
                  onChange={(event) => setInternalNote(event.target.value)}
                  value={internalNote}
                />
              </div>
            )}
            {dialogAction === "request-information" && (
              <div className="mt-4">
                <label
                  className="block text-sm font-bold text-ink"
                  htmlFor="information-request"
                >
                  Message describing the missing information (required)
                </label>
                <textarea
                  className="mt-2 min-h-28 w-full rounded-xl border border-line p-3 text-sm"
                  id="information-request"
                  maxLength={2000}
                  onChange={(event) => setInformationMessage(event.target.value)}
                  value={informationMessage}
                />
              </div>
            )}
            {dialogAction === "generate-invitation" && (
              <p className="mt-3 text-sm leading-6 text-ink">
                This creates a link reserved for single-use registration that
              expires after the configured period and emails it to{" "}
              {application.applicant_email || "the applicant's registered email"}.
              If sending fails, the invitation remains unusable until you
              revoke it and create a replacement after correcting email
              configuration.
            </p>
            )}
            {dialogAction === "revoke-invitation" && (
              <p className="mt-3 text-sm leading-6 text-ink">
                The invitation will stop being usable immediately. This cannot
                be undone.
              </p>
            )}
            {actionError && (
              <p
                aria-live="polite"
                className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
              >
                {actionError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold text-ink"
                disabled={actionBusy}
                onClick={() => setDialogAction(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                disabled={
                  actionBusy ||
                  (dialogAction === "reject" && !rejectionReason.trim()) ||
                  (dialogAction === "request-information" &&
                    !informationMessage.trim())
                }
                onClick={() => void confirmAction()}
                type="button"
              >
                {actionBusy ? "Working…" : "Confirm"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default function OwnerApplicationDetailPage() {
  return (
    <AdminConsoleShell
      activeSection="owner-applications"
      title="Application Details"
    >
      <ApplicationDetailContent />
    </AdminConsoleShell>
  );
}
