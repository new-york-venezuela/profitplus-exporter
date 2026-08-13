# SP: pEliminarRenglonesCotizacionProveedor
**Tipo**: Eliminar
**Módulo**: Clientes

## Tablas Referenciadas
- [`saCotizacionProveedorReng`](../tables/saCotizacionProveedorReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			:	pEliminarRenglonesCotizacionProveedor
*DESCRIPCIÓN	:	Elimina un renglon de factura de compra
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [pEliminarRenglonesCotizacionProveedor]
    (
      @iReng_NumOri INT ,
      @sDoc_NumOri CHAR(20) ,
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
            saCotizacionProveedorReng
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            reng_num = @iReng_NumOri
            AND doc_num = @sDoc_NumOri

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
                    @sTablaOri = 'saCotizacionProveedorReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sDoc_NumOri
            END
    END
```
