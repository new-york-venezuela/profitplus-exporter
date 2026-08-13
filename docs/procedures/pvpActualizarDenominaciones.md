# SP: pvpActualizarDenominaciones
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvValeAlimentacionReng`](../tables/pvValeAlimentacionReng.md)

## Código (excerpt)
```sql
/******************************************************************
*NOMBRE			:	pvpActualizarDenominaciones 
*DESCRIPCIÓN	:	Actualiza un registro en la tabla  Denominaciones
*AUTOR			:	SOFTECH SISTEMAS
******************************************************************/ 

CREATE PROCEDURE [dbo].[pvpActualizarDenominaciones]
    (
      @sCo_Vale CHAR(6) ,
      @SCo_ValeOri CHAR(6),
      @deValor DECIMAL (18,2),
      @iReng_Num INT ,
      @iRENG_NUMOri INT ,
	  @bInactivo BIT,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sCo_Sucu_Mo CHAR(6) = NULL ,
      @sMaquina VARCHAR(60) = NULL ,
      @sCampos VARCHAR(MAX) = NULL ,
      @sTrasnfe CHAR(1) ,
      @sRevisado CHAR(1) ,
      @tsValidador TIMESTAMP = NULL ,
      @gRowguid UNIQUEIDENTIFIER = NULL 
    )
AS 
    BEGIN

        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME ,
              rowguid UNIQUEIDENTIFIER
            )
		
        UPDATE
            pvValeAlimentacionReng
        SET co_vale = @sCo_Vale, 
			reng_num = @iRENG_NUM,
			valor = @deValor,
			inactivo =  @bInactivo, campo1 = @sCampo1,
            campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4, campo5 = @sCampo5, campo6 = @sCampo6,
            campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo, co_sucu_mo = @sCo_Sucu_Mo, fe_us_mo = GETDATE(),
            trasnfe = @sTrasnfe, revisado = @sRevisado
        OUTPUT
            inserted.validador, inserted.fe_us_in, inserted.fe_us_mo, Inserted.rowguid
            INTO @TableTimestamp
        WHERE
            co_Vale = @SCo_ValeOri	and reng_num = @iRENG_NUMOri
           

			
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
                    @sTablaOri = 'pvValeAlimentacionReng', @rowguidOri = @rowGuidOr
```
