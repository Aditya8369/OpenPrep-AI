import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import quizBattleService from '../../services/quizBattleService';

describe('QuizBattleService Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quizBattleService.matchmakingQueues.clear();
    quizBattleService.activeBattleSessions.clear();
  });

  describe('calculateEloDelta', () => {
    it('calculates standard chess ELO rating changes for equal opponents', () => {
      const result = quizBattleService.calculateEloDelta(1200, 1200, 1);
      expect(result.newEloA).toBe(1216);
      expect(result.newEloB).toBe(1184);
      expect(result.deltaA).toBe(16);
      expect(result.deltaB).toBe(-16);
    });

    it('calculates draw ELO correctly', () => {
      const result = quizBattleService.calculateEloDelta(1200, 1200, 0.5);
      expect(result.deltaA).toBe(0);
      expect(result.deltaB).toBe(0);
    });

    it('enforces a minimum floor of 100 ELO', () => {
      const result = quizBattleService.calculateEloDelta(105, 1800, 0);
      expect(result.newEloA).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Matchmaking Queue', () => {
    it('enqueues a player when no matching opponent is available', async () => {
      const result = await quizBattleService.addToMatchmakingQueue({
        userId: 'u1',
        socketId: 's1',
        username: 'StudentA',
        elo: 1200,
        subjectId: 'math',
      });

      expect(result.matched).toBe(false);
      expect(result.queued).toBe(true);
      expect(quizBattleService.matchmakingQueues.get('math').length).toBe(1);
    });

    it('matches two players within +/- 200 ELO into a synchronized battle room', async () => {
      await quizBattleService.addToMatchmakingQueue({
        userId: 'u1',
        socketId: 's1',
        username: 'StudentA',
        elo: 1200,
        subjectId: 'math',
      });

      const matchResult = await quizBattleService.addToMatchmakingQueue({
        userId: 'u2',
        socketId: 's2',
        username: 'StudentB',
        elo: 1250,
        subjectId: 'math',
      });

      expect(matchResult.matched).toBe(true);
      expect(matchResult.roomId).toMatch(/^BATTLE_/);
      expect(matchResult.player1.username).toBe('StudentB');
      expect(matchResult.player2.username).toBe('StudentA');
      expect(matchResult.session.questions.length).toBe(10);
      expect(matchResult.session.status).toBe('playing');
    });

    it('removes player from queue', async () => {
      await quizBattleService.addToMatchmakingQueue({
        userId: 'u1',
        socketId: 's1',
        username: 'StudentA',
        elo: 1200,
        subjectId: 'physics',
      });

      const removed = quizBattleService.removeFromMatchmakingQueue('s1');
      expect(removed).toBe(true);
      expect(quizBattleService.matchmakingQueues.get('physics').length).toBe(0);
    });
  });

  describe('Answer Submission & Synchronized Scorer', () => {
    it('scores a correct answer with speed bonus and applies HP damage to opponent', async () => {
      // Setup matched game
      await quizBattleService.addToMatchmakingQueue({
        userId: 'u1',
        socketId: 's1',
        username: 'StudentA',
        elo: 1200,
        subjectId: 'cs',
      });
      const match = await quizBattleService.addToMatchmakingQueue({
        userId: 'u2',
        socketId: 's2',
        username: 'StudentB',
        elo: 1200,
        subjectId: 'cs',
      });

      const roomId = match.roomId;
      const currentQ = match.session.questions[0];

      // Submit correct answer for Player 1
      const subResult = quizBattleService.submitAnswer({
        roomId,
        socketId: 's2',
        questionIndex: 0,
        selectedOption: currentQ.correctAnswerIndex,
        clientTimestamp: Date.now(),
      });

      expect(subResult.success).toBe(true);
      expect(subResult.isCorrect).toBe(true);
      expect(subResult.pointsEarned).toBeGreaterThanOrEqual(100);
      expect(subResult.opponent.hp).toBeLessThan(100);
    });
  });

  describe('Disconnect Grace Period & Reconnection', () => {
    it('schedules a 15-second forfeit timer on disconnect and allows clean reconnection', async () => {
      await quizBattleService.addToMatchmakingQueue({
        userId: 'u1',
        socketId: 's1',
        username: 'StudentA',
        elo: 1200,
        subjectId: 'general',
      });
      const match = await quizBattleService.addToMatchmakingQueue({
        userId: 'u2',
        socketId: 's2',
        username: 'StudentB',
        elo: 1200,
        subjectId: 'general',
      });

      const disconnect = quizBattleService.scheduleDisconnectForfeit('s1', vi.fn());
      expect(disconnect.gracePeriodSeconds).toBe(15);
      expect(disconnect.player.connected).toBe(false);

      // Reconnect with new socket ID
      const recon = quizBattleService.handleReconnection(match.roomId, 'u1', 's1_new');
      expect(recon).not.toBeNull();
      expect(recon.player.connected).toBe(true);
      expect(recon.player.socketId).toBe('s1_new');
    });
  });
});
