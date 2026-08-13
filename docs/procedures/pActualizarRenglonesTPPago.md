# SP: pActualizarRenglonesTPPago
**Tipo**: Actualizar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	[pActualizarRenglonesPagoTP]
*DESCRIPCIÓN	:	Actualiza un registro en la tabla saPagoTPReng
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/


CREATE PROCEDURE [pActualizarRenglonesTPPago]
    (
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCob_Num CHAR(20) ,
      @sCob_NumOri CHAR(20) ,
      @sForma_Pag CHAR(2) ,
      @sCod_Cta CHAR(6) ,
      @sCod_Caja CHAR(6) ,
      @sMov_Num_C CHAR(20) = NULL ,
      @sMov_Num_B CHAR(20) = NULL ,
      @sNum_Doc CHAR(20) ,
      @bDevuelto BIT ,
      @deMont_Doc DECIMAL(18, 2) ,
      @sdFecha_Che SMALLDATETIME ,
      @sCo_Sucu_Mo CHAR(6) ,
      @sCo_Us_Mo CHAR(6) ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1) ,
      @gRowguid UNIQUEIDENTIFIER ,
      @sMaquina VARCHAR(60) ,
      @sCampos VARCHAR(MAX)
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
            saPagoTPReng
        SET [reng_num] = @iReng_Num, [cob_num] = @sCob_Num, [forma_pag] = @sForma_Pag, [cod_cta] = @sCod_Cta,
            [cod_caja] = @sCod_Caja, [mov_num_c] = @sMov_Num_C, [mov_num_b] = @sMov_Num_B, [num_doc] = @sNum_Doc,
            [devuelto] = @bDevuelto, [mont_doc] = @deMont_Doc, [fecha_che] = @sdFecha_Che, [co_sucu_mo] = @sCo_Sucu_Mo,
            [co_us_mo] = @sCo_Us_Mo, [fe_us_mo] = GETDATE(), [trasnfe] = @sTrasnfe, [revisado] = @sRevisado,
            [rowguid] = @gRowguid
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            Cob_Num = @sCob_NumOri
            AND reng_num = @iReng_NumOri

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp
	
		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saPagoTPReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @sCampos
		
        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```
