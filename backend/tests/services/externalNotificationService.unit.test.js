const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDiscordPayload,
  formatTelegramMessage,
  sendDiscordNotification,
  sendTelegramNotification,
} = require('../../services/externalNotificationService');

test('formatDiscordPayload produces rich embed with stats and fields', () => {
  const payload = formatDiscordPayload({
    username: 'Dhruv',
    pendingCards: 24,
    streakCount: 12,
    nextExamDays: 5,
    examName: 'JEE Advanced',
    quote: 'Stay focused and conquer the day.',
  });

  assert.equal(payload.username, 'OpenPrep AI Tutor');
  assert(payload.embeds && payload.embeds.length === 1);

  const embed = payload.embeds[0];
  assert(embed.description.includes('Dhruv'));
  assert.equal(embed.color, 0x4f46e5);

  const cardField = embed.fields.find((f) => f.name.includes('Pending Flashcards'));
  assert(cardField);
  assert(cardField.value.includes('24 cards'));

  const streakField = embed.fields.find((f) => f.name.includes('Current Streak'));
  assert(streakField);
  assert(streakField.value.includes('12 Days'));

  const examField = embed.fields.find((f) => f.name.includes('Exam Countdown'));
  assert(examField);
  assert(examField.value.includes('5 days'));
  assert(examField.value.includes('JEE Advanced'));
});

test('formatTelegramMessage produces Markdown message with action buttons', () => {
  const { text, reply_markup } = formatTelegramMessage({
    username: 'Dhruv',
    pendingCards: 18,
    streakCount: 9,
    nextExamDays: 3,
    examName: 'NEET',
    quote: 'Keep going!',
  });

  assert(text.includes('*OpenPrep AI Daily Briefing*'));
  assert(text.includes('*Dhruv*'));
  assert(text.includes('18 due for review'));
  assert(text.includes('9 days active'));
  assert(text.includes('3 days until *NEET*'));

  assert(reply_markup && reply_markup.inline_keyboard);
  const buttons = reply_markup.inline_keyboard[0];
  assert(buttons.length >= 2);
  assert(buttons[0].text.includes('Review Flashcards'));
});

test('sendDiscordNotification validates webhook domain', async () => {
  await assert.rejects(
    async () => {
      await sendDiscordNotification('https://evil-hacker.com/webhook', { content: 'test' });
    },
    { message: /Discord webhook URL must start with/ }
  );
});

test('sendDiscordNotification dispatches successfully when fetch succeeds', async () => {
  const originalFetch = global.fetch;
  try {
    let capturedUrl = null;
    let capturedBody = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        status: 204,
      };
    };

    const dummyUrl = 'https://discord.com/api/webhooks/123456789/abcdef';
    const payload = formatDiscordPayload({ username: 'Alice', pendingCards: 5, streakCount: 3 });

    const result = await sendDiscordNotification(dummyUrl, payload);
    assert.equal(result.success, true);
    assert.equal(capturedUrl, dummyUrl);
    assert.equal(capturedBody.username, 'OpenPrep AI Tutor');
  } finally {
    global.fetch = originalFetch;
  }
});

test('sendTelegramNotification validates chat ID and dispatches successfully', async () => {
  await assert.rejects(
    async () => {
      await sendTelegramNotification({ botToken: '123:abc', chatId: null, text: 'Hello' });
    },
    { message: /Telegram chat ID is required/ }
  );

  const originalFetch = global.fetch;
  try {
    let capturedUrl = null;
    let capturedBody = null;

    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ ok: true, result: {} }),
      };
    };

    const result = await sendTelegramNotification({
      botToken: 'dummy_token',
      chatId: '987654321',
      text: 'Test reminder',
    });

    assert.equal(result.success, true);
    assert(capturedUrl.includes('dummy_token'));
    assert.equal(capturedBody.chat_id, '987654321');
    assert.equal(capturedBody.text, 'Test reminder');
  } finally {
    global.fetch = originalFetch;
  }
});
