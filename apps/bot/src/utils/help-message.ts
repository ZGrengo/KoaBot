/**
 * Returns the help message with available commands
 */
export function getHelpMessage(): string {
    return (
        '👋 ¡Hola! Soy el bot de gestión del restaurante.\n\n' +
        'Comandos disponibles:\n' +
        '/recepcion - Registrar una recepción (albarán)\n' +
        '/merma - Registrar merma\n' +
        '/produccion - Registrar producción\n' +
        '/reporte - Generar reporte en PDF\n' +
        '/undo - Deshacer última operación\n' +
        '/cancelar - Cancelar acción en curso\n\n' +
        'Usa los comandos para comenzar a registrar operaciones.\n' +
        'También puedes escribir "cancelar" durante cualquier conversación para cancelarla.'
    );
}

/**
 * Returns a message when the bot doesn't understand the input
 */
export function getUnknownMessage(): string {
    return (
        '😅 Disculpa, no te entiendo.\n\n' +
        'Por favor, usa uno de los comandos disponibles:\n\n' +
        '/recepcion - Registrar una recepción (albarán)\n' +
        '/merma - Registrar merma\n' +
        '/produccion - Registrar producción\n' +
        '/reporte - Generar reporte en PDF\n' +
        '/undo - Deshacer última operación\n' +
        '/cancelar - Cancelar acción en curso\n\n' +
        'Escribe /start para ver más información.'
    );
}

