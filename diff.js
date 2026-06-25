const s1 = `    Scenario: Account has sufficient funds
      Given the account balance is $100
       And the card is valid.`;
const s2 = `    Scenario: Account has sufficient funds
      Given the account balance is $100
       And the card is valid.`;

console.log("Length 1:", s1.length);
console.log("Length 2:", s2.length);
console.log("Equal:", s1 === s2);
