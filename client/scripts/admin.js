const quitLink = document.getElementById('quitLink');
const usersTableBody = document.querySelector('#usersTable tbody');
const editUserModal = document.getElementById('editUserModal');
const editUserClose = document.getElementById('editUserClose');
const editUserForm = document.getElementById('editUserForm');
const editLogin = document.getElementById('editLogin');
const editPassword = document.getElementById('editPassword');
const editRole = document.getElementById('editRole');
const viewTemplatesModal = document.getElementById('viewTemplatesModal');
const viewTemplatesClose = document.getElementById('viewTemplatesClose');
const searchTemplatesInput = document.getElementById('searchTemplatesInput');
const userTemplatesList = document.getElementById('userTemplatesList');

let currentUserId = null;

const loadUsers = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/users');
    const users = await response.json();
    renderUsers(users);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
};

const renderUsers = (users) => {
  usersTableBody.innerHTML = '';
  users.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.Id}</td>
      <td>${user.Login}</td>
      <td>${user.Role_id}</td>
      <td>
        <button class="edit-btn" onclick="openEditUserModal(${user.Id}, '${user.Login}', '${user.Role_id}')">Edit</button>
        <button class="delete-btn" onclick="openDeleteUserModal(${user.Id})">Delete</button>
        <button class="view-templates-btn" onclick="openViewTemplatesModal(${user.Id})">View Templates</button>
      </td>
    `;
    usersTableBody.appendChild(row);
  });
};

const openEditUserModal = (userId, login, roleId) => {
  currentUserId = userId;
  editLogin.value = login;
  editRole.value = roleId;
  editPassword.value = '';
  editUserModal.style.display = 'block';
};

const openDeleteUserModal = async (userId) => {
  if (confirm('Are you sure you want to delete this user?')) {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        loadUsers();
      } else {
        console.error('Error deleting user:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  }
};

// Open modal to view user's templates
const openViewTemplatesModal = async (userId) => {
  currentUserId = userId;
  try {
    const response = await fetch(`http://localhost:5000/api/users/${userId}/templates`);
    const templates = await response.json();
    renderTemplates(templates);
    viewTemplatesModal.style.display = 'block';
  } catch (error) {
    console.error('Error fetching user templates:', error);
  }
};

const renderTemplates = (templates) => {
  userTemplatesList.innerHTML = '';
  templates.forEach(template => {
    const listItem = document.createElement('li');
    listItem.innerHTML = `
      <span>${template.Title}</span>
      <button class="edit-btn" onclick="openEditTemplateModal(${template.Id}, '${template.Name}', '${template.Title}')">Edit</button>
      <button class="delete-btn" onclick="deleteTemplate(${template.Id})">Delete</button>
    `;
    userTemplatesList.appendChild(listItem);
  });
};

// Open modal to edit template
const openEditTemplateModal = (templateId, name, title) => {
  const editTemplateModal = document.createElement('div');
  editTemplateModal.classList.add('modal');
  editTemplateModal.innerHTML = `
    <div class="modal-content">
      <span class="close" onclick="closeModal(this)">&times;</span>
      <form id="editTemplateForm">
        <label for="editTemplateName">Name:</label>
        <input type="text" id="editTemplateName" value="${name}" required>
        
        <label for="editTemplateTitle">Title:</label>
        <input type="text" id="editTemplateTitle" value="${title}" required>
        
        <button type="submit" class="save-btn">Save</button>
      </form>
    </div>
  `;
  document.body.appendChild(editTemplateModal);

  const editTemplateForm = editTemplateModal.querySelector('#editTemplateForm');
  editTemplateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = document.getElementById('editTemplateName').value;
    const newTitle = document.getElementById('editTemplateTitle').value;

    try {
      const response = await fetch(`http://localhost:5000/api/templates/${templateId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Name: newName, Title: newTitle })
      });
      if (response.ok) {
        editTemplateModal.remove();
        openViewTemplatesModal(currentUserId);
      } else {
        console.error('Error updating template:', await response.text());
      }
    } catch (error) {
      console.error('Error updating template:', error);
    }
  });

  editTemplateModal.style.display = 'block';
};

// Delete template
const deleteTemplate = async (templateId) => {
  if (confirm('Are you sure you want to delete this template?')) {
    try {
      const response = await fetch(`http://localhost:5000/api/templates/${templateId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        openViewTemplatesModal(currentUserId);
      } else {
        console.error('Error deleting template:', await response.text());
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  }
};

editUserForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const login = editLogin.value;
  const password = editPassword.value;
  const roleId = editRole.value;

  try {
    const response = await fetch(`http://localhost:5000/api/users/${currentUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password, role_id: roleId })
    });
    if (response.ok) {
      editUserModal.style.display = 'none';
      loadUsers();
    } else {
      console.error('Error updating user:', await response.text());
    }
  } catch (error) {
    console.error('Error updating user:', error);
  }
});

editUserClose.addEventListener('click', () => {
  editUserModal.style.display = 'none';
});

viewTemplatesClose.addEventListener('click', () => {
  viewTemplatesModal.style.display = 'none';
});

quitLink.addEventListener('click', () => {
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
});

const closeModal = (modal) => {
  modal.closest('.modal').remove();
};

document.addEventListener('DOMContentLoaded', loadUsers);

searchTemplatesInput.addEventListener('input', (event) => {
  const searchTerm = event.target.value.toLowerCase();
  const templates = Array.from(userTemplatesList.children);
  templates.forEach(template => {
    const title = template.querySelector('span').textContent.toLowerCase();
    if (title.includes(searchTerm)) {
      template.style.display = '';
    } else {
      template.style.display = 'none';
    }
  });
});
