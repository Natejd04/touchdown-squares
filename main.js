// Main App Logic - Firebase Version
// This file replaces all the JavaScript from football-pool.html with Firebase integration

import { auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  sendPasswordResetEmail
} from 'firebase/auth';

import {
  onSnapshot,
  doc,
  runTransaction,
  getDoc
} from 'firebase/firestore';

import {
  getAllUsers,
  getUser,
  createUser as dbCreateUser,
  updateUser as dbUpdateUser,
  getAllPools,
  getPool,
  createPool as dbCreatePool,
  updatePool as dbUpdatePool,
  updateSquare,
  updateMultipleSquares,
  addActivityLog,
  getActivityLogs,
  getUserActivityLogs,
  getFilteredActivityLogs
} from './database-service.js';

// Global app state
const app = {
  currentUser: null,
  users: [],
  pools: [],
  activityLog: [],
  isGuestMode: false,
  pendingSquareAssignment: null,
  currentEditingPool: null,
  pendingRandomSelection: null,
  countdownInterval: null,
  currentActivityPage: 1,
  filteredActivityLog: [],
  ITEMS_PER_PAGE: 100,
  poolListener: null, // For real-time pool updates
  currentViewingPoolId: null,

  // Helper function to format names as "First L."
  formatName(firstName, lastName) {
    if (!firstName || !lastName) return 'Unknown';
    return `${firstName} ${lastName.charAt(0)}.`;
  },

  // Toggle password visibility
  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const button = input.nextElementSibling;
    if (input.type === 'password') {
      input.type = 'text';
      if (button) button.textContent = '🙈';
    } else {
      input.type = 'password';
      if (button) button.textContent = '👁️';
    }
  },
  currentViewingPoolId: null, // Track which pool we're viewing


  // Seahawks taglines (randomly selected on page load)
  taglines: [
    "Go Hawks! Show those deflated Patriots how real champions play! 🦅💚",
    "12th Man > 12 PSI Patriots! Let's fly, Seahawks! 🏈",
    "Seahawks soaring high while Patriots deflate faster than their footballs! 🦅",
    "Legion of Boom > Legion of Doom (and Gloom Patriots)! 💚💙",
    "Real champions don't need deflated balls - Go Hawks! 🏆",
    "Seahawks: We catch passes, not scandals! Unlike some teams... 👀",
    "The only thing the Patriots intercept better than passes is controversy! Go Hawks! 🦅",
    "12th Man making more noise than Patriots fans making excuses! 📢",
    "Seahawks fly high, Patriots cheat low! Action Green forever! 💚",
    "Russell Wilson > Tom Shady... I mean Brady! Go Hawks! 🏈",
    "Patriots: Spying on signals since 2007. Seahawks: Just being awesome since 1976! 🦅",
    "The only rings the Patriots deserve are onion rings! Go Seahawks! 🏆",
    "Seahawks: Built by Carroll, not controversy! 💚💙",
    "Why do Patriots fans love their team? Because misery loves company! Go Hawks! 🦅",
    "Patriots' favorite play: The cover-up! Seahawks' favorite play: Touchdowns! 🏈",
    "Deflategate? More like Defeat-gate when they face the Hawks! 🦅",
    "12s don't need asterisks next to our championships! Go Seahawks! 💚",
    "Patriots playbook: Chapter 1 - Cheating. Seahawks playbook: Chapter 1 - Winning! 🏆",
    "The only thing more deflated than Patriots balls is their integrity! Fly Hawks Fly! 🦅",
    "Seahawks: Where the only thing we're pumping up is the crowd! 💚💙"
  ],

  // Set random tagline
  setRandomTagline() {
    const tagline = this.taglines[Math.floor(Math.random() * this.taglines.length)];
    console.log('🎲 Random tagline selected:', tagline);
    const taglineEl = document.querySelector('.tagline');
    if (taglineEl) {
      taglineEl.textContent = tagline;
      console.log('✅ Tagline updated!');
    } else {
      console.warn('⚠️ Tagline element not found!');
    }
  },

  // Format name as "First L."
  formatName(firstName, lastName) {
    if (!firstName || !lastName) return 'Unknown';
    return `${firstName} ${lastName.charAt(0)}.`;
  },

  // Check if all 5 scores have been submitted and confirmed
  isPoolCompleted(pool) {
    if (!pool.isLocked || !pool.scores) return false;
    
    const requiredPeriods = ['q1', 'q2', 'q3', 'q4', 'final'];
    return requiredPeriods.every(period => 
      pool.scores[period] && 
      pool.scores[period].confirmed === true &&
      pool.scores[period].seahawks !== undefined &&
      pool.scores[period].patriots !== undefined
    );
  },

  // Initialize the app
  async init() {
    console.log('🚀 Initializing Touchdown Squares...');
    
    // Set random tagline
    this.setRandomTagline();
    
    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
      if (user && !this.isGuestMode) {
        // User is signed in
        console.log('✅ User authenticated:', user.email);
        const userData = await getUser(user.uid);
        if (userData) {
          this.currentUser = { ...userData, id: user.uid };
          
          // Load data AFTER authentication
          await this.loadData();
          
          this.showMainContent();
          
          if (this.currentUser.needsPasswordChange) {
            document.getElementById('changePasswordModal').classList.add('active');
          }
        }
      } else if (this.isGuestMode) {
        // Guest mode
        await this.loadData();
        this.showMainContent();
      } else {
        // No user signed in
        this.showAuthSection();
      }
    });
  },

  // Load data from Firebase
  async loadData() {
    try {
      this.users = await getAllUsers();
      this.pools = await getAllPools();
      
      // Smart activity log loading based on user type
      if (this.currentUser) {
        if (this.currentUser.isAdmin) {
          // Admins: Load last 50 (unless filters applied)
          this.activityLog = await getActivityLogs(50);
          console.log(`📊 Loaded ${this.users.length} users, ${this.pools.length} pools, ${this.activityLog.length} logs (admin: last 50)`);
        } else {
          // Regular users: Load last 20 relevant to them
          this.activityLog = await getUserActivityLogs(this.currentUser.id, 20);
          console.log(`📊 Loaded ${this.users.length} users, ${this.pools.length} pools, ${this.activityLog.length} logs (user: last 20 personal)`);
        }
      } else {
        // Guest mode: No activity logs needed
        this.activityLog = [];
        console.log(`📊 Loaded ${this.users.length} users, ${this.pools.length} pools (guest mode)`);
      }

    } catch (error) {
      console.error('Error loading data:', error);
      this.showToast('Error loading data. Please refresh.', 'error');
    }
  },

  // Authentication functions
  async signup() {
    const firstName = document.getElementById('signupFirstName').value.trim();
    const lastName = document.getElementById('signupLastName').value.trim();
    const email = document.getElementById('signupEmail').value.trim().toLowerCase();
    const password = document.getElementById('signupPassword').value;

    const errorEl = document.getElementById('signupError');
    const successEl = document.getElementById('signupSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';

    if (!firstName || !lastName || !email || !password) {
      errorEl.textContent = 'All fields are required';
      return;
    }

    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Create user document in Firestore
      await dbCreateUser(user.uid, {
        firstName,
        lastName,
        email,
        isAdmin: false,
        tokens: 0,
        tokensSpent: 0
      });

      await this.logActivity('User Signup', `New user registered: ${firstName} ${lastName} (${email})`);

      this.isGuestMode = false;
      successEl.textContent = 'Account created! Logging you in...';
      
      // Reload data
      await this.loadData();

    } catch (error) {
      console.error('Signup error:', error);
      if (error.code === 'auth/email-already-in-use') {
        errorEl.textContent = 'Email already registered';
      } else {
        errorEl.textContent = error.message;
      }
    }
  },

  async login() {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.textContent = '';

    try {
      await signInWithEmailAndPassword(auth, email, password);
      this.isGuestMode = false;
      // onAuthStateChanged will handle the rest
    } catch (error) {
      console.error('Login error:', error);
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        errorEl.textContent = 'Invalid email or password';
      } else {
        errorEl.textContent = error.message;
      }
    }
  },

  async logout() {
    try {
      // Clean up real-time listener on logout
      if (this.poolListener) {
        console.log('Cleaning up pool listener on logout');
        this.poolListener();
        this.poolListener = null;
      }
      this.currentViewingPoolId = null;
      
      await signOut(auth);
      this.currentUser = null;
      this.isGuestMode = false;
      this.showAuthSection();
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  async changePassword() {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const errorEl = document.getElementById('changePasswordError');
    errorEl.textContent = '';

    if (newPass.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }

    if (newPass !== confirmPass) {
      errorEl.textContent = 'Passwords do not match';
      return;
    }

    try {
      await updatePassword(auth.currentUser, newPass);
      await dbUpdateUser(this.currentUser.id, { needsPasswordChange: false });
      this.currentUser.needsPasswordChange = false;
      this.closeModal('changePasswordModal');
      this.showToast('Password updated successfully!', 'success');
    } catch (error) {
      console.error('Password change error:', error);
      errorEl.textContent = error.message;
    }
  },

  browseAsGuest() {
    this.isGuestMode = true;
    this.currentUser = {
      id: 'guest',
      firstName: 'Guest',
      lastName: 'User',
      isAdmin: false,
      tokens: 0
    };
    this.showMainContent();
  },

  exitGuestMode() {
    this.isGuestMode = false;
    this.currentUser = null;
    this.showAuthSection();
  },

  // UI Navigation
  showAuthSection() {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('mainContent').classList.add('hidden');
  },

  showMainContent() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('userName').textContent = this.currentUser.firstName + ' ' + this.currentUser.lastName;
    document.getElementById('userTokens').textContent = this.currentUser.tokens;

    // Show/hide guest banner
    if (this.isGuestMode) {
      document.getElementById('guestBanner').classList.remove('hidden');
      document.querySelector('.user-info').classList.add('hidden');
      document.getElementById('profileNavBtn').classList.add('hidden');
    } else {
      document.getElementById('guestBanner').classList.add('hidden');
      document.querySelector('.user-info').classList.remove('hidden');
      document.getElementById('profileNavBtn').classList.remove('hidden');
    }

    if (this.currentUser.isAdmin) {
      document.getElementById('adminPanel').classList.remove('hidden');
      document.getElementById('activityNavBtn').style.display = 'block';
    } else {
      document.getElementById('adminPanel').classList.add('hidden');
      document.getElementById('activityNavBtn').style.display = 'none';
    }

    this.showSection('pools');
    this.startCountdownTimers();
  },

  switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (tab === 'login') {
      document.querySelector('.tab:first-child').classList.add('active');
      document.getElementById('loginForm').classList.remove('hidden');
      document.getElementById('signupForm').classList.add('hidden');
    } else {
      document.querySelector('.tab:last-child').classList.add('active');
      document.getElementById('loginForm').classList.add('hidden');
      document.getElementById('signupForm').classList.remove('hidden');
    }
  },

  // Activity logging
  async logActivity(action, details, targetUserId = null) {
    const entry = {
      user: this.currentUser ? `${this.currentUser.firstName} ${this.currentUser.lastName}` : 'System',
      userId: this.currentUser ? this.currentUser.id : null,
      targetUserId: targetUserId, // Track which user was affected (for admin actions)
      isAdmin: this.currentUser ? this.currentUser.isAdmin : false,
      action,
      details
    };
    
    await addActivityLog(entry);
    // Removed loadData() - real-time listeners handle updates automatically
    // This significantly reduces quota usage
  },

  // Toast notifications
  showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span>${message}</span>
      <span class="toast-close" onclick="this.parentElement.remove()">×</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  },

  // Section Navigation
  showSection(section) {
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('poolsSection').classList.add('hidden');
    document.getElementById('profileSection').classList.add('hidden');
    document.getElementById('activitySection').classList.add('hidden');

    if (section === 'pools') {
      document.getElementById('poolsSection').classList.remove('hidden');
      document.querySelector('.nav-btn:first-child').classList.add('active');
      this.displayPools();
    } else if (section === 'profile') {
      document.getElementById('profileSection').classList.remove('hidden');
      document.getElementById('profileNavBtn').classList.add('active');
      this.displayProfile();
    } else if (section === 'activity') {
      document.getElementById('activitySection').classList.remove('hidden');
      document.getElementById('activityNavBtn').classList.add('active');
      this.displayActivityLog();
    }
  },

  // Pool Display
  displayPools() {
    const container = document.getElementById('poolsContainer');
    container.innerHTML = '';

    if (this.pools.length === 0) {
      container.innerHTML = '<p>No pools available yet. Check back soon!</p>';
      return;
    }

    this.pools.forEach(pool => {
      const card = document.createElement('div');
      card.className = 'pool-card';
      card.onclick = () => this.viewPool(pool.id);

      const filledSquares = pool.grid.flat().filter(s => s !== null).length;
      const totalSquares = 100;
      const availableSquares = totalSquares - filledSquares;
      
      let status = 'Open';
      let statusClass = 'status-open';
      if (pool.isComplete) {
        status = 'Complete';
        statusClass = 'status-complete';
      } else if (pool.isLocked) {
        status = 'Locked';
        statusClass = 'status-locked';
      }

      let countdownHtml = '';
      if (pool.startTime && !pool.isLocked) {
        const startTime = new Date(pool.startTime).getTime();
        countdownHtml = `<div class="countdown-timer" data-target-time="${startTime}"></div>`;
      }

      card.innerHTML = `
        <h3>${pool.name}</h3>
        ${countdownHtml}
        <p><strong>${pool.tokensPerSquare} token${pool.tokensPerSquare > 1 ? 's' : ''}</strong> per square</p>
        <p>Squares filled: ${filledSquares}/${totalSquares}</p>
        <p><strong>${availableSquares} squares available</strong></p>
        <span class="pool-status ${statusClass}">${status}</span>
      `;

      container.appendChild(card);
    });

    this.updateCountdowns();
  },

  viewPool(poolId) {
    const pool = this.pools.find(p => p.id === poolId);
    if (!pool) return;

    this.currentViewingPoolId = poolId;
    document.getElementById('poolsList').classList.add('hidden');
    document.getElementById('poolView').classList.remove('hidden');
    this.renderPoolView(pool);
    
    // Set up real-time listener for this pool
    this.setupPoolListener(poolId);
  },

  // Set up real-time listener for pool updates (prevents race conditions)
  setupPoolListener(poolId) {
    // Clean up existing listener
    if (this.poolListener) {
      this.poolListener();
    }
    
    // Set up new listener
    this.poolListener = onSnapshot(doc(db, 'pools', poolId), (snapshot) => {
      if (snapshot.exists() && this.currentViewingPoolId === poolId) {
        const updatedPool = { id: snapshot.id, ...snapshot.data() };
        
        // Convert flat grid to 2D
        if (updatedPool.grid && !Array.isArray(updatedPool.grid[0])) {
          const grid2D = [];
          for (let row = 0; row < 10; row++) {
            grid2D.push(updatedPool.grid.slice(row * 10, (row + 1) * 10));
          }
          updatedPool.grid = grid2D;
        }
        
        // Update local pool data
        const poolIndex = this.pools.findIndex(p => p.id === poolId);
        if (poolIndex >= 0) {
          this.pools[poolIndex] = updatedPool;
        }
        
        // Re-render grid silently (don't show toast)
        this.renderPoolView(updatedPool, true);
      }
    });
  },

  backToPoolsList() {
    // Clean up real-time listener when leaving pool view
    if (this.poolListener) {
      console.log('Cleaning up pool listener');
      this.poolListener();
      this.poolListener = null;
    }
    this.currentViewingPoolId = null;
    
    document.getElementById('poolsList').classList.remove('hidden');
    document.getElementById('poolView').classList.add('hidden');
    this.displayPools();
  },

  renderPoolView(pool, silent = false) {
    const container = document.getElementById('poolDetails');
    const filledSquares = pool.grid.flat().filter(s => s !== null).length;
    const availableSquares = 100 - filledSquares;
    const isCompleted = this.isPoolCompleted(pool);
    
    let html = `<h2>${pool.name}</h2>`;
    
    // Status badge
    if (isCompleted) {
      html += `<div class="pool-status-badge completed">✅ Completed - All Scores Submitted</div>`;
    } else if (pool.isLocked) {
      html += `<div class="pool-status-badge locked">🔒 Locked - Game in Progress</div>`;
    } else {
      html += `<div class="pool-status-badge open">📝 Open - Accepting Entries</div>`;
    }
    
    if (pool.startTime && !pool.isLocked) {
      const startTime = new Date(pool.startTime).getTime();
      html += `<div class="countdown-timer" data-target-time="${startTime}" data-pool-id="${pool.id}"></div>`;
    }
    
    html += `<p><strong>Cost:</strong> ${pool.tokensPerSquare} token${pool.tokensPerSquare > 1 ? 's' : ''} per square</p>`;
    html += `<div class="available-squares">📊 ${availableSquares} squares available</div>`;
    
    // Random selection section
    if (!pool.isLocked && !this.isGuestMode) {
      const emptySquares = pool.grid.flat().filter(s => s === null).length;
      
      if (!this.currentUser.isAdmin && emptySquares > 0) {
        const maxSquares = Math.min(Math.floor(this.currentUser.tokens / pool.tokensPerSquare), emptySquares);
        
        if (maxSquares > 0) {
          html += '<div class="random-select-section">';
          html += '<h4>🎲 Feeling Lucky?</h4>';
          html += '<p style="font-size: 0.9em; margin-bottom: 10px;">Let the computer randomly select squares for you!</p>';
          html += '<div class="random-input-group">';
          html += `<input type="number" id="randomSquareCount" min="1" max="${maxSquares}" value="1" placeholder="Number of squares">`;
          html += `<button class="btn btn-primary" onclick="app.showRandomSelectModal('${pool.id}', false)">Random Select</button>`;
          html += '</div>';
          html += `<p style="font-size: 0.8em; color: #666; margin-top: 5px;">Max: ${maxSquares} square${maxSquares > 1 ? 's' : ''} (based on your ${this.currentUser.tokens} tokens)</p>`;
          html += '</div>';
        }
      } else if (this.currentUser.isAdmin && emptySquares > 0) {
        html += '<div class="random-select-section">';
        html += '<h4>🎲 Admin: Random Selection</h4>';
        html += '<p style="font-size: 0.9em; margin-bottom: 10px;">Randomly assign squares to a user</p>';
        html += '<div class="random-input-group">';
        html += '<select id="randomSelectUser" style="flex: 2;">';
        html += '<option value="">-- Select User --</option>';
        this.users.filter(u => !u.isAdmin).forEach(user => {
          const maxForUser = Math.min(Math.floor(user.tokens / pool.tokensPerSquare), emptySquares);
          html += `<option value="${user.id}" data-max="${maxForUser}">${user.firstName} ${user.lastName} (${user.tokens} tokens - max ${maxForUser})</option>`;
        });
        html += '</select>';
        html += `<input type="number" id="randomSquareCountAdmin" min="1" max="${emptySquares}" value="1" placeholder="# squares">`;
        html += `<button class="btn btn-primary" onclick="app.showRandomSelectModal('${pool.id}', true)">Random Assign</button>`;
        html += '</div>';
        html += '</div>';
      }
    }
    
    if (!this.currentUser.isAdmin && !pool.isLocked && !this.isGuestMode) {
      html += '<div style="text-align: center; font-size: 0.9em; color: #666; margin: 10px 0;">';
      html += 'Tap any empty square to claim it!<br>';
      html += '<strong>Note:</strong> All <strong>?</strong> are randomly assigned at game start time';
      html += '</div>';
    }

    // Admin controls
    if (this.currentUser.isAdmin) {
      html += '<div class="admin-controls">';
      html += '<h3>Admin Controls</h3>';
      html += `<button class="btn btn-secondary" onclick="app.showEditStartTimeModal('${pool.id}')">⏰ Edit Start Time</button>`;
      html += `<button class="btn btn-danger" onclick="app.confirmDeletePool('${pool.id}')">🗑️ Delete Pool</button>`;
      
      if (!pool.isLocked) {
        const allFilled = filledSquares === 100;
        if (!allFilled) {
          html += '<p style="color: #dc3545;">⚠️ All 100 squares must be filled before starting the game!</p>';
        }
        html += `<button class="btn btn-primary" ${!allFilled ? 'disabled' : ''} onclick="app.lockAndStartPool('${pool.id}')">Lock & Start Game</button>`;
      } else {
        html += '<div class="score-input">';
        html += '<h3>Score Entry & Winners</h3>';
        
        // Four quarters plus final
        const periods = [
          { key: 'q1', name: '1st Quarter' },
          { key: 'q2', name: '2nd Quarter' },
          { key: 'q3', name: '3rd Quarter' },
          { key: 'q4', name: '4th Quarter' },
          { key: 'final', name: 'Final Score' }
        ];
        
        periods.forEach(period => {
          const scoreData = pool.scores?.[period.key] || {};
          const seahawks = scoreData.seahawks ?? '';
          const patriots = scoreData.patriots ?? '';
          const isConfirmed = scoreData.confirmed || false;
          
          html += `<div class="quarter-score-entry">`;
          html += `<h4>${period.name}</h4>`;
          html += `<div class="score-inputs">`;
          html += `<label>Seahawks: <input type="number" id="${period.key}-seahawks-${pool.id}" value="${seahawks}" min="0" ${isConfirmed ? 'disabled' : ''}></label>`;
          html += `<label>Patriots: <input type="number" id="${period.key}-patriots-${pool.id}" value="${patriots}" min="0" ${isConfirmed ? 'disabled' : ''}></label>`;
          
          if (!isConfirmed) {
            html += `<button class="btn btn-primary" onclick="app.confirmScore('${pool.id}', '${period.key}')">✓ Confirm</button>`;
          } else {
            html += `<span class="score-confirmed">✓ Confirmed</span>`;
            html += `<button class="btn btn-secondary" onclick="app.editScore('${pool.id}', '${period.key}')">Edit</button>`;
          }
          
          html += `</div></div>`;
        });
        html += '</div>';
      }
      html += '</div>';
    }

    // Grid
    html += '<div style="margin: 15px 0; text-align: center;">';
    html += '<span class="team-label team-seahawks">Seahawks (Top)</span>';
    html += '<span class="team-label team-patriots">Patriots (Side)</span>';
    html += '</div>';
    
    // Add expand/collapse button (mobile only via CSS)
    html += '<div class="expand-grid-container" style="text-align: center; margin: 10px 0;">';
    html += `<button class="btn btn-secondary expand-grid-btn" id="toggleGridSize-${pool.id}" onclick="app.toggleGridSize('${pool.id}')">🔍 Expand Grid</button>`;
    html += '</div>';
    
    html += '<div class="grid-container"><div class="football-grid">';
    html += '<div class="grid-cell header-cell corner-cell">🏈</div>';
    
    // Top headers - Seahawks (green when locked)
    for (let col = 0; col < 10; col++) {
      const num = pool.topNumbers[col] !== null ? pool.topNumbers[col] : '?';
      const teamClass = pool.isLocked ? ' seahawks-header' : '';
      html += `<div class="grid-cell header-cell${teamClass}">${num}</div>`;
    }

    for (let row = 0; row < 10; row++) {
      const rowNum = pool.sideNumbers[row] !== null ? pool.sideNumbers[row] : '?';
      // Side headers - Patriots (red when locked)
      const teamClass = pool.isLocked ? ' patriots-header' : '';
      html += `<div class="grid-cell header-cell${teamClass}">${rowNum}</div>`;
      
      for (let col = 0; col < 10; col++) {
        const cell = pool.grid[row][col];
        let cellClass = 'grid-cell';
        let cellContent = '';
        let onclick = '';

        if (cell) {
          if (cell.userId === this.currentUser.id) {
            cellClass += ' user-square';
          } else {
            cellClass += ' filled-square';
          }
          cellContent = this.formatName(cell.firstName, cell.lastName);
          
          if (this.currentUser.isAdmin && !pool.isLocked) {
            onclick = `onclick="app.clearSquare('${pool.id}', ${row}, ${col})"`;
          } else if (cell.userId === this.currentUser.id && !pool.isLocked) {
            // Allow user to click own square to deselect
            onclick = `onclick="app.selectSquare('${pool.id}', ${row}, ${col})"`;
          }
        } else {
          cellClass += ' empty-square';
          if (!pool.isLocked) {
            if (this.currentUser.isAdmin) {
              onclick = `onclick="app.assignSquareToUser('${pool.id}', ${row}, ${col})"`;
            } else if (!this.isGuestMode) {
              onclick = `onclick="app.selectSquare('${pool.id}', ${row}, ${col})"`;
            }
          }
        }

        // Check if winner
        if (pool.winningSquares) {
          Object.values(pool.winningSquares).forEach(ws => {
            if (ws && ws.row === row && ws.col === col) {
              cellClass += ' winner-square';
            }
          });
        }

        html += `<div class="${cellClass}" ${onclick}>${cellContent}</div>`;
      }
    }
    html += '</div></div>';

    // Winners display
    if (pool.winningSquares && Object.keys(pool.winningSquares).length > 0) {
      html += '<div class="winners-section"><h3>🏆 Winners</h3>';
      const quarterNames = {q1: '1st Quarter', q2: '2nd Quarter', q3: '3rd Quarter', q4: '4th Quarter', final: 'Final'};
      Object.entries(pool.winningSquares).forEach(([quarter, ws]) => {
        if (ws && ws.winner) {
          const prize = Math.floor(pool.tokensPerSquare * 100 / 5);
          html += `<div class="winner-item"><strong>${quarterNames[quarter]}:</strong> ${ws.winner} (${prize} tokens)</div>`;
        }
      });
      html += '</div>';
    }

    container.innerHTML = html;
    this.updateCountdowns();
  },

  async selectSquare(poolId, row, col) {
    const pool = this.pools.find(p => p.id === poolId);
    if (!pool || pool.isLocked) {
      this.showToast('This pool is locked. No changes allowed.', 'error');
      return;
    }

    const cellData = pool.grid[row][col];
    
    // Check if user is clicking their own square to deselect it
    if (cellData && cellData.userId === this.currentUser.id) {
      if (confirm(`Remove your selection from this square and get ${pool.tokensPerSquare} token${pool.tokensPerSquare > 1 ? 's' : ''} refunded?`)) {
        await this.deselectOwnSquare(poolId, row, col);
      }
      return;
    }

    if (cellData) {
      this.showToast('This square is already taken!', 'error');
      return;
    }

    if (this.currentUser.tokens === 0) {
      this.showToast('You have no tokens remaining! Please contact an admin to add more tokens.', 'error', 5000);
      return;
    }

    if (this.currentUser.tokens < pool.tokensPerSquare) {
      this.showToast(`You need ${pool.tokensPerSquare} token${pool.tokensPerSquare > 1 ? 's' : ''} but only have ${this.currentUser.tokens}.`, 'error');
      return;
    }

    // ATOMIC TRANSACTION: Guarantees no race condition
    try {
      const result = await runTransaction(db, async (transaction) => {
        const poolRef = doc(db, 'pools', poolId);
        const userRef = doc(db, 'users', this.currentUser.id);
        
        // Read current state
        const poolDoc = await transaction.get(poolRef);
        const userDoc = await transaction.get(userRef);
        
        if (!poolDoc.exists() || !userDoc.exists()) {
          throw new Error('Document not found');
        }
        
        const poolData = poolDoc.data();
        const userData = userDoc.data();
        
        // Convert flat grid to 2D if needed
        let grid = poolData.grid;
        if (!Array.isArray(grid[0])) {
          const grid2D = [];
          for (let r = 0; r < 10; r++) {
            grid2D.push(grid.slice(r * 10, (r + 1) * 10));
          }
          grid = grid2D;
        }
        
        // Check if square is STILL available (atomic check)
        if (grid[row][col] !== null) {
          throw new Error('SQUARE_TAKEN');
        }
        
        // Check if pool is locked
        if (poolData.isLocked) {
          throw new Error('POOL_LOCKED');
        }
        
        // Check tokens
        if (userData.tokens < poolData.tokensPerSquare) {
          throw new Error('INSUFFICIENT_TOKENS');
        }
        
        // Update grid
        grid[row][col] = {
          userId: this.currentUser.id,
          firstName: this.currentUser.firstName,
          lastName: this.currentUser.lastName
        };
        
        // Flatten grid for storage
        const flatGrid = [];
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            flatGrid.push(grid[r][c]);
          }
        }
        
        // Atomic writes - both succeed or both fail
        transaction.update(poolRef, { grid: flatGrid });
        transaction.update(userRef, {
          tokens: userData.tokens - poolData.tokensPerSquare,
          tokensSpent: (userData.tokensSpent || 0) + poolData.tokensPerSquare
        });
        
        return {
          newTokens: userData.tokens - poolData.tokensPerSquare,
          tokensPerSquare: poolData.tokensPerSquare,
          poolName: poolData.name
        };
      });
      
      // Transaction succeeded!
      this.currentUser.tokens = result.newTokens;
      this.currentUser.tokensSpent = (this.currentUser.tokensSpent || 0) + result.tokensPerSquare;
      document.getElementById('userTokens').textContent = result.newTokens;

      const tokensBefore = result.newTokens + result.tokensPerSquare;
      await this.logActivity(
        'Square Selected',
        `Selected square (${row}, ${col}) in ${result.poolName} for ${result.tokensPerSquare} token(s). Tokens: ${tokensBefore} → ${result.newTokens}`
      );

      // Real-time listener will update the grid
      this.showToast(`Square selected! You spent ${result.tokensPerSquare} token${result.tokensPerSquare > 1 ? 's' : ''}. ${result.newTokens} remaining.`, 'success');

      if (result.newTokens === 1) {
        setTimeout(() => {
          this.showToast('⚠️ Warning: You only have 1 token remaining!', 'warning', 5000);
        }, 500);
      }
      
    } catch (error) {
      console.error('Transaction failed:', error);
      
      if (error.message === 'SQUARE_TAKEN') {
        this.showToast('Someone just claimed this square! Please choose another.', 'error');
      } else if (error.message === 'POOL_LOCKED') {
        this.showToast('This pool was just locked. No changes allowed.', 'error');
      } else if (error.message === 'INSUFFICIENT_TOKENS') {
        this.showToast('Not enough tokens!', 'error');
      } else {
        this.showToast('Failed to select square. Please try again.', 'error');
      }
    }
  },

  async deselectOwnSquare(poolId, row, col) {
    const pool = this.pools.find(p => p.id === poolId);
    
    // Clear the square
    await updateSquare(poolId, row, col, null);
    
    // Refund tokens
    const newTokens = this.currentUser.tokens + pool.tokensPerSquare;
    const newTokensSpent = (this.currentUser.tokensSpent || 0) - pool.tokensPerSquare;
    await dbUpdateUser(this.currentUser.id, {
      tokens: newTokens,
      tokensSpent: newTokensSpent
    });
    
    const tokensBefore = this.currentUser.tokens;
    this.currentUser.tokens = newTokens;
    this.currentUser.tokensSpent = newTokensSpent;
    document.getElementById('userTokens').textContent = newTokens;
    
    await this.logActivity(
      'Square Deselected',
      `Removed own selection from square (${row}, ${col}) in ${pool.name}. ${pool.tokensPerSquare} token(s) refunded. Tokens: ${tokensBefore} → ${newTokens}`
    );
    
    // Don't reload - real-time listener will update
    this.showToast(`Square removed! ${pool.tokensPerSquare} token${pool.tokensPerSquare > 1 ? 's' : ''} refunded. You now have ${newTokens} tokens.`, 'success');
  },

  async clearSquare(poolId, row, col) {
    if (!this.currentUser.isAdmin) return;

    const pool = this.pools.find(p => p.id === poolId);
    const cellData = pool.grid[row][col];
    
    if (cellData) {
      // IMPORTANT: Get fresh user data from database to avoid stale token counts
      const freshUser = await getUser(cellData.userId);
      
      if (freshUser) {
        const tokensBefore = freshUser.tokens;
        const tokensAfter = freshUser.tokens + pool.tokensPerSquare;
        
        await dbUpdateUser(cellData.userId, {
          tokens: tokensAfter,
          tokensSpent: (freshUser.tokensSpent || 0) - pool.tokensPerSquare
        });
        
        await this.logActivity(
          'Square Cleared by Admin',
          `Removed ${this.formatName(cellData.firstName, cellData.lastName)} from square (${row}, ${col}) in ${pool.name}. ${pool.tokensPerSquare} token(s) refunded. Tokens: ${tokensBefore} → ${tokensAfter}`,
          cellData.userId
        );
        
        this.showToast(`Square cleared. ${pool.tokensPerSquare} token${pool.tokensPerSquare > 1 ? 's' : ''} refunded to ${this.formatName(cellData.firstName, cellData.lastName)}.`, 'info');
      } else {
        await this.logActivity(
          'Square Cleared by Admin',
          `Removed square (${row}, ${col}) in ${pool.name}. User not found.`
        );
        this.showToast('Square cleared, but user not found.', 'warning');
      }
      
      await updateSquare(poolId, row, col, null);
      await this.loadData();
      this.renderPoolView(this.pools.find(p => p.id === poolId));
    }
  },

  // Continued in next part due to size...
  showCreatePoolModal() {
    document.getElementById('createPoolModal').classList.add('active');
  },

  async createPool() {
    const name = document.getElementById('newPoolName').value.trim();
    const tokensPerSquare = parseInt(document.getElementById('newPoolTokens').value);
    const startTime = document.getElementById('newPoolStartTime').value;
    const errorEl = document.getElementById('createPoolError');
    errorEl.textContent = '';

    if (!name) {
      errorEl.textContent = 'Pool name is required';
      return;
    }

    const poolId = Date.now().toString();
    
    // Create flat grid (Firestore doesn't support nested arrays)
    const flatGrid = Array(100).fill(null);

    await dbCreatePool(poolId, {
      name,
      tokensPerSquare,
      startTime: startTime ? new Date(startTime).toISOString() : null,
      grid: flatGrid, // Flat array instead of 2D
      topNumbers: Array(10).fill(null),
      sideNumbers: Array(10).fill(null),
      isLocked: false,
      isComplete: false,
      scores: {},
      winningSquares: {}
    });

    await this.logActivity('Pool Created', `Admin created pool: ${name} (${tokensPerSquare} token${tokensPerSquare > 1 ? 's' : ''} per square)`);

    await this.loadData();
    this.closeModal('createPoolModal');
    this.displayPools();
    this.showToast('Pool created successfully!', 'success');
  },

  async lockAndStartPool(poolId) {
    const pool = this.pools.find(p => p.id === poolId);
    const filledSquares = pool.grid.flat().filter(s => s !== null).length;
    
    if (filledSquares < 100) {
      this.showToast('All 100 squares must be filled!', 'error');
      return;
    }

    const topNumbers = [...Array(10).keys()].sort(() => Math.random() - 0.5);
    const sideNumbers = [...Array(10).keys()].sort(() => Math.random() - 0.5);

    await dbUpdatePool(poolId, {
      isLocked: true,
      topNumbers,
      sideNumbers
    });

    await this.logActivity('Game Started', `Admin locked and started ${pool.name}. Numbers revealed!`);
    await this.loadData();
    this.renderPoolView(this.pools.find(p => p.id === poolId));
    this.showToast('Game started! Numbers revealed!', 'success');
  },

  async confirmScore(poolId, quarter) {
    const seahawksScore = parseInt(document.getElementById(`${quarter}-seahawks-${poolId}`).value);
    const patriotsScore = parseInt(document.getElementById(`${quarter}-patriots-${poolId}`).value);
    
    if (isNaN(seahawksScore) || isNaN(patriotsScore)) {
      this.showToast('Please enter valid scores for both teams', 'error');
      return;
    }
    
    const quarterNames = { 
      q1: '1st Quarter', 
      q2: '2nd Quarter', 
      q3: '3rd Quarter', 
      q4: '4th Quarter',
      final: 'Final Score'
    };
    
    if (!confirm(`Confirm ${quarterNames[quarter]} scores?\n\nSeahawks: ${seahawksScore}\nPatriots: ${patriotsScore}\n\nThis will determine the winner for this period.`)) {
      return;
    }
    
    await this.updateScore(poolId, quarter, seahawksScore, patriotsScore, true);
  },

  async editScore(poolId, quarter) {
    if (!confirm('Edit this quarter\'s score? This will recalculate the winner.')) {
      return;
    }
    
    const pool = this.pools.find(p => p.id === poolId);
    const scores = { ...pool.scores };
    scores[quarter] = { ...scores[quarter], confirmed: false };
    
    await dbUpdatePool(poolId, { scores });
    
    // Don't reload - real-time listener will update
    this.showToast('Score unlocked for editing', 'info');
  },

  async updateScore(poolId, quarter, seahawksScore, patriotsScore, confirmed = true) {
    if (seahawksScore < 0 || patriotsScore < 0) {
      this.showToast('Scores must be non-negative', 'error');
      return;
    }

    const pool = this.pools.find(p => p.id === poolId);
    const seahawksDigit = seahawksScore % 10;
    const patriotsDigit = patriotsScore % 10;

    const colIdx = pool.topNumbers.indexOf(seahawksDigit);
    const rowIdx = pool.sideNumbers.indexOf(patriotsDigit);

    let winner = null;
    let winnerCell = null;
    if (rowIdx >= 0 && colIdx >= 0 && pool.grid[rowIdx] && pool.grid[rowIdx][colIdx]) {
      winnerCell = pool.grid[rowIdx][colIdx];
      winner = this.formatName(winnerCell.firstName, winnerCell.lastName);
    }

    const updatedScores = { 
      ...pool.scores, 
      [quarter]: { 
        seahawks: seahawksScore, 
        patriots: patriotsScore,
        confirmed: confirmed
      } 
    };
    
    const updatedWinners = { ...pool.winningSquares };
    if (winner) {
      updatedWinners[quarter] = { row: rowIdx, col: colIdx, winner };
    }

    await dbUpdatePool(poolId, {
      scores: updatedScores,
      winningSquares: updatedWinners
    });

    await this.logActivity(
      'Score Updated',
      `${quarter.toUpperCase()}: Seahawks ${seahawksScore}, Patriots ${patriotsScore} → Winner: ${winner || 'None'}`
    );

    // Don't reload - real-time listener will update
    if (winner) {
      this.showToast(`${quarter.toUpperCase()} winner: ${winner}!`, 'success', 5000);
    } else {
      this.showToast('Score updated. No winner for this combination.', 'info');
    }
  },

  // Continue with remaining methods...
  assignSquareToUser(poolId, row, col) {
    if (!this.currentUser.isAdmin) return;

    const pool = this.pools.find(p => p.id === poolId);
    if (pool.grid[row][col]) {
      this.showToast('This square is already taken!', 'error');
      return;
    }

    const select = document.getElementById('assignSquareUser');
    select.innerHTML = '<option value="">-- Select User --</option>';
    
    this.users.filter(u => !u.isAdmin).forEach(user => {
      const canAfford = user.tokens >= pool.tokensPerSquare;
      const optionText = `${user.firstName} ${user.lastName} (${user.tokens} tokens)${!canAfford ? ' - INSUFFICIENT TOKENS' : ''}`;
      const option = new Option(optionText, user.id);
      option.disabled = !canAfford;
      select.add(option);
    });

    this.pendingSquareAssignment = { poolId, row, col };
    document.getElementById('assignSquareModal').classList.add('active');
  },

  async confirmAssignSquare() {
    const userId = document.getElementById('assignSquareUser').value;
    const errorEl = document.getElementById('assignSquareError');
    errorEl.textContent = '';

    if (!userId) {
      errorEl.textContent = 'Please select a user';
      return;
    }

    const { poolId, row, col } = this.pendingSquareAssignment;
    const pool = this.pools.find(p => p.id === poolId);
    
    if (pool.grid[row][col]) {
      errorEl.textContent = 'This square has already been assigned!';
      this.showToast('Error: Square was already assigned by someone else!', 'error');
      return;
    }

    const user = this.users.find(u => u.id === userId);

    if (user.tokens < pool.tokensPerSquare) {
      errorEl.textContent = 'User does not have enough tokens';
      return;
    }

    const tokensBefore = user.tokens;
    const tokensAfter = user.tokens - pool.tokensPerSquare;

    await updateSquare(poolId, row, col, {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName
    });

    await dbUpdateUser(user.id, {
      tokens: tokensAfter,
      tokensSpent: (user.tokensSpent || 0) + pool.tokensPerSquare
    });

    await this.logActivity(
      'Square Assigned by Admin',
      `Admin assigned square (${row}, ${col}) in ${pool.name} to ${this.formatName(user.firstName, user.lastName)} for ${pool.tokensPerSquare} token(s). Tokens: ${tokensBefore} → ${tokensAfter}`,
      user.id
    );

    await this.loadData();
    this.closeModal('assignSquareModal');
    this.pendingSquareAssignment = null;
    this.renderPoolView(this.pools.find(p => p.id === poolId));
    
    this.showToast(`Square assigned to ${user.firstName} ${user.lastName}!`, 'success');
  },

  showManageUsersModal() {
    const container = document.getElementById('usersList');
    const nonAdminUsers = this.users.filter(u => !u.isAdmin);
    
    let html = '';
    
    // Add search/filter if more than 5 users
    if (nonAdminUsers.length > 5) {
      html += `
        <div class="user-search">
          <input type="text" id="userSearchInput" placeholder="🔍 Search users..." onkeyup="app.filterUsers()">
        </div>
      `;
    }
    
    html += '<div class="users-list-container">';
    
    nonAdminUsers.forEach(user => {
      const totalSpent = user.tokensSpent || 0;
      const totalSquares = this.pools.reduce((sum, pool) => {
        return sum + pool.grid.flat().filter(cell => cell && cell.userId === user.id).length;
      }, 0);
      
      html += `
        <div class="user-card" data-user-name="${user.firstName.toLowerCase()} ${user.lastName.toLowerCase()}" data-user-email="${user.email.toLowerCase()}">
          <div class="user-card-header" onclick="app.toggleUserCard(this)">
            <div class="user-info-compact">
              <strong>${this.formatName(user.firstName, user.lastName)}</strong>
              <span class="user-email">${user.email}</span>
            </div>
            <div class="user-tokens-badge">
              💰 ${user.tokens}
              <span class="expand-icon">▼</span>
            </div>
          </div>
          <div class="user-card-content" style="display: none;">
            <div class="user-stats">
              <div class="stat-item">
                <span class="stat-label">Available:</span>
                <span class="stat-value">${user.tokens} tokens</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Spent:</span>
                <span class="stat-value">${totalSpent} tokens</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Squares:</span>
                <span class="stat-value">${totalSquares}</span>
              </div>
            </div>
            <div class="token-update-section">
              <label>Update Tokens:</label>
              <div class="token-input-group">
                <button class="btn-small btn-secondary" onclick="app.adjustTokens('${user.id}', -10)">-10</button>
                <button class="btn-small btn-secondary" onclick="app.adjustTokens('${user.id}', -5)">-5</button>
                <button class="btn-small btn-secondary" onclick="app.adjustTokens('${user.id}', -1)">-1</button>
                <input type="number" id="tokens-${user.id}" value="${user.tokens}" min="0" class="token-input">
                <button class="btn-small btn-secondary" onclick="app.adjustTokens('${user.id}', 1)">+1</button>
                <button class="btn-small btn-secondary" onclick="app.adjustTokens('${user.id}', 5)">+5</button>
                <button class="btn-small btn-secondary" onclick="app.adjustTokens('${user.id}', 10)">+10</button>
              </div>
              <button class="btn btn-primary" style="width: 100%; margin-top: 10px;" onclick="app.updateUserTokens('${user.id}')">💾 Save Changes</button>
            </div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    container.innerHTML = html;
    document.getElementById('manageUsersModal').classList.add('active');
  },

  toggleUserCard(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.expand-icon');
    
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.textContent = '▲';
    } else {
      content.style.display = 'none';
      icon.textContent = '▼';
    }
  },

  adjustTokens(userId, amount) {
    const input = document.getElementById(`tokens-${userId}`);
    const currentValue = parseInt(input.value) || 0;
    const newValue = Math.max(0, currentValue + amount);
    input.value = newValue;
  },

  filterUsers() {
    const searchTerm = document.getElementById('userSearchInput').value.toLowerCase();
    const userCards = document.querySelectorAll('.user-card');
    
    userCards.forEach(card => {
      const userName = card.dataset.userName;
      const userEmail = card.dataset.userEmail;
      
      if (userName.includes(searchTerm) || userEmail.includes(searchTerm)) {
        card.style.display = 'block';
      } else {
        card.style.display = 'none';
      }
    });
  },

  async updateUserTokens(userId) {
    const newTokens = parseInt(document.getElementById(`tokens-${userId}`).value);
    const userIndex = this.users.findIndex(u => u.id === userId);
    const oldTokens = this.users[userIndex].tokens;

    await dbUpdateUser(userId, { tokens: newTokens });

    await this.logActivity(
      'Tokens Updated by Admin',
      `Admin changed ${this.formatName(this.users[userIndex].firstName, this.users[userIndex].lastName)}'s tokens. Tokens: ${oldTokens} → ${newTokens}`,
      userId
    );

    if (this.currentUser.id === userId) {
      this.currentUser.tokens = newTokens;
      document.getElementById('userTokens').textContent = newTokens;
    }

    await this.loadData();
    this.showToast(`Tokens updated for ${this.formatName(this.users[userIndex].firstName, this.users[userIndex].lastName)}!`, 'success');
  },

  showEditStartTimeModal(poolId) {
    if (!this.currentUser.isAdmin) return;
    
    const pool = this.pools.find(p => p.id === poolId);
    this.currentEditingPool = poolId;
    
    const input = document.getElementById('editStartTime');
    const checkbox = document.getElementById('removeStartTime');
    
    if (pool.startTime) {
      const date = new Date(pool.startTime);
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - (offset * 60 * 1000));
      input.value = localDate.toISOString().slice(0, 16);
      checkbox.checked = false;
    } else {
      input.value = '';
      checkbox.checked = true;
    }
    
    document.getElementById('editStartTimeModal').classList.add('active');
  },

  async confirmEditStartTime() {
    const poolId = this.currentEditingPool;
    const pool = this.pools.find(p => p.id === poolId);
    const newStartTime = document.getElementById('editStartTime').value;
    const removeTime = document.getElementById('removeStartTime').checked;
    const errorEl = document.getElementById('editStartTimeError');
    errorEl.textContent = '';
    
    const oldStartTime = pool.startTime ? new Date(pool.startTime).toLocaleString() : 'None';
    
    if (removeTime) {
      await dbUpdatePool(poolId, { startTime: null });
      await this.logActivity(
        'Start Time Removed',
        `Admin removed start time from ${pool.name} (was: ${oldStartTime})`
      );
      this.showToast('Start time removed. Countdown hidden.', 'success');
    } else if (newStartTime) {
      await dbUpdatePool(poolId, { startTime: new Date(newStartTime).toISOString() });
      await this.logActivity(
        'Start Time Updated',
        `Admin changed start time for ${pool.name} from ${oldStartTime} to ${new Date(newStartTime).toLocaleString()}`
      );
      this.showToast('Start time updated!', 'success');
    } else {
      errorEl.textContent = 'Please select a start time or check "Remove start time"';
      return;
    }
    
    await this.loadData();
    this.closeModal('editStartTimeModal');
    this.currentEditingPool = null;
    this.renderPoolView(this.pools.find(p => p.id === poolId));
    this.displayPools();
  },

  async confirmDeletePool(poolId) {
    const pool = this.pools.find(p => p.id === poolId);
    if (!pool) return;

    const filledSquares = pool.grid.flat().filter(s => s !== null).length;
    
    let confirmMessage = `⚠️ WARNING: Delete "${pool.name}"?\n\n`;
    confirmMessage += `This will permanently delete:\n`;
    confirmMessage += `- The entire pool\n`;
    confirmMessage += `- All ${filledSquares} square selections\n`;
    confirmMessage += `- All game data and scores\n\n`;
    
    if (filledSquares > 0) {
      confirmMessage += `⚠️ TOKENS WILL NOT BE REFUNDED!\n\n`;
    }
    
    confirmMessage += `This action CANNOT be undone!\n\nAre you sure?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    // Second confirmation for safety
    if (!confirm('Are you ABSOLUTELY sure? This is your last chance to cancel!')) {
      return;
    }

    await this.deletePool(poolId);
  },

  async deletePool(poolId) {
    const pool = this.pools.find(p => p.id === poolId);
    if (!pool) return;

    const filledSquares = pool.grid.flat().filter(s => s !== null).length;
    
    await this.logActivity(
      'Pool Deleted by Admin',
      `Admin deleted pool: ${pool.name} (had ${filledSquares} filled squares, ${pool.tokensPerSquare} tokens per square)`
    );

    // Delete from Firestore
    const { deletePool: dbDeletePool } = await import('./database-service.js');
    await dbDeletePool(poolId);

    await this.loadData();
    this.showToast(`Pool "${pool.name}" deleted successfully.`, 'success');
    
    // Go back to pools list
    this.backToPoolsList();
  },

  showRandomSelectModal(poolId, isAdmin) {
    const pool = this.pools.find(p => p.id === poolId);
    const errorEl = document.getElementById('randomSelectError');
    const successEl = document.getElementById('randomSelectSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';
    
    let count, targetUser;
    const availableSquares = pool.grid.flat().filter(s => s === null).length;
    
    if (isAdmin) {
      const userId = document.getElementById('randomSelectUser').value;
      count = parseInt(document.getElementById('randomSquareCountAdmin').value);
      
      if (!userId) {
        this.showToast('Please select a user first', 'error');
        return;
      }
      
      targetUser = this.users.find(u => u.id === userId);
      const maxByTokens = Math.floor(targetUser.tokens / pool.tokensPerSquare);
      
      if (count > availableSquares) {
        this.showToast(`Only ${availableSquares} square${availableSquares !== 1 ? 's' : ''} available on the board`, 'error');
        return;
      }
      
      if (count > maxByTokens) {
        this.showToast(`User only has enough tokens for ${maxByTokens} square${maxByTokens !== 1 ? 's' : ''}`, 'error');
        return;
      }
    } else {
      count = parseInt(document.getElementById('randomSquareCount').value);
      targetUser = this.currentUser;
      
      const maxByTokens = Math.floor(this.currentUser.tokens / pool.tokensPerSquare);
      
      if (count > availableSquares) {
        this.showToast(`Only ${availableSquares} square${availableSquares !== 1 ? 's' : ''} available on the board`, 'error');
        return;
      }
      
      if (count > maxByTokens) {
        this.showToast(`You only have enough tokens for ${maxByTokens} square${maxByTokens !== 1 ? 's' : ''}`, 'error');
        return;
      }
    }
    
    if (!count || count < 1) {
      this.showToast('Please enter a valid number of squares', 'error');
      return;
    }
    
    this.pendingRandomSelection = { poolId, count, targetUser, isAdmin };
    
    const content = document.getElementById('randomSelectContent');
    const totalCost = count * pool.tokensPerSquare;
    
    content.innerHTML = `
      <div style="margin: 20px 0;">
        <p><strong>Pool:</strong> ${pool.name}</p>
        <p><strong>${isAdmin ? 'Assigning to' : 'You will receive'}:</strong> ${count} random square${count !== 1 ? 's' : ''}</p>
        <p><strong>Total cost:</strong> ${totalCost} token${totalCost !== 1 ? 's' : ''}</p>
        ${isAdmin ? `<p><strong>User:</strong> ${targetUser.firstName} ${targetUser.lastName}</p>` : ''}
        <p><strong>Remaining tokens after:</strong> ${targetUser.tokens - totalCost}</p>
      </div>
      <p style="color: #666; font-size: 0.9em;">Squares will be selected randomly from available positions.</p>
    `;
    
    document.getElementById('randomSelectModal').classList.add('active');
  },

  async confirmRandomSelection() {
    if (!this.pendingRandomSelection) return;
    
    const { poolId, count, targetUser, isAdmin } = this.pendingRandomSelection;
    const pool = this.pools.find(p => p.id === poolId);
    const errorEl = document.getElementById('randomSelectError');
    const successEl = document.getElementById('randomSelectSuccess');
    
    errorEl.textContent = '';
    successEl.textContent = '';
    
    // ATOMIC TRANSACTION for random selection
    try {
      const result = await runTransaction(db, async (transaction) => {
        const poolRef = doc(db, 'pools', poolId);
        const userRef = doc(db, 'users', targetUser.id);
        
        // Read current state
        const poolDoc = await transaction.get(poolRef);
        const userDoc = await transaction.get(userRef);
        
        if (!poolDoc.exists() || !userDoc.exists()) {
          throw new Error('Document not found');
        }
        
        const poolData = poolDoc.data();
        const userData = userDoc.data();
        
        // Convert flat grid to 2D if needed
        let grid = poolData.grid;
        if (!Array.isArray(grid[0])) {
          const grid2D = [];
          for (let r = 0; r < 10; r++) {
            grid2D.push(grid.slice(r * 10, (r + 1) * 10));
          }
          grid = grid2D;
        }
        
        // Find empty squares atomically
        const emptySquares = [];
        grid.forEach((row, rowIdx) => {
          row.forEach((cell, colIdx) => {
            if (cell === null) {
              emptySquares.push({ row: rowIdx, col: colIdx });
            }
          });
        });
        
        if (emptySquares.length < count) {
          throw new Error(`INSUFFICIENT_SQUARES:${emptySquares.length}`);
        }
        
        const totalCost = count * poolData.tokensPerSquare;
        if (userData.tokens < totalCost) {
          throw new Error('INSUFFICIENT_TOKENS');
        }
        
        // Randomly select squares
        const selectedSquares = [];
        for (let i = 0; i < count; i++) {
          const randomIndex = Math.floor(Math.random() * emptySquares.length);
          const square = emptySquares.splice(randomIndex, 1)[0];
          selectedSquares.push(square);
          
          grid[square.row][square.col] = {
            userId: targetUser.id,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName
          };
        }
        
        // Flatten grid for storage
        const flatGrid = [];
        for (let r = 0; r < 10; r++) {
          for (let c = 0; c < 10; c++) {
            flatGrid.push(grid[r][c]);
          }
        }
        
        // Atomic writes
        transaction.update(poolRef, { grid: flatGrid });
        transaction.update(userRef, {
          tokens: userData.tokens - totalCost,
          tokensSpent: (userData.tokensSpent || 0) + totalCost
        });
        
        return {
          selectedSquares,
          totalCost,
          newTokens: userData.tokens - totalCost,
          poolName: poolData.name
        };
      });
      
      // Transaction succeeded!
      const tokensBefore = targetUser.tokens;
      if (targetUser.id === this.currentUser.id) {
        this.currentUser.tokens = result.newTokens;
        this.currentUser.tokensSpent = (this.currentUser.tokensSpent || 0) + result.totalCost;
        document.getElementById('userTokens').textContent = result.newTokens;
      }
      
      // Update local users array to prevent stale data when admin clears squares
      const userIndex = this.users.findIndex(u => u.id === targetUser.id);
      if (userIndex >= 0) {
        this.users[userIndex].tokens = result.newTokens;
        this.users[userIndex].tokensSpent = (this.users[userIndex].tokensSpent || 0) + result.totalCost;
      }
      
      const squaresList = result.selectedSquares.map(s => `(${s.row},${s.col})`).join(', ');
      if (isAdmin) {
        await this.logActivity(
          'Random Assignment by Admin',
          `Admin randomly assigned ${count} square${count !== 1 ? 's' : ''} to ${this.formatName(targetUser.firstName, targetUser.lastName)} in ${result.poolName}: ${squaresList}. Cost: ${result.totalCost} token${result.totalCost !== 1 ? 's' : ''}. Tokens: ${tokensBefore} → ${result.newTokens}`,
          targetUser.id
        );
      } else {
        await this.logActivity(
          'Random Square Selection',
          `User randomly selected ${count} square${count !== 1 ? 's' : ''} in ${result.poolName}: ${squaresList}. Cost: ${result.totalCost} token${result.totalCost !== 1 ? 's' : ''}. Tokens: ${tokensBefore} → ${result.newTokens}`
        );
      }
      
      this.closeModal('randomSelectModal');
      this.pendingRandomSelection = null;
      
      this.showToast(`${count} square${count !== 1 ? 's' : ''} randomly selected! ${result.totalCost} token${result.totalCost !== 1 ? 's' : ''} spent.`, 'success');
      
      if (targetUser.id === this.currentUser.id && result.newTokens === 1) {
        setTimeout(() => {
          this.showToast('⚠️ Warning: You only have 1 token remaining!', 'warning', 5000);
        }, 500);
      }
      
    } catch (error) {
      console.error('Random selection transaction failed:', error);
      
      if (error.message.startsWith('INSUFFICIENT_SQUARES:')) {
        const available = error.message.split(':')[1];
        errorEl.textContent = `Only ${available} squares available now. Someone just selected squares!`;
      } else if (error.message === 'INSUFFICIENT_TOKENS') {
        errorEl.textContent = 'Not enough tokens!';
      } else {
        errorEl.textContent = 'Failed to select squares. Please try again.';
      }
    }
  },

  displayProfile() {
    const container = document.getElementById('profileContent');
    
    const userGames = this.pools.map(pool => {
      const squares = [];
      const winningQuarters = [];
      
      pool.grid.forEach((row, rowIdx) => {
        row.forEach((cell, colIdx) => {
          if (cell && cell.userId === this.currentUser.id) {
            let squareInfo = { row: rowIdx, col: colIdx, pool: pool.name };
            
            if (pool.isLocked && pool.topNumbers[colIdx] !== null && pool.sideNumbers[rowIdx] !== null) {
              squareInfo.seahawksNumber = pool.topNumbers[colIdx];
              squareInfo.patriotsNumber = pool.sideNumbers[rowIdx];
            }
            
            squares.push(squareInfo);
            
            Object.entries(pool.winningSquares || {}).forEach(([quarter, ws]) => {
              if (ws && ws.row === rowIdx && ws.col === colIdx) {
                const quarterNames = {q1: '1st Quarter', q2: '2nd Quarter', q3: '3rd Quarter', q4: '4th Quarter', final: 'Final'};
                const prize = Math.floor(pool.tokensPerSquare * 100 / 5);
                winningQuarters.push({
                  quarter: quarterNames[quarter],
                  prize: prize,
                  pool: pool.name
                });
              }
            });
          }
        });
      });
      
      return squares.length > 0 ? { pool, squares, winningQuarters } : null;
    }).filter(g => g !== null);

    let html = `
      <div class="profile-stats">
        <div class="stat-card">
          <h3>${this.currentUser.tokens}</h3>
          <p>Available Tokens</p>
        </div>
        <div class="stat-card">
          <h3>${this.currentUser.tokensSpent || 0}</h3>
          <p>Tokens Spent</p>
        </div>
        <div class="stat-card">
          <h3>${userGames.reduce((sum, g) => sum + g.squares.length, 0)}</h3>
          <p>Squares Selected</p>
        </div>
        <div class="stat-card">
          <h3>${userGames.reduce((sum, g) => sum + g.winningQuarters.length, 0)}</h3>
          <p>Quarters Won</p>
        </div>
      </div>
    `;

    if (this.currentUser.tokens === 1) {
      html += '<div class="alert alert-warning">⚠️ You only have 1 token remaining!</div>';
    }

    if (userGames.length > 0) {
      html += '<div class="my-games-list"><h3>My Games</h3>';
      userGames.forEach(game => {
        html += `<div class="game-entry">`;
        html += `<h4>${game.pool.name}</h4>`;
        
        if (game.pool.isLocked) {
          html += `<p style="color: #ffc107; font-weight: bold;">🔒 Game Locked - Numbers Revealed!</p>`;
        } else {
          html += `<p style="color: #28a745; font-weight: bold;">📝 Game Open - Numbers TBD</p>`;
        }
        
        html += `<p><strong>Squares:</strong></p>`;
        html += '<div class="squares-list">';
        game.squares.forEach(sq => {
          const isWinner = game.winningQuarters.some(wq => 
            game.pool.winningSquares && Object.values(game.pool.winningSquares).some(ws => 
              ws && ws.row === sq.row && ws.col === sq.col
            )
          );
          const badgeClass = isWinner ? 'square-badge winner' : 'square-badge';
          
          let squareText = '';
          if (game.pool.isLocked && sq.seahawksNumber !== undefined && sq.patriotsNumber !== undefined) {
            squareText = `Seahawks: ${sq.seahawksNumber}, Patriots: ${sq.patriotsNumber}`;
          } else {
            squareText = `Row ${sq.row + 1}, Col ${sq.col + 1}`;
          }
          
          html += `<span class="${badgeClass}">${squareText}</span>`;
        });
        html += '</div>';
        
        if (game.winningQuarters.length > 0) {
          html += '<p style="margin-top: 10px;"><strong>🏆 Winnings:</strong></p>';
          game.winningQuarters.forEach(wq => {
            html += `<div style="color: #ffd700; font-weight: bold;">• ${wq.quarter}: ${wq.prize} tokens</div>`;
          });
        }
        html += `</div>`;
      });
      html += '</div>';
    } else {
      html += '<p>You haven\'t joined any games yet!</p>';
    }

    // Personal Activity History
    html += '<div class="my-activity-section">';
    html += '<h3>My Recent Activity</h3>';
    
    // Filter activities for this user (actions by them or affecting them)
    const myActivities = this.activityLog.filter(entry => 
      entry.userId === this.currentUser.id || entry.targetUserId === this.currentUser.id
    ).slice(0, 50); // Limit to 50 most recent

    if (myActivities.length > 0) {
      html += '<div class="activity-list">';
      myActivities.forEach(entry => {
        const timestamp = entry.timestamp && entry.timestamp.toDate 
          ? entry.timestamp.toDate() 
          : new Date(entry.timestamp);
        const timeStr = timestamp.toLocaleString();
        
        // Highlight admin actions affecting this user
        const isAdminAction = entry.targetUserId === this.currentUser.id && entry.userId !== this.currentUser.id;
        const entryClass = isAdminAction ? 'activity-entry admin-action' : 'activity-entry';
        
        html += `<div class="${entryClass}">`;
        html += `<div class="activity-header">`;
        html += `<span class="activity-action">${entry.action}</span>`;
        html += `<span class="activity-time">${timeStr}</span>`;
        html += `</div>`;
        html += `<div class="activity-details">${entry.details}</div>`;
        if (isAdminAction) {
          html += `<div class="admin-badge">👤 Admin Action</div>`;
        }
        html += `</div>`;
      });
      html += '</div>';
    } else {
      html += '<p style="color: #666;">No activity yet.</p>';
    }
    
    html += '</div>';

    container.innerHTML = html;
  },

  displayActivityLog() {
    this.applyActivityFilters();
  },

  async applyActivityFilters() {
    const userFilter = document.getElementById('filterUser').value;
    const actionFilter = document.getElementById('filterAction').value;
    const fromDate = document.getElementById('filterFromDate').value;
    const toDate = document.getElementById('filterToDate').value;

    // If admin is using filters, load more data from database
    if (this.currentUser && this.currentUser.isAdmin && (userFilter || actionFilter)) {
      try {
        const filters = {};
        if (userFilter) filters.userId = userFilter;
        if (actionFilter) filters.action = actionFilter;
        filters.limit = 200; // Load more when filtering
        
        this.activityLog = await getFilteredActivityLogs(filters);
        this.showToast('Loading filtered activity logs...', 'info', 2000);
      } catch (error) {
        console.error('Error loading filtered logs:', error);
        this.showToast('Error loading filtered logs', 'error');
      }
    }

    // Apply client-side date filters
    this.filteredActivityLog = this.activityLog.filter(entry => {
      // Handle Firestore Timestamp conversion
      let entryDate;
      if (entry.timestamp && entry.timestamp.toDate) {
        entryDate = entry.timestamp.toDate();
      } else if (entry.timestamp) {
        entryDate = new Date(entry.timestamp);
      } else {
        return true; // No timestamp, include it
      }
      
      if (fromDate && entryDate < new Date(fromDate)) return false;
      if (toDate && entryDate > new Date(toDate + 'T23:59:59')) return false;
      return true;
    });

    this.currentActivityPage = 1;
    this.renderActivityLog();
  },

  async clearActivityFilters() {
    document.getElementById('filterUser').value = '';
    document.getElementById('filterAction').value = '';
    document.getElementById('filterFromDate').value = '';
    document.getElementById('filterToDate').value = '';
    
    // Reload default limited activity logs
    if (this.currentUser && this.currentUser.isAdmin) {
      this.activityLog = await getActivityLogs(50);
    } else if (this.currentUser) {
      this.activityLog = await getUserActivityLogs(this.currentUser.id, 20);
    }
    
    await this.applyActivityFilters();
  },

  renderActivityLog() {
    const userSelect = document.getElementById('filterUser');
    const actionSelect = document.getElementById('filterAction');
    
    // Populate filters
    if (userSelect.options.length === 1) {
      const uniqueUsers = [...new Set(this.activityLog.map(e => e.user))];
      uniqueUsers.forEach(user => {
        const option = new Option(user, this.activityLog.find(e => e.user === user).userId);
        userSelect.add(option);
      });
    }

    if (actionSelect.options.length === 1) {
      const uniqueActions = [...new Set(this.activityLog.map(e => e.action))];
      uniqueActions.forEach(action => {
        const option = new Option(action, action);
        actionSelect.add(option);
      });
    }

    // Render log
    const container = document.getElementById('activityLog');
    const start = (this.currentActivityPage - 1) * this.ITEMS_PER_PAGE;
    const end = start + this.ITEMS_PER_PAGE;
    const pageItems = this.filteredActivityLog.slice(start, end);

    let html = '<div class="activity-list">';
    pageItems.forEach(entry => {
      // Convert Firestore Timestamp to JavaScript Date
      let date;
      if (entry.timestamp && entry.timestamp.toDate) {
        // Firestore Timestamp object
        date = entry.timestamp.toDate().toLocaleString();
      } else if (entry.timestamp) {
        // Regular timestamp or Date object
        date = new Date(entry.timestamp).toLocaleString();
      } else {
        date = 'Unknown date';
      }
      
      html += `
        <div class="activity-item">
          <div class="activity-header">
            <strong>${entry.user}</strong>
            ${entry.isAdmin ? '<span class="badge-admin">Admin</span>' : ''}
            <span class="activity-date">${date}</span>
          </div>
          <div class="activity-action">${entry.action}</div>
          <div class="activity-details">${entry.details}</div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;

    // Render pagination
    const totalPages = Math.ceil(this.filteredActivityLog.length / this.ITEMS_PER_PAGE);
    const pagination = document.getElementById('activityPagination');
    
    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml += `<button ${this.currentActivityPage === 1 ? 'disabled' : ''} onclick="app.goToActivityPage(${this.currentActivityPage - 1})">Previous</button>`;
      
      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= this.currentActivityPage - 2 && i <= this.currentActivityPage + 2)) {
          paginationHtml += `<button class="${i === this.currentActivityPage ? 'active' : ''}" onclick="app.goToActivityPage(${i})">${i}</button>`;
        } else if (i === this.currentActivityPage - 3 || i === this.currentActivityPage + 3) {
          paginationHtml += '<span>...</span>';
        }
      }
      
      paginationHtml += `<button ${this.currentActivityPage === totalPages ? 'disabled' : ''} onclick="app.goToActivityPage(${this.currentActivityPage + 1})">Next</button>`;
    }
    pagination.innerHTML = paginationHtml;
  },

  goToActivityPage(page) {
    this.currentActivityPage = page;
    this.renderActivityLog();
  },

  async exportData() {
    const data = {
      users: this.users,
      pools: this.pools,
      activityLog: this.activityLog,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `football-pool-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.showToast('Data exported successfully!', 'success');
  },

  async importData(file) {
    if (!file) return;
    
    if (!confirm('⚠️ WARNING: This will replace ALL current data (users, pools, activity log). Are you sure you want to continue?')) {
      document.getElementById('importFile').value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!data.users || !data.pools || !data.activityLog) {
          throw new Error('Invalid backup file format');
        }
        
        // Use the migration helper
        const { importExistingData } = await import('./database-service.js');
        await importExistingData(data.users, data.pools, data.activityLog);
        
        await this.logActivity(
          'Data Imported',
          `Admin imported data from backup file (${data.exportDate || 'unknown date'})`
        );
        
        this.showToast('Data imported successfully! Page will reload...', 'success', 2000);
        setTimeout(() => location.reload(), 2000);
      } catch (error) {
        this.showToast('Error importing data: ' + error.message, 'error', 6000);
        console.error('Import error:', error);
      }
      
      document.getElementById('importFile').value = '';
    };
    
    reader.onerror = () => {
      this.showToast('Error reading file', 'error');
      document.getElementById('importFile').value = '';
    };
    
    reader.readAsText(file);
  },

  showResetPasswordModal() {
    document.getElementById('resetPasswordModal').classList.add('active');
  },

  showInstructions() {
    document.getElementById('instructionsModal').classList.add('active');
  },

  async requestPasswordReset() {
    const email = document.getElementById('resetEmail').value.trim().toLowerCase();
    const errorEl = document.getElementById('resetError');
    const successEl = document.getElementById('resetSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';

    if (!email) {
      errorEl.textContent = 'Please enter your email address';
      return;
    }

    // Check rate limiting (3 requests per 5 minutes)
    const now = Date.now();
    const resetAttempts = JSON.parse(localStorage.getItem('passwordResetAttempts') || '[]');
    
    // Filter attempts from last 5 minutes
    const recentAttempts = resetAttempts.filter(timestamp => now - timestamp < 5 * 60 * 1000);
    
    if (recentAttempts.length >= 3) {
      const oldestAttempt = Math.min(...recentAttempts);
      const waitTime = Math.ceil((5 * 60 * 1000 - (now - oldestAttempt)) / 1000 / 60);
      errorEl.textContent = `Too many reset requests. Please wait ${waitTime} minute${waitTime > 1 ? 's' : ''} before trying again.`;
      return;
    }

    try {
      // Firebase sends password reset email (link expires in 1 hour by default)
      await sendPasswordResetEmail(auth, email, {
        url: window.location.origin, // Return to app after reset
        handleCodeInApp: false
      });

      // Track attempt
      recentAttempts.push(now);
      localStorage.setItem('passwordResetAttempts', JSON.stringify(recentAttempts));

      successEl.textContent = '✅ Password reset email sent! Check your inbox (and spam folder). Link expires in 1 hour.';
      
      // Log successful password reset request (unauthenticated)
      await addActivityLog({
        user: 'Unauthenticated User',
        userId: null,
        isAdmin: false,
        action: 'Password Reset Requested',
        details: `Password reset email sent to ${email}`,
        email: email // Track which email requested reset
      });

      // Clear form
      document.getElementById('resetEmail').value = '';
      
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        this.closeModal('resetPasswordModal');
      }, 3000);

    } catch (error) {
      console.error('Password reset error:', error);
      
      // Log failed password reset attempts
      let failureReason = 'Unknown error';
      
      if (error.code === 'auth/user-not-found') {
        // Don't reveal if user exists (security best practice)
        successEl.textContent = '✅ If an account exists with that email, a reset link has been sent.';
        failureReason = 'User not found';
        
        // Log attempt for non-existent user (security tracking)
        await addActivityLog({
          user: 'Unauthenticated User',
          userId: null,
          isAdmin: false,
          action: 'Password Reset Failed',
          details: `Password reset attempted for non-existent email: ${email}`,
          email: email
        });
        
      } else if (error.code === 'auth/invalid-email') {
        errorEl.textContent = 'Invalid email address';
        failureReason = 'Invalid email format';
        
        // Log invalid email attempt
        await addActivityLog({
          user: 'Unauthenticated User',
          userId: null,
          isAdmin: false,
          action: 'Password Reset Failed',
          details: `Invalid email format attempted: ${email}`,
          email: email
        });
        
      } else if (error.code === 'auth/too-many-requests') {
        errorEl.textContent = 'Too many requests from this device. Please try again later.';
        failureReason = 'Rate limited by Firebase';
        
        // Log rate limit hit
        await addActivityLog({
          user: 'Unauthenticated User',
          userId: null,
          isAdmin: false,
          action: 'Password Reset Failed',
          details: `Rate limit exceeded for email: ${email}`,
          email: email
        });
        
      } else {
        errorEl.textContent = 'An error occurred. Please try again.';
        failureReason = error.message || 'Unknown error';
        
        // Log other errors
        await addActivityLog({
          user: 'Unauthenticated User',
          userId: null,
          isAdmin: false,
          action: 'Password Reset Failed',
          details: `Password reset error for ${email}: ${failureReason}`,
          email: email
        });
      }
    }
  },

  startCountdownTimers() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }

    this.countdownInterval = setInterval(() => {
      this.updateCountdowns();
    }, 1000);

    this.updateCountdowns();
  },

  updateCountdowns() {
    const timers = document.querySelectorAll('.countdown-timer');
    const now = Date.now();

    timers.forEach(timer => {
      const targetTime = parseInt(timer.dataset.targetTime);
      const poolId = timer.dataset.poolId;
      if (!targetTime) return;

      const diff = targetTime - now;

      if (diff <= 0) {
        timer.innerHTML = '<span style="color: #ffc107;">🏈 Game Time!</span>';
        
        // Auto-lock pool if it hasn't been locked yet
        if (poolId && !timer.dataset.autoLocked) {
          timer.dataset.autoLocked = 'true'; // Prevent multiple locks
          this.autoLockPool(poolId);
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      let countdownText = '⏰ Starts in: ';
      if (days > 0) countdownText += `${days}d `;
      countdownText += `${hours}h ${minutes}m ${seconds}s`;

      if (diff < 3600000) {
        timer.classList.add('urgent');
      }

      timer.textContent = countdownText;
    });
  },

  async autoLockPool(poolId) {
    // Check if pool exists and is not already locked
    const pool = this.pools.find(p => p.id === poolId);
    if (!pool || pool.isLocked) return;

    // Check if pool is full (100 squares)
    const filledSquares = pool.grid.flat().filter(s => s !== null).length;
    
    if (filledSquares < 100) {
      console.log(`Pool ${pool.name} reached start time but only has ${filledSquares}/100 squares filled. Not auto-locking.`);
      this.showToast(`⏰ ${pool.name} start time reached, but pool is not full. Admin can lock manually when ready.`, 'warning', 8000);
      return;
    }

    // Auto-lock the pool
    console.log(`Auto-locking pool ${pool.name} - countdown reached 0`);
    
    if (this.currentUser.isAdmin) {
      await this.lockAndStartPool(poolId);
    } else {
      // For non-admin users, just refresh to show the locked state (admin should lock it)
      this.showToast(`⏰ ${pool.name} start time reached! Waiting for admin to lock the pool...`, 'info', 8000);
      await this.loadData();
    }
  },


  toggleGridSize(poolId) {
    const container = document.querySelector('.grid-container');
    const button = document.getElementById(`toggleGridSize-${poolId}`);
    
    if (container.classList.contains('expanded')) {
      // Collapse
      container.classList.remove('expanded');
      button.textContent = '🔍 Expand Grid';
    } else {
      // Expand
      container.classList.add('expanded');
      button.textContent = '🔍 Collapse Grid';
    }
  },

  togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const button = input.nextElementSibling;
    
    if (input.type === 'password') {
      input.type = 'text';
      if (button) button.textContent = '🙈';
    } else {
      input.type = 'password';
      if (button) button.textContent = '👁️';
    }
  }
};

// Make app globally available
window.app = app;

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

