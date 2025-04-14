import express from 'express';
import { google } from 'googleapis';
import open from 'open';
import fs from 'fs';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// Configuración de rutas de archivos para módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicialización de Express
const app = express();
const port = 3000;

// Configuración de credenciales OAuth 2.0
const CLIENT_ID = 'YOUR_CLIENT_ID'; // Reemplazar con tu Client ID de Google Cloud
const CLIENT_SECRET = 'YOUR_CLIENT_SECRET'; // Reemplazar con tu Client Secret
const REDIRECT_URI = 'http://localhost:3000/oauth2callback'; // URI de redirección autorizada
const TOKEN_PATH = path.join(__dirname, 'token.json'); // Ruta para guardar el token de acceso

// Creación del cliente OAuth2
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Scopes (permisos) requeridos por la aplicación
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly', // Acceso de solo lectura a Drive
  'https://www.googleapis.com/auth/calendar', // Acceso completo a Calendar
];

// Verificar si existe un token guardado y cargarlo
if (fs.existsSync(TOKEN_PATH)) {
  const savedToken = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oAuth2Client.setCredentials(savedToken);
  ejecutarFlujo(oAuth2Client); // Iniciar flujo principal si ya está autenticado
}

// Ruta principal - Redirige al usuario a la página de autenticación de Google
app.get('/', (req, res) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline', // Para obtener refresh token
    scope: SCOPES, // Permisos solicitados
  });
  res.redirect(authUrl); // Redirección a Google OAuth
});

// Ruta de callback - Google redirige aquí después de la autenticación
app.get('/oauth2callback', async (req, res) => {
  const code = req.query.code; // Código de autorización
  try {
    // Intercambiar código por tokens de acceso
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    // Guardar tokens para uso futuro
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.send('✅ Autenticación exitosa. Puedes volver a la consola.');
  } catch (error) {
    console.error('❌ Error al obtener el token:', error);
    res.send('Error al generar el token.');
  }
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🔗 Abriendo autenticación en: http://localhost:${port}`);
  open(`http://localhost:${port}`); // Abrir navegador automáticamente
});

/**
 * Flujo principal de la aplicación
 * @param {Object} auth - Cliente autenticado de Google
 */
async function ejecutarFlujo(auth) {
  await createMeeting(auth); // 1. Crear evento en Calendar
  await buscarVideoDrive(auth); // 2. Buscar videos en Drive
  await editarEventoConsola(auth); // 3. Permitir edición de eventos
}

/**
 * Crea un nuevo evento en Google Calendar con Meet
 * @param {Object} auth - Cliente autenticado
 */
async function createMeeting(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  // Configuración del evento
  const evento = {
    summary: 'Ejemplo de API', // Título del evento
    description: 'Esta reunión fue creada automáticamente desde una app con Google Calendar API.',
    start: {
      dateTime: new Date(Date.now() + 3 * 60000).toISOString(), // 3 minutos en el futuro
      timeZone: 'America/Bogota', // Zona horaria
    },
    end: {
      dateTime: new Date(Date.now() + 4 * 60000).toISOString(), // 4 minutos en el futuro (dura 1 minuto)
      timeZone: 'America/Bogota',
    },
    conferenceData: { // Configuración de Google Meet
      createRequest: {
        requestId: `meet-${Date.now()}`, // ID único para la reunión
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
    attendees: [ // Lista de invitados
      { email: 'SOPORTEUVE@americana.edu.co' },
      { email: 'mantillaalberto@americana.edu.co' }
    ],
  };

  try {
    // Insertar evento en el calendario principal
    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: evento,
      conferenceDataVersion: 1, // Habilitar creación de Meet
    });

    // Extraer enlaces importantes
    const htmlLink = response.data.htmlLink; // Enlace al evento en Calendar
    const meetLink = response.data.conferenceData.entryPoints?.[0]?.uri; // Enlace de Meet

    console.log('\n✅ Evento creado correctamente');
    console.log('📅 Ver evento en Calendar:', htmlLink);
    console.log('📹 Enlace de Google Meet:', meetLink);
  } catch (error) {
    console.error('❌ Error al crear el evento:', error);
  }
}

/**
 * Busca videos en Google Drive que coincidan con criterios específicos
 * @param {Object} auth - Cliente autenticado
 */
async function buscarVideoDrive(auth) {
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Consulta para buscar archivos de video MP4 con nombre específico
    const res = await drive.files.list({
      q: "mimeType='video/mp4' and name contains 'Ejemplo de API'", // Query de búsqueda
      fields: 'files(id, name, webViewLink, createdTime)', // Campos a devolver
      orderBy: 'createdTime desc', // Ordenar por fecha de creación (más nuevos primero)
      pageSize: 10, // Límite de resultados
    });

    const archivos = res.data.files;

    if (!archivos.length) {
      console.log('🚫 No se encontraron videos que coincidan con los criterios.');
    } else {
      console.log('\n🎥 Grabaciones encontradas:');
      archivos.forEach(file => {
        console.log(`📁 ${file.name}`); // Nombre del archivo
        console.log(`🔗 Ver: ${file.webViewLink}`); // Enlace de visualización
        console.log(`🕒 Fecha: ${file.createdTime}`); // Fecha de creación
        console.log('-----------------------');
      });
    }
  } catch (error) {
    console.error('❌ Error al buscar videos en Drive:', error);
  }
}

/**
 * Interfaz para editar eventos existentes desde la consola
 * @param {Object} auth - Cliente autenticado
 */
async function editarEventoConsola(auth) {
  const calendar = google.calendar({ version: 'v3', auth });

  try {
    // Obtener lista de eventos futuros
    const result = await calendar.events.list({
      calendarId: 'primary', // Calendario principal
      timeMin: new Date().toISOString(), // Eventos desde ahora
      maxResults: 2500, // Límite de eventos
      singleEvents: true, // Expandir eventos recurrentes
      orderBy: 'startTime', // Ordenar por fecha
    });

    const eventos = result.data.items;

    if (!eventos.length) {
      console.log('\n📭 No hay eventos para editar.');
      return;
    }

    // Mostrar lista numerada de eventos
    console.log('\n📅 Lista de eventos:');
    eventos.forEach((evento, index) => {
      console.log(`${index + 1}. ${evento.summary} (${evento.start?.dateTime || 'Sin hora'})`);
    });

    // Configurar interfaz de línea de comandos
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Solicitar selección y datos de edición
    rl.question('\nSelecciona el número del evento que deseas editar: ', (numero) => {
      const evento = eventos[parseInt(numero) - 1]; // Evento seleccionado

      rl.question('Nuevo título del evento: ', (summary) => {
        rl.question('Nueva fecha de inicio (YYYY-MM-DDTHH:MM): ', (start) => {
          rl.question('Nueva fecha de fin (YYYY-MM-DDTHH:MM): ', async (end) => {
            try {
              // Actualizar evento con los nuevos datos
              await calendar.events.patch({
                calendarId: 'primary',
                eventId: evento.id,
                resource: {
                  summary: summary, // Nuevo título
                  start: {
                    dateTime: new Date(start).toISOString(), // Nueva fecha inicio
                    timeZone: 'America/Bogota',
                  },
                  end: {
                    dateTime: new Date(end).toISOString(), // Nueva fecha fin
                    timeZone: 'America/Bogota',
                  },
                },
              });

              console.log('\n✅ Evento actualizado correctamente.');
            } catch (error) {
              console.error('❌ Error al actualizar evento:', error);
            }
            rl.close(); // Cerrar interfaz
          });
        });
      });
    });
  } catch (error) {
    console.error('❌ Error al listar eventos:', error);
  }
}