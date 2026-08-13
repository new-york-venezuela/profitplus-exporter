# SP: pActualizarEncabezadoPlantillaCompraReq
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saPlantillaCompra`](../tables/saPlantillaCompra.md)
- [`saPlantillaCompraReq`](../tables/saPlantillaCompraReq.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			:	pActualizarEncabezadoPlantillaCompraReq
*DESCRIPCIÓN	:	Actualiza el Encabezado del Renglon para Indicar que cambio
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarEncabezadoPlantillaCompraReq]
    (
      @gRowguid_Plantilla_Compra		UNIQUEIDENTIFIER,			
      @sCo_Us_Mo	CHAR(6)				= NULL ,
      @sCo_Sucu_Mo	CHAR(6)				= NULL ,
      @sMaquina		VARCHAR(60)			= NULL ,
      @tsValidador	TIMESTAMP 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX),
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER
		DECLARE @rowguidReq UNIQUEIDENTIFIER

		SET @rowguidReq = (SELECT PCR.rowguid FROM saPlantillaCompraReq PCR inner join saPlantillaCompra PC ON PC.rowguid = PCR.rowguid_plantilla_compra WHERE pc.rowguid = @gRowguid_Plantilla_Compra)
			
        UPDATE
            saPlantillaCompraReq
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid = @rowguidReq
            AND validador = @tsValidador

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saPlantillaCompraReq', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
						@sCampos = 'Actualización de renglón.'
            END

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
