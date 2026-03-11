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
🚗 *BOOKING APPROVAL REQUEST*

Hello *${data.approverName}*,

You have a new car booking request that requires your approval.

📋 *Booking Details:*
• Number: ${data.bookingNumber}
• Requester: ${data.requesterName}
• Destination: ${data.destination}
• Date: ${data.date}
• Purpose: ${data.purpose}

Please select an action:

✅ *Approve:*
${data.approveLink}

❌ *Reject:*
${data.rejectLink}

⚠️ _Token is valid for 7 days. Link will redirect to the confirmation page._

---
_Car Ordering System - Dharma Polimetal_
  `.trim();
};
