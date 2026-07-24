import { z } from 'zod';

/**
 * Shared validation schemas. These live in their own package so the API layer
 * and web app validate against the same rules. Add new schemas here as your
 * app grows.
 */

/** Payload for updating the signed-in user's profile. */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(80, 'Name is too long'),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const preferenceList = z.array(z.string().trim().min(1).max(80)).max(30);

export const updateJobPreferencesSchema = z.object({
  workArrangements: z.array(z.enum(['REMOTE', 'HYBRID', 'ONSITE'])).max(3),
  preferredLocations: preferenceList,
  roleFamilies: z
    .array(z.enum(['FRONTEND', 'FULL_STACK', 'PRODUCT_ENGINEERING', 'BACKEND', 'MOBILE', 'DESIGN']))
    .max(6),
  includedTitleTerms: preferenceList,
  excludedTitleTerms: preferenceList,
  seniorityLevels: z
    .array(z.enum(['MID', 'SENIOR', 'STAFF', 'PRINCIPAL', 'LEAD', 'MANAGER']))
    .max(6),
});
export type UpdateJobPreferencesInput = z.infer<typeof updateJobPreferencesSchema>;

/** Payload for permanently deleting the signed-in user's account. */
export const deleteAccountSchema = z.object({
  // Must match the account email exactly (checked case-insensitively on the
  // server). Acts as a typed confirmation guard against accidental deletes.
  confirmEmail: z.string().trim().min(1, 'Please type your email to confirm'),
});
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
