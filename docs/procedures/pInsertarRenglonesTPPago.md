# SP: pInsertarRenglonesTPPago
**Tipo**: Insertar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saPagoTPReng`](../tables/saPagoTPReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			:	[pInsertarRenglonesPagoTP]
*DESCRIPCIÓN	:	Inserta un registro en la tabla saPagoTPReng
*AUTOR			:	SOFTECH SISTEMAS
***************************************************************************/

CREATE PROCEDURE [pInsertarRenglonesTPPago]
    (
      @iReng_Num INT ,
      @sCob_Num CHAR(20) ,
      @sForma_Pag CHAR(4) ,
      @sMov_Num_C CHAR(20) ,
      @sMov_Num_B CHAR(20) ,
      @sNum_Doc CHAR(20) ,
      @bDevuelto BIT ,
      @deMont_Doc DECIMAL(18, 2) ,
      @sCod_Cta CHAR(6) ,
      @sCod_Caja CHAR(6) ,
      @sdFecha_Che SMALLDATETIME ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1) ,
      @sMaquina VARCHAR(60)
    )
AS 
    BEGIN
		
        DECLARE @Tabletimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

        INSERT  INTO saPagoTPReng
                ( [reng_num], [cob_num], [forma_pag], [cod_cta], [cod_caja], [mov_num_c], [mov_num_b], [num_doc],
                  [devuelto], [mont_doc], [fecha_che], [co_sucu_in], [co_us_in], [fe_us_in], [co_sucu_mo], [co_us_mo],
                  [fe_us_mo], [trasnfe], [revisado] )
        OUTPUT  Inserted.fe_us_in, Inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iReng_Num, @sCob_Num, @sForma_Pag, @sCod_Cta, @sCod_Caja, @sMov_Num_C, @sMov_Num_B, @sNum_Doc,
                  @bDevuelto, @deMont_Doc, @sdFecha_Che, @sCo_Sucu_In, @sCo_Us_In, GETDATE(), @sCo_Sucu_In, @sCo_Us_In,
                  GETDATE(), @sTrasnfe, @sRevisado )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saPagoTPReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCob_Num
		
        SELECT
            *
        FROM
            @TableTimestamp

    END
```
