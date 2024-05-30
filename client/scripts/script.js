const sidebar = document.getElementById('sidebar');
const chatForm = document.getElementById('chatForm');
const mainContent = document.getElementById('main-content');
const quitLink = document.getElementById('quitLink');
const templateSelect = document.getElementById('templateSelect');
const selectTemplateBtn = document.getElementById('selectTemplateBtn');
const chatContainer = document.getElementById('chat_container');
const sessionList = document.getElementById('sessionList');

let currentSessionId = null;
let isAuthenticated = false;
let selectedTemplate = ""; // Переменная для хранения выбранного шаблона

function navigateTo(url) {
  window.location.href = url;
}

function logOut() {
  const userId = localStorage.getItem('userId');
  fetch('http://localhost:5000/logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  }).then(() => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userId');
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error('Error logging out:', error);
  });
}

const checkAuthAndLoadPage = async () => {
  const userId = localStorage.getItem('userId');
  if (userId) {
    const response = await fetch(`http://localhost:5000/check-auth?userId=${userId}`);
    const { isAuthenticated: authStatus } = await response.json();
    if (authStatus) {
      isAuthenticated = true;
      sidebar.style.display = 'block';
      mainContent.style.display = 'block';
      chatForm.style.display = 'block';
      await loadChatSessions(userId);
      await populateTemplateSelect();
    } else {
      navigateTo('login.html');
    }
  } else {
    navigateTo('login.html');
  }
};

window.addEventListener('load', checkAuthAndLoadPage);

const populateTemplateSelect = async () => {
  try {
    templateSelect.innerHTML = '';
    const userId = localStorage.getItem('userId');
    const response = await fetch(`/api/templates/${userId}`);
    const templates = await response.json();
    templates.forEach((template) => {
      const optionElem = document.createElement('option');
      optionElem.value = template.Name;
      optionElem.textContent = template.Title;
      templateSelect.appendChild(optionElem);
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
  }
};

selectTemplateBtn.addEventListener('click', () => {
  selectedTemplate = templateSelect.options[templateSelect.selectedIndex].text;
  alert(`You selected: ${selectedTemplate}`);
});

const createMessageElement = (isAi, message, uniqueId) => {
  const wrapper = document.createElement('div');
  wrapper.classList.add('wrapper');
  if (isAi) {
    wrapper.classList.add('ai');
  }
  const chat = document.createElement('div');
  chat.classList.add('chat');
  if (!isAi) {
    const profile = document.createElement('div');
    profile.classList.add('profile');
    chat.appendChild(profile);
  }
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message');
  if (uniqueId) {
    messageDiv.id = uniqueId;
  }
  messageDiv.innerText = message;
  chat.appendChild(messageDiv);
  wrapper.appendChild(chat);
  return wrapper;
};

const handleSubmit = async (e) => {
  e.preventDefault();
  const data = new FormData(chatForm);
  const prompt = data.get('prompt');
  const combinedPrompt = selectedTemplate ? `${prompt} ${selectedTemplate}` : prompt;

  chatContainer.appendChild(createMessageElement(false, prompt));
  chatForm.reset();

  const uniqueId = `id-${Date.now()}-${Math.random().toString(16).substr(2, 8)}`;
  chatContainer.appendChild(createMessageElement(true, '...', uniqueId));
  chatContainer.scrollTop = chatContainer.scrollHeight;

  const messageDiv = document.getElementById(uniqueId);
  messageDiv.innerHTML = '...';

  try {
    if (!currentSessionId) {
      currentSessionId = await createChatSession(localStorage.getItem('userId'));
    }

    const response = await fetch('http://localhost:5000', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: combinedPrompt,
        userId: localStorage.getItem('userId'),
        sessionId: currentSessionId
      })
    });
    if (response.ok) {
      const responseData = await response.json();
      const parsedData = responseData.bot.trim();
      messageDiv.innerHTML = parsedData;

      await saveChatHistory(localStorage.getItem('userId'), currentSessionId, prompt, false);
      await saveChatHistory(localStorage.getItem('userId'), currentSessionId, parsedData, true);

    } else {
      messageDiv.innerHTML = 'Something went wrong';
      alert(await response.text());
    }
  } catch (error) {
    console.error(error);
    messageDiv.innerHTML = 'Something went wrong';
    alert('Error in fetch operation');
  }
};

const createChatSession = async (userId) => {
  try {
    const response = await fetch('/api/chat-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    if (response.ok) {
      const { sessionId } = await response.json();
      chatForm.style.display = 'block';
      currentSessionId = sessionId;
      return sessionId;
    } else {
      console.error('Failed to create chat session');
    }
  } catch (err) {
    console.error('Error creating chat session:', err);
  }
};

const saveChatHistory = async (userId, sessionId, message, isAI) => {
  try {
    await fetch('/api/chat-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        sessionId: sessionId,
        message: message,
        isAI: isAI
      })
    });
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
};

const loadChatSessions = async (userId) => {
  try {
    const response = await fetch(`/api/chat-sessions/${userId}`);
    if (response.ok) {
      const sessions = await response.json();
      if (sessionList) {
        sessionList.innerHTML = '';
        sessions.forEach(({ SessionId, Timestamp }) => {
          const sessionLink = document.createElement('a');
          sessionLink.href = '#';
          sessionLink.textContent = `Session from ${new Date(Timestamp).toLocaleString()}`;
          sessionLink.onclick = async (e) => {
            e.preventDefault();
            await loadChatHistory(SessionId);
            chatForm.style.display = 'block';
            currentSessionId = SessionId;
          };
          sessionList.appendChild(sessionLink);

          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.onclick = async (e) => {
            e.preventDefault();
            await deleteChatSession(SessionId);
            await loadChatSessions(userId);
          };
          sessionList.appendChild(deleteButton);
        });
      } else {
        console.error('Session list element not found');
      }
    } else {
      console.error('Error loading chat sessions:', await response.text());
    }
  } catch (err) {
    console.error('Error loading chat sessions:', err);
  }
};

const loadChatHistory = async (sessionId) => {
  try {
    const response = await fetch(`/api/chat-history/${sessionId}`);
    if (response.ok) {
      const history = await response.json();
      chatContainer.innerHTML = '';
      history.forEach(({ Message, IsAI }) => {
        chatContainer.appendChild(createMessageElement(IsAI, Message));
      });
      chatContainer.appendChild(chatForm);
      chatContainer.scrollTop = chatContainer.scrollHeight;
      chatForm.style.display = 'block';
      currentSessionId = sessionId;
    } else {
      console.error('Error loading chat history:', await response.text());
    }
  } catch (err) {
    console.error('Error loading chat history:', err);
  }
};

const deleteChatSession = async (sessionId) => {
  try {
    const response = await fetch(`/api/chat-sessions/${sessionId}`, {
      method: 'DELETE',
    });

    if (response.ok) {
      console.log('Chat session deleted');
    } else {
      console.error('Error deleting chat session:', await response.text());
    }
  } catch (err) {
    console.error('Error deleting chat session:', err);
  }
};

chatForm.addEventListener('submit', handleSubmit);
chatForm.addEventListener('keyup', (e) => {
  if (e.keyCode === 13) {
    handleSubmit(e);
  }
});

quitLink.addEventListener('click', () => {
  logOut();
});
