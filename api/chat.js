module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
  }

  try {
    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const think = Boolean(body.think);

    if (!messages.length) {
      return res.status(400).json({ error: 'No messages were provided.' });
    }

    const cleanedMessages = messages
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant'))
      .slice(-20)
      .map((message) => ({
        role: message.role,
        content: String(message.content || '').slice(0, 12000)
      }))
      .filter((message) => message.content.trim());

    if (!cleanedMessages.length) {
      return res.status(400).json({ error: 'No valid message content was provided.' });
    }

    const payload = {
      model: 'gpt-5.6-luna',
      store: false,
      instructions: 'You are Universal AI, the helpful assistant built into Universal Arcade. Be clear, friendly, concise, and useful. Help with games, websites, coding, school-safe questions, troubleshooting, and general knowledge. Do not claim to have performed actions you cannot perform.',
      input: cleanedMessages
    };

    if (think) {
      payload.reasoning = { effort: 'medium' };
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || 'OpenAI request failed.';
      return res.status(response.status).json({ error: message });
    }

    const outputText = typeof data.output_text === 'string'
      ? data.output_text.trim()
      : '';

    if (!outputText) {
      return res.status(502).json({ error: 'The AI returned an empty response.' });
    }

    return res.status(200).json({ text: outputText });
  } catch (error) {
    console.error('Universal AI error:', error);
    return res.status(500).json({ error: 'Unable to reach Universal AI right now.' });
  }
};
