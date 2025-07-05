// --- index.js ---
// Importar módulos necesarios
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const bodyParser = require('body-parser'); // Para parsear datos POST (opcional)

// Crear instancia del cliente de WhatsApp con autenticación local (guarda sesión)
const client = new Client({
    authStrategy: new LocalAuth()  // Guarda la sesión para no escanear QR cada vez :contentReference[oaicite:0]{index=0}
});

// Mostrar QR en consola para vincular WhatsApp
client.on('qr', qr => {
    // Generar y mostrar el QR code en la terminal (texto)
    qrcode.generate(qr, { small: true });  // Escanea este código con tu teléfono :contentReference[oaicite:1]{index=1}
    console.log('Escanea el código QR above con WhatsApp para autenticación.');
});

// Confirmar cuando el cliente esté listo
client.on('ready', () => {
    console.log('✅ Cliente de WhatsApp listo (conectado).');
});

// Iniciar el cliente (esto abre una instancia de WhatsApp Web en segundo plano)
client.initialize();

// Configurar servidor web Express
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));  // parsear formulario (application/x-www-form-urlencoded)

// Servir la página HTML principal
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Ruta para procesar el envío de mensaje (desde el formulario)
app.post('/send', (req, res) => {
    const numero = req.body.number;      // Número de destino (puede incluir +)
    const mensaje = req.body.message;    // Texto del mensaje
    const horaEnvio = req.body.datetime; // Hora programada (formato ISO de input datetime-local)

    // Formatear chatId requerido por whatsapp-web.js
    // Eliminar '+' al inicio (si existe) y agregar sufijo "@c.us"
    const chatId = numero.replace(/\D/g, '');  // quitar cualquier caracter no dígito (ej. '+')
    const destinatario = chatId + '@c.us';     // formatear como ID de chat de WhatsApp:contentReference[oaicite:2]{index=2}

    // Función para enviar mensaje (verifica que cliente esté listo)
    const enviarMensaje = () => {
        if (mensaje && destinatario) {
            client.sendMessage(destinatario, mensaje)
                .then(() => console.log(`Mensaje enviado a ${destinatario}`))
                .catch(err => console.error('Error enviando mensaje:', err));
        }
    };

    // Programar el envío si se especificó una hora futura
    if (horaEnvio) {
        const hora = new Date(horaEnvio);
        const ahora = new Date();
        if (hora.getTime() > ahora.getTime()) {
            const delay = hora.getTime() - ahora.getTime();
            setTimeout(() => {
                enviarMensaje();
            }, delay);
            res.send(`✅ Mensaje programado para ${hora.toLocaleString()}.`);
            console.log(`Mensaje programado para ${hora.toLocaleString()}.`);
        } else {
            // Si la hora es pasada o igual al presente, enviar inmediatamente
            enviarMensaje();
            res.send('✅ Mensaje enviado inmediatamente (hora programada pasada o no válida).');
        }
    } else {
        // Sin hora especificada: enviar de inmediato
        enviarMensaje();
        res.send('✅ Mensaje enviado inmediatamente.');
    }
});

// Iniciar servidor en puerto 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor web iniciado en http://localhost:${PORT}`);
});
