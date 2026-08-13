# SP: pActualizarRenglonesLote
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saLoteEntrada`](../tables/saLoteEntrada.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarRenglonesLote]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarRenglonesLote]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER ,
      @gRowguid_RengOri UNIQUEIDENTIFIER ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sTipo_Doc CHAR(4) ,
      @sCo_Art CHAR(30) = NULL ,
      @sCo_Alma CHAR(6) = NULL ,
      @sNumero_Lote CHAR(20) = NULL ,
      @sdFecha_Inicio SMALLDATETIME = NULL ,
      @sdFecha_Expiracion SMALLDATETIME = NULL ,
      @deCantidad DECIMAL(18, 5) ,
      @dePrecio DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
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
            saLoteEntrada
        SET rowguid_reng = @gRowguid_Reng, reng_num = @iReng_Num, tipo_doc = @sTipo_Doc, co_art = @sCo_Art,
            co_alma = @sCo_Alma, numero_lote = @sNumero_Lote, fecha_inicio = @sdFecha_Inicio,
            fecha_expiracion = @sdFecha_Expiracion, cantidad = @deCantidad, precio = @dePrecio,
            stock_actual = @deCantidad, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            trasnfe = @sTrasnfe, revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_reng = @gRowguid_RengOri
            AND reng_num = @iReng_NumOri
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saLoteEntrada', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sCampos

        SELECT
            *
        FR
```
