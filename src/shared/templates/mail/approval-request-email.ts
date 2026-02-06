export interface ApprovalRequestEmailData {
  approverName: string;
  bookingNumber: string;
  requesterName: string;
  destination: string;
  date: string;
  purpose: string;
  approveLink: string;
  rejectLink: string;
}

export const getApprovalRequestEmailTemplate = (data: ApprovalRequestEmailData): string => {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Permintaan Persetujuan Booking</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🚗 Permintaan Persetujuan</h1>
              <p style="margin: 10px 0 0 0; color: #f0f0f0; font-size: 14px;">Car Ordering System - Dharma Polimetal</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px;">
                Halo <strong>${data.approverName}</strong>,
              </p>
              <p style="margin: 0 0 30px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Anda memiliki permintaan booking mobil baru yang memerlukan persetujuan Anda.
              </p>
              
              <!-- Booking Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 20px;">
                    <h3 style="margin: 0 0 15px 0; color: #333333; font-size: 18px;">Detail Booking</h3>
                    <table width="100%" cellpadding="8" cellspacing="0">
                      <tr>
                        <td style="color: #666666; font-size: 14px; width: 40%;">Nomor Booking:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: 600;">${data.bookingNumber}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px;">Pemohon:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: 600;">${data.requesterName}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px;">Tujuan:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: 600;">${data.destination}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px;">Tanggal:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: 600;">${data.date}</td>
                      </tr>
                      <tr>
                        <td style="color: #666666; font-size: 14px;">Keperluan:</td>
                        <td style="color: #333333; font-size: 14px; font-weight: 600;">${data.purpose}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Silakan pilih tindakan yang ingin Anda lakukan:
              </p>
              
              <!-- Action Buttons -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;">
                <tr>
                  <td width="48%" align="center">
                    <a href="${data.approveLink}" style="display: block; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: #ffffff; text-decoration: none; padding: 16px 30px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);">
                      ✅ Setujui
                    </a>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" align="center">
                    <a href="${data.rejectLink}" style="display: block; background: linear-gradient(135deg, #f44336 0%, #da190b 100%); color: #ffffff; text-decoration: none; padding: 16px 30px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(244, 67, 54, 0.4);">
                      ❌ Tolak
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Security Notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0 0 0; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <tr>
                  <td style="padding: 15px;">
                    <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                      <strong>⚠️ Catatan Keamanan:</strong><br>
                      Link ini akan mengarahkan Anda ke halaman konfirmasi. Token berlaku selama 7 hari. Jangan bagikan link ini kepada orang lain.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Dharma Polimetal - Car Ordering System
              </p>
              <p style="margin: 10px 0 0 0; color: #999999; font-size: 11px;">
                Email otomatis, mohon tidak membalas email ini.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};
