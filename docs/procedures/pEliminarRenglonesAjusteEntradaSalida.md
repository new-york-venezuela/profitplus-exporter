# SP: pEliminarRenglonesAjusteEntradaSalida
**Tipo**: Eliminar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pEliminarRenglonesAjuste
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pEliminarRenglonesAjusteEntradaSalida]
    (
      @sAjue_NumOri CHAR(20) ,
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
              rowguid UNIQUEIDENTIFIER ,
              co_tipo CHAR(6)
            )

        DELETE FROM
            saAjusteReng
        OUTPUT
            deleted.rowguid, deleted.co_tipo
            INTO @TableTimestamp
        WHERE
            ajue_num = @sAjue_NumOri
            AND reng_num = @iReng_NumOri

        DECLARE @dtFe_De DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
        DECLARE @sCo_Tipo CHAR(6)

        SELECT
            @dtFe_De = GETDATE(), @rowGuidOri = rowguid, @sCo_Tipo = co_tipo
        FROM
            @TableTimestamp

		
	--Eliminar Historico de Costos
        IF ( EXISTS ( SELECT
                        co_tipo
                      FROM
                        saTipoAjuste
                      WHERE
                        co_tipo = @sCo_Tipo
                        AND tipo_trans = 0 ) ) 
            EXEC [dbo].[pCostoEliminarEntrada] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'AJUS'
        ELSE 
            EXEC [dbo].[pCostoEliminarSalida] @RowGuid_Doc_Orig = @rowGuidOri, @strTipo_doc = 'AJUS'
	--FIn Eliminar costos historicos

	--Elimnar Seriales de Entrada del renglon
        EXEC [dbo].[pEliminarSerialesEntradaRenglon] @sTipo_Doc = N'AJUS', @gRowguid = @rowGuidOri
        EXEC [dbo].[pEliminarSerialesSalidaRenglon] @sTipo_Doc = N'AJUS', @gRowguid = @rowGuidOri
        
        EXEC [dbo].[pEliminarRenglonLoteSalida] @gRowguid_Reng = @rowGuidOri,
        @sTipo_doc = N'AJUS', @sTablaOri = N'saAjusteReng', @sCo_Us_Mo = @sCo_Us_Mo,
        @sMaquina =@sMaquina, @sCo_Sucu_Mo = @sCo_Sucu_Mo
        
        EXEC [dbo].[pEliminarRenglonLoteEntrada] @gRowguid_Reng = @rowGuidOri,
        @sTipo_doc = N'AJUS', @sTablaOri = N'saAjusteReng', @sCo_Us_Mo = @sCo_Us_Mo,
        @sMaquina =@sMaquina, @sCo_Sucu_Mo = @sCo_S
```
