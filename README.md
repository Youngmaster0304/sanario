# 🌿 Sanario — A Healthy Social Media Ecosystem

Sanario is a next-generation, full-stack digital wellbeing and cognitive growth platform designed to help people use technology intentionally rather than compulsively.

Instead of maximizing screen time, digital addiction, and infinite scrolling, Sanario is engineered to maximize personal growth, physical wellness, and offline well-being.

---

## 🚀 Key Features

* **🎯 Goal-Based Personalization (Two-Tower Recommender)**: Users explicitly declare their interests (e.g. Coding, Productivity, Fitness). A native Two-Tower Machine Learning matching algorithm ranks feed items based on user interest profiles.
* **📵 Anti-Doomscroll Reels Deck**: A short-form video player featuring mindfulness loops (stretches, breathing, workspace focus). Viewing more than 3 reels triggers a digital health break, locking the player and launching a 1-minute box breathing session.
* **🛡️ Content Quality Moderation (NLP Filter)**: A backend Natural Language Processing (NLP) filter evaluates content on creation to block clickbait, spam, and toxic inputs with descriptive safety flags.
* **👟 WHO Health Companion**: Integrates step trackers, water logging widgets, and real-time behavioral risk alerts (Sedentary, Dehydration, or Sleep hygiene alerts) with action recommendations based on usage patterns.
* **💬 Conversational AI Coach**: An intent-based AI Coach router that classifies user messages (mindfulness, routing, scheduling) and triggers interface controls like Box Breathing timers.
* **🎨 Premium Visual Focus Themes**: Five curated, HSL-color-tailored themes (Nature, Productivity, Minimal, Dark Focus, and Sepia Reading) built to reduce visual stress.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla CSS Grid & Flexbox, Javascript ES6.
* **Backend**: Node.js, Express.js.
* **Database**: Dual-engine relational SQL adapter supporting:
  * **SQLite** (Local fallback development)
  * **PostgreSQL** (Production deployment)
* **Auth**: JSON Web Tokens (JWT) for secure session headers & official Google Identity Services SDK for production sign-in.
* **ML Engines**: Native, client-side/server-side numerical and lexical vector models (Two-Tower, Intent Router, Wellness Evaluator, NLP Moderator).

---

## ⚙️ Setup & Installation

### Local Development
1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in secrets (leave `DATABASE_URL` empty to automatically run the local SQLite database).
4. Run the development server:
   ```bash
   node server.js
   ```
5. Open your browser to **http://localhost:3000**.

### Run with Docker
1. Build the production image:
   ```bash
   docker build -t sanario-app .
   ```
2. Run the container:
   ```bash
   docker run -p 3000:3000 --env-file .env sanario-app
   ```

---

## 🌐 Production Deployment

Sanario is configured according to Twelve-Factor app principles and is ready for containerized cloud deployment (Render, Heroku, Railway):

1. Link this repository to your hosting provider.
2. Provision a hosted **PostgreSQL** database (e.g. Neon, Supabase, Render DB).
3. Set the environment variables in your deployment dashboard:
   * `NODE_ENV=production`
   * `DATABASE_URL=your_postgres_connection_uri`
   * `JWT_SECRET=your_secure_session_key`
   * `GOOGLE_CLIENT_ID=your_google_client_id_from_cloud_console`
