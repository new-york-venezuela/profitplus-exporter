# SP: pEliminarRenglonesGiroCompra
**Tipo**: Eliminar
**Módulo**: Compras

## Tablas Referenciadas
- [`saDocumentoCompraReng`](../tables/saDocumentoCompraReng.md)
- [`saGiroCompraReng`](../tables/saGiroCompraReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:pEliminarRenglonesGiroCompra
DESCRIPCION	: Inserta un registro de la tabla saDocumentoCompraReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesGiroCompra]
    (
      @iReng_NumOri INT ,
      @sCo_GiroOri CHAR(20) ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN
		
        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER
            )

        DELETE FROM
            saGiroCompraReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            co_giro = @sCo_GiroOri
            AND reng_num = @iReng_NumOri	
		
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
                    @sTablaOri = 'saGiroCompraReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCo_GiroOri
            END

    END
```
