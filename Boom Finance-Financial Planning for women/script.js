/* Consolidated app script:
   - session/auth/navigation
   - budget module (add/edit/remove, persistence, charts, summary)
   - goals module (add/edit/remove, monthly field, persistence, charts, summary)
   - no implicit syncing from budget -> goals
*/

(function(){

  // --- small helpers ---
  function qs(id){ return document.getElementById(id); }
  function escapeHtml(s){ if (s===undefined||s===null) return ''; return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function safe(fn){ try{ fn(); }catch(e){ console.error(e); } }

  // --- Loading overlay + bootstrap ---
  function hideLoading(){ const el = qs('loading'); if (el) el.style.display = 'none'; }

  // --- App state and session ---
  const appState = { currentUser:null, isAuthenticated:false, currentPage:'login' };

  function saveSession(){
    if (appState.currentUser) localStorage.setItem('bloomUser', JSON.stringify(appState.currentUser));
    localStorage.setItem('bloomIsAuthenticated', appState.isAuthenticated ? 'true' : 'false');
    localStorage.setItem('bloomLastPage', appState.currentPage || 'login');
  }
  function restoreSession(){
    // Restore auth state, but don't perform navigation here.
    // Returns the last page name (or null) so caller can decide navigation.
    const user = localStorage.getItem('bloomUser');
    const auth = localStorage.getItem('bloomIsAuthenticated');
    const last = localStorage.getItem('bloomLastPage');
    if (user && auth === 'true') {
      try { appState.currentUser = JSON.parse(user); } catch(e){ appState.currentUser = { name: '', email: '' }; }
      appState.isAuthenticated = true;
    } else {
      appState.currentUser = null;
      appState.isAuthenticated = false;
    }
    // populate sidebar/header UI if DOM elements exist
    try { if (appState.currentUser) { const name = appState.currentUser.name || appState.currentUser.email?.split('@')[0] || 'User'; if (qs('user-initials')) qs('user-initials').textContent = name.charAt(0).toUpperCase(); if (qs('user-name')) qs('user-name').textContent = name; } else { if (qs('user-initials')) qs('user-initials').textContent = 'U'; if (qs('user-name')) qs('user-name').textContent = 'User'; } } catch(e){}
    return last || null;
  }

  // --- Navigation / Pages ---
  function hideAllPages(){
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page'));
  }
  function showLogin(){ hideAllPages(); qs('login-page').classList.add('active-page'); appState.currentPage='login'; saveSession(); }
  function showRegister(){ hideAllPages(); qs('register-page').classList.add('active-page'); appState.currentPage='register'; saveSession(); }
  function showApp(){ hideAllPages(); qs('app-page').classList.add('active-page'); navigateTo('dashboard'); appState.currentPage='app'; saveSession(); }
  function navigateTo(page){
    document.querySelectorAll('.page-content').forEach(c=>c.classList.add('hidden'));
    const target = qs(`${page}-page`);
    if (target) target.classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
    const navBtn = Array.from(document.querySelectorAll('.nav-item')).find(el => el.getAttribute('onclick') && el.getAttribute('onclick').includes(`navigateTo('${page}')`));
    if (navBtn) navBtn.classList.add('active');
    appState.currentPage = page;
    saveSession();
    // refresh dashboard when navigating there
    if (page === 'dashboard') updateDashboardSummary();
  }

  // --- Auth handlers ---
  function handleLogin(ev){
    ev && ev.preventDefault();
    const email = qs('email').value.trim();
    const password = qs('password').value;
    if (!email || !password){ showNotification('Error','Please fill all fields'); return; }
    appState.currentUser = { email, name: email.split('@')[0] || 'User' };
    appState.isAuthenticated = true;
    qs('user-initials').textContent = appState.currentUser.name.charAt(0).toUpperCase();
    qs('user-name').textContent = appState.currentUser.name;
    saveSession();
    showApp();
    showNotification('Welcome','Signed in');
  }
  function handleRegister(ev){
    ev && ev.preventDefault();
    const name = qs('register-name').value.trim();
    const email = qs('register-email').value.trim();
    const pw = qs('register-password').value;
    const confirm = qs('register-confirm').value;
    if (!name || !email || !pw || !confirm){ showNotification('Error','Fill all fields'); return; }
    if (pw.length < 8){ showNotification('Error','Password min 8 chars'); return; }
    if (pw !== confirm){ showNotification('Error','Passwords do not match'); return; }
    appState.currentUser = { name, email };
    appState.isAuthenticated = true;
    qs('user-initials').textContent = name.charAt(0).toUpperCase();
    qs('user-name').textContent = name;
    saveSession();
    showApp();
    showNotification('Welcome','Account created');
  }
  function handleLogout(){
    appState.currentUser = null; appState.isAuthenticated = false;
    localStorage.removeItem('bloomUser'); localStorage.removeItem('bloomIsAuthenticated'); localStorage.removeItem('bloomLastPage');
    showLogin(); showNotification('Signed out','You are logged out');
  }

  // --- UI helpers ---
  function toggleSidebar(){ qs('sidebar').classList.toggle('mobile-open'); }
  function toggleUserMenu(){
    const menu = qs('user-menu');
    const btn = qs('header-user-btn');
    if (!menu || !btn) return;
    menu.classList.toggle('hidden');
    const expanded = !menu.classList.contains('hidden');
    btn.setAttribute('aria-expanded', String(expanded));
    if (expanded) {
      // populate displayed name/email
      const name = appState.currentUser?.name || appState.currentUser?.email?.split('@')[0] || 'User';
      if (qs('menu-user-name')) qs('menu-user-name').textContent = name;
      if (qs('menu-user-email')) qs('menu-user-email').textContent = appState.currentUser?.email || '';
    }
  }

  function closeUserMenu(){
    const menu = qs('user-menu');
    const btn = qs('header-user-btn');
    if (!menu || !btn) return;
    if (!menu.classList.contains('hidden')) menu.classList.add('hidden');
    btn.setAttribute('aria-expanded','false');
  }

  // close both header and sidebar menus on outside click
  document.addEventListener('click', function(e){
    // header menu
    const headerBtn = qs('header-user-btn'), headerMenu = qs('user-menu');
    if (headerMenu && headerBtn && !headerMenu.classList.contains('hidden') && !headerMenu.contains(e.target) && !headerBtn.contains(e.target)) {
      closeUserMenu();
    }
    // sidebar menu (existing function closeSidebarUserMenu handles hiding)
    const sbMenu = qs('sidebar-user-menu'), sbBtn = qs('sidebar-user-btn');
    if (sbMenu && sbBtn && !sbMenu.classList.contains('hidden') && !sbMenu.contains(e.target) && !sbBtn.contains(e.target)) {
      closeSidebarUserMenu();
    }
  });

  // Sidebar helpers (fix: populate/close functions required by other code)
  function populateSidebarUser() {
    const name = appState.currentUser?.name || appState.currentUser?.email?.split('@')[0] || 'User';
    if (qs('sidebar-user-name')) qs('sidebar-user-name').textContent = name;
    if (qs('sidebar-user-email')) qs('sidebar-user-email').textContent = appState.currentUser?.email || '';
    if (qs('user-name')) qs('user-name').textContent = name;
    if (qs('user-initials') && name) qs('user-initials').textContent = name.charAt(0).toUpperCase();
    if (qs('menu-user-name')) qs('menu-user-name').textContent = name;
    if (qs('menu-user-email')) qs('menu-user-email').textContent = appState.currentUser?.email || '';
  }

  function closeSidebarUserMenu() {
    const menu = qs('sidebar-user-menu');
    const btn = qs('sidebar-user-btn');
    if (menu && !menu.classList.contains('hidden')) menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded','false');
  }

  // attach header button listener on DOM ready (safe duplicate protection)
  document.addEventListener('DOMContentLoaded', function(){
    const headerBtn = qs('header-user-btn');
    if (headerBtn) {
      headerBtn.removeEventListener('click', toggleUserMenu);
      headerBtn.addEventListener('click', function(e){ e.stopPropagation(); toggleUserMenu(); });
    }
  });

  // ensure user info is populated after login/register/restore
  const _origHandleLogin = handleLogin;
  handleLogin = function(ev){ _origHandleLogin(ev); populateSidebarUser(); };
  const _origHandleRegister = handleRegister;
  handleRegister = function(ev){ _origHandleRegister(ev); populateSidebarUser(); };
  const _origRestoreSession = restoreSession;
  restoreSession = function(){ _origRestoreSession(); populateSidebarUser(); };
  
  // --- Dashboard sync ---
  function updateDashboardSummary(){
    // use month filter if present
    const selected = qs('summary-month-filter')?.value || 'All';
    const budget = Array.isArray(window.budgetItems) ? window.budgetItems.slice() : [];
    const goals = Array.isArray(window.goalsItems) ? window.goalsItems.slice() : [];
    let budgetFiltered = budget;
    if (selected !== 'All') budgetFiltered = budget.filter(b => b.month === selected);

    let income = 0, expense = 0, savings = 0, investment = 0;
    budgetFiltered.forEach(it => {
      if (it.type === 'income') income += Number(it.amount || 0);
      if (it.type === 'expense') expense += Number(it.amount || 0);
      if (it.type === 'savings') savings += Number(it.amount || 0);
      if (it.type === 'investment') investment += Number(it.amount || 0);
    });

    // include monthly contributions from goals as part of "savings" pool
    const goalMonthly = goals.reduce((s,g) => s + Number(g.monthly || 0), 0);
    const totalSavings = savings + investment + goalMonthly;

    // compute savings rate (savings / income) safe
    const savingsRate = income > 0 ? Math.round((totalSavings / income) * 100) : 0;

    if (qs('card-total-savings')) qs('card-total-savings').textContent = '₹' + Number(totalSavings).toFixed(2);
    if (qs('card-monthly-income')) qs('card-monthly-income').textContent = '₹' + Number(income).toFixed(2);
    if (qs('card-monthly-expense')) qs('card-monthly-expense').textContent = '₹' + Number(expense).toFixed(2);
    if (qs('card-savings-rate')) qs('card-savings-rate').textContent = savingsRate + '%';
  }
  // expose to modules
  window.updateDashboardSummary = updateDashboardSummary;

  // Attach auth/form handlers that exist on page
  document.addEventListener('DOMContentLoaded', function(){
    // hide loading and restore session after small delay (keep as before)
    setTimeout(function(){
      hideLoading();
      const last = restoreSession();
      populateSidebarUser();
      if (appState.isAuthenticated) {
        // show app and navigate to last saved page (if valid)
        showApp();
        if (last && last !== 'login' && last !== 'register') navigateTo(last);
      } else {
        showLogin();
      }
    }, 600);
 
    // login/register form handlers
    safe(()=>{ const f = document.querySelector('#login-page form'); if (f){ f.addEventListener('submit', handleLogin); } });
    safe(()=>{ const f = document.querySelector('#register-page form'); if (f){ f.addEventListener('submit', handleRegister); } });
 
    // header controls
    safe(()=>{ const sb = document.querySelector('button[onclick="toggleSidebar()"]'); if (sb) sb.addEventListener('click', toggleSidebar); });
    safe(()=>{ const um = document.querySelector('button[onclick="toggleUserMenu()"]'); if (um) um.addEventListener('click', toggleUserMenu); });
 
  });

  // --- Budget module (self-contained) ---
  (function BudgetModule(){
    window.budgetItems = window.budgetItems || [];
    let editIndex = null;
    let barChart = null, pieChart = null;

    function load(){ try{ const raw = localStorage.getItem('budgetItems'); window.budgetItems = raw ? JSON.parse(raw) : []; }catch(e){ window.budgetItems = []; } }
    function save(){ localStorage.setItem('budgetItems', JSON.stringify(window.budgetItems)); }

    function renderList(){
      const tbody = qs('budget-list'); if (!tbody) return; tbody.innerHTML = '';
      window.budgetItems.forEach((it,i)=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-1 px-2 capitalize">${escapeHtml(it.type)}</td>
          <td class="py-1 px-2">${escapeHtml(it.desc)}</td>
          <td class="py-1 px-2 text-right">₹${Number(it.amount).toFixed(2)}</td>
          <td class="py-1 px-2">${escapeHtml(it.month||'')}</td>
          <td class="py-1 px-2">${escapeHtml(it.year||'')}</td>
          <td class="py-1 px-2">${escapeHtml(it.date||'')}</td>
          <td class="py-1 px-2 text-right">
            <button type="button" onclick="window.Budget_edit(${i})" class="text-bloom-purple hover:underline mr-2">Edit</button>
            <button type="button" onclick="window.Budget_remove(${i})" class="text-bloom-coral hover:underline">Remove</button>
          </td>`;
        tbody.appendChild(tr);
      });
    }

    function addOrUpdate(ev){
      ev && ev.preventDefault();
      const type = qs('budget-type')?.value || '';
      const desc = qs('budget-desc')?.value || '';
      const amount = parseFloat(qs('budget-amount')?.value || 0);
      const date = qs('budget-date')?.value || '';
      const month = qs('budget-month')?.value || '';
      const year = qs('budget-year')?.value || '';
      if (!type || !desc || isNaN(amount) || amount<=0 || !date){ alert('Please fill valid budget fields'); return; }
      const item = { type, desc, amount, month, year, date };
      if (editIndex !== null){ window.budgetItems[editIndex] = item; editIndex = null; setButton('budget-form','Add'); }
      else window.budgetItems.push(item);
      save(); resetForm(); renderList(); updateSummary(); renderCharts();
      if (typeof window.updateDashboardSummary === 'function') window.updateDashboardSummary();
      // refresh goals' available balances after budget change
      if (typeof window.updateGoalsAvailableBalances === 'function') window.updateGoalsAvailableBalances();
    }

    function edit(i){
      const it = window.budgetItems[i]; if (!it) return;
      qs('budget-type').value = it.type; qs('budget-desc').value = it.desc; qs('budget-amount').value = it.amount;
      qs('budget-month').value = it.month||''; qs('budget-year').value = it.year||''; qs('budget-date').value = it.date||'';
      editIndex = i; setButton('budget-form','Update');
    }
    function remove(i){
      if (!confirm('Remove this budget item?')) return;
      window.budgetItems.splice(i,1); save(); renderList(); updateSummary(); renderCharts();
      if (typeof window.updateDashboardSummary === 'function') window.updateDashboardSummary();
      // refresh goals' available balances after budget change
      if (typeof window.updateGoalsAvailableBalances === 'function') window.updateGoalsAvailableBalances();
      if (editIndex===i){ resetForm(); editIndex=null; setButton('budget-form','Add'); }
    }

    function resetForm(){ const f = qs('budget-form'); if (f) f.reset(); }
    function setButton(formId,text){ const b = document.querySelector(`#${formId} button[type="submit"]`); if (b) b.textContent = text; }

    function updateSummary(){
      const selected = qs('summary-month-filter')?.value || 'All';
      let items = window.budgetItems || [];
      if (selected!=='All') items = items.filter(x=>x.month===selected);
      let income=0, expense=0, investment=0, savings=0;
      items.forEach(it=>{ if (it.type==='income') income+=it.amount; if (it.type==='expense') expense+=it.amount; if (it.type==='investment') investment+=it.amount; if (it.type==='savings') savings+=it.amount; });
      const balance = income - expense - investment - savings;
      if (qs('total-income')) qs('total-income').textContent = income.toFixed(2);
      if (qs('total-expense')) qs('total-expense').textContent = expense.toFixed(2);
      if (qs('total-investment')) qs('total-investment').textContent = investment.toFixed(2);
      if (qs('total-savings')) qs('total-savings').textContent = savings.toFixed(2);
      if (qs('balance-amount')) qs('balance-amount').textContent = balance.toFixed(2);
      if (qs('emergency-target')) qs('emergency-target').textContent = (expense*3).toFixed(2);
      if (qs('emergency-available')) qs('emergency-available').textContent = (balance>0?balance.toFixed(2):'0.00');
      if (qs('fd-available')) qs('fd-available').textContent = (savings>0?savings.toFixed(2):'0.00');
    }

    function renderCharts(){
      if (typeof Chart !== 'function') return;
      const viz = qs('viz-month')?.value || 'All';
      const barEl = qs('budget-bar-chart'), pieEl = qs('budget-pie-chart');
      if (!barEl || !pieEl) return;
      // compute totals
      const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      let inc=0, exp=0, inv=0, sav=0;
      let filtered = window.budgetItems;
      if (viz!=='All') filtered = filtered.filter(i=>i.month===viz);
      filtered.forEach(i=>{ if (i.type==='income') inc+=i.amount; if (i.type==='expense') exp+=i.amount; if (i.type==='investment') inv+=i.amount; if (i.type==='savings') sav+=i.amount; });
      try{ if (barChart) barChart.destroy(); if (pieChart) pieChart.destroy(); }catch(e){}
      barChart = new Chart(barEl.getContext('2d'), { type:'bar', data:{ labels:['Income','Expenses','Investments','Savings'], datasets:[{ label:`${viz} Totals`, data:[inc,exp,inv,sav], backgroundColor:['#a0e7e5','#ff85a2','#9c89b8','#ff6b6b'] }] }, options:{responsive:true} });
      pieChart = new Chart(pieEl.getContext('2d'), { type:'pie', data:{ labels:['Income','Expenses','Investments','Savings'], datasets:[{ data:[inc,exp,inv,sav], backgroundColor:['#a0e7e5','#ff85a2','#9c89b8','#ff6b6b'] }] }, options:{responsive:true} });
    }

    // compute available balance for a month (exposed for Goals)
    function getAvailableBalanceForMonth(month) {
      const items = Array.isArray(window.budgetItems) ? window.budgetItems.slice() : [];
      let filtered = items;
      if (month && month !== 'All') filtered = items.filter(i => i.month === month);
      let income = 0, expense = 0, investment = 0, savings = 0;
      filtered.forEach(it => {
        if (it.type === 'income') income += Number(it.amount || 0);
        if (it.type === 'expense') expense += Number(it.amount || 0);
        if (it.type === 'investment') investment += Number(it.amount || 0);
        if (it.type === 'savings') savings += Number(it.amount || 0);
      });
      return income - expense - investment - savings;
    }
    // expose
    window.getBudgetAvailableBalanceForMonth = getAvailableBalanceForMonth;
 
    // expose minimal functions for button onclick handlers
    window.Budget_edit = edit;
    window.Budget_remove = remove;
 
    // attach handlers on DOM ready
    document.addEventListener('DOMContentLoaded', function(){
      load(); renderList(); updateSummary(); renderCharts();
      // refresh dashboard after budget module initialized
      if (typeof window.updateDashboardSummary === 'function') window.updateDashboardSummary();
      const form = qs('budget-form'); if (form){ form.addEventListener('submit', addOrUpdate); }
      // ensure goals' available balances refresh after budget changes
      // call after budget form submit & remove (addOrUpdate/remove already call updateDashboardSummary)
      // We also call updateGoalsAvailableBalances where available
      const dateEl = qs('budget-date'); if (dateEl) dateEl.addEventListener('change', function(){ const d=new Date(this.value); if (!isNaN(d)){ const months=["January","February","March","April","May","June","July","August","September","October","November","December"]; if (qs('budget-month')) qs('budget-month').value = months[d.getMonth()]; if (qs('budget-year')) qs('budget-year').value = d.getFullYear(); } });
      const vizSel = qs('viz-month'); if (vizSel) vizSel.addEventListener('change', renderCharts);
      const summarySel = qs('summary-month-filter'); if (summarySel) summarySel.addEventListener('change', function(){ updateSummary(); renderCharts(); });
    });
 
  })();

  // --- Goals module (self-contained) ---
  (function GoalsModule(){
    window.goalsItems = window.goalsItems || (localStorage.getItem('goalsItems') ? JSON.parse(localStorage.getItem('goalsItems')) : []);
    let editIndex = null;
    window.goalBarChart = window.goalBarChart || null;
    window.goalPieChart = window.goalPieChart || null;

    function save(){ localStorage.setItem('goalsItems', JSON.stringify(window.goalsItems)); }
    function renderList(){
      const tbody = qs('goals-list'); if (!tbody) return; tbody.innerHTML = '';
      window.goalsItems.forEach((it,i)=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="py-1 px-2 capitalize">${escapeHtml(getGoalTypeLabel(it.type))}</td>
          <td class="py-1 px-2">${escapeHtml(it.desc)}</td>
          <td class="py-1 px-2 text-right">₹${Number(it.amount).toFixed(2)}</td>
          <td class="py-1 px-2 text-right">₹${Number(it.monthly||0).toFixed(2)}</td>
          <td class="py-1 px-2 text-right">₹${Number(it.balance || (Number(it.availableBalance||0) - Number(it.monthly||0))).toFixed(2)}</td>
          <td class="py-1 px-2">${escapeHtml(it.month||'')}</td>
          <td class="py-1 px-2">${escapeHtml(it.year||'')}</td>
          <td class="py-1 px-2">${escapeHtml(it.date||'')}</td>
          <td class="py-1 px-2 text-right">₹${Number(it.availableBalance || 0).toFixed(2)}</td>
          <td class="py-1 px-2 text-right">
            <button type="button" onclick="window.Goal_edit(${i})" class="text-bloom-purple hover:underline mr-2">Edit</button>
            <button type="button" onclick="window.Goal_remove(${i})" class="text-bloom-coral hover:underline">Remove</button>
          </td>`;
        tbody.appendChild(tr);
      });
    }

    // compute and set availableBalance for each goal based on budget
    function updateGoalsAvailableBalances() {
      if (!Array.isArray(window.goalsItems)) return;
      window.goalsItems.forEach(g => {
        const month = g.month || 'All';
        let bal = 0;
        if (typeof window.getBudgetAvailableBalanceForMonth === 'function') {
          try { bal = Number(window.getBudgetAvailableBalanceForMonth(month)) || 0; } catch(e){ bal = 0; }
        } else if (Array.isArray(window.budgetItems)) {
          // fallback compute if helper not exposed
          const items = window.budgetItems.slice();
          let filtered = items;
          if (month && month !== 'All') filtered = items.filter(i => i.month === month);
          let income=0, expense=0, investment=0, savings=0;
          filtered.forEach(it => { if (it.type==='income') income+=Number(it.amount||0); if (it.type==='expense') expense+=Number(it.amount||0); if (it.type==='investment') investment+=Number(it.amount||0); if (it.type==='savings') savings+=Number(it.amount||0); });
          bal = income - expense - investment - savings;
        }
        g.availableBalance = bal;
        // compute Balance = Available Balance - Monthly Goal (automatic, not mandatory for user)
        g.balance = Number(g.availableBalance || 0) - Number(g.monthly || 0);
      });
      save(); // persist updated availableBalance & balance
      renderList();
    }
    // expose to other modules
    window.updateGoalsAvailableBalances = updateGoalsAvailableBalances;
 
    function addOrUpdate(ev){
      ev && ev.preventDefault();
      const type = qs('goal-type')?.value || '';
      const desc = qs('goal-desc')?.value || '';
      const amount = parseFloat(qs('goal-amount')?.value || 0);
      const monthly = parseFloat(qs('goal-monthly')?.value || 0);
      const date = qs('goal-date')?.value || '';
      const month = qs('goal-month')?.value || '';
      const year = qs('goal-year')?.value || '';
      if (!type || !desc || isNaN(amount) || amount<=0 || !date){ alert('Please fill valid goal fields'); return; }
      const item = { type, desc, amount, monthly, month, year, date };
      if (editIndex !== null){ window.goalsItems[editIndex] = item; editIndex=null; setBtn('goal-form','Add'); } else { window.goalsItems.push(item); }
      save(); resetForm(); renderList(); renderCharts(); updateSummary();
      // update available balances immediately after goal change
      updateGoalsAvailableBalances();
    }

    function edit(i){
      const it = window.goalsItems[i]; if (!it) return;
      qs('goal-type').value = it.type||''; qs('goal-desc').value = it.desc||''; qs('goal-amount').value = it.amount||''; qs('goal-monthly').value = it.monthly||''; qs('goal-month').value = it.month||''; qs('goal-year').value = it.year||''; qs('goal-date').value = it.date||'';
      editIndex = i; setBtn('goal-form','Update');
    }
    function remove(i){
      if (!confirm('Remove this goal?')) return;
      window.goalsItems.splice(i,1); save(); renderList(); renderCharts(); updateSummary();
      if (typeof window.updateDashboardSummary === 'function') window.updateDashboardSummary();
      if (editIndex===i){ resetForm(); editIndex=null; setBtn('goal-form','Add'); }
    }

    function renderCharts(){
      if (typeof Chart !== 'function') return;
      const viz = qs('goal-viz-month')?.value || 'All';
      let filtered = window.goalsItems.slice();
      if (viz !== 'All') filtered = filtered.filter(g=>g.month===viz);
      const sums = { 'future-fund':0, 'debt-reduction':0, 'major-life':0, 'short-term':0 };
      filtered.forEach(g=> sums[g.type] = (sums[g.type]||0) + Number(g.amount||0));
      try{ if (window.goalBarChart) window.goalBarChart.destroy(); if (window.goalPieChart) window.goalPieChart.destroy(); }catch(e){}
      const barEl = qs('goal-bar-chart'), pieEl = qs('goal-pie-chart'); if (!barEl || !pieEl) return;
      window.goalBarChart = new Chart(barEl.getContext('2d'), { type:'bar', data:{ labels:['Future Fund','Debt Reduction','Major Life','Short Term'], datasets:[{ label:`${viz} Totals`, data:[sums['future-fund'],sums['debt-reduction'],sums['major-life'],sums['short-term']], backgroundColor:['#a0e7e5','#ff85a2','#9c89b8','#ff6b6b'] }] }, options:{responsive:true} });
      window.goalPieChart = new Chart(pieEl.getContext('2d'), { type:'pie', data:{ labels:['Future Fund','Debt Reduction','Major Life','Short Term'], datasets:[{ data:[sums['future-fund'],sums['debt-reduction'],sums['major-life'],sums['short-term']], backgroundColor:['#a0e7e5','#ff85a2','#9c89b8','#ff6b6b'] }] }, options:{responsive:true} });
    }

    function updateSummary(){
      const selected = qs('goal-summary-month')?.value || 'All';
      let items = window.goalsItems.slice();
      if (selected !== 'All') items = items.filter(g=>g.month===selected);
      const total = items.reduce((s,g)=>s + Number(g.amount||0), 0);
      const monthlyTotal = items.reduce((s,g)=>s + Number(g.monthly||0), 0);
      if (qs('total-goal-amount')) qs('total-goal-amount').textContent = Number(total).toFixed(2);
      if (qs('total-monthly-goal')) qs('total-monthly-goal').textContent = Number(monthlyTotal).toFixed(2);
    }

    function resetForm(){ const f=qs('goal-form'); if (f) f.reset(); setBtn('goal-form','Add'); }
    function setBtn(formId,text){ const b = document.querySelector(`#${formId} button[type="submit"]`); if (b) b.textContent = text; }
    function getGoalTypeLabel(type){ switch(type){ case 'future-fund':return 'Fund For Future Use'; case 'debt-reduction':return 'Reduce high-interest debt / Debt / Credit Card Balances'; case 'major-life':return 'Major Life Events / Long Term Goals'; case 'short-term':return 'Short Term Goals'; default: return type||''; } }

    window.Goal_edit = edit; window.Goal_remove = remove;

    document.addEventListener('DOMContentLoaded', function(){
      renderList(); renderCharts(); updateSummary();
      // refresh dashboard after goals module initialized
      if (typeof window.updateDashboardSummary === 'function') window.updateDashboardSummary();
      // compute available balances on load
      updateGoalsAvailableBalances();
      const form = qs('goal-form'); if (form) form.addEventListener('submit', addOrUpdate);
      const dateEl = qs('goal-date'); if (dateEl) dateEl.addEventListener('change', function(){ const d=new Date(this.value); if (!isNaN(d)){ const months=["January","February","March","April","May","June","July","August","September","October","November","December"]; if (qs('goal-month')) qs('goal-month').value = months[d.getMonth()]; if (qs('goal-year')) qs('goal-year').value = d.getFullYear(); } });
      const viz = qs('goal-viz-month'); if (viz) viz.addEventListener('change', function(){ renderCharts(); updateSummary(); });
      const summarySel = qs('goal-summary-month'); if (summarySel) summarySel.addEventListener('change', function(){ updateSummary(); renderCharts(); renderList(); });
    });

  })();

  // --- Notification Modal ---
  function showNotification(title, message) {
    const modal = qs('notification-modal');
    if (modal) {
      qs('modal-title').textContent = title;
      qs('modal-message').textContent = message;
      modal.classList.remove('hidden');
    }
  }

  function closeModal() {
    const modal = qs('notification-modal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }
  window.showNotification = showNotification; // Expose to global scope
  window.closeModal = closeModal; // Expose to global scope

  // --- Export Functions (for Budget and Goals) ---
  // These functions will need to be implemented using the xlsx, jspdf, and docx libraries.
  // This is a placeholder for the actual implementation.

  // Generic export function for budget and goals
  async function exportData(data, filename, format, type) {
    if (!data || data.length === 0) {
      showNotification('Export Failed', 'No data to export.');
      return;
    }

    const headers = {
      'budget': ['Type', 'Description', 'Amount', 'Month', 'Year', 'Date Updated'],
      'goals': ['Type', 'Description', 'Amount', 'Monthly Goal', 'Balance', 'Month', 'Year', 'Date Updated', 'Available Balance']
    };

    const getRow = (item, type) => {
      if (type === 'budget') {
        return [
          item.type,
          item.desc,
          Number(item.amount).toFixed(2),
          item.month || '',
          item.year || '',
          item.date || ''
        ];
      } else if (type === 'goals') {
        return [
          getGoalTypeLabel(item.type),
          item.desc,
          Number(item.amount).toFixed(2),
          Number(item.monthly || 0).toFixed(2),
          Number(item.balance || 0).toFixed(2),
          item.month || '',
          item.year || '',
          item.date || '',
          Number(item.availableBalance || 0).toFixed(2)
        ];
      }
      return [];
    };

    const rows = [headers[type], ...data.map(item => getRow(item, type))];

    if (format === 'csv') {
      const csvContent = rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
      showNotification('Export Successful', `Data exported to ${filename}.csv`);
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
      XLSX.writeFile(wb, `${filename}.xlsx`);
      showNotification('Export Successful', `Data exported to ${filename}.xlsx`);
    } else if (format === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.autoTable({
        head: [headers[type]],
        body: data.map(item => getRow(item, type)),
        startY: 10,
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [156, 137, 184] }, // bloom-purple
        alternateRowStyles: { fillColor: [226, 209, 249] } // bloom-lavender
      });
      doc.save(`${filename}.pdf`);
      showNotification('Export Successful', `Data exported to ${filename}.pdf`);
    } else if (format === 'docx') {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } = docx;

      const tableRows = rows.map((row, i) => {
        const cells = row.map(cellData => new TableCell({
          children: [new Paragraph(String(cellData))],
          shading: {
            fill: i === 0 ? "9C89B8" : (i % 2 === 0 ? "E2D1F9" : "FFFFFF"), // Header: bloom-purple, Even: bloom-lavender, Odd: white
            val: docx.ShadingType.CLEAR,
            color: "auto",
          },
        }));
        return new TableRow({ children: cells });
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: filename.replace(/-/g, ' ').toUpperCase(),
                  bold: true,
                  size: 32, // 16pt
                }),
              ],
              alignment: docx.AlignmentType.CENTER,
            }),
            new Paragraph(""), // Spacer
            new Table({
              rows: tableRows,
              width: {
                size: 100,
                type: docx.WidthType.PERCENTAGE,
              },
            }),
          ],
        }],
      });

      Packer.toBlob(doc).then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.docx`;
        link.click();
        showNotification('Export Successful', `Data exported to ${filename}.docx`);
      }).catch(error => {
        console.error("Error exporting DOCX:", error);
        showNotification('Export Failed', 'Could not export to DOCX.');
      });
    }
  }

  // Specific export functions for buttons
  window.exportSummary = function(format) {
    const selectedMonth = qs('summary-month-filter')?.value || 'All';
    let dataToExport = window.budgetItems || [];
    if (selectedMonth !== 'All') {
      dataToExport = dataToExport.filter(item => item.month === selectedMonth);
    }
    exportData(dataToExport, `bloom-budget-summary-${selectedMonth.toLowerCase()}`, format, 'budget');
  };

  window.exportEmergency = function(format) {
    // For emergency/FD, we'll export the current summary values
    const totalIncome = parseFloat(qs('total-income')?.textContent || 0);
    const totalExpense = parseFloat(qs('total-expense')?.textContent || 0);
    const totalInvestment = parseFloat(qs('total-investment')?.textContent || 0);
    const totalSavings = parseFloat(qs('total-savings')?.textContent || 0);
    const balanceAmount = parseFloat(qs('balance-amount')?.textContent || 0);
    const emergencyTarget = parseFloat(qs('emergency-target')?.textContent || 0);
    const emergencyAvailable = parseFloat(qs('emergency-available')?.textContent || 0);
    const fdAvailable = parseFloat(qs('fd-available')?.textContent || 0);

    const data = [
      { label: 'Total Income', value: totalIncome },
      { label: 'Total Expenses', value: totalExpense },
      { label: 'Total Investments', value: totalInvestment },
      { label: 'Total Savings', value: totalSavings },
      { label: 'Current Balance', value: balanceAmount },
      { label: 'Emergency Fund Target (3x Expenses)', value: emergencyTarget },
      { label: 'Available for Emergency Fund', value: emergencyAvailable },
      { label: 'Available for Fixed Deposit', value: fdAvailable }
    ];

    const headers = ['Metric', 'Value (₹)'];
    const rows = [headers, ...data.map(item => [item.label, item.value.toFixed(2)])];

    if (format === 'csv') {
      const csvContent = rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `bloom-emergency-fd-summary.csv`;
      link.click();
      showNotification('Export Successful', `Data exported to bloom-emergency-fd-summary.csv`);
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Emergency & FD");
      XLSX.writeFile(wb, `bloom-emergency-fd-summary.xlsx`);
      showNotification('Export Successful', `Data exported to bloom-emergency-fd-summary.xlsx`);
    } else if (format === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.autoTable({
        head: [headers],
        body: data.map(item => [item.label, item.value.toFixed(2)]),
        startY: 10,
        styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
        headStyles: { fillColor: [255, 133, 162] }, // bloom-pink
        alternateRowStyles: { fillColor: [226, 209, 249] } // bloom-lavender
      });
      doc.save(`bloom-emergency-fd-summary.pdf`);
      showNotification('Export Successful', `Data exported to bloom-emergency-fd-summary.pdf`);
    } else if (format === 'docx') {
      const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } = docx;

      const tableRows = rows.map((row, i) => {
        const cells = row.map(cellData => new TableCell({
          children: [new Paragraph(String(cellData))],
          shading: {
            fill: i === 0 ? "FF85A2" : (i % 2 === 0 ? "E2D1F9" : "FFFFFF"), // Header: bloom-pink, Even: bloom-lavender, Odd: white
            val: docx.ShadingType.CLEAR,
            color: "auto",
          },
        }));
        return new TableRow({ children: cells });
      });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "EMERGENCY FUND & FIXED DEPOSIT SUMMARY",
                  bold: true,
                  size: 32, // 16pt
                }),
              ],
              alignment: docx.AlignmentType.CENTER,
            }),
            new Paragraph(""), // Spacer
            new Table({
              rows: tableRows,
              width: {
                size: 100,
                type: docx.WidthType.PERCENTAGE,
              },
            }),
          ],
        }],
      });

      Packer.toBlob(doc).then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bloom-emergency-fd-summary.docx`;
        link.click();
        showNotification('Export Successful', `Data exported to bloom-emergency-fd-summary.docx`);
      }).catch(error => {
        console.error("Error exporting DOCX:", error);
        showNotification('Export Failed', 'Could not export to DOCX.');
      });
    }
  };

  window.exportGoalSummary = function(format) {
    const selectedMonth = qs('goal-summary-month')?.value || 'All';
    let dataToExport = window.goalsItems || [];
    if (selectedMonth !== 'All') {
      dataToExport = dataToExport.filter(item => item.month === selectedMonth);
    }
    exportData(dataToExport, `bloom-goal-summary-${selectedMonth.toLowerCase()}`, format, 'goals');
  };

  // Expose functions for inline HTML calls
  window.addBudgetItem = function(event) {
    event.preventDefault();
    BudgetModule.addOrUpdate(event);
  };
  window.renderBudgetCharts = function() {
    BudgetModule.renderCharts();
  };
  window.updateBudgetSummary = function() {
    BudgetModule.updateSummary();
  };

  window.addGoalItem = function(event) {
    event.preventDefault();
    GoalsModule.addOrUpdate(event);
  };
  window.renderGoalCharts = function() {
    GoalsModule.renderCharts();
  };
  window.updateGoalDescription = function() {
    // This function is called on change of goal-type, but its implementation
    // is not provided in the original script. It would typically update
    // the placeholder or provide a default description based on the selected type.
    // For now, it can remain empty or log a message.
    console.log("Goal type changed. Implement updateGoalDescription if needed.");
  };

  // Expose a few functions to global HTML attributes if needed
  window.toggleSidebar = toggleSidebar;
  window.toggleUserMenu = toggleUserMenu;
  window.handleLogout = handleLogout;
  window.showRegister = showRegister;
  window.showLogin = showLogin;
  // expose navigation and app-level functions used by inline onclick attributes
  window.navigateTo = navigateTo;
  window.showApp = showApp;

})();
