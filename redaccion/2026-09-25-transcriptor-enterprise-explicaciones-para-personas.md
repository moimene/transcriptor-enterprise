# Transcriptor Enterprise · Explicaciones para personas

Copia de referencia de la descripción del proyecto y de las explicaciones de todos los issues, cotejada con Linear a fecha 25 de septiembre de 2026.

---

## Proyecto: Transcriptor Enterprise (P-MOI-11)
**Identificador en Linear:** `P-MOI-11` (UUID `900bafd3-9b8f-41ed-b39f-bec2f1fffb63`)
**Enlace:** https://linear.app/moimene/project/transcriptor-enterprise-ac8cf2f21b48

### Para entenderlo sin ser técnico

**Qué problema hay.** La herramienta interna de transcripción audiovisual desarrollada para convertir grabaciones de reuniones en texto mediante modelos de inteligencia artificial se encontraba operativa pero vulnerable: los trabajos se guardaban únicamente en la memoria volátil del servidor (perdiéndose si el servidor se reinicia o ante un corte), la interfaz no mostraba el avance real del procesamiento y la dirección de internet del servicio no exigía una clave secreta para su uso, lo que permitía que cualquiera que conociese la dirección consumiese saldo de transcripción.

**A quién afecta y qué pasa si no se hace.** Afecta a los profesionales y equipos internos que transcriben entrevistas, comités y material audiovisual corporativo confidencial. Si no se resuelve, un usuario que cierre o refresque la pestaña perderá su trabajo, una subida larga puede fallar silenciosamente en mitad de la transcripción y el consumo del servicio carecerá de control de acceso y presupuesto.

**Qué resultado buscamos.** Una solución consistente, persistente y segura: los trabajos y transcripciones se conservan en una base de datos duradera con borrado programado tras su expiración, la comunicación exige clave de acceso autorizada, la interfaz informa del progreso real del procesamiento y las transcripciones se mantienen legibles y editables en el navegador del usuario aunque recargue la página.

**Cómo sabremos que está resuelto.** Podremos subir un archivo de audio o vídeo largo, comprobar que la pantalla muestra el porcentaje y fase real de avance, recargar el navegador sin perder el resultado, verificar que las peticiones no autorizadas son rechazadas con código de seguridad y comprobar que el servicio en producción supera todas las pruebas automáticas y manuales.

**Qué le toca a Moisés.** Decidir la política de retención de las transcripciones y autorizar la publicación final en producción, según se detalla en la tabla de hitos y en el apartado «Qué te toca a ti» de cada tarea.

---

## Tarea MOI-221: S1 · Evitar la pérdida de transcripciones guardando los trabajos en base de datos persistente con borrado automático
**Hito:** M1 · Persistencia, resiliencia y seguridad en el motor
**Etiquetas:** `TX · Persistencia`, `TX · Gobierno`
**Responsable:** Codex

**Qué problema hay.** Actualmente el motor del servidor almacena el estado de los trabajos de transcripción y sus resultados únicamente en la memoria viva del programa. Si el servidor se reinicia para actualizarse, sufre un corte temporal o falla por falta de recursos, todas las transcripciones en curso o recién finalizadas se borran de inmediato sin posibilidad de recuperación, provocando que la consulta del usuario devuelva un error de no encontrado. Además, las transcripciones completadas permanecen indefinidamente en esa memoria mientras el proceso esté encendido sin ninguna regla de caducidad, lo que incumple el compromiso de no retención de datos confidenciales.

**A quién afecta y qué pasa si no se hace.** Afecta a cualquier usuario que esté procesando grabaciones de reuniones o entrevistas. Si el servidor sufre cualquier reinicio o actualización mientras se procesa un audio largo, la tarea se pierde por completo tras haber consumido tiempo y recursos, obligando al usuario a empezar de cero. Asimismo, la acumulación descontrolada de textos en memoria puede provocar la caída por saturación del servidor.

**Qué resultado buscamos.** Que cada trabajo de transcripción y su resultado se guarden en una base de datos persistente en disco desde el instante de su creación. Los trabajos sobreviven a reinicios del servidor y disponen de un mecanismo de borrado programado que elimina de manera definitiva los datos y archivos temporales transcurridas 24 horas (o el plazo que configure la organización), garantizando la continuidad del servicio y la privacidad documental.

**Cómo sabremos que está resuelto.** Podremos iniciar una transcripción, reiniciar deliberadamente el motor del servidor en Railway, y comprobar que al volver a encenderse el estado del trabajo y su resultado siguen disponibles en la consulta del sistema. Asimismo, comprobaremos que una tarea cuya antigüedad supere el plazo de retención se borra automáticamente junto con sus archivos asociados.

**Qué te toca a ti.** Nada en la parte técnica; únicamente confirmar si el plazo de borrado automático de 24 horas para las transcripciones temporales resulta adecuado para las necesidades de los equipos internos o si prefieres ampliarlo o reducirlo.

---

## Tarea MOI-222: S2 · Proteger el servicio cerrando el acceso público sin clave y restringiendo los dominios y ficheros autorizados
**Hito:** M1 · Persistencia, resiliencia y seguridad en el motor
**Etiquetas:** `TX · Seguridad`, `TX · Gobierno`
**Responsable:** Codex

**Qué problema hay.** La interfaz de programación del motor del servidor carece actualmente de cualquier mecanismo de autenticación o clave secreta en sus rutas de transcripción y subida. Cualquier persona u ordenador que conozca la dirección pública de Railway puede enviar archivos pesados, generar enlaces de subida al almacenamiento y consumir el saldo de transcripción de la organización sin restricción. Además, la ruta que procesa archivos desde el almacén acepta cualquier nombre de archivo sin validar su carpeta, la configuración de acceso entre páginas web permite peticiones de orígenes no controlados y los mensajes de error técnicos muestran rutas internas del servidor y textos del sistema operativo al cliente.

**A quién afecta y qué pasa si no se hace.** Afecta a la seguridad corporativa, al presupuesto del proyecto y a la privacidad de los archivos. Si no se protege, un atacante o un escáner automatizado puede agotar el saldo de transcripción, saturar el procesador del servidor con archivos basura o acceder indebidamente a objetos almacenados.

**Qué resultado buscamos.** Un motor protegido que exija una clave de acceso corporativa en cada petición mediante cabecera de seguridad. Solo las peticiones procedentes de nuestra interfaz web autorizada o con la clave correcta son atendidas. Se valida estrictamente que los archivos pertenezcan únicamente a la carpeta de subidas permitida, se restringe el acceso entre dominios únicamente a la aplicación web oficial, se limita el tamaño máximo de los archivos subidos y se limpian los mensajes de error para no revelar detalles internos del servidor.

**Cómo sabremos que está resuelto.** Comprobaremos que cualquier petición sin la clave de acceso o con una clave incorrecta es rechazada de inmediato con código de no autorizado (401), mientras que las peticiones con la clave correcta se atienden con normalidad. Asimismo, verificaremos que los intentos de acceder a archivos fuera de la ruta autorizada son bloqueados y que los errores devuelven un mensaje comprensible y seguro sin trazas del sistema.

**Qué te toca a ti.** Proporcionar o validar el valor de la clave de acceso que desees establecer para proteger el servicio corporativo entre la interfaz web y el motor del servidor.

---

## Tarea MOI-223: S3 · Evitar el colapso del servidor procesando el audio en segundo plano y añadiendo límites de tiempo y reintentos
**Hito:** M1 · Persistencia, resiliencia y seguridad en el motor
**Etiquetas:** `TX · Resiliencia`, `TX · Gobierno`
**Responsable:** Codex

**Qué problema hay.** El proceso principal del motor del servidor ejecuta las tareas pesadas de conversión de audio y las peticiones a la inteligencia artificial de forma síncrona dentro del bucle de gestión de conexiones. Esto provoca que, mientras se está procesando un archivo de audio, el servidor se congele por completo para todos los demás usuarios: nadie más puede consultar el estado de sus trabajos ni la comprobación de salud responde hasta que la transcripción en curso termine. Además, las herramientas de corte y conversión de audio carecen de límite de tiempo, de modo que un archivo con formato corrupto puede dejar el servidor colgado para siempre. Asimismo, las llamadas al proveedor de inteligencia artificial carecen de reintentos automáticos ante cortes puntuales de red o saturación temporal.

**A quién afecta y qué pasa si no se hace.** Afecta a todos los miembros del equipo que utilicen la herramienta a la vez. Si un usuario sube una grabación larga, el resto de usuarios experimentará que la aplicación no responde o se queda bloqueada. Si además ocurre un microcorte de conexión con el proveedor o un fallo en un fragmento de sonido, la transcripción completa se cancela sin reintentar, perdiendo todo el avance anterior.

**Qué resultado buscamos.** Un motor de servidor ágil y resiliente: las tareas pesadas de audio e inteligencia artificial se delegan a un grupo de ejecución en segundo plano sin congelar el bucle principal de conexiones; todas las conversiones de sonido cuentan con un límite de tiempo estricto para evitar bloqueos por archivos dañados; y las peticiones a la inteligencia artificial incorporan reintentos automáticos y tiempos de espera controlados ante incidencias transitorias.

**Cómo sabremos que está resuelto.** Podremos iniciar el procesamiento de un archivo de audio de varios minutos y comprobar que, mientras se procesa, el servidor continúa respondiendo de forma instantánea a las comprobaciones de salud y a las consultas de otros usuarios. Comprobaremos también que la simulación de un fallo transitorio de red no interrumpe el trabajo sino que se recupera automáticamente gracias a los reintentos.

**Qué te toca a ti.** Nada en este momento; las mejoras de concurrencia y límites de tiempo son ajustes técnicos ordinarios que aplica quien ejecuta.

---

## Tarea MOI-224: S4 · Mostrar el avance real del trabajo en la pantalla y conservar las transcripciones en el navegador ante recargas
**Hito:** M2 · Experiencia de usuario, avance real y memoria en pantalla
**Etiquetas:** `TX · Frontend`
**Responsable:** Codex
**Dependencias:** Bloqueado por MOI-221 y MOI-222. Bloquea MOI-225.

**Qué problema hay.** En la pantalla de la aplicación web, la barra de progreso que indica los pasos de compresión, transcripción y resumen no refleja lo que realmente está ocurriendo en el servidor sino que avanza mediante un temporizador visual ficticio. Si la transcripción tarda más de lo previsto, la barra puede quedarse congelada en el noventa y cinco por ciento durante decenas de minutos sin que el usuario sepa si el trabajo sigue vivo. Además, los resultados de la transcripción y las correcciones que hace el usuario solo se guardan en la memoria temporal de la pestaña: si el usuario recarga la página por error o cierra el navegador, todo el trabajo se pierde por completo. Asimismo, los errores de validación técnica se muestran al usuario como mensajes confusos de texto en lugar de alertas claras.

**A quién afecta y qué pasa si no se hace.** Afecta directamente a los usuarios finales del equipo. Requiere antes disponer de la persistencia en base de datos de MOI-221 y de la protección por clave de MOI-222. La falta de información real sobre el progreso genera incertidumbre y sospechas de que la aplicación se ha colgado, incitando al usuario a refrescar y perder su transcripción. La falta de persistencia en el navegador causa frustración al tener que repetir transcripciones o correcciones manuales ya realizadas.

**Qué resultado buscamos.** Una interfaz visual fiable y transparente: la barra de progreso se sincroniza con los estados y porcentajes reales del servidor; el resultado de la última transcripción y el historial reciente de trabajos se conservan en el almacenamiento local del navegador para resistir recargas involuntarias; y los mensajes de error se traducen a explicaciones comprensibles y amigables.

**Cómo sabremos que está resuelto.** Comprobaremos que al iniciar una transcripción la barra avanza conforme el servidor cambia de fase técnica de forma comprobable. Verificaremos que tras completarse una transcripción podemos refrescar el navegador por completo y el texto, los subtítulos y el resumen permanecen accesibles en pantalla. Asimismo, forzaremos un error de formato para confirmar que el aviso en pantalla es legible y no contiene códigos crudos del sistema.

**Qué te toca a ti.** Nada en este momento; validar el comportamiento de la interfaz una vez implementadas las mejoras de persistencia y progreso visual.

---

## Tarea MOI-225: S5 · Comprobar de extremo a extremo que el servicio procesa audios reales y responde con normalidad en producción
**Hito:** M3 · Verificación de extremos y publicación en producción
**Etiquetas:** `TX · Gobierno`, `TX · Decisión`
**Responsable:** Moisés Menéndez
**Dependencias:** Bloqueado por MOI-221, MOI-222, MOI-223 y MOI-224.

**Qué problema hay.** Tras implementar las mejoras de persistencia en base de datos, protección por clave, ejecución en segundo plano y persistencia en el navegador, es necesario comprobar de extremo a extremo que todas las piezas encajan perfectamente en los entornos reales de producción de Vercel y Railway. Sin una verificación completa con archivos multimedia reales y pruebas automatizadas, podrían existir desajustes inadvertidos entre la interfaz y el servidor o fallos de configuración de variables secretas en los servidores corporativos.

**A quién afecta y qué pasa si no se hace.** Afecta a toda la organización. Requiere haber completado las tareas previas MOI-221, MOI-222, MOI-223 y MOI-224. Si se entrega una versión sin verificar rigurosamente en producción, los usuarios podrían encontrarse con bloqueos inesperados, incompatibilidades de formatos de vídeo o rechazos indebidos de sus grabaciones de trabajo.

**Qué resultado buscamos.** Un servicio corporativo plenamente operativo, verificado y publicado: la aplicación web en Vercel se comunica de manera fluida y protegida con el motor en Railway; las transcripciones de audios y vídeos reales se completan con éxito generando textos precisos, subtítulos y minutas ejecutivas; y todas las comprobaciones de salud y seguridad responden con normalidad.

**Cómo sabremos que está resuelto.** Ejecutaremos una batería completa de pruebas automáticas en el motor y en la aplicación web, realizaremos una transcripción real completa de un archivo de prueba en el entorno publicado en internet y acreditaremos mediante un justificante de pruebas que los resultados persisten, que la clave protege el acceso y que la interfaz muestra el avance fielmente.

**Qué te toca a ti.** Revisar los justificantes de pruebas de la versión publicada y otorgar la aceptación formal de la entrega para autorizar el uso del servicio por los equipos internos.
