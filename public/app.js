/* ==========================================================================
   SANAIRO CLIENT APPLICATION ENGINE
   ========================================================================== */

// --- Global Application State ---
let state = {
  currentUser: null,
  currentView: 'home',
  intentionalMode: false,
  activeCategory: 'All',
  wellbeingStats: {
    screenTimeSec: 4320, // 1h 12m
    steps: 4200,
    waterGlasses: 3,
    habitStreak: 12,
    completedGoals: ['Morning Meditation (15m)']
  },
  timerSeconds: 1500, // 25:00 minutes
  timerInterval: null,
  timerRunning: false,
  joinedCommunities: ['Coding', 'AI', 'Mental Wellness'],
  posts: [],
  reels: [],
  reelsViewedCount: 0,
  screentimeTicker: null
};

const API_BASE = '/api';

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDapwBghLqetmI1B6ZRr_TJuND6LdGxEeU",
  authDomain: "sanario.firebaseapp.com",
  projectId: "sanario",
  storageBucket: "sanario.firebasestorage.app",
  messagingSenderId: "531380890083",
  appId: "1:531380890083:web:b57d45179a4325a80f18d6",
  measurementId: "G-QS4QTY1TDR"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// --- Helper: API Calls ---
async function apiCall(endpoint, method = 'GET', data = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  
  const token = localStorage.getItem('sanairo_jwt_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (state.currentUser) {
    headers['x-user-id'] = state.currentUser.id; // Fallback helper
  }

  const config = {
    method,
    headers
  };
  if (data) {
    config.body = JSON.stringify(data);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const json = await response.json();
  if (!response.ok) {
    throw new Error(json.error || 'Server error occurred.');
  }
  return json;
}

// --- Init on DOM Load ---
document.addEventListener('DOMContentLoaded', () => {
  checkAutoLogin();
  setupScreentimeTicker();
  initGoogleIdentitySDK();
});

// Initialize Official Google Identity SDK
function initGoogleIdentitySDK() {
  if (typeof google !== 'undefined') {
    google.accounts.id.initialize({
      client_id: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com", // Replace with real production client ID in .env
      callback: handleCredentialResponse
    });
  }
}

// Callback for Official Google Identity Services SDK
async function handleCredentialResponse(response) {
  const errDiv = document.getElementById('login-error');
  if (errDiv) errDiv.classList.add('hidden');

  try {
    const res = await apiCall('/auth/google-login', 'POST', { idToken: response.credential });
    if (res.success) {
      loginUser(res.user, res.token);
    }
  } catch (err) {
    if (errDiv) {
      errDiv.textContent = 'Google Sign-in failed: ' + err.message;
      errDiv.classList.remove('hidden');
    } else {
      alert('Google Sign-in failed: ' + err.message);
    }
  }
}

// --- Ticker: Simulate Screen Time ---
function setupScreentimeTicker() {
  state.screentimeTicker = setInterval(async () => {
    if (state.currentUser && state.currentView !== 'login') {
      state.wellbeingStats.screenTimeSec += 10; // Add 10 seconds of active screen time
      
      // Update screen time values on UI directly
      updateWellbeingUI();
      
      // Periodically sync screen time with backend (every 60s)
      if (state.wellbeingStats.screenTimeSec % 60 === 0) {
        try {
          const res = await apiCall('/wellbeing/update', 'POST', {
            screenTimeSec: state.wellbeingStats.screenTimeSec
          });
          if (res.risks) renderRisks(res.risks);
        } catch (err) {
          console.error('Failed to sync screen time:', err);
        }
      }
    }
  }, 10000); // Check/update every 10 seconds
}

// --- Google Auth Popup (Simulated Dev popup fallback) ---
async function openGoogleLoginPopup() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const errDiv = document.getElementById('login-error');
  if (errDiv) errDiv.classList.add('hidden');

  try {
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    const idToken = await user.getIdToken();
    
    const res = await apiCall('/auth/firebase-login', 'POST', {
      idToken,
      email: user.email,
      name: user.displayName,
      profilePic: user.photoURL
    });
    if (res.success) {
      loginUser(res.user, res.token);
    }
  } catch (error) {
    if (errDiv) {
      errDiv.textContent = 'Google Sign-in failed: ' + error.message;
      errDiv.classList.remove('hidden');
    } else {
      alert('Google Sign-in failed: ' + error.message);
    }
  }
}

// --- Auth Handling ---
async function checkAutoLogin() {
  const cachedToken = localStorage.getItem('sanairo_jwt_token');
  const cachedUserId = localStorage.getItem('sanairo_user_id');
  
  if (cachedToken || cachedUserId) {
    try {
      const headers = {};
      if (cachedToken) headers['Authorization'] = `Bearer ${cachedToken}`;
      if (cachedUserId) headers['x-user-id'] = cachedUserId;

      const res = await fetch(`${API_BASE}/auth/me`, {
        headers
      });
      const data = await res.json();
      if (data.success) {
        loginUser(data.user, cachedToken);
      } else {
        localStorage.removeItem('sanairo_jwt_token');
        localStorage.removeItem('sanairo_user_id');
        showAuthScreen();
      }
    } catch (e) {
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
}

function switchAuthTab(tab) {
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const loginForm = document.getElementById('form-login');
  const regForm = document.getElementById('form-register');
  const phoneForm = document.getElementById('form-phone-login');

  if (tab === 'login') {
    loginTab.classList.add('active');
    regTab.classList.remove('active');
    
    // Reset login view to show password form, hide phone form
    loginForm.style.display = 'block';
    loginForm.classList.add('active');
    
    if (phoneForm) {
      phoneForm.style.display = 'none';
      phoneForm.classList.remove('active');
    }
    
    regForm.classList.remove('active');
  } else {
    regTab.classList.add('active');
    loginTab.classList.remove('active');
    
    regForm.classList.add('active');
    
    // Hide both password and phone login forms
    loginForm.classList.remove('active');
    loginForm.style.display = 'none';
    
    if (phoneForm) {
      phoneForm.style.display = 'none';
      phoneForm.classList.remove('active');
    }

    // Reset wizard to first step
    nextOnboardingStep(1);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const u = document.getElementById('login-username').value;
  const p = document.getElementById('login-password').value;
  const errDiv = document.getElementById('login-error');
  
  errDiv.classList.add('hidden');

  try {
    const res = await apiCall('/auth/login', 'POST', { username: u, password: p });
    if (res.success) {
      loginUser(res.user, res.token);
    }
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  }
}

function togglePhoneAuthSection(showPhone) {
  const formLogin = document.getElementById('form-login');
  const formPhone = document.getElementById('form-phone-login');
  const errDiv = document.getElementById('phone-login-error');
  if (errDiv) errDiv.classList.add('hidden');
  
  if (showPhone) {
    formLogin.style.display = 'none';
    formPhone.style.display = 'block';
  } else {
    formLogin.style.display = 'block';
    formPhone.style.display = 'none';
    resetPhoneOTPForm();
  }
}

let recaptchaVerifier = null;
let confirmationResult = null;

async function sendPhoneOTP() {
  const phoneInput = document.getElementById('login-phone').value.trim();
  const errDiv = document.getElementById('phone-login-error');
  errDiv.classList.add('hidden');

  if (!phoneInput) {
    errDiv.textContent = 'Please enter a valid phone number with country code (e.g., +919876543210).';
    errDiv.classList.remove('hidden');
    return;
  }

  try {
    // Clear reCAPTCHA DOM to prevent "already rendered" errors on retries
    const container = document.getElementById('recaptcha-container');
    if (container) {
      container.innerHTML = '';
    }

    recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      'size': 'invisible'
    });

    const confirmation = await auth.signInWithPhoneNumber(phoneInput, recaptchaVerifier);
    confirmationResult = confirmation;

    // Toggle to step 2 (OTP code input)
    document.getElementById('phone-input-step').classList.add('hidden');
    document.getElementById('phone-otp-step').classList.remove('hidden');
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
    if (recaptchaVerifier) {
      try {
        recaptchaVerifier.clear();
      } catch(e){}
      recaptchaVerifier = null;
    }
  }
}

async function handleVerifyOTP(event) {
  event.preventDefault();
  const code = document.getElementById('login-otp').value.trim();
  const errDiv = document.getElementById('phone-login-error');
  errDiv.classList.add('hidden');

  if (!code) {
    errDiv.textContent = 'Verification code is required.';
    errDiv.classList.remove('hidden');
    return;
  }

  if (!confirmationResult) {
    errDiv.textContent = 'No active confirmation session found. Please send code again.';
    errDiv.classList.remove('hidden');
    return;
  }

  try {
    const result = await confirmationResult.confirm(code);
    const user = result.user;
    const idToken = await user.getIdToken();

    // Call server to login or create matching postgres user record
    const res = await apiCall('/auth/firebase-login', 'POST', {
      idToken,
      phone: user.phoneNumber,
      name: user.displayName || `User ${user.phoneNumber.slice(-4)}`
    });

    if (res.success) {
      loginUser(res.user, res.token);
      resetPhoneOTPForm();
    }
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  }
}

function resetPhoneOTPForm() {
  document.getElementById('phone-input-step').classList.remove('hidden');
  document.getElementById('phone-otp-step').classList.add('hidden');
  document.getElementById('login-otp').value = '';
  const hintBanner = document.getElementById('otp-hint-banner');
  if (hintBanner) {
    hintBanner.style.display = 'none';
    hintBanner.textContent = '';
  }
  if (recaptchaVerifier) {
    try {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    } catch(e){}
  }
  confirmationResult = null;
}

async function handleRegister(event) {
  event.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const u = document.getElementById('reg-username').value.trim();
  const p = document.getElementById('reg-password').value;
  const errDiv = document.getElementById('register-error');
  
  errDiv.classList.add('hidden');

  const interestEls = document.querySelectorAll('input[name="reg-interests"]:checked');
  const interests = Array.from(interestEls).map(el => el.value);

  const growthVibe = document.getElementById('reg-growth-vibe').value.trim();
  const stepsGoal = parseInt(document.getElementById('reg-step-goal').value) || 8000;
  const waterGoal = parseInt(document.getElementById('reg-water-goal').value) || 8;
  const screentimeLimit = parseInt(document.getElementById('reg-screentime-limit').value) || 120;

  if (!name || !u || !p) {
    errDiv.textContent = 'Please fill out your account details in Step 1.';
    errDiv.classList.remove('hidden');
    nextOnboardingStep(1);
    return;
  }

  if (p.length < 6) {
    errDiv.textContent = 'Password must be at least 6 characters.';
    errDiv.classList.remove('hidden');
    nextOnboardingStep(1);
    return;
  }

  try {
    const res = await apiCall('/auth/register', 'POST', {
      username: u,
      password: p,
      name,
      interests,
      growthVibe,
      stepsGoal,
      waterGoal,
      screentimeLimit
    });
    if (res.success) {
      loginUser(res.user, res.token);
    }
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  }
}

// Onboarding wizard steps navigation
function nextOnboardingStep(step) {
  // Validate step 1 credentials before continuing
  if (step === 2 || step === 3) {
    const name = document.getElementById('reg-name').value.trim();
    const u = document.getElementById('reg-username').value.trim();
    const p = document.getElementById('reg-password').value;
    
    if (!name || !u || !p) {
      alert('Please fill out your Name, Username, and Password first.');
      return;
    }
    if (p.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
  }

  // Update DOM views
  document.querySelectorAll('.onboarding-step').forEach(el => el.classList.remove('active'));
  const targetStep = document.getElementById(`onboarding-step-${step}`);
  if (targetStep) targetStep.classList.add('active');

  // Update Indicators
  document.querySelectorAll('.step-dot').forEach(el => el.classList.remove('active'));
  for (let i = 1; i <= step; i++) {
    const dot = document.getElementById(`dot-step-${i}`);
    if (dot) dot.classList.add('active');
  }

  // Update Progress line
  const fill = document.getElementById('onboarding-progress-fill');
  if (fill) {
    const widthPct = step === 1 ? 33.33 : step === 2 ? 66.66 : 100;
    fill.style.width = `${widthPct}%`;
  }
}

function loginUser(user, token) {
  state.currentUser = user;
  if (token) {
    localStorage.setItem('sanairo_jwt_token', token);
  }
  localStorage.setItem('sanairo_user_id', user.id);
  
  // Set UI elements
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  
  // Apply Saved Theme
  document.body.className = '';
  document.body.classList.add(`theme-${user.theme || 'nature'}`);

  updateUserProfileUI();
  syncWellbeingAndRisks();
  loadFeed();
  loadStories();
  navigateTo('home');
}

function handleLogout() {
  state.currentUser = null;
  localStorage.removeItem('sanairo_jwt_token');
  localStorage.removeItem('sanairo_user_id');
  clearInterval(state.screentimeTicker);
  showAuthScreen();
}

// --- Navigation ---
function navigateTo(viewId) {
  state.currentView = viewId;

  // Pause all playing video elements in feed or reels when tab changes
  const videos = document.querySelectorAll('video');
  videos.forEach(v => {
    try { v.pause(); } catch(e) {}
  });

  // Toggle active class on sidebar items
  const navItems = document.querySelectorAll('.left-sidebar .nav-item');
  navItems.forEach(item => {
    item.classList.remove('active');
  });

  const activeNavItem = document.getElementById(`nav-${viewId}`);
  if (activeNavItem) activeNavItem.classList.add('active');

  // Show/Hide page views
  const views = document.querySelectorAll('.app-view');
  views.forEach(view => {
    view.classList.add('hidden');
    view.classList.remove('active');
  });

  const activeView = document.getElementById(`view-${viewId}`);
  if (activeView) {
    activeView.classList.remove('hidden');
    activeView.classList.add('active');
  }

  // Load contextual view data
  if (viewId === 'home') {
    loadFeed();
  } else if (viewId === 'reels') {
    loadReels();
  } else if (viewId === 'chat') {
    loadChat();
  } else if (viewId === 'profile') {
    renderProfileView();
  } else if (viewId === 'health') {
    syncWellbeingAndRisks();
  }
}

// --- Update Core UIs ---
function updateUserProfileUI() {
  const user = state.currentUser;
  if (!user) return;

  const pic = user.profile_pic || user.profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

  // Right Sidebar headers
  document.getElementById('right-user-pic').src = pic;
  document.getElementById('right-user-name').textContent = user.name;
  document.getElementById('right-user-xp').textContent = user.xp;
  document.getElementById('right-user-badge').innerHTML = `${user.badge} • <span id="right-user-xp">${user.xp}</span> XP`;

  // Profile View elements
  const avatar = document.getElementById('profile-avatar');
  const nameVal = document.getElementById('profile-display-name');
  const tagVal = document.getElementById('profile-username-tag');
  const xpVal = document.getElementById('profile-xp-val');
  const xpProgress = document.getElementById('profile-xp-progress');
  const badgeVal = document.getElementById('profile-badge-val');

  if (avatar) avatar.src = pic;
  if (nameVal) nameVal.textContent = user.name;
  if (tagVal) tagVal.textContent = `@${user.username}`;
  if (xpVal) xpVal.textContent = user.xp;
  if (xpProgress) {
    const percentage = Math.min(100, (user.xp / 600) * 100);
    xpProgress.style.width = `${percentage}%`;
  }
  if (badgeVal) badgeVal.textContent = user.badge;
}

async function syncWellbeingAndRisks() {
  try {
    const res = await apiCall('/wellbeing');
    state.wellbeingStats = res.wellbeing;
    updateWellbeingUI();
    renderRisks(res.risks);
  } catch (err) {
    console.error('Failed to sync wellbeing stats:', err);
  }
}

function updateWellbeingUI() {
  const stats = state.wellbeingStats;
  
  const hours = Math.floor(stats.screenTimeSec / 3600);
  const minutes = Math.floor((stats.screenTimeSec % 3600) / 60);
  const screenTimeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  const stepsGoal = stats.stepsGoal || 8000;
  const waterGoal = stats.waterGoal || 8;
  const limitMin = stats.screentimeLimitMin || 120;

  document.getElementById('mini-screentime').textContent = screenTimeStr;
  document.getElementById('mini-steps').textContent = stats.steps.toLocaleString();
  document.getElementById('mini-water').textContent = `${stats.waterGlasses} / ${waterGoal}`;

  const healthSteps = document.getElementById('health-steps-val');
  const healthStepsProg = document.getElementById('health-steps-progress');
  const healthWater = document.getElementById('health-water-val');
  const healthWaterProg = document.getElementById('health-water-progress');
  const healthTime = document.getElementById('health-screentime-val');

  if (healthSteps) healthSteps.innerHTML = `${stats.steps.toLocaleString()} <span class="unit">steps</span>`;
  if (healthStepsProg) {
    const stepsPct = Math.min(100, (stats.steps / stepsGoal) * 100);
    healthStepsProg.style.width = `${stepsPct}%`;
  }
  const stepsGoalText = document.querySelector('.metric-goal');
  if (stepsGoalText && stepsGoalText.textContent.includes('Goal:')) {
    stepsGoalText.textContent = `Goal: ${stepsGoal.toLocaleString()} steps (Custom Onboarding target)`;
  }

  if (healthWater) healthWater.innerHTML = `${stats.waterGlasses} / ${waterGoal} <span class="unit">glasses</span>`;
  if (healthWaterProg) {
    const waterPct = Math.min(100, (stats.waterGlasses / waterGoal) * 100);
    healthWaterProg.style.width = `${waterPct}%`;
  }
  const waterGoalText = document.querySelectorAll('.metric-goal')[1];
  if (waterGoalText && waterGoalText.textContent.includes('Goal:')) {
    waterGoalText.textContent = `Goal: ${waterGoal} glasses (Custom Onboarding target)`;
  }

  if (healthTime) healthTime.textContent = screenTimeStr;

  const currentMin = stats.screenTimeSec / 60;
  const strainWarning = document.getElementById('screentime-warning');
  if (strainWarning) {
    if (currentMin >= limitMin) {
      strainWarning.textContent = `⚠️ Max screen session limit reached (${limitMin}m)! Please take a breathing break.`;
      strainWarning.style.color = 'var(--accent)';
    } else {
      const remaining = Math.round(limitMin - currentMin);
      strainWarning.textContent = `Target limit: ${limitMin} minutes. Next break in ${remaining}m.`;
      strainWarning.style.color = 'var(--text-muted)';
    }
  }

  const chWalk = document.getElementById('challenge-walk');
  const chScreen = document.getElementById('challenge-screen');
  const chRead = document.getElementById('challenge-read');
  
  if (chWalk) chWalk.checked = stats.steps >= 5000;
  if (chScreen) chScreen.checked = stats.completedGoals.includes('Digital Break');
  if (chRead) chRead.checked = stats.completedGoals.includes('Read Insight');
}

function renderRisks(risks = []) {
  const container = document.getElementById('wellness-alerts-container');
  if (!container) return;

  container.innerHTML = '';
  if (risks.length === 0) return;

  risks.forEach(risk => {
    const box = document.createElement('div');
    box.className = `risk-alert-box severity-${risk.severity}`;
    box.innerHTML = `
      <div class="risk-alert-header">
        <span class="material-icons">${risk.type === 'sleep_hygiene' ? 'bedtime' : risk.type === 'dehydration' ? 'local_drink' : 'directions_walk'}</span>
        <h4>${risk.title}</h4>
      </div>
      <p class="risk-alert-message">${risk.message}</p>
      <p class="risk-alert-recomm">Recommendation: ${risk.recommendation}</p>
    `;
    container.appendChild(box);
  });
}

function loadStories() {
  const stories = [
    { name: 'Dr. Elena R.', pic: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', intention: 'Focus Block (45m)' },
    { name: 'Dev Guy', pic: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80', intention: 'Code Express server' },
    { name: 'Marcus Run', pic: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&h=150&q=80', intention: 'WHO 8k Walk' },
    { name: 'Calm Mind', pic: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&h=150&q=80', intention: 'Deep breathing reset' }
  ];

  const container = document.getElementById('stories-container');
  if (!container) return;

  container.innerHTML = '';
  stories.forEach(st => {
    const wrap = document.createElement('div');
    wrap.className = 'story-circle-wrapper';
    wrap.onclick = () => sendQuickMessage(`Tell me about your friend ${st.name}'s intention: "${st.intention}"`);
    wrap.innerHTML = `
      <div class="story-ring">
        <img src="${st.pic}" alt="${st.name}">
      </div>
      <div class="story-username">${st.name}</div>
      <div class="story-intention-tooltip">${st.intention}</div>
    `;
    container.appendChild(wrap);
  });
}

// --- Load Feed & ML personalization ---
async function loadFeed() {
  try {
    const res = await apiCall('/posts');
    state.posts = res.posts;
    renderFeed();
  } catch (err) {
    console.error('Failed to load feed:', err);
  }
}

function renderFeed() {
  const container = document.getElementById('feed-list-container');
  if (!container) return;

  container.innerHTML = '';
  
  let filtered = state.posts;
  if (state.activeCategory !== 'All') {
    filtered = state.posts.filter(p => p.category === state.activeCategory);
  }

  const reflectionSaved = !document.getElementById('saved-reflection-display').classList.contains('hidden');

  if (state.intentionalMode) {
    if (!reflectionSaved) {
      container.innerHTML = `<div class="text-center font-lora" style="padding: var(--spacing-xl); color: var(--text-muted);">Please save your Morning Reflection before starting your intentional session.</div>`;
      document.getElementById('breathe-card-break').classList.add('hidden');
      document.getElementById('natural-resting-point').classList.add('hidden');
      return;
    }
    filtered = filtered.slice(0, 1);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-center font-lora" style="padding: var(--spacing-xl); color: var(--text-muted);">No focus insights in this category yet. Click "Create Insight" to start!</div>`;
    return;
  }

  filtered.forEach(post => {
    const card = document.createElement('article');
    card.className = 'post-card';
    
    // Render diagrams if post contains it
    let diagramHtml = '';
    if (post.hasDiagram && post.diagramType === 'focus-distraction') {
      diagramHtml = `
        <div class="post-diagram-container">
          <svg viewBox="0 0 500 120" class="custom-diagram">
            <line x1="20" y1="60" x2="480" y2="60" stroke="var(--border)" stroke-width="2" />
            <line x1="20" y1="60" x2="480" y2="60" stroke="var(--primary)" stroke-width="4" stroke-dasharray="2,2" />
            <path d="M 20 60 Q 120 40 240 60 T 480 60" fill="none" stroke="var(--primary)" stroke-width="3" />
            <path d="M 50 60 L 70 20 L 90 60 M 180 60 L 200 10 L 220 60 M 340 60 L 360 30 L 380 60" fill="none" stroke="var(--accent)" stroke-width="2" />
            
            <circle cx="20" cy="60" r="6" fill="var(--primary)" />
            <circle cx="480" cy="60" r="6" fill="var(--primary)" />
            <text x="20" y="85" font-family="var(--font-ui)" font-size="10" fill="var(--text-muted)" font-weight="700">START</text>
            <text x="440" y="85" font-family="var(--font-ui)" font-size="10" fill="var(--primary)" font-weight="700">DEEP WORK</text>
            <text x="75" y="15" font-family="var(--font-ui)" font-size="9" fill="var(--accent)">Notification</text>
            <text x="205" y="10" font-family="var(--font-ui)" font-size="9" fill="var(--accent)">Email Alert</text>
          </svg>
        </div>
      `;
    }

    // Attach Media Layout
    let mediaHtml = '';
    if (post.mediaType === 'image' && post.mediaUrl) {
      mediaHtml = `
        <div class="post-media-container">
          <img src="${post.mediaUrl}" alt="Post attachment">
        </div>
      `;
    } else if (post.mediaType === 'video' && post.mediaUrl) {
      mediaHtml = `
        <div class="post-media-container">
          <video src="${post.mediaUrl}" loop muted autoplay playsinline></video>
        </div>
      `;
    }

    const isValuable = post.valuables && post.valuables.includes(state.currentUser.id);
    const valuableClass = isValuable ? 'active' : '';

    card.innerHTML = `
      <div class="post-header">
        <div class="post-author" onclick="sendQuickMessage('Show me profile details for ${post.authorName}')">
          <img src="${post.authorPic}" alt="${post.authorName}">
          <div>
            <div class="post-author-name">${post.authorName}</div>
            <span class="post-tag">${post.category}</span>
          </div>
        </div>
        <div class="quality-badge">Quality Rank: ${(post.qualityScore * 10).toFixed(1)}</div>
      </div>
      
      <div class="post-body">${post.content}</div>
      
      ${mediaHtml}
      ${diagramHtml}
      
      <div class="post-actions">
        <button class="post-action-btn ${valuableClass}" onclick="toggleValuable('${post.id}')">
          <span class="material-icons">${isValuable ? 'verified' : 'workspace_premium'}</span>
          <span>Valuable (${post.valuableCount || 0})</span>
        </button>
        <button class="post-action-btn" onclick="toggleCommentsDisplay('${post.id}')">
          <span class="material-icons">chat</span>
          <span>Discuss</span>
        </button>
      </div>

      <div class="comments-section hidden" id="comments-sec-${post.id}">
        <div class="comments-list" id="comments-list-${post.id}">
          <!-- Comments loaded dynamically -->
        </div>
        <form class="comment-input-form" onsubmit="handleSendComment(event, '${post.id}')">
          <input type="text" placeholder="Add to discussion..." id="comment-input-${post.id}" required>
          <button type="submit" class="btn btn-primary btn-sm">Post</button>
        </form>
      </div>
    `;

    container.appendChild(card);
  });

  if (state.intentionalMode) {
    document.getElementById('breathe-card-break').classList.remove('hidden');
    document.getElementById('natural-resting-point').classList.remove('hidden');
  } else {
    document.getElementById('breathe-card-break').classList.add('hidden');
    document.getElementById('natural-resting-point').classList.add('hidden');
  }
}

// --- Mindful Reels Loader & Anti-Doomscroll ---
async function loadReels() {
  try {
    const res = await apiCall('/reels');
    state.reels = res.reels;
    renderReels();
  } catch (err) {
    console.error('Failed to load reels:', err);
  }
}

function renderReels() {
  const container = document.getElementById('reels-deck-container');
  if (!container) return;

  container.innerHTML = '';
  
  if (state.reels.length === 0) {
    container.innerHTML = `<div class="text-center font-lora" style="padding: var(--spacing-xl); color: var(--text-muted);">No reels uploaded yet.</div>`;
    return;
  }

  state.reels.forEach((reel, idx) => {
    const card = document.createElement('div');
    card.className = 'reel-card';
    
    const isVal = reel.valuables && reel.valuables.includes(state.currentUser.id);
    const activeClass = isVal ? 'active' : '';

    card.innerHTML = `
      <div class="reel-video-wrapper">
        <video src="${reel.mediaUrl}" loop playsinline id="reel-vid-${reel.id}" onclick="toggleReelPlayback('${reel.id}')"></video>
        
        <!-- Overlay details -->
        <div class="reel-overlay">
          <div class="reel-author">
            <img src="${reel.authorPic}" alt="${reel.authorName}">
            <h4>${reel.authorName}</h4>
            <span class="reel-tag">${reel.category}</span>
          </div>
          <div class="reel-title font-lora">${reel.title}</div>
          <div class="reel-desc">${reel.description}</div>
        </div>

        <!-- Sidebar Floating Actions -->
        <div class="reel-actions-column">
          <div>
            <button class="reel-action-btn-circle" onclick="toggleReelValuable('${reel.id}')">
              <span class="material-icons" style="color: ${isVal ? '#f5b041' : '#fff'};">verified</span>
            </button>
            <div class="reel-action-label">${reel.valuableCount || 0}</div>
          </div>
          
          <div>
            <button class="reel-action-btn-circle" onclick="sendQuickMessage('Let us talk about the reel: ${reel.title}')">
              <span class="material-icons">chat</span>
            </button>
            <div class="reel-action-label">Discuss</div>
          </div>

          <div>
            <button class="reel-action-btn-circle" onclick="toggleReelMute('${reel.id}')">
              <span class="material-icons" id="mute-icon-${reel.id}">volume_off</span>
            </button>
            <div class="reel-action-label">Mute</div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
    
    // Automatically play the first reel on load
    if (idx === 0) {
      setTimeout(() => {
        const firstVid = document.getElementById(`reel-vid-${reel.id}`);
        if (firstVid) {
          firstVid.muted = true;
          firstVid.play().catch(e => console.log('Autoplay blocked'));
          document.getElementById(`mute-icon-${reel.id}`).textContent = 'volume_off';
        }
      }, 300);
    }
  });

  // Attach scroll listener to enforce Anti-Doomscrolling
  container.onscroll = () => {
    trackReelsDoomscrolling();
  };
}

function toggleReelPlayback(reelId) {
  const video = document.getElementById(`reel-vid-${reelId}`);
  if (!video) return;

  if (video.paused) {
    // Pause other videos
    document.querySelectorAll('video').forEach(v => {
      if (v.id !== `reel-vid-${reelId}`) v.pause();
    });
    video.play();
  } else {
    video.pause();
  }
}

async function toggleReelValuable(reelId) {
  try {
    const res = await apiCall(`/reels/${reelId}/valuable`, 'POST');
    const index = state.reels.findIndex(r => r.id === reelId);
    if (index !== -1) {
      state.reels[index] = res.reel;
    }
    if (res.user) {
      state.currentUser = res.user;
      updateUserProfileUI();
    }
    renderReels();
  } catch (err) {
    console.error(err);
  }
}

function toggleReelMute(reelId) {
  const video = document.getElementById(`reel-vid-${reelId}`);
  const icon = document.getElementById(`mute-icon-${reelId}`);
  if (!video) return;

  video.muted = !video.muted;
  icon.textContent = video.muted ? 'volume_off' : 'volume_up';
}

// Track reels scrolled to trigger screen freezes
let lastScrolledIndex = 0;
function trackReelsDoomscrolling() {
  const container = document.getElementById('reels-deck-container');
  const cards = document.querySelectorAll('.reel-card');
  if (!container || cards.length === 0) return;

  // Estimate active reel index based on scroll position
  const scrollTop = container.scrollTop;
  const activeIdx = Math.round(scrollTop / 644); // 620 card height + 24 gap

  if (activeIdx !== lastScrolledIndex && activeIdx >= 0 && activeIdx < cards.length) {
    lastScrolledIndex = activeIdx;
    
    // Play active video, pause others
    cards.forEach((card, idx) => {
      const vid = card.querySelector('video');
      if (vid) {
        if (idx === activeIdx) {
          vid.play().catch(e => {});
        } else {
          vid.pause();
        }
      }
    });

    // Increment doomscroll counter
    state.reelsViewedCount++;
    console.log(`Reels viewed this session: ${state.reelsViewedCount}`);

    if (state.reelsViewedCount >= 3) {
      // Pause active reel
      const activeVid = cards[activeIdx].querySelector('video');
      if (activeVid) activeVid.pause();

      setTimeout(() => {
        alert('📵 Digital Health Break: You have watched 3 short video reels. To prevent addictive scrolling and protect focus, Sanairo requests a 1-minute breathing reset.');
        state.reelsViewedCount = 0; // reset
        triggerBreathingSession();
      }, 500);
    }
  }
}

// --- Feed Filter Category ---
function filterCategory(category) {
  state.activeCategory = category;
  
  const pills = document.querySelectorAll('.category-filters .filter-pill');
  pills.forEach(pill => {
    pill.classList.remove('active');
    if (pill.textContent.toLowerCase() === category.toLowerCase() || 
       (category === 'All' && pill.textContent.includes('All'))) {
      pill.classList.add('active');
    }
  });

  renderFeed();
}

// --- Post Actions ---
async function toggleValuable(postId) {
  try {
    const res = await apiCall(`/posts/${postId}/valuable`, 'POST');
    const index = state.posts.findIndex(p => p.id === postId);
    if (index !== -1) {
      state.posts[index] = res.post;
    }
    if (res.user) {
      state.currentUser = res.user;
      updateUserProfileUI();
    }
    renderFeed();
  } catch (err) {
    console.error('Failed to toggle valuable status:', err);
  }
}

async function toggleCommentsDisplay(postId) {
  const commentSection = document.getElementById(`comments-sec-${postId}`);
  if (!commentSection) return;

  commentSection.classList.toggle('hidden');

  if (!commentSection.classList.contains('hidden')) {
    try {
      const res = await apiCall(`/posts/${postId}/comments`);
      renderComments(postId, res.comments);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }
}

function renderComments(postId, comments = []) {
  const list = document.getElementById(`comments-list-${postId}`);
  if (!list) return;

  list.innerHTML = '';
  comments.forEach(c => {
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.innerHTML = `<span class="comment-author">${c.authorName}</span><span class="comment-text">${c.content}</span>`;
    list.appendChild(item);
  });
}

async function handleSendComment(event, postId) {
  event.preventDefault();
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;

  try {
    const res = await apiCall(`/posts/${postId}/comments`, 'POST', { content });
    input.value = '';
    
    const commentRes = await apiCall(`/posts/${postId}/comments`);
    renderComments(postId, commentRes.comments);
    
    state.currentUser.xp += 2;
    updateUserProfileUI();
  } catch (err) {
    alert(err.message);
  }
}

// --- Create Post & Media Presets ---
function openCreatePostModal() {
  document.getElementById('modal-create-post').classList.remove('hidden');
}

function closeCreatePostModal() {
  document.getElementById('modal-create-post').classList.add('hidden');
  document.getElementById('create-post-error').classList.add('hidden');
  
  // Reset
  document.getElementById('post-media-type').value = 'text';
  document.getElementById('post-media-url-group').classList.add('hidden');
  document.getElementById('post-media-url').value = '';
}

function togglePostMediaUrlInput(mediaTypeValue) {
  const group = document.getElementById('post-media-url-group');
  if (mediaTypeValue !== 'text') {
    group.classList.remove('hidden');
  } else {
    group.classList.add('hidden');
    document.getElementById('post-media-url').value = '';
  }
}

function setMediaPreset(url) {
  document.getElementById('post-media-url').value = url;
}

async function handleCreatePost(event) {
  event.preventDefault();
  const category = document.getElementById('post-category').value;
  const content = document.getElementById('post-content').value.trim();
  const mediaType = document.getElementById('post-media-type').value;
  const mediaUrl = document.getElementById('post-media-url').value.trim();
  const errDiv = document.getElementById('create-post-error');

  errDiv.classList.add('hidden');

  try {
    const res = await apiCall('/posts', 'POST', {
      content,
      category,
      mediaType,
      mediaUrl
    });
    if (res.success) {
      closeCreatePostModal();
      document.getElementById('post-content').value = '';
      
      state.posts.unshift(res.post);
      state.currentUser = res.user;
      
      updateUserProfileUI();
      renderFeed();
    }
  } catch (err) {
    errDiv.textContent = err.message;
    errDiv.classList.remove('hidden');
  }
}

// --- Smart Intentional Mode & Reflection ---
function toggleIntentionalMode(enabled) {
  state.intentionalMode = enabled;
  const layout = document.getElementById('app-container');
  const reflection = document.getElementById('intentional-reflection');
  const standardHeader = document.getElementById('standard-header');
  const badge = document.getElementById('mode-badge');

  if (enabled) {
    layout.classList.add('hide-right-sidebar');
    reflection.classList.remove('hidden');
    standardHeader.classList.add('hidden');
    badge.textContent = 'Intentional Mode (ON)';
    
    document.getElementById('reflection-text').value = '';
    document.getElementById('saved-reflection-display').classList.add('hidden');
    document.querySelector('.prompt-input-area').classList.remove('hidden');
  } else {
    layout.classList.remove('hide-right-sidebar');
    reflection.classList.add('hidden');
    standardHeader.classList.remove('hidden');
    badge.textContent = 'Intentional Mode';
  }

  renderFeed();
}

function saveReflection() {
  const text = document.getElementById('reflection-text').value.trim();
  if (!text) return;

  const display = document.getElementById('saved-reflection-display');
  const inputArea = document.querySelector('.prompt-input-area');

  display.textContent = `"${text}"`;
  display.classList.remove('hidden');
  inputArea.classList.add('hidden');

  renderFeed();
}

function triggerNextTopic() {
  const categories = ['Coding', 'Fitness', 'Mental Wellness', 'Productivity', 'Startups'];
  const next = categories[Math.floor(Math.random() * categories.length)];
  
  document.getElementById('reflection-text').value = '';
  document.getElementById('saved-reflection-display').classList.add('hidden');
  document.querySelector('.prompt-input-area').classList.remove('hidden');

  filterCategory(next);
  alert(`Focused topic changed to: ${next}. Please write your new topic reflection.`);
}

function concludeSession() {
  alert('Intentional session completed! Switch off Intentional Mode to browse general daily challenges.');
  toggleIntentionalMode(false);
  document.getElementById('intentional-mode-switch').checked = false;
}

// --- Health Hub Logs ---
async function incrementSteps(amount) {
  const currentSteps = state.wellbeingStats.steps + amount;
  try {
    const res = await apiCall('/wellbeing/update', 'POST', { steps: currentSteps });
    state.wellbeingStats = res.wellbeing;
    updateWellbeingUI();
    renderRisks(res.risks);
    
    if (res.user) {
      state.currentUser = res.user;
      updateUserProfileUI();
    }
  } catch (err) {
    console.error('Failed to update steps:', err);
  }
}

async function incrementWater() {
  const currentGlasses = state.wellbeingStats.waterGlasses + 1;
  try {
    const res = await apiCall('/wellbeing/update', 'POST', { waterGlasses: currentGlasses });
    state.wellbeingStats = res.wellbeing;
    updateWellbeingUI();
    renderRisks(res.risks);
  } catch (err) {
    console.error('Failed to update water glasses:', err);
  }
}

// --- Daily Challenges Sync ---
async function toggleChallenge(challengeText) {
  const completed = [...state.wellbeingStats.completedGoals];
  const index = completed.indexOf(challengeText);

  if (index === -1) {
    completed.push(challengeText);
  } else {
    completed.splice(index, 1);
  }

  try {
    const res = await apiCall('/wellbeing/update', 'POST', { completedGoals: completed });
    state.wellbeingStats = res.wellbeing;
    if (res.user) {
      state.currentUser = res.user;
      updateUserProfileUI();
    }
    updateWellbeingUI();
    renderRisks(res.risks);
  } catch (err) {
    console.error('Failed to toggle challenge:', err);
  }
}

// --- Deep Work Timer ---
function toggleDeepWorkTimer() {
  const btn = document.getElementById('btn-timer-toggle');
  
  if (state.timerRunning) {
    clearInterval(state.timerInterval);
    state.timerRunning = false;
    btn.innerHTML = `<span class="material-icons">play_arrow</span>`;
  } else {
    state.timerRunning = true;
    btn.innerHTML = `<span class="material-icons">pause</span>`;
    
    state.timerInterval = setInterval(() => {
      state.timerSeconds--;
      updateTimerDisplay();

      if (state.timerSeconds <= 0) {
        clearInterval(state.timerInterval);
        state.timerRunning = false;
        btn.innerHTML = `<span class="material-icons">play_arrow</span>`;
        state.timerSeconds = 1500;
        
        rewardTimerXP();
      }
    }, 1000);
  }
}

function resetDeepWorkTimer() {
  clearInterval(state.timerInterval);
  state.timerRunning = false;
  state.timerSeconds = 1500;
  document.getElementById('btn-timer-toggle').innerHTML = `<span class="material-icons">play_arrow</span>`;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const m = Math.floor(state.timerSeconds / 60).toString().padStart(2, '0');
  const s = (state.timerSeconds % 60).toString().padStart(2, '0');
  document.getElementById('timer-display-val').textContent = `${m}:${s}`;
}

async function rewardTimerXP() {
  alert('Deep Work focus session complete! You earned 50 XP.');
  try {
    const goals = [...state.wellbeingStats.completedGoals, 'Deep Work Session'];
    const res = await apiCall('/wellbeing/update', 'POST', { completedGoals: goals });
    state.wellbeingStats = res.wellbeing;
    if (res.user) {
      state.currentUser = res.user;
      updateUserProfileUI();
    }
    updateWellbeingUI();
  } catch (err) {
    console.error('Failed to reward XP:', err);
  }
}

// --- Breathing Exercise Modal Logic ---
let breathingCycleInterval = null;
let breathingTimeRemaining = 60;

function triggerBreathingSession() {
  document.getElementById('modal-breathing').classList.remove('hidden');
  startBreathingSequence();
}

function startBreathingSequence() {
  breathingTimeRemaining = 60;
  const pulseCircle = document.getElementById('breathing-pulse-circle');
  const instruction = document.getElementById('breathing-text-instruction');
  const timer = document.getElementById('breathing-timer-countdown');

  clearInterval(breathingCycleInterval);

  let cycleIndex = 0;
  const phases = [
    { text: 'Inhale deeply...', class: 'inhale' },
    { text: 'Hold your breath...', class: 'hold' },
    { text: 'Exhale slowly...', class: 'exhale' },
    { text: 'Rest empty...', class: 'rest' }
  ];

  function runCycle() {
    pulseCircle.className = 'breathing-circle';
    const currentPhase = phases[cycleIndex];
    pulseCircle.classList.add(currentPhase.class);
    instruction.textContent = currentPhase.text;

    cycleIndex = (cycleIndex + 1) % 4;
  }

  runCycle();
  
  breathingCycleInterval = setInterval(() => {
    breathingTimeRemaining -= 4;
    timer.textContent = `Time remaining: ${breathingTimeRemaining}s`;

    if (breathingTimeRemaining <= 0) {
      endBreathingSequence();
    } else {
      runCycle();
    }
  }, 4000);
}

async function endBreathingSequence() {
  clearInterval(breathingCycleInterval);
  document.getElementById('modal-breathing').classList.add('hidden');
  alert('Breathing exercise finished. Calm mind restored (+15 XP)');
  
  try {
    const res = await apiCall('/wellbeing/update', 'POST', { completedGoals: [...state.wellbeingStats.completedGoals, 'Digital Break'] });
    state.wellbeingStats = res.wellbeing;
    if (res.user) {
      state.currentUser = res.user;
      updateUserProfileUI();
    }
    updateWellbeingUI();
  } catch (err) {
    console.error(err);
  }
}

function closeBreathingModal() {
  clearInterval(breathingCycleInterval);
  document.getElementById('modal-breathing').classList.add('hidden');
}

// --- AI Coach Chat Flows ---
async function loadChat() {
  try {
    const res = await apiCall('/chat/coach');
    renderChat(res.chats);
  } catch (err) {
    console.error('Failed to load chat history:', err);
  }
}

function renderChat(messages = []) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  container.innerHTML = '';
  messages.forEach(msg => {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${msg.sender === 'coach' ? 'coach' : 'user'}`;
    bubble.innerHTML = msg.message.replace(/\n/g, '<br>');
    container.appendChild(bubble);
  });
  
  container.scrollTop = container.scrollHeight;
}

async function handleSendMessage(event) {
  if (event) event.preventDefault();
  
  const input = document.getElementById('chat-input-text');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  
  const container = document.getElementById('chat-messages-container');
  const userBubble = document.createElement('div');
  userBubble.className = 'chat-bubble user';
  userBubble.textContent = text;
  container.appendChild(userBubble);
  container.scrollTop = container.scrollHeight;

  try {
    const res = await apiCall('/chat/coach', 'POST', { message: text });
    
    renderChat(res.messages);
    
    if (res.action) {
      setTimeout(() => {
        executeCoachAction(res.action);
      }, 1000);
    }

    if (res.user) {
      state.currentUser = res.user;
      updateUserProfileUI();
    }
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

function sendQuickMessage(text) {
  document.getElementById('chat-input-text').value = text;
  navigateTo('chat');
  handleSendMessage(null);
}

function executeCoachAction(action) {
  if (action.type === 'start_breathing') {
    triggerBreathingSession();
  } else if (action.type === 'add_goals') {
    alert(`AI Coach updated your checklist: Added ${action.data.join(', ')}`);
    action.data.forEach(goal => {
      if (!state.wellbeingStats.completedGoals.includes(goal)) {
        toggleChallenge(goal);
      }
    });
  } else if (action.type === 'log_activity') {
    alert(`Stretch break logged successfully! XP rewarded.`);
  }
}

// --- Communities UI toggle ---
function toggleJoinCommunity(btn, communityName) {
  const index = state.joinedCommunities.indexOf(communityName);
  if (index === -1) {
    state.joinedCommunities.push(communityName);
    btn.textContent = 'Joined';
    btn.className = 'btn btn-secondary btn-sm full-width-btn';
    state.currentUser.xp += 10;
    updateUserProfileUI();
    alert(`Joined ${communityName} learning community! (+10 XP)`);
  } else {
    state.joinedCommunities.splice(index, 1);
    btn.textContent = 'Join Community';
    btn.className = 'btn btn-primary btn-sm full-width-btn';
  }
}

// --- Profile Custom Interests ---
function renderProfileView() {
  const container = document.getElementById('profile-interests-container');
  if (!container) return;

  container.innerHTML = '';
  
  const allFocus = ['Productivity', 'Coding', 'Fitness', 'Startups', 'Mental Wellness', 'Nutrition'];
  
  allFocus.forEach(interest => {
    const isChecked = state.currentUser.interests.includes(interest);
    const checkedAttr = isChecked ? 'checked' : '';
    
    container.innerHTML += `
      <label class="interest-checkbox-label">
        <input type="checkbox" name="profile-interests" value="${interest}" ${checkedAttr}>
        <span>${interest}</span>
      </label>
    `;
  });
}

async function saveUserInterests() {
  const interestEls = document.querySelectorAll('input[name="profile-interests"]:checked');
  const interests = Array.from(interestEls).map(el => el.value);

  try {
    state.currentUser.interests = interests;
    alert('Focus areas updated. Personalized feed will now adjust to these selections.');
    loadFeed();
  } catch (err) {
    console.error(err);
  }
}

async function changeTheme(themeName) {
  try {
    const res = await apiCall('/auth/theme', 'POST', { theme: themeName });
    if (res.success) {
      document.body.className = '';
      document.body.classList.add(`theme-${themeName}`);
      state.currentUser.theme = themeName;
      alert(`Visual theme switched to: ${themeName.toUpperCase()}`);
    }
  } catch (err) {
    console.error(err);
  }
}

// --- Search Handler ---
function handleSearch(event) {
  const term = event.target.value.toLowerCase().trim();
  if (term === '') {
    loadFeed();
    return;
  }

  const matched = state.posts.filter(p => 
    p.content.toLowerCase().includes(term) || 
    p.authorName.toLowerCase().includes(term) || 
    p.category.toLowerCase().includes(term)
  );

  renderFeedFiltered(matched);
}

function renderFeedFiltered(filteredPosts) {
  const container = document.getElementById('feed-list-container');
  if (!container) return;
  container.innerHTML = '';

  if (filteredPosts.length === 0) {
    container.innerHTML = `<div class="text-center font-lora" style="padding: var(--spacing-xl); color: var(--text-muted);">No matching insights found. Try another search.</div>`;
    return;
  }

  filteredPosts.forEach(post => {
    const card = document.createElement('article');
    card.className = 'post-card';
    card.innerHTML = `
      <div class="post-header">
        <div class="post-author">
          <img src="${post.authorPic}" alt="${post.authorName}">
          <div>
            <div class="post-author-name">${post.authorName}</div>
            <span class="post-tag">${post.category}</span>
          </div>
        </div>
        <div class="quality-badge">Score: ${(post.qualityScore * 10).toFixed(1)}</div>
      </div>
      <div class="post-body">${post.content}</div>
    `;
    container.appendChild(card);
  });
}

async function promptChangeAvatar() {
  const currentUrl = state.currentUser.profile_pic || state.currentUser.profilePic || '';
  const newUrl = prompt("Enter the URL of your new profile picture/avatar:", currentUrl);
  if (newUrl === null) return; // user cancelled

  const cleanUrl = newUrl.trim();
  if (!cleanUrl) {
    alert("Please enter a valid image URL.");
    return;
  }

  try {
    const res = await apiCall('/user/update-avatar', 'POST', { profilePic: cleanUrl });
    if (res.success) {
      state.currentUser.profile_pic = cleanUrl;
      state.currentUser.profilePic = cleanUrl;
      updateUserProfileUI();
      alert("Profile picture updated successfully!");
    }
  } catch (err) {
    alert("Failed to update profile picture: " + err.message);
  }
}
