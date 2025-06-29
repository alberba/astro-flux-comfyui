# ComfyUI-Web: Interfaz Web para ComfyUI

Este proyecto proporciona una interfaz web para interactuar con ComfyUI, permitiendo a los usuarios generar y gestionar imágenes de manera más accesible.

## 🚀 Estructura del Proyecto

El proyecto está construido con Astro y organiza sus componentes, páginas y lógica de la aplicación de la siguiente manera:

- `public/`: Contiene activos estáticos como imágenes y iconos.
- `src/components/`: Componentes Astro reutilizables para la interfaz de usuario.
- `src/layouts/`: Diseños de página para estructurar el contenido.
- `src/lib/`: Lógica de la aplicación, utilidades y manejo de estado.
- `src/pages/`: Páginas web de Astro, que definen las rutas de la aplicación.
- `src/styles/`: Estilos globales y configuraciones de Tailwind CSS.

## 🛠️ Configuración

Para conectarse con la API de ComfyUI, el proyecto utiliza una API Intermedia (la API utilizada es esta: [FastAPI with ComfyUI](https://github.com/alberba/API) ) que traduce las opciones elegidas al usuario y las envía a ComfyUI. Esta API Intermedia se configura a través de variables de entorno que definen las URLs base para la API y el WebSocket.

Crea los siguientes archivos en la raíz del proyecto:

- `.env`: Para variables de entorno de producción.
- `.env.development`: Para variables de entorno de desarrollo.

Aquí tienes un ejemplo de cómo deberían lucir estos archivos:

```bash
# .env
PUBLIC_API_URL_BASE= https://api.example.com
PUBLIC_WS_URL_BASE= ws://example.com

# .env.development
PUBLIC_API_URL_BASE= http://localhost:0000/api
PUBLIC_WS_URL_BASE= ws://localhost:0000/ws
```

## ⚙️ Comandos

Todos los comandos se ejecutan desde la raíz del proyecto en la terminal:

| Comando           | Acción                                                      |
| :---------------- | :---------------------------------------------------------- |
| `npm install`     | Instala las dependencias del proyecto.                      |
| `npm run dev`     | Inicia el servidor de desarrollo local en `localhost:4321`. |
| `npm run build`   | Compila el sitio para producción en `./dist/`.              |
| `npm run preview` | Previsualiza la compilación localmente antes de desplegar.  |

## ✨ Características Principales

- **Interfaz Intuitiva:** Facilita la interacción con ComfyUI.
- **Generación de Imágenes:** Permite generar imágenes directamente desde el navegador.
- **Gestión de Modelos:** (Si aplica) Posibilidad de seleccionar y gestionar modelos.

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Si deseas contribuir, por favor, haz un fork del repositorio y envía un pull request.
