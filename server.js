const express = require('express');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const conversations = new Map();

app.use(cookieParser());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/chat', async (req, res) => {
  try {
    let sessionId = req.cookies.sessionId;
    if (!sessionId) {
      sessionId = uuidv4();
      res.cookie('sessionId', sessionId, { httpOnly: false, maxAge: 24 * 60 * 60 * 1000 });
    }

    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    const convo = conversations.get(sessionId) || [];
    convo.push({ role: 'user', content: message });

    const system = {
      role: 'system',
      content:
        "You are CaskIA, a friendly chat assistant for kids aged 8-14. Use simple language, short sentences, a cheerful tone, avoid adult topics, and ask clarifying questions when helpful. If a user asks about something unsafe, respond with a gentle refusal and suggest a safe alternative."
    };

    const messages = [system, ...convo];

    const reply = await callGitHubModel(messages);

    convo.push({ role: 'assistant', content: reply });
    conversations.set(sessionId, convo);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  }
});

async function callGitHubModel(messages) {
  const GITHUB_API_URL = process.env.GITHUB_API_URL;
  const token = process.env.GITHUB_API_TOKEN;
  const model = process.env.GITHUB_MODEL || 'gpt-4o-mini';

  if (!GITHUB_API_URL || !token) {
    // Return a mock response so the app is testable without a configured GitHub AI endpoint.
    const lastUser = messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    return `Hi! I'm CaskIA. You said: "${lastUser}". (This is a mock reply because GITHUB_API_URL or GITHUB_API_TOKEN is not configured.)`;
  }

  const payload = { model, messages };

  const resp = await fetch(GITHUB_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('GitHub API response status:', resp.status);
    console.error('GitHub API response body:', text);
    throw new Error(`GitHub API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();

  // Best-effort extraction for common shapes returned by AI APIs.
  if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content;
  if (data.output_text) return data.output_text;
  if (data.result) return data.result;

  return JSON.stringify(data);
}

app.listen(PORT, () => {
  console.log(`CaskIA server listening on http://localhost:${PORT}`);
});
