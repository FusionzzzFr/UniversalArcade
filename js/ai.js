const prompt = document.getElementById('prompt');
const composer = document.getElementById('composer');
const sendButton = document.getElementById('sendButton');
const messages = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const newChat = document.getElementById('newChat');
const recentChats = document.getElementById('recentChats');

const botIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="6" width="14" height="12" rx="3"/><circle cx="9" cy="11.8" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="11.8" r="1" fill="currentColor" stroke="none"/><path d="M9.5 15h5M9 5V3.5M15 5V3.5"/></svg>';
const userIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-3.5 2.8-5.2 6.5-5.2s5.8 1.7 6.5 5.2"/></svg>';

function addMessage(role, text){
  welcome.style.display = 'none';
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

function removeTyping(){
  document.getElementById('typingMessage')?.remove();
}

function demoReply(text){
  const value = text.toLowerCase();
  if(value.includes('game')) return 'Absolutely. Tell me what kind of game you want to make and I can help plan the gameplay, UI, and code.';
  if(value.includes('website') || value.includes('html') || value.includes('css')) return 'I can help build that. Describe the layout and features you want, and we can turn it into a clean HTML, CSS, and JavaScript project.';
  if(value.includes('code')) return 'Sure. Send me what you are trying to build or the code you are working on, and I can help you fix or improve it.';
  return 'I’m ready to help. Universal AI is currently running in demo mode, so this page is set up for the real AI connection to be added next.';
}

function sendMessage(){
  const text = prompt.value.trim();
  if(!text) return;
  addMessage('user', text);
  prompt.value = '';
  autoGrow();
  sendButton.disabled = true;
  addTyping();
  setTimeout(() => {
    removeTyping();
    addMessage('assistant', demoReply(text));
    sendButton.disabled = false;
    prompt.focus();
  }, 650);
}

function autoGrow(){
  prompt.style.height = 'auto';
  prompt.style.height = `${Math.min(prompt.scrollHeight, 150)}px`;
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

document.querySelectorAll('.suggestion').forEach(button => {
  button.addEventListener('click', () => {
    prompt.value = button.textContent;
    autoGrow();
    prompt.focus();
  });
});

newChat.addEventListener('click', () => {
  messages.innerHTML = '';
  welcome.style.display = 'flex';
  prompt.value = '';
  autoGrow();
  prompt.focus();
});
