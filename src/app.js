const form = document.getElementById('expenseForm');
const list = document.getElementById('expensesList');
const totalValue = document.getElementById('totalValue');
const countValue = document.getElementById('countValue');
const largestValue = document.getElementById('largestValue');
const feedback = document.getElementById('feedback');
const expenseDateInput = document.getElementById('expenseDate');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const authForm = document.getElementById('authForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authFeedback = document.getElementById('authFeedback');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const recoveryEmail = document.getElementById('recoveryEmail');
const logoutBtn = document.getElementById('logoutBtn');
const expenseSection = document.getElementById('expenseSection');
const authPanel = document.getElementById('authPanel');
const authView = document.getElementById('authView');
const appView = document.getElementById('appView');

let pollTimer = null;
let activeTable = 'expenses';
const candidateTables = ['expenses', 'simple_requests', 'requests'];

function getApiBaseUrl() {
  return window.__APP_CONFIG__?.apiBaseUrl || 'http://127.0.0.1:8000';
}

function buildApiHeaders() {
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.style.color = isError ? '#ffb3b3' : '#8de9c8';
}

function setAuthFeedback(message, isError = false) {
  authFeedback.textContent = message;
  authFeedback.style.color = isError ? '#ffb3b3' : '#8de9c8';
}

function normalizeExpense(item) {
  return item;
}

function getSupabaseClient() {
  return window.supabaseClient || null;
}

function isSupabaseReady(client = getSupabaseClient()) {
  return Boolean(client && client.auth && typeof client.auth.getSession === 'function');
}

function getLocalStorageKey(prefix, userId = '') {
  return `finance-app:${prefix}${userId ? `:${userId}` : ''}`;
}

function getLocalUser() {
  try {
    const stored = localStorage.getItem(getLocalStorageKey('current-user'));
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.warn('Não foi possível ler o usuário local.', error);
    return null;
  }
}

function setLocalUser(user) {
  try {
    localStorage.setItem(getLocalStorageKey('current-user'), JSON.stringify(user));
  } catch (error) {
    console.warn('Não foi possível salvar o usuário local.', error);
  }
}

function clearLocalUser() {
  localStorage.removeItem(getLocalStorageKey('current-user'));
}

function getLocalUsers() {
  try {
    const stored = localStorage.getItem(getLocalStorageKey('users'));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Não foi possível ler os usuários locais.', error);
    return [];
  }
}

function setLocalUsers(users) {
  try {
    localStorage.setItem(getLocalStorageKey('users'), JSON.stringify(users));
  } catch (error) {
    console.warn('Não foi possível salvar os usuários locais.', error);
  }
}

function getLocalExpenses(userId) {
  try {
    const stored = localStorage.getItem(getLocalStorageKey('expenses', userId));
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.warn('Não foi possível ler os gastos locais.', error);
    return [];
  }
}

function setLocalExpenses(userId, expenses) {
  try {
    localStorage.setItem(getLocalStorageKey('expenses', userId), JSON.stringify(expenses));
  } catch (error) {
    console.warn('Não foi possível salvar os gastos locais.', error);
  }
}

async function hashPassword(password) {
  const data = new TextEncoder().encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function getCurrentUser(client = getSupabaseClient()) {
  if (isSupabaseReady(client)) {
    try {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) throw error;
      return session?.user ?? null;
    } catch (error) {
      console.warn('Não foi possível obter o usuário atual.', error);
      return null;
    }
  }

  return getLocalUser();
}

async function ensureUserProfile(client) {
  const user = await getCurrentUser(client);
  if (!user) return;

  if (!isSupabaseReady(client)) return;

  const { error } = await client.from('profiles').upsert(
    { id: user.id, email: user.email },
    { onConflict: 'id' }
  );

  if (error) throw error;
}

async function fetchExpenses() {
  const client = getSupabaseClient();
  const user = await getCurrentUser(client);
  if (!user) {
    return [];
  }

  if (!isSupabaseReady(client)) {
    return getLocalExpenses(user.id);
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/expenses?user_id=${user.id}`, {
      headers: buildApiHeaders()
    });

    if (!response.ok) {
      throw new Error(`Falha ao consultar a API (${response.status})`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('Falha ao ler via API local', error);
  }

  if (client) {
    for (const tableName of [activeTable, ...candidateTables.filter((table) => table !== activeTable)]) {
      try {
        const { data, error } = await client.from(tableName).select('*').eq('user_id', user.id);
        if (!error) {
          activeTable = tableName;
          return data || [];
        }
      } catch (error) {
        console.warn(`Falha ao ler ${tableName} via cliente Supabase`, error);
      }
    }
  }

  throw new Error('Não foi possível ler os dados do Supabase.');
}

async function saveExpense(payload) {
  const client = getSupabaseClient();
  const user = await getCurrentUser(client);
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  const payloadWithUser = { ...payload, user_id: user.id, id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}` };

  if (!isSupabaseReady(client)) {
    const expenses = getLocalExpenses(user.id);
    expenses.push(payloadWithUser);
    setLocalExpenses(user.id, expenses);
    return [payloadWithUser];
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/expenses`, {
      method: 'POST',
      headers: buildApiHeaders(),
      body: JSON.stringify(payloadWithUser)
    });

    if (!response.ok) {
      throw new Error(`Falha ao salvar via API (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Falha ao salvar via API local', error);
  }

  if (client) {
    try {
      const { data, error } = await client.from(activeTable).insert(payloadWithUser).select();
      if (!error) return data || [];
    } catch (error) {
      console.warn('Falha ao salvar via cliente Supabase', error);
    }
  }

  throw new Error('Não foi possível salvar no Supabase.');
}

async function deleteExpense(id) {
  const client = getSupabaseClient();
  const user = await getCurrentUser(client);
  if (!user) {
    throw new Error('Usuário não autenticado');
  }

  if (!isSupabaseReady(client)) {
    const expenses = getLocalExpenses(user.id).filter((item) => String(item.id) !== String(id));
    setLocalExpenses(user.id, expenses);
    return true;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/expenses/${id}?user_id=${user.id}`, {
      method: 'DELETE',
      headers: buildApiHeaders()
    });

    if (!response.ok) {
      throw new Error(`Falha ao excluir via API (${response.status})`);
    }

    return true;
  } catch (error) {
    console.warn('Falha ao excluir via API local', error);
  }

  if (client) {
    try {
      const { error } = await client.from(activeTable).delete().eq('id', id).eq('user_id', user.id);
      if (!error) return true;
    } catch (error) {
      console.warn('Falha ao excluir via cliente Supabase', error);
    }
  }

  throw new Error('Não foi possível excluir do Supabase.');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderExpenses(expenses) {
  countValue.textContent = expenses.length;
  const total = expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0);
  const largest = expenses.length ? Math.max(...expenses.map((item) => Number(item.amount || 0))) : 0;

  totalValue.textContent = formatCurrency(total);
  largestValue.textContent = formatCurrency(largest);

  if (!expenses.length) {
    list.innerHTML = '<div class="empty-state">Nenhum gasto cadastrado ainda. Adicione o primeiro.</div>';
    return;
  }

  list.innerHTML = expenses
    .map((expense) => `
      <article class="expense-item">
        <div class="expense-main">
          <strong>${escapeHtml(expense.description || '')}</strong>
          <div class="expense-meta">${escapeHtml(expense.category || '')} • ${escapeHtml(new Date(expense.expense_date).toLocaleDateString('pt-BR'))}</div>
          ${expense.notes ? `<div class="expense-meta">${escapeHtml(expense.notes)}</div>` : ''}
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <span class="amount-badge">${formatCurrency(expense.amount)}</span>
          <button class="remove-btn" data-id="${expense.id}">Excluir</button>
        </div>
      </article>
    `)
    .join('');
}

async function loadExpenses() {
  const client = getSupabaseClient();
  const user = await getCurrentUser(client);
  if (!user) {
    renderExpenses([]);
    setFeedback('');
    return;
  }

  try {
    const data = await fetchExpenses();
    const expenses = Array.isArray(data) ? data.map((item) => normalizeExpense(item)) : [];
    renderExpenses(expenses);
    setFeedback(`Carregados ${expenses.length} gastos.`);
  } catch (error) {
    setFeedback(`Não foi possível carregar os gastos. ${error.message || 'Verifique a conexão com o Supabase.'}`, true);
    console.error(error);
  }
}

function startPolling() {
  if (pollTimer) return;

  pollTimer = window.setInterval(() => {
    loadExpenses();
  }, 5000);
}

async function handleAuth(mode) {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const client = getSupabaseClient();

  if (!email || !password) {
    setAuthFeedback('Preencha e-mail e senha.', true);
    return;
  }

  try {
    if (!isSupabaseReady(client)) {
      const hashedPassword = await hashPassword(password);
      const users = getLocalUsers();

      if (mode === 'signup') {
        if (users.some((user) => user.email.toLowerCase() === email.toLowerCase())) {
          setAuthFeedback('Este e-mail já está cadastrado no modo local.', true);
          return;
        }

        const newUser = {
          id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
          email,
          passwordHash: hashedPassword
        };

        users.push(newUser);
        setLocalUsers(users);
        setLocalUser(newUser);
        setAuthFeedback('Conta criada com sucesso no modo local.');
      } else {
        const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());
        if (!user || user.passwordHash !== hashedPassword) {
          setAuthFeedback('E-mail ou senha inválidos no modo local.', true);
          return;
        }

        setLocalUser(user);
        setAuthFeedback('Login realizado com sucesso no modo local.');
      }

      authForm.reset();
      await updateAuthView();
      await loadExpenses();
      return;
    }

    let result;
    if (mode === 'signup') {
      result = await client.auth.signUp({ email, password });
    } else {
      result = await client.auth.signInWithPassword({ email, password });
    }

    if (result.error) throw result.error;

    const user = await getCurrentUser(client);
    if (!user && mode === 'login') {
      setAuthFeedback('Não foi possível entrar. Verifique suas credenciais.', true);
      return;
    }

    await ensureUserProfile(client);
    setAuthFeedback(mode === 'signup' ? 'Conta criada e perfil salvo no banco.' : 'Login realizado com sucesso.');
    authForm.reset();
    await updateAuthView();
    await loadExpenses();
  } catch (error) {
    setAuthFeedback(error.message || 'Erro ao autenticar.', true);
    console.error(error);
  }
}

async function logout() {
  const client = getSupabaseClient();
  if (!isSupabaseReady(client) || typeof client.auth.signOut !== 'function') {
    clearLocalUser();
    await updateAuthView();
    renderExpenses([]);
    return;
  }

  await client.auth.signOut();
  await updateAuthView();
  renderExpenses([]);
}

async function handleForgotPassword() {
  const email = recoveryEmail.value.trim();
  const client = getSupabaseClient();

  if (!email) {
    setAuthFeedback('Informe o e-mail para recuperar a senha.', true);
    return;
  }

  if (!isSupabaseReady(client)) {
    const users = getLocalUsers();
    const user = users.find((item) => item.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      setAuthFeedback('Nenhuma conta local foi encontrada para este e-mail.', true);
      return;
    }

    setAuthFeedback('Recuperação local habilitada. Para este modo, use a conta local criada anteriormente.');
    recoveryEmail.value = '';
    return;
  }

  try {
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.href
    });

    if (error) throw error;

    setAuthFeedback('E-mail de recuperação enviado. Verifique sua caixa de entrada.');
    recoveryEmail.value = '';
  } catch (error) {
    setAuthFeedback(error.message || 'Não foi possível enviar o e-mail de recuperação.', true);
    console.error(error);
  }
}

async function updateAuthView() {
  const client = getSupabaseClient();
  const user = await getCurrentUser(client);
  const isLoggedIn = Boolean(user);

  authView.style.display = isLoggedIn ? 'none' : 'flex';
  appView.style.display = isLoggedIn ? 'block' : 'none';
  authPanel.style.display = 'block';
  expenseSection.style.display = isLoggedIn ? 'block' : 'none';

  if (!isLoggedIn) {
    totalValue.textContent = formatCurrency(0);
    countValue.textContent = '0';
    largestValue.textContent = formatCurrency(0);
    list.innerHTML = '<div class="empty-state">Entre para ver seus gastos.</div>';
    setFeedback('');
    setAuthFeedback('Faça login para ver e salvar seus gastos.', false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setFeedback('Salvando...');

  const payload = {
    description: document.getElementById('description').value.trim(),
    amount: Number(document.getElementById('amount').value),
    category: document.getElementById('category').value,
    expense_date: document.getElementById('expenseDate').value,
    notes: document.getElementById('notes').value.trim()
  };

  if (!payload.description || !payload.category || !payload.expense_date) {
    setFeedback('Preencha todos os campos obrigatórios.', true);
    return;
  }

  try {
    await saveExpense(payload);
    form.reset();
    expenseDateInput.value = new Date().toISOString().slice(0, 10);
    setFeedback('Despesa salva com sucesso!');
    await loadExpenses();
  } catch (error) {
    setFeedback('Falha ao salvar. Veja o console para detalhes.', true);
    console.error(error);
  }
});

list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;

  const id = button.getAttribute('data-id');
  try {
    await deleteExpense(id);
    setFeedback('Item removido.');
    await loadExpenses();
  } catch (error) {
    setFeedback('Não foi possível excluir.', true);
    console.error(error);
  }
});

testConnectionBtn.addEventListener('click', async () => {
  setFeedback('Testando conexão...');
  try {
    const data = await fetchExpenses();
    setFeedback(`Conexão OK. ${Array.isArray(data) ? data.length : 0} registros encontrados.`);
    renderExpenses((data || []).map((item) => normalizeExpense(item)));
  } catch (error) {
    setFeedback('Falha na conexão. Verifique URL, chave anon e permissões da tabela.', true);
    console.error(error);
  }
});

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  handleAuth('login');
});

signupBtn.addEventListener('click', () => {
  handleAuth('signup');
});

forgotPasswordBtn.addEventListener('click', () => {
  handleForgotPassword();
});

logoutBtn.addEventListener('click', () => {
  logout();
});

expenseDateInput.value = new Date().toISOString().slice(0, 10);
void updateAuthView();
loadExpenses();
startPolling();
