# SP: pEliminarImpuestoSobreVenta
**Tipo**: Eliminar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoSobreVenta`](../tables/saImpuestoSobreVenta.md)
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE : pEliminarImpuestoSobreVenta
*DESCRIPCIÓN : Elimina un Impuesto Sobre la Venta
*AUTOR : SOFTECH SISTEMAS 
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarImpuestoSobreVenta]
    (
      @sdFechaOri SMALLDATETIME ,
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
		DECLARE @sRowDel varchar(max)
		set @sRowDel =''
		if exists (select fecha from saImpuestoSobreVenta WHERE fecha = @sdFechaOri  AND validador = @tsValidador)
		begin
			SELECT  @sRowDel =STUFF((
						 SELECT ', ' + convert(varchar(60),rowguid)
						 FROM  [saImpuestoSobreVentaReng] a2
						 WHERE a.fecha = a2.fecha
						 FOR XML PATH('')), 1, 2, '')
				FROM  [saImpuestoSobreVentaReng] a where a.fecha =@sdFechaOri  group by a.fecha
        end

        DELETE FROM
            saImpuestoSobreVenta
        OUTPUT
            deleted.rowguid
            INTO @TableTimestamp
        WHERE
            fecha = @sdFechaOri
            AND validador = @tsValidador

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

		DECLARE @sFecCrea varchar(20)
		set @sFecCrea =CONVERT(varchar(20),@sdFechaOri,120)

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saImpuestoSobreVenta', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos =@sRowDel,  @sAUX02 =@sFecCrea
            END

    END
```
