# SP: pEliminarFacturaVentaExt
**Tipo**: Eliminar
**Módulo**: Ventas

## Tablas Referenciadas
- [`stgFacturaVentaExt`](../tables/stgFacturaVentaExt.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarFacturaVentaExt
*DESCRIPCIÓN	: Elimina el registro de stgFacturaVentaExt
*FECHA CREACIÓN : <2019-07-17>
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarFacturaVentaExt]
    (
      @gRowguidDocNum UNIQUEIDENTIFIER ,      
      @sCo_Us_In		CHAR(6) ,
	  @sCo_Sucu_In	CHAR(6) ,
	  @sCo_Us_Mo		CHAR(6) ,
	  @sCo_Sucu_Mo	CHAR(6) ,
	  @sMaquina		VARCHAR(60) = NULL
      
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            stgFacturaVentaExt
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_doc_num = @gRowguidDocNum            		


        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'stgFacturaVentaExt', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @gRowguidDocNum
            END
    END
```
