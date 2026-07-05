/**
 * AI Wellness Coach Intent Classifier and Dialog Engine
 * Guides users toward intentional habit formation, breaks, and learning focus.
 */

class AICoach {
  /**
   * Evaluates user input message to detect wellness intent
   */
  classifyIntent(message) {
    const text = message.toLowerCase();

    if (text.includes('plan') || text.includes('schedule') || text.includes('routine') || text.includes('todo')) {
      return 'planning';
    }
    if (text.includes('breathe') || text.includes('anxious') || text.includes('stress') || text.includes('overwhelm') || text.includes('focus') || text.includes('calm')) {
      return 'breathing';
    }
    if (text.includes('stretch') || text.includes('workout') || text.includes('exercise') || text.includes('walk') || text.includes('fitness')) {
      return 'fitness';
    }
    return 'general';
  }

  /**
   * Generates coach response based on intent and query
   */
  generateResponse(message, username = 'Friend') {
    const intent = this.classifyIntent(message);
    let reply = '';
    let action = null; // Suggest specific action if applicable

    switch (intent) {
      case 'planning':
        reply = `Here is a mindful, goal-driven plan structured for your day, ${username}. Remember to take screen breaks every 45 minutes:
        
**🌅 Morning Focus (Deep Work)**
- 09:00 - 09:45: Deep Work Block 1 (High priority goal)
- 09:45 - 09:50: Physical Stretch Break (Offline)
- 09:50 - 10:35: Deep Work Block 2
- 10:35 - 11:00: Mindfulness / Hydration break (2 glasses)

**☀️ Afternoon Administration**
- 13:00 - 14:00: General communications, emails, and checking Sanario Communities
- 14:00 - 15:00: Skill development (Coding/Reading)

**🌇 Evening Integration**
- 18:00 - 19:00: Movement/Walking (Aim for 4,000 steps!)
- 20:30 onwards: Screen shut down, digital detox.

Would you like me to add these tasks to your Daily Goals checklist?`;
        action = { type: 'add_goals', data: ['Morning Meditation (15m)', 'Deep Work Block (90m)', 'Read 1 chapter'] };
        break;

      case 'breathing':
        reply = `It's completely natural to feel overwhelmed or scattered. Let's take a brief moment to reset.

I recommend a quick **Box Breathing session (4-4-4-4 cycle)** to calm your nervous system.
- Inhale deeply for 4 seconds
- Hold your breath for 4 seconds
- Exhale slowly for 4 seconds
- Rest empty for 4 seconds

I have opened a breathing circle widget for you below. Take 1 minute to follow the visual rhythm.`;
        action = { type: 'start_breathing' };
        break;

      case 'fitness':
        reply = `Excellent! Moving your body boosts cognitive capability and lowers screen fatigue. Let's do a **5-minute screen break stretch**:
        
1. **Neck Rolls (1 min)**: Slowly roll your neck in circles to release desk strain.
2. **Shoulder Shrugs (1 min)**: Lift shoulders to ears, hold, and drop.
3. **Seated Twist (1.5 min)**: Rotate your torso left, hold for 30s, then repeat right.
4. **Wrist & Hand stretches (1.5 min)**: Extend arms and flex wrists to prevent RSI.

Do you want to log this stretch? Completing it will earn you **10 XP**!`;
        action = { type: 'log_activity', activity: 'Stretch Break', xp: 10 };
        break;

      default:
        reply = `Hello ${username}. I'm analyzing your current digital habits. You're doing great keeping your screen time intentional. 
        
Remember, Sanario is designed to help you build habits outside the screen. If you feel like scrolling compulsively, try starting a **Deep Work Timer** or jumping into a learning community like **AI** or **Coding** to collaborate rather than consume. What are you looking to achieve today?`;
        break;
    }

    return {
      message: reply,
      intent: intent,
      action: action,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new AICoach();
