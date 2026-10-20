import { describe, it, expect, vi, beforeEach } from 'vitest';
const { processBatchSync } = require('../../controllers/syncController');
const Flashcard = require('../../models/Flashcard');
const Note = require('../../models/Note');

describe('syncController - Batch Offline Sync & LWW Conflict Resolution', () => {
  let req, res;

  beforeEach(() => {
    vi.restoreAllMocks();
    req = {
      user: { id: 'user-456' },
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  it('returns 400 when mutations array is missing or empty', async () => {
    req.body = { mutations: [] };

    await processBatchSync(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/non-empty array/i),
      })
    );
  });

  it('processes flashcard review mutation and calculates SM-2 updates', async () => {
    const mockCard = {
      id: 'card-1',
      user: 'user-456',
      interval: 1,
      repetitions: 1,
      efactor: 2.5,
      lastReviewedAt: new Date('2026-08-01T12:00:00Z'),
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(Flashcard, 'findOne').mockResolvedValue(mockCard);

    req.body = {
      mutations: [
        {
          id: 'mut-1',
          type: 'FLASHCARD_REVIEW',
          clientTimestamp: '2026-08-02T10:00:00Z',
          payload: {
            cardId: 'card-1',
            score: 4,
          },
        },
      ],
    };

    await processBatchSync(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          processed: 1,
          failed: 0,
          conflictsResolved: 0,
        }),
      })
    );
    expect(mockCard.save).toHaveBeenCalled();
  });

  it('resolves conflict in favor of server when server record has newer review timestamp', async () => {
    const mockCard = {
      id: 'card-1',
      user: 'user-456',
      interval: 5,
      repetitions: 3,
      efactor: 2.6,
      lastReviewedAt: new Date('2026-08-10T12:00:00Z'), // Server reviewed on Aug 10
      save: vi.fn(),
    };

    vi.spyOn(Flashcard, 'findOne').mockResolvedValue(mockCard);

    req.body = {
      mutations: [
        {
          id: 'mut-old',
          type: 'FLASHCARD_REVIEW',
          clientTimestamp: '2026-08-05T10:00:00Z', // Client offline review was earlier on Aug 5
          payload: {
            cardId: 'card-1',
            score: 2,
          },
        },
      ],
    };

    await processBatchSync(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          processed: 1,
          conflictsResolved: 1,
          results: expect.arrayContaining([
            expect.objectContaining({
              actionId: 'mut-old',
              status: 'conflict_resolved',
              resolution: 'server_wins',
            }),
          ]),
        }),
      })
    );
    // Server won, so older client review should not overwrite card state
    expect(mockCard.save).not.toHaveBeenCalled();
  });

  it('updates note when client mutation timestamp is newer than server updatedAt', async () => {
    const mockNote = {
      id: 'note-1',
      user: 'user-456',
      title: 'Original Title',
      content: 'Original Content',
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      save: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(Note, 'findOne').mockResolvedValue(mockNote);

    req.body = {
      mutations: [
        {
          id: 'mut-note-1',
          type: 'NOTE_UPDATE',
          clientTimestamp: '2026-08-03T15:00:00Z',
          payload: {
            noteId: 'note-1',
            title: 'Updated Offline Title',
            content: 'Updated Content while offline',
          },
        },
      ],
    };

    await processBatchSync(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockNote.title).toBe('Updated Offline Title');
    expect(mockNote.content).toBe('Updated Content while offline');
    expect(mockNote.save).toHaveBeenCalled();
  });
});
