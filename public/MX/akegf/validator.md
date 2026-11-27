# AKEGF · Certificación de herramientas

La herramienta debe importar y exportar v1.1 / v1.2 e indicar en la aplicación la versión compatible con un enlace a [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home).

Si tu proyecto admite AKEGF, puedes solicitar su incorporación a [Proyectos asociados](/?plugin=akegf&id=partners) mediante un [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls).

Importa el [Ejemplo con varios personajes](/plugin/data/akegf/example.json) y vuelve a exportarlo. El personaje de China debe conservar tres registros y el global uno. Compara evento, banner, resultado, rareza, milisegundos y número de secuencia. Conserva tanto la tirada de operador como la de arma con el mismo número y el tipo gift_weapon del obsequio.

## Validador AKEGF

Pega el JSON o elige un archivo local. El navegador comprueba el esquema, los grupos duplicados y las secuencias repetidas dentro del mismo tipo. /endfield/0/list/1 señala el segundo registro del primer personaje.
