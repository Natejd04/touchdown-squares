# 🚀 Deployment Checklist

## Pre-Deployment

- [ ] Firebase project created
- [ ] Authentication enabled (Email/Password)
- [ ] Firestore database created
- [ ] Web app registered in Firebase
- [ ] `firebase-config.js` updated with YOUR config
- [ ] Dependencies installed (`npm install`)
- [ ] App tested locally (`npm run dev`)
- [ ] Existing data migrated (if applicable)
- [ ] Security rules updated (moved from test mode)

---

## Deploy to Vercel (Recommended)

### One-Time Setup
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login
```

### Deploy
```bash
# Build the app
npm run build

# Deploy to Vercel
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: touchdown-squares
# - Directory: ./
# - Override settings? No

# For production deployment:
vercel --prod
```

### After Deployment
- Your app will be live at: `https://touchdown-squares.vercel.app`
- Custom domain: Settings → Domains → Add
- Environment variables: Settings → Environment Variables

---

## Deploy to Netlify

### One-Time Setup
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login
```

### Deploy
```bash
# Build the app
npm run build

# Deploy to Netlify
netlify deploy

# For production:
netlify deploy --prod
```

### After Deployment
- Your app will be live at: `https://touchdown-squares.netlify.app`
- Custom domain: Site settings → Domain management

---

## Deploy to Firebase Hosting

### Setup
```bash
# Install Firebase CLI (if not already)
npm install -g firebase-tools

# Login
firebase login

# Initialize hosting
firebase init hosting

# Select:
# - Use existing project: touchdown-squares
# - Public directory: dist
# - Single-page app: Yes
# - Set up automatic builds: No
```

### Deploy
```bash
# Build
npm run build

# Deploy
firebase deploy --only hosting
```

### After Deployment
- Your app will be live at: `https://touchdown-squares.web.app`
- Custom domain: Hosting → Add custom domain

---

## Post-Deployment Security

### 1. Update Firestore Rules

In Firebase Console → Firestore Database → Rules:

```
Copy the contents of firestore.rules and paste here
```

Click "Publish"

### 2. Update Firebase Auth Settings

In Firebase Console → Authentication → Settings:

- **Authorized domains:** Add your production domain
- **Email templates:** Customize if needed
- **User actions:** Configure password reset emails

### 3. Set Up CORS (if needed)

In Firebase Console → Storage → Rules (if using storage):

```
Allow CORS from your domain
```

---

## Environment Variables

If you need different configs for dev/prod:

### Vercel
```bash
vercel env add VITE_FIREBASE_API_KEY
# Enter your production API key
```

### Netlify
```bash
netlify env:set VITE_FIREBASE_API_KEY "your-api-key"
```

Then update `firebase-config.js`:
```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // ... other config
};
```

---

## Testing Production

After deployment, test:

- [ ] User signup works
- [ ] User login works
- [ ] Admin login works (admin / Quinn1234)
- [ ] Create new pool
- [ ] Select squares
- [ ] Random selection works
- [ ] Data persists after refresh
- [ ] Mobile responsive
- [ ] Toast notifications work
- [ ] Activity log shows entries
- [ ] Export data works

---

## Monitoring

### Firebase Console
- **Authentication → Users:** See all registered users
- **Firestore → Data:** View database contents
- **Analytics:** Track usage (if enabled)

### Vercel/Netlify Dashboard
- **Analytics:** Page views, performance
- **Deployments:** Deploy history
- **Logs:** Error tracking

---

## Rollback Plan

If something goes wrong:

### Vercel
```bash
# List deployments
vercel ls

# Rollback to previous
vercel rollback
```

### Netlify
```bash
# In Netlify dashboard → Deploys → Click previous deploy → Publish
```

### Firebase
```bash
# Deploy previous version
firebase deploy --only hosting
```

---

## Custom Domain Setup

### Buy Domain (Optional)
- Namecheap: ~$10/year
- Google Domains: ~$12/year
- Any registrar works

### Point to Vercel
1. In Vercel: Add domain
2. In DNS provider: Add CNAME record
   - Name: `@` or `www`
   - Value: `cname.vercel-dns.com`

### Point to Netlify
1. In Netlify: Add domain
2. In DNS provider: Add CNAME record
   - Name: `@` or `www`
   - Value: `your-site.netlify.app`

---

## Maintenance

### Regular Tasks
- Monitor Firebase usage (Console → Usage)
- Check error logs
- Backup data regularly (Export feature)
- Update dependencies monthly: `npm update`

### Cost Monitoring
- Firebase Console → Usage and billing
- Set budget alerts
- Typical small app: $0-5/month

---

## 🎉 You're Live!

Share your app:
- Send link to friends
- Post on social media
- Start your first pool!

URL will be something like:
- `https://touchdown-squares.vercel.app`
- `https://touchdown-squares.netlify.app`
- `https://touchdown-squares.web.app`
- Or your custom domain!

---

## Need Help?

Common deployment issues:

**Build fails:**
- Check all imports are correct
- Make sure `firebase-config.js` has real values
- Run `npm run build` locally first

**App loads but doesn't work:**
- Check browser console for errors
- Verify Firebase config is correct
- Check Firestore rules aren't blocking

**Data not persisting:**
- Check Firestore rules
- Verify authentication is working
- Check browser console for permission errors

**Performance issues:**
- Enable Firebase Analytics
- Use Vercel/Netlify analytics
- Add caching headers if needed
