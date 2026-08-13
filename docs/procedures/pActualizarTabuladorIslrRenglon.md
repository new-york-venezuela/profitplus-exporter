# SP: pActualizarTabuladorIslrRenglon
**Tipo**: Actualizar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saTabuladorIslrReng`](../tables/saTabuladorIslrReng.md)

## Código (excerpt)
```sql
-- =============================================
-- NOMBRE		:	[pActualizarTabuladorIslrRenglon]
-- DESCRIPCION	:	Actualiza un registro en la tabla saTabuladorIslrReng
-- CREADO POR	:	SOFTECH SISTEMAS
-- =============================================
CREATE PROCEDURE [pActualizarTabuladorIslrRenglon]
    (
      @sCo_Tab CHAR(20) ,
      @sCo_TabOri CHAR(20) ,
      @iReng_Num INT ,
      @iReng_NumOri INT ,
      @sCo_Islr CHAR(6) ,
      @dePorc_Ret DECIMAL(18, 5) ,
      @dePorc_Imp DECIMAL(18, 5) ,
      @deSustraen DECIMAL(18, 5) ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sRevisado CHAR(1) ,
      @sTrasnfe CHAR(1) ,
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
            saTabuladorIslrReng
        SET co_tab = @sCo_Tab, reng_num = @iReng_Num, co_islr = @sCo_Islr, porc_ret = @dePorc_Ret,
            porc_imp = @dePorc_Imp, sustraen = @deSustraen, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo,
            fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_tab = @sCo_TabOri
            AND reng_num = @iReng_NumOri
		
	
        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_mo, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

        IF @dtFe_In IS NOT NULL 
            BEGIN
		-- Insertar Pista
                EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_Mo, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_Mo,
                    @sTablaOri = 'saTabuladorIslrReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'M',
                    @sMaquina = @sMaquina, @sCampos = @sCampos
            END

        SELECT
            *
        FROM
            @TableTimestamp
	
    END
```
