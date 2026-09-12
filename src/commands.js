const config = require('./config');
const { getDb, saveDb, generateKeyCode } = require('./database');

async function handleCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith('@g.us');
  const sender = msg.key.participant || msg.key.remoteJid;
  
  const textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
  if (!textMessage.startsWith(config.prefix)) return;

  const args = textMessage.slice(config.prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const db = getDb();

  switch (command) {
    // ==========================================
    // 👨‍💻 COMANDOS EXCLUSIVOS DO DESENVOLVEDOR (DEV)
    // ==========================================

    case 'nome': {
      if (sender !== config.ownerNumber) {
        return sock.sendMessage(from, { text: "❌ Comando exclusivo para o Desenvolvedor!" });
      }

      const novoNome = args.join(" ");
      if (!novoNome) {
        return sock.sendMessage(from, { text: "⚠️ Use: *.nome Novo Nome do Bot*" });
      }

      try {
        await sock.updateProfileName(novoNome);
        await sock.sendMessage(from, { text: `✅ Nome alterado para: *${novoNome}*` });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(from, { text: "❌ Erro ao alterar o nome do perfil." });
      }
      break;
    }

    case 'foto': {
      if (sender !== config.ownerNumber) {
        return sock.sendMessage(from, { text: "❌ Comando exclusivo para o Desenvolvedor!" });
      }

      const isQuotedImage = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      const isDirectImage = msg.message?.imageMessage;

      if (!isDirectImage && !isQuotedImage) {
        return sock.sendMessage(from, { text: "⚠️ Envie ou responda a uma foto com o comando *.foto*" });
      }

      try {
        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
        const mediaMsg = isQuotedImage 
          ? { message: msg.message.extendedTextMessage.contextInfo.quotedMessage }
          : msg;

        const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {});
        await sock.updateProfilePicture(sock.user.id, buffer);

        await sock.sendMessage(from, { text: "✅ Foto de perfil atualizada com sucesso!" });
      } catch (err) {
        console.error(err);
        await sock.sendMessage(from, { text: "❌ Erro ao atualizar a foto de perfil." });
      }
      break;
    }

    case 'keygen': {
      if (sender !== config.ownerNumber) {
        return sock.sendMessage(from, { text: "❌ Comando exclusivo para o Desenvolvedor!" });
      }

      const dias = parseInt(args[0]);
      if (!dias || isNaN(dias)) {
        return sock.sendMessage(from, { text: "⚠️ Use: *.keygen <dias>*\nExemplo: *.keygen 30*" });
      }

      const newKey = generateKeyCode();
      db.keys.push({
        key: newKey,
        duracaoDias: dias,
        status: 'disponivel',
        criadaEm: new Date().toISOString(),
        resgatadaPor: null,
        expiraEm: null,
        grupoId: null
      });

      saveDb(db);

      const response = `╭━━〔 🔑 NOVA KEY 〕━━╮\n` +
        `┃\n` +
        `┃ 🔐 Key:\n` +
        `┃ ${newKey}\n` +
        `┃\n` +
        `┃ 📦 Plano: ${dias} dias\n` +
        `┃ 📌 Status: DISPONÍVEL\n` +
        `┃\n` +
        `┃ ⏳ Validade: ${dias} dias\n` +
        `╰━━━━━━━━━━━━━━━━━━╯`;

      await sock.sendMessage(from, { text: response });
      break;
    }

    case 'keys': {
      if (sender !== config.ownerNumber) {
        return sock.sendMessage(from, { text: "❌ Comando exclusivo para o Desenvolvedor!" });
      }

      const disponiveis = db.keys.filter(k => k.status === 'disponivel').length;
      const ativas = db.keys.filter(k => k.status === 'ativa' && new Date(k.expiraEm) > new Date()).length;
      const expiradas = db.keys.filter(k => k.status === 'ativa' && new Date(k.expiraEm) <= new Date()).length;

      let listaText = `╭━━〔 🔑 KEYS ZYPHOR BOT 〕━━╮\n` +
        `┃\n` +
        `┃ 📊 DISPONÍVEIS: ${disponiveis}\n` +
        `┃ 🔵 ATIVAS: ${ativas}\n` +
        `┃ 🔴 EXPIRADAS: ${expiradas}\n` +
        `┃\n` +
        `┃ ─────────────────\n`;

      db.keys.slice(-10).forEach(k => {
        let statusTag = '🟢';
        let detail = 'DISPONÍVEL';

        if (k.status === 'ativa') {
          const diasRestantes = Math.ceil((new Date(k.expiraEm) - new Date()) / (1000 * 60 * 60 * 24));
          if (diasRestantes > 0) {
            statusTag = '🔵';
            detail = `${diasRestantes} dias restantes`;
          } else {
            statusTag = '🔴';
            detail = 'EXPIRADA';
          }
        }

        listaText += `┃ ${statusTag} ${k.key}\n┃ ${k.duracaoDias} dias • ${detail}\n┃\n`;
      });

      listaText += `╰━━━━━━━━━━━━━━━━━━━━━━╯`;
      await sock.sendMessage(from, { text: listaText });
      break;
    }

    case 'keyinfo': {
      if (sender !== config.ownerNumber) {
        return sock.sendMessage(from, { text: "❌ Comando exclusivo para o Desenvolvedor!" });
      }

      const targetKey = args[0];
      if (!targetKey) return sock.sendMessage(from, { text: "⚠️ Use: *.keyinfo <KEY>*" });

      const k = db.keys.find(key => key.key === targetKey);
      if (!k) return sock.sendMessage(from, { text: "❌ Key não encontrada no banco de dados." });

      const userTag = k.resgatadaPor ? `@${k.resgatadaPor.split('@')[0]}` : 'Ninguém';
      const ativacaoStr = k.expiraEm ? new Date(new Date(k.expiraEm).getTime() - (k.duracaoDias * 24 * 60 * 60 * 1000)).toLocaleDateString('pt-BR') : 'N/A';
      const expiraStr = k.expiraEm ? new Date(k.expiraEm).toLocaleDateString('pt-BR') : 'N/A';

      const infoText = `🔑 *INFORMAÇÕES DA KEY*\n\n` +
        `📌 Status: ${k.status.toUpperCase()}\n` +
        `📦 Plano: ${k.duracaoDias} dias\n\n` +
        `👤 Cliente: ${userTag}\n` +
        `👥 Grupo ID: ${k.grupoId || 'Não vinculado'}\n\n` +
        `📅 Ativada: ${ativacaoStr}\n` +
        `⏳ Expira: ${expiraStr}`;

      await sock.sendMessage(from, { text: infoText, mentions: k.resgatadaPor ? [k.resgatadaPor] : [] });
      break;
    }

    case 'keydel': {
      if (sender !== config.ownerNumber) {
        return sock.sendMessage(from, { text: "❌ Comando exclusivo para o Desenvolvedor!" });
      }

      const targetKey = args[0];
      if (!targetKey) return sock.sendMessage(from, { text: "⚠️ Use: *.keydel <KEY>*" });

      const index = db.keys.findIndex(k => k.key === targetKey);
      if (index === -1) return sock.sendMessage(from, { text: "❌ Key não encontrada." });

      db.keys.splice(index, 1);
      saveDb(db);

      await sock.sendMessage(from, { text: `✅ Key *${targetKey}* removida com sucesso!` });
      break;
    }

    case 'grupos': {
      if (sender !== config.ownerNumber) {
        return sock.sendMessage(from, { text: "❌ Comando exclusivo para o Desenvolvedor!" });
      }

      const todosGrupos = await sock.groupFetchAllParticipating();
      const idsGrupos = Object.keys(todosGrupos);

      await sock.sendMessage(from, { text: `🔍 Analisando ${idsGrupos.length} grupos...` });

      let mantidos = 0;
      let removidos = 0;

      for (const id of idsGrupos) {
        const temKey = db.keys.some(k => k.grupoId === id && new Date(k.expiraEm) > new Date());

        if (!temKey) {
          removidos++;
          const aviso = `╭━━〔 🔴 LICENÇA EXPIRADA 〕━━╮\n` +
            `┃\n` +
            `┃ Este grupo não possui uma licença ativa.\n` +
            `┃ O bot será removido automaticamente.\n` +
            `┃\n` +
            `┃ 👨‍💻 DEV: +55 12 98862-5367\n` +
            `┃ 📢 Canal: ${config.officialLinks.channel}\n` +
            `╰━━━━━━━━━━━━━━━━━━━━━━╯`;

          try {
            await sock.sendMessage(id, { text: aviso });
            await new Promise(r => setTimeout(r, 2000));
            await sock.groupLeave(id);
          } catch (e) {
            console.error(`Erro ao sair do grupo ${id}:`, e);
          }
        } else {
          mantidos++;
        }
      }

      await sock.sendMessage(from, { 
        text: `✅ *Varredura Concluída!*\n\n🟢 Mantidos: ${mantidos}\n🔴 Removidos: ${removidos}` 
      });
      break;
    }

    // ==========================================
    // 👤 COMANDOS DO CLIENTE / GRUPO
    // ==========================================

    case 'resgatar': {
      if (isGroup) {
        return sock.sendMessage(from, { 
          text: "⚠️ Para sua segurança, resgate a Key conversando diretamente no meu *PRIVADO*!" 
        });
      }

      const keyInput = args[0];
      if (!keyInput) return sock.sendMessage(from, { text: "⚠️ Use: *.resgatar ZY-XXXX-XXXX-XXXX*" });

      const keyIndex = db.keys.findIndex(k => k.key === keyInput);

      if (keyIndex === -1) {
        return sock.sendMessage(from, { text: "❌ Key inválida. Verifique se digitou corretamente." });
      }

      const keyData = db.keys[keyIndex];

      if (keyData.status === 'ativa') {
        return sock.sendMessage(from, { 
          text: `❌ *ESSA KEY JÁ FOI UTILIZADA!*\n\n🔑 Key: ${keyData.key}\n📌 Status: ATIVA` 
        });
      }

      const agora = new Date();
      const expiracao = new Date(agora.getTime() + keyData.duracaoDias * 24 * 60 * 60 * 1000);

      keyData.status = "ativa";
      keyData.resgatadaPor = sender;
      keyData.expiraEm = expiracao.toISOString();
      saveDb(db);

      const resposta = `╭━━〔 🧟 ZYPHOR BOT 〕━━╮\n` +
        `┃\n` +
        `┃ 🔑 KEY ATIVADA!\n` +
        `┃\n` +
        `┃ ✅ Licença validada.\n` +
        `┃\n` +
        `┃ 📦 Plano: ${keyData.duracaoDias} dias\n` +
        `┃ 👤 Cliente: @${sender.split('@')[0]}\n` +
        `┃\n` +
        `┃ 📅 Ativada: ${agora.toLocaleDateString('pt-BR')}\n` +
        `┃ ⏳ Expira: ${expiracao.toLocaleDateString('pt-BR')}\n` +
        `┃\n` +
        `┃ ⚠️ Agora adicione o bot\n` +
        `┃ ao seu grupo e configure-o.\n` +
        `┃\n` +
        `┃ 📢 Canal oficial\n` +
        `┃ ${config.officialLinks.channel}\n` +
        `┃\n` +
        `┃ 👥 Grupo oficial\n` +
        `┃ ${config.officialLinks.group}\n` +
        `╰━━━━━━━━━━━━━━━━━━╯`;

      await sock.sendMessage(from, { text: resposta, mentions: [sender] });
      break;
    }

    case 'vincular': {
      if (!isGroup) {
        return sock.sendMessage(from, { text: "❌ Este comando deve ser usado dentro do grupo que deseja ativar!" });
      }

      const keyAtivaDoUsuario = db.keys.find(k => k.resgatadaPor === sender && k.status === 'ativa' && !k.grupoId && new Date(k.expiraEm) > new Date());

      if (!keyAtivaDoUsuario) {
        return sock.sendMessage(from, { text: "❌ Você não possui nenhuma Key ativa pendente de vinculação." });
      }

      keyAtivaDoUsuario.grupoId = from;
      saveDb(db);

      await sock.sendMessage(from, { 
        text: `✅ *GRUPO VINCULADO COM SUCESSO!*\n\nO bot foi autorizado a funcionar neste grupo até *${new Date(keyAtivaDoUsuario.expiraEm).toLocaleDateString('pt-BR')}*.` 
      });
      break;
    }

    case 'menu': {
      const menuText = `╭━━〔 🧟 ZYPHOR BOT 〕━━╮\n` +
        `┃\n` +
        `┃ 📋 *COMANDOS DISPONÍVEIS*\n` +
        `┃\n` +
        `┃ 🔑 *.resgatar <KEY>* (No PV)\n` +
        `┃ 🔗 *.vincular* (No Grupo)\n` +
        `┃ 📜 *.status* (Status do grupo)\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━━━╯`;
      await sock.sendMessage(from, { text: menuText });
      break;
    }

    case 'status': {
      if (!isGroup) return sock.sendMessage(from, { text: "❌ Comando para grupos." });

      const keyDoGrupo = db.keys.find(k => k.grupoId === from && new Date(k.expiraEm) > new Date());

      if (!keyDoGrupo) {
        return sock.sendMessage(from, { text: "⚠️ Este grupo *não possui* uma licença ativa." });
      }

      const expiraStr = new Date(keyDoGrupo.expiraEm).toLocaleDateString('pt-BR');
      await sock.sendMessage(from, { 
        text: `🟢 *GRUPO LICENCIADO*\n\n📅 Vencimento: ${expiraStr}\n📦 Plano: ${keyDoGrupo.duracaoDias} dias` 
      });
      break;
    }
  }
}

module.exports = { handleCommand };
