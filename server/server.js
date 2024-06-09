import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import OpenAI from 'openai';
import bcrypt from 'bcrypt';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  executeQuery,
  getUserByCredentials,
  createUser,
  createChatSession,
  saveChatHistory,
  getChatSessions,
  getChatHistory,
  deleteUserChatHistory,
  deleteUserChatSessions,
  deleteUserTemplates,
  deleteUser
} from './db.js';
import { proxy } from './proxy-settings.js'; // Импорт настроек прокси

dotenv.config();

const app = express();

app.use(morgan('dev'));
const corsOptions = {
  origin: 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());


// Функция для удаления данных пользователя
const deleteUserData = async (userId) => {
  try {
    await deleteUserChatHistory(userId);
    await deleteUserChatSessions(userId);
    await deleteUserTemplates(userId);
    await deleteUser(userId);
  } catch (error) {
    console.error('Error deleting user data:', error);
    throw error;
  }
};


// Создание агента прокси
const httpsAgent = new HttpsProxyAgent(proxy);

// Функция для выполнения запросов с использованием прокси
const fetchWithProxy = async (url, options) => {
  return axios({
    url,
    method: options.method,
    headers: options.headers,
    data: options.body,
    httpsAgent,
  });
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: fetchWithProxy,
})

app.get('/', (req, res) => {
  res.status(200).send({ message: 'Hello from CodeX!' });
});

const isValidLogin = (login) => {
  const invalidChars = /[!?,*;]/;
  return login.length >= 8 && !invalidChars.test(login);
};

const isValidPassword = (password) => {
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!?,*;]/.test(password);
  return password.length >= 8 && hasUpperCase && hasNumber && hasSpecialChar;
};

// Авторизация
app.post('/login', async (req, res) => {
  const { login, password } = req.body;
  console.log('Login attempt:', login);
  try {
    const user = await getUserByCredentials(login.trim());
    if (user) {
      console.log('User found:', user);
      const passwordMatch = await bcrypt.compare(password.trim(), user.Password.trim());
      if (passwordMatch) {
        await executeQuery('UPDATE Users SET IsAuthenticated = 1 WHERE Id = @Id', { Id: user.Id });
        res.status(200).json(user);
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error authenticating:', error);
    res.status(500).json({ error: 'Error authenticating' });
  }
});

// Регистрация
app.post('/register', async (req, res) => {
  const { login, password } = req.body;
  try {
    if (!isValidLogin(login)) {
      return res.status(400).json({ message: 'Login must be at least 8 characters long and not contain special characters like !, ?, *, ;' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter, one number, and one special character (!, ?, *, ;)' });
    }

    const existingUser = await getUserByCredentials(login.trim());
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password.trim(), 10);
    const userId = await createUser(login.trim(), hashedPassword);
    res.status(200).json({ userID: userId });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Проверка авторизации
app.get('/check-auth', async (req, res) => {
  const userId = req.query.userId;
  try {
    const result = await executeQuery('SELECT IsAuthenticated FROM Users WHERE Id = @Id', { Id: userId });
    const isAuthenticated = result[0].IsAuthenticated;
    res.status(200).json({ isAuthenticated });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ error: 'Error checking auth status' });
  }
});

// Выход из системы
app.post('/logout', async (req, res) => {
  const userId = req.body.userId;
  try {
    await executeQuery('UPDATE Users SET IsAuthenticated = 0 WHERE Id = @Id', { Id: userId });
    res.sendStatus(200);
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: 'Error logging out' });
  }
});

// Административные маршруты
app.get('/api/users', async (req, res) => {
  try {
    const users = await executeQuery('SELECT Id, Login, Password, Role_id FROM Users');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Error fetching users' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { login, password, role_id } = req.body;
  try {
    let updateQuery = 'UPDATE Users SET Login = @Login, Role_id = @Role_id';
    const params = { Login: login, Role_id: role_id, Id: id };
    
    if (password) {
      const hashedPassword = await bcrypt.hash(password.trim(), 10);
      updateQuery += ', Password = @Password';
      params.Password = hashedPassword;
    }
    
    updateQuery += ' WHERE Id = @Id';
    
    await executeQuery(updateQuery, params);
    const updatedUser = await executeQuery('SELECT Id, Login, Role_id FROM Users WHERE Id = @Id', { Id: id });
    res.json(updatedUser[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Error updating user' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteUserData(id);
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Error deleting user' });
  }
});
app.get('/api/users/:id/templates', async (req, res) => {
  const { id } = req.params;
  try {
    const templates = await executeQuery(
      'SELECT t.Id, t.Name, t.Title FROM Template t JOIN Users_has_template uht ON t.Id = uht.Template_id WHERE uht.User_id = @UserId',
      { UserId: id }
    );
    res.json(templates);
  } catch (error) {
    console.error('Error fetching user templates:', error);
    res.status(500).json({ error: 'Error fetching user templates' });
  }
});

// Получение шаблонов пользователя с возможностью фильтрации по title
app.get('/api/templates/:userId', async (req, res) => {
  const { userId } = req.params;
  const { search } = req.query; // Получение параметра поиска из запроса
  try {
    let query = `
      SELECT t.Id, t.Name, t.Title 
      FROM Template t
      JOIN Users_has_template uht ON t.Id = uht.Template_id
      WHERE uht.User_id = @UserId
    `;
    const params = { UserId: userId };

    if (search) {
      query += ' AND t.Title LIKE @Search';
      params.Search = `%${search}%`;
    }

    const templates = await executeQuery(query, params);
    res.json(templates);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Error fetching templates' });
  }
});

// Создание шаблона
app.post('/api/templates', async (req, res) => {
  const { userId, Name, Title } = req.body;
  try {
    const insertTemplateQuery = "INSERT INTO Template (Name, Title) OUTPUT INSERTED.ID VALUES (@Name, @Title)";
    const result = await executeQuery(insertTemplateQuery, { Name, Title });
    const newTemplateId = result[0].ID;

    const linkUserTemplateQuery = "INSERT INTO Users_has_template (User_id, Template_id) VALUES (@UserId, @TemplateId)";
    await executeQuery(linkUserTemplateQuery, { UserId: userId, TemplateId: newTemplateId });

    const newTemplate = await executeQuery("SELECT * FROM Template WHERE Id = @Id", { Id: newTemplateId });
    res.json(newTemplate[0]);
  } catch (err) {
    console.error('Error adding template:', err);
    res.status(500).json({ error: 'Error adding template' });
  }
});

// Обновление шаблона
app.put('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  const { Name, Title } = req.body;
  try {
    const updateQuery = "UPDATE Template SET Name = @Name, Title = @Title WHERE Id = @Id";
    await executeQuery(updateQuery, { Name, Title, Id: id });
    const updatedTemplate = await executeQuery("SELECT * FROM Template WHERE Id = @Id", { Id: id });
    res.json(updatedTemplate[0]);
  } catch (err) {
    console.error('Error updating template:', err);
    res.status(500).json({ error: 'Error updating template' });
  }
});

// Удаление шаблона
app.delete('/api/templates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const deleteLinkQuery = `DELETE FROM Users_has_template WHERE Template_id = ${id}`;
    await executeQuery(deleteLinkQuery);
    const deleteQuery = `DELETE FROM Template WHERE Id = ${id}`;
    await executeQuery(deleteQuery);
    res.sendStatus(204);
  } catch (err) {
    console.error('Error deleting template:', err);
    res.status(500).json({ error: 'Error deleting template' });
  }
});

// Чат-сессии и история
app.post('/api/chat-session', async (req, res) => {
  const { userId } = req.body;
  try {
    const sessionId = await createChatSession(userId);
    res.json({ sessionId });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Error creating chat session' });
  }
});

app.get('/api/chat-sessions/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const sessions = await getChatSessions(userId);
    res.json(sessions);
  } catch (error) {
    console.error('Error getting chat sessions:', error);
    res.status(500).json({ error: 'Error getting chat sessions' });
  }
});

app.get('/api/chat-history/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const history = await getChatHistory(sessionId);
    res.json(history);
  } catch (error) {
    console.error('Error getting chat history:', error);
    res.status(500).json({ error: 'Error getting chat history' });
  }
});

app.delete('/api/chat-sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    await executeQuery('DELETE FROM ChatHistory WHERE SessionId = @SessionId', { SessionId: sessionId });
    await executeQuery('DELETE FROM ChatSessions WHERE SessionId = @SessionId', { SessionId: sessionId });
    res.sendStatus(204);
  } catch (error) {
    console.error('Error deleting chat session:', error);
    res.status(500).json({ error: 'Error deleting chat session' });
  }
});

app.post('/api/chat-history', async (req, res) => {
  const { userId, sessionId, message, isAI } = req.body;
  try {
    await saveChatHistory(sessionId, userId, message, isAI);
    res.sendStatus(201);
  } catch (error) {
    console.error('Error saving chat message:', error);
    res.status(500).json({ error: 'Error saving chat message' });
  }
});

app.post('/', async (req, res) => {
  const { prompt, userId, sessionId } = req.body;
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4", 
      messages: [{ role: "system", content: "You are a helpful assistant." }, { role: "user", content: prompt }],
      temperature: 1,
      max_tokens: 8000, 
    }, { httpsAgent, headers: { 'Authorization': `Bearer ${openai.apiKey}` } });
    const botResponse = response.data.choices[0].message.content.trim();
    await saveChatHistory(sessionId, userId, prompt, false);
    await saveChatHistory(sessionId, userId, botResponse, true);
    res.status(200).send({ bot: botResponse });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).send(error.response.data || 'Something went wrong');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
