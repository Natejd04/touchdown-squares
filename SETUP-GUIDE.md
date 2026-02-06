# Touchdown Squares - Firebase Setup Guide

## 🚀 Quick Start

### Step 1: Complete Firebase Console Setup

Make sure you've completed these in the Firebase Console:
- ✅ Created Firebase project
- ✅ Enabled Email/Password Authentication
- ✅ Created Firestore Database (test mode)
- ✅ Registered web app and got config

### Step 2: Update Firebase Config

1. Open `firebase-config.js`
2. Replace the placeholder values with YOUR Firebase config from the console
3. Save the file

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Import Your Existing Data (Optional)

If you have existing data from the localStorage version:

1. Export your data using the "Export Data" button in your current app
2. Save the JSON file
3. Run the import script:

```javascript
// In browser console after starting dev server:
const importData = async () => {
  // Upload your exported JSON file
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const data = JSON.parse(event.target.result);
      
      // Import using the service
      const { importExistingData } = await import('./database-service.js');
      await importExistingData(data.users, data.pools, data.activityLog);
      
      console.log('✅ Data imported successfully!');
      location.reload();
    };
    
    reader.readAsText(file);
  };
  
  fileInput.click();
};

// Run this
importData();
```

### Step 5: Start Development Server

```bash
npm run dev
```

Your app will be available at: `http://localhost:5173`

### Step 6: Test Everything

1. Try creating a new user account
2. Login with that account
3. Login as admin (admin / Quinn1234)
4. Create a test pool
5. Select some squares
6. Check that data persists after refresh

---

## 📁 Project Structure

```
touchdown-squares-firebase/
├── firebase-config.js       # Firebase initialization
├── database-service.js      # All database operations
├── index.html              # Main app (copy from your current version)
├── package.json            # Dependencies
└── firestore.rules         # Security rules (to be added)
```

---

## 🔒 Next Steps: Add Security Rules

Once everything is working, replace the test mode rules:

1. Go to Firebase Console → Firestore Database → Rules
2. Copy the security rules from `SECURITY-RULES.md`
3. Publish the rules

---

## 🚀 Deploy to Production

### Option 1: Vercel

```bash
npm install -g vercel
vercel
```

### Option 2: Netlify

```bash
npm install -g netlify-cli
netlify deploy
```

### Option 3: Firebase Hosting

```bash
npm install -g firebase-tools
firebase init hosting
firebase deploy
```

---

## 📊 What Changed from LocalStorage Version

### Replaced:
- ❌ `window.storage.set()` / `window.storage.get()`
- ❌ `localStorage.setItem()` / `localStorage.getItem()`
- ❌ `sessionStorage`

### With:
- ✅ Firebase Authentication for users
- ✅ Firestore for data storage
- ✅ Real-time sync across devices
- ✅ Proper security rules

### What Stayed the Same:
- ✅ All UI/UX
- ✅ Game logic
- ✅ Admin features
- ✅ Random selection
- ✅ Toast notifications

---

## 🆘 Troubleshooting

### "Firebase not initialized"
- Make sure you updated `firebase-config.js` with your actual config

### "Permission denied"
- Check that Firestore is in test mode (temporary)
- Or add proper security rules

### "Module not found"
- Run `npm install` again
- Check that `type: "module"` is in package.json

### Data not persisting
- Check browser console for errors
- Verify Firestore rules allow writes
- Make sure you're calling the save functions

---

## 📞 Need Help?

Common issues:
1. **Forgot to update config** → Open `firebase-config.js` and add your keys
2. **Port already in use** → Kill the process or use `npm run dev -- --port 3000`
3. **Build errors** → Delete `node_modules` and run `npm install` again

---

## 🎉 You're Ready!

Once you've completed all steps, your app will be:
- ✅ Using cloud database (not browser storage)
- ✅ Accessible from any device
- ✅ Syncing in real-time
- ✅ Ready to scale

Next up: Add security rules and deploy! 🚀
