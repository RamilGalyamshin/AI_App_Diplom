const userId = localStorage.getItem('userId');
const quitLink = document.getElementById('quitLink');
let templates = [];
let currentTemplateIndex = null;

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

const fetchTemplates = async () => {
  try {
    const response = await fetch(`/api/templates/${userId}`);
    const data = await response.json();
    templates = data;
    renderTemplates();
  } catch (error) {
    console.error('Error fetching templates:', error);
  }
};

const addTemplate = async (name, title) => {
  try {
    const response = await fetch('/api/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, Name: name, Title: title }),
    });
    const data = await response.json();
    templates.push(data);
    renderTemplates();
    closeModal();
  } catch (error) {
    console.error('Error adding template:', error);
  }
};

const updateTemplate = async (index, name, title) => {
  try {
    const templateId = templates[index].Id;
    const response = await fetch(`/api/templates/${templateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, Name: name, Title: title }),
    });
    if (response.ok) {
      const data = await response.json();
      templates[index] = data;
      renderTemplates();
      closeModal();
    } else {
      console.error('Error updating template:', response.statusText);
    }
  } catch (error) {
    console.error('Error updating template:', error);
  }
};

const deleteTemplate = async (index) => {
  try {
    const templateId = templates[index].Id;
    const response = await fetch(`/api/templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId }),
    });
    if (response.ok) {
      templates.splice(index, 1);
      renderTemplates();
    } else {
      console.error('Error deleting template:', response.statusText);
    }
  } catch (error) {
    console.error('Error deleting template:', error);
  }
};

const renderTemplates = () => {
  const templateList = document.getElementById('templateList');
  templateList.innerHTML = '';
  templates.forEach((template, index) => {
    const listItem = document.createElement('li');

    const templateTextDiv = document.createElement('div');
    templateTextDiv.classList.add('template-text');
    templateTextDiv.textContent = template.Title;
    listItem.appendChild(templateTextDiv);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.classList.add('buttons-container');

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.onclick = () => openModal(index);
    buttonsContainer.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => deleteTemplate(index);
    buttonsContainer.appendChild(deleteBtn);

    listItem.appendChild(buttonsContainer);
    templateList.appendChild(listItem);
  });

  filterTemplates();
};

const openModal = (index) => {
  currentTemplateIndex = index;
  const modal = document.getElementById('modal');
  const nameInput = document.getElementById('nameInput');
  const titleInput = document.getElementById('titleInput');
  if (index !== null) {
    const { Name, Title } = templates[index];
    nameInput.value = Name;
    titleInput.value = Title;
  } else {
    nameInput.value = '';
    titleInput.value = '';
  }
  modal.style.display = 'block';
};

const closeModal = () => {
  currentTemplateIndex = null;
  const modal = document.getElementById('modal');
  modal.style.display = 'none';
};

const filterTemplates = () => {
  const searchInput = document.getElementById('searchInput');
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const listItems = document.getElementById('templateList').getElementsByTagName('li');

  for (let i = 0; i < listItems.length; i++) {
    const listItem = listItems[i];
    const templateText = listItem.querySelector('.template-text').textContent.toLowerCase();

    if (templateText.includes(searchQuery)) {
      listItem.style.display = 'flex';
    } else {
      listItem.style.display = 'none';
    }
  }
};

document.addEventListener('DOMContentLoaded', fetchTemplates);

document.getElementById('addTemplateBtn').addEventListener('click', () => openModal(null));
document.getElementById('saveTemplateBtn').addEventListener('click', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('nameInput').value.trim();
  const titleInput = document.getElementById('titleInput').value.trim();
  if (nameInput && titleInput) {
    if (currentTemplateIndex === null) {
      await addTemplate(nameInput, titleInput);
    } else {
      await updateTemplate(currentTemplateIndex, nameInput, titleInput);
    }
  }
});

document.getElementById('cancelBtn').addEventListener('click', closeModal);
document.getElementsByClassName('close')[0].onclick = closeModal;

window.onclick = (event) => {
  if (event.target === document.getElementById('modal')) {
    closeModal();
  }
};

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', filterTemplates);
}
quitLink.addEventListener('click', () => {
  logOut();
});