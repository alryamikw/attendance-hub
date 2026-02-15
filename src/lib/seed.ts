/**
 * Database Seeding Script
 * Automatically initializes the database with default data
 */

import { db } from './db';

export async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Check if already seeded
    const existingRoles = await db.role.count();
    if (existingRoles > 0) {
      console.log('✅ Database already seeded');
      return { success: true, alreadySeeded: true };
    }
    
    // Create Roles
    console.log('Creating roles...');
    const roles = await Promise.all([
      db.role.create({ data: { name: 'platform_owner', displayName: 'Platform Owner', isSystem: true, description: 'Full platform access' } }),
      db.role.create({ data: { name: 'company_admin', displayName: 'Company Admin', isSystem: true, description: 'Full company access' } }),
      db.role.create({ data: { name: 'branch_admin', displayName: 'Branch Admin', isSystem: true, description: 'Branch management' } }),
      db.role.create({ data: { name: 'hr_manager', displayName: 'HR Manager', isSystem: true, description: 'HR operations' } }),
      db.role.create({ data: { name: 'employee', displayName: 'Employee', isSystem: true, description: 'Basic employee access' } }),
    ]);
    
    // Create Permissions
    console.log('Creating permissions...');
    const permissions = [
      // Employees
      { module: 'employees', action: 'create', resource: 'all', description: 'Create employees' },
      { module: 'employees', action: 'read', resource: 'all', description: 'View all employees' },
      { module: 'employees', action: 'read', resource: 'branch', description: 'View branch employees' },
      { module: 'employees', action: 'read', resource: 'own', description: 'View own profile' },
      { module: 'employees', action: 'update', resource: 'all', description: 'Update all employees' },
      { module: 'employees', action: 'update', resource: 'own', description: 'Update own profile' },
      { module: 'employees', action: 'delete', resource: 'all', description: 'Delete employees' },
      // Attendance
      { module: 'attendance', action: 'create', resource: 'own', description: 'Check in/out' },
      { module: 'attendance', action: 'read', resource: 'all', description: 'View all attendance' },
      { module: 'attendance', action: 'read', resource: 'branch', description: 'View branch attendance' },
      { module: 'attendance', action: 'read', resource: 'own', description: 'View own attendance' },
      { module: 'attendance', action: 'update', resource: 'all', description: 'Edit attendance' },
      { module: 'attendance', action: 'approve', resource: 'all', description: 'Approve attendance' },
      // Reports
      { module: 'reports', action: 'read', resource: 'all', description: 'View all reports' },
      { module: 'reports', action: 'read', resource: 'branch', description: 'View branch reports' },
      { module: 'reports', action: 'export', resource: 'all', description: 'Export reports' },
      // Payroll
      { module: 'payroll', action: 'read', resource: 'all', description: 'View payroll' },
      { module: 'payroll', action: 'read', resource: 'own', description: 'View own payroll' },
      { module: 'payroll', action: 'create', resource: 'all', description: 'Create payroll' },
      { module: 'payroll', action: 'approve', resource: 'all', description: 'Approve payroll' },
      // Settings
      { module: 'settings', action: 'read', resource: 'all', description: 'View settings' },
      { module: 'settings', action: 'update', resource: 'all', description: 'Update settings' },
      // Branches
      { module: 'branches', action: 'create', resource: 'all', description: 'Create branches' },
      { module: 'branches', action: 'read', resource: 'all', description: 'View branches' },
      { module: 'branches', action: 'update', resource: 'all', description: 'Update branches' },
      { module: 'branches', action: 'delete', resource: 'all', description: 'Delete branches' },
      // Time Off
      { module: 'timeoff', action: 'create', resource: 'own', description: 'Request leave' },
      { module: 'timeoff', action: 'read', resource: 'all', description: 'View all requests' },
      { module: 'timeoff', action: 'approve', resource: 'all', description: 'Approve requests' },
    ];
    
    for (const perm of permissions) {
      await db.permission.create({ data: perm });
    }
    
    // Assign all permissions to platform_owner
    const platformOwnerRole = roles.find(r => r.name === 'platform_owner');
    const allPermissions = await db.permission.findMany();
    
    for (const perm of allPermissions) {
      await db.rolePermission.create({
        data: { roleId: platformOwnerRole!.id, permissionId: perm.id },
      });
    }
    
    // Assign most permissions to company_admin
    const companyAdminRole = roles.find(r => r.name === 'company_admin');
    for (const perm of allPermissions) {
      await db.rolePermission.create({
        data: { roleId: companyAdminRole!.id, permissionId: perm.id },
      });
    }
    
    // Create default subscription plans
    console.log('Creating subscription plans...');
    await db.subscriptionPlan.createMany({
      data: [
        { name: 'Starter', slug: 'starter', description: 'For small teams', priceMonthly: 29, priceYearly: 290, employeeLimit: 10, branchLimit: 1, storageLimit: 500, sortOrder: 1 },
        { name: 'Professional', slug: 'professional', description: 'For growing businesses', priceMonthly: 79, priceYearly: 790, employeeLimit: 50, branchLimit: 5, storageLimit: 2000, sortOrder: 2 },
        { name: 'Enterprise', slug: 'enterprise', description: 'For large organizations', priceMonthly: 199, priceYearly: 1990, employeeLimit: 500, branchLimit: 20, storageLimit: 10000, sortOrder: 3 },
      ],
      skipDuplicates: true,
    });
    
    console.log('✅ Database seeding completed!');
    return { success: true, alreadySeeded: false };
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    return { success: false, error: String(error) };
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
