# SP: pInsertarSerialesEntrada
**Tipo**: Insertar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pInsertarSeriales
*DESCRIPCIÓN	:	Inserta un registro en la tabla  seriales
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pInsertarSerialesEntrada]
    (
      @iReng_Num INT = NULL ,
      @iNum_Gara INT = NULL ,
      @sCo_Art CHAR(30) ,
      @sSerial VARCHAR(40) ,
      @sDoc_Tip_E CHAR(4) = NULL ,
      @gDoc_Num_E UNIQUEIDENTIFIER = NULL ,
      @sDoc_Tip_S CHAR(4) = NULL ,
      @gDoc_Num_S UNIQUEIDENTIFIER = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
      @sCo_Alma CHAR(6) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL
    )
AS 
    BEGIN
        DECLARE @TableTimestamp TABLE
            (
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
        INSERT  INTO saSeriales
                ( reng_num, num_gara, co_art, serial, doc_tip_e, doc_num_e, revisado, trasnfe, co_alma, co_us_in,
                  co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @iReng_Num, @iNum_Gara, @sCo_Art, @sSerial, @sDoc_Tip_E, @gDoc_Num_E, @sRevisado, @sTrasnfe, @sCo_Alma,
                  @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE() )

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saSeriales', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @rowGuidOri
		
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
