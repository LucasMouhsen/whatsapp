// index.js con persistencia de mensajes programados

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'mensajesProgramados.json');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('📱 Escaneá el código QR');
});

client.on('ready', () => {
    console.log('✅ Cliente de WhatsApp listo');
});

client.initialize();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/contactos', express.static(path.join(__dirname, 'contactos.json')));

// Leer base de datos si existe, o crear si no
let mensajesProgramados = [];
if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    try {
        mensajesProgramados = JSON.parse(data);
    } catch (err) {
        console.error('❌ Error al parsear mensajesProgramados.json:', err);
    }
} else {
    fs.writeFileSync(DB_FILE, '[]');
    console.log('🆕 Archivo mensajesProgramados.json creado.');
}

// Guardar en archivo
function guardarMensajes() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(mensajesProgramados, null, 2));
        console.log('📝 mensajesProgramados.json guardado con éxito');
    } catch (err) {
        console.error('❌ Error al guardar el archivo JSON:', err);
    }
}

// Reprogramar mensajes pendientes al iniciar
function reprogramarMensajesPendientes() {
    const ahora = new Date();

    for (const registro of mensajesProgramados) {
        const hora = new Date(registro.datetime);

        if (hora > ahora && registro.estado === 'Programado') {
            const delay = hora - ahora;

            console.log(`⏳ Reprogramando mensaje para ${registro.numero} a las ${hora.toLocaleString()}`);

            setTimeout(async () => {
                try {
                    await client.sendMessage(registro.numero, registro.mensaje);
                    registro.estado = 'Enviado';
                    console.log(`✅ Mensaje reenviado a ${registro.numero}`);
                } catch (err) {
                    registro.estado = 'Error';
                    console.error(`❌ Error al reenviar mensaje a ${registro.numero}:`, err);
                }

                guardarMensajes();
            }, delay);
        }
    }
}

reprogramarMensajesPendientes();

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/send', async (req, res) => {
    let number = (req.body.number || '').replace(/\D/g, '');
    const message = req.body.message || '';
    const datetime = req.body.datetime;

    // ✅ Agregar el 9 si es Argentina y no empieza con 549
    if (number.startsWith('54') && !number.startsWith('549')) {
        number = '549' + number.slice(2);
    }

    const chatId = `${number}@c.us`;

    try {
        const isRegistered = await client.isRegisteredUser(chatId);
        if (!isRegistered) {
            return res.status(400).send('❌ El número no está registrado en WhatsApp.');
        }

        const enviarMensaje = async () => {
            await client.sendMessage(chatId, message);
            console.log(`✅ Mensaje enviado a ${chatId}`);
        };

        if (datetime) {
            const hora = new Date(datetime);
            const ahora = new Date();

            if (hora > ahora) {
                const delay = hora - ahora;

                const registro = {
                    numero: chatId,
                    mensaje: message,
                    datetime: hora.toISOString(),
                    creado: new Date().toISOString(),
                    estado: 'Programado'
                };

                mensajesProgramados.push(registro);
                guardarMensajes();

                setTimeout(async () => {
                    try {
                        await enviarMensaje();
                        registro.estado = 'Enviado';
                    } catch (err) {
                        registro.estado = 'Error';
                        console.error('❌ Error al enviar mensaje programado:', err);
                    }
                    guardarMensajes();
                }, delay);

                return res.send(`⏳ Mensaje programado para ${hora.toLocaleString()}.`);
            }
        }

        try {
            await enviarMensaje();
            mensajesProgramados.push({
                numero: chatId,
                mensaje: message,
                datetime: new Date().toISOString(),
                creado: new Date().toISOString(),
                estado: 'Enviado'
            });
            guardarMensajes();
            res.send('✅ Mensaje enviado inmediatamente.');
        } catch (error) {
            mensajesProgramados.push({
                numero: chatId,
                mensaje: message,
                datetime: new Date().toISOString(),
                creado: new Date().toISOString(),
                estado: 'Error'
            });
            guardarMensajes();
            console.error('❌ Error al enviar mensaje inmediatamente:', error);
            res.status(500).send('❌ Ocurrió un error al enviar el mensaje.');
        }
    } catch (error) {
        console.error('❌ Error general en /send:', error);
        res.status(500).send('❌ Error interno del servidor.');
    }
});

app.get('/programados', (req, res) => {
    let html = `
    <html>
    <head>
        <title>Mensajes Programados</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.0/css/bootstrap.min.css" rel="stylesheet">
        <style>
            .estado-programado { color: #0d6efd; }
            .estado-enviado { color: #198754; }
            .estado-error { color: #dc3545; }
        </style>
    </head>
    <body class="bg-light">
        <div class="container py-4">
            <h1 class="mb-4 text-center">📅 Mensajes Programados</h1>
            <table class="table table-bordered table-hover">
                <thead class="table-secondary">
                    <tr>
                        <th>Número</th>
                        <th>Mensaje</th>
                        <th>Fecha Programada</th>
                        <th>Fecha de Creación</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>`;

    if (mensajesProgramados.length === 0) {
        html += `<tr><td colspan="5" class="text-center text-muted">No hay mensajes registrados.</td></tr>`;
    } else {
        for (const msg of mensajesProgramados) {
            const estadoIcono = msg.estado === 'Enviado' ? '✅' : msg.estado === 'Error' ? '❌' : '⏳';
            const estadoClase = msg.estado === 'Enviado' ? 'estado-enviado' : msg.estado === 'Error' ? 'estado-error' : 'estado-programado';

            html += `
                <tr>
                    <td>${msg.numero}</td>
                    <td>${msg.mensaje}</td>
                    <td>${new Date(msg.datetime).toLocaleString()}</td>
                    <td>${new Date(msg.creado).toLocaleString()}</td>
                    <td class="${estadoClase}">${estadoIcono} ${msg.estado || 'Desconocido'}</td>
                </tr>`;
        }
    }

    html += `</tbody>
            </table>
            <div class="text-center">
                <a href="/" class="btn btn-outline-primary">⬅ Volver al inicio</a>
            </div>
        </div>
    </body>
    </html>`;

    res.send(html);
});

app.get('/contactos', (req, res) => {
    const contactosPath = path.join(__dirname, 'contactos.json');
    if (fs.existsSync(contactosPath)) {
        const data = fs.readFileSync(contactosPath, 'utf-8');
        res.json(JSON.parse(data));
    } else {
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
