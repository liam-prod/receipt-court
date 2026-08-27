/**
 * data.js — The statute book.
 *
 * Everything the court knows before it knows anything about you:
 * how frivolous a category of spending is presumed to be, what a
 * reasonable person pays for it, and which merchants map to which sin.
 */

/**
 * Categories carry a `frivolity` (0 = necessity of life, 100 = pure vice)
 * which seeds the base culpability score, and a `typical` transaction
 * amount used to detect excess.
 */
export const CATEGORIES = {
  rent:           { label: 'Housing',            frivolity: 0,  typical: 1600 },
  medical:        { label: 'Medical',            frivolity: 0,  typical: 60 },
  pharmacy:       { label: 'Pharmacy',           frivolity: 3,  typical: 28 },
  utilities:      { label: 'Utilities',          frivolity: 2,  typical: 110 },
  insurance:      { label: 'Insurance',          frivolity: 4,  typical: 150 },
  childcare:      { label: 'Childcare',          frivolity: 0,  typical: 400 },
  groceries:      { label: 'Groceries',          frivolity: 8,  typical: 85 },
  transit:        { label: 'Transit',            frivolity: 10, typical: 4 },
  fuel:           { label: 'Fuel',               frivolity: 12, typical: 65 },
  education:      { label: 'Education',          frivolity: 12, typical: 120 },
  fitness:        { label: 'Fitness',            frivolity: 28, typical: 55 },
  hardware:       { label: 'Hardware & Repair',  frivolity: 25, typical: 45 },
  travel:         { label: 'Travel',             frivolity: 45, typical: 380 },
  dining:         { label: 'Restaurant',         frivolity: 50, typical: 42 },
  coffee:         { label: 'Coffee',             frivolity: 56, typical: 7 },
  convenience:    { label: 'Convenience Store',  frivolity: 56, typical: 14 },
  streaming:      { label: 'Streaming',          frivolity: 57, typical: 16 },
  subscriptions:  { label: 'Subscriptions',      frivolity: 60, typical: 19 },
  home_decor:     { label: 'Home Decor',         frivolity: 61, typical: 68 },
  beauty:         { label: 'Beauty',             frivolity: 62, typical: 44 },
  fast_food:      { label: 'Fast Food',          frivolity: 63, typical: 18 },
  apps:           { label: 'Apps & Software',    frivolity: 63, typical: 24 },
  electronics:    { label: 'Electronics',        frivolity: 66, typical: 210 },
  rideshare:      { label: 'Rideshare',          frivolity: 58, typical: 26 },
  vending:        { label: 'Vending Machine',    frivolity: 67, typical: 4 },
  fashion:        { label: 'Fashion',            frivolity: 70, typical: 95 },
  alcohol:        { label: 'Liquor Store',       frivolity: 71, typical: 48 },
  bar:            { label: 'Bar',                frivolity: 74, typical: 62 },
  gadgets:        { label: 'Gadgets',            frivolity: 74, typical: 130 },
  gaming:         { label: 'Video Games',        frivolity: 76, typical: 40 },
  food_delivery:  { label: 'Food Delivery',      frivolity: 80, typical: 39 },
  impulse_retail: { label: 'Impulse Retail',     frivolity: 82, typical: 55 },
  crypto:         { label: 'Speculative Assets', frivolity: 91, typical: 250 },
  gambling:       { label: 'Gambling',           frivolity: 96, typical: 80 },
  misc:           { label: 'Unclassified',       frivolity: 42, typical: 35 },
};

/**
 * Merchant fingerprints. Longest match wins, so "uber eats" beats "uber".
 * Heavy on Canadian chains, because the court sits in Calgary.
 */
export const MERCHANT_RULES = [
  ['uber eats', 'food_delivery'], ['ubereats', 'food_delivery'],
  ['doordash', 'food_delivery'], ['door dash', 'food_delivery'],
  ['skip the dishes', 'food_delivery'], ['skipthedishes', 'food_delivery'],
  ['grubhub', 'food_delivery'], ['fantuan', 'food_delivery'],
  ['instacart', 'groceries'], ['postmates', 'food_delivery'],

  ['tim hortons', 'coffee'], ['timmies', 'coffee'], ['starbucks', 'coffee'],
  ['second cup', 'coffee'], ['blue bottle', 'coffee'], ['analog coffee', 'coffee'],
  ['phil & sebastian', 'coffee'], ['monogram', 'coffee'], ['rosso coffee', 'coffee'],

  ['mcdonald', 'fast_food'], ['a&w', 'fast_food'], ['wendy', 'fast_food'],
  ['burger king', 'fast_food'], ['popeyes', 'fast_food'], ['kfc', 'fast_food'],
  ['subway', 'fast_food'], ['taco bell', 'fast_food'], ['chipotle', 'fast_food'],
  ['five guys', 'fast_food'], ['dairy queen', 'fast_food'], ['edo japan', 'fast_food'],

  ['cactus club', 'dining'], ['earls', 'dining'], ['joey', 'dining'],
  ['moxie', 'dining'], ['ricky', 'dining'], ['boston pizza', 'dining'],
  ['the palomino', 'bar'], ['national on', 'bar'], ['craft beer', 'bar'],
  ['pub', 'bar'], ['tavern', 'bar'], ['lounge', 'bar'], ['brewing', 'bar'],
  ['liquor', 'alcohol'], ['wine', 'alcohol'], ['co-op wine', 'alcohol'],
  ['sobeys liquor', 'alcohol'], ['willow park', 'alcohol'],

  ['safeway', 'groceries'], ['sobeys', 'groceries'], ['loblaws', 'groceries'],
  ['superstore', 'groceries'], ['save-on-foods', 'groceries'], ['save on foods', 'groceries'],
  ['no frills', 'groceries'], ['co-op food', 'groceries'], ['calgary co-op', 'groceries'],
  ['farmers market', 'groceries'], ['costco', 'groceries'], ['walmart', 'groceries'],
  ['t&t supermarket', 'groceries'], ['freshco', 'groceries'],

  ['shoppers drug', 'pharmacy'], ['rexall', 'pharmacy'], ['pharmacy', 'pharmacy'],
  ['london drugs', 'pharmacy'], ['dental', 'medical'], ['clinic', 'medical'],
  ['physio', 'medical'], ['optometr', 'medical'], ['massage', 'medical'],

  ['enmax', 'utilities'], ['atco', 'utilities'], ['telus', 'utilities'],
  ['rogers', 'utilities'], ['shaw', 'utilities'], ['bell canada', 'utilities'],
  ['fido', 'utilities'], ['koodo', 'utilities'], ['internet', 'utilities'],

  ['petro-canada', 'fuel'], ['petro canada', 'fuel'], ['esso', 'fuel'],
  ['shell', 'fuel'], ['husky', 'fuel'], ['chevron', 'fuel'], ['gas station', 'fuel'],
  ['circle k', 'convenience'], ['7-eleven', 'convenience'], ['7 eleven', 'convenience'],
  ['mac’s', 'convenience'], ['macs conv', 'convenience'],

  ['calgary transit', 'transit'], ['transit', 'transit'], ['parking', 'transit'],
  ['impark', 'transit'], ['calgary parking', 'transit'],
  ['uber', 'rideshare'], ['lyft', 'rideshare'], ['taxi', 'rideshare'],
  ['checker cab', 'rideshare'], ['associated cab', 'rideshare'],

  ['air canada', 'travel'], ['westjet', 'travel'], ['flair', 'travel'],
  ['airbnb', 'travel'], ['expedia', 'travel'], ['booking.com', 'travel'], ['hotel', 'travel'],

  ['netflix', 'streaming'], ['spotify', 'streaming'], ['disney+', 'streaming'],
  ['crave', 'streaming'], ['hulu', 'streaming'], ['prime video', 'streaming'],
  ['youtube premium', 'streaming'], ['apple tv', 'streaming'], ['audible', 'streaming'],

  ['steam', 'gaming'], ['playstation', 'gaming'], ['xbox', 'gaming'],
  ['nintendo', 'gaming'], ['epic games', 'gaming'], ['riot games', 'gaming'],
  ['blizzard', 'gaming'], ['roblox', 'gaming'], ['gacha', 'gaming'],
  ['eb games', 'gaming'], ['gamestop', 'gaming'],

  ['app store', 'apps'], ['google play', 'apps'], ['adobe', 'apps'],
  ['figma', 'apps'], ['notion', 'apps'], ['openai', 'apps'], ['anthropic', 'apps'],
  ['github', 'apps'], ['patreon', 'subscriptions'], ['substack', 'subscriptions'],
  ['onlyfans', 'subscriptions'], ['linkedin premium', 'subscriptions'],

  ['best buy', 'electronics'], ['memory express', 'electronics'],
  ['apple store', 'electronics'], ['newegg', 'electronics'], ['visions', 'electronics'],
  ['aliexpress', 'gadgets'], ['temu', 'impulse_retail'], ['wish.com', 'impulse_retail'],
  ['shein', 'fashion'], ['zara', 'fashion'], ['h&m', 'fashion'], ['uniqlo', 'fashion'],
  ['lululemon', 'fashion'], ['aritzia', 'fashion'], ['nike', 'fashion'],
  ['simons', 'fashion'], ['winners', 'fashion'], ['sport chek', 'fashion'],

  ['sephora', 'beauty'], ['ulta', 'beauty'], ['barber', 'beauty'], ['salon', 'beauty'],
  ['ikea', 'home_decor'], ['structube', 'home_decor'], ['homesense', 'home_decor'],
  ['canadian tire', 'hardware'], ['home depot', 'hardware'], ['rona', 'hardware'],
  ['lowes', 'hardware'], ['princess auto', 'hardware'],

  ['goodlife', 'fitness'], ['orangetheory', 'fitness'], ['f45', 'fitness'],
  ['climbing', 'fitness'], ['yoga', 'fitness'], ['peloton', 'fitness'],

  ['amazon', 'impulse_retail'], ['etsy', 'impulse_retail'], ['dollarama', 'impulse_retail'],
  ['vending', 'vending'], ['coinbase', 'crypto'], ['binance', 'crypto'],
  ['robinhood', 'crypto'], ['wealthsimple crypto', 'crypto'],
  ['casino', 'gambling'], ['draftkings', 'gambling'], ['lotto', 'gambling'],
  ['play alberta', 'gambling'], ['bet365', 'gambling'], ['stampede casino', 'gambling'],

  ['insurance', 'insurance'], ['tuition', 'education'], ['university', 'education'],
  ['sait', 'education'], ['daycare', 'childcare'], ['rent', 'rent'], ['mortgage', 'rent'],
];

/**
 * A pre-loaded docket for the demo. Offsets are hours-before-now, so the
 * evidence is always fresh and the timestamps always incriminating.
 * `hoursAgo` values are chosen to trip specific statutes: witching hour,
 * sprees, recidivism, and one genuinely innocent grocery run.
 */
export const DEMO_DOCKET = [
  { merchant: 'DoorDash',        amount: 47.83, hoursAgo: 8,   note: '' },
  { merchant: 'DoorDash',        amount: 38.19, hoursAgo: 32,  note: '' },
  { merchant: 'DoorDash',        amount: 52.40, hoursAgo: 79,  note: '' },
  { merchant: 'Steam',           amount: 89.99, hoursAgo: 15,  note: '' },
  { merchant: 'Amazon',          amount: 23.99, hoursAgo: 15.4,note: '' },
  { merchant: 'Amazon',          amount: 61.47, hoursAgo: 15.7,note: '' },
  { merchant: 'Temu',            amount: 18.99, hoursAgo: 16,  note: '' },
  { merchant: 'Starbucks',       amount: 8.45,  hoursAgo: 27,  note: '' },
  { merchant: 'Tim Hortons',     amount: 4.19,  hoursAgo: 51,  note: '' },
  { merchant: 'Calgary Co-op',   amount: 92.31, hoursAgo: 45,  note: '' },
  { merchant: 'Uber',            amount: 31.20, hoursAgo: 62,  note: '' },
  { merchant: 'The Palomino',    amount: 118.75,hoursAgo: 63,  note: '' },
  { merchant: 'Shoppers Drug Mart', amount: 14.20, hoursAgo: 70, note: '' },
  { merchant: 'Lululemon',       amount: 148.00,hoursAgo: 96,  note: '' },
  { merchant: 'Play Alberta',    amount: 40.00, hoursAgo: 100, note: '' },
];
