import { expect } from 'chai';
import { createUser, getUserByCredentials, createChatSession, saveChatHistory, getChatSessions, getChatHistory, getTemplatesByUser, addTemplateForUser, updateTemplateForUser, deleteTemplateForUser } from './db.js';
import bcrypt from 'bcrypt';

describe('Управление пользователями', () => {
  it('Должен создать нового пользователя', async () => {
    const login = 'testuser';
    const password = 'Test@1234';
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await createUser(login, hashedPassword);
    expect(userId).to.be.a('number');
  });

  it('Не должен создать дублирующих пользователей', async () => {
    const login = 'testuser';
    const password = 'Test@1234';
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      await createUser(login, hashedPassword);
    } catch (err) {
      expect(err.message).to.include('User already exists');
    }
  });
});

describe('Управление сессиями чата', () => {
  let sessionId;
  let userId;

  before(async () => {
    const login = 'testuser2';
    const password = 'Test@1234';
    const hashedPassword = await bcrypt.hash(password, 10);
    userId = await createUser(login, hashedPassword);
  });

  it('Должен создать новую сессию чата', async () => {
    sessionId = await createChatSession(userId);
    expect(sessionId).to.be.a('number');
  });

  it('Должен сохранить историю чата', async () => {
    const message = 'Привет, как я могу помочь?';
    await saveChatHistory(sessionId, userId, message, false);
    const history = await getChatHistory(sessionId);
    expect(history).to.have.lengthOf(1);
    expect(history[0]).to.have.property('Message', message);
  });

  it('Должен получить сессии чата для пользователя', async () => {
    const sessions = await getChatSessions(userId);
    expect(sessions).to.have.lengthOf.at.least(1);
    expect(sessions[0]).to.have.property('SessionId', sessionId);
  });

  it('Должен получить историю чата для сессии', async () => {
    const history = await getChatHistory(sessionId);
    expect(history).to.have.lengthOf.at.least(1);
  });
});

describe('Управление шаблонами', () => {
  let userId;
  let templateId;

  before(async () => {
    const login = 'testuser3';
    const password = 'Test@1234';
    const hashedPassword = await bcrypt.hash(password, 10);
    userId = await createUser(login, hashedPassword);
  });

  it('Должен добавить шаблон для пользователя', async () => {
    const name = 'Пример шаблона';
    const title = 'Пример заголовка';
    const template = await addTemplateForUser(userId, name, title);
    templateId = template.Id;
    expect(template).to.have.property('Name', name);
    expect(template).to.have.property('Title', title);
  });

  it('Должен получить шаблоны по пользователю', async () => {
    const templates = await getTemplatesByUser(userId);
    expect(templates).to.have.lengthOf.at.least(1);
    expect(templates[0]).to.have.property('Name');
    expect(templates[0]).to.have.property('Title');
  });

  it('Должен обновить шаблон пользователя', async () => {
    const newName = 'Обновленный шаблон';
    const newTitle = 'Обновленный заголовок';
    const updatedTemplate = await updateTemplateForUser(templateId, newName, newTitle);
    expect(updatedTemplate).to.have.property('Name', newName);
    expect(updatedTemplate).to.have.property('Title', newTitle);
  });

  it('Должен удалить шаблон пользователя', async () => {
    await deleteTemplateForUser(templateId);
    const templates = await getTemplatesByUser(userId);
    const template = templates.find(t => t.Id === templateId);
    expect(template).to.be.undefined;
  });
});
