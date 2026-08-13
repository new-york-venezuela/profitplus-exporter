# SP: pEliminarDatosDeImportacion
**Tipo**: Eliminar
**Módulo**: General

## Tablas Referenciadas
- [`saDatosDeImportacion`](../tables/saDatosDeImportacion.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pEliminarTablaTasas 
*DESCRIPCIÓN	:	Elimina un registro en la tabla saDatosDeImportacion
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [dbo].[pEliminarDatosDeImportacion]
    (
      @gRowguid_Factura_Renglon UNIQUEIDENTIFIER ,
      @tsValidador TIMESTAMP ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )
		
        DELETE FROM
            saDatosDeImportacion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_factura_renglon = @gRowguid_Factura_Renglon
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
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saDatosDeImportacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @gRowguid_Factura_Renglon			
            END

    END
```
