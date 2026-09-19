export async function onRequestGet(context) {
  const keyId = context.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    return Response.json({ ok: false, error: 'Razorpay Key ID is not configured.' }, { status: 500 });
  }
  return Response.json({ ok: true, key_id: keyId, mode: keyId.startsWith('rzp_test_') ? 'test' : 'live' }, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
