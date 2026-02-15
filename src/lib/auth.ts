import { db } from './db';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const SESSION_COOKIE = 'session_token';
const REFRESH_COOKIE = 'refresh_token';
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const REFRESH_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  tenantId?: string;
  employeeId?: string;
  permissions: string[];
}

export interface AuthResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
}

// Hash password with salt
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// Verify password
export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Generate tokens
export function generateTokens(): { token: string; refreshToken: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const refreshToken = crypto.randomBytes(32).toString('hex');
  return { token, refreshToken };
}

// Create session
export async function createSession(
  userId: string,
  deviceInfo: string,
  ipAddress: string,
  userAgent: string
): Promise<{ token: string; refreshToken: string }> {
  const { token, refreshToken } = generateTokens();
  
  await db.session.create({
    data: {
      userId,
      token,
      refreshToken,
      deviceInfo,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY),
    },
  });
  
  return { token, refreshToken };
}

// Get current user from request
export async function getCurrentUser(req?: NextRequest): Promise<SessionUser | null> {
  try {
    let token: string | undefined;
    
    if (req) {
      token = req.cookies.get(SESSION_COOKIE)?.value || 
               req.headers.get('authorization')?.replace('Bearer ', '');
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE)?.value;
    }
    
    if (!token) return null;
    
    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            platformAdmin: true,
            employee: {
              include: {
                tenant: true,
              },
            },
          },
        },
      },
    });
    
    if (!session || session.expiresAt < new Date()) {
      return null;
    }
    
    // Get user role and permissions
    const userRole = await db.userRole.findFirst({
      where: { userId: session.user.id },
      include: {
        role: {
          include: {
            rolePerms: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
    
    const permissions = userRole?.role.rolePerms.map(rp => 
      `${rp.permission.module}:${rp.permission.action}:${rp.permission.resource}`
    ) || [];
    
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatar: session.user.avatar || undefined,
      role: session.user.platformAdmin?.role || 
            userRole?.role.name || 'employee',
      tenantId: session.user.employee?.tenantId || undefined,
      employeeId: session.user.employee?.id || undefined,
      permissions,
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

// Login
export async function login(
  email: string,
  password: string,
  deviceInfo: string,
  ipAddress: string,
  userAgent: string
): Promise<AuthResult> {
  try {
    const user = await db.user.findUnique({
      where: { email },
      include: {
        platformAdmin: true,
        employee: true,
      },
    });
    
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    if (!user.isActive) {
      return { success: false, error: 'Account is deactivated' };
    }
    
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { success: false, error: 'Account is temporarily locked' };
    }
    
    if (!verifyPassword(password, user.passwordHash)) {
      // Increment failed attempts
      await db.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: { increment: 1 },
          lockedUntil: user.failedAttempts >= 4 ? new Date(Date.now() + 30 * 60 * 1000) : null,
        },
      });
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Create session
    const { token, refreshToken } = await createSession(
      user.id,
      deviceInfo,
      ipAddress,
      userAgent
    );
    
    // Update user
    await db.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    
    // Create audit log
    await db.auditLog.create({
      data: {
        userId: user.id,
        tenantId: user.employee?.tenantId,
        action: 'login',
        module: 'auth',
        ipAddress,
        userAgent,
      },
    });
    
    return { success: true, user: await getCurrentUser() };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'An error occurred' };
  }
}

// Logout
export async function logout(token: string): Promise<void> {
  await db.session.deleteMany({
    where: { token },
  });
}

// Refresh token
export async function refreshSession(refreshToken: string): Promise<{ token: string; refreshToken: string } | null> {
  const session = await db.session.findUnique({
    where: { refreshToken },
  });
  
  if (!session) return null;
  
  await db.session.delete({
    where: { id: session.id },
  });
  
  return createSession(
    session.userId,
    session.deviceInfo || '',
    session.ipAddress || '',
    session.userAgent || ''
  );
}

// Check permission
export function hasPermission(user: SessionUser, module: string, action: string, resource?: string): boolean {
  // Platform admin has all permissions
  if (user.role === 'platform_owner' || user.role === 'platform_admin') {
    return true;
  }
  
  const permission = `${module}:${action}:${resource || 'all'}`;
  const wildcardPermission = `${module}:${action}:all`;
  const moduleWildcard = `${module}:*:*`;
  
  return user.permissions.some(p => 
    p === permission || 
    p === wildcardPermission || 
    p === moduleWildcard ||
    p === '*:*:*'
  );
}

// Create default roles and permissions
export async function seedRolesAndPermissions(): Promise<void> {
  // Create permissions
  const permissions = [
    // Employee permissions
    { module: 'employees', action: 'create', resource: 'all' },
    { module: 'employees', action: 'read', resource: 'all' },
    { module: 'employees', action: 'read', resource: 'branch' },
    { module: 'employees', action: 'read', resource: 'own' },
    { module: 'employees', action: 'update', resource: 'all' },
    { module: 'employees', action: 'update', resource: 'own' },
    { module: 'employees', action: 'delete', resource: 'all' },
    // Attendance permissions
    { module: 'attendance', action: 'create', resource: 'own' },
    { module: 'attendance', action: 'create', resource: 'all' },
    { module: 'attendance', action: 'read', resource: 'all' },
    { module: 'attendance', action: 'read', resource: 'branch' },
    { module: 'attendance', action: 'read', resource: 'own' },
    { module: 'attendance', action: 'update', resource: 'all' },
    { module: 'attendance', action: 'approve', resource: 'all' },
    // Reports permissions
    { module: 'reports', action: 'read', resource: 'all' },
    { module: 'reports', action: 'read', resource: 'branch' },
    { module: 'reports', action: 'read', resource: 'own' },
    { module: 'reports', action: 'export', resource: 'all' },
    // Payroll permissions
    { module: 'payroll', action: 'read', resource: 'all' },
    { module: 'payroll', action: 'read', resource: 'own' },
    { module: 'payroll', action: 'create', resource: 'all' },
    { module: 'payroll', action: 'approve', resource: 'all' },
    // Settings permissions
    { module: 'settings', action: 'read', resource: 'all' },
    { module: 'settings', action: 'update', resource: 'all' },
    // Branch permissions
    { module: 'branches', action: 'create', resource: 'all' },
    { module: 'branches', action: 'read', resource: 'all' },
    { module: 'branches', action: 'update', resource: 'all' },
    { module: 'branches', action: 'delete', resource: 'all' },
  ];
  
  for (const perm of permissions) {
    await db.permission.upsert({
      where: {
        module_action_resource: {
          module: perm.module,
          action: perm.action,
          resource: perm.resource,
        },
      },
      create: perm,
      update: perm,
    });
  }
  
  // Create roles
  const roles = [
    {
      name: 'platform_owner',
      displayName: 'Platform Owner',
      isSystem: true,
      permissions: permissions.map(p => `${p.module}:${p.action}:${p.resource}`),
    },
    {
      name: 'company_admin',
      displayName: 'Company Admin',
      isSystem: true,
      permissions: permissions.filter(p => p.module !== 'tenants').map(p => `${p.module}:${p.action}:${p.resource}`),
    },
    {
      name: 'branch_admin',
      displayName: 'Branch Admin',
      isSystem: true,
      permissions: [
        'employees:read:branch',
        'employees:update:branch',
        'attendance:read:branch',
        'attendance:approve:all',
        'reports:read:branch',
        'reports:export:all',
        'settings:read:all',
      ],
    },
    {
      name: 'hr_manager',
      displayName: 'HR Manager',
      isSystem: true,
      permissions: [
        'employees:create:all',
        'employees:read:all',
        'employees:update:all',
        'attendance:read:all',
        'reports:read:all',
        'reports:export:all',
        'payroll:read:all',
      ],
    },
    {
      name: 'employee',
      displayName: 'Employee',
      isSystem: true,
      permissions: [
        'employees:read:own',
        'employees:update:own',
        'attendance:create:own',
        'attendance:read:own',
        'reports:read:own',
        'payroll:read:own',
      ],
    },
  ];
  
  for (const roleData of roles) {
    const role = await db.role.upsert({
      where: { name: roleData.name },
      create: {
        name: roleData.name,
        displayName: roleData.displayName,
        isSystem: roleData.isSystem,
      },
      update: {
        displayName: roleData.displayName,
      },
    });
    
    // Assign permissions to role
    for (const permStr of roleData.permissions) {
      const [module, action, resource] = permStr.split(':');
      const permission = await db.permission.findFirst({
        where: { module, action, resource },
      });
      
      if (permission) {
        await db.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          create: {
            roleId: role.id,
            permissionId: permission.id,
          },
          update: {},
        });
      }
    }
  }
}
