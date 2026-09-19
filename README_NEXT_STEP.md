# VEYORA Next Step

This ZIP now includes Razorpay Standard Checkout with Cloudflare Pages Functions.

1. Deploy the project using a Cloudflare Pages deployment method that supports `/functions` (Git integration or Wrangler).
2. Add Production environment variables/secrets in Cloudflare:
   - `RAZORPAY_KEY_ID` = the new Test Key ID you generated.
   - `RAZORPAY_KEY_SECRET` = the new Test Secret. Keep this secret private.
3. Redeploy.
4. Open VEYORA → Paid Match → choose ₹50/₹200/₹599 → Pay Now → Razorpay.
5. Complete a Razorpay test payment.
6. Only after the payment is verified should Paid Match become active for that selected plan.

Do not paste the Secret Key into chat.
