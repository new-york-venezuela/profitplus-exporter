# SP: pActualizarEncabezadosNotaRecepcionCompra
**Tipo**: Actualizar
**Módulo**: Compras

## Tablas Referenciadas
- [`saNotaRecepcionCompra`](../tables/saNotaRecepcionCompra.md)

## Código (excerpt)
```sql
/***********************************************************************
*NOMBRE			:	pActualizarEncabezadosNotaRecepcionCompra
*DESCRIPCIÓN	:	Actualiza el Encabezado del Renglon para Indicar que cambio
*AUTOR			:	SOFTECH SISTEMAS
*MODIFICADO POR	:	SOFTECH SISTEMAS
************************************************************************/

CREATE PROCEDURE [dbo].[pActualizarEncabezadosNotaRecepcionCompra]
    (
      @sDoc_Num CHAR(20) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		
	
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
            saNotaRecepcionCompra
        SET fe_us_mo = GETDATE(), co_us_mo = @sCo_Us_Mo
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            doc_num = @sDoc_Num
            AND validador = @tsValidador

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saNotaRecepcionCompra', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
				@sCampos = 'Actualización de renglón.'

        SELECT
            *
        FROM
            @TableTimestamp

    END
```
