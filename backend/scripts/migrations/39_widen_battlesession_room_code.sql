-- Migration to widen roomCode column in BattleSessions to accommodate RANKED_ prefixes
ALTER TABLE "BattleSessions" ALTER COLUMN "roomCode" TYPE VARCHAR(32);
