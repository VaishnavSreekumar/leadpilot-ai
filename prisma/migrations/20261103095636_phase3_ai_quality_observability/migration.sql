-- CreateTable
CREATE TABLE "AiExecutionLog" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "intentLevel" TEXT,
    "engagementLevel" TEXT,
    "requirementClarity" TEXT,
    "uncertainFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keyRequirementsCount" INTEGER NOT NULL DEFAULT 0,
    "objectionsCount" INTEGER NOT NULL DEFAULT 0,
    "suggestedQuestionsCount" INTEGER NOT NULL DEFAULT 0,
    "promptTokens" INTEGER,
    "responseTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiExecutionLog_correlationId_key" ON "AiExecutionLog"("correlationId");

-- CreateIndex
CREATE INDEX "AiExecutionLog_leadId_createdAt_idx" ON "AiExecutionLog"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "AiExecutionLog_userId_idx" ON "AiExecutionLog"("userId");

-- CreateIndex
CREATE INDEX "AiExecutionLog_correlationId_idx" ON "AiExecutionLog"("correlationId");

-- CreateIndex
CREATE INDEX "AiExecutionLog_status_idx" ON "AiExecutionLog"("status");

-- CreateIndex
CREATE INDEX "AiExecutionLog_errorType_idx" ON "AiExecutionLog"("errorType");

-- CreateIndex
CREATE INDEX "AiExecutionLog_createdAt_idx" ON "AiExecutionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AiExecutionLog" ADD CONSTRAINT "AiExecutionLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiExecutionLog" ADD CONSTRAINT "AiExecutionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
