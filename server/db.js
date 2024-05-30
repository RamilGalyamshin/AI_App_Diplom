import mssql from 'mssql';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();
const config = {
  user: 'sa',
  password: 'sa',
  server: 'DESKTOP-AU8QKQI',
  database: 'ai_base',
  options: {
    trustServerCertificate: true
  }
};

let pool;

const connectToDb = async () => {
  try {
    pool = await new mssql.ConnectionPool(config).connect();
    console.log('Connected to SQL Server');
  } catch (err) {
    console.error('Database Connection Failed! Bad Config: ', err);
  }
};

connectToDb();
const computeMessageHash = (message) => {
  return crypto.createHash('sha256').update(message, 'utf8').digest('hex');
};
export const executeQuery = async (query, params) => {
  if (!pool) {
    console.error('Database connection not established');
    return;
  }

  try {
    const request = pool.request();

    if (params) {
      Object.keys(params).forEach((key) => {
        request.input(key, params[key]);
      });
    }

    const result = await request.query(query);
    return result.recordset;
  } catch (err) {
    console.error('Error executing query:', err);
    throw err;
  }
};

export const getUserByCredentials = async (login) => {
  if (!pool) {
    console.error('Database connection not established');
    return null;
  }

  try {
    const result = await pool.request()
      .input('login', mssql.NVarChar, login)
      .query('SELECT * FROM Users WHERE Login = @login');

    return result.recordset[0] || null;
  } catch (err) {
    console.error('Error executing query:', err);
    throw err;
  }
};
export const createUser = async (login, hashedPassword) => {
  try {
    const result = await executeQuery(
      `INSERT INTO Users (Login, Password, Role_id) OUTPUT INSERTED.ID VALUES (@Login, @Password, 1)`, // 1 - обычный пользователь
      { Login: login, Password: hashedPassword }
    );
    if (result[0]) {
      return result[0].ID;
    } else {
      console.error('User not created, result is:', result);
      return null;
    }
  } catch (err) {
    console.error('Error creating user:', err);
    throw err;
  }
};

export const createChatSession = async (userId) => {
  try {
    const result = await executeQuery(
      'INSERT INTO ChatSessions (UserId) OUTPUT INSERTED.SessionId VALUES (@UserId)',
      { UserId: userId }
    );
    if (result[0]) {
      return result[0].SessionId;
    } else {
      console.error('Chat session not created, result is:', result);
      return null;
    }
  } catch (err) {
    console.error('Error creating chat session:', err);
    throw err;
  }
};

export const saveChatHistory = async (sessionId, userId, message, isAI) => {
  try {
    // Attempt to insert the new record
    await executeQuery(
      `INSERT INTO ChatHistory (SessionId, UserId, Message, IsAI) VALUES (@SessionId, @UserId, @Message, @IsAI)`,
      { SessionId: sessionId, UserId: userId, Message: message, IsAI: isAI }
    );
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY' || err.number === 2627) { // SQL Server unique constraint violation number
      // Duplicate record found, skipping insertion
      console.log('Duplicate record found, skipping insertion');
    } else {
      // Re-throw the error if it's not a duplicate entry error
      console.error('Error saving chat history:', err);
      throw err;
    }
  }
};
export const getChatSessions = async (userId) => {
  try {
    const result = await executeQuery(
      'SELECT * FROM ChatSessions WHERE UserId = @UserId ORDER BY Timestamp DESC',
      { UserId: userId }
    );
    return result;
  } catch (err) {
    console.error('Error getting chat sessions:', err);
    throw err;
  }
};

export const getChatHistory = async (sessionId) => {
  try {
    return await executeQuery(
      `SELECT * FROM ChatHistory WHERE SessionId = @SessionId ORDER BY Timestamp ASC`,
      { SessionId: sessionId }
    );
  } catch (err) {
    console.error('Error getting chat history:', err);
    throw err;
  }
};
// Методы для работы с шаблонами пользователя
export const getTemplatesByUser = async (userId) => {
  try {
    const query = `
      SELECT t.Id, t.Name, t.Title 
      FROM Template t
      JOIN Users_has_template uht ON t.Id = uht.Template_id
      WHERE uht.User_id = @UserId
    `;
    const result = await executeQuery(query, { UserId: userId });
    return result;
  } catch (err) {
    console.error('Error fetching templates:', err);
    throw err;
  }
};
export const addTemplateForUser = async (userId, name, title) => {
  try {
    const insertTemplateQuery = "INSERT INTO Template (Name, Title) OUTPUT INSERTED.ID VALUES (@Name, @Title)";
    const result = await executeQuery(insertTemplateQuery, { Name: name, Title: title });
    const newTemplateId = result[0].ID;

    const linkUserTemplateQuery = "INSERT INTO Users_has_template (User_id, Template_id) VALUES (@UserId, @TemplateId)";
    await executeQuery(linkUserTemplateQuery, { UserId: userId, TemplateId: newTemplateId });

    const newTemplate = await executeQuery("SELECT * FROM Template WHERE Id = @Id", { Id: newTemplateId });
    return newTemplate[0];
  } catch (err) {
    console.error('Error adding template:', err);
    throw err;
  }
};

export const updateTemplateForUser = async (templateId, name, title) => {
  try {
    const updateQuery = "UPDATE Template SET Name = @Name, Title = @Title WHERE Id = @Id";
    await executeQuery(updateQuery, { Name: name, Title: title, Id: templateId });
    const updatedTemplate = await executeQuery("SELECT * FROM Template WHERE Id = @Id", { Id: templateId });
    return updatedTemplate[0];
  } catch (err) {
    console.error('Error updating template:', err);
    throw err;
  }
};

export const deleteTemplateForUser = async (templateId) => {
  try {
    const deleteLinkQuery = `DELETE FROM Users_has_template WHERE Template_id = ${templateId}`;
    await executeQuery(deleteLinkQuery);
    const deleteQuery = `DELETE FROM Template WHERE Id = ${templateId}`;
    await executeQuery(deleteQuery);
  } catch (err) {
    console.error('Error deleting template:', err);
    throw err;
  }
};