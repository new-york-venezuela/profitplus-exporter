# SP: pEliminarValorImpuestoRenglon
**Tipo**: Eliminar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saImpuestoReng`](../tables/saImpuestoReng.md)

## Código (excerpt)
```sql
/************************************************************************
*NOMBRE			: pEliminarValorImpuestoRenglon
*DESCRIPCIÓN	: Elimina un registro en la tabla saImpuestoRenglon
*AUTOR			: SOFTECH SISTEMAS
*************************************************************************/

CREATE PROCEDURE [dbo].[pEliminarValorImpuestoRenglon]
    (
      @sCod_ImpuestoOri CHAR(6) ,
      @sdFecha_RegisOri DATETIME ,
      @iRENG_NUMOri INT ,
      @sCo_Us_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @gRowguid UNIQUEIDENTIFIER = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              rowguid UNIQUEIDENTIFIER,
			  deValor_Porcent DECIMAL(5,2),
			  fecha_regis smalldatetime
            )

        DELETE FROM
            saImpuestoReng
        OUTPUT
            deleted.rowguid,
			deleted.valor_porcent,
			deleted.fecha_regis
            INTO @TableTimestamp
        WHERE
            cod_impuesto = @sCod_ImpuestoOri
            AND fecha_regis = @sdFecha_RegisOri	

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @deValor_Porcent DECIMAL(5,2) 
		declare @sfecha_regis varchar(30)
        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid, @deValor_Porcent = deValor_Porcent, @sfecha_regis =  CONVERT(varchar(20),fecha_regis,120)
        FROM
            @TableTimestamp

        IF @dtFe_De IS NOT NULL 
            BEGIN
				-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_De, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saImpuestoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'E', @sMaquina = @sMaquina,
                    @sCampos = @sCod_ImpuestoOri, @deAUX01 =@deValor_Porcent, @sAUX02 =@sfecha_regis
            END


    END
```
