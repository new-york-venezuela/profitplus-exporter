# SP: pActualizarSerialesxTraslado
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
-- ================================================================================================
-- Author:		SOFTECH SISTEMAS
-- Modificado:	SOFTECH SISTEMAS
-- Create date: 15/07/2010
-- Description:	SP que coloca NULL los campos doc_tip_s, 
--				doc_num_s cuando se elimina el renglon, 
--				el traslado o se anula el mismo 
-- ================================================================================================

CREATE PROCEDURE [pActualizarSerialesxTraslado]
    @sDoc_Tip_S CHAR(4) ,
    @gDoc_Num_s UNIQUEIDENTIFIER ,
    @sCo_Art CHAR(30) ,
    @sCo_Alma CHAR(6)
AS 
    BEGIN
        UPDATE
            saSeriales
        SET Doc_tip_s = NULL, Doc_num_S = NULL
        WHERE
            Doc_Tip_S = @sDoc_Tip_S
            AND Doc_Num_S = @gDoc_num_S
            AND Co_Art = @sCo_Art
            AND Co_Alma = @sCo_Alma
    END
```
