# SP: pEliminarRenglonesImpuestoSobreVenta
**Tipo**: Eliminar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoSobreVentaReng`](../tables/saImpuestoSobreVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRenglonesImpuestoSobreVenta  
DESCRIPCION: Elimina un renglón de la tabla saImpuestoSobreVentaReng
CREADO POR: SOFTECH SISTEMAS 
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pEliminarRenglonesImpuestoSobreVenta]
    (
      @sdFechaOri CHAR(20) ,
      @iReng_NumOri INT ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) = NULL ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL
	
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER,
			  porc_tasa decimal(18,5),
			  tipo_imp char(1)
            )

        DELETE FROM
            saImpuestoSobreVentaReng
        OUTPUT
            deleted.rowguid,deleted.porc_tasa,deleted.tipo_imp
            INTO @TableTimestamp
        WHERE
            fecha = @sdFechaOri
            AND reng_num = @iReng_NumOri

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @sFecCrea varchar(20)
		DECLARE @sTipoImp varchar(20)
		DECLARE @dPorc_tasa decimal(18,5)

		set @sFecCrea =CONVERT(varchar(20),@sdFechaOri,120)

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid, @sTipoImp = 'Tipo Imp:' + tipo_imp, @dPorc_tasa = porc_tasa
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saImpuestoSobreVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E',
                    @sMaquina = @sMaquina, @sCampos = @sFecCrea, @deAUX01 =@dPorc_tasa, @sAUX02 =  @sTipoImp
            END
    END
```
