/**
 * Organization and mentor onboarding (SCRUM-17): option codes, the form schema and data access.
 * Codes come from the interest form's shared list and match the CHECK constraints in
 * supabase/migrations/20261127100000_partner_onboarding.sql (partner.test.ts compares them). The
 * completion trigger there is the authority; this schema only mirrors it for good messages.
 */
import { INTEREST_OPTIONS } from '@shared/interest-options';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownProfileKey, type OwnProfile } from '@/features/auth/profile-api';
import { supabase } from '@/lib/supabase';
import { z } from '@/lib/zod-i18n';
import { normalizeSaudiMobile } from './options';

export type PartnerRole = 'organization' | 'mentor';

export const ORG_SECTORS = INTEREST_OPTIONS.sector;
export const ORG_SIZES = INTEREST_OPTIONS.org_size;
export const SUPPORT_TYPES = INTEREST_OPTIONS.looking_for;
export const EXPERTISE = INTEREST_OPTIONS.expertise;

export const PARTNER_LIMITS = {
  fullName: { min: 1, max: 120 },
  organizationName: { min: 2, max: 150 },
  description: { min: 30, max: 2000 },
  jobTitle: { min: 1, max: 120 },
  company: { min: 1, max: 150 },
  years: { min: 0, max: 60 },
} as const;

/** The CHECKs on organization_profiles.website and contact_details.linkedin_url. */
export const WEBSITE_PATTERN =
  /^https:\/\/([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(\/\S*)?$/;
export const LINKEDIN_PATTERN =
  /^https:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9_%-]{1,100}\/?$/;

/** "example.com" or "www.linkedin.com/in/x" get https:// added; anything else is kept as typed. */
export function withHttps(raw: string): string {
  const value = raw.trim();
  if (value === '' || /^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

export interface PartnerValues {
  fullName: string;
  phone: string;
  sharePhone: boolean;
  linkedinUrl: string;
  shareLinkedin: boolean;
  // Organization
  organizationName: string;
  sector: string;
  orgSize: string;
  supportTypes: string[];
  website: string;
  // Mentor
  jobTitle: string;
  company: string;
  yearsOfExperience: string;
  expertise: string[];
  // Organization description or mentor professional summary.
  description: string;
}

const L = PARTNER_LIMITS;
const optionalUrl = (pattern: RegExp, message: string) =>
  z
    .string()
    .transform(withHttps)
    .refine((value) => value === '' || pattern.test(value), { message });

const common = {
  fullName: z.string().trim().min(L.fullName.min).max(L.fullName.max),
  phone: z
    .string()
    .trim()
    .min(1)
    .refine((value) => normalizeSaudiMobile(value) !== null, { message: 'validation.saudiMobile' }),
  sharePhone: z.boolean(),
  linkedinUrl: optionalUrl(LINKEDIN_PATTERN, 'validation.linkedinUrl'),
  shareLinkedin: z.boolean(),
  description: z.string().trim().min(L.description.min).max(L.description.max),
};

export const partnerSchemas = {
  organization: z.object({
    ...common,
    organizationName: z.string().trim().min(L.organizationName.min).max(L.organizationName.max),
    sector: z.enum(ORG_SECTORS),
    orgSize: z.union([z.enum(ORG_SIZES), z.literal('')]),
    supportTypes: z.array(z.enum(SUPPORT_TYPES)).min(1, { message: 'validation.chooseOne' }),
    website: optionalUrl(WEBSITE_PATTERN, 'validation.demoUrl'),
  }),
  mentor: z.object({
    ...common,
    jobTitle: z.string().trim().min(L.jobTitle.min).max(L.jobTitle.max),
    company: z.string().trim().min(L.company.min).max(L.company.max),
    yearsOfExperience: z
      .string()
      .trim()
      .regex(/^\d{1,2}$/, { message: 'validation.yearsOfExperience' })
      .refine((value) => Number(value) <= L.years.max, { message: 'validation.yearsOfExperience' }),
    expertise: z.array(z.enum(EXPERTISE)).min(1, { message: 'validation.chooseOne' }),
  }),
} satisfies Record<PartnerRole, z.ZodType>;

export const partnerKey = (userId: string) => ['partner-onboarding', userId] as const;

export type PartnerSaveErrorKind = 'network' | 'unexpected';
export class PartnerSaveFailure extends Error {
  constructor(readonly kind: PartnerSaveErrorKind) {
    super(kind);
    this.name = 'PartnerSaveFailure';
  }
}
function toFailure(error: unknown): PartnerSaveFailure {
  if (error instanceof PartnerSaveFailure) return error;
  if (error instanceof TypeError) return new PartnerSaveFailure('network');
  console.error('Partner profile save failed', error);
  return new PartnerSaveFailure('unexpected');
}

/** The user's own rows (RLS) as form values. */
export function usePartnerData(userId: string, role: PartnerRole) {
  return useQuery({
    queryKey: partnerKey(userId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PartnerValues> => {
      const [profile, contact] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', userId).single(),
        supabase.rpc('get_my_contact'),
      ]);
      if (profile.error) throw profile.error;
      if (contact.error) throw contact.error;
      const c = contact.data[0] ?? null;
      const base: PartnerValues = {
        fullName: profile.data.full_name ?? '',
        phone: c?.phone ?? '',
        sharePhone: c?.share_phone ?? false,
        linkedinUrl: c?.linkedin_url ?? '',
        shareLinkedin: c?.share_linkedin ?? false,
        organizationName: '',
        sector: '',
        orgSize: '',
        supportTypes: [],
        website: '',
        jobTitle: '',
        company: '',
        yearsOfExperience: '',
        expertise: [],
        description: '',
      };
      if (role === 'organization') {
        const { data, error } = await supabase
          .from('organization_profiles')
          .select('organization_name, sector, org_size, support_types, website, description')
          .eq('user_id', userId)
          .single();
        if (error) throw error;
        return {
          ...base,
          organizationName: data.organization_name ?? '',
          sector: data.sector ?? '',
          orgSize: data.org_size ?? '',
          supportTypes: data.support_types,
          website: data.website ?? '',
          description: data.description ?? '',
        };
      }
      const { data, error } = await supabase
        .from('mentor_profiles')
        .select('job_title, company, years_of_experience, expertise, professional_summary')
        .eq('user_id', userId)
        .single();
      if (error) throw error;
      return {
        ...base,
        jobTitle: data.job_title ?? '',
        company: data.company ?? '',
        yearsOfExperience:
          data.years_of_experience === null ? '' : String(data.years_of_experience),
        expertise: data.expertise,
        description: data.professional_summary ?? '',
      };
    },
  });
}

interface SaveInput {
  role: PartnerRole;
  values: PartnerValues;
  /** Onboarding: also mark it complete. Later edits only save the profile. */
  finish: boolean;
}

/**
 * Saves the contact (private, through the RPC), then the role profile, then the profile row
 * (with onboarding_completed when finishing), each touching exactly one row. The server's
 * completion trigger refuses an incomplete profile, whatever this form sends.
 */
export function useSavePartner(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<null, PartnerSaveFailure, SaveInput>({
    mutationFn: async ({ role, values, finish }) => {
      try {
        const phone = normalizeSaudiMobile(values.phone);
        if (!phone) throw new Error('phone not validated');
        const linkedin = withHttps(values.linkedinUrl);
        const contact = await supabase.rpc('update_my_contact', {
          p_phone: phone,
          p_linkedin_url: linkedin,
          p_share_phone: values.sharePhone,
          p_share_linkedin: linkedin !== '' && values.shareLinkedin,
        });
        if (contact.error) throw contact.error;

        const description = values.description.trim();
        const update =
          role === 'organization'
            ? supabase
                .from('organization_profiles')
                .update({
                  organization_name: values.organizationName.trim(),
                  sector: values.sector,
                  org_size: values.orgSize || null,
                  support_types: values.supportTypes,
                  website: withHttps(values.website) || null,
                  description,
                })
                .eq('user_id', userId)
                .select('user_id')
            : supabase
                .from('mentor_profiles')
                .update({
                  job_title: values.jobTitle.trim(),
                  company: values.company.trim(),
                  years_of_experience: Number(values.yearsOfExperience),
                  expertise: values.expertise,
                  professional_summary: description,
                })
                .eq('user_id', userId)
                .select('user_id');
        const roleRow = await update;
        if (roleRow.error) throw roleRow.error;
        if (roleRow.data.length !== 1) throw new Error('role profile not updated');

        const profile = await supabase
          .from('profiles')
          .update({
            full_name: values.fullName.trim(),
            ...(finish ? { onboarding_completed: true } : {}),
          })
          .eq('id', userId)
          .select('id');
        if (profile.error) throw profile.error;
        if (profile.data.length !== 1) throw new Error('profile not updated');
        return null;
      } catch (error) {
        throw toFailure(error);
      }
    },
    onSuccess: (_data, { values, finish }) => {
      queryClient.setQueryData(partnerKey(userId), values);
      if (finish) {
        queryClient.setQueryData<OwnProfile | null>(ownProfileKey(userId), (old) =>
          old ? { ...old, onboarded: true } : old,
        );
      }
    },
  });
}
