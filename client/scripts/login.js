const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const showLoginLink = document.getElementById('showLogin');
const showRegisterLink = document.getElementById('showRegister');

document.addEventListener('DOMContentLoaded', () => {
  // By default, show the register form and hide the login form
  registerForm.style.display = 'block';
  loginForm.style.display = 'none';
});

showLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  registerForm.style.display = 'none';
  loginForm.style.display = 'block';
});

showRegisterLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.style.display = 'none';
  registerForm.style.display = 'block';
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(loginForm);
  const login = formData.get('login').trim();
  const password = formData.get('password').trim();

  if (!login || !password) {
    alert('Please fill in both fields.');
    return;
  }

  authorizeUser(login, password);
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(registerForm);
  const login = formData.get('login').trim();
  const password = formData.get('password').trim();

  if (!validateLogin(login) || !validatePassword(password)) {
    return;
  }

  registerUser(login, password);
});

const validateLogin = (login) => {
  const invalidChars = /[!?,*;]/;
  if (login.length < 8 || invalidChars.test(login)) {
    alert('Login must be at least 8 characters long and not contain special characters like !, ?, *, ;');
    return false;
  }
  return true;
};

const validatePassword = (password) => {
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!?,*;]/.test(password);
  if (password.length < 8 || !hasUpperCase || !hasNumber || !hasSpecialChar) {
    alert('Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character (!, ?, *, ;)');
    return false;
  }
  return true;
};

const authorizeUser = async (login, password) => {
  try {
    const response = await fetch('http://localhost:5000/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    if (response.ok) {
      const user = await response.json();
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userId', user.Id);
      if (user.Role_id === 2) { // Предположим, что роль администратора имеет id = 1
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'index.html';
      }
    } else {
      alert('Invalid credentials');
    }
  } catch (error) {
    console.error('Error authenticating:', error);
    alert('Error authenticating');
  }
};


const registerUser = async (login, password) => {
  try {
    const response = await fetch('http://localhost:5000/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    if (response.ok) {
      window.location.href = 'index.html';
    } else {
      const { message } = await response.json();
      alert(`Error registering: ${message}`);
    }
  } catch (error) {
    console.error('Error registering:', error);
    alert('Error registering');
  }
};
