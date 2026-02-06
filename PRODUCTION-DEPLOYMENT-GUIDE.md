# 🚀 Production Deployment & Security Guide

## Complete Checklist for Going Live

This guide covers everything you need to deploy your app securely to production.

---

## 📋 Pre-Deployment Checklist

### ✅ Step 1: Update Firestore Security Rules

**CRITICAL:** Your database is currently in TEST MODE (anyone can read/write)!

1. Go to **Firebase Console** → **Firestore Database** → **Rules**
2. Copy the contents from your `firestore.rules` file
3. Paste and click **"Publish"**

**Your rules should look like this:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isSignedIn() && 
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow create: if isSignedIn();
      allow update: if isOwner(userId) || isAdmin();
      allow delete: if isAdmin();
    }
    
    // Pools collection
    match /pools/{poolId} {
      allow read: if isSignedIn();
      allow create: if isAdmin();
      allow update: if isAdmin() || 
                      (isSignedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['grid']));
      allow delete: if isAdmin();
    }
    
    // Activity log
    match /activityLog/{logId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn();
      allow update, delete: if false;
    }
  }
}
```

### ✅ Step 2: Configure Firebase Authentication Settings

1. Go to **Firebase Console** → **Authentication** → **Settings**
2. **Authorized domains:** Add your production domain
   - Click "Add domain"
   - Enter: `yourdomain.com` and `www.yourdomain.com`
3. **Email enumeration protection:** ENABLE (prevents attackers from discovering user emails)
4. **Password policy:** Consider enabling strong password requirements

### ✅ Step 3: Set Up Password Reset Email Template

1. Go to **Firebase Console** → **Authentication** → **Templates**
2. Click **"Password reset"**
3. Customize:
   - **Sender name:** "Touchdown Squares"
   - **Reply-to email:** Your support email
   - **Subject:** "Reset your Touchdown Squares password"
   - **Body:** Customize with your branding
4. **Link expiration:** Default is 1 hour (Firebase doesn't support 15 minutes)

**Note on 15-minute expiry:** Firebase password reset links expire in 1 hour by default. This cannot be changed to 15 minutes. However, the rate limiting (3 requests per 5 minutes) is implemented in the app code.

### ✅ Step 4: Enable Firebase App Check (Optional but Recommended)

Protects your app from abuse (bots, scrapers):

1. Go to **Firebase Console** → **App Check**
2. Click **"Get started"**
3. Register your web app
4. Choose **reCAPTCHA v3** (easiest for web)
5. Add your site key to `firebase-config.js`:

```javascript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

// ... existing config ...

const app = initializeApp(firebaseConfig);

// Enable App Check
initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('YOUR_RECAPTCHA_SITE_KEY'),
  isTokenAutoRefreshEnabled: true
});

export const auth = getAuth(app);
export const db = getFirestore(app);
```

---

## 🌐 Deployment Options

### Option 1: Vercel (Recommended - Easiest)

**Pros:** Free SSL, auto-deploys, CDN, great performance
**Cost:** Free for personal projects

**Steps:**

1. **Push code to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/touchdown-squares.git
git push -u origin main
```

2. **Deploy to Vercel:**
```bash
npm install -g vercel
vercel login
vercel
```

3. **Configure:**
   - Project name: `touchdown-squares`
   - Framework: `Vite`
   - Build command: `npm run build`
   - Output directory: `dist`

4. **Add custom domain** (optional):
   - Vercel dashboard → Settings → Domains
   - Add your domain
   - Update DNS records as shown

5. **Environment variables** (if needed):
   - Vercel dashboard → Settings → Environment Variables
   - Add any secrets (though Firebase config is public-safe)

**Deploy updates:**
```bash
git add .
git commit -m "Update"
git push
# Vercel auto-deploys!
```

---

### Option 2: Netlify

**Pros:** Free SSL, drag-and-drop, forms, serverless functions
**Cost:** Free for personal projects

**Steps:**

1. **Build your app:**
```bash
npm run build
```

2. **Deploy:**
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

Or **drag-and-drop:**
- Go to https://app.netlify.com/drop
- Drag your `dist` folder
- Done!

3. **Custom domain:**
   - Netlify dashboard → Domain settings
   - Add custom domain
   - Update DNS

---

### Option 3: Firebase Hosting

**Pros:** Integrated with Firebase, fast CDN, SSL included
**Cost:** Free (generous limits)

**Steps:**

1. **Install Firebase CLI:**
```bash
npm install -g firebase-tools
firebase login
```

2. **Initialize hosting:**
```bash
firebase init hosting
```

Select:
- Use existing project: `touchdown-squares`
- Public directory: `dist`
- Single-page app: `Yes`
- Set up automatic builds: `No`
- Overwrite index.html: `No`

3. **Build and deploy:**
```bash
npm run build
firebase deploy --only hosting
```

4. **Custom domain:**
```bash
firebase hosting:channel:create live
```

Then add domain in Firebase Console → Hosting → Add custom domain

**Your app URL:** `https://touchdown-squares.web.app`

---

## 🔒 Security Hardening

### 1. Enable HTTPS Only

All deployment platforms (Vercel/Netlify/Firebase) automatically enable HTTPS. Just make sure:
- Never use `http://` in links
- Firebase Auth requires HTTPS

### 2. Content Security Policy (CSP)

Add to your HTML `<head>` in `index.html`:

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' https://www.gstatic.com;
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://*.firebaseio.com https://*.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self';
">
```

### 3. Secure Headers

**For Vercel:** Create `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

**For Netlify:** Create `netlify.toml`:
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### 4. Rate Limiting

Already implemented for password resets (3 per 5 minutes). Consider adding to Firebase:

**Firebase App Check** (see Step 4 above) provides:
- Bot protection
- Abuse prevention
- Rate limiting

### 5. Monitor Firebase Usage

Set up budget alerts:

1. Firebase Console → Usage & billing
2. Set budget alerts at 50%, 80%, 100%
3. Monitor for unusual activity

### 6. Backup Your Data

**Automated backups:**

1. Go to Firebase Console → Firestore → Import/Export
2. Set up Cloud Scheduler for automated backups
3. Export to Cloud Storage bucket

**Manual backup:**
- Use the "Export Data" button in your app
- Store backups securely

---

## 🔐 Firebase Security Checklist

- [ ] Firestore security rules published (NOT test mode)
- [ ] Email enumeration protection enabled
- [ ] Authorized domains configured
- [ ] Password reset email template customized
- [ ] App Check enabled (optional)
- [ ] Budget alerts set up
- [ ] Admin accounts use strong passwords
- [ ] Database backup schedule created

---

## 📊 Monitoring & Analytics

### 1. Firebase Analytics (Free)

1. Firebase Console → Analytics
2. Enable Google Analytics
3. Track:
   - User signups
   - Pool creations
   - Square selections
   - Active users

### 2. Error Monitoring

Add Sentry (optional):

```bash
npm install @sentry/browser
```

```javascript
import * as Sentry from "@sentry/browser";

Sentry.init({
  dsn: "your-sentry-dsn",
  environment: "production"
});
```

### 3. Uptime Monitoring

Use free services:
- **UptimeRobot** - monitors your site every 5 minutes
- **Better Uptime** - checks availability and alerts you

---

## 🧪 Testing Before Launch

### Pre-Launch Testing Checklist:

- [ ] Test signup/login on production URL
- [ ] Test password reset email
- [ ] Create a pool
- [ ] Select squares as different users
- [ ] Test admin functions
- [ ] Test on mobile devices
- [ ] Test in different browsers (Chrome, Safari, Firefox)
- [ ] Check console for errors
- [ ] Verify Firestore rules are active
- [ ] Test with slow network connection
- [ ] Verify SSL certificate is valid

### Load Testing (Optional):

For high-traffic events:
1. Use **Artillery** or **k6** for load testing
2. Test with 100+ concurrent users
3. Monitor Firebase quotas

---

## 🚨 Launch Day Checklist

- [ ] All security rules published
- [ ] Firestore in PRODUCTION mode (not test)
- [ ] Firebase Auth configured
- [ ] Custom domain set up (if using)
- [ ] SSL/HTTPS working
- [ ] Tested on multiple devices
- [ ] Admin account created and tested
- [ ] Backup created
- [ ] Monitoring enabled
- [ ] Error tracking active
- [ ] Password reset working
- [ ] Rate limiting tested

---

## 📞 Support & Maintenance

### Regular Maintenance:

1. **Weekly:**
   - Check Firebase usage
   - Review activity logs
   - Monitor errors

2. **Monthly:**
   - Export data backup
   - Review security rules
   - Check for Firebase SDK updates

3. **As Needed:**
   - Update dependencies: `npm update`
   - Test after Firebase updates
   - Respond to user issues

### Getting Help:

- **Firebase Support:** https://firebase.google.com/support
- **Vercel Support:** https://vercel.com/support
- **Community:** Stack Overflow

---

## 💰 Cost Estimates

### Firebase (Free Tier):
- **Firestore:** 50K reads/day, 20K writes/day
- **Auth:** Unlimited
- **Hosting:** 10GB/month bandwidth
- **Supports:** ~500-1000 daily active users

### When You Grow:
- **Firestore:** $0.06/100K reads, $0.18/100K writes
- **10K users:** ~$20-50/month
- Still very affordable!

### Hosting:
- **Vercel:** Free for personal, $20/month Pro
- **Netlify:** Free for personal, $19/month Pro
- **Firebase Hosting:** Free (generous limits)

---

## 🎉 You're Ready to Launch!

Once you complete this checklist, your app is production-ready and secure!

**Final steps:**
1. Deploy to Vercel/Netlify/Firebase
2. Enable security rules
3. Test everything
4. Share with users!

Go Hawks! 🦅💚
