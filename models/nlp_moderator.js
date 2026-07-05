/**
 * NLP Toxicity and Content Moderation Model Simulator
 * Lexicon-based scoring for safe online environments
 */

const TOXIC_WORDS = {
  // Hate speech / Harassment
  'hate': 0.8,
  'stupid': 0.5,
  'idiot': 0.5,
  'ugly': 0.6,
  'kill': 0.9,
  'trash': 0.4,
  'harass': 0.7,
  'abuse': 0.8,
  
  // Scams / Spam / Vanity
  'crypto-millions': 0.7,
  'earn-free': 0.6,
  'win-money': 0.7,
  'cash-prize': 0.7,
  'clickbait': 0.5,
  'followers-fast': 0.6,
  'make-rich': 0.7,
  'secret-loophole': 0.6,
  'double-cash': 0.8
};

class NLPModerator {
  /**
   * Tokenizes text and sanitizes punctuation
   */
  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
      .split(/\s+/);
  }

  /**
   * Evaluates text for toxicity, spam, and clickbait
   */
  evaluate(text) {
    if (!text || text.trim() === '') {
      return { toxic: false, score: 0, flags: [] };
    }

    const tokens = this.tokenize(text);
    let totalScore = 0.0;
    let matchCount = 0;
    const flags = [];

    // 1. Lexicon lookup
    tokens.forEach(token => {
      if (TOXIC_WORDS[token] !== undefined) {
        totalScore += TOXIC_WORDS[token];
        matchCount++;
      }
    });

    // Composite matches (e.g. "free money")
    const simplifiedText = tokens.join(' ');
    if (simplifiedText.includes('free money') || simplifiedText.includes('win cash') || simplifiedText.includes('get rich')) {
      totalScore += 0.8;
      matchCount++;
      flags.push('Financial Scam/Clickbait');
    }

    // 2. Clickbait patterns (excessive exclamation marks, all caps words)
    const exclamations = (text.match(/!/g) || []).length;
    if (exclamations > 3) {
      totalScore += 0.3;
      matchCount++;
      flags.push('Excessive Exclamation');
    }

    const words = text.split(/\s+/);
    const capsCount = words.filter(w => w.length > 3 && w === w.toUpperCase() && !/^[0-9]+$/.test(w)).length;
    if (capsCount > 2) {
      totalScore += 0.3;
      matchCount++;
      flags.push('Aggressive Caps Lock');
    }

    // Calculate normalized score
    let finalScore = 0;
    if (matchCount > 0) {
      finalScore = Math.min(1.0, totalScore / Math.max(1, matchCount * 0.8));
    }

    // Assign categories of toxic flag
    if (finalScore >= 0.5) {
      if (flags.length === 0) {
        flags.push('Harassment/Inappropriate Content');
      }
      return {
        toxic: true,
        score: parseFloat(finalScore.toFixed(3)),
        flags: flags,
        reason: `Content flagged by Sanario NLP Safety Filter (${flags.join(', ')})`
      };
    }

    return {
      toxic: false,
      score: parseFloat(finalScore.toFixed(3)),
      flags: flags
    };
  }
}

module.exports = new NLPModerator();
