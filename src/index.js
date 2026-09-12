const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const readline = require('readline');
const { handleCommand } = require('./commands');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false
  });

  if (!sock.authState.creds.registered) {
    console.log(`\n=================================`);
    const num = await question('📱 Digite o número do bot (ex: 5512988625367): ');
    const cleanNumber = num.replace(/[^0-9]/g, '');

    try {
      const code = await sock.requestPairingCode(cleanNumber);
      console.log(`\n🔑 CÓDIGO DE PAREAMENTO: ${code}`);
      console.log(`=================================\n`);
    } catch (err) {
      console.error("Erro ao gerar o Pairing Code:", err);
    }
  }

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ Zyphor Bot conectado e online!');
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;
    await handleCommand(sock, msg);
  });
}

connectToWhatsApp();
