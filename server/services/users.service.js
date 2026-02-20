import {
  findUserById,
  getAllUsers,
  getPendingUsers,
  updateUserStatus,
  updateUserRole,
  deleteUser,
} from '../db.js';
import { USER_STATUS, USER_ROLE } from '../../config/constants.js';

const INITIAL_ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

export function isInitialAdmin(userId) {
  if (!INITIAL_ADMIN_EMAIL) return false;
  const user = findUserById(userId);
  return !!(user && user.email === INITIAL_ADMIN_EMAIL);
}

function isProtectedEmail(email) {
  return !!(INITIAL_ADMIN_EMAIL && email === INITIAL_ADMIN_EMAIL);
}

export function isValidStatus(status) {
  return USER_STATUS.ALL.includes(status);
}

export function isValidRole(role) {
  return USER_ROLE.ALL.includes(role);
}

// { success, error?, code?, user? }
export function changeUserStatus(userId, status, reqUser) {
  if (!isValidStatus(status)) {
    return { success: false, error: 'Invalid status', code: 400 };
  }
  if (isInitialAdmin(userId) && status !== USER_STATUS.ACTIVE) {
    return { success: false, error: 'Cannot block or deactivate the initial admin', code: 403 };
  }
  const user = updateUserStatus(userId, status);
  console.log(`[Admin] ${reqUser.email} changed user #${userId} (${user.email}) status → ${status}`);
  return { success: true, user };
}

// { success, error?, code?, user? }
export function changeUserRole(userId, role, reqUser) {
  if (!isValidRole(role)) {
    return { success: false, error: 'Invalid role', code: 400 };
  }
  if (isInitialAdmin(userId) && role !== USER_ROLE.ADMIN) {
    return { success: false, error: 'Cannot remove admin role from the initial admin', code: 403 };
  }
  const user = updateUserRole(userId, role);
  console.log(`[Admin] ${reqUser.email} changed user #${userId} (${user.email}) role → ${role}`);
  return { success: true, user };
}

// { success, error?, code? }
export function removeUser(userId, reqUser) {
  if (parseInt(userId) === reqUser.id) {
    return { success: false, error: 'Cannot delete yourself', code: 400 };
  }
  if (isInitialAdmin(userId)) {
    return { success: false, error: 'Cannot delete the initial admin', code: 403 };
  }
  const target = findUserById(userId);
  deleteUser(userId);
  console.log(`[Admin] ${reqUser.email} deleted user #${userId} (${target?.email || 'unknown'})`);
  return { success: true };
}

export function listUsers() {
  return getAllUsers().map(u => ({
    ...u,
    protected: isProtectedEmail(u.email),
  }));
}

export function listPendingUsers() {
  return getPendingUsers();
}

export function getUserStats() {
  const users = getAllUsers();
  return {
    total_users: users.length,
    active_users: users.filter(u => u.status === USER_STATUS.ACTIVE).length,
    pending_users: users.filter(u => u.status === USER_STATUS.PENDING).length,
    blocked_users: users.filter(u => u.status === USER_STATUS.BLOCKED).length,
    admin_users: users.filter(u => u.role === USER_ROLE.ADMIN).length,
  };
}
