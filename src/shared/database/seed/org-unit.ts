import 'dotenv/config';
import { clientDb as prisma } from '../../utils/db';

export const seedOrgUnits = async () => {
  await prisma.organizationUnit.upsert({
    where: { code: 'BOD' },
    update: {},
    create: {
      code: 'BOD',
      name: 'Board of Directors',
      type: 'BOARD',
      createdBy: 'SYSTEM',
    },
  });

  const units = [
    { code: 'BU_2W', name: 'Business Unit 2 Wheel', parentCode: 'BOD' },
    { code: 'BU_3W', name: 'Business Unit 3 Wheel', parentCode: 'BOD' },
    { code: 'BU_4W', name: 'Business Unit 4 Wheel', parentCode: 'BOD' },
    { code: 'FASTENER', name: 'Fastener', parentCode: 'BOD' },
    { code: 'CORP_IT', name: 'Information Technology', parentCode: 'BOD' },
    { code: 'CORP_HRGA', name: 'HRGA', parentCode: 'BOD' },
  ];

  for (const u of units) {
    await prisma.organizationUnit.upsert({
      where: { code: u.code },
      update: {},
      create: {
        code: u.code,
        name: u.name,
        type: 'BUSINESS_UNIT',
        parentCode: u.parentCode,
        createdBy: 'SYSTEM',
      },
    });
  }

  const depts2W = [
    { code: 'MKT_2W', name: 'Marketing 2W', type: 'DEPT' },
    { code: 'PROD_2W', name: 'Production 2W', type: 'DEPT' },
    { code: 'PPIC_2W', name: 'PPIC 2W', type: 'DEPT' },
    { code: 'QC_2W', name: 'Quality Control 2W', type: 'DEPT' },
    { code: 'PLANT_CRB', name: 'Cirebon Plant', type: 'PLANT' },
  ];

  for (const d of depts2W) {
    await prisma.organizationUnit.upsert({
      where: { code: d.code },
      update: {},
      create: {
        code: d.code,
        name: d.name,
        type: d.type,
        parentCode: 'BU_2W',
        createdBy: 'SYSTEM',
      },
    });
  }

  console.log('Organization Structure seeded successfully!');
};
