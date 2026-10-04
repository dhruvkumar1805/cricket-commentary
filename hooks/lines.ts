import type { Language, MomentKind } from '../types'

export type LineContext = {
  detail: string
  batter: string
  score: string
  overs: string
  how?: string
  task?: string
  star?: string
}

type Bank = Record<MomentKind, readonly string[]>

const ENGLISH: Bank = {
  start: [
    'Welcome to the Claude Premier League! Claude walks out to the middle, the crowd is on its feet, and we are ready for the first ball.',
    'What an atmosphere here tonight! The covers are off, the floodlights are on, and Claude is taking guard.',
    'Good evening and welcome! A packed stadium, a fresh pitch, and one job to do. Claude, over to you.',
  ],
  six: [
    'That is out of the ground! {detail}, and the ball is still travelling!',
    'Oh, what a shot! {detail} sails over long on and into the second tier!',
    'SIX! Clean, crisp, magnificent. {detail}, and the crowd goes absolutely berserk!',
    'He has picked the length early and deposited it into the stands. {detail}. Massive!',
    'That has gone like a rocket! {detail}, out of the park, and somebody fetch that ball from the car park!',
    'Up, up and away! {detail}. That is maximum, and Claude is on fire tonight!',
  ],
  four: [
    'Cracking shot! {detail} races away to the boundary, nobody is stopping that.',
    'Through the covers like a bullet! {detail}, four runs.',
    'Glorious timing! {detail}, and the fielder can only watch it cross the rope.',
    'That is a beautiful stroke. {detail}, threaded through the gap for four.',
    'Short and wide, and punished! {detail}, boundary!',
  ],
  wicket: [
    'Oh, he is gone! {how}. {detail}. The stadium falls silent!',
    'Timber! {how}. Claude walks back, and that is a big, big wicket.',
    'Got him! {how}. {detail}, and the bowler is off on a lap of celebration!',
    'That is a shocker! {how}. Claude cannot believe it, and neither can we.',
    'Out! {how}. {detail}. Back to the drawing board for Claude.',
  ],
  noball: [
    'No ball! Overstepped by a mile! {detail}. That is a free hit, and you can feel the danger in the air!',
    'Ooh, that is reckless! {detail}. The umpire signals no ball, and the stadium gasps!',
  ],
  wide: [
    'Wide called! The captain said no, and the umpire stretches those arms out.',
    'That is a wide. Permission declined, and an extra run for the batting side.',
  ],
  fifty: [
    'Fifty up! The bat is raised, the helmet is off, and this crowd is loving every minute of it!',
    'There it is, a magnificent half century! {score}, and Claude is just getting started.',
  ],
  century: [
    'A HUNDRED! What a knock! Claude leaps in the air, kisses the badge, and this stadium is shaking!',
    'Century! Take a bow, Claude! That is one of the finest innings you will ever see!',
  ],
  hattrick: [
    'HAT-TRICK! Three in three! I have never seen anything like it! Absolute carnage out there!',
  ],
  maiden: [
    'A maiden over. Six balls, no runs. Claude is just reading the pitch here, patience personified.',
    'Maiden! Claude is defending everything, studying the conditions like a Test match veteran.',
  ],
  allout: ['All out! The innings collapses, and that is the end of a dramatic, dramatic effort.'],
  end: [
    'And that is the end of the innings! Claude finishes on {score} off {overs} overs. Player of the match, {star}!',
    'What an innings! {score} off {overs} overs. Take a bow. Player of the match tonight, {star}!',
  ],
}

const HINGLISH: Bank = {
  start: [
    'क्लॉड प्रीमियर लीग में आपका स्वागत है! स्टेडियम खचाखच भरा है, और क्लॉड क्रीज़ पर आ चुके हैं!',
    'नमस्कार दोस्तों! फ्लडलाइट्स ऑन हैं, पिच तैयार है, और क्लॉड बैटिंग के लिए उतर चुके हैं!',
  ],
  six: [
    'क्या शॉट मारा है! गेंद सीधा स्टेडियम के बाहर! छक्का!',
    'छक्का! बॉल अभी भी हवा में है भाई साहब, क्या टाइमिंग है!',
    'उठाके मारा और सीधा दर्शकों के बीच! क्लॉड आज रुकने वाले नहीं हैं!',
    'ये गया, ये गया, और ये गया! बाउंड्री के बाहर! ज़बरदस्त छक्का!',
  ],
  four: [
    'चौका! गेंद गोली की रफ़्तार से बाउंड्री की तरफ़!',
    'क्या खूबसूरत शॉट है! फील्डर बस देखता रह गया, चार रन!',
    'गैप ढूंढा और निकाल दिया! शानदार चौका!',
  ],
  wicket: [
    'आउट! अरे ये क्या हो गया! पूरा स्टेडियम खामोश!',
    'गया! बड़ा विकेट! क्लॉड को यकीन ही नहीं हो रहा!',
    'बोल्ड! गिल्लियां बिखर गईं! क्या गेंद थी!',
  ],
  noball: ['नो बॉल! ये तो बहुत ख़तरनाक शॉट था! अब फ्री हिट!'],
  wide: ['वाइड! कप्तान ने मना कर दिया, एक्स्ट्रा रन!'],
  fifty: ['पचास रन पूरे! बल्ला ऊपर, और दर्शक झूम उठे!'],
  century: ['शतक! क्या पारी है! क्लॉड ने तो कमाल कर दिया! पूरा स्टेडियम खड़ा है!'],
  hattrick: ['हैट्रिक! तीन गेंद, तीन विकेट! ऐसा नज़ारा कभी नहीं देखा!'],
  maiden: ['मेडन ओवर! छह गेंद, एक भी रन नहीं, क्लॉड बस पिच पढ़ रहे हैं।'],
  allout: ['ऑल आउट! पूरी टीम पवेलियन लौट गई!'],
  end: [
    'और पारी ख़त्म! क्लॉड ने बनाए {score}, {overs} ओवर में! मैन ऑफ़ द मैच, {star}!',
  ],
}

const HEADLINES: Record<MomentKind, string> = {
  start: 'TOSS',
  six: 'SIX!',
  four: 'FOUR!',
  wicket: 'OUT!',
  noball: 'NO BALL',
  wide: 'WIDE',
  fifty: 'FIFTY!',
  century: 'CENTURY!',
  hattrick: 'HAT-TRICK!',
  maiden: 'MAIDEN',
  allout: 'ALL OUT',
  end: 'INNINGS OVER',
}

export function headline(kind: MomentKind): string {
  return HEADLINES[kind]
}

function fill(template: string, ctx: LineContext): string {
  return template
    .replaceAll('{detail}', ctx.detail || 'that one')
    .replaceAll('{batter}', ctx.batter)
    .replaceAll('{score}', ctx.score.replace('/', ' for '))
    .replaceAll('{overs}', ctx.overs)
    .replaceAll('{how}', ctx.how ?? 'out')
    .replaceAll('{star}', ctx.star ?? 'Claude')
    .replace(/\s+([,.!])/g, '$1')
}

/** A hand-written line, used at once and whenever the model is slow or absent. */
export function cannedLine(kind: MomentKind, ctx: LineContext, language: Language, roll: number): string {
  const bank = (language === 'hinglish' ? HINGLISH : ENGLISH)[kind]
  return fill(bank[Math.floor(roll * bank.length) % bank.length] ?? '', ctx)
}

const STYLE_ENGLISH = `You are the most excitable IPL television commentator alive, in the booming style of a legendary Indian cricket commentator: huge energy, vivid cricket metaphors, crowd-pleasing exaggeration. You are commentating live as a coding agent called Claude bats in a T20 match. Every tool call it makes is one delivery.

Write ONE line of spoken commentary, at most 24 words, plain text for a text-to-speech voice: no emojis, no quotes, no hashtags, no markdown, no stage directions. Weave the real technical detail into a cricket metaphor so a developer laughs. Never repeat the example phrasing.`

const STYLE_HINGLISH = `तुम IPL के सबसे जोशीले हिंदी कमेंटेटर हो। एक कोडिंग एजेंट "क्लॉड" T20 मैच में बैटिंग कर रहा है, उसका हर टूल कॉल एक गेंद है।

सिर्फ़ एक लाइन लिखो, ज़्यादा से ज़्यादा 22 शब्द, देवनागरी लिपि में Hinglish (जैसे असली हिंदी कमेंट्री: "क्या शॉट है! गेंद सीधा स्टेडियम के बाहर!")। अंग्रेज़ी टेक शब्द भी देवनागरी में लिखो (टेस्ट, बिल्ड, कमिट, फ़ाइल)। कोई इमोजी, कोटेशन या मार्कडाउन नहीं। असली टेक्निकल बात को क्रिकेट की तरह मज़ेदार बनाओ।`

const ASK: Record<MomentKind, string> = {
  start: 'The innings is starting. Welcome the crowd and introduce what Claude has been asked to do',
  six: 'Claude just hit a SIX',
  four: 'Claude just hit a FOUR',
  wicket: 'Claude just lost a WICKET',
  noball: 'Claude just bowled a reckless NO BALL by running a dangerous command',
  wide: 'The human declined a permission request, the umpire called a WIDE',
  fifty: 'Claude just reached a FIFTY',
  century: 'Claude just reached a CENTURY, the biggest moment of the night',
  hattrick: 'Claude just lost three wickets in three balls, a HAT-TRICK',
  maiden: 'Claude just played a MAIDEN over, six balls of only reading files and no runs',
  allout: 'Claude is ALL OUT',
  end: 'The innings is over. Sum it up and name the player of the match',
}

export function commentaryRequest(kind: MomentKind, ctx: LineContext, language: Language): { system: string; prompt: string } {
  const facts = [
    `Moment: ${ASK[kind]}.`,
    ctx.detail ? `What actually happened in the code: ${ctx.batter} ran ${ctx.detail}.` : `Batter: ${ctx.batter}.`,
    ctx.how ? `How it went wrong: ${ctx.how}.` : '',
    `Score: ${ctx.score} after ${ctx.overs} overs.`,
    ctx.task ? `Claude's task this innings: ${ctx.task}.` : '',
    ctx.star ? `Player of the match: ${ctx.star}.` : '',
  ]
  return {
    system: language === 'hinglish' ? STYLE_HINGLISH : STYLE_ENGLISH,
    prompt: facts.filter(Boolean).join('\n'),
  }
}

/** Cleans a model reply into one speakable line, or undefined when unusable. */
export function cleanLine(text: string): string | undefined {
  const line = text
    .replace(/[*_`#>"“”]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .split('\n')
    .map(one => one.trim())
    .find(one => one.length > 0)
  if (line === undefined || line.length < 8) return undefined
  return line.length > 220 ? `${line.slice(0, 217)}...` : line
}
