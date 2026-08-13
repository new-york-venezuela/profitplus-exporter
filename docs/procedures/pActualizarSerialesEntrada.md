# SP: pActualizarSerialesEntrada
**Tipo**: Actualizar
**Módulo**: Inventario

## Tablas Referenciadas
- [`saSeriales`](../tables/saSeriales.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pActualizarSeriales
*DESCRIPCIÓN	:	Actualiza un registro en la tabla  seriales
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/

CREATE PROCEDURE [pActualizarSerialesEntrada]
    (
      @iRENG_NUM INT ,
      @iRENG_NUMOri INT ,
      @gRowguid UNIQUEIDENTIFIER ,
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
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
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
        UPDATE
            saSeriales
        SET --contador	= @iContador, 
				num_gara = @iNum_Gara, co_art = @sCo_Art, serial = @sSerial, doc_tip_e = @sDoc_Tip_E,
            doc_num_e = @gDoc_Num_E, 
				--doc_tip_s	= @sDoc_Tip_S, 
				--doc_num_s	= @gDoc_Num_S, 
            revisado = @sRevisado, trasnfe = @sTrasnfe, co_alma = @sCo_Alma, co_us_mo = @sCo_Us_Mo,
            co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE()
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            rowguid = @gRowguid

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

		-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
            @sTablaOri = 'saSeriales', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M', @sMaquina = @sMaquina,
            @sCampos = @gRowguid    -- La base manda el valor @sCampos vacio
			
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
