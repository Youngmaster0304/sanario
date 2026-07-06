const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const jwt = require('jsonwebtoken');
const db = require('./database');

require('dotenv').config();

// Import ML models
const recommender = require('./models/recommender');
const nlpModerator = require('./models/nlp_moderator');
const wellnessRisk = require('./models/wellness_risk');
const aiCoach = require('./models/ai_coach');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sanario_secret_key_123';

app.use(cors());
app.use(express.json());

// Serve static assets from public folder
app.use(express.static(path.join(__dirname, 'public')));

// --- Google Token Verification Helper ---
function verifyGoogleIdToken(idToken) {
  return new Promise((resolve, reject) => {
    https.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const payload = JSON.parse(data);
          if (payload.error) {
            reject(new Error(payload.error_description || 'Google Token Validation Error'));
          } else {
            resolve(payload);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// --- Auth Middleware (Supports JWT Authorization Bearer & Dev Headers) ---
async function authUser(req, res, next) {
  let userId = null;

  // 1. Check Authorization Bearer JWT
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch (err) {
      return res.status(401).json({ error: 'Session expired or invalid token.' });
    }
  }

  // 2. Fallback to Local x-user-id Header (Dev Testing Mode)
  if (!userId) {
    userId = req.headers['x-user-id'];
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }

  try {
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'User session expired. Please login again.' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

// --- API ROUTES ---

// Helper: Generate Token
function generateUserToken(user) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
}

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  const { username, password, name, interests, growthVibe, stepsGoal, waterGoal, screentimeLimit } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password, and name are required.' });
  }

  try {
    const user = await db.createUser(username, password, name, interests, growthVibe, stepsGoal, waterGoal, screentimeLimit);
    if (!user) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }
    const token = generateUserToken(user);
    res.status(201).json({ success: true, user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const user = await db.getUser(username);
    if (!user || user.password !== password) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    const token = generateUserToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Production Google OAuth Token Login
app.post('/api/auth/google-login', async (req, res) => {
  const { idToken, email, name, profilePic } = req.body;
  
  let userEmail = email;
  let userName = name;
  let userPic = profilePic;

  try {
    // If client ID is set, verify securely using Google's OAuth API
    if (process.env.GOOGLE_CLIENT_ID && idToken) {
      console.log('Verifying Google Token with Audience checks...');
      const payload = await verifyGoogleIdToken(idToken);
      
      // Verify audience matches Client ID
      if (payload.aud !== process.env.GOOGLE_CLIENT_ID) {
        return res.status(400).json({ error: 'Audience mismatch. Access Denied.' });
      }

      userEmail = payload.email;
      userName = payload.name;
      userPic = payload.picture;
    } else {
      console.log('No GOOGLE_CLIENT_ID env variable set, falling back to simulated payload verification.');
    }

    if (!userEmail || !userName) {
      return res.status(400).json({ error: 'Google login payload error.' });
    }

    const user = await db.findOrCreateGoogleUser(userEmail, userName, userPic);
    const token = generateUserToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    console.error('Google Sign-in Auth Error:', err);
    res.status(400).json({ error: err.message || 'Google Auth Verification failed.' });
  }
});

let firebasePublicKeys = {};
let keysExpiry = 0;

async function getFirebasePublicKeys() {
  if (Date.now() < keysExpiry && Object.keys(firebasePublicKeys).length > 0) {
    return firebasePublicKeys;
  }
  return new Promise((resolve) => {
    https.get('https://www.googleapis.com/robot/v1/metadata/x509/securetoken-system@system.gserviceaccount.com', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          firebasePublicKeys = JSON.parse(data);
          keysExpiry = Date.now() + 6 * 60 * 60 * 1000; // Cache 6 hours
          resolve(firebasePublicKeys);
        } catch (e) {
          resolve({});
        }
      });
    }).on('error', (err) => {
      console.error('Failed to fetch Firebase public keys:', err);
      resolve({});
    });
  });
}

async function verifyFirebaseIdToken(token) {
  const keys = await getFirebasePublicKeys();
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || !decodedHeader.header.kid) {
    throw new Error('Invalid Firebase token header.');
  }
  const certificate = keys[decodedHeader.header.kid];
  if (!certificate) {
    throw new Error('Firebase public key expired or not found.');
  }
  const projectId = 'sanario';
  return jwt.verify(token, certificate, {
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    algorithms: ['RS256']
  });
}

app.post('/api/auth/firebase-login', async (req, res) => {
  const { idToken, email, name, profilePic, phone } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Firebase ID Token is required.' });
  }

  try {
    const decodedToken = await verifyFirebaseIdToken(idToken);
    
    let user;
    if (decodedToken.phone_number || phone) {
      const phoneNumber = decodedToken.phone_number || phone;
      user = await db.findOrCreatePhoneUser(phoneNumber);
    } else {
      const userEmail = decodedToken.email || email;
      const userName = decodedToken.name || name || 'Google User';
      const userPic = decodedToken.picture || profilePic;
      user = await db.findOrCreateGoogleUser(userEmail, userName, userPic);
    }

    const token = generateUserToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    console.error('Firebase Auth Verification failed:', err);
    res.status(401).json({ error: 'Authentication failed: ' + err.message });
  }
});

// Phone OTP Send
app.post('/api/auth/phone-send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required.' });
  }

  // Clean phone string
  const cleanPhone = phone.replace(/[^0-9+]/g, '');

  // Generate 6-digit OTP code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minute expiry

  try {
    await db.saveOTP(cleanPhone, code, expiresAt);

    console.log(`========================================`);
    console.log(`[PHONE AUTH OTP] To: ${cleanPhone}`);
    console.log(`Verification Code: ${code} (Expires in 5m)`);
    console.log(`========================================`);

    res.json({
      success: true,
      message: 'Verification code sent.',
      simulatedCode: code // Returned in response for ease of local prototyping
    });
  } catch (err) {
    console.error('Failed to save OTP in database:', err);
    res.status(500).json({ error: 'Internal server error. Failed to save verification code.' });
  }
});

// Phone OTP Verify
app.post('/api/auth/phone-verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ error: 'Phone number and verification code are required.' });
  }

  const cleanPhone = phone.replace(/[^0-9+]/g, '');
  
  try {
    const record = await db.getOTP(cleanPhone);

    if (!record) {
      return res.status(400).json({ error: 'No active OTP verification code found for this phone number.' });
    }

    if (new Date() > new Date(record.expires_at)) {
      await db.deleteOTP(cleanPhone);
      return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }

    if (record.code !== code.toString().trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check and try again.' });
    }

    // Clear code
    await db.deleteOTP(cleanPhone);

    const user = await db.findOrCreatePhoneUser(cleanPhone);
    const token = generateUserToken(user);
    res.json({ success: true, user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authUser, (req, res) => {
  res.json({ success: true, user: req.user });
});

app.post('/api/auth/theme', authUser, async (req, res) => {
  const { theme } = req.body;
  if (!theme) return res.status(400).json({ error: 'Theme is required.' });

  try {
    const updated = await db.updateUserTheme(req.user.id, theme);
    res.json({ success: updated, theme });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Posts (Feed with Two-Tower Recommender and NLP Toxicity Moderator)
app.get('/api/posts', authUser, async (req, res) => {
  try {
    const rawPosts = await db.getPosts();
    // Feed personalization using our Two-Tower ML recommender
    const ranked = recommender.rankPosts(req.user.interests, rawPosts);
    res.json({ posts: ranked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts', authUser, async (req, res) => {
  const { content, category, mediaType, mediaUrl } = req.body;
  if (!content || !category) {
    return res.status(400).json({ error: 'Content and category are required.' });
  }

  // Content Quality & Safety evaluation using our NLP Moderator model
  const evaluation = nlpModerator.evaluate(content);
  if (evaluation.toxic) {
    return res.status(400).json({
      error: evaluation.reason,
      toxic: true,
      flags: evaluation.flags
    });
  }

  try {
    // Create post
    const post = await db.createPost(
      req.user.id,
      req.user.name,
      req.user.profilePic,
      content,
      category,
      0.85 - (evaluation.score * 0.1),
      mediaType || 'text',
      mediaUrl || ''
    );

    // Reward XP for posting productive community content
    const updatedUser = await db.updateUserXP(req.user.id, 15);
    res.status(201).json({ success: true, post, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts/:id/valuable', authUser, async (req, res) => {
  const postId = req.params.id;
  try {
    const post = await db.toggleValuablePost(postId, req.user.id);
    if (!post) return res.status(404).json({ error: 'Post not found.' });

    const updatedUser = await db.getUserById(req.user.id);
    res.json({ post, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/posts/:id/comments', authUser, async (req, res) => {
  try {
    const comments = await db.getComments(req.params.id);
    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/posts/:id/comments', authUser, async (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Comment content required.' });

  // Moderate comment text
  const evaluation = nlpModerator.evaluate(content);
  if (evaluation.toxic) {
    return res.status(400).json({
      error: 'Comment blocked: Content flagged by Safety Filter.',
      toxic: true
    });
  }

  try {
    const comment = await db.addComment(postId, req.user.name, content);
    await db.updateUserXP(req.user.id, 2);
    res.status(201).json({ comment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reels API
app.get('/api/reels', authUser, async (req, res) => {
  try {
    const rawReels = await db.getReels();
    const ranked = recommender.rankPosts(req.user.interests, rawReels);
    res.json({ reels: ranked });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reels', authUser, async (req, res) => {
  const { title, description, category, mediaUrl } = req.body;
  if (!title || !category || !mediaUrl) {
    return res.status(400).json({ error: 'Title, category, and Video URL are required.' });
  }

  const evaluation = nlpModerator.evaluate(`${title} ${description || ''}`);
  if (evaluation.toxic) {
    return res.status(400).json({
      error: 'Reel rejected by Safety Moderation: ' + evaluation.reason,
      toxic: true
    });
  }

  try {
    const reel = await db.createReel(
      req.user.id,
      req.user.name,
      req.user.profilePic,
      title,
      description || '',
      category,
      mediaUrl
    );

    const updatedUser = await db.updateUserXP(req.user.id, 20);
    res.status(201).json({ success: true, reel, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reels/:id/valuable', authUser, async (req, res) => {
  const reelId = req.params.id;
  try {
    const reel = await db.toggleValuableReel(reelId, req.user.id);
    if (!reel) return res.status(404).json({ error: 'Reel not found.' });

    const updatedUser = await db.getUserById(req.user.id);
    res.json({ reel, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Wellbeing & Health Companion
app.get('/api/wellbeing', authUser, async (req, res) => {
  try {
    const wb = await db.getWellbeing(req.user.id);
    const risks = wellnessRisk.evaluateRisks(wb);
    res.json({ wellbeing: wb, risks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/wellbeing/update', authUser, async (req, res) => {
  const updates = req.body;
  
  try {
    const currentWb = await db.getWellbeing(req.user.id);
    
    let xpGained = 0;
    if (updates.completedGoals) {
      const newlyCompleted = updates.completedGoals.filter(
        goal => !currentWb.completedGoals.includes(goal)
      );
      xpGained += newlyCompleted.length * 20;
    }

    const updatedWb = await db.updateWellbeing(req.user.id, updates);
    
    let updatedUser = req.user;
    if (xpGained > 0) {
      updatedUser = await db.updateUserXP(req.user.id, xpGained);
    }

    const risks = wellnessRisk.evaluateRisks(updatedWb);
    res.json({ wellbeing: updatedWb, risks, user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chats & AI Coach Dialog
app.get('/api/chat/:recipient', authUser, async (req, res) => {
  const recipient = req.params.recipient;
  try {
    const history = await db.getChats(req.user.id, recipient);
    res.json({ chats: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/:recipient', authUser, async (req, res) => {
  const recipient = req.params.recipient;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message cannot be empty.' });

  try {
    const userMsg = await db.addChatMessage(req.user.id, req.user.id, recipient, message);

    if (recipient === 'coach') {
      const coachResult = aiCoach.generateResponse(message, req.user.name);
      const coachMsg = await db.addChatMessage(req.user.id, 'coach', req.user.id, coachResult.message);
      
      let updatedUser = req.user;
      if (coachResult.action && coachResult.action.type === 'log_activity') {
        updatedUser = await db.updateUserXP(req.user.id, coachResult.action.xp);
      }

      return res.json({
        success: true,
        messages: [userMsg, coachMsg],
        action: coachResult.action,
        user: updatedUser
      });
    }

    res.json({ success: true, messages: [userMsg] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` Sanario Full-Stack Server Running on Port ${PORT}`);
    console.log(` Access Local App: http://localhost:${PORT}`);
    console.log(`====================================================`);
  });
}

module.exports = app;
