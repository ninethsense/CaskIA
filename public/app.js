const messagesEl = document.getElementById('messages');
const form = document.getElementById('chatForm');
const input = document.getElementById('input');

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBold(text) {
  // escape HTML first, then convert **bold** -> <strong>bold</strong>
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

function addMessage(text, from = 'assistant') {
  const wrap = document.createElement('div');
  wrap.className = 'message ' + (from === 'user' ? 'user' : 'bot');
  wrap.innerHTML = formatForDisplay(text);
  messagesEl.appendChild(wrap);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function formatForDisplay(text) {
  // First, render bold safely
  let html = formatBold(text);

  // Normalize cases where numbered lists are inline like ": 1. A. 2. B."
  html = html.replace(/:\s*(?=\d+\.\s)/g, '\n');
  html = html.replace(/\.\s+(?=\d+\.\s)/g, '.\n');

  // If we have multiple lines, treat lines as potential list items
  const lines = html.split(/\n+/).map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    const allNumbered = lines.every(l => /^\d+\.\s+/.test(l));
    const allBulleted = lines.every(l => /^[-*•]\s+/.test(l));
    if (allNumbered) {
      return '<ol>' + lines.map(l => '<li>' + l.replace(/^\d+\.\s+/, '') + '</li>').join('') + '</ol>';
    }
    if (allBulleted) {
      return '<ul>' + lines.map(l => '<li>' + l.replace(/^[-*•]\s+/, '') + '</li>').join('') + '</ul>';
    }
  }

  // Handle inline numbered lists without newlines: find sequences like "1. a 2. b 3. c"
  const inlineItems = html.match(/\d+\.\s+([^]+?)(?=(?:\d+\.\s)|$)/g);
  if (inlineItems && inlineItems.length >= 2) {
    const items = inlineItems.map(i => i.replace(/^\d+\.\s+/, '').trim());
    return '<ol>' + items.map(i => '<li>' + i + '</li>').join('') + '</ol>';
  }

  // Fallback: convert double newlines to paragraphs, single newlines to <br>
  const paragraphs = html.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return '<p>' + paragraphs.map(p => p.replace(/\n/g, '<br>')).join('</p><p>') + '</p>';
  }

  return html.replace(/\n/g, '<br>');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  input.value = '';

  addMessage('Let me think...', 'bot');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    // remove the last 'Thinking...' message
    const last = messagesEl.querySelector('.message.bot:last-child');
    if (last && last.innerText === 'Thinking...') last.remove();

    if (data.reply) addMessage(data.reply, 'bot');
    else addMessage('Sorry, something went wrong.', 'bot');
  } catch (err) {
    console.error(err);
    addMessage('Network error. Try again later.', 'bot');
  }
});

// Greet
addMessage('Hi! I am CaskIA. Ask me anything you are curious about.', 'bot');
