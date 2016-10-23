# zendesk-sirena-integration

Este script se fija los usuarios que existen en sirena y zendesk y borra de sirena los que ya existan
en zendesk. Además, guarda un log en una base de `mongodb` con los usuarios borrados y los errores.


## Instalación

```sh
$ git clone git@github.com:Fourhats/DALA-Integraci-n-Zendesk-Sirena.git
$ npm install
```

## Configuración

Cambiar en el archivo `index.js` los valores de las siguientes constantes:

```javascript
var ZEN_API_URL = 'https://<empresa>.zendesk.com/api/v2';
var ZEN_USER = '<usuario>@gmail.com';
var ZEN_TOKEN = 'XfUUg7dmKNNNcnfRSrYfPVJuWFS8067OJaRXJXWO';

var SIRENA_API_URL = 'http://api.getsirena.com/v1';
var SIRENA_API_KEY = 'ZMN49SDc8KeuPf1aVyn9EoeM';

var MONGO_URL = 'mongodb://<user>:<pass>@da063546.mlab.com:63546/<db>';
```

- `ZEN_API_URL`: URL de la api de Zendesk. Cada organización tiene una URL personalizada.
- `ZEN_USER`: El acceso se realiza a través de un token (ver más adelante). Este sería el usuario con el que se generó el token para acceder a Zendesk.
- `ZEN_TOKEN`: El token generado para Zendesk.
- `SIRENA_API_URL`: Url de la api de Sirena. Este valor no cambia.
- `SIRENA_API_KEY`: El api-key para acceder a la api de Sirena (se pide por mail).
- `MONGO_URL`: La URL para conectarse a una base de mongodb para dejar los logs. Actualmente probado con https://mlab.com

### Obtener un token de Zendesk

Desde la interfaz de administración de Zendesk, ir a *Admin > Channels > API*. Desde ahí se pueden ver, agregar o borrar tokens. Más de un token puede estar activo al mismo tiempo. Al borrar un token, se deshabilita permanentemente.

### Cuenta de mLab

Crear una cuenta en [mLab](https://mlab.com). Con un plan free alcanza para lo que esta aplicación guarda.
Dentro de esa cuenta, crear una base de datos que puede tener cualquier nombre. Dentro de la misma, tiene que haber 2 colecciones con los nombres `deletedUsers` y `errors`.


## Deploy en webtask.io

Una vez creada una cuenta en [webtast](https://webtask.io/), seguir los pasos para instalar [webtask-cli](https://webtask.io/cli).

```sh
$ npm install wt-cli -g
$ wt init your_account@gmail.com
```

Para instalar este proyecto como tarea programada, seguir los siguiente ejemplos. Los comandos aceptan cualquier sintaxis de `CRON` válida.

Dentro del directorio raíz de este proyecto, ejecutar

Por ejemplo, para que corra cada 5 minutos:

```sh
wt cron schedule "*/5 * * * *" ./index.js
```

O para que corra cada 6 horas:

```sh
wt cron schedule "* */6 * * *" ./index.js
```

Esto creará una tarea con el nombre `index`. Para ver las veces que corrió y los resultados:

```sh
wt cron history index
```

Devolverá una salida como la siguiente, ordenado de más reciente a más antiguo:

```sh
scheduled_at:      2016-10-23T23:30:00.336Z
started_at:        2016-10-23T23:30:12.979Z
completed_at:      2016-10-23T23:30:17.487Z
type:              success
statusCode:        200
body:              {"last_run":"2016-10-23T23:30:17.484Z","status":"OK","deleted_users":[],"deleting_errors":[]}

scheduled_at:      2016-10-23T23:25:00.952Z
started_at:        2016-10-23T23:25:20.336Z
completed_at:      2016-10-23T23:25:24.846Z
type:              success
statusCode:        200
body:              {"last_run":"2016-10-23T23:25:24.843Z","status":"OK","deleted_users":[{"id":"5808467ff0971b0300652afa","created":"2016-10-20T04:22:23.553Z","group":"Autos del Mundo","firstName":"Cfjmnbc","lastName":"Deyuk","status":"followUp","phones":["5558"],"emails":["fgjk@vvc.com"],"leads":[{"created":"2016-10-20T04:22:23.562Z","source":"Carga Manual","type":"savingPlan"}],"agent":{"id":"58065fde661c5c03005335aa","firstName":"Demián","lastName":"Gallardo","email":"demo@autosdelmundo.com"},"assigned":"2016-10-20T04:22:23.553Z","_id":"580d46e4152ee40001d408fd"}],"deleting_errors":[]}

scheduled_at:      2016-10-23T23:20:00.584Z
started_at:        2016-10-23T23:20:17.952Z
completed_at:      2016-10-23T23:20:22.970Z
type:              success
statusCode:        200
body:              {"last_run":"2016-10-23T23:20:22.967Z","status":"OK","deleted_users":[],"deleting_errors":[]}
```
