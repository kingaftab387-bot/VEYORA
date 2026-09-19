# VEYORA Razorpay setup

This build replaces the old PhonePe/Google Pay direct UPI screen with Razorpay Standard Checkout.

## Included
- `functions/api/create-order.js` creates a Razorpay order on the server.
- `functions/api/verify-payment.js` verifies the Razorpay HMAC signature and checks that the payment is captured, the amount matches the selected VEYORA plan, and the order ID matches.
- `functions/api/config.js` exposes only the public Razorpay Key ID to the browser.
- Razorpay Secret is never sent to the browser and is not included in this ZIP.

## Cloudflare variables/secrets
In the VEYORA Cloudflare Pages project, add these for the Production environment:

- `RAZORPAY_KEY_ID` = your new Razorpay Test Key ID
- `RAZORPAY_KEY_SECRET` = your new Razorpay Test Key Secret (mark it as a secret)

Do not put the Secret in `app.js`, HTML, GitHub, or any public file.

## Important deployment note
Because this build contains a `/functions` directory, it must be deployed using a Cloudflare Pages deployment method that supports Pages Functions (for example Git integration or Wrangler). Cloudflare's current documentation says direct dashboard upload does not support Functions.

## Test mode
Use the `rzp_test_...` key first. Complete a test payment and confirm the Razorpay Dashboard shows the payment. After the test flow is working and the Razorpay account is approved for live use, replace the Cloudflare variables with the Live Key ID and Live Secret and redeploy.

## VEYORA plans
- ₹50 — 1 Day
- ₹200 — 1 Week
- ₹599 — 1 Month

The server accepts only these three plan amounts, so the browser cannot change the price by editing the page.
