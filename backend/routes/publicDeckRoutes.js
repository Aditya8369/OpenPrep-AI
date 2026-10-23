const express = require('express');
const multer = require('multer');
const { getPublicDeckById } = require('../controllers/flashcardDeckController');
const { exportDeckToAnki, importDeckFromAnki } = require('../controllers/ankiController');
const { parseQuizletText } = require('../services/quizletImportService');
const FlashcardDeck = require('../models/FlashcardDeck');
const Flashcard = require('../models/Flashcard');
const { protect } = require('../middleware/auth');

const router = express.Router();

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Public shared deck view
router.get('/shared/:deckId', getPublicDeckById);

// Anki Package Import: POST /api/decks/import/anki
router.post('/import/anki', protect, memoryUpload.single('file'), importDeckFromAnki);

// Anki Package Export: GET /api/decks/:id/export/anki
router.get('/:id/export/anki', protect, exportDeckToAnki);

// Quizlet Text/Delimited Import: POST /api/decks/import/quizlet
router.post('/import/quizlet', protect, memoryUpload.single('file'), async (req, res) => {
  try {
    let input = '';
    if (req.file && req.file.buffer) {
      input = req.file.buffer.toString('utf8');
    } else if (req.body && req.body.text) {
      input = req.body.text;
    } else if (req.body && req.body.cards) {
      input = JSON.stringify(req.body.cards);
    }

    if (!input || !input.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Quizlet export text or file upload is required.',
      });
    }

    const { termSeparator, cardSeparator, deckName, subjectId } = req.body || {};
    const parsedCards = parseQuizletText(input, { termSeparator, cardSeparator });

    if (!parsedCards || parsedCards.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid flashcards could be parsed from the Quizlet input.',
      });
    }

    const userId = req.user.id;
    let targetDeckId = req.body?.deckId;

    if (!targetDeckId) {
      try {
        const createdDeck = await FlashcardDeck.create({
          name: deckName || 'Imported Quizlet Deck',
          description: `Imported from Quizlet on ${new Date().toLocaleDateString()}`,
          user: userId,
          subject: subjectId || null,
        });
        targetDeckId = createdDeck.id;
      } catch (err) {
        console.warn('Could not auto-create FlashcardDeck:', err.message);
      }
    }

    let savedCards = [];
    if (subjectId) {
      const cardsToCreate = parsedCards.map((c) => ({
        user: userId,
        subject: subjectId,
        deckId: targetDeckId || null,
        front: c.front,
        back: c.back,
        hint: c.hint,
        tags: c.tags,
        interval: 1,
        repetitions: 0,
        efactor: 2.5,
      }));

      savedCards = await Flashcard.bulkCreate(cardsToCreate);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully parsed ${parsedCards.length} flashcards from Quizlet.`,
      deckId: targetDeckId || null,
      totalImported: parsedCards.length,
      cards: parsedCards,
      savedCount: savedCards.length,
    });
  } catch (error) {
    console.error('Error in importDeckFromQuizlet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import Quizlet deck: ' + error.message,
    });
  }
});

module.exports = router;
