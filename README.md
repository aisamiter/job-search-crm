# Job Search CRM 🚀

CRM para tracking de postulaciones laborales con auto-populate inteligente de datos desde LinkedIn, Indeed, y otras plataformas.

## ✨ Características

- **Quick Add con AI**: Pegás el link + descripción del aviso, extrae automáticamente empresa, puesto, salario, contacto
- **Pipeline Kanban**: 6 etapas visuales (Encontrada → CV Enviado → Screen → Técnica → Final → Oferta)
- **Navegación bidireccional**: Avanzá o retrocedé postulaciones entre etapas
- **Dashboard de métricas**: Total, activas, tasa de conversión, follow-ups vencidos
- **Vista dual**: Kanban (columnas) y Tabla (grid completo)
- **Export/Import JSON**: Backups de tus datos
- **Smart parsing**: Reconoce 10+ job boards (LinkedIn, Indeed, Glassdoor, Computrabajo, etc.)

---

## 🚀 Deploy en Vercel (10 minutos)

### Paso 1: Instalar dependencias

```bash
cd /ruta/a/Automatizaciones
npm install
```

### Paso 2: Probar localmente

```bash
npm run dev
```

Abrí http://localhost:5173 para ver tu CRM corriendo local.

### Paso 3: Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit: Job Search CRM"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/job-search-crm.git
git push -u origin main
```

> **Nota**: Primero creá un repo nuevo en https://github.com/new

### Paso 4: Deploy en Vercel

1. Andá a https://vercel.com (logueate con GitHub)
2. Click en **"Add New..."** → **"Project"**
3. Importá tu repo `job-search-crm`
4. Vercel detecta automáticamente que es Vite → Click **"Deploy"**
5. En 2 minutos tenés tu URL: `https://job-search-crm-tu-usuario.vercel.app`

¡Listo! 🎉

---

## 📦 Estructura del proyecto

```
Automatizaciones/
├── src/
│   ├── App.jsx          # CRM principal (Kanban, modales, lógica)
│   └── main.jsx         # Entry point de React
├── index.html           # HTML base
├── package.json         # Dependencias
├── vite.config.js       # Config de Vite
└── README.md           # Este archivo
```

---

## 🔧 Próximos pasos (Etapa 2)

Para agregar **base de datos en la nube** y que tus datos persistan automáticamente:

1. Crear cuenta en Supabase (gratis)
2. Agregar cliente de Supabase al proyecto
3. Reemplazar estado local por llamadas a la API
4. Los datos se sincronizan automáticamente

Esto te permite:
- Acceder desde cualquier dispositivo
- Compartir con tu equipo
- Backup automático en la nube

---

## 🤝 Compartir con tu equipo (Etapa 3)

Una vez que tenés la BD, agregamos:
- **Autenticación**: Cada persona tiene su cuenta
- **Roles**: Admin vs Usuario normal
- **Datos compartidos**: El equipo ve las mismas postulaciones

---

## 💡 Arquitectura técnica (para explicar a colegas)

### Stack
- **Frontend**: React 18 + Vite
- **UI**: Tailwind CSS (via CDN)
- **Icons**: Lucide React
- **Estado**: React hooks (useState, useMemo)
- **Deploy**: Vercel (edge network, auto-scaling)

### Patrones de diseño implementados
1. **Pipeline de extracción en capas**: URL parser (determinista) + Text extractor (heurístico) + Merge con priorización contextual
2. **Sticky header/footer**: Flexbox con `flex-col`, `flex-1`, `min-h-0`, `overflow-y-auto`
3. **State machine**: Pipeline como FSM con transiciones bidireccionales
4. **Separation of concerns**: Config de etapas separada del UI (STAGES array)

### Escalabilidad
- **Etapa 1 (actual)**: localStorage → 1 usuario, 1 dispositivo
- **Etapa 2**: Supabase → N usuarios, N dispositivos, sync en tiempo real
- **Etapa 3**: Auth + roles → equipos con permisos

---

## 📝 Notas de uso

- **Persistencia**: Por ahora usá Export/Import JSON para guardar datos entre sesiones
- **Browsers**: Chrome, Edge, Safari (moderno), Firefox
- **Mobile**: Responsive, funciona en mobile pero optimizado para desktop

---

¿Preguntas? Este proyecto fue generado con Claude Code para aprender arquitectura web escalable.
