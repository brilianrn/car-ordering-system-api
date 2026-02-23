export const getDriverAccountCreatedEmailTemplate = (params: {
  driverName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  driverCode: string;
}) => {
  const { driverName, email, tempPassword, loginUrl, driverCode } = params;

  return {
    subject: 'Akun Driver Telah Dibuat - Car Ordering System',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
          .credentials { background-color: #fff; padding: 15px; border-left: 4px solid #0066cc; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Selamat Datang, ${driverName}!</h1>
          </div>
          
          <div class="content">
            <p>Halo <strong>${driverName}</strong>,</p>
            
            <p>Akun driver Anda telah berhasil dibuat di <strong>Car Ordering System</strong>.</p>
            
            <div class="credentials">
              <h3>Informasi Akun Anda:</h3>
              <p><strong>Kode Driver:</strong> ${driverCode}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password Sementara:</strong> <code>${tempPassword}</code></p>
            </div>
            
            <div class="warning">
              <strong>⚠️ Penting:</strong>
              <p>Password di atas adalah password sementara yang dibuat oleh sistem. Demi keamanan akun Anda, silakan segera mengubah password setelah login pertama kali.</p>
            </div>
            
            <p>Anda dapat login melalui link di bawah ini:</p>
            <p style="text-align: center;">
              <a href="${loginUrl}" class="button">Login ke Car Ordering System</a>
            </p>
            
            <p>Atau salin URL berikut ke browser Anda:<br>
            <a href="${loginUrl}">${loginUrl}</a></p>
            
            <h3>Langkah Selanjutnya:</h3>
            <ol>
              <li>Login menggunakan email dan password sementara di atas</li>
              <li>Ubah password Anda segera setelah login</li>
              <li>Lengkapi profil Anda jika diperlukan</li>
            </ol>
            
            <p>Jika Anda mengalami kesulitan dalam login atau memiliki pertanyaan, silakan hubungi administrator sistem.</p>
          </div>
          
          <div class="footer">
            <p>Email ini dikirim secara otomatis oleh Car Ordering System.</p>
            <p>Mohon tidak membalas email ini.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Selamat Datang, ${driverName}!

Akun driver Anda telah berhasil dibuat di Car Ordering System.

Informasi Akun Anda:
- Kode Driver: ${driverCode}
- Email: ${email}
- Password Sementara: ${tempPassword}

PENTING: Password di atas adalah password sementara. Silakan segera mengubah password setelah login pertama kali.

Login melalui: ${loginUrl}

Langkah Selanjutnya:
1. Login menggunakan email dan password sementara di atas
2. Ubah password Anda segera setelah login
3. Lengkapi profil Anda jika diperlukan

Jika Anda mengalami kesulitan, silakan hubungi administrator sistem.

---
Email ini dikirim secara otomatis oleh Car Ordering System.
Mohon tidak membalas email ini.
    `,
  };
};
