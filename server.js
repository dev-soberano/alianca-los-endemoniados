const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json());

let sock = null;
let isConnected = false;

async function startBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Exibe o QR Code no terminal para conectar
    if (qr) {
      console.log('\n================================================--');
      console.log('⚡ ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:');
      console.log('================================================--\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`❌ Conexão fechada (${statusCode}). Reconectando: ${shouldReconnect}`);
      if (shouldReconnect) {
        startBaileys();
      } else {
        console.log('🔒 Sessão encerrada. Apague a pasta "auth_info_baileys" e rode o script novamente.');
      }
    } else if (connection === 'open') {
      isConnected = true;
      console.log('\n================================================--');
      console.log('✅ BAILEYS CONECTADO COM SUCESSO!');
      console.log('🚀 Pronto para verificar números no verban.html');
      console.log('================================================--\n');
    }
  });
}

// Inicializa o Baileys
startBaileys();

/**
 * Função de checagem inteligente com tratamento de 9º dígito do Brasil
 */
async function checarNumeroWhatsApp(phoneClean) {
  if (!sock || !isConnected) {
    return { error: 'Servidor Baileys ainda não está conectado. Escaneie o QR Code no terminal.' };
  }

  // Monta a lista de tentativas (trata 9º dígito no Brasil)
  let numerosParaTestar = [phoneClean];

  if (phoneClean.startsWith('55')) {
    const ddd = phoneClean.substring(2, 4);
    const numeroSemDdd = phoneClean.substring(4);

    if (numeroSemDdd.length === 9 && numeroSemDdd.startsWith('9')) {
      // Ex: 5563992944383 -> Testa também sem o 9º dígito: 556392944383
      const semNove = '55' + ddd + numeroSemDdd.substring(1);
      numerosParaTestar.push(semNove);
    } else if (numeroSemDdd.length === 8) {
      // Ex: 556392944383 -> Testa também com o 9º dígito: 5563992944383
      const comNove = '55' + ddd + '9' + numeroSemDdd;
      numerosParaTestar.push(comNove);
    }
  }

  // Faz a consulta na rede do WhatsApp
  for (const num of numerosParaTestar) {
    try {
      const [result] = await sock.onWhatsApp(num);
      if (result && result.exists) {
        return { banned: false, jid: result.jid };
      }
    } catch (err) {
      console.error(`Erro ao consultar ${num}:`, err.message);
    }
  }

  // Se nenhuma variação existir no WhatsApp = Banido / Não existe
  return { banned: true };
}

// Endpoint consumido pela página HTML verban.html
app.post('/api/check-number', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Número não fornecido' });
    }

    const cleanNum = phone.replace(/\D/g, '');
    console.log(`[VERBAN] Verificando número: +${cleanNum}`);

    const resultado = await checarNumeroWhatsApp(cleanNum);

    if (resultado.error) {
      return res.status(503).json({ error: resultado.error });
    }

    if (resultado.banned) {
      console.log(`[RESULTADO] +${cleanNum} => 🚫 BANIDO / CAIU`);
      return res.json({ status: 'BANNED', exists: false });
    } else {
      console.log(`[RESULTADO] +${cleanNum} => ✅ ATIVO (${resultado.jid})`);
      return res.json({ status: 'ACTIVE', exists: true });
    }

  } catch (error) {
    console.error('Erro no endpoint:', error);
    return res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});