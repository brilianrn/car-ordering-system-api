// import { BookingStatus, ResourceMode, ServiceType } from '@prisma/client';
// import { clientDb } from './src/shared/utils';

// async function main() {
//   const db = clientDb;
//   const requesterId = '10001';
//   const categoryId = 2; // From previous check
//   const now = new Date();
//   now.setMinutes(0, 0, 0);

//   const bookingsData = [
//     { num: 'TEST-B1', time: 0, dest: 'Stasiun Tanggulangin' },
//     { num: 'TEST-B2', time: 10, dest: 'Stasiun Tanggulangin' },
//     { num: 'TEST-B3', time: 20, dest: 'Stasiun Tanggulangin' },
//     { num: 'TEST-B4', time: 60, dest: 'Stasiun Tanggulangin' },
//     { num: 'TEST-B5', time: 5, dest: 'Stasiun Sidoarjo' },
//   ];

//   for (const b of bookingsData) {
//     const startTime = new Date(now.getTime() + b.time * 60000);
//     const endTime = new Date(startTime.getTime() + 60 * 60000);

//     const booking = await db.booking.create({
//       data: {
//         bookingNumber: b.num,
//         requesterId: requesterId,
//         serviceType: ServiceType.DROP,
//         purpose: 'Test Clustering',
//         startAt: startTime,
//         endAt: endTime,
//         passengerCount: 2,
//         categoryId: categoryId,
//         resourceMode: ResourceMode.POOL,
//         bookingStatus: BookingStatus.SUBMITTED,
//         createdBy: 'test-script',
//         segments: {
//           create: {
//             segmentNo: 1,
//             type: 'TRIP',
//             from: 'PT Dharma Polimetal Tbk',
//             to: b.dest,
//             createdBy: 'test-script',
//           },
//         },
//       },
//     });
//     console.log(`Created booking ${b.num} with ID ${booking.id}`);
//   }
// }

// main()
//   .catch((e) => {
//     console.error(e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     // skip disconnect as it might be shared
//   });
