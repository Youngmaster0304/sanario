/**
 * Wellness Risk Detection Engine
 * Analyzes real-time activity metrics and patterns to prevent burnout and strain
 */

class WellnessRiskDetector {
  /**
   * Evaluates user health & digital wellbeing logs
   * @param {Object} wellbeingLog - User's active health metrics
   * @returns {Array} List of active risk flags with corrective recommendations
   */
  evaluateRisks(wellbeingLog) {
    const risks = [];
    if (!wellbeingLog) return risks;

    const { screenTimeSec = 0, steps = 0, waterGlasses = 0 } = wellbeingLog;

    // 1. Sedentary Alert Model
    if (screenTimeSec > 7200 && steps < 1500) {
      risks.push({
        type: 'sedentary',
        severity: 'high',
        title: 'Sedentary Behavior Risk',
        message: 'You have been active on screen for over 2 hours with minimal physical movement.',
        recommendation: 'Stand up immediately, walk around for 5 minutes, or do a light full-body stretch.'
      });
    } else if (screenTimeSec > 3600 && steps < 800) {
      risks.push({
        type: 'sedentary',
        severity: 'medium',
        title: 'Prolonged Sitting Alert',
        message: 'Screen session is reaching 1 hour with low movement activity.',
        recommendation: 'Step away from the screen. Walk to grab a glass of water.'
      });
    }

    // 2. Dehydration Risk Model
    if (waterGlasses < 4) {
      const severity = waterGlasses <= 1 ? 'medium' : 'low';
      risks.push({
        type: 'dehydration',
        severity: severity,
        title: 'Dehydration Risk',
        message: `You have logged only ${waterGlasses} glasses of water today. Optimal hydration supports brain efficiency and mood.`,
        recommendation: 'Drink a full glass of water now to meet your daily cellular needs.'
      });
    }

    // 3. Sleep Hygiene Risk Model (Late-Night Screen Use)
    const localTime = new Date();
    const currentHour = localTime.getHours();
    
    if (currentHour >= 22 || currentHour < 5) {
      const severity = currentHour >= 23 || currentHour < 4 ? 'high' : 'medium';
      risks.push({
        type: 'sleep_hygiene',
        severity: severity,
        title: 'Late Night Screen Time Warning',
        message: 'Scrolling or studying late at night disrupts circadian rhythms due to blue light exposure.',
        recommendation: 'Enable Dark Focus mode, shut down your screen within 10 minutes, and engage in off-screen reflection.'
      });
    }

    // 4. Overload Risk (Doomscrolling Prevention)
    if (screenTimeSec > 10800) { // Over 3 hours total
      risks.push({
        type: 'overload',
        severity: 'medium',
        title: 'Information Overload Risk',
        message: 'Cumulative screen time today has exceeded 3 hours.',
        recommendation: 'Conclude your session and switch to offline activities like reading or outdoors exercise.'
      });
    }

    return risks;
  }
}

module.exports = new WellnessRiskDetector();
