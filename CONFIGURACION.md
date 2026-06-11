# Guía de Configuración — Autonomic Sentinel

Paso a paso para dejar el sistema listo y conectado a GitHub y Anthropic.

---

## 1. Levantar el stack

```bash
make setup   # solo la primera vez: crea .env e instala dependencias
make up      # levanta backend (puerto 8000) y frontend (puerto 5173)
```

Verifica que los servicios estén corriendo:

```bash
make status
```

Abre el frontend en el navegador: [http://localhost:5173](http://localhost:5173)

---

## 2. Configurar la API Key de Anthropic

### Obtener la key

1. Ingresa a [console.anthropic.com](https://console.anthropic.com)
2. En el menú lateral, ve a **API Keys**
3. Haz click en **Create Key**
4. Escribe un nombre (por ejemplo: `sentinel-hackathon`)
5. Copia la key — empieza con `sk-ant-...`

> La key solo se muestra una vez. Guárdala antes de cerrar.

### Cargarla en el sistema

1. En el frontend, ve a **Settings** (menú superior)
2. En la sección **AI Configuration**, pega la key en el campo **Anthropic API Key**
3. Elige el modelo:
   - **Sonnet 4.6** — rápido, recomendado para la mayoría de los incidentes
   - **Opus 4.8** — el más capaz, ideal para análisis complejos o arquitecturales
   - **Haiku 4.5** — el más rápido, para fixes simples
4. Haz click en **Save AI Configuration**

El campo mostrará `✓ saved` cuando la key esté guardada correctamente.

> Si prefieres usar la variable de entorno en lugar de la UI, edita `backend/.env` y completa `ANTHROPIC_API_KEY=sk-ant-...`. La UI tiene prioridad si ambas están configuradas.

---

## 3. Crear un GitHub Personal Access Token (PAT)

El agente necesita este token para leer el código del repositorio y abrir Pull Requests con los fixes.

### Crear el token

1. Ingresa a [github.com](https://github.com) con tu cuenta
2. Haz click en tu avatar (arriba a la derecha) → **Settings**
3. En el menú lateral, baja hasta **Developer settings** → **Personal access tokens** → **Tokens (classic)**
4. Haz click en **Generate new token (classic)**
5. Completa los campos:
   - **Note**: `sentinel-hackathon` (o el nombre que prefieras)
   - **Expiration**: 7 días es suficiente para el hackathon
   - **Scopes**: selecciona `repo` (incluye lectura de código, creación de branches y PRs)
6. Haz click en **Generate token**
7. Copia el token — empieza con `ghp_...`

> El token también se muestra una sola vez. Guárdalo antes de cerrar.

### Scopes mínimos necesarios

| Scope | Para qué lo usa el agente |
|-------|--------------------------|
| `repo` | Leer archivos, crear branches, abrir Pull Requests |

Si prefieres usar **Fine-grained tokens** (más granular y seguro):

| Permiso | Nivel |
|---------|-------|
| Contents | Read |
| Pull requests | Read and Write |
| Metadata | Read |

---

## 4. Configurar un proyecto

Cada proyecto le indica al agente qué repositorio analizar y con qué credenciales.

1. En el frontend, ve a **Projects** (menú superior)
2. Haz click en **New Project**
3. Completa el formulario:
   - **Name**: nombre descriptivo (por ejemplo: `ShopFlow`)
   - **GitHub Repository**: el repo en formato `owner/repo` (ejemplo: `Mansilla1/GlobalHack-IA-cracks-repo-test`). También puedes pegar la URL completa (`https://github.com/...`), el sistema la normaliza automáticamente
   - **GitHub Token**: pega el PAT que generaste en el paso anterior
   - **Target Path**: carpeta donde el agente empieza a buscar código (opcional, pero acelera el análisis). Por ejemplo: `backend` si el código está ahí
   - **Can open PRs**: déjalo activado para que el agente pueda crear Pull Requests automáticamente
4. Haz click en **Create Project**
5. Haz click en **Validate** para verificar que el token tiene acceso al repo

Si la validación es exitosa, verás el nombre completo del repo, la rama por defecto, y si es público o privado.

---

## 5. Simular un incidente

Una vez configurado el proyecto, puedes probar el agente simulando un error.

1. En el frontend, ve al **Dashboard**
2. Haz click en **New Incident**
3. Completa los campos:
   - **Title**: título del error (por ejemplo: `ZeroDivisionError in payment processing`)
   - **Error message**: el mensaje de la excepción
   - **Stack trace**: el traceback completo (opcional, pero ayuda al agente a ubicar el problema más rápido)
   - **Project**: selecciona el proyecto que configuraste
4. Haz click en **Create**

El agente se activa de inmediato. Verás en tiempo real cómo:
- Lista y lee los archivos del repo
- Clasifica el incidente (`quick_fix`, `edge_case` o `architectural`)
- Crea un Pull Request con el fix directamente en GitHub

El PR aparece en el incidente con el link directo a GitHub.

---

## 6. Generar un post-mortem

Una vez que un incidente tiene análisis del agente, puedes generar un post-mortem automático.

1. En el **Dashboard**, abre el incidente
2. Haz click en **Generate Post-mortem**

El agente genera un reporte en markdown con:
- Resumen del incidente
- Causa raíz
- Impacto
- Resolución (con código del fix)
- Lecciones aprendidas
- Action items

---

## Comandos útiles

```bash
make up          # levantar servicios
make down        # detener servicios
make status      # ver si los servicios están corriendo
make logs        # ver logs en tiempo real (Ctrl+C para salir)
make clean       # borrar base de datos, logs y PIDs (reset completo)
```

La API con documentación interactiva está disponible en [http://localhost:8000/docs](http://localhost:8000/docs).
