export type ClientMasterKind = 'categories' | 'sources' | 'preferences' | 'consultation-templates' | 'feedback-definitions';

export interface ClientMasterSummary {
  clientProfiles: number;
  categories: number;
  sources: number;
  preferences: number;
  consultationTemplates: number;
  feedbackDefinitions: number;
}

export interface ClientMasterBase {
  id: string;
  tenantId: string;
  branchId: string;
  code: string;
  name: string;
  hide: boolean;
  status: 'active' | 'draft' | 'archived';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClientCategoryMaster extends ClientMasterBase {
  description: string;
  color: string;
  discountPercent: number;
  loyaltyMultiplier: number;
  visitThreshold: number;
  spendThreshold: number;
}

export interface ClientSourceMaster extends ClientMasterBase {
  sourceType: string;
  defaultCampaignId: string;
  referralRequired: boolean;
  attributionWindowDays: number;
  notes: string;
}

export interface ClientPreferenceMaster extends ClientMasterBase {
  preferenceType: string;
  options: string[];
  riskLevel: string;
  consentRequired: boolean;
  notes: string;
}

export interface ClientConsultationTemplateMaster extends ClientMasterBase {
  templateType: string;
  sections: Array<Record<string, unknown>>;
  consentRequired: boolean;
  validityDays: number;
  notes: string;
}

export interface ClientFeedbackDefinitionMaster extends ClientMasterBase {
  feedbackType: string;
  triggerEvent: string;
  ratingScale: number;
  questions: Array<Record<string, unknown>>;
  scoreRules: Record<string, unknown>;
  notes: string;
}

export type ClientMasterRecord =
  | ClientCategoryMaster
  | ClientSourceMaster
  | ClientPreferenceMaster
  | ClientConsultationTemplateMaster
  | ClientFeedbackDefinitionMaster;
