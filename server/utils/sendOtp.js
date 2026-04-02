const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function sendOtp(toEmail, otp) {
  await resend.emails.send({
    from: "Fuel Spotter <onboarding@resend.dev>",
    to: toEmail,
    subject: "Your Password Reset OTP",
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
        <h2 style="color:#f97316">⛽ Fuel Spotter</h2>
        <p>Your OTP for password reset:</p>
        <h1 style="letter-spacing:12px;color:#f97316">${otp}</h1>
        <p style="color:#888;font-size:13px">Expires in <b>10 minutes</b>.</p>
      </div>
    `,
  });
};