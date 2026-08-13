# SP: pObtenerMovCajaDesdeTransferencia
**Tipo**: Obtener
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saMovimientoCaja`](../tables/saMovimientoCaja.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	pExportarActualizarRegistrosConfigTraslado
*DESCRIPCIÓN	:	Actualiza la configuracion del proceso ConfigTraslado
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/
CREATE PROCEDURE [dbo].[pObtenerMovCajaDesdeTransferencia]
    (
       @sMovNum CHAR(20) 
    )
AS 
    BEGIN     
		SELECT * FROM saMovimientoCaja WHERE mov_nro = @sMovNum
    END
```
