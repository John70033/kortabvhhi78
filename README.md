# Legal Browser Video Call

A legal browser-based video calling app that requires explicit user permission for camera and microphone.

## Features
- Room-based video calling
- Unique shareable link
- User consent screen before camera/mic access
- Mute and camera toggle
- Leave call button
- Works from browser only, no app install required

## Run locally
1. Install Node.js
2. Open terminal in the project folder
3. Run:
   npm install
   npm start

Then open:
http://localhost:3000

Create a room and share the generated link.

## Important
- Use HTTPS in production
- Browser camera and microphone access only works after user clicks Allow
- This is legal and consent-based

## Deployment
You can deploy on:
- Render
- Railway
- VPS or any Node.js hosting
