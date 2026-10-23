/**
 * @fileoverview OMR Template Generation Service
 * Generates standardized, downloadable PDF OMR answer sheets customized
 * for 20, 50, 100, or 180 questions with 4 corner fiducial markers and embedded QR verification.
 */

const crypto = require('crypto');

let PDFDocument;
let QRCode;
try {
  PDFDocument = require('pdfkit');
  QRCode = require('qrcode');
} catch (e) {
  PDFDocument = null;
  QRCode = null;
}

/**
 * Computes SHA-256 hash of answer key for tamper-proof verification
 */
function computeAnswerKeyHash(answers = []) {
  const serialized = Array.isArray(answers) ? answers.join(':') : String(answers);
  return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
}

/**
 * Generates standard OMR grid configuration metadata
 */
function getGridConfig(questionCount = 50) {
  const validCounts = [20, 50, 100, 180];
  const count = validCounts.includes(Number(questionCount)) ? Number(questionCount) : 50;

  const cols = count > 100 ? 4 : count > 50 ? 3 : 2;
  const questionsPerCol = Math.ceil(count / cols);

  const grid = [];
  const options = ['A', 'B', 'C', 'D'];

  for (let q = 1; q <= count; q++) {
    const colIdx = Math.floor((q - 1) / questionsPerCol);
    const rowIdx = (q - 1) % questionsPerCol;
    const baseY = 210 + rowIdx * 15;
    const baseX = 50 + colIdx * 135;

    grid.push({
      questionNumber: q,
      colIndex: colIdx,
      rowIndex: rowIdx,
      options: options.map((opt, optIdx) => ({
        option: opt,
        x: baseX + 28 + optIdx * 18,
        y: baseY + 5,
        radius: 5,
      })),
    });
  }

  return { questionCount: count, columns: cols, questionsPerCol, grid };
}

/**
 * Generates downloadable PDF OMR sheet buffer
 * @param {string} quizId
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
async function generateOmrTemplate(quizId, options = {}) {
  const {
    questionCount = 50,
    examCode = 'OPENPREP-2026',
    title = 'OpenPrep AI Standardized OMR Examination',
    answers = [],
    studentInfo = {},
  } = options;

  const answerKeyHash = options.answerKeyHash || computeAnswerKeyHash(answers);
  const gridConfig = getGridConfig(questionCount);

  // Fallback if pdfkit is not available
  if (!PDFDocument) {
    const fallbackMeta = JSON.stringify({
      quizId,
      questionCount: gridConfig.questionCount,
      answerKeyHash,
      fiducials: ['TL', 'TR', 'BL', 'BR'],
      format: 'PDF-MOCK-BUFFER',
    });
    return Buffer.from(`%PDF-1.4\n%OpenPrep OMR Fallback\n${fallbackMeta}\n%%EOF`);
  }

  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 28, bottom: 28, left: 28, right: 28 } });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // 1. Four Corner Fiducial Marker Targets (16x16 solid black squares for homography alignment)
      const drawFiducial = (x, y) => {
        doc.rect(x - 8, y - 8, 16, 16).fill('#000000');
        doc.rect(x - 4, y - 4, 8, 8).fill('#FFFFFF');
        doc.circle(x, y, 2).fill('#000000');
      };

      drawFiducial(32, 32);       // Top-Left (TL)
      drawFiducial(563, 32);      // Top-Right (TR)
      drawFiducial(32, 810);      // Bottom-Left (BL)
      drawFiducial(563, 810);     // Bottom-Right (BR)

      // 2. Embedded QR Code with Quiz ID and Answer Key Hash
      const qrPayload = JSON.stringify({
        quizId,
        hash: answerKeyHash,
        questions: gridConfig.questionCount,
        exam: examCode,
      });

      if (QRCode) {
        try {
          const qrBuffer = await QRCode.toBuffer(qrPayload, { type: 'png', margin: 1, width: 72 });
          doc.image(qrBuffer, 480, 48, { width: 72, height: 72 });
        } catch (e) {
          // fallback text block
          doc.rect(480, 48, 72, 72).stroke('#000000');
          doc.fontSize(7).text(`QR:${quizId.substring(0, 8)}`, 485, 80);
        }
      }

      // 3. Exam Header
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(16).text('OpenPrep AI Examination', 55, 48);
      doc.fillColor('#475569').font('Helvetica').fontSize(10).text(title, 55, 68);
      doc.fontSize(8).fillColor('#64748B').text(`Exam Code: ${examCode}  |  Quiz ID: ${quizId}`, 55, 84);
      doc.text(`Verification Hash: ${answerKeyHash}`, 55, 96);

      // 4. Candidate Info Box
      doc.rect(55, 115, 410, 52).lineWidth(1).stroke('#CBD5E1').fill('#F8FAFC');
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(9);
      doc.text('CANDIDATE NAME: _________________________________', 68, 126);
      doc.text(`ROLL / STUDENT ID: ${studentInfo.id || '____________________'}`, 68, 144);
      doc.text(`MAX QUESTIONS: ${gridConfig.questionCount}`, 320, 126);
      doc.text('SET: A', 320, 144);

      // 5. Grid Header & Bubbles
      doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);
      for (let c = 0; c < gridConfig.columns; c++) {
        const colBaseX = 50 + c * 135;
        doc.text('Q#   A   B   C   D', colBaseX + 6, 192);
        doc.moveTo(colBaseX, 204).lineTo(colBaseX + 115, 204).stroke('#94A3B8');
      }

      const options = ['A', 'B', 'C', 'D'];
      gridConfig.grid.forEach((qItem) => {
        const rowY = 210 + qItem.rowIndex * 15;
        const colBaseX = 50 + qItem.colIndex * 135;

        // Question number
        doc.fillColor('#1E293B').font('Helvetica').fontSize(7.5).text(
          String(qItem.questionNumber).padStart(2, '0'),
          colBaseX + 4,
          rowY + 1
        );

        // Bubbles A, B, C, D
        options.forEach((opt, optIdx) => {
          const bX = colBaseX + 28 + optIdx * 18;
          const bY = rowY + 5;
          doc.circle(bX, bY, 4.5).lineWidth(0.8).stroke('#475569');
          doc.fillColor('#64748B').font('Helvetica').fontSize(5.5).text(opt, bX - 2, bY - 2.5);
        });
      });

      // 6. Footer instructions
      doc.fillColor('#64748B').font('Helvetica').fontSize(7.5).text(
        'Instructions: Darken completely with dark pencil or blue/black ballpoint pen. Do not fold or mark outside bubbles.',
        55,
        790
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateOmrTemplate,
  computeAnswerKeyHash,
  getGridConfig,
};
