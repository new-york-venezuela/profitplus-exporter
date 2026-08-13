# SP: pActualizarAjustePrecioCostoManualRenglon
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoReng`](../tables/saAjPrecioCostoReng.md)

## Código (excerpt)
```sql
/**********************************************************************
*NOMBRE:		[pActualizarAjustePrecioCostoManualRenglon]
*DESCRIPCIÓN :	Actualiza los renglones de un ajuste de precio o costo manual
*AUTOR:			SOFTECH SISTEMAS
*CREADO:		2011-12-12
*ACTUALIZACIÓN : 2020-06-18
***********************************************************************/

CREATE PROCEDURE [dbo].[pActualizarAjustePrecioCostoManualRenglon]
    (
      @sCod_Ajuste CHAR(20) ,
      @sCod_AjusteOri CHAR(20) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Art CHAR(30) ,
      @sArt_Des VARCHAR(120) ,
      @deMonto DECIMAL(18, 5) ,
      @dDesde DATETIME ,
      @dHasta DATETIME ,
      @sCo_Alma CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER = NULL 

	  -->>JN 20200525
	  , @growguid_ArtPrecio UNIQUEIDENTIFIER = NULL
	  --<<JN 20200525		
    )
AS 
    BEGIN		
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            ) ;
		
        UPDATE
            saAjPrecioCostoReng
        SET cod_ajuste = @sCod_Ajuste, reng_num = @iReng_Num, co_art = @sCo_Art, monto = @deMonto, desde = @dDesde,
            hasta = @dHasta, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            cod_ajuste = @sCod_Ajuste
            AND reng_num = @iReng_NumOri
			
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		
        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saAjPrecioCostoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M',
                    @sMaquina = @sMaquina, @sCampos = @sCampos
            END

        SELECT
            *
        FROM
            @TableTimestamp
    END
```
