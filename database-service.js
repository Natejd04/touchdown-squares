// Database Service - Handles all Firebase Firestore operations
import { db, auth } from './firebase-config.js';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';

// ============= USERS =============

export async function createUser(userId, userData) {
  await setDoc(doc(db, 'users', userId), {
    ...userData,
    createdAt: serverTimestamp()
  });
}

export async function getUser(userId) {
  const docSnap = await getDoc(doc(db, 'users', userId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
}

export async function getAllUsers() {
  const querySnapshot = await getDocs(collection(db, 'users'));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function updateUser(userId, updates) {
  await updateDoc(doc(db, 'users', userId), updates);
}

// ============= POOLS =============

// Helper: Convert flat grid to 2D (for display)
function flatTo2D(flatGrid) {
  const grid2D = [];
  for (let row = 0; row < 10; row++) {
    grid2D.push(flatGrid.slice(row * 10, (row + 1) * 10));
  }
  return grid2D;
}

// Helper: Convert 2D grid to flat (for storage)
function gridToFlat(grid2D) {
  return grid2D.flat();
}

export async function createPool(poolId, poolData) {
  // Ensure grid is flat for Firestore
  if (poolData.grid && Array.isArray(poolData.grid[0])) {
    poolData.grid = gridToFlat(poolData.grid);
  }
  
  await setDoc(doc(db, 'pools', poolId), {
    ...poolData,
    createdAt: serverTimestamp()
  });
}

export async function getPool(poolId) {
  const docSnap = await getDoc(doc(db, 'pools', poolId));
  if (!docSnap.exists()) return null;
  
  const pool = { id: docSnap.id, ...docSnap.data() };
  
  // Convert flat grid back to 2D for app use
  if (pool.grid && !Array.isArray(pool.grid[0])) {
    pool.grid = flatTo2D(pool.grid);
  }
  
  return pool;
}

export async function getAllPools() {
  const querySnapshot = await getDocs(collection(db, 'pools'));
  return querySnapshot.docs.map(doc => {
    const pool = { id: doc.id, ...doc.data() };
    
    // Convert flat grid back to 2D
    if (pool.grid && !Array.isArray(pool.grid[0])) {
      pool.grid = flatTo2D(pool.grid);
    }
    
    return pool;
  });
}

export async function updatePool(poolId, updates) {
  // Ensure grid is flat if being updated
  if (updates.grid && Array.isArray(updates.grid[0])) {
    updates.grid = gridToFlat(updates.grid);
  }
  
  await updateDoc(doc(db, 'pools', poolId), updates);
}

// Update a single square in the grid
export async function updateSquare(poolId, row, col, cellData) {
  const pool = await getPool(poolId);
  if (!pool) throw new Error('Pool not found');
  
  pool.grid[row][col] = cellData;
  
  // Convert to flat before saving
  const flatGrid = gridToFlat(pool.grid);
  await updateDoc(doc(db, 'pools', poolId), { grid: flatGrid });
}

// Batch update multiple squares (for random selection)
export async function updateMultipleSquares(poolId, squareUpdates) {
  const pool = await getPool(poolId);
  if (!pool) throw new Error('Pool not found');
  
  squareUpdates.forEach(({ row, col, cellData }) => {
    pool.grid[row][col] = cellData;
  });
  
  // Convert to flat before saving
  const flatGrid = gridToFlat(pool.grid);
  await updateDoc(doc(db, 'pools', poolId), { grid: flatGrid });
}

// Delete a pool
export async function deletePool(poolId) {
  await deleteDoc(doc(db, 'pools', poolId));
}

// ============= ACTIVITY LOG =============

export async function addActivityLog(logData) {
  const logRef = doc(collection(db, 'activityLog'));
  await setDoc(logRef, {
    ...logData,
    timestamp: serverTimestamp()
  });
}

export async function getActivityLogs(limitCount = 500) {
  const q = query(
    collection(db, 'activityLog'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Get activity logs for a specific user (user's actions + actions affecting them)
export async function getUserActivityLogs(userId, limitCount = 20) {
  // Query for logs where user performed action OR was targeted by action
  // Note: Firestore doesn't support OR queries directly, so we need two queries
  
  // Query 1: Logs where user performed the action
  const q1 = query(
    collection(db, 'activityLog'),
    where('userId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  
  // Query 2: Logs where user was targeted (admin actions affecting them)
  const q2 = query(
    collection(db, 'activityLog'),
    where('targetUserId', '==', userId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  );
  
  const [snap1, snap2] = await Promise.all([
    getDocs(q1),
    getDocs(q2)
  ]);
  
  const logs1 = snap1.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const logs2 = snap2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // Combine and remove duplicates
  const allLogs = [...logs1, ...logs2];
  const uniqueLogs = Array.from(
    new Map(allLogs.map(log => [log.id, log])).values()
  );
  
  // Sort by timestamp and limit
  return uniqueLogs
    .sort((a, b) => {
      const aTime = a.timestamp?.toMillis?.() || 0;
      const bTime = b.timestamp?.toMillis?.() || 0;
      return bTime - aTime;
    })
    .slice(0, limitCount);
}

// Get activity logs with filters (for admin search)
export async function getFilteredActivityLogs(filters = {}) {
  let q = collection(db, 'activityLog');
  const constraints = [];
  
  // Add filters
  if (filters.userId) {
    constraints.push(where('userId', '==', filters.userId));
  }
  
  if (filters.action) {
    constraints.push(where('action', '==', filters.action));
  }
  
  // Always order by timestamp
  constraints.push(orderBy('timestamp', 'desc'));
  
  // Limit results
  constraints.push(limit(filters.limit || 200));
  
  q = query(q, ...constraints);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// ============= MIGRATION HELPER =============

export async function importExistingData(users, pools, activityLog) {
  const batch = writeBatch(db);
  
  // Import users
  users.forEach(user => {
    const userRef = doc(db, 'users', user.id);
    batch.set(userRef, user);
  });
  
  // Import pools
  pools.forEach(pool => {
    const poolRef = doc(db, 'pools', pool.id);
    batch.set(poolRef, pool);
  });
  
  // Import activity log (in chunks if large)
  const logChunks = [];
  for (let i = 0; i < activityLog.length; i += 500) {
    logChunks.push(activityLog.slice(i, i + 500));
  }
  
  // Commit user and pool data
  await batch.commit();
  
  // Import activity logs in chunks
  for (const chunk of logChunks) {
    const logBatch = writeBatch(db);
    chunk.forEach(log => {
      const logRef = doc(collection(db, 'activityLog'));
      logBatch.set(logRef, log);
    });
    await logBatch.commit();
  }
}
