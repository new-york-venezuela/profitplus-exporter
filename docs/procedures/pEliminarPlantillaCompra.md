# SP: pEliminarPlantillaCompra
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:	pEliminarPlantillaCompra
*DESCRIPCIÓN	:	Elimina una Plantilla de compra segun su primary key
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS E.
*************************************************************************/

CREATE PROCEDURE [pEliminarPlantillaCompra]
    (
      @sDoc_NumOri CHAR(20) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @tsvalidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
	
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            saPlantillaCompra
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_NumOri
            AND validador = @tsValidador	

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC pInsertarPista @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saPlantillaCompra', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sDoc_NumOri
            END
    END
```
