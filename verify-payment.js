const PLANS = {
  '₹50 · 1 Day': { amount: 5000, label: '1 Day' },
  '₹200 · 1 Week': { amount: 20000, label: '1 Week' },
  '₹599 · 1 Month': { amount: 59900, label: '1 Month' }
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function toHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost(context) {
  try {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = context.env;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ ok: false, error: 'Razorpay server keys are not configured.' }, 500);
    }

    const body = await context.request.json().catch(() => ({}));
    const orderId = String(body.razorpay_order_id || '');
    const paymentId = String(body.razorpay_payment_id || '');
    const signature = String(body.razorpay_signature || '');
    const plan = String(body.plan || '');
    const selected = PLANS[plan];

    if (!orderId || !paymentId || !signature || !selected) {
      return json({ ok: false, error: 'Incomplete or invalid payment details.' }, 400);
    }

    const expected = await hmacSha256(RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
    if (!safeEqual(expected, signature)) {
      return json({ ok: false, error: 'Payment signature verification failed.' }, 400);
    }

    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { 'Authorization': `Basic ${auth}` }
    });
    const payment = await paymentResponse.json().catch(() => ({}));

    if (!paymentResponse.ok) {
      return json({ ok: false, error: payment?.error?.description || 'Could not verify payment status.' }, 502);
    }

    if (payment.order_id !== orderId || payment.currency !== 'INR' || Number(payment.amount) !== selected.amount || payment.status !== 'captured') {
      return json({ ok: false, error: 'Payment was not captured for the selected VEYORA plan.' }, 400);
    }

    return json({
      ok: true,
      verified: true,
      payment_id: paymentId,
      order_id: orderId,
      plan: selected.label,
      amount: selected.amount
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Payment verification failed.' }, 500);
  }
}
