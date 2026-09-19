VEYORA FINAL WORKING BASE

Deploy this package as the website build.

Existing Supabase setup is preserved. No new SQL is required for this build.

Included fixes:
- Preserves login/profile/online/match/country/gender flow from the working base.
- Adds realtime WebRTC signaling with REST fallback.
- Queues ICE candidates until remote description is ready.
- Adds realtime chat between matched users.
- Preserves local camera and microphone tracks.
- Cleans call channels and peer connections on Next/End.

For production WebRTC reliability across restrictive mobile networks, a TURN relay may still be required.
