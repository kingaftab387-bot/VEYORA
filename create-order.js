const PLANS = {
  '₹50 · 1 Day': { amount: 5000, label: '1 Day' },
  '₹200 · 1 Week': { amount: 20000, label: '1 Week' },
  '₹599 · 1 Month': { amount: 59900, label: '1 Month' }
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function onRequestPost(context) {
  try {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = context.env;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return json({ ok: false, error: 'Razorpay server keys are not configured.' }, 500);
    }

    const body = await context.request.json().catch(() => ({}));
    const plan = String(body.plan || '');
    const selected = PLANS[plan];
    if (!selected) return json({ ok: false, error: 'Invalid VEYORA plan.' }, 400);

    const receipt = `veyora_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: selected.amount,
        currency: 'INR',
        receipt,
        notes: { product: 'VEYORA Paid Match', plan: selected.label }
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({ ok: false, error: data?.error?.description || 'Razorpay order creation failed.' }, response.status >= 400 && response.status < 500 ? response.status : 502);
    }

    return json({
      ok: true,
      order_id: data.id,
      amount: data.amount,
      currency: data.currency,
      plan: selected.label
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Could not create payment order.' }, 500);
  }
}
