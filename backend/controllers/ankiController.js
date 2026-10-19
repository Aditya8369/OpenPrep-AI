/**
 * Anki Controller
 * Handles exporting decks to .apkg and importing .apkg packages into OpenPrep AI
 */

const ankiPackagerService = require('../services/ankiPackagerService');
const FlashcardDeck = require('../models/FlashcardDeck');
const Flashcard = require('../models/Flashcard');

/**
 * Export a deck or user cards as an Anki .apkg package
 * GET /api/flashcards/deck/:id/export/anki
 */
const exportDeckToAnki = async (req, res) => {
  try {
    const deckId = req.params.id || req.params.deckId;

    if (!deckId) {
      return res.status(400).json({ success: false, message: 'Deck ID is required.' });
    }

    let deckName = 'OpenPrep AI Deck';
    let cards = [];

    if (deckId !== 'all') {
      const deck = await FlashcardDeck.findByPk(deckId);
      if (deck) {
        deckName = deck.name;
      }

      // Fetch cards associated with this deck or subject
      cards = await Flashcard.findAll({
        where: {
          ...(deck ? { deckId } : { subject: deckId }),
          ...(req.user ? { user: req.user.id } : {}),
        },
      });

      if (!cards || cards.length === 0) {
        // Fallback: search by deckId directly
        cards = await Flashcard.findAll({ where: { deckId } });
      }
    } else {
      // Export all user cards
      cards = await Flashcard.findAll({
        where: req.user ? { user: req.user.id } : {},
      });
      deckName = 'All OpenPrep Flashcards';
    }

    if (!cards || cards.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No flashcards found in this deck to export.',
      });
    }

    const formattedCards = cards.map((c) => ({
      front: c.front,
      back: c.back,
      hint: c.hint,
      tags: c.tags || [],
      interval: c.interval || 1,
      easeFactor: c.efactor || 2.5,
      repetitions: c.repetitions || 0,
    }));

    const apkgBuffer = await ankiPackagerService.generateAnkiPackage(formattedCards, deckName);

    const safeFilename = deckName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'deck';

    res.setHeader('Content-Type', 'application/apkg');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}.apkg"`);
    res.setHeader('Content-Length', apkgBuffer.length);

    return res.status(200).send(apkgBuffer);
  } catch (error) {
    console.error('Error in exportDeckToAnki:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate Anki deck package: ' + error.message,
    });
  }
};

/**
 * Import flashcards from an uploaded Anki .apkg file
 * POST /api/flashcards/import/anki
 */
const importDeckFromAnki = async (req, res) => {
  try {
    let fileBuffer = null;

    if (req.file && req.file.buffer) {
      fileBuffer = req.file.buffer;
    } else if (req.body && Buffer.isBuffer(req.body)) {
      fileBuffer = req.body;
    } else if (req.body && req.body.base64) {
      fileBuffer = Buffer.from(req.body.base64, 'base64');
    }

    if (!fileBuffer) {
      return res.status(400).json({
        success: false,
        message: 'Anki (.apkg) file upload or base64 payload is required.',
      });
    }

    const parsed = await ankiPackagerService.parseAnkiPackage(fileBuffer);

    const userId = req.user?.id || req.body?.userId;
    const subjectId = req.body?.subjectId;
    const targetDeckId = req.params?.id || req.body?.deckId;

    let finalDeckId = targetDeckId;

    // Create deck if needed and model exists
    if (!finalDeckId && userId) {
      try {
        const createdDeck = await FlashcardDeck.create({
          name: parsed.deckName || 'Imported Anki Deck',
          description: `Imported from Anki (.apkg) on ${new Date().toLocaleDateString()}`,
          user: userId,
          subject: subjectId || null,
        });
        finalDeckId = createdDeck.id;
      } catch (deckErr) {
        console.warn('Could not auto-create FlashcardDeck entry:', deckErr.message);
      }
    }

    // Persist cards into DB if user is authenticated
    let savedCards = [];
    if (userId && subjectId) {
      const cardsToCreate = parsed.cards.map((c) => ({
        user: userId,
        subject: subjectId,
        deckId: finalDeckId || null,
        front: c.front,
        back: c.back,
        hint: c.hint || null,
        tags: c.tags || [],
        interval: c.interval || 1,
        efactor: c.easeFactor || 2.5,
        repetitions: c.repetitions || 0,
      }));

      savedCards = await Flashcard.bulkCreate(cardsToCreate);
    }

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${parsed.cards.length} cards from Anki package.`,
      deckName: parsed.deckName,
      deckId: finalDeckId || null,
      totalImported: parsed.cards.length,
      cards: parsed.cards,
      savedCount: savedCards.length,
    });
  } catch (error) {
    console.error('Error in importDeckFromAnki:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import Anki deck: ' + error.message,
    });
  }
};

module.exports = {
  exportDeckToAnki,
  importDeckFromAnki,
};
