# SP: pInsertarRenglonesPlantillaCompraReq
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompraReng`](../tables/saPlantillaCompraReng.md)
- [`saPlantillaCompraReqRenglon`](../tables/saPlantillaCompraReqRenglon.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			:	pInsertarRenglonesPlantillaCompraReq
*DESCRIPCIÓN	:	Inserta un renglon de compra
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [dbo].[pInsertarRenglonesPlantillaCompraReq]
    (
		   @growguid_plantilla_renglon uniqueidentifier,
           @dFecha_Requerida datetime,
           @dFecha_Real_entrega datetime,
           @sComentario char(60),
		   @bSatisface BIT,
           @sCo_Us_In char(6),
           @sCo_Sucu_In char(6),
           @sCo_Us_Mo char(6) = NULL,
           @sCo_Sucu_Mo char(6) = NULL,
           @sRevisado char(1),
           @sTrasnfe char(1),
		   @sMaquina VARCHAR(60) = NULL,
		   @iRENG_NUM int = 0,
		   @sCo_Art char(30),
		   @sArt_Des char(120),
		   @sCo_Uni char(6),
		   @sEstatus CHAR(1)
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saPlantillaCompraReqRenglon
           ([rowguid_plantilla_renglon]
           ,[fecha_requerida]
           ,[fecha_real_entrega]
           ,[comentario]
		   ,[satisface]
		   ,[estatus]
           ,[co_us_in]
           ,[co_sucu_in]
           ,[fe_us_in]
           ,[co_us_mo]
           ,[co_sucu_mo]
           ,[fe_us_mo]
           ,[revisado]
           ,[trasnfe])
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                (@growguid_plantilla_renglon,
           @dFecha_Requerida,
           @dFecha_Real_entrega,
           @sComentario,
		   @bSatisface,
		   @sEstatus,
           @sCo_Us_In,
           @sCo_Sucu_In,
           GETDATE(),
           @sCo_Us_In,
           @sCo_Sucu_In,
           GETDATE(),
           @sRevisado,
           @sTrasnfe)
		
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saPlantillaCompraReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquin
```
