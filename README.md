# Sistema de Menú Digital  
## El Faraon Catering

Sistema de menú digital accesible mediante código QR desarrollado para los buffets operados por **El Faraon Catering** dentro de estudios audiovisuales y edificios corporativos.

La primera implementación del sistema estará orientada al buffet ubicado en el **edificio corporativo de Paramount+**, funcionando como una prueba inicial antes de extender el sistema a otras locaciones donde opera la empresa.

---

# Overview

El Faraon Catering es una empresa que desde 2018 brinda servicios de alimentación para producciones audiovisuales y administra buffets en distintos espacios del sector.

Actualmente opera en locaciones como:

- Estudios Cuyo  
- Estudios Ronda  
- Edificio Corporativo Paramount+  
- Star TV Producciones  

Estos buffets atienden principalmente a técnicos, personal de producción audiovisual y trabajadores de oficinas durante horarios laborales.

El objetivo de este proyecto es digitalizar el menú del buffet y facilitar su consulta mediante teléfonos móviles utilizando **códigos QR colocados dentro de cada establecimiento**.

---

# Objetivos del proyecto

El sistema busca ofrecer una solución simple, rápida y de bajo mantenimiento para visualizar el menú del buffet.

Objetivos principales:

- Facilitar la consulta del menú desde teléfonos móviles mediante QR
- Permitir actualizar el menú del día de forma sencilla
- Ofrecer una experiencia clara y rápida en dispositivos móviles
- Mantener costos de mantenimiento mínimos
- Sentar las bases para una futura web institucional del catering
- Permitir reutilizar el sistema en múltiples locaciones

---

# Alcance del sistema

La primera etapa del proyecto se centra exclusivamente en el **menú digital del buffet**.

El sistema permitirá visualizar:

- platos fijos
- guarniciones
- bebidas
- menú del día
- precios
- disponibilidad de platos
- horarios de atención

El menú será **principalmente informativo**, sin integrar por el momento sistemas de pedidos, pagos o reservas.

---

# Estructura del menú

El menú se organiza en cuatro categorías principales.

## Platos fijos

El buffet ofrece aproximadamente **6 a 7 platos principales fijos**, que pueden variar ocasionalmente.

Cada plato incluirá:

- nombre
- descripción opcional
- precio
- disponibilidad
- opción de guarnición

---

## Guarniciones

Las guarniciones son comunes a todos los platos principales.

Ejemplos posibles:

- papas fritas
- ensalada
- puré
- arroz

---

## Bebidas

Lista fija de bebidas disponibles:

- gaseosas
- agua
- bebidas sin alcohol
- café

---

## Menú del día

Además del menú fijo, el buffet ofrece **1 o 2 platos del día** que rotan regularmente.

Cada plato incluirá:

- nombre
- descripción opcional
- precio
- disponibilidad

---

# Uso de imágenes

Se prevé incorporar fotografías de los platos mediante una futura producción fotográfica profesional o semiprofesional.

Dado que el menú total no supera aproximadamente **20 platos**, la carga de imágenes será moderada.

Las imágenes podrán integrarse de distintas maneras según el diseño final:

- tarjetas con imagen
- fichas de plato
- carruseles de platos
- galerías

La implementación visual será definida durante la etapa de diseño.

---

# Arquitectura técnica

El sistema se desarrollará utilizando una arquitectura de **sitio estático con CMS desacoplado**, priorizando rendimiento, simplicidad y bajo costo de mantenimiento.

## Tech Stack

### Astro
Framework moderno para generación de sitios estáticos.

Se utiliza para:

- estructura del sitio
- componentes visuales
- renderizado de contenido
- generación de páginas optimizadas

---

### GitHub
Repositorio central del proyecto.

Funciones:

- control de versiones
- almacenamiento del código
- gestión de cambios

---

### Netlify
Plataforma de hosting y despliegue.

Funciones:

- publicación del sitio
- despliegue automático desde GitHub
- distribución mediante CDN
- autenticación del CMS

---

### Decap CMS
Sistema de gestión de contenido basado en Git.

Permite editar el menú desde una interfaz web.

Funciones principales:

- editar platos del día
- modificar platos del menú fijo
- actualizar precios
- marcar platos como disponibles o no disponibles

Cada cambio realizado desde el CMS genera automáticamente un redeploy del sitio.

---

# Sistema editorial

El sistema de administración permite que el personal del buffet actualice el contenido sin conocimientos técnicos.

Las acciones disponibles incluyen:

### Gestión del menú del día

- agregar platos
- editar platos
- modificar precios
- marcar disponibilidad

### Gestión del menú fijo

- editar platos existentes
- modificar precios
- activar o desactivar platos

---

# Flujo de uso

El funcionamiento del sistema será simple:

1. El cliente escanea un código QR ubicado en el buffet.
2. El QR abre la página del menú en el teléfono.
3. El usuario visualiza los platos disponibles.
4. El menú siempre refleja la información actualizada.

---

# Roadmap

Posibles mejoras futuras:

- incorporación de la web institucional del catering
- soporte para múltiples locaciones
- reutilización del sistema en otros buffets
- traducción del menú a otros idiomas
- integración con pedidos digitales
- galerías de platos o eventos gastronómicos

---

# Costos operativos

La arquitectura elegida permite operar el sistema con **costos mínimos o nulos** en su etapa inicial utilizando los planes gratuitos de:

- GitHub
- Netlify
- Decap CMS

En el futuro podría incorporarse un dominio propio cuando se desarrolle la página institucional del catering.

---

# Licencia

Proyecto desarrollado para uso interno de **El Faraon Catering**.