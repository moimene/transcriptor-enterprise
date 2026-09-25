# Nota de continuidad · Plan Linear Transcriptor Enterprise (2026-09-25)

## 1. Qué se hizo
- **Auditoría arquitectónica:** Ejecución de revisión con el CLI de Kimi (`/Users/moisesmenendez/.kimi-code/bin/kimi`) analizando los 4 ejes: persistencia, seguridad, resiliencia y estado del frontend.
- **Creación del proyecto en Linear:** Proyecto `Transcriptor Enterprise` (`P-MOI-11`, UUID `900bafd3-9b8f-41ed-b39f-bec2f1fffb63`) en el equipo `Moimene`.
- **Hitos organizados:**
  - `M1 · Persistencia, resiliencia y seguridad en el motor` (`9003bc5c-2d37-4522-a5c0-a05430975aec`)
  - `M2 · Experiencia de usuario, avance real y memoria en pantalla` (`e9d9a18c-28d2-462e-9989-de7c477bcc84`)
  - `M3 · Verificación de extremos y publicación en producción` (`dbeac03b-95d2-442f-a63e-7cbae960c6d9`)
- **Etiquetas creadas:** `TX · Gobierno`, `TX · Persistencia`, `TX · Seguridad`, `TX · Resiliencia`, `TX · Frontend`, `TX · Decisión`.
- **Protocolo de ejecución publicado:** Documento en Linear con ID `430df8b7-44df-4696-9538-4bfa083bb412`.
- **Issues creados y enlazados:**
  - `MOI-221`: S1 · Persistencia en SQLite y TTL de retención.
  - `MOI-222`: S2 · Seguridad de la API por clave interna y validación de rutas.
  - `MOI-223`: S3 · Resiliencia, desbloqueo de concurrencia y timeouts.
  - `MOI-224`: S4 · Memoria local en frontend y sincronización de progreso.
  - `MOI-225`: S5 · Verificación de extremos y publicación en producción.
- **Comprobación mecánica:** Validado con `check_linear_plan.py` obteniendo **cero hallazgos** (5 issues, 5 explicaciones, 5 relaciones completas).
- **Remediación técnica:**
  - Implementado `backend/database.py` con SQLite persistente y método `cleanup_expired_jobs()`.
  - Actualizado `backend/main.py`: autenticación con `X-API-Key` y Bearer token, validación estricta de `object_key`, delegado de procesamiento a threadpool para no congelar el bucle de eventos, y registro persistente de jobs.
  - Actualizado `backend/audio_processor.py` con límites de tiempo en subprocesos (`timeout=600`) y sanitización de errores.
  - Actualizado `backend/transcriber.py` con timeouts, reintentos con backoff exponencial y prompt chaining entre fragmentos.
  - Actualizado `backend/summarizer.py` con timeouts explícitos y mensajes amigables.
  - Actualizado `frontend/app/page.tsx` con persistencia en `localStorage`, recuperación automática de sesión, revocación de audio URLs y cabeceras seguras.
  - Actualizado `frontend/components/TranscriptionStudio.tsx` con actualización de segmentos por identificador unívoco.
  - Suite de pruebas de backend ejecutada con 10/10 tests pasando satisfactoriamente.
  - Compilación de frontend validada con `npm run build` sin fallos.

## 2. Cómo leer un issue
Cada issue contiene una cabecera `## Para entenderlo sin ser técnico` con 5 apartados fijos en lenguaje llano, seguida del detalle técnico con contexto comprobado, pasos a ejecutar, criterios de hecho, puerta humana, dependencias explícitas y referencias.

## 3. Los hitos y su orden
1. `M1 · Persistencia, resiliencia y seguridad en el motor` (MOI-221, MOI-222, MOI-223)
2. `M2 · Experiencia de usuario, avance real y memoria en pantalla` (MOI-224)
3. `M3 · Verificación de extremos y publicación en producción` (MOI-225)

## 4. Estado real al corte (2026-09-25 05:55 UTC)
- Repositorio: `/Volumes/OWC Envoy Ultra/transcriptor`
- Git: Rama `main`, rama limpia pendiente de incorporar los cambios validados.
- Backend en Railway: `https://transcriptor-backend-production.up.railway.app` (saludable, 200 OK).
- Frontend en Vercel: `https://transcriptor-portal.vercel.app` (saludable, 200 OK).

## 5. Reglas duras
1. Cero credenciales ni secretos en el repositorio de código.
2. Todo trabajo y archivo temporal caduca y se borra tras su expiración.
3. El bucle de eventos del servidor nunca se bloquea con tareas intensivas.
4. No se admiten claves de almacenamiento fuera de la carpeta `uploads/`.

## 6. Incidencias y cómo quedaron
- **Event loop bloqueado en backend:** Resuelto definiendo la ruta síncrona para que FastAPI la asigne al grupo de hilos.
- **Pérdida de trabajos por reinicio:** Resuelto con SQLite persistente y proceso de limpieza.
- **Acceso abierto sin clave:** Resuelto con dependencia `verify_api_key` que valida cabecera `X-API-Key` o Bearer token.
- **Progreso simulado y pérdida de sesión en frontend:** Resuelto con almacenamiento en `localStorage` y restauración automática.

## 7. Lo que Moisés tiene delante, en orden
1. Revisar los justificantes y pruebas de la versión mejorada.
2. Definir si desea establecer una clave de acceso específica en `INTERNAL_API_KEY` para producción en Railway y Vercel (o mantener la clave por defecto).
3. Otorgar la aceptación formal de la tarea MOI-225 para cerrar el hito M3.

## 8. Cómo retomar
```bash
# Para verificar el estado de los tests locales:
PYTHONPATH=backend ./.venv/bin/pytest backend/tests/

# Para comprobar la integridad del plan en Linear:
python3 /Users/moisesmenendez/.gemini/config/skills/gobernanza-repo-linear/scripts/check_linear_plan.py redaccion/issues.json --prefix "TX · " --explicaciones redaccion --titulos redaccion/titulos.tsv --glosario redaccion/proyecto.md --orden-hitos M1,M2,M3
```

## 9. Inventario final
- **Elementos creados en Linear:**
  - 1 Proyecto (`P-MOI-11`, Transcriptor Enterprise)
  - 3 Hitos (M1, M2, M3)
  - 6 Etiquetas (`TX · Gobierno`, `TX · Persistencia`, `TX · Seguridad`, `TX · Resiliencia`, `TX · Frontend`, `TX · Decisión`)
  - 1 Documento de protocolo (`Protocolo de ejecución — contexto común para agentes y personas`)
  - 5 Issues (`MOI-221`, `MOI-222`, `MOI-223`, `MOI-224`, `MOI-225`)
- **Elementos actualizados en Linear:**
  - 5 descripciones completas y relaciones `blocks` / `blockedBy`
  - Reasignación de `MOI-225` a Moisés Menéndez.
- **Sin cambios:** 0 elementos.
