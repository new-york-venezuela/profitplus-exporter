# SP: pInsertarRenglonesPlantillaCompraReqRelacion
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReqRelacion`](../tables/saPlantillaCompraReqRelacion.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			:	pInsertarRenglonesPlantillaCompraReqRelacion
*DESCRIPCIÓN	:	Inserta un renglon en PlantillaCompraReqRelacion
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarRenglonesPlantillaCompraReqRelacion]
    (
		@gRowguid_Reng_Req uniqueidentifier,
		@gRowguid_Reng_Imp uniqueidentifier,
		@bEntregado BIT,
		@dFecha_Real_Entrega DateTime,
		@sDocumento varchar(60),
		@sDoc_Num varchar(20),
		@dFecha_Doc datetime,
		@sEstatus char(1),
		@sProv_Des varchar(100),
		@sCo_Art char(30),
		@deTotal_Art decimal(18,5),
		@sArt_Des char(120),
		@sCo_Uni char(6),
		@sComentario varchar(512),
		@iRENG_NUM int,
		@sREVISADO char(1),
		@sTRASNFE char(1),
		@sco_sucu_in char(6),
		@sco_us_in char(6),
		@sMaquina  VARCHAR(60) = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
			DECLARE @sCo_Tipo_Doc char(6)

			IF @sDocumento = 'Cotización'
			BEGIN
				SET @sCo_Tipo_Doc = 'CPRO'
			END
			ELSE IF @sDocumento = 'Factura'
			BEGIN
				SET @sCo_Tipo_Doc = 'COMP'
			END
			ELSE IF @sDocumento = 'Nota de recepcion'
			BEGIN
				SET @sCo_Tipo_Doc = 'NREC'
			END
			ELSE IF @sDocumento = 'Orden de Compra'
			BEGIN
				SET @sCo_Tipo_Doc = 'OCOM'
			END

        INSERT  INTO saPlantillaCompraReqRelacion
           (rowguid_reng_req,
			rowguid_reng_imp,
			co_tipo_doc,
			entregado,
			fecha_real_entrega,
			total_art,
			comentario,
			co_us_in,
			co_us_mo,
            co_sucu_in,
            fe_us_in,
            fe_us_mo,
            revisado,
            trasnfe

			)
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                (@gRowguid_Reng_Req,
			@gRowguid_Reng_Imp,
			@sCo_Tipo_Doc,
			@bEntregado,
			@dFecha_Real_Entrega,
			@deTotal_Art,
			@sComentario,
            @sCo_Us_In,
			@sCo_Us_In,
            @sCo_Sucu_In,
            GETDATE(),
            GETDATE(),
            @sRevisado,
            @sTrasnfe)
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = ro
```
