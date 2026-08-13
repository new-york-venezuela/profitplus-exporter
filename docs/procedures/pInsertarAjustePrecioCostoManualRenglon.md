# SP: pInsertarAjustePrecioCostoManualRenglon
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjPrecioCostoReng`](../tables/saAjPrecioCostoReng.md)

## Código (excerpt)
```sql
/********************************************************************
*NOMBRE			: [pInsertarAjustePrecioCostoManualRenglon]
*DESCRIPCIÓN	: Inserta un renglon de ajuste de precio/costo manual
*AUTOR			: SOFTECH SISTEMAS
*CREADO			: 2011-12-12
*ACTUALIZACIÓN	: 2020-06-18
*********************************************************************/
CREATE PROCEDURE [dbo].[pInsertarAjustePrecioCostoManualRenglon]
    (
      @sCod_Ajuste CHAR(20) ,
      @iReng_Num INT ,
      @sCo_Art CHAR(30) ,
      @sArt_Des VARCHAR(120) = NULL ,
      @sCo_Alma CHAR(6) ,
      @deMonto DECIMAL(18, 5) ,
      @dDesde DATETIME ,
      @dHasta DATETIME ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1)

	  -->>JN 20200522
	  , @growguid_ArtPrecio UNIQUEIDENTIFIER = NULL
	  --<<JN 20200522
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
			
        INSERT  INTO saAjPrecioCostoReng
                ( cod_ajuste, reng_num, co_art, monto, desde, hasta, co_alma, co_us_in, co_sucu_in, fe_us_in, co_us_mo,
                  co_sucu_mo, fe_us_mo, revisado, trasnfe 
				  -->>JN 20200522
				  , rowguid_ArtPrecio
				  --<<JN 20200522
				  )
        OUTPUT  Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCod_Ajuste, @iReng_Num, @sCo_Art, @deMonto, @dDesde, @dHasta, @sCo_Alma, @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe 
				 --JN 20200522
				 , @growguid_ArtPrecio 
				  )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

			-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saAjPrecioCostoReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCod_Ajuste

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
