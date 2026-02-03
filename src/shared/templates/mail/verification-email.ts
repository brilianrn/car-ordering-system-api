export const getVerificationEmailTemplate = (link: string): string => {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Akun</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Car Ordering System</h1>
              <p style="margin: 10px 0 0 0; color: #f0f0f0; font-size: 14px;">Dharma Polimetal</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px; font-weight: 600;">Verifikasi Akun Anda</h2>
              <p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Terima kasih telah mendaftar di Car Ordering System. Untuk mengaktifkan akun Anda, silakan klik tombol di bawah ini:
              </p>
              
              <!-- Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                      Verifikasi Akun
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 20px 0 10px 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Atau salin dan tempel link berikut ke browser Anda:
              </p>
              <p style="margin: 0; padding: 12px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px; word-break: break-all;">
                <a href="${link}" style="color: #667eea; text-decoration: none; font-size: 13px;">${link}</a>
              </p>
              
              <p style="margin: 30px 0 0 0; color: #999999; font-size: 13px; line-height: 1.6;">
                Jika Anda tidak mendaftar di Car Ordering System, abaikan email ini.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 20px 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} Dharma Polimetal. All rights reserved.
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
