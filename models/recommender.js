/**
 * Two-Tower Recommendation Model Simulator
 * Matches User Interest Vectors with Post Feature Vectors
 */

class TwoTowerRecommender {
  /**
   * Embeds interests into a user vector (simple map)
   */
  getUserVector(interests = []) {
    const vector = {};
    interests.forEach(interest => {
      vector[interest.toLowerCase()] = 1.0;
    });
    return vector;
  }

  /**
   * Embeds a post into a feature vector
   */
  getPostVector(post) {
    const vector = {
      category: post.category ? post.category.toLowerCase() : '',
      quality: post.qualityScore || 0.8
    };
    return vector;
  }

  /**
   * Computes recommendation score between user interest vector and post feature vector
   */
  computeScore(userVector, postVector) {
    let matchScore = 0.0;
    
    // Category match check (User Tower & Post Tower overlap)
    if (postVector.category && userVector[postVector.category]) {
      matchScore = 1.0;
    } else {
      matchScore = 0.15; // Low baseline similarity for non-selected interests
    }

    // Weighting elements: 60% category match, 30% content quality score, 10% exploration factor
    const qualityScore = postVector.quality;
    const explorationFactor = Math.random() * 0.1; // Intentional content diversity

    const finalScore = (matchScore * 0.6) + (qualityScore * 0.3) + (explorationFactor * 0.1);
    return parseFloat(finalScore.toFixed(4));
  }

  /**
   * Ranks posts for a given user based on interests
   */
  rankPosts(userInterests, posts) {
    const userVector = this.getUserVector(userInterests);
    
    const scoredPosts = posts.map(post => {
      const postVector = this.getPostVector(post);
      const score = this.computeScore(userVector, postVector);
      return {
        ...post,
        recommendationScore: score
      };
    });

    // Sort by recommendation score descending
    return scoredPosts.sort((a, b) => b.recommendationScore - a.recommendationScore);
  }
}

module.exports = new TwoTowerRecommender();
