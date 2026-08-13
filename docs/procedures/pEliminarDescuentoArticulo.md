# SP: pEliminarDescuentoArticulo
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saDescArticulo`](../tables/saDescArticulo.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pEliminarDescuento
*DESCRIPCIÓN	: Elimina el registro especificado de las tablas de descuento de acuerdo al contexto
*AUTOR			: SOFTECH SISTEMAS.
**************************************************************************/

CREATE PROCEDURE [pEliminarDescuentoArticulo]
    (
      @sCo_DescOri CHAR(6) ,
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
            saDescArticulo
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_desc = @sCo_DescOri
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
                    @sTablaOri = 'saDescArticulo', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_DescOri			
            END

    END
```
