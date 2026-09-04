const prompt = document.getElementById('prompt');
const composer = document.getElementById('composer');
const messages = document.getElementById('messages');
const attachButton = document.getElementById('attachButton');
const attachMenu = document.getElementById('attachMenu');
const fileInput = document.getElementById('fileInput');
const fileChips = document.getElementById('fileChips');
const thinkButton = document.getElementById('thinkButton');
const micButton = document.getElementById('micButton');

let history = [];
let files = [];
let busy = false;
let recognition = null;
let listening = false;

const botIcon = '<svg viewBox="0 0 24 24"><rect x="5" y="6" width="14" height="12" rx="3"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></svg>';
const userIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"/><path d="M5.5 20c.8-3.4 2.9-5 6.5-5s5.7 1.6 6.5 5"/></svg>';

function scrollDown(){
  requestAnimationFrame(() => {
    const area = document.getElementById('chatArea');
    if(area) area.scrollTop = area.scrollHeight;
  });
}

function addMessage(role, text){
  const row = document.createElement('div');
  row.className = `message ${role}`;
  row.innerHTML = `<div class="message-avatar">${role === 'user' ? userIcon : botIcon}</div><div class="bubble"></div>`;
  row.querySelector('.bubble').textContent = text;
  messages.appendChild(row);
  scrollDown();
}

function typing(){
  const row = document.createElement('div');
  row.id = 'typingMessage';
  row.className = 'message assistant';
  row.innerHTML = `<div class="message-avatar">${botIcon}</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  messages.appendChild(row);
  scrollDown();
}

function stopTyping(){
  document.getElementById('typingMessage')?.remove();
}

async function sendMessage(){
  if(busy) return;
  const text = prompt.value.trim();
  if(!text && !files.length) return;

  const shown = files.length
    ? `${text || 'Attached files'}\n\nFiles: ${files.map(f => f.name).join(', ')}`
    : text;

  addMessage('user', shown);
  history.push({role:'user', content:shown});
  prompt.value = '';
  files = [];
  fileInput.value = '';
  renderFiles();
  autoGrow();
  toggleAttach(false);

  busy = true;
  prompt.disabled = true;
  attachButton.disabled = true;
  typing();

  try{
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        messages: history,
        think: thinkButton.classList.contains('active')
      })
    });
    const data = await r.json().catch(() => ({}));
    if(!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
    const answer = String(data.text || '').trim();
    if(!answer) throw new Error('The AI returned no text.');
    history.push({role:'assistant', content:answer});
    stopTyping();
    addMessage('assistant', answer);
  }catch(error){
    stopTyping();
    addMessage('assistant', `Universal AI could not respond: ${error.message}`);
  }finally{
    busy = false;
    prompt.disabled = false;
    attachButton.disabled = false;
    prompt.focus();
  }
}

function autoGrow(){
  prompt.style.height = '34px';
  prompt.style.height = `${Math.min(prompt.scrollHeight,120)}px`;
}

function toggleAttach(force){
  const open = typeof force === 'boolean' ? force : !attachMenu.classList.contains('open');
  attachMenu.classList.toggle('open', open);
  attachMenu.setAttribute('aria-hidden', String(!open));
  attachButton.setAttribute('aria-expanded', String(open));
}

attachButton.addEventListener('click', e => {
  e.stopPropagation();
  if(!busy) toggleAttach();
});

document.addEventListener('click', e => {
  if(!attachMenu.contains(e.target) && e.target !== attachButton) toggleAttach(false);
});

attachMenu.querySelectorAll('[data-file-kind]').forEach(button => {
  button.addEventListener('click', () => {
    fileInput.accept = button.dataset.fileKind === 'image' ? 'image/*' : '';
    toggleAttach(false);
    fileInput.click();
  });
});

fileInput.addEventListener('change', () => {
  files = Array.from(fileInput.files || []);
  renderFiles();
});

function renderFiles(){
  fileChips.innerHTML = '';
  files.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = '<span></span><button type="button">×</button>';
    chip.querySelector('span').textContent = file.name;
    chip.querySelector('button').addEventListener('click', () => {
      files.splice(index,1);
      renderFiles();
    });
    fileChips.appendChild(chip);
  });
}

thinkButton.addEventListener('click', () => {
  const active = thinkButton.classList.toggle('active');
  thinkButton.setAttribute('aria-pressed', String(active));
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SpeechRecognition){
  recognition = new SpeechRecognition();
  recognition.lang = navigator.language || 'en-US';
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onstart = () => {
    listening = true;
    micButton.classList.add('recording');
    micButton.setAttribute('aria-pressed','true');
  };
  recognition.onresult = event => {
    let text = '';
    for(let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
    prompt.value = text;
    autoGrow();
  };
  recognition.onend = () => {
    listening = false;
    micButton.classList.remove('recording');
    micButton.setAttribute('aria-pressed','false');
    prompt.focus();
  };
  recognition.onerror = () => {
    listening = false;
    micButton.classList.remove('recording');
    micButton.setAttribute('aria-pressed','false');
  };
  micButton.addEventListener('click', () => listening ? recognition.stop() : recognition.start());
}

composer.addEventListener('submit', e => {
  e.preventDefault();
  sendMessage();
});

prompt.addEventListener('input', autoGrow);
prompt.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){
    e.preventDefault();
    sendMessage();
  }
});

autoGrow();
