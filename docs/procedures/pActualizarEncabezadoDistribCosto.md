# SP: pActualizarEncabezadoDistribCosto
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saDistribCosto`](../tables/saDistribCosto.md)
- [`saPago`](../tables/saPago.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE:			pActualizarEncabezadoDistribCosto
DESCRIPCION:	Actualiza el validador de la tabla  saPago para Indicar que cambio
CREADO POR:		SOFTECH SISTEMAS
***************************************************************************************************************/
-- =============================================
CREATE PROCEDURE [dbo].[pActualizarEncabezadoDistribCosto]
    (
      @sDistrib_Num		CHAR(20) ,
      @sCo_Us_Mo		CHAR(6)				= NULL ,
      @sCo_Sucu_Mo		CHAR(6)				= NULL ,
      @sMaquina			VARCHAR(60)			= NULL ,
      @tsValidador		TIMESTAMP ,
      @gRowguid			UNIQUEIDENTIFIER	= NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        DECLARE @dtFe_In DATETIME

        DECLARE @rowGuidOri UNIQUEIDENTIFIER
			
        UPDATE
            saDistribCosto
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            distrib_num = @sDistrib_Num
            AND validador = @tsValidador
        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
			-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saDistribCosto', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
					@sCampos = 'Actualización de renglón.'
            END
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
