var AVATARS = ["🐺","🦊","🐻","🦁","🐯","🐸","🐙","🦉","🐢","🦅","🐴","🦄","🐲","🦖","🦕","🦈","🐬","🐊","🦩","🦜","🦢","🐝","🦋","🕷️","🦂","🐌","🐞","🔥","⭐","🌙","⚡","🍺","🍷","🥃","🎲","🎯","🎸","🃏","👑","🧢","🎩","🥇","🛡️","⚔️","🗡️","🏆","🍀","🎪","🎭","🦴","🧠","💀","👻","🤖","👽","🐉","🧙","🦸","🧛","🥷","🐧","🦔","🐿️","🦝","🦦","🐲"];

var DECKS = {
  1: [
    {t:"trivia", scope:"solo", q:"What is the greatest movie of all time? The group votes — majority rules. A tie means everyone drinks.", a:"Whatever the group agrees on. If you can't agree, everyone drinks."},
    {t:"trivia", scope:"solo", q:"Name each player's go-to karaoke song. The player confirms if you're right — get them all to earn the card.", a:"The player confirms. Any wrong guess costs a sip."},
    {t:"trivia", scope:"solo", q:"General knowledge: what is the only mammal capable of true flight?", a:"A bat."},
    {t:"trivia", scope:"solo", q:"Finish the lyric: 'I get knocked down, but I get up again...'", a:"'You are never gonna keep me down.'"},
    {t:"trivia", scope:"solo", q:"What is the tallest mountain on Earth?", a:"Mount Everest — 8,849 m (29,032 ft)."},
    {t:"trivia", scope:"solo", q:"How many minutes are in a full day?", a:"1,440."},
    {t:"trivia", scope:"solo", q:"Which planet is known as the Red Planet?", a:"Mars."},
    {t:"trivia", scope:"solo", q:"How many strings does a standard guitar have?", a:"Six."},
    {t:"trivia", scope:"solo", q:"Name the three people playing right now, from most to least likely to flip the board in rage.", a:"Group vote decides. Whoever is voted most likely drinks."},
    {t:"trivia", scope:"solo", q:"What did you eat for dinner three nights ago?", a:"If nobody at the fire can confirm your answer, you drink."},
    {t:"trivia", scope:"solo", q:"Group vote: who among you is most likely to survive a zombie apocalypse? The group decides — the player voted least likely drinks.", a:"Group decides."},
    {t:"trivia", scope:"solo", q:"What is the capital of Australia?", a:"Canberra. (Not Sydney — that's the trap.)"},
    {t:"puzzle", scope:"solo", q:"Riddle: I am tall when I am young and short when I am old. What am I?", a:"A candle. (Very on theme for a firepit.)"},
    {t:"puzzle", scope:"solo", q:"Riddle: The more you take, the more you leave behind. What are they?", a:"Footsteps."},
    {t:"puzzle", scope:"solo", q:"Say the alphabet backwards, out loud, in under 45 seconds.", a:"No answer. Just survive."},
    {t:"puzzle", scope:"solo", q:"Name 7 animals that start with the letter S in 20 seconds. No repeats, no passing.", a:"Examples: snake, squirrel, shark, sheep, spider, sloth, seal."},
    {t:"puzzle", scope:"solo", q:"Count backwards from 50 by 7s (50, 43, 36...) without a mistake.", a:"50, 43, 36, 29, 22, 15, 8, 1."},
    {t:"puzzle", scope:"solo", q:"Say this three times fast: 'She sells seashells by the seashore.'", a:"No answer. Good luck."},
    {t:"puzzle", scope:"solo", q:"List 5 board games in 15 seconds. No repeats, no passing.", a:"Any 5 count."},
    {t:"puzzle", scope:"solo", q:"Spell your full name backwards out loud, correctly, first try.", a:"No answer. If you hesitate, you drink."},
    {t:"artistry", scope:"all", q:"Charades: act out a movie title. The other two guess. Earn the card if someone gets it within 60 seconds.", a:"No answer. Group decides if the guess counts."},
    {t:"artistry", scope:"all", q:"Describe an object WITHOUT naming it or any of its parts. The other two guess. Earn the card if they get it within 60 seconds.", a:"No answer."},
    {t:"artistry", scope:"all", q:"Sculpt something using anything on hand (clay, mud, a napkin, a snack). The other two guess.", a:"No answer."},
    {t:"artistry", scope:"all", q:"Draw a picture in the air with your finger only. The other two guess.", a:"No answer."},
    {t:"artistry", scope:"all", q:"Hum a song. The other two guess the tune within 30 seconds.", a:"No answer."},
    {t:"artistry", scope:"all", q:"Draw on the back of one opponent with your finger. They must guess by feel alone. If they get it, YOU earn the card.", a:"No answer."},
    {t:"artistry", scope:"all", q:"Perform a silent, 30-second impression of a famous celebrity. No talking. The other two guess who.", a:"No answer."},
    {t:"chance", scope:"solo", q:"Everyone else takes a sip. You watch, smugly.", a:"", effect:"everyone_else_sips"},
    {t:"chance", scope:"solo", q:"Go to Jail. Sit in the designated 'jail' (a chair or cooler) until your next turn. No phone.", a:"", effect:"jail"},
    {t:"chance", scope:"solo", q:"Swap game pieces (avatars) with the player on your left for the rest of the game.", a:"", effect:"swap"},
    {t:"chance", scope:"solo", q:"Skip your next turn. Savor the break.", a:"", effect:"skip"},
    {t:"chance", scope:"solo", q:"Bank error in your favor: earn a free card at this level.", a:"", effect:"advance_card"},
    {t:"chance", scope:"solo", q:"Take one earned card from whoever is leading at this level.", a:"", effect:"steal_leader"},
    {t:"chance", scope:"solo", q:"Speak only in a whisper until your next turn, or drink every time you forget.", a:"", effect:"flavor"},
    {t:"chance", scope:"solo", q:"Do 10 jumping jacks right now, or drink twice.", a:"", effect:"flavor"},
    {t:"chance", scope:"solo", q:"You are now the Judge. You rule on all disputes until your next turn. Judge impartially... or don't.", a:"", effect:"flavor"}
  ],
  2: [
    {t:"body", scope:"solo", q:"Wall-sit. Hold it longer than both opponents. Winner earns the card; whoever drops first drinks.", a:""},
    {t:"body", scope:"solo", q:"Plank-off. Hold a plank the longest. Last place drinks.", a:""},
    {t:"body", scope:"solo", q:"Staring contest. First to blink loses and drinks.", a:""},
    {t:"body", scope:"solo", q:"Balance a shoe or cup on your head for 30 seconds while the other two try to make you laugh. Don't drop it.", a:""},
    {t:"body", scope:"solo", q:"Hold your breath the longest. Last to surface drinks.", a:""},
    {t:"body", scope:"solo", q:"Thumb war, best of three, against each opponent. Win both to earn the card.", a:""},
    {t:"body", scope:"solo", q:"Ice endurance: hold an ice cube in your fist until it melts or you give up. Longest wins.", a:""},
    {t:"body", scope:"solo", q:"The Grape Gobble: fit as many grapes, cherries, or berries in your mouth as you can using only your face. Spit them out to prove it — eaten ones don't count. Most wins.", a:""},
    {t:"body", scope:"solo", q:"Stand on one foot with your eyes closed. Last one standing wins.", a:""},
    {t:"body", scope:"solo", q:"Hold a completely straight face while the other two roast you for 45 seconds. Crack and you drink.", a:""},
    {t:"body", scope:"solo", q:"Arm wrestle the player on your right. Winner earns the card; loser drinks.", a:""},
    {t:"body", scope:"solo", q:"Do the most push-ups or squats in 30 seconds. Fewest drinks.", a:""},
    {t:"body", scope:"solo", q:"Hold both arms straight out to your sides for as long as you can. First to drop drinks.", a:""},
    {t:"body", scope:"solo", q:"Wobble race: stand heel-to-toe and lean back. Whoever holds longest wins.", a:""},
    {t:"chance", scope:"solo", q:"Everyone else takes a sip. You watch, gloating.", a:"", effect:"everyone_else_sips"},
    {t:"chance", scope:"solo", q:"Curse jar: from now until your next turn, anyone who curses drinks. You are the enforcer.", a:"", effect:"flavor"},
    {t:"chance", scope:"solo", q:"Skip your next turn.", a:"", effect:"skip"},
    {t:"chance", scope:"solo", q:"Earn a free Body card. You absolute goose.", a:"", effect:"advance_card"},
    {t:"chance", scope:"solo", q:"Go to Jail: sit out in the 'jail' chair until your next turn.", a:"", effect:"jail"},
    {t:"chance", scope:"solo", q:"Swap game pieces with the player on your right for the rest of the game.", a:"", effect:"swap"},
    {t:"chance", scope:"solo", q:"Trade accents with the player across from you for the rest of the level.", a:"", effect:"flavor"}
  ],
  3: [
    {t:"spirit", scope:"solo", q:"Emotional Battery: sit still while the other two roast you nonstop for 60 seconds. No defending yourself. Don't crack — if you do, drink. Survive and you earn the card.", a:""},
    {t:"spirit", scope:"solo", q:"Public Humiliation: do your best 20-second dance for the group. No music required.", a:""},
    {t:"spirit", scope:"solo", q:"Read your most recent sent text message out loud. Or drink 3 sips and pass.", a:""},
    {t:"spirit", scope:"solo", q:"Tell the group your most embarrassing childhood story. Or forfeit (3 sips) and skip.", a:""},
    {t:"spirit", scope:"solo", q:"Do your best impression of another player. They decide if it's good enough to earn the card.", a:""},
    {t:"spirit", scope:"solo", q:"Let the group assign you a nickname that lasts the rest of the game.", a:""},
    {t:"spirit", scope:"solo", q:"Call a contact and sing them 'Happy Birthday' — on the wrong day. Or drink.", a:""},
    {t:"spirit", scope:"solo", q:"Speak only in questions until your next turn. Every slip-up is a sip.", a:""},
    {t:"spirit", scope:"solo", q:"Reveal your most irrational fear and defend it passionately for 30 seconds.", a:""},
    {t:"spirit", scope:"solo", q:"Deliver a heartfelt dramatic monologue to the fire about why you deserve to win. The others judge.", a:""},
    {t:"spirit", scope:"solo", q:"The other two write a one-sentence roast and read it aloud themselves. If you laugh, drink.", a:""},
    {t:"spirit", scope:"solo", q:"Sing the first song that pops into your head, all the way through the chorus.", a:""},
    {t:"spirit", scope:"solo", q:"Public Humiliation: let the player on your left give you a new hairstyle with whatever is on hand.", a:""},
    {t:"spirit", scope:"solo", q:"Emotional Battery: each opponent gets one honest, cutting question about your life. Answer both without deflecting.", a:""},
    {t:"spirit", scope:"solo", q:"Give a sincere compliment to each opponent while maintaining unbroken eye contact. No laughing.", a:""}
  ]
};

var BLACK_CARDS = [
  {name:"Flip a Coin", text:"Flip a coin. Call it in the air. Winner takes the whole game."},
  {name:"High Card", text:"Each player is dealt one card. Highest card wins the game.", deal:true},
  {name:"Dare Duel", text:"One player from each team (everyone, here) takes turns issuing dares. First to refuse loses. If you refuse, the person who dared you must complete their own dare to win."},
  {name:"Rock, Paper, Scissors", text:"Single elimination rock-paper-scissors. Last one standing wins the game."},
  {name:"Dance-Off", text:"Sixty-second dance-off. The fire is the only judge. Winner takes it all."},
  {name:"Thumb War Royale", text:"Free-for-all thumb war. Last thumb standing wins the game."},
  {name:"Roast Duel", text:"Take turns roasting each other, one line at a time. First to go silent, laugh, or repeat loses. Last one sharp wins the game."},
  {name:"Stare-Down", text:"Last person to look away from the fire wins the game."}
];

var RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
var SUITS = ["♠","♥","♦","♣"];

var ACCENTS = ["Russian","Brazilian","Philadelphia","Southern US","Irish","Scottish","Australian","German","French","Italian","Indian","Japanese","Mexican","British posh","Boston","New York","Canadian","South African","Jamaican","Texan","Cockney","Transylvanian","Valley girl","Pirate","News anchor"];

export { AVATARS, DECKS, BLACK_CARDS, RANKS, SUITS, ACCENTS };
