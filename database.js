const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

class SQLDatabase {
  constructor() {
    this.isPostgres = !!process.env.DATABASE_URL;
    this.pool = null;
    this.sqliteDb = null;
    this.init();
  }

  init() {
    if (this.isPostgres) {
      console.log('Connecting to Production PostgreSQL Database...');
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false } // Required for hosted services like Neon/Render
      });
    } else {
      console.log('Connecting to Local SQLite Database...');
      const sqlite3 = require('sqlite3').verbose();
      const dbPath = path.join(__dirname, 'sanario.db');
      this.sqliteDb = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Failed to open SQLite database:', err);
      });
    }
    this.setupTables();
  }

  // --- SQL Parameter Translation & Execution Helper ---
  async query(sql, params = []) {
    if (this.isPostgres) {
      // Translate "?" placeholders to PostgreSQL "$1", "$2" format
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      try {
        const res = await this.pool.query(pgSql, params);
        return res.rows;
      } catch (err) {
        console.error('PostgreSQL Query Error:', err, 'SQL:', pgSql);
        throw err;
      }
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.all(sql, params, (err, rows) => {
          if (err) {
            console.error('SQLite Query Error:', err, 'SQL:', sql);
            reject(err);
          } else {
            resolve(rows);
          }
        });
      });
    }
  }

  async queryRow(sql, params = []) {
    const rows = await this.query(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  async execute(sql, params = []) {
    if (this.isPostgres) {
      await this.query(sql, params);
      return { lastID: null, changes: null };
    } else {
      return new Promise((resolve, reject) => {
        this.sqliteDb.run(sql, params, function(err) {
          if (err) {
            console.error('SQLite Execute Error:', err, 'SQL:', sql);
            reject(err);
          } else {
            resolve({ lastID: this.lastID, changes: this.changes });
          }
        });
      });
    }
  }

  // --- Schema Migrations ---
  async setupTables() {
    try {
      // 1. Users Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(50) PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(100) NOT NULL,
          name VARCHAR(100) NOT NULL,
          profile_pic TEXT,
          interests TEXT,
          xp INT DEFAULT 0,
          badge VARCHAR(50) DEFAULT 'Novice Mind',
          theme VARCHAR(50) DEFAULT 'nature',
          growth_vibe VARCHAR(150) DEFAULT '',
          phone VARCHAR(50) DEFAULT ''
        )
      `);

      // 2. Posts Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS posts (
          id VARCHAR(50) PRIMARY KEY,
          author_id VARCHAR(50) NOT NULL,
          author_name VARCHAR(100) NOT NULL,
          author_pic TEXT,
          content TEXT NOT NULL,
          category VARCHAR(50) NOT NULL,
          has_diagram BOOLEAN DEFAULT FALSE,
          diagram_type VARCHAR(50),
          media_type VARCHAR(50) DEFAULT 'text',
          media_url TEXT,
          valuable_count INT DEFAULT 0,
          quality_score FLOAT DEFAULT 0.8,
          created_at VARCHAR(50) NOT NULL
        )
      `);

      // 3. Post Valuables (Likes) Link Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS post_valuables (
          post_id VARCHAR(50) NOT NULL,
          user_id VARCHAR(50) NOT NULL,
          PRIMARY KEY (post_id, user_id)
        )
      `);

      // 4. Comments Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS comments (
          id VARCHAR(50) PRIMARY KEY,
          post_id VARCHAR(50) NOT NULL,
          author_name VARCHAR(100) NOT NULL,
          content TEXT NOT NULL,
          created_at VARCHAR(50) NOT NULL
        )
      `);

      // 5. Wellbeing Logs Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS wellbeing (
          user_id VARCHAR(50) PRIMARY KEY,
          screen_time_sec INT DEFAULT 0,
          steps INT DEFAULT 0,
          water_glasses INT DEFAULT 0,
          habit_streak INT DEFAULT 0,
          completed_goals TEXT,
          last_updated VARCHAR(50) NOT NULL,
          steps_goal INT DEFAULT 8000,
          water_goal INT DEFAULT 8,
          screentime_limit_min INT DEFAULT 120
        )
      `);

      // Dynamic column updates for existing databases (adds columns silently if missing)
      try { await this.execute(`ALTER TABLE users ADD COLUMN growth_vibe VARCHAR(150) DEFAULT ''`); } catch(e){}
      try { await this.execute(`ALTER TABLE users ADD COLUMN phone VARCHAR(50) DEFAULT ''`); } catch(e){}
      try { await this.execute(`ALTER TABLE wellbeing ADD COLUMN steps_goal INT DEFAULT 8000`); } catch(e){}
      try { await this.execute(`ALTER TABLE wellbeing ADD COLUMN water_goal INT DEFAULT 8`); } catch(e){}
      try { await this.execute(`ALTER TABLE wellbeing ADD COLUMN screentime_limit_min INT DEFAULT 120`); } catch(e){}

      // 6. Chats Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS chats (
          id VARCHAR(50) PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          sender VARCHAR(50) NOT NULL,
          recipient VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          timestamp VARCHAR(50) NOT NULL
        )
      `);

      // 7. Reels Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS reels (
          id VARCHAR(50) PRIMARY KEY,
          author_id VARCHAR(50) NOT NULL,
          author_name VARCHAR(100) NOT NULL,
          author_pic TEXT,
          title VARCHAR(150) NOT NULL,
          description TEXT,
          category VARCHAR(50) NOT NULL,
          media_url TEXT NOT NULL,
          valuable_count INT DEFAULT 0,
          quality_score FLOAT DEFAULT 0.8,
          created_at VARCHAR(50) NOT NULL
        )
      `);

      // 8. Reel Valuables Link Table
      await this.execute(`
        CREATE TABLE IF NOT EXISTS reel_valuables (
          reel_id VARCHAR(50) NOT NULL,
          user_id VARCHAR(50) NOT NULL,
          PRIMARY KEY (reel_id, user_id)
        )
      `);

      // Check if db is empty and seed data
      const userCount = await this.queryRow(`SELECT COUNT(*) as count FROM users`);
      if (parseInt(userCount.count) === 0) {
        console.log('SQL Database empty. Seeding data...');
        await this.seedData();
      }
    } catch (err) {
      console.error('Failed to run SQL migrations:', err);
    }
  }

  async seedData() {
    // Seed Users
    await this.execute(`
      INSERT INTO users (id, username, password, name, profile_pic, interests, xp, badge, theme) VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'user1', 'abhinav', 'password123', 'Abhinav Jha', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80', 'Productivity,Coding,Fitness,Mental Wellness', 320, 'Habit Hero', 'nature',
      'user2', 'elena_r', 'password123', 'Dr. Elena Rostova', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', 'Productivity,Mental Wellness', 1200, 'Cognitive Expert', 'reading',
      'user3', 'dev_guy', 'password123', 'Dev Community', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80', 'Coding,Startups', 450, 'Code Ninja', 'dark-focus'
    ]);

    // Seed Posts
    await this.execute(`
      INSERT INTO posts (id, author_id, author_name, author_pic, content, category, has_diagram, diagram_type, media_type, media_url, valuable_count, quality_score, created_at) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'post1', 'user2', 'Dr. Elena Rostova', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', 'The Myth of Context Switching\n\nRecent studies suggest that what we call "multitasking" is actually rapid context switching, which can degrade cognitive performance by up to 40%. The cost isn\'t just in time—it\'s in the depth of thought. Intentionally single-tasking for just 45 minutes can yield better results than 3 hours of fragmented attention. Focus on one goal today and protect your attention.', 'Productivity', true, 'focus-distraction', 'text', '', 15, 0.95, new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      'post2', 'user3', 'Dev Community', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80', 'Clean Code: The Boy Scout Rule\n\n"Always leave the campground cleaner than you found it." If we all check in code that is slightly cleaner than when we checked it out, software rot simply cannot happen. It doesn\'t require massive rewrites—just formatting a messy block, renaming a confusing variable, or breaking down a long function. Clean code builds calm developers!', 'Coding', false, '', 'image', 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=600&q=80', 8, 0.88, new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      'post3', 'user2', 'Dr. Elena Rostova', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', '"The digital environment we curate shapes the physical thoughts we have. Unfollow the noise to hear your own signal." Make space for quiet contemplation today. The brain needs idle time to connect disparate ideas into novel creative insights.', 'Mental Wellness', false, '', 'image', 'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=600&q=80', 22, 0.92, new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
      'post4', 'user1', 'Abhinav Jha', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80', 'Consistency beats intensity. Setting up my 25-minute Deep Work blocks for the day. Sticking to 3 primary goals: Coding the Sanario backend, stretching for 5 minutes, and drinking 3L water. Who is working with me today?', 'Startups', false, '', 'text', '', 4, 0.82, new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
    ]);

    // Seed Post Valuables
    await this.execute(`INSERT INTO post_valuables (post_id, user_id) VALUES ('post1', 'user1')`);
    await this.execute(`INSERT INTO post_valuables (post_id, user_id) VALUES ('post3', 'user1')`);

    // Seed Reels
    await this.execute(`
      INSERT INTO reels (id, author_id, author_name, author_pic, title, description, category, media_url, valuable_count, quality_score, created_at) VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'reel1', 'user2', 'Dr. Elena Rostova', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', '5-Minute Posture Stretch Break', 'Release tension at your workspace. Follow this loop to stretch your neck and shoulders.', 'Fitness', 'https://assets.mixkit.co/videos/preview/mixkit-stretching-exercises-in-the-office-40456-large.mp4', 42, 0.98, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      'reel2', 'user3', 'Dev Community', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80', 'Focus Hack: Keyboard Haptics', 'Why tactile mechanical typing supports structured thinking and neural flow.', 'Coding', 'https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-programmer-typing-on-a-keyboard-40348-large.mp4', 19, 0.91, new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      'reel3', 'user2', 'Dr. Elena Rostova', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80', 'Daily Mindfulness Breathing Cycle', 'Box breathing guide to lower heart-rate variability and focus the mind.', 'Mental Wellness', 'https://assets.mixkit.co/videos/preview/mixkit-woman-doing-yoga-meditation-40898-large.mp4', 61, 0.96, new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString()
    ]);

    await this.execute(`INSERT INTO reel_valuables (reel_id, user_id) VALUES ('reel1', 'user1')`);
    await this.execute(`INSERT INTO reel_valuables (reel_id, user_id) VALUES ('reel3', 'user1')`);

    // Seed Comments
    await this.execute(`
      INSERT INTO comments (id, post_id, author_name, content, created_at) VALUES 
      (?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?)
    `, [
      'c1', 'post1', 'Abhinav Jha', 'This diagram is so true. I notice I lose 15 minutes getting back into the zone after replying to a single message.', new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      'c2', 'post1', 'Dev Community', 'Completely agree. Grouping messaging time to twice a day has saved my productivity.', new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
    ]);

    // Seed Wellbeing
    await this.execute(`
      INSERT INTO wellbeing (user_id, screen_time_sec, steps, water_glasses, habit_streak, completed_goals, last_updated) VALUES 
      (?, ?, ?, ?, ?, ?, ?)
    `, ['user1', 4320, 4200, 3, 12, 'Morning Meditation (15m)', new Date().toISOString()]);

    // Seed Chats
    await this.execute(`
      INSERT INTO chats (id, user_id, sender, recipient, message, timestamp) VALUES 
      (?, ?, ?, ?, ?, ?)
    `, ['msg1', 'user1', 'coach', 'user1', 'Good afternoon. I\'m your Sanario wellness guide. How can we bring more intention to your day?', new Date(Date.now() - 10 * 60 * 1000).toISOString()]);

    console.log('SQL Seed completed.');
  }

  // --- Auth API ---
  async getUser(username) {
    return await this.queryRow(`SELECT * FROM users WHERE LOWER(username) = LOWER(?)`, [username]);
  }

  async getUserById(id) {
    const user = await this.queryRow(`SELECT * FROM users WHERE id = ?`, [id]);
    if (user && user.interests) {
      user.interests = user.interests.split(',');
    }
    return user;
  }

  async createUser(username, password, name, interests = [], growthVibe = '', stepsGoal = 8000, waterGoal = 8, screentimeLimit = 120) {
    const existing = await this.getUser(username);
    if (existing) return null;

    const id = 'user_' + Math.random().toString(36).substr(2, 9);
    const interestsStr = interests.length > 0 ? interests.join(',') : 'Productivity,Mental Wellness';

    await this.execute(`
      INSERT INTO users (id, username, password, name, profile_pic, interests, xp, badge, theme, growth_vibe) VALUES 
      (?, ?, ?, ?, ?, ?, 0, 'Novice Mind', 'nature', ?)
    `, [
      id, username, password, name, 
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
      interestsStr,
      growthVibe
    ]);

    // Setup wellbeing entry
    await this.execute(`
      INSERT INTO wellbeing (user_id, screen_time_sec, steps, water_glasses, habit_streak, completed_goals, last_updated, steps_goal, water_goal, screentime_limit_min) VALUES
      (?, 0, 0, 0, 0, '', ?, ?, ?, ?)
    `, [id, new Date().toISOString(), stepsGoal, waterGoal, screentimeLimit]);

    return await this.getUserById(id);
  }

  async findOrCreateGoogleUser(email, name, profilePic) {
    let user = await this.getUser(email);
    if (user) {
      if (user.interests) user.interests = user.interests.split(',');
      return user;
    }

    const id = 'user_' + Math.random().toString(36).substr(2, 9);
    const pic = profilePic || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';

    await this.execute(`
      INSERT INTO users (id, username, password, name, profile_pic, interests, xp, badge, theme) VALUES 
      (?, ?, ?, ?, ?, 'Productivity,Coding,Fitness,Mental Wellness', 100, 'Mindful Learner', 'nature')
    `, [id, email, 'google_oauth_dummy_pass', name, pic]);

    await this.execute(`
      INSERT INTO wellbeing (user_id, screen_time_sec, steps, water_glasses, habit_streak, completed_goals, last_updated) VALUES
      (?, 0, 0, 0, 0, '', ?)
    `, [id, new Date().toISOString()]);

    return await this.getUserById(id);
  }

  async getUserByPhone(phone) {
    return await this.queryRow(`SELECT * FROM users WHERE phone = ?`, [phone]);
  }

  async findOrCreatePhoneUser(phone) {
    let user = await this.getUserByPhone(phone);
    if (user) {
      if (user.interests) user.interests = user.interests.split(',');
      return user;
    }

    const id = 'user_' + Math.random().toString(36).substr(2, 9);
    const suffix = phone.slice(-4) || 'User';
    const name = `User ${suffix}`;

    await this.execute(`
      INSERT INTO users (id, username, password, name, profile_pic, interests, xp, badge, theme, phone) VALUES 
      (?, ?, 'phone_otp_dummy_pass', ?, 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80', 'Productivity,Coding,Fitness,Mental Wellness', 100, 'Mindful Learner', 'nature', ?)
    `, [id, phone, name, phone]);

    await this.execute(`
      INSERT INTO wellbeing (user_id, screen_time_sec, steps, water_glasses, habit_streak, completed_goals, last_updated) VALUES
      (?, 0, 0, 0, 0, '', ?)
    `, [id, new Date().toISOString()]);

    return await this.getUserById(id);
  }

  async updateUserTheme(userId, theme) {
    const res = await this.execute(`UPDATE users SET theme = ? WHERE id = ?`, [theme, userId]);
    return true;
  }

  async updateUserXP(userId, xpGained) {
    const user = await this.getUserById(userId);
    if (!user) return null;

    const newXp = (user.xp || 0) + xpGained;
    let badge = user.badge;
    if (newXp > 1000) badge = 'Zen Master';
    else if (newXp > 600) badge = 'Focus Sage';
    else if (newXp > 300) badge = 'Habit Hero';
    else if (newXp > 100) badge = 'Mindful Learner';

    await this.execute(`UPDATE users SET xp = ?, badge = ? WHERE id = ?`, [newXp, badge, userId]);
    return await this.getUserById(userId);
  }

  // --- Posts API ---
  async getPosts() {
    const posts = await this.query(`SELECT * FROM posts ORDER BY created_at DESC`);
    // Load valuables for each post
    for (const post of posts) {
      const vals = await this.query(`SELECT user_id FROM post_valuables WHERE post_id = ?`, [post.id]);
      post.valuables = vals.map(v => v.user_id);
    }
    return posts;
  }

  async createPost(userId, authorName, authorPic, content, category, qualityScore = 0.8, mediaType = 'text', mediaUrl = '') {
    const id = 'post_' + Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    await this.execute(`
      INSERT INTO posts (id, author_id, author_name, author_pic, content, category, has_diagram, media_type, media_url, valuable_count, quality_score, created_at) VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [id, userId, authorName, authorPic, content, category, false, mediaType, mediaUrl, qualityScore, createdAt]);

    const post = await this.queryRow(`SELECT * FROM posts WHERE id = ?`, [id]);
    post.valuables = [];
    return post;
  }

  async toggleValuablePost(postId, userId) {
    const existing = await this.queryRow(`SELECT * FROM post_valuables WHERE post_id = ? AND user_id = ?`, [postId, userId]);
    const post = await this.queryRow(`SELECT * FROM posts WHERE id = ?`, [postId]);
    if (!post) return null;

    if (!existing) {
      // Add
      await this.execute(`INSERT INTO post_valuables (post_id, user_id) VALUES (?, ?)`, [postId, userId]);
      await this.execute(`UPDATE posts SET valuable_count = valuable_count + 1 WHERE id = ?`, [postId]);
      // Give XP
      await this.updateUserXP(post.author_id, 15);
      await this.updateUserXP(userId, 5);
    } else {
      // Remove
      await this.execute(`DELETE FROM post_valuables WHERE post_id = ? AND user_id = ?`, [postId, userId]);
      await this.execute(`UPDATE posts SET valuable_count = MAX(0, valuable_count - 1) WHERE id = ?`, [postId]);
    }

    const updatedPost = await this.queryRow(`SELECT * FROM posts WHERE id = ?`, [postId]);
    const vals = await this.query(`SELECT user_id FROM post_valuables WHERE post_id = ?`, [postId]);
    updatedPost.valuables = vals.map(v => v.user_id);
    return updatedPost;
  }

  async addComment(postId, authorName, content) {
    const id = 'c_' + Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    await this.execute(`
      INSERT INTO comments (id, post_id, author_name, content, created_at) VALUES 
      (?, ?, ?, ?, ?)
    `, [id, postId, authorName, content, createdAt]);

    return await this.queryRow(`SELECT * FROM comments WHERE id = ?`, [id]);
  }

  async getComments(postId) {
    return await this.query(`SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC`, [postId]);
  }

  // --- Reels API ---
  async getReels() {
    const reels = await this.query(`SELECT * FROM reels ORDER BY created_at DESC`);
    for (const reel of reels) {
      const vals = await this.query(`SELECT user_id FROM reel_valuables WHERE reel_id = ?`, [reel.id]);
      reel.valuables = vals.map(v => v.user_id);
    }
    return reels;
  }

  async createReel(userId, authorName, authorPic, title, description, category, mediaUrl) {
    const id = 'reel_' + Math.random().toString(36).substr(2, 9);
    const createdAt = new Date().toISOString();

    await this.execute(`
      INSERT INTO reels (id, author_id, author_name, author_pic, title, description, category, media_url, valuable_count, quality_score, created_at) VALUES 
      (?, ?, ?, ?, ?, ?, ?, ?, 0, 0.85, ?)
    `, [id, userId, authorName, authorPic, title, description, category, mediaUrl, createdAt]);

    const reel = await this.queryRow(`SELECT * FROM reels WHERE id = ?`, [id]);
    reel.valuables = [];
    return reel;
  }

  async toggleValuableReel(reelId, userId) {
    const existing = await this.queryRow(`SELECT * FROM reel_valuables WHERE reel_id = ? AND user_id = ?`, [reelId, userId]);
    const reel = await this.queryRow(`SELECT * FROM reels WHERE id = ?`, [reelId]);
    if (!reel) return null;

    if (!existing) {
      await this.execute(`INSERT INTO reel_valuables (reel_id, user_id) VALUES (?, ?)`, [reelId, userId]);
      await this.execute(`UPDATE reels SET valuable_count = valuable_count + 1 WHERE id = ?`, [reelId]);
      await this.updateUserXP(reel.author_id, 15);
      await this.updateUserXP(userId, 5);
    } else {
      await this.execute(`DELETE FROM reel_valuables WHERE reel_id = ? AND user_id = ?`, [reelId, userId]);
      await this.execute(`UPDATE reels SET valuable_count = MAX(0, valuable_count - 1) WHERE id = ?`, [reelId]);
    }

    const updatedReel = await this.queryRow(`SELECT * FROM reels WHERE id = ?`, [reelId]);
    const vals = await this.query(`SELECT user_id FROM reel_valuables WHERE reel_id = ?`, [reelId]);
    updatedReel.valuables = vals.map(v => v.user_id);
    return updatedReel;
  }

  // --- Wellbeing API ---
  async getWellbeing(userId) {
    const wb = await this.queryRow(`SELECT * FROM wellbeing WHERE user_id = ?`, [userId]);
    if (wb) {
      wb.userId = wb.user_id;
      wb.screenTimeSec = wb.screen_time_sec;
      wb.waterGlasses = wb.water_glasses;
      wb.habitStreak = wb.habit_streak;
      wb.completedGoals = wb.completed_goals ? wb.completed_goals.split('|') : [];
      wb.lastUpdated = wb.last_updated;
      wb.stepsGoal = wb.steps_goal !== undefined && wb.steps_goal !== null ? wb.steps_goal : 8000;
      wb.waterGoal = wb.water_goal !== undefined && wb.water_goal !== null ? wb.water_goal : 8;
      wb.screentimeLimitMin = wb.screentime_limit_min !== undefined && wb.screentime_limit_min !== null ? wb.screentime_limit_min : 120;
    }
    return wb;
  }

  async updateWellbeing(userId, updates) {
    const current = await this.getWellbeing(userId);
    if (!current) return null;

    const screenTimeSec = updates.screenTimeSec !== undefined ? updates.screenTimeSec : current.screenTimeSec;
    const steps = updates.steps !== undefined ? updates.steps : current.steps;
    const waterGlasses = updates.waterGlasses !== undefined ? updates.waterGlasses : current.waterGlasses;
    const habitStreak = updates.habitStreak !== undefined ? updates.habitStreak : current.habitStreak;
    
    let completedGoals = current.completedGoals.join('|');
    if (updates.completedGoals !== undefined) {
      completedGoals = updates.completedGoals.join('|');
    }

    const lastUpdated = new Date().toISOString();

    await this.execute(`
      UPDATE wellbeing SET screen_time_sec = ?, steps = ?, water_glasses = ?, habit_streak = ?, completed_goals = ?, last_updated = ?
      WHERE user_id = ?
    `, [screenTimeSec, steps, waterGlasses, habitStreak, completedGoals, lastUpdated, userId]);

    return await this.getWellbeing(userId);
  }

  // --- Chats API ---
  async getChats(userId, recipient) {
    let chats;
    if (recipient === 'coach') {
      chats = await this.query(`
        SELECT * FROM chats 
        WHERE user_id = ? AND (sender = 'coach' OR recipient = 'coach')
        ORDER BY timestamp ASC
      `, [userId]);
    } else {
      chats = await this.query(`
        SELECT * FROM chats 
        WHERE (user_id = ? AND recipient = ?) OR (user_id = ? AND recipient = ?)
        ORDER BY timestamp ASC
      `, [userId, recipient, recipient, userId]);
    }
    return chats;
  }

  async addChatMessage(userId, sender, recipient, message) {
    const id = 'msg_' + Math.random().toString(36).substr(2, 9);
    const timestamp = new Date().toISOString();

    await this.execute(`
      INSERT INTO chats (id, user_id, sender, recipient, message, timestamp) VALUES
      (?, ?, ?, ?, ?, ?)
    `, [id, userId, sender, recipient, message, timestamp]);

    return await this.queryRow(`SELECT * FROM chats WHERE id = ?`, [id]);
  }
}

module.exports = new SQLDatabase();
