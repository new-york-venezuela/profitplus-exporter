# SP: pInsertarRenglonesLote
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarRenglonesLote
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarRenglonesLote]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER ,
      @iReng_Num INT ,
      @sTipo_Doc CHAR(4) ,
      @sCo_Art CHAR(30) = NULL ,
      @sCo_Alma CHAR(6) = NULL ,
      @sNumero_Lote CHAR(20) = NULL ,
      @sdFecha_Inicio SMALLDATETIME = NULL ,
      @sdFecha_Expiracion SMALLDATETIME = NULL ,
      @deCantidad DECIMAL(18, 5) ,
      @dePrecio DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saLoteEntrada
                ( rowguid_reng, reng_num, tipo_doc, co_art, co_alma, numero_lote, fecha_inicio, fecha_expiracion,
                  cantidad, stock_actual, precio, co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo,
                  trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @gRowguid_Reng, @iReng_Num, @sTipo_Doc, @sCo_Art, @sCo_Alma, @sNumero_Lote, @sdFecha_Inicio,
                  @sdFecha_Expiracion, @deCantidad, @deCantidad, @dePrecio, @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sTrasnfe, @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saLoteEntrada', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sTipo_Doc
	
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
