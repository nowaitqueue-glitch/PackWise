/** Same success for registered and unregistered emails — do not vary this. */
export const ADD_MEMBER_BY_EMAIL_SUCCESS =
  "If that email has a PackWise account, they've been added to this trip.";

export type CreateInviteResult =
  | { ok: true; token: string; path: string }
  | { ok: false; error: string };

export type AddMemberByEmailResult =
  | { ok: true; message: string }
  | { ok: false; error: string };
