-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "aiAnalysisStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN     "aiAnalyzedAt" TIMESTAMP(3),
ADD COLUMN     "aiEngagementLevel" TEXT,
ADD COLUMN     "aiIntent" TEXT,
ADD COLUMN     "aiIntentLevel" TEXT,
ADD COLUMN     "aiKeyRequirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "aiObjections" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "aiRecommendedNextAction" TEXT,
ADD COLUMN     "aiRequirementClarity" TEXT,
ADD COLUMN     "aiSuggestedResponse" TEXT,
ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "leadPriority" TEXT,
ADD COLUMN     "leadScore" INTEGER;
