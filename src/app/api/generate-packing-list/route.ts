/**
 * POST /api/generate-packing-list
 * Alias for POST /api/packing/generate — same Bearer JWT auth and body.
 *
 * Authorization: Bearer <Supabase user access token>
 * Body: { "tripId": "<uuid>" }
 */
export { POST } from "../packing/generate/route";
