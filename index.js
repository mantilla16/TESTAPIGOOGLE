import express from 'express';
import { google } from 'googleapis';
import open from 'open';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Credenciales
const CLIENT_ID = 'YOUR_CLIENT_ID';
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET';
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const TOKEN_PATH = path.join(__dirname, 'token.json');

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/calendar',
];

if (fs.existsSync(TOKEN_PATH)) {
  const savedToken = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(savedToken);
  ejecutarFlujo(oAuth2Client);
}

app.get('/', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.send('✅ Autenticación exitosa. Puedes volver a la consola.');
  } catch (error) {
    console.error('❌ Error al obtener el token:', error);
    res.send('Error al generar el token.');
  }
});

app.listen(port, () => {
  console.log(`🔗 Abriendo autenticación en: http://localhost:${port}`);
  open(`http://localhost:${port}`);
});

// Flujo principal
async function ejecutarFlujo(auth) {
  await createMeeting(auth);
  await buscarVideoDrive(auth);
  await editarEventoConsola(auth);
}

// Crear evento
async function createMeeting(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  const evento = {
    summary: 'Ejemplo de API',
    description: 'Esta reunión fue creada automáticamente desde una app con Google Calendar API.',
    start: {
      dateTime: new Date(Date.now() + 3 * 60000).toISOString(),
      timeZone: 'America/Bogota',
    },
    end: {
      dateTime: new Date(Date.now() + 4 * 60000).toISOString(),
      timeZone: 'America/Bogota',
    },
    conferenceData: {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: [
      { email: 'SOPORTEUVE@americana.edu.co' },
      { email: 'mantillaalberto@americana.edu.co' }
    ],
  };

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: evento,
      conferenceDataVersion: 1,
    });

    const htmlLink = response.data.htmlLink;
    const meetLink = response.data.conferenceData.entryPoints?.[0]?.uri;

    console.log('\n✅ Evento creado correctamente');
    console.log('📅 Ver evento en Calendar:', htmlLink);
    console.log('📹 Enlace de Google Meet:', meetLink);
  } catch (error) {
    console.error('❌ Error al crear el evento:', error);
  }
}

// Buscar videos
async function buscarVideoDrive(auth) {
  const drive = google.drive({ version: 'v3', auth });

  try {
    const res = await drive.files.list({
      q: "mimeType='video/mp4' and name contains 'Ejemplo de API'",
      fields: 'files(id, name, webViewLink, createdTime)',
      orderBy: 'createdTime desc',
      pageSize: 10,
    });

    const archivos = res.data.files;

    if (!archivos.length) {
      console.log('🚫 No se encontraron videos que coincidan con los criterios.');
    } else {
      console.log('\n🎥 Grabaciones encontradas:');
      archivos.forEach(file => {
        console.log(`📁 ${file.name}`);
        console.log(`🔗 Ver: ${file.webViewLink}`);
        console.log(`🕒 Fecha: ${file.createdTime}`);
        console.log('-----------------------');
      });
    }
  } catch (error) {
    console.error('❌ Error al buscar videos en Drive:', error);
  }
}

// Editar eventos desde consola
async function editarEventoConsola(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 2500,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const eventos = result.data.items;

    if (!eventos.length) {
      console.log('\n📭 No hay eventos para editar.');
      return;
    }

    console.log('\n📅 Lista de eventos:');
    eventos.forEach((evento, index) => {
      console.log(`${index + 1}. ${evento.summary} (${evento.start?.dateTime || 'Sin hora'})`);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question('\nSelecciona el número del evento que deseas editar: ', (numero) => {
      const evento = eventos[parseInt(numero) - 1];

      rl.question('Nuevo título del evento: ', (summary) => {
        rl.question('Nueva fecha de inicio (YYYY-MM-DDTHH:MM): ', (start) => {
          rl.question('Nueva fecha de fin (YYYY-MM-DDTHH:MM): ', async (end) => {
            try {
              await calendar.events.patch({
                calendarId: 'primary',
                eventId: evento.id,
                resource: {
                  summary: summary,
                  start: {
                    dateTime: new Date(start).toISOString(),
                    timeZone: 'America/Bogota',
                  },
                  end: {
                    dateTime: new Date(end).toISOString(),
                    timeZone: 'America/Bogota',
                  },
                },
              });

              console.log('\n✅ Evento actualizado correctamente.');
            } catch (error) {
              console.error('❌ Error al actualizar evento:', error);
            }
            rl.close();
          });
        });
      });
    });
  } catch (error) {
    console.error('❌ Error al listar eventos:', error);
  }
}
