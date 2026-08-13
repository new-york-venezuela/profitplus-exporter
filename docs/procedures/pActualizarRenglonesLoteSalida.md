# SP: pActualizarRenglonesLoteSalida
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pActualizarRenglonesLoteSalida]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pActualizarRenglonesLoteSalida]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER ,
      @gRowguid_RengOri UNIQUEIDENTIFIER ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sTipo_Doc CHAR(4) ,
      @sCo_Art CHAR(30) = NULL ,
      @sCo_Alma CHAR(6) = NULL ,
      @sNumero_Lote CHAR(20) = NULL ,
      @gRowguid_Lote UNIQUEIDENTIFIER ,
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
            saLoteSalida
        SET rowguid_reng = @gRowguid_Reng, reng_num = @iReng_Num, tipo_doc = @sTipo_Doc, co_art = @sCo_Art,
            co_alma = @sCo_Alma, numero_lote = @sNumero_Lote, Rowguid_Lote = @gRowguid_Lote, cantidad = @deCantidad,
            precio = @dePrecio, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            trasnfe = @sTrasnfe, revisado = @sRevisado
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid_reng = @gRowguid_RengOri
            AND reng_num = @iReng_NumOri

		DECLARE @TipoCosto CHAR(1) 
        SELECT
            @TipoCosto = i_costo_inventario
        FROM
            par_emp

		EXEC [dbo].[pCostoActualizarSalida] @RowGuid_Doc_Orig = @gRowguid_RengOri, @strTipo_doc = @sTipo_Doc,
                    @TipoCosto = @TipoCosto
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri =
```
