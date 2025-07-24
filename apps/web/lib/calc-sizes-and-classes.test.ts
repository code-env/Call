import { calcSizesAndClasses } from "./calc-sizes-and-classes";

// Test the calcSizesAndClasses function
console.log("Testing calcSizesAndClasses function:");

// Test case 1: Single participant
console.log("\n1. Single participant:");
console.log(calcSizesAndClasses(true, false, false, 0));

// Test case 2: Two participants
console.log("\n2. Two participants:");
console.log(calcSizesAndClasses(true, false, false, 1));

// Test case 3: Four participants
console.log("\n3. Four participants:");
console.log(calcSizesAndClasses(true, false, false, 3));

// Test case 4: Screen sharing active
console.log("\n4. Screen sharing active:");
console.log(calcSizesAndClasses(true, true, false, 3));

// Test case 5: Many participants (10)
console.log("\n5. Many participants (10):");
console.log(calcSizesAndClasses(true, false, false, 9));

// Test case 6: Large group (15+ participants)
console.log("\n6. Large group (15+ participants):");
console.log(calcSizesAndClasses(true, false, false, 14));
