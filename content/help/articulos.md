## ¿Qué es esta página?

Aquí puedes ver y editar información básica de los artículos que tienen
stock en los almacenes configurados para Inventario. Solo se pueden
editar campos "seguros" — nombre, referencia, modelo y umbrales de
stock — nunca campos que afecten precios, impuestos o contabilidad.

## Glosario de campos

- **Código**: el código interno del artículo en Profit Plus (`co_art`).
  No se puede editar aquí.
- **Nombre**: la descripción del artículo tal como aparece en el
  catálogo.
- **Referencia**: un código alterno del artículo — por ejemplo, un
  código de proveedor o de catálogo externo. Es informativo, no afecta
  ningún cálculo.
- **Modelo**: otro código alterno, típicamente el modelo del fabricante.
  También es solo informativo.
- **Stock**: la cantidad actual disponible en el almacén, según Profit
  Plus. No se edita aquí — para corregirlo, usa la página de **Ajustes**.
- **Mín**: el stock mínimo que se debe mantener de este artículo (umbral
  de reorden bajo). Sirve como referencia para saber cuándo reabastecer.
- **Máx**: el stock máximo que se debe mantener.
- **Pedido**: la cantidad de reposición sugerida cuando el stock llega al
  mínimo.

## Cómo editar un artículo

1. Busca la fila del artículo que quieres editar (usa los filtros de
   Línea o Categoría si la lista es larga).
2. Modifica el campo que necesites directamente en la tabla.
3. Presiona **Guardar** en esa fila. El botón solo se activa cuando hay
   cambios sin guardar.

Un artículo con stock en más de un almacén aparece como una fila por
cada almacén — el nombre, la referencia y el modelo son los mismos en
todas esas filas (pertenecen al artículo, no al almacén), pero cada fila
se guarda de forma independiente.

## Errores comunes

- **"Campo no editable"**: intentaste enviar un campo que no está en la
  lista de campos seguros. No debería ocurrir usando la interfaz normal.
- **"Valor demasiado largo"**: el texto ingresado supera el límite real
  de la columna en Profit Plus (por ejemplo, Referencia y Modelo
  admiten hasta 20 caracteres).
- **Error de restricción de stock**: Profit Plus no permite que el stock
  mínimo sea mayor que el máximo. Ajusta ambos valores para que el
  mínimo sea menor o igual al máximo.
