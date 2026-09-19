# VEYORA Razorpay — One-Upload Version

This version uses Cloudflare Pages Advanced Mode with a single `_worker.js` file at the project root.

No `functions/` folder is needed.

Required Cloudflare Pages secrets/variables:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

The secret must stay in Cloudflare and must not be added to GitHub.

The `_worker.js` handles:
- GET `/api/config`
- POST `/api/create-order`
- POST `/api/verify-payment`
- all other requests are served as normal static assets.
