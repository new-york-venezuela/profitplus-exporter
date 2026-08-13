# SP: pInsertarTabuladorIslrRenglon
**Tipo**: Insertar
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saTabuladorIslrReng`](../tables/saTabuladorIslrReng.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pInsertarTabuladorIslrRenglon
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pInsertarTabuladorIslrRenglon]
    (
      @sCo_Tab CHAR(20) ,
      @iReng_Num INT ,
      @sCo_Islr CHAR(6) ,
      @dePorc_Ret DECIMAL(18, 5) ,
      @dePorc_Imp DECIMAL(18, 5) ,
      @deSustraen DECIMAL(18, 5) ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
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
	
    
        INSERT  INTO saTabuladorIslrReng
                ( co_tab, reng_num, co_islr, porc_ret, porc_imp, sustraen, co_us_in, co_sucu_in, fe_us_in, co_us_mo,
                  fe_us_mo, trasnfe, revisado )
        OUTPUT  inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                ( @sCo_Tab, @iReng_Num, @sCo_Islr, @dePorc_Ret, @dePorc_Imp, @deSustraen, @sCo_Us_In, @sCo_Sucu_In,
                  GETDATE(), @sCo_Us_In, GETDATE(), @sTrasnfe, @sRevisado )	

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

	-- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'saTabuladorIslrReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Tab
	
        SELECT
            *
        FROM
            @TableTimestamp
    END
```
