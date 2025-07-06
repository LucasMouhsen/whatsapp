// google-auth.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/contacts.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const CONTACTS_OUTPUT = path.join(__dirname, 'contactos.json');

function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
        const token = fs.readFileSync(TOKEN_PATH, 'utf-8');
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    } else {
        getNewToken(oAuth2Client, callback);
    }
}

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({ access_type: 'offline', scope: SCOPES });
    console.log('Authorize this app by visiting this URL:', authUrl);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
            callback(oAuth2Client);
        });
    });
}

function getContacts(auth) {
    const service = google.people({ version: 'v1', auth });
    service.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1000,
        personFields: 'names,phoneNumbers',
    }, (err, res) => {
        if (err) return console.error('API error:', err);
        const connections = res.data.connections || [];

        const contactos = connections
            .filter(person => person.names && person.phoneNumbers)
            .map(person => ({
                nombre: person.names[0].displayName,
                numero: person.phoneNumbers[0].value.replace(/\D/g, '')
            }));

        fs.writeFileSync(CONTACTS_OUTPUT, JSON.stringify(contactos, null, 2));
        console.log(`✅ ${contactos.length} contactos guardados en contactos.json`);
    });
}

function iniciar() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    authorize(credentials, getContacts);
}

// Ejecutar al correr el script
iniciar();
