# SP: pEliminarFacturaCompraImportacion
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saFacturaCompraImportacion`](../tables/saFacturaCompraImportacion.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarArtImportacion
DESCRIPCION: Eliminar de Tabla ArtImportacion
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarFacturaCompraImportacion]
    (
      @tsValidador TIMESTAMP = NULL ,
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
            saFacturaCompraImportacion
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            Rowguid = @gRowguid
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
                    @sTablaOri = 'saFacturaCompraImportacion', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @gRowguid
            END
    
    END
```
