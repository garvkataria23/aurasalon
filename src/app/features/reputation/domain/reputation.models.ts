export type ReviewSentiment = 'very_negative' | 'negative' | 'neutral' | 'positive' | 'very_positive' | 'mixed' | '';
export type ReplyApprovalStatus = 'pending' | 'approved' | 'rejected' | 'posted' | '';

export interface ReputationMetrics {
  averageRating: number;
  totalReviews: number;
  replyRate: number;
  avgReplyTimeHours: number;
  unresolvedNegative: number;
  pendingReplyApprovals: number;
}

export interface ReputationScore {
  source: string;
  branchId: string;
  scoreDate: string;
  overallScore: number;
  avgRating: number;
  totalReviews: number;
  positivePct: number;
  negativePct: number;
  replyRate: number;
  netPromoterScore: number;
  segments?: Record<string, number>;
}

export interface PlatformSummary {
  platformId: string;
  platformCode: string;
  platformName: string;
  connected: boolean;
  reviewCount: number;
  averageRating: number;
  lastSyncedAt: string;
  lastSyncStatus: string;
}

export interface ReputationAlert {
  id: string;
  branchId: string;
  reviewId: string;
  severity: string;
  acknowledged: boolean;
  resolutionAction: string;
  createdAt: string;
}

export interface ReviewReply {
  id: string;
  reviewId: string;
  branchId: string;
  replyText: string;
  replyLanguage: string;
  aiGenerated: boolean;
  approvalStatus: ReplyApprovalStatus;
  postedToPlatform: boolean;
  createdBy: string;
  createdAt: string;
}

export interface ReputationReview {
  id: string;
  source: 'v2' | 'legacy' | string;
  branchId: string;
  platformId: string;
  platformCode: string;
  platformName: string;
  reviewerName: string;
  reviewerAvatar: string;
  reviewerVerified: boolean;
  customerId: string;
  appointmentId: string;
  invoiceId: string;
  primaryStaffId: string;
  serviceIds: string[];
  rating: number;
  ratingMax: number;
  title: string;
  reviewText: string;
  reviewLanguage: string;
  reviewTranslatedText: string;
  sentiment: ReviewSentiment;
  sentimentScore: number;
  sentimentConfidence: number;
  emotionPrimary: string;
  topics: string[];
  aspects: Record<string, unknown>;
  intentDetected: string;
  toxicityScore: number;
  fakeProbability: number;
  status: string;
  priority: string;
  assignedTo: string;
  hasReply: boolean;
  replyText: string;
  replyApprovalStatus: ReplyApprovalStatus;
  reviewedAt: string;
  createdAt: string;
  updatedAt: string;
  isFlagged: boolean;
  flaggedReason: string;
  alerts?: ReputationAlert[];
  replies?: ReviewReply[];
  staffAttribution?: Array<Record<string, unknown>>;
}

export interface ReputationDashboard {
  score: ReputationScore;
  metrics: ReputationMetrics;
  platforms: PlatformSummary[];
  recentReviews: ReputationReview[];
  alerts: ReputationAlert[];
  approvalRequiredByDefault: boolean;
}

export interface ReviewPlatform {
  id: string;
  branchId: string;
  platformCode: string;
  platformName: string;
  platformUrl: string;
  businessListingId: string;
  businessListingUrl: string;
  autoSyncEnabled: boolean;
  lastSyncedAt: string;
  lastSyncStatus: string;
  providerStatus: string;
  tokenEnvKey: string;
  accountId: string;
  locationId: string;
  pageAccountId: string;
  rateLimitPerDay: number;
  providerConfig: Record<string, unknown>;
  isActive: boolean;
}

export interface SupportedPlatform {
  code: string;
  name: string;
  rateLimitPerDay: number;
}

export interface ReputationPlatformsResponse {
  platforms: ReviewPlatform[];
  supported: SupportedPlatform[];
}

export interface AiDraftReplyResponse {
  reviewId: string;
  providerStatus: string;
  approvalRequired: boolean;
  drafts: string[];
  message: string;
}
