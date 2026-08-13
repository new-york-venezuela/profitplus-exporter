# SP: pActualizarRenglonesGiroVenta
**Tipo**: Actualizar
**Módulo**: Ventas

## Tablas Referenciadas
- [`saDocumentoVentaReng`](../tables/saDocumentoVentaReng.md)
- [`saGiroVentaReng`](../tables/saGiroVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		: pActualizarRenglonesGiroVenta
DESCRIPCION	: Inserta un registro de la tabla saDocumentoVentaReng
CREADO POR	: SOFTECH SISTEMAS

***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesGiroVenta]
    (
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sco_Giro CHAR(20) ,
      @sco_GiroOri CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @demonto_cob DECIMAL(18, 2) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sMaquina VARCHAR(60) = NULL
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        UPDATE
            saGiroVentaReng
        SET reng_num = @iReng_Num, co_tipo_doc = @sCo_Tipo_Doc, nro_doc = @sNro_Doc, monto_cob = @demonto_cob,
            co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(), revisado = @sRevisado,
            trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            reng_num = @iReng_NumOri
            AND co_Giro = @sCo_GiroOri	
					
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saGiroVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sco_giro
		
        SELECT
            *
        FROM
            @TableTimestamp

    END
```
