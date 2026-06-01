-- CreateTable
CREATE TABLE "club_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "clubName" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "club_settings_pkey" PRIMARY KEY ("id")
);
