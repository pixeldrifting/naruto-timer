const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(cors());

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// 👉 ARQUIVO QUE VAI SER ENVIADO
const FILE_PATH = path.join(__dirname, 'executar.txt');

let currentFileId = null;
let fileExists = false;

// ================= AUTH (COM TOKEN FIXO) =================
function authorize() {
  const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf-8'));
  const { client_secret, client_id } = credentials.web;

  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    'https://developers.google.com/oauthplayground'
  );

  // 👉 TOKEN VINDO DO RENDER
  oAuth2Client.setCredentials({
    access_token: process.env.ACCESS_TOKEN,
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
    console.error('❌ ERRO:', err);
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

    } catch {
      fileExists = false;
      currentFileId = null;
      clearInterval(interval);
    }
  }, 1000);
}

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
});