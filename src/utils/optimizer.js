export function getGroupSizes(numPlayers) {
  // Try to compose using 4s and 3s to avoid very small groups
  for (let num4 = Math.floor(numPlayers / 4); num4 >= 0; num4--) {
    const remainder = numPlayers - num4 * 4;
    if (remainder % 3 === 0) {
      const num3 = remainder / 3;
      const sizes = [];
      for (let i = 0; i < num4; i++) sizes.push(4);
      for (let i = 0; i < num3; i++) sizes.push(3);
      return sizes;
    }
  }
  // If not possible (e.g., 1, 2, 5), just chunk by 4 and let the last group be whatever remains
  const sizes = [];
  let remaining = numPlayers;
  while (remaining > 0) {
    if (remaining >= 4) {
      sizes.push(4);
      remaining -= 4;
    } else {
      sizes.push(remaining);
      remaining = 0;
    }
  }
  return sizes;
}

// Helper to calculate overlap score for the entire schedule
// Penalty is based on how many times pairs meet more than once
function calculateScore(schedule) {
  let score = 0;
  const meets = new Map();

  for (const day of schedule) {
    for (const group of day) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          // Create a consistent pair key
          const p1 = group[i];
          const p2 = group[j];
          const pairKey = p1 < p2 ? `${p1}||${p2}` : `${p2}||${p1}`;
          
          const count = (meets.get(pairKey) || 0) + 1;
          meets.set(pairKey, count);
        }
      }
    }
  }

  // Calculate penalty
  for (const count of meets.values()) {
    if (count > 1) {
      score += Math.pow(count - 1, 2); // Squared penalty for multiple meetings
    }
  }

  return score;
}

// Randomly shuffle an array
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function generateOptimizedSchedule(players, days, iterations = 10000) {
  if (!players || players.length === 0 || days <= 0) return [];

  const groupSizes = getGroupSizes(players.length);
  
  // 1. Generate initial random schedule
  let currentSchedule = [];
  for (let d = 0; d < days; d++) {
    const shuffled = shuffle(players);
    const dayGroups = [];
    let currentIndex = 0;
    for (const size of groupSizes) {
      dayGroups.push(shuffled.slice(currentIndex, currentIndex + size));
      currentIndex += size;
    }
    currentSchedule.push(dayGroups);
  }

  let currentScore = calculateScore(currentSchedule);
  let bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
  let bestScore = currentScore;

  // 2. Simulated Annealing / Local Search optimization
  let temp = 1.0;
  const coolingRate = 0.9995;

  for (let i = 0; i < iterations; i++) {
    if (currentScore === 0) break; // Perfect score achieved

    // Pick a random day to mutate
    const dayIndex = Math.floor(Math.random() * days);
    const day = currentSchedule[dayIndex];
    
    // We need at least 2 groups to swap
    if (day.length < 2) break;

    const g1Index = Math.floor(Math.random() * day.length);
    let g2Index = Math.floor(Math.random() * day.length);
    while (g1Index === g2Index) {
      g2Index = Math.floor(Math.random() * day.length);
    }

    const g1 = day[g1Index];
    const g2 = day[g2Index];

    const p1Index = Math.floor(Math.random() * g1.length);
    const p2Index = Math.floor(Math.random() * g2.length);

    // Swap players
    const p1 = g1[p1Index];
    const p2 = g2[p2Index];
    
    // Create new schedule with swap
    const newSchedule = JSON.parse(JSON.stringify(currentSchedule));
    newSchedule[dayIndex][g1Index][p1Index] = p2;
    newSchedule[dayIndex][g2Index][p2Index] = p1;

    const newScore = calculateScore(newSchedule);

    // Acceptance condition (Simulated Annealing)
    if (newScore < currentScore || Math.random() < Math.exp((currentScore - newScore) / temp)) {
      currentSchedule = newSchedule;
      currentScore = newScore;
      
      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestSchedule = JSON.parse(JSON.stringify(currentSchedule));
      }
    }

    temp *= coolingRate;
  }

  return bestSchedule;
}
