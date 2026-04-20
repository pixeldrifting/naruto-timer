const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(cors());

// 👉 ARQUIVO QUE VAI SER ENVIADO
const FILE_PATH = path.join(__dirname, 'executar.txt');

let currentFileId = null;
let fileExists = false;

// ================= AUTH =================
function authorize() {
  if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.REFRESH_TOKEN) {
    throw new Error('Variáveis de ambiente não definidas');
  }

  const oAuth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );

  oAuth2Client.setCredentials({
    refresh_token: process.env.REFRESH_TOKEN,
  });

  return oAuth2Client;
}

// ================= START =================
app.get('/start', async (req, res) => {
  try {
    const auth = authorize();
    const drive = google.drive({ version: 'v3', auth });

    if (!fs.existsSync(FILE_PATH)) {
      console.error('❌ Arquivo não encontrado:', FILE_PATH);
      return res.status(400).send('arquivo não encontrado');
    }

    const response = await drive.files.create({
      requestBody: {
        name: 'executar.txt',
      },
      media: {
        mimeType: 'text/plain',
        body: fs.createReadStream(FILE_PATH),
      },
      fields: 'id',
    });

    currentFileId = response.data.id;
    fileExists = true;

    console.log('📤 Upload OK:', currentFileId);

    monitorFile(drive);

    res.send('uploaded');

  } catch (err) {
    console.error('❌ ERRO REAL:', err);
    res.status(500).send('erro');
  }
});

// ================= STATUS =================
app.get('/status', (req, res) => {
  res.json({ exists: fileExists });
});

// ================= MONITOR =================
function monitorFile(drive) {
  const interval = setInterval(async () => {
    if (!currentFileId) {
      clearInterval(interval);
      return;
    }

    try {
      const file = await drive.files.get({
        fileId: currentFileId,
        fields: 'trashed',
      });

      if (file.data.trashed) {
        fileExists = false;
        currentFileId = null;
        clearInterval(interval);
      }

    } catch (err) {
      console.error('Erro ao monitorar:', err.message);
      fileExists = false;
      currentFileId = null;
      clearInterval(interval);
    }
  }, 2000);
}

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});