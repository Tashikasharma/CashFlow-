// ========================================
// ExpenseTracker - Main Application
// Per-user data isolation via email key
// ========================================

// ==========================================
// AUTH SYSTEM — must run before everything
// ==========================================

const AUTH_STORE = 'et_auth_users';     // registry of all accounts { email -> {name, hash} }
const SESSION_KEY = 'et_session';       // currently logged-in email (+ name)

/* Simple hash (non-crypto, good enough for localStorage demo) */
function hashPassword(pw) {
    let h = 0;
    for (let i = 0; i < pw.length; i++) {
        h = (Math.imul(31, h) + pw.charCodeAt(i)) | 0;
    }
    return h.toString(16);
}

/* Return all registered users object */
function getUsers() {
    return JSON.parse(localStorage.getItem(AUTH_STORE) || '{}');
}

/* Save users registry */
function saveUsers(users) {
    localStorage.setItem(AUTH_STORE, JSON.stringify(users));
}

/* Current session: {email, name} or null */
function getSession() {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
}

/* Start session; persist=true stores in localStorage (remember me) */
function startSession(email, name, persist) {
    const session = JSON.stringify({ email, name });
    sessionStorage.setItem(SESSION_KEY, session);
    if (persist) localStorage.setItem(SESSION_KEY, session);
    else localStorage.removeItem(SESSION_KEY);
}

/* Destroy session */
function endSession() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
}

/* Namespace key per user  →  "user|alice@x.com|transactions" */
function userKey(key) {
    const s = getSession();
    if (!s) return key; // fallback (shouldn't happen on protected pages)
    return `user|${s.email}|${key}`;
}

/* Redirect to login if not logged in */
function requireAuth() {
    if (!getSession()) {
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/* Inject user info into the nav + add logout button */
function renderUserBadge() {
    const session = getSession();
    if (!session) return;
    const nav = document.querySelector('.nav-links');
    if (!nav) return;

    // Remove existing badge/logout if any
    nav.querySelectorAll('.user-badge-li, .logout-li').forEach(el => el.remove());

    const badgeLi = document.createElement('li');
    badgeLi.className = 'user-badge-li';
    badgeLi.innerHTML = `<span class="user-badge" title="${session.email}">👤 ${session.name.split(' ')[0]}</span>`;
    nav.appendChild(badgeLi);

    const logoutLi = document.createElement('li');
    logoutLi.className = 'logout-li';
    logoutLi.innerHTML = `<a href="#" class="logout-link" onclick="logout(); return false;">Logout</a>`;
    nav.appendChild(logoutLi);
}

function logout() {
    endSession();
    window.location.href = 'login.html';
}

// ==========================================
// Data Management  (all keys are per-user)
// ==========================================

const DEFAULT_EXPENSE_CATEGORIES = [
    { id: 'food', name: 'Food & Dining', icon: '🍔' },
    { id: 'transport', name: 'Transportation', icon: '🚗' },
    { id: 'utilities', name: 'Utilities', icon: '💡' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎬' },
    { id: 'shopping', name: 'Shopping', icon: '🛒' },
    { id: 'health', name: 'Healthcare', icon: '🏥' },
    { id: 'education', name: 'Education', icon: '📚' },
    { id: 'housing', name: 'Housing', icon: '🏠' },
    { id: 'insurance', name: 'Insurance', icon: '🛡️' },
    { id: 'personal', name: 'Personal Care', icon: '💅' },
    { id: 'travel', name: 'Travel', icon: '✈️' },
    { id: 'gifts', name: 'Gifts & Donations', icon: '🎁' },
    { id: 'subscriptions', name: 'Subscriptions', icon: '📱' },
    { id: 'other_expense', name: 'Other', icon: '📦' }
];

const DEFAULT_INCOME_CATEGORIES = [
    { id: 'salary', name: 'Salary', icon: '💼' },
    { id: 'freelance', name: 'Freelance', icon: '💻' },
    { id: 'investments', name: 'Investments', icon: '📈' },
    { id: 'rental', name: 'Rental Income', icon: '🏘️' },
    { id: 'business', name: 'Business', icon: '🏢' },
    { id: 'gifts_income', name: 'Gifts', icon: '🎀' },
    { id: 'refunds', name: 'Refunds', icon: '💵' },
    { id: 'other_income', name: 'Other', icon: '💰' }
];

const DEFAULT_SETTINGS = {
    currency: 'INR',
    currencySymbol: '₹',
    dateFormat: 'DD/MM/YYYY',
    startOfWeek: 'sunday',
    darkMode: false,
    lightMode: false,
    monthlyBudget: 0,
    categoryBudgets: {},
    budgetAlerts: true,
    alertThreshold: 80
};

const CURRENCY_SYMBOLS = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥',
    CAD: '$', AUD: '$', INR: '₹'
};

function getTransactions() {
    const data = localStorage.getItem(userKey('transactions'));
    return data ? JSON.parse(data) : [];
}

function saveTransactions(transactions) {
    localStorage.setItem(userKey('transactions'), JSON.stringify(transactions));
}

function getSettings() {
    const data = localStorage.getItem(userKey('settings'));
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
    localStorage.setItem(userKey('settings'), JSON.stringify(settings));
}

function getExpenseCategories() {
    const data = localStorage.getItem(userKey('expenseCategories'));
    return data ? JSON.parse(data) : [...DEFAULT_EXPENSE_CATEGORIES];
}

function saveExpenseCategories(categories) {
    localStorage.setItem(userKey('expenseCategories'), JSON.stringify(categories));
}

function getIncomeCategories() {
    const data = localStorage.getItem(userKey('incomeCategories'));
    return data ? JSON.parse(data) : [...DEFAULT_INCOME_CATEGORIES];
}

function saveIncomeCategories(categories) {
    localStorage.setItem(userKey('incomeCategories'), JSON.stringify(categories));
}

function getQuickAddItems() {
    const data = localStorage.getItem(userKey('quickAddItems'));
    return data ? JSON.parse(data) : [];
}

function saveQuickAddItems(items) {
    localStorage.setItem(userKey('quickAddItems'), JSON.stringify(items));
}

// ==========================================
// Utility Functions
// ==========================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(amount, settings = null) {
    settings = settings || getSettings();
    const symbol = CURRENCY_SYMBOLS[settings.currency] || '₹';
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
}

function formatDate(dateString, format = null) {
    const settings = getSettings();
    format = format || settings.dateFormat;
    const date = new Date(dateString + 'T00:00:00');
    const day   = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year  = date.getFullYear();
    switch (format) {
        case 'DD/MM/YYYY': return `${day}/${month}/${year}`;
        case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
        default:           return `${month}/${day}/${year}`;
    }
}

function getCategoryById(id, type) {
    const categories = type === 'income' ? getIncomeCategories() : getExpenseCategories();
    return categories.find(c => c.id === id) || { name: 'Unknown', icon: '❓' };
}

function getDateRange(range) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start, end;

    // Handle numeric day ranges (e.g. '7', '30', '90', '180', '365') and 'all'
    if (range === 'all') {
        start = new Date(2000, 0, 1);
        end   = new Date(today.getFullYear() + 1, 11, 31);
        return { start, end };
    }
    const days = parseInt(range);
    if (!isNaN(days)) {
        end   = new Date(today);
        start = new Date(today);
        start.setDate(today.getDate() - days + 1);
        return { start, end };
    }

    switch (range) {
        case 'week':
            const dow = today.getDay();
            start = new Date(today); start.setDate(today.getDate() - dow);
            end   = new Date(start); end.setDate(start.getDate() + 6);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'quarter':
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            end   = new Date(now.getFullYear(), q * 3 + 3, 0);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            end   = new Date(now.getFullYear(), 11, 31);
            break;
        default:
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    return { start, end };
}

function filterTransactions(transactions, filters) {
    return transactions.filter(t => {
        if (filters.type && filters.type !== 'all' && t.type !== filters.type) return false;
        if (filters.category && filters.category !== 'all' && t.category !== filters.category) return false;
        if (filters.dateFrom && new Date(t.date) < new Date(filters.dateFrom)) return false;
        if (filters.dateTo  && new Date(t.date) > new Date(filters.dateTo))   return false;
        if (filters.search) {
            const s = filters.search.toLowerCase();
            if (!t.description.toLowerCase().includes(s) &&
                !getCategoryById(t.category, t.type).name.toLowerCase().includes(s)) return false;
        }
        return true;
    });
}

function showToast(message, element = 'success-toast') {
    const toast = document.getElementById(element);
    if (!toast) return;
    const msgEl = toast.querySelector('.toast-message');
    if (msgEl) msgEl.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function checkBudgetAlerts() {
    const settings = getSettings();
    if (!settings.budgetAlerts) return;

    const transactions = getTransactions();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthlyExpenses = transactions.filter(t =>
        t.type === 'expense' && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd
    );
    const totalSpent = monthlyExpenses.reduce((s, t) => s + t.amount, 0);

    const alerts = [];

    // Monthly budget alert
    if (settings.monthlyBudget > 0) {
        const pct = (totalSpent / settings.monthlyBudget) * 100;
        if (pct >= 100) {
            alerts.push(`⚠️ Monthly budget exceeded! Spent ${formatCurrency(totalSpent)} of ${formatCurrency(settings.monthlyBudget)}.`);
        } else if (pct >= settings.alertThreshold) {
            alerts.push(`⚠️ Monthly budget at ${pct.toFixed(0)}%! Spent ${formatCurrency(totalSpent)} of ${formatCurrency(settings.monthlyBudget)}.`);
        }
    }

    // Category budget alerts
    const byCategory = {};
    monthlyExpenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

    Object.entries(settings.categoryBudgets || {}).forEach(([cid, budget]) => {
        if (budget > 0) {
            const spent = byCategory[cid] || 0;
            const pct = (spent / budget) * 100;
            const cat = getCategoryById(cid, 'expense');
            if (pct >= 100) {
                alerts.push(`⚠️ ${cat.icon} ${cat.name} budget exceeded! Spent ${formatCurrency(spent)} of ${formatCurrency(budget)}.`);
            } else if (pct >= settings.alertThreshold) {
                alerts.push(`⚠️ ${cat.icon} ${cat.name} budget at ${pct.toFixed(0)}%! Spent ${formatCurrency(spent)} of ${formatCurrency(budget)}.`);
            }
        }
    });

    if (alerts.length > 0) {
        // Show the first alert as a toast, then any remaining as sequential alerts
        showBudgetAlertToast(alerts);
    }
}

function showBudgetAlertToast(alerts) {
    // Create or reuse a budget alert toast element
    let alertToast = document.getElementById('budget-alert-toast');
    if (!alertToast) {
        alertToast = document.createElement('div');
        alertToast.id = 'budget-alert-toast';
        alertToast.className = 'toast budget-toast';
        alertToast.innerHTML = '<span class="toast-icon">⚠️</span><span class="toast-message"></span>';
        document.body.appendChild(alertToast);
    }

    let index = 0;
    function showNext() {
        if (index >= alerts.length) return;
        const msgEl = alertToast.querySelector('.toast-message');
        if (msgEl) msgEl.textContent = alerts[index];
        alertToast.classList.add('show');
        index++;
        setTimeout(() => {
            alertToast.classList.remove('show');
            setTimeout(showNext, 400);
        }, 3500);
    }
    showNext();
}

// ==========================================
// Mobile Menu
// ==========================================

function initMobileMenu() {
    const menuBtn  = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (menuBtn && navLinks) {
        menuBtn.addEventListener('click', () => navLinks.classList.toggle('active'));
        document.addEventListener('click', (e) => {
            if (!menuBtn.contains(e.target) && !navLinks.contains(e.target))
                navLinks.classList.remove('active');
        });
    }
}

// ==========================================
// Theme
// ==========================================

function initTheme() {
    const settings = getSettings();
    if (settings.lightMode) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
}

// ==========================================
// Dashboard Page
// ==========================================

function initDashboard() {
    if (!requireAuth()) return;
    initMobileMenu();
    initTheme();
    renderUserBadge();
    updateSummaryCards();
    updateRecentTransactions();
    updateBudgetProgress();
    initDashboardCharts();
    // Check alerts on dashboard load
    setTimeout(() => checkBudgetAlerts(), 1000);
}

function updateSummaryCards() {
    const transactions = getTransactions();
    const totalIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpenses;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyIncome   = transactions.filter(t => t.type === 'income'   && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd).reduce((s, t) => s + t.amount, 0);
    const monthlyExpenses = transactions.filter(t => t.type === 'expense'  && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd).reduce((s, t) => s + t.amount, 0);
    const monthlyBalance  = monthlyIncome - monthlyExpenses;

    document.getElementById('total-balance').textContent  = formatCurrency(balance);
    document.getElementById('total-income').textContent   = formatCurrency(totalIncome);
    document.getElementById('total-expenses').textContent = formatCurrency(totalExpenses);
    document.getElementById('monthly-balance').textContent = formatCurrency(monthlyBalance);

    document.getElementById('total-balance').style.color   = balance        >= 0 ? 'var(--success)' : 'var(--danger)';
    document.getElementById('monthly-balance').style.color = monthlyBalance >= 0 ? 'var(--success)' : 'var(--danger)';
}

function updateRecentTransactions() {
    const transactions = getTransactions().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const container = document.getElementById('recent-transactions');

    if (transactions.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>No transactions yet</p><a href="add.html" class="btn btn-primary" style="margin-top:1rem">Add Your First Transaction</a></div>`;
        return;
    }

    container.innerHTML = transactions.map(t => {
        const cat = getCategoryById(t.category, t.type);
        return `<div class="transaction-item">
            <div class="transaction-info">
                <div class="transaction-icon">${cat.icon}</div>
                <div class="transaction-details"><h4>${t.description}</h4><p>${cat.name} · ${formatDate(t.date)}</p></div>
            </div>
            <span class="transaction-amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</span>
        </div>`;
    }).join('');
}

function updateBudgetProgress() {
    const settings = getSettings();
    const transactions = getTransactions();
    const container = document.getElementById('budget-progress');

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const monthlyExpenses = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= monthStart && new Date(t.date) <= monthEnd);
    const byCategory = {};
    monthlyExpenses.forEach(t => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });

    const budgetItems = [];

    if (settings.monthlyBudget > 0) {
        const spent = monthlyExpenses.reduce((s, t) => s + t.amount, 0);
        budgetItems.push({ name: 'Monthly Budget', icon: '📊', spent, budget: settings.monthlyBudget, percentage: Math.min((spent / settings.monthlyBudget) * 100, 100) });
    }

    Object.entries(settings.categoryBudgets || {}).forEach(([cid, budget]) => {
        if (budget > 0) {
            const cat = getCategoryById(cid, 'expense');
            const spent = byCategory[cid] || 0;
            budgetItems.push({ name: cat.name, icon: cat.icon, spent, budget, percentage: Math.min((spent / budget) * 100, 100) });
        }
    });

    if (budgetItems.length === 0) {
        container.innerHTML = `<div class="empty-state" style="padding:2rem"><p>No budgets set yet</p><a href="setting.html" class="btn btn-secondary btn-small" style="margin-top:1rem">Set Up Budgets</a></div>`;
        return;
    }

    container.innerHTML = budgetItems.map(item => {
        let cls = '';
        if (item.percentage >= 100) cls = 'danger';
        else if (item.percentage >= settings.alertThreshold) cls = 'warning';
        return `<div class="budget-item">
            <div class="budget-header">
                <span class="budget-category">${item.icon} ${item.name}</span>
                <span class="budget-amounts"><strong>${formatCurrency(item.spent)}</strong> / ${formatCurrency(item.budget)}</span>
            </div>
            <div class="progress-bar"><div class="progress-fill ${cls}" style="width:${item.percentage}%"></div></div>
        </div>`;
    }).join('');
}

function initDashboardCharts() {
    const transactions = getTransactions();

    const categoryCtx = document.getElementById('category-chart');
    if (categoryCtx) {
        const now = new Date();
        const ms = new Date(now.getFullYear(), now.getMonth(), 1);
        const me = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const mExp = transactions.filter(t => t.type === 'expense' && new Date(t.date) >= ms && new Date(t.date) <= me);
        const byCat = {};
        mExp.forEach(t => { const c = getCategoryById(t.category, 'expense'); byCat[c.name] = (byCat[c.name] || 0) + t.amount; });

        new Chart(categoryCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(byCat),
                datasets: [{ data: Object.values(byCat), backgroundColor: ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#14b8a6','#3b82f6','#6b7280','#84cc16'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    const trendCtx = document.getElementById('trend-chart');
    if (trendCtx) {
        const months = []; const incomeData = []; const expenseData = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(); d.setMonth(d.getMonth() - i);
            const ms2 = new Date(d.getFullYear(), d.getMonth(), 1);
            const me2 = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            months.push(d.toLocaleString('default', { month: 'short' }));
            incomeData.push(transactions.filter(t => t.type === 'income'  && new Date(t.date) >= ms2 && new Date(t.date) <= me2).reduce((s, t) => s + t.amount, 0));
            expenseData.push(transactions.filter(t => t.type === 'expense' && new Date(t.date) >= ms2 && new Date(t.date) <= me2).reduce((s, t) => s + t.amount, 0));
        }
        new Chart(trendCtx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'Income',   data: incomeData,  backgroundColor: '#10b981' },
                    { label: 'Expenses', data: expenseData, backgroundColor: '#ef4444' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

// ==========================================
// Transactions Page
// ==========================================

let currentPage = 1;
const itemsPerPage = 10;
let currentFilters = {};
let sortColumn = 'date';
let sortDirection = 'desc';
let deleteTransactionId = null;

function initTransactionsPage() {
    if (!requireAuth()) return;
    initMobileMenu();
    initTheme();
    renderUserBadge();
    populateCategoryFilter();
    setupFilterListeners();
    setupSortListeners();
    setupModalListeners();
    setupExportListener();
    renderTransactions();
}

function populateCategoryFilter() {
    const select = document.getElementById('filter-category');
    let options = '<option value="all">All Categories</option>';
    options += '<optgroup label="Expense Categories">';
    getExpenseCategories().forEach(c => { options += `<option value="${c.id}">${c.icon} ${c.name}</option>`; });
    options += '</optgroup><optgroup label="Income Categories">';
    getIncomeCategories().forEach(c => { options += `<option value="${c.id}">${c.icon} ${c.name}</option>`; });
    options += '</optgroup>';
    select.innerHTML = options;
}

function setupFilterListeners() {
    const applyFilters = () => {
        currentFilters = {
            type: document.getElementById('filter-type').value,
            category: document.getElementById('filter-category').value,
            dateFrom: document.getElementById('filter-date-from').value,
            dateTo: document.getElementById('filter-date-to').value,
            search: document.getElementById('filter-search').value
        };
        currentPage = 1;
        renderTransactions();
    };

    ['filter-type','filter-category','filter-date-from','filter-date-to'].forEach(id => {
        document.getElementById(id).addEventListener('change', applyFilters);
    });
    document.getElementById('filter-search').addEventListener('input', debounce(applyFilters, 300));

    document.getElementById('clear-filters').addEventListener('click', () => {
        document.getElementById('filter-type').value = 'all';
        document.getElementById('filter-category').value = 'all';
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-search').value = '';
        currentFilters = {};
        currentPage = 1;
        renderTransactions();
    });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

function setupSortListeners() {
    document.querySelectorAll('.transactions-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.sort;
            if (sortColumn === col) sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            else { sortColumn = col; sortDirection = 'desc'; }
            renderTransactions();
        });
    });
}

function setupModalListeners() {
    const editModal   = document.getElementById('edit-modal');
    const deleteModal = document.getElementById('delete-modal');

    document.getElementById('close-modal').addEventListener('click', () => editModal.classList.remove('open'));
    document.getElementById('cancel-edit').addEventListener('click', () => editModal.classList.remove('open'));
    document.getElementById('close-delete-modal').addEventListener('click', () => deleteModal.classList.remove('open'));
    document.getElementById('cancel-delete').addEventListener('click', () => deleteModal.classList.remove('open'));

    editModal.addEventListener('click',   e => { if (e.target === editModal)   editModal.classList.remove('open'); });
    deleteModal.addEventListener('click', e => { if (e.target === deleteModal) deleteModal.classList.remove('open'); });

    document.getElementById('confirm-delete').addEventListener('click', () => {
        if (deleteTransactionId) {
            deleteTransaction(deleteTransactionId);
            deleteModal.classList.remove('open');
            deleteTransactionId = null;
        }
    });

    document.getElementById('edit-form').addEventListener('submit', e => {
        e.preventDefault();
        saveEditedTransaction();
    });

    document.getElementById('edit-type').addEventListener('change', e => populateEditCategories(e.target.value));
}

function setupExportListener() {
    document.getElementById('export-csv').addEventListener('click', exportToCSV);
}

function renderTransactions() {
    let transactions = filterTransactions(getTransactions(), currentFilters);

    transactions.sort((a, b) => {
        let av, bv;
        switch (sortColumn) {
            case 'date':        av = new Date(a.date); bv = new Date(b.date); break;
            case 'amount':      av = a.amount; bv = b.amount; break;
            case 'description': av = a.description.toLowerCase(); bv = b.description.toLowerCase(); break;
            case 'category':    av = getCategoryById(a.category, a.type).name.toLowerCase(); bv = getCategoryById(b.category, b.type).name.toLowerCase(); break;
            case 'type':        av = a.type; bv = b.type; break;
            default:            av = a.date; bv = b.date;
        }
        if (av < bv) return sortDirection === 'asc' ? -1 : 1;
        if (av > bv) return sortDirection === 'asc' ?  1 : -1;
        return 0;
    });

    document.getElementById('results-count').textContent = `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`;

    const totalPages = Math.ceil(transactions.length / itemsPerPage);
    const pageItems  = transactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const tbody = document.getElementById('transactions-tbody');
    if (pageItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="empty-icon">📝</div><p>No transactions found</p></td></tr>`;
    } else {
        tbody.innerHTML = pageItems.map(t => {
            const cat = getCategoryById(t.category, t.type);
            return `<tr>
                <td>${formatDate(t.date)}</td>
                <td>${t.description}</td>
                <td>${cat.icon} ${cat.name}</td>
                <td><span class="type-badge ${t.type}">${t.type}</span></td>
                <td class="amount ${t.type}">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</td>
                <td><div class="action-buttons">
                    <button class="action-btn" onclick="openEditModal('${t.id}')" title="Edit">✏️</button>
                    <button class="action-btn delete" onclick="openDeleteModal('${t.id}')" title="Delete">🗑️</button>
                </div></td>
            </tr>`;
        }).join('');
    }

    renderPagination(totalPages);
}

function renderPagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (totalPages <= 1) { pagination.innerHTML = ''; return; }

    let html = `<button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})">← Prev</button>`;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1))
            html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
        else if (i === currentPage - 2 || i === currentPage + 2)
            html += `<span>…</span>`;
    }
    html += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})">Next →</button>`;
    pagination.innerHTML = html;
}

function goToPage(page) { currentPage = page; renderTransactions(); }

function openEditModal(id) {
    const t = getTransactions().find(t => t.id === id);
    if (!t) return;

    document.getElementById('edit-id').value          = t.id;
    document.getElementById('edit-type').value        = t.type;
    document.getElementById('edit-amount').value      = t.amount;
    document.getElementById('edit-description').value = t.description;
    document.getElementById('edit-date').value        = t.date;
    document.getElementById('edit-notes').value       = t.notes || '';

    populateEditCategories(t.type);
    document.getElementById('edit-category').value = t.category;
    document.getElementById('edit-modal').classList.add('open');
}

function populateEditCategories(type) {
    const cats = type === 'income' ? getIncomeCategories() : getExpenseCategories();
    document.getElementById('edit-category').innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

function saveEditedTransaction() {
    const transactions = getTransactions();
    const id    = document.getElementById('edit-id').value;
    const index = transactions.findIndex(t => t.id === id);
    if (index === -1) return;

    transactions[index] = {
        ...transactions[index],
        type:        document.getElementById('edit-type').value,
        amount:      parseFloat(document.getElementById('edit-amount').value),
        category:    document.getElementById('edit-category').value,
        description: document.getElementById('edit-description').value,
        date:        document.getElementById('edit-date').value,
        notes:       document.getElementById('edit-notes').value
    };

    saveTransactions(transactions);
    document.getElementById('edit-modal').classList.remove('open');
    renderTransactions();
}

function openDeleteModal(id) {
    deleteTransactionId = id;
    document.getElementById('delete-modal').classList.add('open');
}

function deleteTransaction(id) {
    saveTransactions(getTransactions().filter(t => t.id !== id));
    renderTransactions();
}

function exportToCSV() {
    const rows = filterTransactions(getTransactions(), currentFilters).map(t => [
        t.date,
        `"${t.description.replace(/"/g, '""')}"`,
        getCategoryById(t.category, t.type).name,
        t.type,
        t.amount,
        `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);
    const csv = [['Date','Description','Category','Type','Amount','Notes'].join(','), ...rows.map(r => r.join(','))].join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ==========================================
// Add Transaction Page
// ==========================================

function initAddPage() {
    if (!requireAuth()) return;
    initMobileMenu();
    initTheme();
    renderUserBadge();
    setupTypeToggle();
    populateCategories('expense');
    setDefaultDate();
    setupRecurringToggle();
    setupFormSubmission();
    loadQuickAddItems();
    updateCurrencySymbol();
}

function setupTypeToggle() {
    const typeButtons = document.querySelectorAll('.type-btn');
    const typeInput   = document.getElementById('transaction-type');
    typeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            typeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const type = btn.dataset.type;
            typeInput.value = type;
            populateCategories(type);
            const pg = document.getElementById('payment-method-group');
            if (pg) pg.style.display = type === 'expense' ? 'block' : 'none';
        });
    });
}

function populateCategories(type) {
    const cats = type === 'income' ? getIncomeCategories() : getExpenseCategories();
    document.getElementById('category').innerHTML =
        '<option value="">Select a category</option>' +
        cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

function setDefaultDate() {
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
}

function setupRecurringToggle() {
    const cb  = document.getElementById('is-recurring');
    const opt = document.getElementById('recurring-options');
    cb.addEventListener('change', () => { opt.style.display = cb.checked ? 'block' : 'none'; });
}

function updateCurrencySymbol() {
    const sym = CURRENCY_SYMBOLS[getSettings().currency] || '₹';
    const el  = document.getElementById('currency-symbol');
    if (el) el.textContent = sym;
}

function setupFormSubmission() {
    document.getElementById('add-transaction-form').addEventListener('submit', e => {
        e.preventDefault();
        const isRecurring = document.getElementById('is-recurring').checked;
        const transaction = {
            id:                 generateId(),
            type:               document.getElementById('transaction-type').value,
            amount:             parseFloat(document.getElementById('amount').value),
            category:           document.getElementById('category').value,
            description:        document.getElementById('description').value,
            date:               document.getElementById('date').value,
            paymentMethod:      document.getElementById('payment-method')?.value || null,
            notes:              document.getElementById('notes').value,
            isRecurring,
            recurringFrequency: isRecurring ? document.getElementById('recurring-frequency').value : null,
            createdAt:          new Date().toISOString()
        };

        const transactions = getTransactions();
        transactions.push(transaction);
        saveTransactions(transactions);
        updateQuickAddItems(transaction);
        showToast('Transaction added successfully!');
        // Check budget alerts after a short delay so the success toast shows first
        setTimeout(() => checkBudgetAlerts(), 3200);

        e.target.reset();
        setDefaultDate();
        document.getElementById('transaction-type').value = 'expense';
        document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.type-btn[data-type="expense"]').classList.add('active');
        populateCategories('expense');
    });
}

function updateQuickAddItems(transaction) {
    let items = getQuickAddItems();
    const idx = items.findIndex(q => q.description === transaction.description && q.category === transaction.category && q.type === transaction.type);
    if (idx >= 0) { items[idx].count++; items[idx].lastAmount = transaction.amount; }
    else items.push({ description: transaction.description, category: transaction.category, type: transaction.type, lastAmount: transaction.amount, count: 1 });
    items.sort((a, b) => b.count - a.count);
    saveQuickAddItems(items.slice(0, 5));
    loadQuickAddItems();
}

function loadQuickAddItems() {
    const container = document.getElementById('quick-add-list');
    const items = getQuickAddItems();
    if (items.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:0.875rem">Your frequently used transactions will appear here.</p>';
        return;
    }
    container.innerHTML = items.map(item => {
        const cat = getCategoryById(item.category, item.type);
        return `<div class="quick-add-item" onclick="quickAdd('${item.description}','${item.category}','${item.type}',${item.lastAmount})">${cat.icon} ${item.description}</div>`;
    }).join('');
}

function quickAdd(description, category, type, amount) {
    document.getElementById('description').value = description;
    document.getElementById('amount').value = amount;
    document.getElementById('transaction-type').value = type;
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.type-btn[data-type="${type}"]`).classList.add('active');
    populateCategories(type);
    document.getElementById('category').value = category;
    document.getElementById('amount').focus();
}

// ==========================================
// Reports Page
// ==========================================

let reportRange  = '90';
let reportCharts = {};

function initReportsPage() {
    if (!requireAuth()) return;
    initMobileMenu();
    initTheme();
    renderUserBadge();
    setupRangeSelector();
    setupExportButtons();
    updateReports();
}

function setupRangeSelector() {
    const rangeButtons = document.querySelectorAll('.range-btn');
    const customRange  = document.getElementById('custom-range');

    rangeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            rangeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const range = btn.dataset.range;
            if (range === 'custom') {
                if (customRange) customRange.style.display = 'flex';
            } else {
                if (customRange) customRange.style.display = 'none';
                reportRange = range;
                updateReports();
            }
        });
    });

    const applyRange = document.getElementById('apply-range');
    if (applyRange) applyRange.addEventListener('click', () => { reportRange = 'custom'; updateReports(); });
}

function setupExportButtons() {
    const exportCsv = document.getElementById('export-report-csv');
    if (exportCsv) exportCsv.addEventListener('click', exportReportCSV);
    const printBtn = document.getElementById('print-report');
    if (printBtn) printBtn.addEventListener('click', () => window.print());
    const exportPdf = document.getElementById('export-pdf');
    if (exportPdf) exportPdf.addEventListener('click', () => window.print());
}

function updateReports() {
    let dateRange;
    if (reportRange === 'custom') {
        const fromEl = document.getElementById('report-from');
        const toEl   = document.getElementById('report-to');
        const from = fromEl ? fromEl.value : '';
        const to   = toEl   ? toEl.value   : '';
        if (!from || !to) return;
        dateRange = { start: new Date(from), end: new Date(to) };
    } else {
        dateRange = getDateRange(reportRange);
    }

    const all = getTransactions();
    const transactions = all.filter(t => {
        const d = new Date(t.date);
        return d >= dateRange.start && d <= dateRange.end;
    });

    const income   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const savings  = income - expenses;
    const rate     = income > 0 ? ((savings / income) * 100).toFixed(1) : 0;

    document.getElementById('report-income').textContent        = formatCurrency(income);
    document.getElementById('report-expenses').textContent      = formatCurrency(expenses);
    document.getElementById('report-savings').textContent       = formatCurrency(savings);
    const rateEl = document.getElementById('report-rate') || document.getElementById('report-savings-rate');
    if (rateEl) rateEl.textContent = `${rate}%`;
    document.getElementById('report-savings').style.color       = savings >= 0 ? 'var(--success)' : 'var(--danger)';

    renderReportCharts(transactions, dateRange);
    renderCategoryBreakdown(transactions);
    renderTopExpenses(transactions);
}

function destroyChart(key) {
    if (reportCharts[key]) { reportCharts[key].destroy(); delete reportCharts[key]; }
}

function renderReportCharts(transactions, dateRange) {
    const COLORS = ['#6366f1','#8b5cf6','#ec4899','#ef4444','#f59e0b','#10b981','#14b8a6','#3b82f6','#6b7280','#84cc16'];

    // Expense Pie
    destroyChart('expPie');
    const expCtx = document.getElementById('expense-pie-chart');
    if (expCtx) {
        const byCat = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const c = getCategoryById(t.category, 'expense');
            byCat[c.name] = (byCat[c.name] || 0) + t.amount;
        });
        reportCharts.expPie = new Chart(expCtx, {
            type: 'pie',
            data: { labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat), backgroundColor: COLORS }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Income Pie
    destroyChart('incPie');
    const incCtx = document.getElementById('income-pie-chart');
    if (incCtx) {
        const byCat = {};
        transactions.filter(t => t.type === 'income').forEach(t => {
            const c = getCategoryById(t.category, 'income');
            byCat[c.name] = (byCat[c.name] || 0) + t.amount;
        });
        reportCharts.incPie = new Chart(incCtx, {
            type: 'pie',
            data: { labels: Object.keys(byCat), datasets: [{ data: Object.values(byCat), backgroundColor: COLORS }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Daily trend
    destroyChart('daily');
    const dailyCtx = document.getElementById('daily-trend-chart');
    if (dailyCtx) {
        const dailyMap = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            dailyMap[t.date] = (dailyMap[t.date] || 0) + t.amount;
        });
        const sorted = Object.keys(dailyMap).sort();
        reportCharts.daily = new Chart(dailyCtx, {
            type: 'line',
            data: {
                labels: sorted.map(d => formatDate(d)),
                datasets: [{ label: 'Daily Spending', data: sorted.map(d => dailyMap[d]), borderColor: '#6366f1', fill: true, backgroundColor: 'rgba(99,102,241,0.1)', tension: 0.4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Category Bar
    destroyChart('catBar');
    const catBarCtx = document.getElementById('category-bar-chart');
    if (catBarCtx) {
        const byCat = {};
        transactions.filter(t => t.type === 'expense').forEach(t => {
            const c = getCategoryById(t.category, 'expense');
            byCat[c.name] = (byCat[c.name] || 0) + t.amount;
        });
        const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
        reportCharts.catBar = new Chart(catBarCtx, {
            type: 'bar',
            data: { labels: sorted.map(([k]) => k), datasets: [{ label: 'Amount', data: sorted.map(([, v]) => v), backgroundColor: COLORS }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }
        });
    }

    // Monthly comparison
    destroyChart('monthly');
    const monthlyCtx = document.getElementById('monthly-comparison-chart');
    if (monthlyCtx) {
        const all = getTransactions();
        const months = []; const incD = []; const expD = [];
        for (let i = 5; i >= 0; i--) {
            const d  = new Date(); d.setMonth(d.getMonth() - i);
            const ms = new Date(d.getFullYear(), d.getMonth(), 1);
            const me = new Date(d.getFullYear(), d.getMonth() + 1, 0);
            months.push(d.toLocaleString('default', { month: 'short' }));
            incD.push(all.filter(t => t.type === 'income'  && new Date(t.date) >= ms && new Date(t.date) <= me).reduce((s, t) => s + t.amount, 0));
            expD.push(all.filter(t => t.type === 'expense' && new Date(t.date) >= ms && new Date(t.date) <= me).reduce((s, t) => s + t.amount, 0));
        }
        reportCharts.monthly = new Chart(monthlyCtx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    { label: 'Income',   data: incD, backgroundColor: '#10b981' },
                    { label: 'Expenses', data: expD, backgroundColor: '#ef4444' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    }
}

function renderTopExpenses(transactions) {
    const container = document.getElementById('top-expenses');
    if (!container) return;
    const top = [...transactions.filter(t => t.type === 'expense')].sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (top.length === 0) { container.innerHTML = '<p style="color:var(--text-muted)">No expenses in this period.</p>'; return; }
    container.innerHTML = top.map(t => `
        <div class="transaction-item" style="padding:0.5rem 0">
            <div class="transaction-info">
                <div class="transaction-icon">${getCategoryById(t.category,'expense').icon}</div>
                <div class="transaction-details"><h4>${t.description}</h4><p>${formatDate(t.date)}</p></div>
            </div>
            <span class="transaction-amount expense">-${formatCurrency(t.amount)}</span>
        </div>`).join('');
}

function renderCategoryBreakdown(transactions) {
    const tbody = document.getElementById('category-breakdown-tbody');
    if (!tbody) return;
    const total = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const byCat = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        if (!byCat[t.category]) byCat[t.category] = { count: 0, total: 0 };
        byCat[t.category].count++;
        byCat[t.category].total += t.amount;
    });

    tbody.innerHTML = Object.entries(byCat).sort((a, b) => b[1].total - a[1].total).map(([cid, data]) => {
        const cat = getCategoryById(cid, 'expense');
        const pct = total > 0 ? ((data.total / total) * 100).toFixed(1) : 0;
        const avg = data.count > 0 ? data.total / data.count : 0;
        return `<tr>
            <td>${cat.icon} ${cat.name}</td>
            <td>${data.count}</td>
            <td>${formatCurrency(data.total)}</td>
            <td>${pct}%</td>
            <td>${formatCurrency(avg)}</td>
            <td><div class="progress-bar" style="height:8px;width:80px"><div class="progress-fill" style="width:${pct}%"></div></div></td>
        </tr>`;
    }).join('');
}

function exportReportCSV() {
    let dateRange;
    if (reportRange === 'custom') {
        const from = document.getElementById('report-from').value;
        const to   = document.getElementById('report-to').value;
        if (!from || !to) return;
        dateRange = { start: new Date(from), end: new Date(to) };
    } else {
        dateRange = getDateRange(reportRange);
    }
    const transactions = getTransactions().filter(t => {
        const d = new Date(t.date);
        return d >= dateRange.start && d <= dateRange.end;
    });
    const rows = transactions.map(t => [
        t.date, `"${t.description.replace(/"/g,'""')}"`,
        getCategoryById(t.category, t.type).name, t.type, t.amount, `"${(t.notes||'').replace(/"/g,'""')}"`
    ]);
    const csv = [['Date','Description','Category','Type','Amount','Notes'].join(','), ...rows.map(r => r.join(','))].join('\n');
    const a   = document.createElement('a');
    a.href    = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `report_${reportRange}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// ==========================================
// Settings Page
// ==========================================

function initSettingsPage() {
    if (!requireAuth()) return;
    initMobileMenu();
    initTheme();
    renderUserBadge();
    loadSettings();
    renderCategories();
    renderCategoryBudgets();
    setupSettingsListeners();
}

function loadSettings() {
    const settings = getSettings();

    const currencyEl = document.getElementById('currency');
    if (currencyEl) currencyEl.value = settings.currency;

    const dateEl = document.getElementById('date-format');
    if (dateEl) dateEl.value = settings.dateFormat;

    const weekEl = document.getElementById('start-of-week');
    if (weekEl) weekEl.value = settings.startOfWeek;

    const darkEl = document.getElementById('dark-mode');
    if (darkEl) darkEl.checked = settings.lightMode || settings.darkMode || false;

    const budgetEl = document.getElementById('monthly-budget');
    if (budgetEl) budgetEl.value = settings.monthlyBudget || '';

    const alertsEl = document.getElementById('budget-alerts');
    if (alertsEl) alertsEl.checked = settings.budgetAlerts;

    const threshEl = document.getElementById('alert-threshold');
    if (threshEl) threshEl.value = settings.alertThreshold;
}

function setupSettingsListeners() {
    document.getElementById('dark-mode').addEventListener('change', e => {
        if (e.target.checked) document.documentElement.setAttribute('data-theme', 'light');
        else document.documentElement.removeAttribute('data-theme');
    });

    document.getElementById('save-settings').addEventListener('click', saveAllSettings);
    document.getElementById('reset-settings').addEventListener('click', () => {
        if (confirm('Reset all settings to defaults?')) {
            localStorage.removeItem(userKey('settings'));
            loadSettings();
            document.documentElement.removeAttribute('data-theme');
            showToast('Settings reset to defaults', 'settings-toast');
        }
    });

    document.getElementById('add-expense-category').addEventListener('click', () => {
        const input = document.getElementById('new-expense-category');
        if (input.value.trim()) { addCategory('expense', input.value.trim()); input.value = ''; }
    });

    document.getElementById('add-income-category').addEventListener('click', () => {
        const input = document.getElementById('new-income-category');
        if (input.value.trim()) { addCategory('income', input.value.trim()); input.value = ''; }
    });

    document.getElementById('export-data').addEventListener('click', exportAllData);
    document.getElementById('import-data').addEventListener('click', () => document.getElementById('import-file').click());
    document.getElementById('import-file').addEventListener('change', importData);
    document.getElementById('clear-data').addEventListener('click', clearAllData);
}

function saveAllSettings() {
    const settings = {
        currency:        document.getElementById('currency').value,
        currencySymbol:  CURRENCY_SYMBOLS[document.getElementById('currency').value],
        dateFormat:      document.getElementById('date-format').value,
        startOfWeek:     document.getElementById('start-of-week').value,
        lightMode:       document.getElementById('dark-mode').checked,
        darkMode:        document.getElementById('dark-mode').checked,
        monthlyBudget:   parseFloat(document.getElementById('monthly-budget').value) || 0,
        categoryBudgets: getSettings().categoryBudgets || {},
        budgetAlerts:    document.getElementById('budget-alerts').checked,
        alertThreshold:  parseInt(document.getElementById('alert-threshold').value)
    };

    document.querySelectorAll('.budget-input').forEach(input => {
        const v = parseFloat(input.value) || 0;
        if (v > 0) settings.categoryBudgets[input.dataset.category] = v;
        else delete settings.categoryBudgets[input.dataset.category];
    });

    saveSettings(settings);
    showToast('Settings saved successfully!', 'settings-toast');
}

function renderCategories() {
    const expCats = getExpenseCategories();
    const incCats = getIncomeCategories();

    document.getElementById('expense-categories').innerHTML = expCats.map(c => `
        <span class="category-tag">${c.icon} ${c.name}
            ${!DEFAULT_EXPENSE_CATEGORIES.find(d => d.id === c.id) ? `<button class="remove-category" onclick="removeCategory('expense','${c.id}')">&times;</button>` : ''}
        </span>`).join('');

    document.getElementById('income-categories').innerHTML = incCats.map(c => `
        <span class="category-tag">${c.icon} ${c.name}
            ${!DEFAULT_INCOME_CATEGORIES.find(d => d.id === c.id) ? `<button class="remove-category" onclick="removeCategory('income','${c.id}')">&times;</button>` : ''}
        </span>`).join('');
}

function addCategory(type, name) {
    const categories = type === 'income' ? getIncomeCategories() : getExpenseCategories();
    const id = name.toLowerCase().replace(/\s+/g, '_');
    if (categories.find(c => c.id === id)) { alert('Category already exists'); return; }
    categories.push({ id, name, icon: '📁' });
    if (type === 'income') saveIncomeCategories(categories);
    else saveExpenseCategories(categories);
    renderCategories();
    renderCategoryBudgets();
}

function removeCategory(type, id) {
    if (!confirm('Remove this category?')) return;
    let cats = type === 'income' ? getIncomeCategories() : getExpenseCategories();
    cats = cats.filter(c => c.id !== id);
    if (type === 'income') saveIncomeCategories(cats);
    else saveExpenseCategories(cats);
    renderCategories();
    renderCategoryBudgets();
}

function renderCategoryBudgets() {
    const cats     = getExpenseCategories();
    const settings = getSettings();
    const sym      = CURRENCY_SYMBOLS[settings.currency] || '₹';
    const container = document.getElementById('category-budgets-list');

    container.innerHTML = cats.map(c => `
        <div class="setting-item" style="padding:0.5rem 0">
            <span>${c.icon} ${c.name}</span>
            <div class="input-with-currency" style="max-width:120px">
                <span class="currency-prefix">${sym}</span>
                <input type="number" class="budget-input" data-category="${c.id}" value="${settings.categoryBudgets[c.id] || ''}" placeholder="0" step="0.01" style="width:80px">
            </div>
        </div>`).join('');
}

function exportAllData() {
    const data = {
        transactions:      getTransactions(),
        settings:          getSettings(),
        expenseCategories: getExpenseCategories(),
        incomeCategories:  getIncomeCategories(),
        quickAddItems:     getQuickAddItems(),
        exportDate:        new Date().toISOString(),
        exportedBy:        getSession()?.email
    };
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    a.download = `expense_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
        try {
            const data = JSON.parse(evt.target.result);
            if (data.transactions)      saveTransactions(data.transactions);
            if (data.settings)          saveSettings(data.settings);
            if (data.expenseCategories) saveExpenseCategories(data.expenseCategories);
            if (data.incomeCategories)  saveIncomeCategories(data.incomeCategories);
            if (data.quickAddItems)     saveQuickAddItems(data.quickAddItems);
            showToast('Data imported successfully!', 'settings-toast');
            loadSettings();
            renderCategories();
            renderCategoryBudgets();
        } catch {
            alert('Error importing data. Please check the file format.');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function clearAllData() {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-title').textContent   = 'Clear All Data';
    document.getElementById('confirm-message').textContent = 'This will permanently delete all your transactions, settings, and categories. This action cannot be undone.';
    modal.classList.add('open');

    document.getElementById('close-confirm-modal').onclick = () => modal.classList.remove('open');
    document.getElementById('cancel-confirm').onclick      = () => modal.classList.remove('open');
    document.getElementById('proceed-confirm').onclick     = () => {
        // Only clear THIS user's keys
        const session = getSession();
        if (!session) return;
        const prefix = `user|${session.email}|`;
        Object.keys(localStorage).filter(k => k.startsWith(prefix)).forEach(k => localStorage.removeItem(k));
        modal.classList.remove('open');
        showToast('All data cleared', 'settings-toast');
        loadSettings();
        renderCategories();
        renderCategoryBudgets();
        initTheme();
    };
}

// ==========================================
// Common DOMContentLoaded init
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    // Only run theme + badge if we have a session (non-login pages)
    if (getSession()) {
        initTheme();
        renderUserBadge();
    }
});