// Import venom-bot for WhatsApp integration
const venom = require('venom-bot');
const { exec } = require('child_process');

// ASCII-art template for hangman — Malios Dark
function hangmanTemplate(errors) {
    const bodyParts = ['O', '|', '/', '\\', '/', '\\'];
    const gallows = ['  ', '  ', '  ', '  ', '  ', '  '];
  
    
    for (let i = 0; i < errors.length; i++) {
      gallows[i] = bodyParts[i];
    }
  
// ASCII-art template for hangman — Malios Dark
    let template = "*-------*\n";
    template += "||      |    \n";
    template += "||     " + gallows[0] + "    \n";
    template += "||   " + gallows[1] + gallows[2] + gallows[3] + "  \n";
    template += "||   " + gallows[4] + " " + gallows[5] + "   \n";
    template += "||           \n";
    template += "||=========\n\n";
  
    return template;
  }
  

// Word lists by language
const wordLists = {
  es: [
    'parte','aventurero','maravilloso','general','pared','prosa','ambicioso','brillante',
    'seductor','número','prueba','interés','rayo','cínico','oferta','apretón','hundir',
    'suave','adorable','cuaderno','crédulo','dulce','caza','comparación','frívolo','chispa',
    'guardado','comida','cura','suciedad','loco','pesar','mojado','encantador','amarillo',
    'espumoso','archivo','desordenado','cárcel','etéreo','cremallera','usado','inútil',
    'cabeza','hadas','pipa','propósito','correa','sagrado','nueve'
  ],
  en: [
    'hello','world','adventurer','wonderful','wall','prose','ambitious','brilliant',
    'seductive','number','test','interest','beam','cynical','offer','squeeze','sink',
    'soft','adorable','notebook','credulous','sweet','hunt','comparison','frivolous','spark',
    'stored','food','cure','dirt','crazy','sorrow','wet','charming','yellow','frothy',
    'file','messy','jail','ethereal','zipper','used','useless','head','fairies','pipe',
    'purpose','belt','sacred','nine'
  ]
};

// Per-user win/loss stats
const userStats = {};
// Per-user game sessions
const sessions = {};

// Game factory
function createGame(lang = 'es') {
  return {
    language: lang,
    wordList: wordLists[lang],
    originalWord: '',
    currentWord: '',
    currentDashes: '',
    guesses: [],
    numRemaining: 6,
    makeDashes() {
      return '-'.repeat(this.originalWord.length);
    },
    newGame() {
      this.wordList = wordLists[this.language];
      this.originalWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
      this.currentWord = this.originalWord;
      this.currentDashes = this.makeDashes();
      this.guesses = [];
      this.numRemaining = 6;
    },
    tryGuess(letter) {
      letter = letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (this.guesses.includes(letter)) return null;
      this.guesses.push(letter);
      if (!this.currentWord.includes(letter)) {
        this.numRemaining--;
        return false;
      }
      let arr = this.currentDashes.split('');
      for (let i = 0; i < this.originalWord.length; i++) {
        if (this.originalWord[i] === letter) {
          arr[i] = letter;
          this.currentWord = this.currentWord.substr(0, i) + '_' + this.currentWord.substr(i + 1);
        }
      }
      this.currentDashes = arr.join('');
      return true;
    },
    giveHint() {
      const arr = this.currentDashes.split('');
      const hidden = arr.map((ch, i) => ch === '-' ? i : -1).filter(i => i >= 0);
      if (!hidden.length) return null;
      const idx = hidden[Math.floor(Math.random() * hidden.length)];
      const l = this.originalWord[idx];
      arr[idx] = l;
      this.currentDashes = arr.join('');
      this.guesses.push(l);
      this.currentWord = this.currentWord.substr(0, idx) + '_' + this.currentWord.substr(idx + 1);
      return l;
    },
    setLanguage(lang) {
      if (wordLists[lang]) {
        this.language = lang;
        return true;
      }
      return false;
    }
  };
}

// Launch venom-bot with the new headless mode and proper flags
venom
  .create({
    session: 'session-name',
    autoClose: false,
    allowBotMessages: true,
    browserArgs: [
      '--headless=new',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ],
    puppeteerOptions: {
      headless: true,
      executablePath: '/usr/bin/google-chrome-stable'
    }
  })

  .then(client => start(client))
  .catch(console.error);

const recentMessages = new Set();

function start(client) {
    client.onAnyMessage(async (msg) => {
        const id = msg.fromMe ? msg.to : msg.from;
        const uniqueKey = `${id}:${msg.body}`;
      
        if (recentMessages.has(uniqueKey)) return;
        recentMessages.add(uniqueKey);
      
        setTimeout(() => recentMessages.delete(uniqueKey), 1000);
      
        if (!msg.body || !msg.body.startsWith('!h')) return;

        const [_, cmd, ...rest] = msg.body.trim().split(' ');
        const arg = rest.join(' ');

        if (!sessions[id]) sessions[id] = createGame();
        if (!userStats[id]) userStats[id] = { wins: 0, losses: 0 };
        const game = sessions[id];

        switch (cmd) {
            case 'lang':
            if (game.setLanguage(arg)) {
                client.sendText(id, `🌐 Language set to *${arg === 'es' ? 'Español' : 'English'}*.`);
            } else {
                client.sendText(id, 'Usage: !h lang es|en');
            }
            break;

            case 'start':
            game.newGame();
            client.sendText(
                id,
                `🎉 New Hangman (${game.language})! 🎉\n` +
                `Word: ${game.currentDashes}\n` +
                `Guess: "!h guess <letter>", full word: "!h word <word>", hint: "!h hint".`
            );
            break;

            case 'guess':
            if (!arg) {
                client.sendText(id, '❗ Provide a letter: !h guess <letter>');
                break;
            }
            handleGuess(client, id, game, arg);
            break;

            case 'word':
            if (!arg) {
                client.sendText(id, '❗ Provide a word: !h word <word>');
                break;
            }
            if (arg.toLowerCase() === game.originalWord) {
                userStats[id].wins++;
                client.sendText(
                id,
                `🏆 Correct! The word was *${game.originalWord}*.\n` +
                `Record: ${userStats[id].wins}W/${userStats[id].losses}L`
                );
            } else {
                game.numRemaining--;
                if (game.numRemaining <= 0) {
                userStats[id].losses++;
                client.sendText(
                    id,
                    `💀 Game over! The word was *${game.originalWord}*.\n` +
                    `Record: ${userStats[id].wins}W/${userStats[id].losses}L`
                );
                } else {
                client.sendText(id, `❌ Wrong word! Remaining: ${game.numRemaining}\n` + hangmanTemplate(game.guesses));
                }
            }
            break;

            case 'hint':
            const h = game.giveHint();
            if (!h) {
                client.sendText(id, '💡 No more hints!');
            } else {
                client.sendText(id, `💡 Revealed letter *${h}*!\nWord: ${game.currentDashes}`);
            }
            break;

            case 'status':
            client.sendText(
                id,
                `🔎 Status:\nWord: ${game.currentDashes}\n` +
                `Guesses: ${game.guesses.join(', ') || 'none'}\n` +
                `Remaining: ${game.numRemaining}`
            );
            break;

            case 'score':
            client.sendText(id, `📊 Record: ${userStats[id].wins}W/${userStats[id].losses}L`);
            break;

            case 'help':
            default:
            client.sendText(
                id,
                '*Hangman Commands:*\n' +
                '!h lang es|en   – switch language\n' +
                '!h start        – new game\n' +
                '!h guess <l>    – guess a letter\n' +
                '!h word <w>     – guess full word\n' +
                '!h hint         – reveal a letter\n' +
                '!h status       – current game status\n' +
                '!h score        – your win/loss record\n' +
                '!h help         – this menu'
            );
            break;
        }
    });

}

function handleGuess(client, id, game, letter) {
  const res = game.tryGuess(letter);
  if (res === null) {
    client.sendText(id, '⚠️ Already tried that letter.');
  } else if (res) {
    client.sendText(id, `✅ Nice! ${game.currentDashes}`);
  } else {
    if (game.numRemaining > 0) {
      client.sendText(id, `❌ Nope! Remaining: ${game.numRemaining}\n` + hangmanTemplate(game.guesses));
    } else {
      userStats[id].losses++;
      client.sendText(
        id,
        `💀 Game over! The word was *${game.originalWord}*.\n` +
        `Record: ${userStats[id].wins}W/${userStats[id].losses}L\n` +
        hangmanTemplate(game.guesses)
      );
    }
  }
}
