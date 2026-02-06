export interface ApprovalRequestWhatsAppData {
  approverName: string;
  bookingNumber: string;
  requesterName: string;
  destination: string;
  date: string;
  purpose: string;
  approveLink: string;
  rejectLink: string;
}

export const getApprovalRequestWhatsAppMessage = (data: ApprovalRequestWhatsAppData): string => {
  return `
🚗 *PERMINTAAN PERSETUJUAN BOOKING*

Halo *${data.approverName}*,

Anda memiliki permintaan booking mobil baru yang memerlukan persetujuan Anda.

📋 *Detail Booking:*
• Nomor: ${data.bookingNumber}
• Pemohon: ${data.requesterName}
• Tujuan: ${data.destination}
• Tanggal: ${data.date}
• Keperluan: ${data.purpose}

Silakan pilih tindakan:

✅ *Setujui:*
${data.approveLink}

❌ *Tolak:*
${data.rejectLink}

⚠️ _Token berlaku 7 hari. Link akan mengarahkan ke halaman konfirmasi._

---
_Car Ordering System - Dharma Polimetal_
  `.trim();
};
