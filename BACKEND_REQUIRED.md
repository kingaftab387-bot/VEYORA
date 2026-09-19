# VEYORA Final Backend Setup

## 1. Supabase SQL
Open Supabase → SQL Editor, paste `MATCHMAKING_REQUIRED.sql`, and run it. If an error appears, copy the complete error text before retrying.

## 2. Realtime
Open Supabase → Database → Replication/Realtime and enable Realtime for:
- `match_queue`
- `matches`
- `video_signals`

## 3. Authentication
In Supabase → Authentication → Providers, enable Google and Facebook. Phone OTP is removed from the VEYORA login screen.

Use this production redirect URL:
`https://veyora-chat.pages.dev/`

## 4. Two-phone test
1. Open the deployed site on two phones.
2. Sign in with two different Google/Facebook accounts.
3. Complete profile on both phones.
4. Select the same country and Free Chat.
5. Allow camera and microphone.
6. Keep both screens open until a match appears.
7. Speak from one phone and confirm the other phone receives audio/video.
8. Test Next, Report, Block, Chat, camera switch, mute, and logout.

## 5. Paid Chat
The current payment screen is a PhonePe/Google Pay UPI flow. Razorpay live checkout is not connected yet. Do not advertise Paid Chat as verified until payment verification/webhook and server-side access checks are added.

## 6. Important
The ZIP contains the website code and SQL. Supabase dashboard settings, OAuth credentials, Realtime enablement, and payment KYC/live keys must be completed in your own accounts.
