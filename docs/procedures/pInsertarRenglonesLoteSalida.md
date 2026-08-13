# SP: pInsertarRenglonesLoteSalida
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saLoteSalida`](../tables/saLoteSalida.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: [pInsertarRenglonesLoteSalida]
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [dbo].[pInsertarRenglonesLoteSalida]
    (
      @gRowguid_Reng UNIQUEIDENTIFIER ,
      @iReng_Num INT ,
      @sTipo_Doc CHAR(4) ,
      @sCo_Art CHAR(30) = NULL ,
      @sCo_Alma CHAR(6) = NULL ,
      @sNumero_Lote CHAR(20) = NULL ,
      @gRowguid_Lote UNIQUEIDENTIFIER ,
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

        INSERT  INTO saLoteSalida
                ( rowguid_reng, reng_num, tipo_doc, co_art, co_alma, numero_lote, Rowguid_Lote, cantidad, precio,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @gRowguid_Reng, @iReng_Num, @sTipo_Doc, @sCo_Art, @sCo_Alma, @sNumero_Lote, @gRowguid_Lote,
                  @deCantidad, @dePrecio, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sTrasnfe, @sRevisado )

		DECLARE @TipoCosto CHAR(1) 
        SELECT
            @TipoCosto = i_costo_inventario
        FROM
            par_emp

		EXEC [dbo].[pCostoActualizarSalida] @RowGuid_Doc_Orig = @gRowguid_Reng, @strTipo_doc = @sTipo_Doc,
                    @TipoCosto = @TipoCosto

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saLoteSalida', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sTipo_Doc
	
        SELECT
            *
```
