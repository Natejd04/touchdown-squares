# 🚀 Quick Command Reference

## Initial Setup (Do Once)

```bash
# 1. Create project folder
mkdir touchdown-squares-firebase
cd touchdown-squares-firebase

# 2. Copy these files into the folder:
# - firebase-config.js
# - database-service.js  
# - package.json
# - vite.config.js
# - firestore.rules
# - migrate-data.js
# - Your index.html file (updated for Firebase)

# 3. Install dependencies
npm install

# 4. Update firebase-config.js with YOUR Firebase config

# 5. Start development server
npm run dev
```

## Development Commands

```bash
# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deploy Commands

### Vercel
```bash
vercel          # Deploy preview
vercel --prod   # Deploy to production
```

### Netlify
```bash
netlify deploy            # Deploy preview
netlify deploy --prod     # Deploy to production
```

### Firebase Hosting
```bash
firebase deploy --only hosting
```

## Firebase Commands

```bash
# Login to Firebase
firebase login

# Initialize project
firebase init

# Deploy hosting
firebase deploy --only hosting

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Open Firebase console
firebase open
```

## Useful npm Scripts

```bash
# Install all dependencies
npm install

# Update dependencies
npm update

# Check for outdated packages
npm outdated

# Clean install (if issues)
rm -rf node_modules package-lock.json
npm install
```

## Git Commands (Optional but Recommended)

```bash
# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit with Firebase"

# Add remote (GitHub)
git remote add origin https://github.com/yourusername/touchdown-squares.git

# Push to GitHub
git push -u origin main
```

## Data Migration

```bash
# In browser console after app loads:
runMigration()

# This will:
# 1. Prompt you to select your exported JSON file
# 2. Import all data to Firebase
# 3. Confirm success
```

## Troubleshooting Commands

```bash
# Clear npm cache
npm cache clean --force

# Reinstall everything
rm -rf node_modules package-lock.json
npm install

# Check Node version (should be 18+)
node --version

# Check npm version
npm --version

# Kill process on port 3000 (if occupied)
# Mac/Linux:
lsof -ti:3000 | xargs kill -9
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

## VS Code Extensions (Recommended)

- **Firebase** - Firebase syntax highlighting
- **Vite** - Better Vite support
- **ESLint** - Code linting
- **Prettier** - Code formatting

Install with:
```bash
code --install-extension toba.vsfire
```

## Environment Setup

```bash
# Create .env file (for environment variables)
echo "VITE_FIREBASE_API_KEY=your-key" > .env

# Add to .gitignore
echo ".env" >> .gitignore
echo "node_modules" >> .gitignore
echo "dist" >> .gitignore
```

## Quick Test Checklist

After setup, test:
```bash
# 1. Start dev server
npm run dev

# 2. Open browser to localhost:3000

# 3. Test these:
- [ ] Create account
- [ ] Login
- [ ] Create pool (as admin)
- [ ] Select square
- [ ] Refresh page (data should persist)
- [ ] Export data
```

## Production Checklist

Before deploying:
```bash
# 1. Build locally to check for errors
npm run build

# 2. Test production build
npm run preview

# 3. If all good, deploy
vercel --prod
# or
netlify deploy --prod
# or
firebase deploy --only hosting
```

## Useful URLs

- **Local dev:** http://localhost:3000
- **Firebase Console:** https://console.firebase.google.com
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Netlify Dashboard:** https://app.netlify.com

## Emergency Rollback

```bash
# Vercel
vercel rollback

# Netlify
# Go to dashboard → Deploys → Click previous → Publish

# Firebase
firebase hosting:clone SOURCE_SITE_ID:SOURCE_CHANNEL DESTINATION_SITE_ID:live
```

## Getting Help

```bash
# Check Firebase CLI help
firebase --help

# Check Vercel CLI help
vercel --help

# Check Netlify CLI help
netlify --help

# View logs
# Vercel: vercel logs
# Netlify: netlify logs
# Firebase: Firebase Console → Hosting → Logs
```

---

## 📋 Complete Setup Flow (Copy-Paste)

```bash
# Complete first-time setup
mkdir touchdown-squares-firebase && cd touchdown-squares-firebase
npm init -y
npm install firebase vite -D
# [Copy all the files here]
# [Update firebase-config.js with your config]
npm run dev

# After testing locally
npm run build
vercel --prod

# Done! 🎉
```
