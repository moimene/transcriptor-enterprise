# Transcriptor Enterprise

## Para entenderlo sin ser técnico

**Qué problema hay.** La herramienta interna de transcripción audiovisual desarrollada para convertir grabaciones de reuniones en texto mediante modelos de inteligencia artificial se encontraba operativa pero vulnerable: los trabajos se guardaban únicamente en la memoria volátil del servidor (perdiéndose si el servidor se reinicia o ante un corte), la interfaz no mostraba el avance real del procesamiento y la dirección de internet del servicio no exigía una clave secreta para su uso, lo que permitía que cualquiera que conociese la dirección consumiese saldo de transcripción.

**A quién afecta y qué pasa si no se hace.** Afecta a los profesionales y equipos internos que transcriben entrevistas, comités y material audiovisual corporativo confidencial. Si no se resuelve, un usuario que cierre o refresque la pestaña perderá su trabajo, una subida larga puede fallar silenciosamente en mitad de la transcripción y el consumo del servicio carecerá de control de acceso y presupuesto.

**Qué resultado buscamos.** Una solución consistente, persistente y segura: los trabajos y transcripciones se conservan en una base de datos duradera con borrado programado tras su expiración, la comunicación exige clave de acceso autorizada, la interfaz informa del progreso real del procesamiento y las transcripciones se mantienen legibles y editables en el navegador del usuario aunque recargue la página.

**Cómo sabremos que está resuelto.** Podremos subir un archivo de audio o vídeo largo, comprobar que la pantalla muestra el porcentaje y fase real de avance, recargar el navegador sin perder el resultado, verificar que las peticiones no autorizadas son rechazadas con código de seguridad y comprobar que el servicio en producción supera todas las pruebas automáticas y manuales.

**Qué le toca a Moisés.** Decidir la política de retención de las transcripciones y autorizar la publicación final en producción, según se detalla en la tabla de hitos y en el apartado «Qué te toca a ti» de cada tarea.

## Cómo se trabaja

- **Orden de los hitos y trabajo en paralelo:** El trabajo se ejecuta en tres hitos secuenciales (M1, M2 y M3). En M1 se afianzan la persistencia de datos, la resiliencia ante cortes y la seguridad de la interfaz de programación; en M2 se actualiza la interfaz visual para conectarla al procesamiento asíncrono y dotarla de memoria local; y en M3 se verifica el conjunto y se publica en producción.
- **Regla general de autorizaciones:** Las mejoras técnicas ordinarias de código, pruebas y correcciones de fallos las resuelve y aplica quien ejecuta. Tocar variables secretas corporativas de producción o alterar los plazos de retención de datos requiere autorización previa de Moisés.
- **Cómo leer una tarea:** Cada tarea comienza con una explicación en lenguaje llano de cinco apartados fijos para comprender el problema y su solución sin necesidad de conocimientos de programación, seguida del detalle técnico para los ejecutores.
- **Criterio de arquitectura:** La arquitectura separa la presentación web (alojada en Vercel) del motor de procesamiento multimedia (alojado en Railway con herramientas de conversión de sonido y acceso a los modelos de transcripción). La comunicación entre ambos componentes se realiza de manera segura mediante identificación por clave y almacenamiento intermedio cifrado.

## Hitos

| Hito | Para qué sirve | Trabajo, en orden | Lo que decide o autoriza Moisés |
| --- | --- | --- | --- |
| M1 · Persistencia, resiliencia y seguridad en el motor | Garantizar que ningún trabajo se pierda por reinicio del servidor y que el servicio solo atienda peticiones autorizadas | 1. Base de datos persistente con borrado programado<br>2. Protección por clave y saneamiento de dominios<br>3. Procesamiento en segundo plano con límites de tiempo | Autorizar la política de retención y borrado temporal de transcripciones |
| M2 · Experiencia de usuario, avance real y memoria en pantalla | Permitir que el usuario vea el progreso verídico y no pierda sus transcripciones si refresca la ventana | 1. Conexión de la pantalla con la consulta de avance del servidor<br>2. Almacenamiento local de borradores en el navegador | Validar la experiencia de usuario y el flujo de trabajo en pantalla |
| M3 · Verificación de extremos y publicación en producción | Confirmar con pruebas reales la solidez del sistema y dejarlo disponible en internet para el equipo | 1. Batería de pruebas de verificación automatizada<br>2. Publicación de la versión revisada en los servidores corporativos | Aceptación final de la solución en producción |

## Palabras que se usan en los issues

### Personas y herramientas
- **Moisés:** Responsable del producto y de las decisiones estratégicas, de seguridad y de negocio.
- **Codex o agente de programación:** Asistente técnico que diseña, programa y verifica las modificaciones del programa.
- **Quien ejecuta:** Ingeniero o agente responsable de realizar las tareas técnicas aprobadas.
- **Linear:** Sistema de gestión donde se planifican, organizan y siguen las tareas del proyecto.
- **Railway:** Plataforma de infraestructura en la nube donde corre el motor de procesamiento multimedia.
- **Vercel:** Plataforma de infraestructura en la nube donde se aloja y sirve la aplicación web interactiva.
- **OpenAI:** Proveedor de modelos de inteligencia artificial para la transcripción y el resumen ejecutivo.

### El sistema y cómo se cambia
- **Motor del servidor o backend:** Parte del programa que procesa los archivos pesados, extrae el audio y se comunica con la inteligencia artificial.
- **Interfaz o frontend:** Pantalla visual con la que interactúa la persona en su navegador.
- **Base de datos persistente:** Almacén digital en disco que conserva los datos aunque el servidor se reinicie o se actualice.
- **Interfaz de programación o API:** Punto de conexión técnica que permite a la pantalla comunicarse con el servidor.
- **Clave de acceso o token:** Código secreto que viaja en cada petición para comprobar que el usuario o la pantalla están autorizados.
- **Límite de tiempo o timeout:** Tiempo máximo de espera para que una tarea termine antes de considerarse cancelada y liberar recursos.
- **Procesamiento en segundo plano:** Ejecución asíncrona de tareas pesadas para que la pantalla continúe respondiendo sin congelarse.
- **Almacenamiento en navegador:** Memoria local dentro del explorador del usuario para guardar su trabajo reciente sin enviarlo a servidores externos.
- **Modificación del programa:** Cambio en el código fuente de la aplicación.
- **Publicar:** Subir e incorporar una versión validada a los servidores de producción para que quede disponible.
- **Prueba:** Verificación técnica automatizada o manual que comprueba que una función trabaja según lo esperado.
- **Justificante:** Documento o registro comprobable que acredita la realización o el cumplimiento de un requisito.

### Siglas y términos técnicos
- **SQL o SQLite:** Motor de base de datos ligero que guarda la información en un fichero local estructurado.
- **CORS:** Mecanismo de seguridad de los navegadores que define qué páginas web tienen permiso para comunicarse con un servidor.
- **FFmpeg:** Herramienta técnica que procesa, convierte y corta archivos de audio y vídeo.
- **SHA:** Código numérico único que identifica de forma exacta una versión del código en el repositorio.
- **Job o trabajo:** Tarea individual de transcripción encargada por un usuario y seguida por su identificador único.

## Estado verificado al corte (2026-09-25 05:45 UTC)

- **Repositorio de código:** Repositorio Git limpio en la rama principal (`main`), con último cambio registrado bajo el identificador `bd54196` sincronizado con el repositorio remoto de GitHub (`moimene/transcriptor-enterprise`).
- **Servidores en producción:** El motor del servidor responde con normalidad en Railway (`https://transcriptor-backend-production.up.railway.app/health`) y la aplicación web se encuentra operativa en Vercel (`https://transcriptor-portal.vercel.app`).
- **Auditoría arquitectónica:** Revisión exhaustiva completada mediante la herramienta de auditoría de Kimi, detectando la necesidad inmediata de dotar al sistema de persistencia en disco, autenticación por clave, procesamiento no bloqueante y sincronización real en la interfaz.

## Criterios de producto

1. **Privacidad estricta:** Ningún archivo ni transcripción debe quedar almacenado indefinidamente en servidores intermedios; los datos de trabajo expiran y se eliminan automáticamente tras un período configurable.
2. **Resiliencia operativa:** Las tareas pesadas de conversión y llamada a modelos de inteligencia artificial disponen de límites de tiempo y reintentos para no bloquear las peticiones de otros usuarios.
3. **Persistencia para el usuario:** El usuario puede trabajar sin temor a perder sus transcripciones ante un refresco involuntario de la pantalla o un microcorte de red.
