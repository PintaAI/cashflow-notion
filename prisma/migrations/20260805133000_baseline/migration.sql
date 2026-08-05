-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IOType" AS ENUM ('Income', 'Expenses');

-- CreateEnum
CREATE TYPE "StatieRoomStatus" AS ENUM ('Lobby', 'Voting', 'Debate', 'Collecting', 'Finished');

-- CreateEnum
CREATE TYPE "StatieRoundStatus" AS ENUM ('Voting', 'Debate', 'CollectingTranscripts', 'Finished');

-- CreateEnum
CREATE TYPE "StatieVoteChoice" AS ENUM ('Agree', 'Disagree');

-- CreateEnum
CREATE TYPE "WerewolfRoomStatus" AS ENUM ('Lobby', 'Active', 'Finished');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "profileTheme" JSONB,
    "mcpApiKey" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "activeManagementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatieRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "status" "StatieRoomStatus" NOT NULL DEFAULT 'Lobby',
    "leaderUserId" TEXT,
    "leaderGuestName" TEXT,
    "leaderToken" TEXT NOT NULL,
    "votingSeconds" INTEGER NOT NULL DEFAULT 30,
    "debateSeconds" INTEGER NOT NULL DEFAULT 900,
    "playerLimit" INTEGER NOT NULL DEFAULT 10,
    "currentRoundId" TEXT,
    "pendingStatementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatieRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatieParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "token" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatieParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatieStatement" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "topicKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "generatedByAi" BOOLEAN NOT NULL DEFAULT true,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "agreeCount" INTEGER NOT NULL DEFAULT 0,
    "disagreeCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatieStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatieRound" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "statementId" TEXT NOT NULL,
    "status" "StatieRoundStatus" NOT NULL DEFAULT 'Voting',
    "votingStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "debateStartedAt" TIMESTAMP(3),
    "debateEndsAt" TIMESTAMP(3),
    "transcriptDeadlineAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "aiScore" JSONB,
    "aiScoreError" TEXT,
    "aiScoredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatieRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatieTranscript" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatieTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatieVote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "choice" "StatieVoteChoice" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatieVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WerewolfRoom" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "WerewolfRoomStatus" NOT NULL DEFAULT 'Lobby',
    "leaderUserId" TEXT,
    "leaderGuestName" TEXT,
    "leaderToken" TEXT NOT NULL,
    "playerLimit" INTEGER NOT NULL DEFAULT 10,
    "availableRoles" TEXT[] DEFAULT ARRAY['Werewolf', 'Villager']::TEXT[],
    "maxWerewolves" INTEGER NOT NULL DEFAULT 2,
    "nightSeconds" INTEGER NOT NULL DEFAULT 60,
    "daySeconds" INTEGER NOT NULL DEFAULT 120,
    "votingSeconds" INTEGER NOT NULL DEFAULT 60,
    "revoteSeconds" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WerewolfRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WerewolfParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "token" TEXT NOT NULL,
    "isLeader" BOOLEAN NOT NULL DEFAULT false,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WerewolfParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Management" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT,
    "imageTheme" JSONB,
    "cloudSponsorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Management_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaRedemptionCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedByUserId" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "grantReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "BetaRedemptionCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifeFlowEntity" (
    "id" TEXT NOT NULL,
    "managementId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LifeFlowEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpoPushToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "managementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpoPushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementMember" (
    "id" TEXT NOT NULL,
    "managementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagementMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "managementId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'BookEditIcon',
    "iconType" TEXT NOT NULL DEFAULT 'hugeicon',
    "iconColor" TEXT NOT NULL DEFAULT 'default',
    "contentJson" TEXT,
    "contentHtml" TEXT,
    "contentMarkdown" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteMember" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteInvitation" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverallBudget" (
    "id" TEXT NOT NULL,
    "managementId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OverallBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringEntry" (
    "id" TEXT NOT NULL,
    "managementId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nominal" DOUBLE PRECISION NOT NULL,
    "categoryId" TEXT,
    "io" "IOType" NOT NULL,
    "frequency" TEXT NOT NULL,
    "reminderTime" TEXT NOT NULL DEFAULT '09:00',
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "monthOfYear" INTEGER,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "lastGenerated" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'default',
    "icon" TEXT,
    "budgetDaily" DOUBLE PRECISION,
    "budgetWeekly" DOUBLE PRECISION,
    "budgetMonthly" DOUBLE PRECISION,
    "budgetYearly" DOUBLE PRECISION,
    "managementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickFill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nominal" DOUBLE PRECISION NOT NULL,
    "categoryId" TEXT,
    "managementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuickFill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "notionId" TEXT,
    "name" TEXT NOT NULL,
    "nominal" DOUBLE PRECISION NOT NULL,
    "originalNominal" DOUBLE PRECISION,
    "originalCurrency" TEXT,
    "exchangeRateToIdr" DOUBLE PRECISION,
    "exchangeRateAt" TIMESTAMP(3),
    "categoryId" TEXT,
    "date" TEXT,
    "io" "IOType",
    "managementId" TEXT,
    "createdById" TEXT,
    "isReconciliation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditSnapshot" (
    "id" TEXT NOT NULL,
    "managementId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "expectedBalance" DOUBLE PRECISION NOT NULL,
    "actualBalance" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "adjustmentEntryId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "clientName" TEXT NOT NULL,
    "clientUri" TEXT,
    "logoUri" TEXT,
    "redirectUris" TEXT[],
    "grantTypes" TEXT[],
    "responseTypes" TEXT[],
    "scope" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT,
    "codeChallengeMethod" TEXT,
    "scopes" TEXT[],
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT,
    "tokenType" TEXT NOT NULL DEFAULT 'Bearer',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthConsent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_mcpApiKey_key" ON "User"("mcpApiKey");

-- CreateIndex
CREATE UNIQUE INDEX "StatieRoom_code_key" ON "StatieRoom"("code");

-- CreateIndex
CREATE INDEX "StatieRoom_code_idx" ON "StatieRoom"("code");

-- CreateIndex
CREATE INDEX "StatieRoom_leaderUserId_idx" ON "StatieRoom"("leaderUserId");

-- CreateIndex
CREATE INDEX "StatieRoom_topicKey_idx" ON "StatieRoom"("topicKey");

-- CreateIndex
CREATE INDEX "StatieParticipant_roomId_idx" ON "StatieParticipant"("roomId");

-- CreateIndex
CREATE INDEX "StatieParticipant_userId_idx" ON "StatieParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StatieParticipant_roomId_token_key" ON "StatieParticipant"("roomId", "token");

-- CreateIndex
CREATE INDEX "StatieStatement_topicKey_usedCount_idx" ON "StatieStatement"("topicKey", "usedCount");

-- CreateIndex
CREATE UNIQUE INDEX "StatieStatement_topicKey_text_key" ON "StatieStatement"("topicKey", "text");

-- CreateIndex
CREATE INDEX "StatieRound_roomId_createdAt_idx" ON "StatieRound"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "StatieRound_statementId_idx" ON "StatieRound"("statementId");

-- CreateIndex
CREATE INDEX "StatieTranscript_roundId_idx" ON "StatieTranscript"("roundId");

-- CreateIndex
CREATE INDEX "StatieTranscript_participantId_idx" ON "StatieTranscript"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "StatieTranscript_roundId_participantId_key" ON "StatieTranscript"("roundId", "participantId");

-- CreateIndex
CREATE INDEX "StatieVote_roundId_choice_idx" ON "StatieVote"("roundId", "choice");

-- CreateIndex
CREATE UNIQUE INDEX "StatieVote_roundId_participantId_key" ON "StatieVote"("roundId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "WerewolfRoom_code_key" ON "WerewolfRoom"("code");

-- CreateIndex
CREATE INDEX "WerewolfRoom_code_idx" ON "WerewolfRoom"("code");

-- CreateIndex
CREATE INDEX "WerewolfParticipant_roomId_idx" ON "WerewolfParticipant"("roomId");

-- CreateIndex
CREATE INDEX "WerewolfParticipant_userId_idx" ON "WerewolfParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WerewolfParticipant_roomId_token_key" ON "WerewolfParticipant"("roomId", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Management_cloudSponsorUserId_idx" ON "Management"("cloudSponsorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "BetaRedemptionCode_codeHash_key" ON "BetaRedemptionCode"("codeHash");

-- CreateIndex
CREATE INDEX "BetaRedemptionCode_expiresAt_idx" ON "BetaRedemptionCode"("expiresAt");

-- CreateIndex
CREATE INDEX "BetaRedemptionCode_redeemedByUserId_idx" ON "BetaRedemptionCode"("redeemedByUserId");

-- CreateIndex
CREATE INDEX "LifeFlowEntity_managementId_updatedAt_idx" ON "LifeFlowEntity"("managementId", "updatedAt");

-- CreateIndex
CREATE INDEX "LifeFlowEntity_managementId_kind_deletedAt_idx" ON "LifeFlowEntity"("managementId", "kind", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LifeFlowEntity_managementId_kind_entityId_key" ON "LifeFlowEntity"("managementId", "kind", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpoPushToken_token_key" ON "ExpoPushToken"("token");

-- CreateIndex
CREATE INDEX "ExpoPushToken_userId_idx" ON "ExpoPushToken"("userId");

-- CreateIndex
CREATE INDEX "ExpoPushToken_managementId_idx" ON "ExpoPushToken"("managementId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagementMember_managementId_userId_key" ON "ManagementMember"("managementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_code_key" ON "Invitation"("code");

-- CreateIndex
CREATE INDEX "NoteMember_userId_idx" ON "NoteMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteMember_noteId_userId_key" ON "NoteMember"("noteId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteInvitation_code_key" ON "NoteInvitation"("code");

-- CreateIndex
CREATE INDEX "NoteInvitation_noteId_idx" ON "NoteInvitation"("noteId");

-- CreateIndex
CREATE UNIQUE INDEX "OverallBudget_managementId_period_key" ON "OverallBudget"("managementId", "period");

-- CreateIndex
CREATE INDEX "RecurringEntry_managementId_active_idx" ON "RecurringEntry"("managementId", "active");

-- CreateIndex
CREATE INDEX "RecurringEntry_managementId_frequency_idx" ON "RecurringEntry"("managementId", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_managementId_key" ON "Category"("name", "managementId");

-- CreateIndex
CREATE UNIQUE INDEX "Entry_notionId_key" ON "Entry"("notionId");

-- CreateIndex
CREATE INDEX "Entry_date_createdAt_id_idx" ON "Entry"("date", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Entry_io_date_idx" ON "Entry"("io", "date");

-- CreateIndex
CREATE INDEX "Entry_categoryId_idx" ON "Entry"("categoryId");

-- CreateIndex
CREATE INDEX "Entry_createdAt_idx" ON "Entry"("createdAt");

-- CreateIndex
CREATE INDEX "Entry_managementId_idx" ON "Entry"("managementId");

-- CreateIndex
CREATE INDEX "Entry_createdById_idx" ON "Entry"("createdById");

-- CreateIndex
CREATE INDEX "AuditSnapshot_managementId_date_idx" ON "AuditSnapshot"("managementId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAuthorizationCode_code_key" ON "OAuthAuthorizationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_accessToken_key" ON "OAuthToken"("accessToken");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_refreshToken_key" ON "OAuthToken"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthConsent_clientId_userId_key" ON "OAuthConsent"("clientId", "userId");

-- AddForeignKey
ALTER TABLE "StatieRoom" ADD CONSTRAINT "StatieRoom_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieParticipant" ADD CONSTRAINT "StatieParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StatieRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieParticipant" ADD CONSTRAINT "StatieParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieRound" ADD CONSTRAINT "StatieRound_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "StatieRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieRound" ADD CONSTRAINT "StatieRound_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "StatieStatement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieTranscript" ADD CONSTRAINT "StatieTranscript_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "StatieRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieTranscript" ADD CONSTRAINT "StatieTranscript_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "StatieParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieVote" ADD CONSTRAINT "StatieVote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "StatieRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatieVote" ADD CONSTRAINT "StatieVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "StatieParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WerewolfRoom" ADD CONSTRAINT "WerewolfRoom_leaderUserId_fkey" FOREIGN KEY ("leaderUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WerewolfParticipant" ADD CONSTRAINT "WerewolfParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "WerewolfRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WerewolfParticipant" ADD CONSTRAINT "WerewolfParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Management" ADD CONSTRAINT "Management_cloudSponsorUserId_fkey" FOREIGN KEY ("cloudSponsorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetaRedemptionCode" ADD CONSTRAINT "BetaRedemptionCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LifeFlowEntity" ADD CONSTRAINT "LifeFlowEntity_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpoPushToken" ADD CONSTRAINT "ExpoPushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpoPushToken" ADD CONSTRAINT "ExpoPushToken_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementMember" ADD CONSTRAINT "ManagementMember_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementMember" ADD CONSTRAINT "ManagementMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMember" ADD CONSTRAINT "NoteMember_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteMember" ADD CONSTRAINT "NoteMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteInvitation" ADD CONSTRAINT "NoteInvitation_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OverallBudget" ADD CONSTRAINT "OverallBudget_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickFill" ADD CONSTRAINT "QuickFill_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickFill" ADD CONSTRAINT "QuickFill_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSnapshot" ADD CONSTRAINT "AuditSnapshot_managementId_fkey" FOREIGN KEY ("managementId") REFERENCES "Management"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditSnapshot" ADD CONSTRAINT "AuditSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationCode" ADD CONSTRAINT "OAuthAuthorizationCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationCode" ADD CONSTRAINT "OAuthAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "OAuthClient"("clientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthConsent" ADD CONSTRAINT "OAuthConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
