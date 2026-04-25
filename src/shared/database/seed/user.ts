import * as bcrypt from 'bcryptjs';
import { clientDb as prisma } from '../../utils/db'; // Sesuaikan path clientDb kamu

export const seedUsers = async () => {
  console.log('Seeding Super Admin...');

  // 1. Cari Unit IT (Harusnya sudah ada dari seed sebelumnya)
  const itUnit = await prisma.organizationUnit.findUnique({
    where: { code: 'CORP_IT' },
  });

  if (!itUnit) {
    throw new Error('Unit CORP_IT tidak ditemukan! Jalankan seed org-unit dulu.');
  }

  // 2. Buat Employee "Super Admin"
  const superAdmin = await prisma.employee.upsert({
    where: { employeeId: 'ADM999' },
    update: {
      effectiveRoles: { set: ['ADMIN'] },
    },
    create: {
      employeeId: 'ADM999',
      fullName: 'Super Admin',
      email: 'superadmin@cos.dharma.co.id',
      orgUnitId: itUnit.id,
      effectiveFrom: new Date(),
      position: 'System Administrator',
      approverL1Id: null, // Tidak punya atasan (Highest Level)
      effectiveRoles: ['ADMIN'],
      createdBy: 'SYSTEM',
    },
  });

  // 3. Buat Akun Login (Password: admin123)
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('admin123', salt);

  await prisma.account.upsert({
    where: { email: 'superadmin@cos.dharma.co.id' },
    update: {
      password: hashedPassword,
      isVerified: true,
    },
    create: {
      email: 'superadmin@cos.dharma.co.id',
      password: hashedPassword,
      employeeId: superAdmin.employeeId,
      isVerified: true,
    },
  });

  console.log('✅ Super Admin Seeded Successfully!');
  console.log('   Email: superadmin@cos.dharma.co.id');
  console.log('   Pass : admin123');
};
