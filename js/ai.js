const prompt = document.getElementById('prompt');
const composer = document.getElementById('composer');
const sendButton = document.getElementById('sendButton');
const messages = document.getElementById('messages');
const attachButton = document.getElementById('attachButton');
const attachMenu = document.getElementById('attachMenu');
const fileInput = document.getElementById('fileInput');
const fileChips = document.getElementById('fileChips');
const thinkButton = document.getElementById('thinkButton');
const micButton = document.getElementById('micButton');

let selectedFiles = [];
let recognition = null;
let listening = false;

const botIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="6" width="14" height="12" rx="3"/><circle cx="9" cy="11.8" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="11.8" r="1" fill="currentColor" stroke="none"/><path d="M9.5 15h5M9 5V3.5M15 5V3.5"/></svg>';
const userIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-3.5 2.8-5.2 6.5-5.2s5.8 1.7 6.5 5.2"/></svg>';

function addMessage(role, text){
  const row = document.createElement('div');
  row.className = `message ${role}`;
  row.innerHTML = `<div class="message-avatar">${role === 'user' ? userIcon : botIcon}</div><div class="bubble"></div>`;
  row.querySelector('.bubble').textContent = text;
  messages.appendChild(row);
  requestAnimationFrame(() => messages.parentElement.scrollTop = messages.parentElement.scrollHeight);
}

function addTyping(){
  const row = document.createElement('div');
  row.className = 'message assistant';
  row.id = 'typingMessage';
  row.innerHTML = `<div class="message-avatar">${botIcon}</div><div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>`;
  messages.appendChild(row);
  requestAnimationFrame(() => messages.parentElement.scrollTop = messages.parentElement.scrollHeight);
}

function removeTyping(){ document.getElementById('typingMessage')?.remove(); }

function demoReply(text){
  const value = text.toLowerCase();
  const suffix = thinkButton.classList.contains('active') ? ' Think mode is enabled for this request.' : '';
  if(value.includes('game')) return 'Absolutely. Tell me what kind of game you want to make and I can help plan the gameplay, UI, and code.' + suffix;
  if(value.includes('website') || value.includes('html') || value.includes('css')) return 'I can help build that. Describe the layout and features you want, and we can turn it into a clean HTML, CSS, and JavaScript project.' + suffix;
  if(value.includes('code')) return 'Sure. Send me what you are trying to build or the code you are working on, and I can help you fix or improve it.' + suffix;
  return 'I’m ready to help. Universal AI is currently running in demo mode, so this page is set up for the real AI connection to be added next.' + suffix;
}

function sendMessage(){
  const text = prompt.value.trim();
  if(!text && !selectedFiles.length) return;
  let visibleText = text;
  if(selectedFiles.length){
    const names = selectedFiles.map(file => file.name).join(', ');
    visibleText = `${text || 'Attached files'}\n\nFiles: ${names}`;
  }
  addMessage('user', visibleText);
  prompt.value = '';
  selectedFiles = [];
  renderFiles();
  autoGrow();
  sendButton.disabled = true;
  addTyping();
  setTimeout(() => {
    removeTyping();
    addMessage('assistant', demoReply(text || 'file upload'));
    sendButton.disabled = false;
    prompt.focus();
  }, 650);
}

function autoGrow(){
  prompt.style.height = '40px';
  prompt.style.height = `${Math.min(prompt.scrollHeight, 150)}px`;
}

function toggleAttachMenu(force){
  const open = typeof force === 'boolean' ? force : !attachMenu.classList.contains('open');
  attachMenu.classList.toggle('open', open);
  attachMenu.setAttribute('aria-hidden', String(!open));
  attachButton.setAttribute('aria-expanded', String(open));
}

attachButton.addEventListener('click', e => {
  e.stopPropagation();
  toggleAttachMenu();
});

document.addEventListener('click', e => {
  if(!attachMenu.contains(e.target) && e.target !== attachButton) toggleAttachMenu(false);
});

attachMenu.querySelectorAll('[data-file-kind]').forEach(button => {
  button.addEventListener('click', () => {
    const kind = button.dataset.fileKind;
    fileInput.accept = kind === 'image' ? 'image/*' : '';
    toggleAttachMenu(false);
    fileInput.click();
  });
});

fileInput.addEventListener('change', () => {
  selectedFiles = Array.from(fileInput.files || []);
  renderFiles();
});

function renderFiles(){
  fileChips.innerHTML = '';
  selectedFiles.forEach((file, index) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.8h7l4 4V20H7zM14 3.8V8h4"/></svg><span title="${file.name.replace(/"/g,'&quot;')}">${file.name}</span><button type="button" aria-label="Remove ${file.name}">×</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      selectedFiles.splice(index, 1);
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
    micButton.setAttribute('aria-pressed', 'true');
    micButton.setAttribute('aria-label', 'Stop voice dictation');
  };

  recognition.onresult = event => {
    let transcript = '';
    for(let i = event.resultIndex; i < event.results.length; i++) transcript += event.results[i][0].transcript;
    prompt.value = transcript;
    autoGrow();
  };

  recognition.onend = () => {
    listening = false;
    micButton.classList.remove('recording');
    micButton.setAttribute('aria-pressed', 'false');
    micButton.setAttribute('aria-label', 'Voice dictation');
    prompt.focus();
  };

  recognition.onerror = () => {
    listening = false;
    micButton.classList.remove('recording');
    micButton.setAttribute('aria-pressed', 'false');
    micButton.setAttribute('aria-label', 'Voice dictation');
  };

  micButton.addEventListener('click', () => {
    if(listening) recognition.stop();
    else recognition.start();
  });
}else{
  micButton.title = 'Voice dictation is not supported in this browser';
  micButton.addEventListener('click', () => micButton.classList.add('unsupported'));
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
