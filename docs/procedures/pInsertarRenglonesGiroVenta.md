# SP: pInsertarRenglonesGiroVenta
**Tipo**: Insertar
**Módulo**: General

## Tablas Referenciadas
- [`saGiroCompraReng`](../tables/saGiroCompraReng.md)
- [`saGiroVentaReng`](../tables/saGiroVentaReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE		:pInsertarRenglonesGiroVenta
DESCRIPCION	: Inserta un registro de la tabla saGiroCompraReng
CREADO POR	: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesGiroVenta]
    (
      @iReng_Num INT ,
      @sco_Giro CHAR(20) ,
      @sCo_Tipo_Doc CHAR(6) ,
      @sNro_Doc CHAR(20) ,
      @demonto_cob DECIMAL(18, 2) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
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


        INSERT  INTO saGiroVentaReng
                ( reng_num, co_giro, co_tipo_doc, nro_doc, monto_cob, co_us_in, co_sucu_in, fe_us_in, co_us_mo,
                  co_sucu_mo, fe_us_mo, revisado, trasnfe )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iReng_Num, @sCo_giro, @sCo_Tipo_Doc, @sNro_Doc, @demonto_cob, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sRevisado, @sTrasnfe )
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC pInsertarPista @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saGiroVentaReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Giro
		
        SELECT
            *
        FROM
            @TableTimestamp

    END
```
