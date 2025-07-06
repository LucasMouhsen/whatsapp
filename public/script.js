document.addEventListener('DOMContentLoaded', async () => {
    const contactoSelect = document.getElementById('contacto');
    const numberInput = document.getElementById('number');
    const messageInput = document.getElementById('message');
    const datetimeInput = document.getElementById('datetime');
    const form = document.querySelector('form');
    const alerta = document.getElementById('alerta');

    const iti = window.intlTelInput(numberInput, {
        initialCountry: "ar",
        separateDialCode: true,
        utilsScript: "https://cdn.jsdelivr.net/npm/intl-tel-input@18.1.1/build/js/utils.js"
    });

    // Cargar contactos
    try {
        const res = await fetch('/contactos');
        const contactos = await res.json();

        // Ordenar alfabéticamente por nombre
        contactos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));

        contactos.forEach(contacto => {
            const option = document.createElement('option');
            option.value = contacto.numero;
            option.textContent = `${contacto.nombre} (${contacto.numero})`;
            contactoSelect.appendChild(option);
        });

        contactoSelect.addEventListener('change', () => {
            let numero = contactoSelect.value;
            if (!numero) return;

            // Quitar +54 o +549 si está presente
            if (numero.startsWith('549')) {
                numero = numero.slice(3);
            } else if (numero.startsWith('54')) {
                numero = numero.slice(2);
            }

            numberInput.value = numero;
        });

    } catch (err) {
        console.error('❌ Error al cargar contactos:', err);
    }

    // Mostrar alertas visuales (sin usar alert())
    function mostrarAlerta(tipo, mensaje) {
        alerta.className = `alert alert-${tipo}`;
        alerta.textContent = mensaje;
        alerta.classList.remove('d-none');
    }

    // Interceptar envío
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let fullNumber = iti.getNumber();

        // Normalización Argentina
        if (fullNumber.startsWith('+54') && !fullNumber.startsWith('+549')) {
            fullNumber = '+549' + fullNumber.slice(3);
        }

        const message = messageInput.value.trim();
        const datetime = datetimeInput.value;

        if (!fullNumber || !message) {
            mostrarAlerta('warning', '⚠️ Número y mensaje son obligatorios.');
            return;
        }

        const formData = new URLSearchParams();
        formData.append('number', fullNumber);
        formData.append('message', message);
        formData.append('datetime', datetime);

        try {
            const res = await fetch('/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData
            });

            const result = await res.text();

            if (res.ok) {
                mostrarAlerta('success', result);
                form.reset();
                contactoSelect.selectedIndex = 0;
                iti.setCountry('ar');
            } else {
                mostrarAlerta('danger', `❌ ${result}`);
            }
        } catch (err) {
            console.error('❌ Error al enviar:', err);
            mostrarAlerta('danger', '❌ Error al intentar enviar el mensaje.');
        }
    });
});
