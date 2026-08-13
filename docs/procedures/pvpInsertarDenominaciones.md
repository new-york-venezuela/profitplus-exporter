# SP: pvpInsertarDenominaciones
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacionReng`](../tables/pvValeAlimentacionReng.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pvpInsertarDenominaciones 
*DESCRIPCIÓN	:	Inserta un registro en la tabla  tasas
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/ 

CREATE PROCEDURE [dbo].[pvpInsertarDenominaciones]
    (
      @sCo_Vale CHAR(6) ,
      @deValor DECIMAL (18,2),
      @iReng_Num INT ,
         @bInactivo BIT,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_In CHAR(6) ,
      @sCo_Sucu_In CHAR(6) ,
      @sMaquina VARCHAR(60) = NULL ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1)
    )
AS    
    BEGIN

        DECLARE @TableTimestamp AS TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )

             DECLARE @rengActual int 
             SET @rengActual = (SELECT ISNULL(MAX(reng_num),0) FROM pvValeAlimentacionReng WHERE co_vale = @sCo_Vale)
       
        INSERT  INTO pvValeAlimentacionReng
                ( reng_num, co_vale, valor, inactivo, campo1, campo2, campo3, campo4, campo5, campo6, campo7, campo8,
                  co_us_in, co_sucu_in, fe_us_in, co_us_mo, co_sucu_mo, fe_us_mo, revisado, trasnfe)
        OUTPUT  inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
                INTO @TableTimestamp
        VALUES
                (@rengActual + 1, @sCo_Vale, @deValor, @bInactivo, @sCampo1, @sCampo2, @sCampo3, @sCampo4, @sCampo5, @sCampo6,
                  @sCampo7, @sCampo8, @sCo_Us_In, @sCo_Sucu_In, GETDATE(), @sCo_Us_In, @sCo_Sucu_In, GETDATE(),
                  @sTrasnfe, @sRevisado)

        DECLARE @dtFe_In DATETIME
        DECLARE @rowGuidOri UNIQUEIDENTIFIER

        SELECT
            @dtFe_In = fe_us_in, @rowGuidOri = rowguid
        FROM
            @TableTimestamp

             -- Insertar Pista
        EXEC [pInsertarPista] @sUsuario_Id = @sCo_Us_In, @dtFecha = @dtFe_In, @sCo_Sucu = @sCo_Sucu_in,
            @sTablaOri = 'pvValeAlimentacionReng', @rowguidOri = @rowGuidOri, @sTipo_Op = 'I', @sMaquina = @sMaquina,
            @sCampos = @sCo_Vale
```
